import Link from '@/components/Link';
import CoverImage from './CoverImage';
import { coverUrlFor } from '@/lib/coverurl';
import { PICTURE_VERSION } from '@/lib/inspiration/share';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/server';

/**
 * The three ways into the site beyond the search, as cards with a picture of
 * what waits behind each (ROADMAP 6.109). At the end of the home page, under
 * the collections; the three text links under the field stay (Julian,
 * 2026-10-14: „links oben, karten unten“).
 *
 * The pictures are chosen, not drawn from whatever loaded (Julian, same day:
 * „beim vs das mit gruffalo, bei der collection vllt die von agatha christie,
 * beim shelf portrait eines der von mir erstellten und mit mosaik
 * background“):
 *
 * - the game: the pair of its own link card, *The Gruffalo* against
 *   *Le visage dans l'abîme* (`app/versus/opengraph-image.tsx`);
 * - a collection: three of Tom Adams' Fontana Christies — not *The Hollow*,
 *   whose scan is a photo of the book;
 * - the Shelf-Portrait: Julian's own board `tvujl2pk`, as its link card with
 *   the mosaic ground — the picture the site already draws and keeps a month
 *   (`/shelfportrait/card.jpg`), so the home page adds no drawing of its own.
 *
 * A server component; the covers come through the site's image route like
 * every other cover.
 */
const VERSUS_PAIR = ['ol:15154344', 'ol:10215294'] as const;
const CHRISTIE = ['ol:7267514', 'ol:15130644', 'ol:12855074'] as const;
/** Julian's board, as its share card — the same address its page names as og:image (read 2026-10-15). */
const PORTRAIT_CARD =
  `/shelfportrait/card.jpg?b=s8d7.2apl~1ulq.7tkc1~3kry.8uddl~1btq.90yc7~1r3aq.43fn~fd4i.79qvu~239gj.4y4ll~hvi.5i932~qdjp.8tit6&sub=The%20performative%20reader%27s%20starter%20pack&format=card&v=${PICTURE_VERSION}`;

interface Props {
  walls: boolean;
  portrait: boolean;
  locale?: Locale;
}

function Cover({ id, className = '' }: { id: string; className?: string }) {
  const src = coverUrlFor(id, 'M');
  if (!src) return null;
  // No `relative` on the frame: the fan places its covers `absolute`, and the two would fight.
  return (
    <div className={`cover-shadow aspect-[2/3] overflow-hidden rounded-[3px] bg-surface-2 ${className}`}>
      <div className="relative h-full w-full"><CoverImage src={src} alt="" sizes="96px" /></div>
    </div>
  );
}

export default function HomeInviteCards({ walls, portrait, locale = DEFAULT_LOCALE }: Props) {
  const t = translator(locale);
  const card =
    'group flex h-full items-center gap-4 rounded-card border border-line bg-surface/40 p-4 transition-colors hover:border-accent sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:p-0';
  // From `sm` up every picture has the share card's proportions (1200 × 630), so the Shelf-Portrait card shows whole.
  const picture = 'relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[6px] sm:aspect-[40/21] sm:h-auto sm:w-auto sm:rounded-none sm:bg-surface-2/60';
  const title = 'font-display text-lg leading-tight text-ink transition-colors group-hover:text-accent sm:text-xl';
  const line = 'mt-1.5 text-sm leading-snug text-ink-2';

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" aria-label={t('Ways into the site')}>
      <li>
        <Link href="/versus" className={card}>
          <div className={picture} aria-hidden="true">
            <div className="flex items-center gap-1.5 sm:gap-3">
              <Cover id={VERSUS_PAIR[0]} className="w-10 -rotate-6 sm:w-[4.5rem]" />
              <span className="font-display text-xs italic text-accent sm:text-base">{t('or')}</span>
              <Cover id={VERSUS_PAIR[1]} className="w-10 rotate-6 sm:w-[4.5rem]" />
            </div>
          </div>
          <div className="min-w-0 sm:p-5">
            <p className={title}>{t('This cover or that one?')}</p>
            <p className={line}>{t('Two covers, one tap. Your picks add up to a ranking of the prettiest covers.')}</p>
          </div>
        </Link>
      </li>
      {walls && (
        <li>
          <Link href="/create" className={card}>
            <div className={picture} aria-hidden="true">
              <div className="relative h-[4.5rem] w-24 sm:h-32 sm:w-44">
                {CHRISTIE.map((id, i) => (
                  <Cover
                    key={id}
                    id={id}
                    className={`absolute top-0 w-11 sm:w-20 ${['left-0 -rotate-12', 'left-1/2 z-10 -translate-x-1/2', 'right-0 rotate-12'][i]}`}
                  />
                ))}
              </div>
            </div>
            <div className="min-w-0 sm:p-5">
              <p className={title}>{t('Build a wall of covers')}</p>
              <p className={line}>{t('Pick the editions you love — from a book, a photo of your shelf or your Goodreads list — and keep the wall under its own link.')}</p>
            </div>
          </Link>
        </li>
      )}
      {portrait && (
        <li>
          <Link href="/shelfportrait" className={card}>
            <div className={`${picture} sm:bg-transparent`} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- a picture this site draws itself; next/image would transform it again */}
              <img src={PORTRAIT_CARD} alt="" width={1200} height={630} loading="lazy" decoding="async" className="h-full w-full object-cover object-right sm:object-center" />
            </div>
            <div className="min-w-0 sm:p-5">
              <p className={title}>{t('Your Shelf-Portrait')}</p>
              <p className={line}>{t('Nine books that made you, each in the cover you love — one picture to post.')}</p>
            </div>
          </Link>
        </li>
      )}
    </ul>
  );
}
