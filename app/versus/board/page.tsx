import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CoverImage from '@/components/CoverImage';
import SiteFooter from '@/components/SiteFooter';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';
import { board, type Board, type BoardEntry, type Verdict } from '@/lib/hotornot/game';
import { STORE_LOOKED_FOR, StoreUnavailableError, storeFromEnv } from '@/lib/hotornot/store';
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

function say(verdict: Verdict, held: number, need: number): string {
  if (verdict === 'exact') return `A finding: ahead for ${need} rounds in a row.`;
  if (verdict === 'rising') return `Ahead, but only for ${held === 1 ? 'one round' : `${held} rounds`}. A finding needs ${need} in a row.`;
  if (verdict === 'three') return 'All that is certain: one of the three.';
  return 'No finding yet. It needs more votes.';
}

function Row({ entries, end }: { entries: BoardEntry[]; end: 'best' | 'worst' }) {
  return (
    <ol className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-5">
      {entries.map((c, i) => (
        <li key={c.id} className="min-w-0">
          <div className={`relative aspect-[2/3] overflow-hidden rounded-card bg-surface ${i === 0 ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}>
            <CoverImage src={c.src} alt={`${c.title} by ${c.author}`} sizes="(min-width: 640px) 140px, 30vw" fit="contain" />
          </div>
          <p className="mt-2 text-[13px] leading-snug text-ink">{c.title}</p>
          <p className="text-xs text-ink-3">{c.author}</p>
          <p className="mt-1 text-xs tabular-nums text-ink-3">
            {end === 'best' ? `first in ${pct(c.first)}` : `last in ${pct(c.last)}`} · {c.games} games
          </p>
        </li>
      ))}
    </ol>
  );
}

function Unavailable({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 max-w-prose text-[15px] leading-relaxed text-ink-2">{children}</p>;
}

export default async function BoardPage() {
  if (!versusEnabled()) notFound();
  const store = storeFromEnv();
  let result: Board | null = null;
  let problem: string | null = null;
  if (!store) {
    problem = `The vote store is not configured on this deployment. Looked for ${STORE_LOOKED_FOR.join(' and ')}.`;
  } else {
    try {
      result = await board(store);
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
              <b className="text-ink tabular-nums">{result.covers}</b> covers,
              about {result.perCover.toFixed(1)} games each.{' '}
              {result.favourite.decided >= 50
                ? <>The favourite wins <b className="text-ink">{pct(result.favourite.rate)}</b> of the later votes; 50 % would be taste and nothing else. </>
                : 'Too few votes yet to say how much people agree. '}
              A share says in how many of 100 rankings that fit these votes a cover holds the end. A cover with few games is uncertain
              and is not crowned, and a crown counts only when the same cover holds it for {result.hold} rounds in a row — a round being as
              many votes as there are covers.
            </p>
            {result.store === 'memory' && (
              <p className="mt-3 text-sm text-ink-3">Development: these votes live in this server&rsquo;s memory and vanish with it.</p>
            )}

            <section className="mt-10">
              <h2 className="text-2xl text-ink">The best-looking</h2>
              {result.top[0] && (
                <p className="mt-1 text-sm text-ink-2">
                  First in {pct(result.top[0].first)} of the rankings, in the top three in {pct(result.top[0].topThree)}.{' '}
                  {say(result.best.verdict, result.best.held, result.hold)}
                </p>
              )}
              <Row entries={result.top} end="best" />
            </section>

            <section className="mt-12">
              <h2 className="text-2xl text-ink">The ugliest</h2>
              {result.bottom[0] && (
                <p className="mt-1 text-sm text-ink-2">
                  Last in {pct(result.bottom[0].last)} of the rankings, in the bottom three in {pct(result.bottom[0].bottomThree)}.{' '}
                  {say(result.worst.verdict, result.worst.held, result.hold)}
                </p>
              )}
              <Row entries={result.bottom} end="worst" />
            </section>

            <p className="mt-10 text-sm text-ink-3">
              {result.flagged} {result.flagged === 1 ? 'cover' : 'covers'} taken out as not a cover. Before anyone passes this on, a person
              looks at the bottom five: a placeholder is not an ugly cover.
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
