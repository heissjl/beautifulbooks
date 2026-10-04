import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import type { ProviderRow } from '@/lib/insights/model';
import { buildReport, parseMarket, parseRange, RANGES, type InsightsReport } from '@/lib/insights/report';
import type { Market } from '@/lib/market';
import { adminCookieValid } from '@/lib/suggest/session';
import { PRICES_AS_OF } from '@/lib/insights/prices';
import { PHOTOS_PER_DAY } from '@/app/api/walls/photo/route';

/**
 * Julian's analytics (ROADMAP 3.1a, docs/plans/PLAN-3.1-analyse.md §8):
 * online, behind the admin cookie that /curate issues. Anyone else gets the
 * site's 404 — the page does not announce itself. German only: one reader.
 *
 * 3.1a shows what the server counts exactly — clicks through `/go/` (K3) and
 * the operation's stumbles (K11). The reader-side numbers (click rate,
 * funnel, search, wall, verdict) arrive with 3.1b; the page says so instead
 * of showing empty charts.
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Analyse', robots: { index: false, follow: false } };

const MARKET_NAMES: Record<Market, string> = { us: 'US', uk: 'UK', de: 'DE' };
const nf = new Intl.NumberFormat('de-DE');
const pf = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });
const plural = (k: number, one: string, many: string) => `${nf.format(k)} ${k === 1 ? one : many}`;
const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', timeZone: 'UTC' });

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function InsightsPage({ searchParams }: Props) {
  if (!(await adminCookieValid())) notFound();
  const params = await searchParams;
  const days = parseRange(one(params.days));
  const market = parseMarket(one(params.market));
  const report = await buildReport(days, market, undefined);
  const href = (next: { days?: number; market?: Market | null }) => {
    const q = new URLSearchParams();
    q.set('days', String(next.days ?? days));
    const m = next.market === undefined ? market : next.market;
    if (m) q.set('market', m);
    return `/admin/insights?${q}`;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl text-ink">Analyse</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          Was auf der Seite passiert, als Tagessummen ohne irgendetwas über Leser. Aufrufe und Herkunft im Einzelnen:
          Vercel Web Analytics; Anfragen bei Google: Search Console; Käufe: Partner-Dashboards.
        </p>

        <nav aria-label="Filter" className="mt-6 flex flex-wrap gap-2">
          <Segment items={RANGES.map(d => ({ label: `${d} Tage`, href: href({ days: d }), active: d === days }))} />
          <Segment
            items={[
              { label: 'Alle Märkte', href: href({ market: null }), active: !market },
              ...(['us', 'uk', 'de'] as const).map(m => ({ label: MARKET_NAMES[m], href: href({ market: m }), active: m === market })),
            ]}
          />
        </nav>

        {report.ok ? <Report report={report} /> : <StoreDown reason={report.reason} />}

      </main>
      <SiteFooter />
    </div>
  );
}

function Segment({ items }: { items: Array<{ label: string; href: string; active: boolean }> }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line bg-surface text-sm">
      {items.map(item => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={`px-3 py-1.5 ${item.active ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:text-ink'}`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function StoreDown({ reason }: { reason: 'no-store' | 'failed' }) {
  return (
    <p className="mt-8 rounded-lg border border-line bg-surface p-4 text-sm text-ink">
      {reason === 'no-store'
        ? 'Hier ist kein Speicher verbunden, also gibt es nichts zu lesen. Das ist keine Aussage über Klicks.'
        : 'Der Speicher hat nicht geantwortet. Das ist keine Aussage über Klicks; später noch einmal laden.'}
    </p>
  );
}

const ORIGIN_NAMES: Record<string, string> = {
  engine: 'Suchmaschine', search: 'Suche auf der Seite', home: 'Startseite', collection: 'Sammlung',
  book: 'Andere Buchseite', social: 'Sozial', other: 'Andere Seite', direct: 'Direkt / unbekannt',
};
const VERDICT_NAMES: Record<string, string> = {
  verified: 'gleich (verified)', differs: 'anders (differs)', uncompared: 'nicht verglichen', unknown: 'kein Bild (unknown)',
  unavailable: 'Quelle stumm', pending: 'noch offen', none: 'kein Cover mit ISBN gewählt',
};
const POSITION_NAMES: Record<string, string> = { '1': '1', '2': '2', '3': '3', '4-10': '4–10', '11+': '11+', none: 'kein Klick' };
/** Below this many visits, rates are noise (plan §7). */
const FEW_VISITS = 100;

function Report({ report }: { report: Extract<InsightsReport, { ok: true }> }) {
  const { clicks, books, searches } = report;
  const few = books.visits < FEW_VISITS;
  const changeText =
    report.change === null
      ? report.previousTotal === 0 && clicks.total > 0
        ? 'neu gegenüber den Tagen davor'
        : 'kein Vergleich möglich'
      : `${report.change >= 0 ? '+' : '−'}${pf.format(Math.abs(report.change))} gegenüber den ${report.days} Tagen davor`;
  const rateDelta =
    books.rate !== null && report.previousBooks.rate !== null
      ? `${books.rate >= report.previousBooks.rate ? '+' : '−'}${nf.format(Math.abs(books.rate - report.previousBooks.rate) * 100)} Pkt. gegenüber den ${report.days} Tagen davor`
      : 'kein Vergleich möglich';
  const answered = searches.searches - searches.empty - searches.failed;
  return (
    <>
      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
        <div className="col-span-2 rounded-lg border border-line bg-surface p-4">
          <div className="text-sm text-ink-2">Klickrate der Buchseite</div>
          <div className={`mt-1 text-5xl font-medium ${few ? 'text-ink-3' : 'text-ink'}`}>{books.rate === null ? '—' : pf.format(books.rate)}</div>
          <div className="mt-1 text-xs text-ink-2">{few ? `zu wenig Daten (unter ${FEW_VISITS} Besuchen)` : rateDelta}</div>
          <p className="mt-2 text-xs text-ink-3">Buchseiten-Besuche mit mindestens einem Klick zum Händler ÷ Buchseiten-Besuche, aus dem Signal beim Verlassen der Seite.</p>
        </div>
        <Tile label="Buchseiten-Besuche" value={books.visits} />
        <Tile label="Klicks zum Händler" value={clicks.total} note={changeText} />
        <Tile label="Suchen" value={searches.searches} />
        <Tile
          label="Suche ohne Ergebnis"
          value={searches.empty}
          note={searches.searches > 0 ? `${pf.format(searches.empty / searches.searches)}; Quelle ausgefallen: ${nf.format(searches.failed)}` : '—'}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Weg zum Kauf" sub="Anteil der Buchseiten-Besuche, die die Stufe erreichen.">
          <Bars
            rows={[
              { label: 'Besuch', value: books.funnel.visits },
              { label: 'Wand geladen', value: books.funnel.wall },
              { label: 'Cover gewählt', value: books.funnel.picked },
              { label: 'Klick zum Händler', value: books.funnel.bought },
            ]}
            total={books.funnel.visits}
            few={few}
          />
          <Note>
            Ein Signal je Besuch, beim Verlassen der Seite. Abgleich: {plural(books.bought, 'Besuch', 'Besuche')} mit Klick laut Browser,{' '}
            {plural(clicks.total, 'Klick', 'Klicks')} laut /go/ — ein Besuch kann mehrere Klicks haben, ein verlorenes Signal fehlt nur links.
          </Note>
        </Card>
        <Card title="Je Tag" sub={`Klicks zum Händler, ${shortDay(report.from)} bis ${shortDay(report.to)} (UTC).`}>
          <DayColumns perDay={clicks.perDay} />
        </Card>
      </section>

      <section className="mt-6">
        <Card title="Händler" sub={`Klicks je Händler und Markt, über /go/ exakt gezählt; ein Klick ist kein Kauf. US ${nf.format(clicks.byMarket.us)} · UK ${nf.format(clicks.byMarket.uk)} · DE ${nf.format(clicks.byMarket.de)}.`}>
          <RetailerTable rows={clicks.rows} total={clicks.total} labels={report.labels} few={report.few} />
          <Note>
            Gezählt werden Links nach ISBN, Händlersuchen nach Titel und die lokalen Buchhandlungen; Google Lens, TinEye, WorldCat und
            Open Library sind keine Händler. Deine eigenen Klicks mit Admin-Cookie zählen nicht.
          </Note>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Suche: wo geklickt wird" sub={`Position der angeklickten Karte, bei ${plural(answered, 'Suche', 'Suchen')} mit Ergebnis.`}>
          <Bars rows={Object.entries(searches.positions).map(([k, v]) => ({ label: POSITION_NAMES[k] ?? k, value: v }))} total={answered} few={answered < FEW_VISITS} />
          <Note>Liegt Position 1 unter 50 %, stimmt die Reihenfolge nicht. Suchen haben keinen Markt; der Marktfilter gilt hier nicht.</Note>
        </Card>
        <Card title="Gesucht, nichts gefunden" sub="Erst ab zwei gleichen Anfragen gezeigt, 90 Tage gespeichert.">
          {report.empty.length === 0 ? (
            <p className="text-sm text-ink-2">Keine Anfrage zweimal ohne Ergebnis.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {report.empty.map(e => (
                  <tr key={e.q} className="border-b border-line">
                    <td className="py-1.5 pr-2 text-ink">
                      <Link className="hover:underline" href={`/?q=${encodeURIComponent(e.q)}`}>{e.q}</Link>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-ink-2">{nf.format(e.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Cover gesehen vor dem Verlassen" sub="Kacheln, die zu mindestens der Hälfte im Bild waren.">
          <Bars rows={Object.entries(books.seen).map(([k, v]) => ({ label: k.replace('-', '–'), value: v }))} total={books.visits} few={few} />
          <Note>
            {books.visits > 0 ? `${pf.format(books.onePageOrLess / books.visits)} der Besuche endeten, bevor die zweite Seite der Wand ankam.` : '—'}
          </Note>
        </Card>
        <Card title="Verdikt und Kauf" sub="Das letzte Verdikt, das ein Besuch sah, und wie oft danach zum Händler geklickt wurde.">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="py-1.5 pr-2 font-normal">Verdikt</th>
                <th className="py-1.5 pr-2 text-right font-normal">Besuche</th>
                <th className="py-1.5 text-right font-normal">Klickrate danach</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(books.verdicts)
                .filter(([, v]) => v.visits > 0)
                .sort((x, y) => y[1].visits - x[1].visits)
                .map(([k, v]) => (
                  <tr key={k} className="border-b border-line">
                    <td className="py-1.5 pr-2 text-ink">{VERDICT_NAMES[k] ?? k}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-ink-2">{nf.format(v.visits)}</td>
                    <td className={`py-1.5 text-right tabular-nums ${v.visits < 30 ? 'text-ink-3' : 'text-ink'}`}>{pf.format(v.bought / v.visits)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <Note>Liegt die Klickrate nach „anders“ nicht unter der nach „gleich“, wirkt der Satz nicht. Grau: unter 30 Besuchen.</Note>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Werke" sub="Die meistbesuchten Buchseiten, mit Klickrate je Werk.">
          {report.works.length === 0 ? (
            <p className="text-sm text-ink-2">Noch kein Besuch gezählt.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="py-1.5 pr-2 font-normal">Werk</th>
                  <th className="py-1.5 pr-2 text-right font-normal">Besuche</th>
                  <th className="py-1.5 text-right font-normal">Klickrate</th>
                </tr>
              </thead>
              <tbody>
                {report.works.map(w => (
                  <tr key={w.work} className="border-b border-line">
                    <td className="py-1.5 pr-2 text-ink">
                      <Link className="hover:underline" href={`/book/${w.work}`}>{w.title ?? w.work}</Link>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-ink-2">{nf.format(w.visits)}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-2">{pf.format(w.bought / w.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Woher die Buchseiten-Besuche kommen" sub="Im Browser zur Klasse verdichtet; die Herkunftsadresse selbst wird nicht gesendet.">
          <Bars
            rows={Object.entries(books.origins).sort((x, y) => y[1] - x[1]).map(([k, v]) => ({ label: ORIGIN_NAMES[k] ?? k, value: v }))}
            total={books.visits}
            few={few}
          />
        </Card>
      </section>

      <section className="mt-6">
        <Card
          title="Regalfoto → Sammlung: Verbrauch und Kosten"
          sub="Fotos, die das Bildmodell beim Anlegen einer Sammlung gelesen hat, und was sie gekostet haben (K13)."
        >
          <PhotoSection photos={report.photos} />
        </Card>
      </section>

      <section className="mt-6">
        <Card title="Betrieb" sub="Ereignisse, keine Anfragen.">
          <ul className="space-y-2 text-sm">
            <Status
              ok={report.ops.totals['google-stop'] === 0}
              name="Google-Kontingent"
              good="kein Tagesstopp im Zeitraum"
              bad={`Tagesstopp an ${report.ops.daysWith['google-stop'].map(shortDay).join(', ')}`}
            />
            <Status
              ok={report.ops.totals['ol-failed'] === 0}
              name="Open Library"
              good="keine Suche ist an Open Library gescheitert"
              bad={`${nf.format(report.ops.totals['ol-failed'])} gescheiterte ${report.ops.totals['ol-failed'] === 1 ? 'Suche' : 'Suchen'} an ${report.ops.daysWith['ol-failed'].length === 1 ? 'einem Tag' : `${report.ops.daysWith['ol-failed'].length} Tagen`}`}
            />
          </ul>
          <Note>
            Den Google-Verbrauch je Tag kann die Seite nicht zählen (Datencache); er steht in der{' '}
            <a className="text-accent hover:underline" href="https://console.cloud.google.com/apis/api/books.googleapis.com/quotas" target="_blank" rel="noopener noreferrer">
              Cloud-Konsole
            </a>
            . Ein Tagesstopp, den eine Seite statt einer API-Route bemerkt, erscheint erst mit der nächsten Anfrage derselben Instanz.
          </Note>
        </Card>
      </section>
    </>
  );
}

const usd = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 3 });

function PhotoSection({ photos }: { photos: Extract<InsightsReport, { ok: true }>['photos'] }) {
  const perPhoto = photos.read > 0 ? photos.costUsd / photos.read : null;
  const models = Object.entries(photos.tokens).sort((a, b) => b[1].input + b[1].output - (a[1].input + a[1].output));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Fotos gelesen" value={photos.read} note={`gescheitert ${nf.format(photos.failed)} · am Tageslimit abgewiesen ${nf.format(photos.capped)}`} />
        <Tile label="Bücher erkannt" value={photos.books} note={`gefunden ${nf.format(photos.found)} · unsicher ${nf.format(photos.maybe)}`} />
        <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
          <div className="text-sm text-ink-2">Kosten im Zeitraum</div>
          <div className="mt-1 text-2xl font-medium text-ink">{usd.format(photos.costUsd)}</div>
          <div className="mt-1 text-xs text-ink-3">{photos.unpricedTokens > 0 ? `dazu ${nf.format(photos.unpricedTokens)} Tokens ohne bekannten Preis` : 'zu Listenpreisen'}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
          <div className="text-sm text-ink-2">Kosten je Foto</div>
          <div className="mt-1 text-2xl font-medium text-ink">{perPhoto === null ? '—' : usd.format(perPhoto)}</div>
          <div className="mt-1 text-xs text-ink-3">
            {perPhoto === null ? 'noch kein Foto gelesen' : `Tageslimit ${nf.format(PHOTOS_PER_DAY)} Fotos ≈ höchstens ${usd.format(perPhoto * PHOTOS_PER_DAY)} am Tag`}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <DayColumns perDay={photos.perDay.map(d => ({ day: d.day, clicks: d.costUsd }))} format={v => usd.format(v)} label="Kosten der Fotos je Tag" />
      </div>
      {models.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="py-1.5 pr-2 font-normal">Modell</th>
              <th className="py-1.5 pr-2 text-right font-normal">Eingabe-Tokens</th>
              <th className="py-1.5 pr-2 text-right font-normal">Ausgabe-Tokens</th>
              <th className="py-1.5 text-right font-normal">Kosten</th>
            </tr>
          </thead>
          <tbody>
            {models.map(([model, t]) => (
              <tr key={model} className="border-b border-line">
                <td className="py-1.5 pr-2 font-mono text-xs text-ink">{model}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-ink-2">{nf.format(t.input)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-ink-2">{nf.format(t.output)}</td>
                <td className="py-1.5 text-right tabular-nums text-ink">{t.costUsd === null ? 'Preis unbekannt' : usd.format(t.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Note>
        Gerechnet aus den Tokens, die die Antwort des Modells meldet (das Foto zählt als Eingabe), zu den Listenpreisen vom {PRICES_AS_OF} in USD
        (lib/insights/prices.ts); maßgeblich ist die Rechnung in der Anthropic-Konsole. Ein Foto am Tageslimit kostet nichts, ein gescheitertes
        kann Tokens gekostet haben, die hier fehlen. Deine eigenen Fotos zählen mit — sie kosten dasselbe.
      </Note>
    </>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-base font-medium text-ink">{title}</h2>
      {sub && <p className="mt-0.5 text-sm text-ink-2">{sub}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs text-ink-3">{children}</p>;
}

/** One row per class, one series: the bar is the share of `total`, the number beside it the count. */
function Bars({ rows, total, few }: { rows: Array<{ label: string; value: number }>; total: number; few: boolean }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.label} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-2 text-sm sm:grid-cols-[9rem_1fr_5rem]">
          <span className="truncate text-ink-2">{r.label}</span>
          <span className="h-2.5">
            <span className="block h-2.5 rounded-r bg-accent" style={{ width: `${(r.value / max) * 100}%`, opacity: few ? 0.45 : 1 }} title={`${r.label}: ${nf.format(r.value)}`} />
          </span>
          <span className={`text-right tabular-nums ${few ? 'text-ink-3' : 'text-ink'}`}>
            {total > 0 ? pf.format(r.value / total) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-medium text-ink">{nf.format(value)}</div>
      {note && <div className="mt-1 text-xs text-ink-3">{note}</div>}
    </div>
  );
}

/** One column per day, single series, value on hover and in the table below the chart for screen readers. */
function DayColumns({
  perDay,
  format = v => plural(v, 'Klick', 'Klicks'),
  label = 'Klicks zum Händler je Tag',
}: {
  perDay: Array<{ day: string; clicks: number }>;
  /** How one day's value reads in the tooltip and the caption. */
  format?: (value: number) => string;
  label?: string;
}) {
  const peak = Math.max(0, ...perDay.map(d => d.clicks));
  // Scaled to the highest day; a range with nothing in it keeps a flat baseline.
  const max = peak > 0 ? peak : 1;
  const w = 720;
  const h = 140;
  const band = w / perDay.length;
  const bar = Math.min(24, band * 0.7);
  const ticks = [0, Math.floor((perDay.length - 1) / 2), perDay.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={label}>
        <line x1={0} x2={w} y1={h} y2={h} stroke="var(--line)" strokeWidth={1} />
        {perDay.map((d, i) => {
          const bh = (d.clicks / max) * (h - 8);
          const x = band * i + (band - bar) / 2;
          const r = Math.min(4, bh);
          return (
            <g key={d.day}>
              <path
                d={`M${x},${h} V${h - bh + r} Q${x},${h - bh} ${x + r},${h - bh} H${x + bar - r} Q${x + bar},${h - bh} ${x + bar},${h - bh + r} V${h} Z`}
                fill="var(--accent)"
              />
              <rect x={band * i} y={0} width={band} height={h} fill="transparent">
                <title>{`${shortDay(d.day)}: ${format(d.clicks)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      {/* Labels in HTML, not in the SVG: a stretched viewBox would scale the text with the bars. */}
      <div className="mt-1 flex justify-between text-xs text-ink-3">
        {ticks.map(i => (
          <span key={i}>{shortDay(perDay[i]?.day ?? '')}</span>
        ))}
      </div>
      <figcaption className="mt-1 text-xs text-ink-3">Höchster Tag: {format(peak)}. Werte beim Darüberfahren.</figcaption>
    </figure>
  );
}

function RetailerTable({ rows, total, labels, few }: { rows: ProviderRow[]; total: number; labels: Record<string, string>; few: boolean }) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-ink-2">Im Zeitraum kein Klick.</p>;
  const max = Math.max(...rows.map(r => r.clicks));
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            <th className="py-1.5 pr-2 font-normal">Händler</th>
            <th className="py-1.5 pr-2 font-normal">Markt</th>
            <th className="w-2/5 py-1.5 pr-2 font-normal">Anteil</th>
            <th className="py-1.5 pr-2 text-right font-normal">Klicks</th>
            <th className="py-1.5 text-right font-normal">Produktseite</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={`${r.provider}|${r.market}`} className="border-b border-line">
              <td className="py-1.5 pr-2 text-ink">{labels[r.provider] ?? r.provider}</td>
              <td className="py-1.5 pr-2 text-ink-2">{MARKET_NAMES[r.market]}</td>
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 rounded-r bg-accent" style={{ width: `${(r.clicks / max) * 100}%`, opacity: few ? 0.45 : 1 }} />
                  <span className={`shrink-0 text-xs tabular-nums ${few ? 'text-ink-3' : 'text-ink-2'}`}>{pf.format(r.clicks / total)}</span>
                </div>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-ink">{nf.format(r.clicks)}</td>
              <td className="py-1.5 text-right tabular-nums text-ink-2">{pf.format(r.product / r.clicks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Status({ ok, name, good, bad }: { ok: boolean; name: string; good: string; bad: string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3">
      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ok ? '#0ca30c' : '#fab219' }} />
        {ok ? '✓' : '!'} {name}
      </span>
      <span className="text-ink-2">{ok ? good : bad}</span>
    </li>
  );
}
