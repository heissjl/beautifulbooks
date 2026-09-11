/**
 * The cover the loading scene opens with (SPEC §3 F2.12, ROADMAP 6.25a).
 *
 * Pure, client-safe.
 *
 * A result card hands the detail page one cover through sessionStorage, and
 * the page shows it at once, before any request has returned. The scene then
 * staged the work's covers **in the order their preloads finished**, which is
 * usually a different picture. Julian, 2026-09-10: „das Bild, das angezeigt
 * wird, bevor der Fächer losgeht, ist dann ein anderes als das erste im
 * Fächer. So hat der Fächer irgendwie einen Ladebildschirm vorm
 * Ladebildschirm."
 *
 * Moving that cover to the front of the list was not enough — measured the
 * same day on *Daniel Deronda*: the scene preloads the small size and stages
 * whichever preload finishes first, while the page already shows the large
 * one, so the card's cover lost the race to a different picture. So the lead
 * is handed over **as it is on the screen**: its own id, and the very address
 * the page has already painted.
 */
import { coverRefFromUrl, proxiedCoverSrc } from './coverurl';

export interface LeadCover {
  /** The cover id, `ol:…` or `gb:…`, so the tile can fly to its slot in the wall. */
  id: string;
  /** The address the page is already showing, so the first tile is that same picture. */
  url: string;
}

/**
 * The card's cover as the scene's first tile, or nothing.
 *
 * Nothing when there was no card (a visit from outside, which gets the mosaic
 * instead) or when the address is not one the site can name by id.
 */
export function leadCover(heroUrl: string | undefined): LeadCover | undefined {
  if (!heroUrl) return undefined;
  const ref = coverRefFromUrl(heroUrl);
  if (!ref) return undefined;
  return { id: ref.coverId, url: proxiedCoverSrc(heroUrl) };
}
