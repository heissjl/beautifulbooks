import Link from './Link';
import { rich } from './rich';
import { SITE_NAME } from '@/lib/seo';
import type { Translate } from '@/lib/i18n/translate';

/**
 * „What is this site?" — the block for a reader who landed on a page that is not
 * the front door: a shared Shelf-Portrait (5.18b) or the cover game (5.8a).
 * One sentence on what the site is, then the ways into the other things it
 * has. Julian, 2026-10-06: „baue diese seitenbeschreibung auch auf der versus
 * seite ein, nur mit hinweis auf shelfportrait statt auf das versus game" —
 * so the wording lives here and nowhere else, and each page leaves out the
 * way to itself.
 *
 * A way is shown only where its switch is on: a link to `/create` or
 * `/shelfportrait` in production without `WALLS` or `INSPIRATION` would be a
 * 404. The caller reads the switches, because this renders inside client
 * components too (`InspirationShared`), where `process.env` is not there.
 *
 * `t` defaults to English: the game's pages go through the translations
 * (6.85), the Shelf-Portrait's do not yet (5.18b), and both show this block.
 */
export default function WhatIsThisSite({
  t = (text: string) => text,
  collection = false,
  game = false,
  portrait = false,
  className = 'max-w-md self-start border-l-2 border-line pl-5 text-[15px] leading-relaxed text-ink-2 lg:sticky lg:top-24',
}: {
  t?: Translate;
  /** The reader's own collection (5.13a), behind `WALLS`. */
  collection?: boolean;
  /** The cover game (5.8a), behind `HOTORNOT`. */
  game?: boolean;
  /** The Shelf-Portrait (5.18b), behind `INSPIRATION`. */
  portrait?: boolean;
  className?: string;
}) {
  const more = 'text-accent underline decoration-line underline-offset-4 hover:decoration-accent';
  return (
    <aside className={className}>
      <h2 className="font-display text-xl text-ink">{rich(t('What is {name}?'), { name: <i>{SITE_NAME}</i> })}</h2>
      <p className="mt-2">
        {rich(
          t('{lead} {name} shows the ones two open catalogues hold for a title — decades of printings side by side — and, for each, where to find and buy that edition new or used, online or locally.'),
          {
            lead: <strong className="font-medium text-ink">{t('A book has many covers.')}</strong>,
            name: <i>{SITE_NAME}</i>,
          },
        )}
      </p>
      <ul className="mt-4 space-y-2">
        <li><Link href="/" className={more}>{t('Look up the covers of a book')}</Link></li>
        {collection && <li><Link href="/create" className={more}>{t('Gather covers you love into a collection of your own')}</Link></li>}
        {game && <li><Link href="/versus" className={more}>{t('Play the cover game: which one would you rather look at?')}</Link></li>}
        {portrait && <li><Link href="/shelfportrait" className={more}>{t('Take your Shelf-Portrait: the books that inspire you')}</Link></li>}
      </ul>
    </aside>
  );
}
