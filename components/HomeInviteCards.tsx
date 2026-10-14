import Link from '@/components/Link';
import CoverImage from './CoverImage';
import { wallCover } from '@/lib/curated';
import type { Collection, WallWork } from '@/lib/collections';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/server';

/**
 * MOCKUP (ROADMAP 6.109; Julian, 2026-10-14: „wir müssen die mehr
 * herausstellen. kannst du ein mock up machen, wie es aussehen würde, wenn es
 * für jeden der drei punkte einen thumbnail mit vorschau gäbe?“). The three
 * invitations under the search field as cards with a small picture of what
 * waits behind each: two covers facing off, a fan of a collection, a board of
 * nine. Shown only under `next dev` with `/?invites=cards`; the site keeps the
 * three text links until Julian decides. `/?invites=bottom` tries them at the
 * end of the page instead, under the collections, with the links kept up top.
 *
 * A server component, like CollectionsShelf: the covers come from the
 * collections the home page already loaded, so nothing is fetched for them
 * and the collections file never reaches the browser.
 */
interface Props {
  collections: Collection[];
  walls: boolean;
  portrait: boolean;
  locale?: Locale;
  /** Spacing from outside: under the field it keeps its gap, at the end of the page its section sets it. */
  className?: string;
}

function Thumb({ w, className = '' }: { w: WallWork; className?: string }) {
  return (
    // No `relative` here: the fan places its covers `absolute`, and the two would fight.
    <div className={`cover-shadow aspect-[2/3] overflow-hidden rounded-[3px] bg-surface-2 ${className}`}>
      <div className="relative h-full w-full"><CoverImage src={wallCover(w, 'M')} alt="" sizes="80px" /></div>
    </div>
  );
}

/** One cover from each of several collections, so the pictures differ from card to card. */
function firstOfEach(collections: Collection[], n: number, skip = 0): WallWork[] {
  return collections.slice(skip).map(c => c.works[0]).filter((w): w is WallWork => !!w && (!!w.image || w.coverId > 0)).slice(0, n);
}

export default function HomeInviteCards({ collections, walls, portrait, locale = DEFAULT_LOCALE, className = 'mt-6' }: Props) {
  const t = translator(locale);
  const pictorial = collections.find(c => c.slug === 'sf-masterworks') ?? collections[0];
  // Two covers from collections far apart in the order, so they do not look like one series.
  const pair = [firstOfEach(collections, 1, 4)[0], firstOfEach(collections, 1, 9)[0]].filter((w): w is WallWork => !!w);
  const fan = (pictorial?.works ?? []).slice(0, 3);
  const nine = firstOfEach(collections, 9, 10).length === 9 ? firstOfEach(collections, 9, 10) : firstOfEach(collections, 9, 0);
  const card =
    'group flex h-full items-center gap-4 rounded-card border border-line bg-surface/40 p-4 transition-colors hover:border-accent sm:flex-col sm:items-stretch sm:gap-0 sm:p-0 sm:overflow-hidden';
  const picture = 'relative flex h-28 w-24 shrink-0 items-center justify-center sm:h-40 sm:w-auto sm:bg-surface-2/60';
  const title = 'font-display text-lg leading-tight text-ink transition-colors group-hover:text-accent';
  const line = 'mt-1 text-sm leading-snug text-ink-2';

  return (
    <ul className={`${className} grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4`} aria-label={t('Ways into the site')}>
      <li>
        <Link href="/versus" className={card}>
          <div className={picture} aria-hidden="true">
            {pair.length === 2 && (
              <div className="flex items-center gap-1.5 sm:gap-3">
                <Thumb w={pair[0]} className="w-9 -rotate-6 sm:w-16" />
                <span className="font-display text-xs italic text-accent sm:text-sm">{t('or')}</span>
                <Thumb w={pair[1]} className="w-9 rotate-6 sm:w-16" />
              </div>
            )}
          </div>
          <div className="min-w-0 sm:p-4">
            <p className={title}>{t('Which cover is prettier?')}</p>
            <p className={line}>{t('Help us find the prettiest cover of all time — two covers, one tap.')}</p>
          </div>
        </Link>
      </li>
      {walls && (
        <li>
          <Link href="/create" className={card}>
            <div className={picture} aria-hidden="true">
              <div className="relative h-16 w-20 sm:h-28 sm:w-36">
                {fan.map((w, i) => (
                  <Thumb
                    key={`${w.id}:${i}`}
                    w={w}
                    className={`absolute top-0 w-9 sm:w-[4.25rem] ${['left-0 -rotate-12', 'left-1/2 -translate-x-1/2 z-10', 'right-0 rotate-12'][i]}`}
                  />
                ))}
              </div>
            </div>
            <div className="min-w-0 sm:p-4">
              <p className={title}>{t('Your own collection')}</p>
              <p className={line}>{t('Gather the covers you love on one wall, and keep the link.')}</p>
            </div>
          </Link>
        </li>
      )}
      {portrait && (
        <li>
          <Link href="/shelfportrait" className={card}>
            <div className={picture} aria-hidden="true">
              <div className="grid w-[3.75rem] grid-cols-3 gap-0.5 rounded-[4px] bg-bg p-1 shadow-sm sm:w-[5.5rem] sm:gap-1 sm:p-1.5">
                {nine.map((w, i) => <Thumb key={`${w.id}:${i}`} w={w} className="rounded-[1px] shadow-none" />)}
              </div>
            </div>
            <div className="min-w-0 sm:p-4">
              <p className={title}>{t('Your Shelf-Portrait')}</p>
              <p className={line}>{t('Nine books that shaped you, in the covers you choose — one picture to share.')}</p>
            </div>
          </Link>
        </li>
      )}
    </ul>
  );
}
