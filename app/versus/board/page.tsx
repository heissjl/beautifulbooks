import type { Metadata } from 'next';
import Link from '@/components/Link';
import { notFound } from 'next/navigation';
import CoverImage from '@/components/CoverImage';
import SiteFooter from '@/components/SiteFooter';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';
import { bookPath, cachedBoard, type Board, type BoardEntry, type Verdict } from '@/lib/hotornot/game';
import { StoreUnavailableError, missingStoreMessage, storeFromEnv } from '@/lib/hotornot/store';
import { versusEnabled } from '@/lib/hotornot/switch';
import { SITE_CARD, SITE_URL } from '@/lib/seo';
import { rich } from '@/components/rich';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/server';
import { type Translate } from '@/lib/i18n/translate';
import { measure } from '@/app/api/measure';

/**
 * The standings of the cover game (ROADMAP 5.8a). Rendered on the server from
 * the store, counted once a minute (`cachedBoard`): the standings need every
 * vote, and a minute of lag costs nothing a player would notice.
 *
 * Every sentence says what the votes support and nothing more (SPEC N12):
 * a crown is a finding only when the same cover has held it for CROWN_HOLD
 * rounds in a row at 90 % of the plausible rankings — the rule the simulation
 * in `lab/hotornot` showed to keep false claims near 6 %.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Which cover? · Standings',
  description: 'Which book covers readers keep choosing, and which they do not — with how sure each of those is.',
  // Indexed since 2026-09-23 (ROADMAP 5.8a, SPEC F7.6). The canonical drops
  // `?top=20` and `?flop=20`: they are the same standings, unfolded.
  alternates: { canonical: `${SITE_URL}/versus/board` },
  openGraph: {
    type: 'website',
    title: 'Which cover? · Standings',
    description: 'Which book covers readers keep choosing, and which they do not.',
    url: `${SITE_URL}/versus/board`,
    images: [SITE_CARD],
  },
};

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** One sentence per end, and only what the votes support (N12). Julian found the first wording confusing (2026-09-11). */
function say(verdict: Verdict, need: number, t: Translate): string {
  if (verdict === 'exact') return t('Settled: it has stayed in front for {n} rounds in a row.', { n: need });
  if (verdict === 'rising') return t('In front, but not settled: that takes {n} rounds in a row.', { n: need });
  if (verdict === 'three') return t('One of the first three, but not yet which.');
  return t('Too early to say. It needs more votes.');
}

function Row({ entries, t }: { entries: BoardEntry[]; t: Translate }) {
  return (
    <ol className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-5">
      {entries.map((c, i) => (
        <li key={c.id} className="min-w-0">
          {/* The book page with this cover selected: where its buy links are. */}
          <Link href={!c.workId ? '#' : c.image ? `/book/${c.workId}` : bookPath(c.workId, c.id)} className="group block">
            <div className={`relative aspect-[2/3] overflow-hidden rounded-card bg-surface ${i === 0 ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}>
              <CoverImage src={c.src} alt={t('{title} by {author}', { title: c.title, author: c.author })} sizes="(min-width: 640px) 140px, 30vw" fit="contain" />
            </div>
            <p className="mt-2 text-[13px] leading-snug text-ink group-hover:underline">{c.title}</p>
          </Link>
          <p className="text-xs text-ink-3">{c.author}</p>
          <p className="mt-1 text-xs tabular-nums text-ink-3">
            {t('won {wins} of {games}', { wins: c.wins, games: c.games })}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Unavailable({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 max-w-prose text-[15px] leading-relaxed text-ink-2">{children}</p>;
}

/** Five per end, or twenty: `?top=20`, `?flop=20`, each on its own, so a longer list can be linked. */
const LONG = 20;
const SHORT = 5;
const lengthOf = (value: string | string[] | undefined) => (value === String(LONG) ? LONG : SHORT);

function boardHref(top: number, flop: number): string {
  const params = new URLSearchParams();
  if (top === LONG) params.set('top', String(LONG));
  if (flop === LONG) params.set('flop', String(LONG));
  const query = params.toString();
  return `/versus/board${query ? `?${query}` : ''}`;
}

function Toggle({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} className="btn mt-5">
      {children}
    </Link>
  );
}

export default async function BoardPage({ searchParams, locale = DEFAULT_LOCALE }: { searchParams: Promise<Record<string, string | string[] | undefined>>; locale?: Locale }) {
  measure('page-versus');
  const t = translator(locale);
  if (!versusEnabled()) notFound();
  const params = await searchParams;
  const top = lengthOf(params.top);
  const flop = lengthOf(params.flop);
  const store = storeFromEnv();
  let result: Board | null = null;
  let problem: string | null = null;
  if (!store) {
    problem = t(missingStoreMessage());
  } else {
    try {
      result = await cachedBoard(store, { top, bottom: flop });
    } catch (err) {
      if (!(err instanceof StoreUnavailableError)) throw err;
      problem = t('The vote store did not answer. Reload in a moment.');
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        <h1 className="text-4xl leading-[1.1] text-ink [text-wrap:balance]">{t('The standings')}</h1>
        {problem || !result ? (
          <Unavailable>{problem}</Unavailable>
        ) : (
          <>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-2">
              {rich(result.votes === 1 ? t('{votes} vote on {covers} covers. Each vote sets two covers side by side.') : t('{votes} votes on {covers} covers. Each vote sets two covers side by side.'), {
                votes: <b className="text-ink tabular-nums">{result.votes}</b>,
                covers: <b className="text-ink tabular-nums">{result.covers}</b>,
              })}
              {result.favourite.decided >= 50 && (
                <> {rich(t('The cover in front wins {rate} of its votes; at 50 % no one would agree.'), { rate: <b className="text-ink">{pct(result.favourite.rate)}</b> })}</>
              )}
            </p>
            <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-2">
              {t('A cover is called the best or the ugliest only when it has stayed in front for {hold} rounds of {covers} votes. Until then the lists show who leads.', { hold: result.hold, covers: result.covers })}
            </p>
            {result.store === 'memory' && (
              <p className="mt-3 text-sm text-ink-3">{t('Development: these votes live in this server’s memory and vanish with it.')}</p>
            )}

            <section className="mt-10">
              <h2 className="text-2xl text-ink">{t('The best-looking')}</h2>
              {result.top[0] && <p className="mt-1 text-sm text-ink-2">{say(result.best.verdict, result.hold, t)}</p>}
              <Row entries={result.top} t={t} />
              <Toggle href={boardHref(top === SHORT ? LONG : SHORT, flop)}>{t('Show top {n}', { n: top === SHORT ? LONG : SHORT })}</Toggle>
            </section>

            <section className="mt-12">
              <h2 className="text-2xl text-ink">{t('The ugliest')}</h2>
              {result.bottom[0] && <p className="mt-1 text-sm text-ink-2">{say(result.worst.verdict, result.hold, t)}</p>}
              <Row entries={result.bottom} t={t} />
              <Toggle href={boardHref(top, flop === SHORT ? LONG : SHORT)}>{t('Show bottom {n}', { n: flop === SHORT ? LONG : SHORT })}</Toggle>
            </section>

            <p className="mt-10 text-sm text-ink-3">
              {result.flagged === 1 ? t('1 cover was reported as not a cover and taken out.') : t('{n} covers were reported as not a cover and taken out.', { n: result.flagged })}{' '}
              {t('The standings are counted once a minute.')}
            </p>
          </>
        )}
        <p className="mt-10">
          <Link href="/versus" className="text-accent underline underline-offset-4">{t('Back to the game')}</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
