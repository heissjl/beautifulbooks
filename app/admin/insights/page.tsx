import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { FEW_CLICKS, type ProviderRow } from '@/lib/insights/model';
import { buildReport, parseMarket, parseRange, RANGES, type InsightsReport } from '@/lib/insights/report';
import type { Market } from '@/lib/market';
import { adminCookieValid } from '@/lib/suggest/session';

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

        <section className="mt-10 rounded-lg border border-dashed border-line p-4 text-sm text-ink-2">
          <h2 className="text-base font-medium text-ink">Noch nicht gezählt (3.1b)</h2>
          <p className="mt-1">
            Klickrate der Buchseite, Weg zum Kauf, Suche ohne Ergebnis und Klickposition, gesehene Cover, Verdikt und Kauf,
            Herkunft und Werke kommen aus einem Signal je Seitenbesuch im Browser. Das wird gebaut, wenn der Satz für die
            Datenschutzerklärung und die Frage nach den Suchbegriffen entschieden sind (Plan §9).
          </p>
        </section>
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

function Report({ report }: { report: Extract<InsightsReport, { ok: true }> }) {
  const { clicks } = report;
  const changeText =
    report.change === null
      ? report.previousTotal === 0 && clicks.total > 0
        ? 'neu gegenüber den Tagen davor'
        : 'kein Vergleich möglich'
      : `${report.change >= 0 ? '+' : '−'}${pf.format(Math.abs(report.change))} gegenüber den ${report.days} Tagen davor`;
  return (
    <>
      <section className="mt-6 grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="col-span-3 rounded-lg border border-line bg-surface p-4 lg:col-span-2">
          <div className="text-sm text-ink-2">Klicks zum Händler</div>
          <div className="mt-1 text-5xl font-medium text-ink">{nf.format(clicks.total)}</div>
          <div className="mt-1 text-xs text-ink-2">{changeText}</div>
          <p className="mt-2 text-xs text-ink-3">
            Über /go/ gezählt, {shortDay(report.from)} bis {shortDay(report.to)} (UTC). Ein Klick ist kein Kauf. Deine eigenen
            Klicks mit Admin-Cookie zählen nicht.
          </p>
        </div>
        {(['us', 'uk', 'de'] as const)
          .filter(m => !report.market || m === report.market)
          .map(m => (
            <Tile key={m} label={`Markt ${MARKET_NAMES[m]}`} value={clicks.byMarket[m]} total={clicks.total} />
          ))}
      </section>

      <section className="mt-6 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Je Tag</h2>
        <DayColumns perDay={clicks.perDay} />
      </section>

      <section className="mt-6 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Händler</h2>
        <p className="text-sm text-ink-2">
          Klicks je Händler und Markt; „Produktseite“ heißt, der Link öffnete das Buch selbst statt einer Trefferliste.
          {report.few && ` Unter ${FEW_CLICKS} Klicks sind die Anteile Rauschen.`}
        </p>
        <RetailerTable rows={clicks.rows} total={clicks.total} labels={report.labels} few={report.few} />
        <p className="mt-2 text-xs text-ink-3">
          Titelsuchen bei Händlern und „Find this exact cover“ laufen noch nicht über /go/ und fehlen hier (Plan §4).
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Betrieb</h2>
        <ul className="mt-2 space-y-2 text-sm">
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
        <p className="mt-3 text-xs text-ink-3">
          Den Google-Verbrauch je Tag kann die Seite nicht zählen (Datencache); er steht in der{' '}
          <a className="text-accent hover:underline" href="https://console.cloud.google.com/apis/api/books.googleapis.com/quotas" target="_blank" rel="noopener noreferrer">
            Cloud-Konsole
          </a>
          . Ein Tagesstopp, den eine Seite statt einer API-Route bemerkt, erscheint erst mit der nächsten Anfrage derselben Instanz.
        </p>
      </section>
    </>
  );
}

function Tile({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-medium text-ink">{nf.format(value)}</div>
      <div className="mt-1 text-xs text-ink-3">{total > 0 ? `${pf.format(value / total)} der Klicks` : '—'}</div>
    </div>
  );
}

/** One column per day, single series, value on hover and in the table below the chart for screen readers. */
function DayColumns({ perDay }: { perDay: Array<{ day: string; clicks: number }> }) {
  const peak = Math.max(0, ...perDay.map(d => d.clicks));
  const max = Math.max(1, peak);
  const w = 720;
  const h = 140;
  const band = w / perDay.length;
  const bar = Math.min(24, band * 0.7);
  const ticks = [0, Math.floor((perDay.length - 1) / 2), perDay.length - 1];
  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Klicks zum Händler je Tag">
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
                <title>{`${shortDay(d.day)}: ${nf.format(d.clicks)}`}</title>
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
      <figcaption className="mt-1 text-xs text-ink-3">Höchster Tag: {nf.format(peak)} Klicks. Werte beim Darüberfahren.</figcaption>
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
