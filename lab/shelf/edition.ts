/**
 * Which edition a photographed spine belongs to (ROADMAP 5.16, Julian
 * 2026-09-28: „der plan ist auch, dass die seite das entsprechende cover der
 * im foto gezeigten version findet. schwierig vom buchrücken aus, aber lass
 * es uns versuchen").
 *
 * A spine shows neither the front nor the ISBN. Two things on it do say
 * something about the edition: the **publisher** at its foot, which the
 * image model reads, and its **colour**, which a publisher's design usually
 * carries round from the front (a Penguin's orange, a Suhrkamp taschenbuch's
 * one flat colour). So the work's covers are ranked by whether their edition
 * names that publisher and by how close one of the cover's main colours comes
 * to the spine's.
 *
 * Every number here is set, not measured; the README says so, and a pick is
 * shown with its evidence so a wrong one can be seen as wrong.
 */
import { distance, type Oklab, type SpineColor } from '../colorsort/color';

/**
 * A cover counts as matching the spine's colour when one of its main
 * colours (at least 15 % of the image) lies within this OKLab distance.
 * Photo and scan disagree by white balance and light; 0.10 is roughly the
 * step from a cadmium red to a brick red.
 */
export const SPINE_MAX_COLOUR = 0.1;
/** Without a publisher, the best cover must beat the second by this much. */
export const SPINE_COLOUR_MARGIN = 0.03;
const MIN_CLUSTER_SHARE = 0.15;

const PUBLISHER_NOISE = new Set([
  'verlag', 'verlags', 'books', 'book', 'press', 'publishing', 'publishers', 'publisher', 'edition', 'editions', 'éditions',
  'gmbh', 'kg', 'ag', 'inc', 'ltd', 'llc', 'co', 'company', 'and', 'und', 'the', 'der', 'die', 'das', 'group', 'house',
  'taschenbuch', 'taschenbücher', 'paperback', 'paperbacks', 'classics', 'library', 'imprint', 'of', 'an', 'a',
]);

export function publisherTokens(name: string): string[] {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 2 && !PUBLISHER_NOISE.has(t));
}

/**
 * Whether an edition's publisher is the one read off the spine. Loose on
 * purpose: a spine prints „dtv", the record says „Deutscher Taschenbuch
 * Verlag"; a spine prints „Penguin", the record „Penguin Books Ltd". So a
 * shared word counts, and so does a spine word that is the initials of the
 * record's words.
 */
export function samePublisher(spine: string, record: string | undefined): boolean {
  if (!record) return false;
  const a = publisherTokens(spine), b = publisherTokens(record);
  if (a.length === 0 || b.length === 0) return false;
  if (a.some(t => t.length >= 3 && b.includes(t))) return true;
  const initials = (words: string[]) => words.map(w => w[0]).join('');
  const full = record.toLowerCase().split(/[^a-zäöüß0-9]+/).filter(w => w.length > 1);
  return a.some(t => t.length >= 2 && (t === initials(b) || t === initials(full)));
}

export interface CoverColours { lab: Oklab; share: number }

/** How far the spine's colour is from the nearest main colour of a cover. */
export function colourGap(spine: Pick<SpineColor, 'lab'>, cover: CoverColours[]): number {
  const main = cover.filter(c => c.share >= MIN_CLUSTER_SHARE);
  return Math.min(...(main.length ? main : cover).map(c => distance(spine.lab, c.lab)));
}

export interface EditionCandidate {
  coverId: number;
  publisher?: string;
  year?: number;
  colours?: CoverColours[];
}

export interface RankedCover {
  coverId: number;
  publisherMatch: boolean;
  /** Absent when the cover's image could not be read. */
  gap?: number;
  publisher?: string;
  year?: number;
}

export interface SpinePick {
  /** The chosen cover, or null when nothing was close enough. */
  pick: RankedCover | null;
  /** Every candidate, best first: publisher match, then colour. For choosing by hand. */
  ranked: RankedCover[];
}

/**
 * Ranks the covers and picks one when the evidence is enough: a publisher
 * match with a colour within bounds, or — when the spine named no publisher
 * or no edition carries it — a colour within bounds that clearly beats the
 * runner-up. A publisher match alone is not enough: publishers print a work
 * under many jackets.
 */
export function pickBySpine(spine: Pick<SpineColor, 'lab'>, spinePublisher: string | undefined, candidates: EditionCandidate[]): SpinePick {
  const ranked: RankedCover[] = candidates.map(c => ({
    coverId: c.coverId,
    publisherMatch: !!spinePublisher && samePublisher(spinePublisher, c.publisher),
    ...(c.colours?.length ? { gap: colourGap(spine, c.colours) } : {}),
    ...(c.publisher ? { publisher: c.publisher } : {}),
    ...(c.year ? { year: c.year } : {}),
  }));
  ranked.sort((p, q) =>
    Number(q.publisherMatch) - Number(p.publisherMatch) || (p.gap ?? Infinity) - (q.gap ?? Infinity));

  const anyPublisher = ranked.some(r => r.publisherMatch);
  const pool = anyPublisher ? ranked.filter(r => r.publisherMatch) : ranked;
  const measured = pool.filter(r => r.gap !== undefined).sort((p, q) => p.gap! - q.gap!);
  const best = measured[0];
  if (!best || best.gap! > SPINE_MAX_COLOUR) return { pick: null, ranked };
  if (!anyPublisher) {
    // Colour alone: only when it is not a coin toss between two covers.
    const second = ranked.filter(r => r.gap !== undefined && r !== best).sort((p, q) => p.gap! - q.gap!)[0];
    if (second && second.gap! - best.gap! < SPINE_COLOUR_MARGIN) return { pick: null, ranked };
  }
  return { pick: best, ranked };
}
