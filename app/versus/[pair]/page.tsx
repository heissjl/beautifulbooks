import type { Metadata } from 'next';
import Link from '@/components/Link';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';
import Versus from '@/components/Versus';
import WhatIsThisSite from '@/components/WhatIsThisSite';
import { preload } from 'react-dom';
import { POOL, fixedPair, poolBooks, readyPairs, secretForEnv } from '@/lib/hotornot/game';
import { matchupPath, parseMatchup } from '@/lib/hotornot/matchup';
import { storeFromEnv } from '@/lib/hotornot/store';
import { versusEnabled } from '@/lib/hotornot/switch';
import { inspirationEnabled } from '@/lib/inspiration/switch';
import { wallsEnabled } from '@/lib/walls/switch';
import { SITE_URL } from '@/lib/seo';
import { rich } from '@/components/rich';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/server';
import { measure } from '@/app/api/measure';

/**
 * One pairing of the cover game at an address of its own (ROADMAP 6.97;
 * Julian, 2026-10-06: „can you make permanent links to specific matchups that
 * i can use for advertising?“). `/versus/ol-15154344-vs-ol-10215294` always
 * opens on those two covers, so a post that shows a pairing and the page it
 * leads to say the same thing. Afterwards the game plays on as usual.
 *
 * **The pairing is not a second game.** The vote carries the same signed
 * token and counts like any other, which also means a link in an
 * advertisement sends many votes onto one pairing: the standings see that
 * pair far more often than a random one. That is a known price of the link,
 * not a bug — the crown still needs a lead held over rounds (F7.5).
 *
 * **Not indexed.** It is a landing page for a post, and the combinations are
 * endless; the canonical points at `/versus`, which is the page that carries
 * the text and stands in the sitemap.
 */
export const dynamic = 'force-dynamic';

async function look(params: Promise<{ pair: string }>) {
  const { pair } = await params;
  const ids = parseMatchup(pair);
  if (!ids || !versusEnabled()) return null;
  return fixedPair(secretForEnv(), ids.a, ids.b, { store: storeFromEnv()?.kind ?? 'memory' });
}

export async function generateMetadata({ params }: { params: Promise<{ pair: string }> }): Promise<Metadata> {
  const pair = await look(params);
  if (!pair) return { title: 'Which cover?', robots: { index: false, follow: true } };
  const both = `${pair.a.title} or ${pair.b.title}`;
  return {
    title: `${both}: which cover?`,
    description: `${both}? Two covers, one click — which one would you rather look at?`,
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE_URL}/versus` },
    openGraph: {
      type: 'website',
      title: `${both}: which cover would you rather look at?`,
      description: 'Two covers, one click. The standings show which covers readers keep choosing.',
      url: `${SITE_URL}${matchupPath(pair.a.id, pair.b.id)}`,
    },
  };
}

export default async function MatchupPage({ params, locale = DEFAULT_LOCALE }: { params: Promise<{ pair: string }>; locale?: Locale }) {
  measure('page-versus');
  const t = translator(locale);
  const pair = await look(params);
  if (!pair) notFound();
  // The named pairing first, then two drawn at random, so the next pairs are preloaded as on /versus.
  // A random pair that holds one of these two covers is dropped: it would come back within two clicks.
  const rest = readyPairs(secretForEnv(), 4, { store: pair.store })
    .filter(p => ![p.a.id, p.b.id].some(id => id === pair.a.id || id === pair.b.id))
    .slice(0, 2);
  for (const side of [pair.a, pair.b]) preload(side.src, { as: 'image' });
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        <Versus initialPairs={[pair, ...rest]} />

        <section className="mt-16 border-t border-line pt-8">
          <h2 className="text-2xl text-ink">{t('What is this game')}</h2>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-2">
            {t('This pair has an address of its own, which is why you were sent to it. Vote, and the game goes on with pairs drawn at random.')}
          </p>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-2">
            {rich(t('Two covers of two books, side by side, and one question: which one would you rather look at? The pool holds {covers} covers from {books} books, each of them a printed edition on record at Open Library or Google Books. Nobody is judging the writing here — only the picture on the front.'), {
              covers: <b className="text-ink tabular-nums">{POOL.covers.length}</b>,
              books: <b className="text-ink tabular-nums">{poolBooks().length}</b>,
            })}
          </p>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-2">
            {rich(t('The {standings} show which covers readers keep choosing and how sure that is: a cover is called the best-looking or the ugliest only once it has held the lead for several rounds. Every cover there leads to its book, where the other editions of the same title stand side by side.'), {
              standings: <Link href="/versus/board" className="text-accent underline underline-offset-4">{t('standings')}</Link>,
            })}
          </p>
        </section>

        <WhatIsThisSite
          t={t}
          collection={wallsEnabled()}
          portrait={inspirationEnabled()}
          variant="section"
        />
      </main>
      <SiteFooter />
    </div>
  );
}
