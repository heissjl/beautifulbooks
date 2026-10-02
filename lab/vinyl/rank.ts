/**
 * Ranking of MusicBrainz release groups for a search (ROADMAP 5.16a). Pure.
 *
 * MusicBrainz has no popularity, only a text `score`. Two things stand in
 * for it: the number of releases in the group (`count` — the canonical album
 * has been pressed again and again, a tribute with the same title has not),
 * and whether the query names the artist. Compilations, live albums and the
 * like go after studio albums but are never dropped: someone may be looking
 * for exactly that record. Not measured yet against live answers — the
 * acceptance in PLAN-5.16a does that.
 */
import { normalizeTitle } from '../../lib/normalize';

export interface MbReleaseGroup {
  id: string;
  title: string;
  score?: number;
  count?: number;
  'primary-type'?: string;
  'secondary-types'?: string[];
  'first-release-date'?: string;
  'artist-credit'?: Array<{ name: string; joinphrase?: string }>;
}

export interface Hit { id: string; title: string; artist: string; year: string; kind: string; releases: number }

const words = (s: string) => normalizeTitle(s).split(' ').filter(Boolean);

export function artistOf(g: MbReleaseGroup): string {
  return (g['artist-credit'] ?? []).map(a => a.name + (a.joinphrase ?? '')).join('').trim();
}

/** Points for one group; higher first. */
export function rankScore(g: MbReleaseGroup, query: string): number {
  const q = new Set(words(query));
  const artist = words(artistOf(g));
  const title = words(g.title);
  let s = g.score ?? 0;
  s += 15 * Math.log10(1 + (g.count ?? 0));
  if (artist.length && artist.every(w => q.has(w))) s += 25;
  if (title.length && title.every(w => q.has(w))) s += 10;
  if (g['primary-type'] !== 'Album') s -= 30;
  if ((g['secondary-types'] ?? []).length) s -= 25;
  return s;
}

export function rankGroups(groups: MbReleaseGroup[], query: string): Hit[] {
  return groups
    .map((g, i) => ({ g, s: rankScore(g, query), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ g }) => ({
      id: g.id,
      title: g.title,
      artist: artistOf(g),
      year: g['first-release-date']?.slice(0, 4) ?? '',
      kind: [g['primary-type'], ...(g['secondary-types'] ?? [])].filter(Boolean).join(' · '),
      releases: g.count ?? 0,
    }));
}

/**
 * The Lucene query sent to MusicBrainz: the reader's words, all of them
 * required, matched against title and artist alike. Lucene's own syntax is
 * escaped so a title like "Help!" or "AC/DC" cannot break the query.
 */
export function mbQuery(text: string): string {
  const terms = text.trim().split(/\s+/).filter(Boolean).map(t => t.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1'));
  return terms.map(t => `(releasegroup:${t} OR artist:${t})`).join(' AND ');
}
