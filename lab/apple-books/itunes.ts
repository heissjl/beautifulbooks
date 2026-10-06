/**
 * Apple Books through the iTunes Search API (ROADMAP 6.93): the pure half.
 * Which results belong to a work, and the cover image at a chosen size. No
 * network here; `measure.ts` asks Apple and calls these.
 *
 * Apple has no work concept and its book results carry no ISBN, so a result
 * is matched to an Open Library work by title and author only — the same rule
 * Google Books lives under (E5). A result never creates a work.
 */
import { normalizeAuthor, normalizeTitle } from '../../lib/normalize';

/** The fields of an iTunes `ebook` result this experiment reads. */
export interface ItunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  releaseDate?: string;
  trackViewUrl?: string;
}

export interface WorkToMatch {
  id: string;
  title: string;
  /** Primary author as Open Library has it. */
  author: string;
  /**
   * Titles a reader would also search for (`1984`, a translation). Kept
   * apart from the work's own title because the site has no such list: a
   * match through an alias is something the site could not do today.
   */
  aliases?: string[];
}

export type MatchedBy = 'title' | 'alias';

export interface AppleCandidate {
  trackId: number;
  title: string;
  artist: string;
  year?: number;
  /** The artwork URL at its smallest, as Apple sends it. */
  artwork: string;
  matchedBy: MatchedBy;
  /** Countries whose store returned this artwork. */
  countries: string[];
}

function surname(name: string): string {
  const words = normalizeAuthor(name).split(' ').filter(Boolean);
  return words[words.length - 1] ?? '';
}

/**
 * Apple writes several people into one string: "Jane Austen & Vivien Jones",
 * "Austen, Jane & Jane Austen", "F. Scott Fitzgerald". The work's author is
 * on the result when any of the people carries the same surname. Surname
 * only, because Apple also writes "Austen" and "J Austen".
 */
export function artistMatches(artistName: string, author: string): boolean {
  const want = surname(author);
  if (!want) return false;
  const people = artistName.split(/\s*&\s*|\s+and\s+|\s*;\s*/i);
  return people.some(p => {
    // "Austen, Jane" names one person, surname first.
    const comma = p.split(',').map(s => s.trim()).filter(Boolean);
    const name = comma.length === 2 && !comma[1].includes(' ') ? `${comma[1]} ${comma[0]}` : p;
    return surname(name) === want;
  });
}

/**
 * The titles a result could be read as. Some publishers put the author into
 * the title ("Fitzgerald - The Great Gatsby", "Pride and Prejudice - Jane
 * Austen"); that part goes only when it is the author, never a "- Teil 1".
 */
export function titleReadings(trackName: string, author: string): string[] {
  const out = [trackName];
  const parts = trackName.split(/\s+[-–—]\s+/);
  if (parts.length === 2) {
    const [a, b] = parts;
    const isAuthor = (s: string) => artistMatches(s, author) && normalizeAuthor(s).split(' ').length <= 4;
    if (isAuthor(a)) out.push(b);
    if (isAuthor(b)) out.push(a);
  }
  return out;
}

export function matchResult(result: ItunesResult, work: WorkToMatch): MatchedBy | null {
  if (!artistMatches(result.artistName, work.author)) return null;
  const readings = titleReadings(result.trackName, work.author).map(normalizeTitle);
  if (readings.includes(normalizeTitle(work.title))) return 'title';
  if ((work.aliases ?? []).some(a => readings.includes(normalizeTitle(a)))) return 'alias';
  return null;
}

/**
 * The artwork at a size. Apple serves its covers under a path ending in
 * `<w>x<h>bb.jpg`, and any box may be asked for; the image keeps its own
 * proportions inside it (2000x2000bb gave 1351 × 2000 px on 2026-10-06).
 */
export function artworkAt(url: string, px: number): string {
  return url.replace(/\/\d+x\d+(bb|cc)?\.(jpg|png|webp)$/, `/${px}x${px}bb.jpg`);
}

/** The artwork's path without the size: one image, whichever store sent it. */
export function artworkKey(url: string): string {
  return url.replace(/\/\d+x\d+(bb|cc)?\.(jpg|png|webp)$/, '');
}

/**
 * The candidates for a work from the answers of several stores, one per
 * image: the US and German stores often sell the same file, and a result
 * without artwork has nothing to show.
 */
export function candidatesFor(answers: ReadonlyArray<{ country: string; results: readonly ItunesResult[] }>, work: WorkToMatch): {
  candidates: AppleCandidate[];
  rejected: Array<{ title: string; artist: string }>;
} {
  const byImage = new Map<string, AppleCandidate>();
  const rejected = new Map<number, { title: string; artist: string }>();
  for (const { country, results } of answers) {
    for (const r of results) {
      if (!r.artworkUrl100) continue;
      const matchedBy = matchResult(r, work);
      if (!matchedBy) {
        rejected.set(r.trackId, { title: r.trackName, artist: r.artistName });
        continue;
      }
      const key = artworkKey(r.artworkUrl100);
      const seen = byImage.get(key);
      if (seen) {
        if (!seen.countries.includes(country)) seen.countries.push(country);
        if (matchedBy === 'title') seen.matchedBy = 'title';
        continue;
      }
      const year = r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : undefined;
      byImage.set(key, {
        trackId: r.trackId, title: r.trackName, artist: r.artistName,
        year: Number.isFinite(year) ? year : undefined,
        artwork: r.artworkUrl100, matchedBy, countries: [country],
      });
    }
  }
  return { candidates: [...byImage.values()], rejected: [...rejected.values()] };
}
