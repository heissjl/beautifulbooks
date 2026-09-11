import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CoverImage from '@/components/CoverImage';
import SiteFooter from '@/components/SiteFooter';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';
import { board, bookPath, type Board, type BoardEntry, type Verdict } from '@/lib/hotornot/game';
import { StoreUnavailableError, missingStoreMessage, storeFromEnv } from '@/lib/hotornot/store';
import { versusEnabled } from '@/lib/hotornot/switch';

/**
 * The standings of the cover game (ROADMAP 5.8a). Rendered on the server from
 * the store at request time. Titles appear here and only here: while voting,
 * the cover is judged and not the book.
 *
 * Every sentence says what the votes support and nothing more (SPEC N12):
 * a crown is a finding only when the same cover has held it for CROWN_HOLD
 * rounds in a row at 90 % of the plausible rankings — the rule the simulation
 * in `lab/hotornot` showed to keep false claims near 6 %.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Which cover? · Standings',
  description: 'The standings of the cover game, with how sure they are.',
  robots: { index: false, follow: false },
};

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** One sentence per end, and only what the votes support (N12). Julian found the first wording confusing (2026-09-11). */
function say(verdict: Verdict, need: number): string {
  if (verdict === 'exact') return `Settled: it has stayed in front for ${need} rounds in a row.`;
  if (verdict === 'rising') return `In front, but not settled: that takes ${need} rounds in a row.`;
  if (verdict === 'three') return 'One of the first three, but not yet which.';
  return 'Too early to say. It needs more votes.';
}

function Row({ entries }: { entries: BoardEntry[] }) {
  return (
    <ol className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-5">
      {entries.map((c, i) => (
        <li key={c.id} className="min-w-0">
          {/* The book page with this cover selected: where its buy links are. */}
          <Link href={c.workId ? bookPath(c.workId, c.id) : '#'} className="group block">
            <div className={`relative aspect-[2/3] overflow-hidden rounded-card bg-surface ${i === 0 ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}>
              <CoverImage src={c.src} alt={`${c.title} by ${c.author}`} sizes="(min-width: 640px) 140px, 30vw" fit="contain" />
            </div>
            <p className="mt-2 text-[13px] leading-snug text-ink group-hover:underline">{c.title}</p>
          </Link>
          <p className="text-xs text-ink-3">{c.author}</p>
          <p className="mt-1 text-xs tabular-nums text-ink-3">
            won {c.wins} of {c.games}
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

export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!versusEnabled()) notFound();
  const params = await searchParams;
  const top = lengthOf(params.top);
  const flop = lengthOf(params.flop);
  const store = storeFromEnv();
  let result: Board | null = null;
  let problem: string | null = null;
  if (!store) {
    problem = missingStoreMessage();
  } else {
    try {
      result = await board(store, { top, bottom: flop });
    } catch (err) {
      if (!(err instanceof StoreUnavailableError)) throw err;
      problem = 'The vote store did not answer. Reload in a moment.';
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        <p className="kicker">Which cover?</p>
        <h1 className="mt-1 text-4xl leading-[1.1] text-ink [text-wrap:balance]">The standings</h1>
        {problem || !result ? (
          <Unavailable>{problem}</Unavailable>
        ) : (
          <>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-2">
              <b className="text-ink tabular-nums">{result.votes}</b> {result.votes === 1 ? 'vote' : 'votes'} on{' '}
              <b className="text-ink tabular-nums">{result.covers}</b> covers. Each vote sets two covers side by side.
              {result.favourite.decided >= 50 && (
                <> The cover in front wins <b className="text-ink">{pct(result.favourite.rate)}</b> of its votes; at 50 % no one would agree.</>
              )}
            </p>
            <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-2">
              A cover is called the best or the ugliest only when it has stayed in front for {result.hold} rounds of {result.covers} votes.
              Until then the lists show who leads.
            </p>
            {result.store === 'memory' && (
              <p className="mt-3 text-sm text-ink-3">Development: these votes live in this server&rsquo;s memory and vanish with it.</p>
            )}

            <section className="mt-10">
              <h2 className="text-2xl text-ink">The best-looking</h2>
              {result.top[0] && <p className="mt-1 text-sm text-ink-2">{say(result.best.verdict, result.hold)}</p>}
              <Row entries={result.top} />
              <Toggle href={boardHref(top === SHORT ? LONG : SHORT, flop)}>{top === SHORT ? `Show top ${LONG}` : `Show top ${SHORT}`}</Toggle>
            </section>

            <section className="mt-12">
              <h2 className="text-2xl text-ink">The ugliest</h2>
              {result.bottom[0] && <p className="mt-1 text-sm text-ink-2">{say(result.worst.verdict, result.hold)}</p>}
              <Row entries={result.bottom} />
              <Toggle href={boardHref(top, flop === SHORT ? LONG : SHORT)}>{flop === SHORT ? `Show bottom ${LONG}` : `Show bottom ${SHORT}`}</Toggle>
            </section>

            <p className="mt-10 text-sm text-ink-3">
              {result.flagged} {result.flagged === 1 ? 'cover was' : 'covers were'} reported as not a cover and taken out.
            </p>
          </>
        )}
        <p className="mt-10">
          <Link href="/versus" className="text-accent underline underline-offset-4">Back to the game</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
