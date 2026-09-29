/**
 * Pure readers for MusicBrainz and Cover Art Archive answers (ROADMAP 5.16).
 * No network here; `measure.ts` does the asking.
 *
 * The mapping onto the site's model: a MusicBrainz *release group* is the
 * Work, a *release* is the Edition, and each Cover Art Archive image is a
 * Cover — but an album has sides, so every image carries its types (Front,
 * Back, Medium = the record itself, Spine, Obi, …) and a wall must say
 * which side it shows.
 */

export interface MbMedium { format?: string | null }
export interface MbRelease {
  id: string;
  title: string;
  date?: string;
  country?: string;
  disambiguation?: string;
  media?: MbMedium[];
  'cover-art-archive'?: { artwork: boolean; count: number; front: boolean; back: boolean };
}
export interface CaaImage { types: string[]; front: boolean; back: boolean }

/** A release counts as vinyl when any of its media is (`12" Vinyl`, `7" Vinyl`, `Vinyl`). */
export function isVinyl(release: MbRelease): boolean {
  return (release.media ?? []).some(m => /vinyl/i.test(m.format ?? ''));
}

const COLOURS = [
  'red', 'blue', 'green', 'yellow', 'white', 'clear', 'transparent', 'translucent', 'orange', 'pink',
  'purple', 'violet', 'gold', 'silver', 'grey', 'gray', 'brown', 'cream', 'bone', 'smoke', 'coke bottle',
  'marble', 'marbled', 'splatter', 'swirl', 'colou?red', 'picture disc', 'glow in the dark', 'tan', 'teal',
];
const COLOUR_RE = new RegExp(`\\b(${COLOURS.join('|')})\\b`, 'i');

/**
 * The colour or print of the record itself, as far as the release's free
 * text says it. MusicBrainz has no field for it; editors write it into the
 * disambiguation ("red vinyl", "picture disc"). Returns the matched word or
 * null — null means "not written down", never "black".
 */
export function vinylColourNote(release: MbRelease): string | null {
  // "White Label" is a promo pressing, not a white record.
  const text = (release.disambiguation ?? '').replace(/white[- ]label/gi, '');
  const m = text.match(COLOUR_RE);
  return m ? m[1].toLowerCase() : null;
}

/** Count Cover Art Archive images by type; an image with several types counts once per type. */
export function countImageTypes(images: CaaImage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const img of images) {
    const types = img.types.length ? img.types : ['(untyped)'];
    for (const t of types) out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}
