/**
 * The covers of one work as the app's picker shows them (lab/calibre, ROADMAP 5.16a).
 *
 * One entry per image, with what the picker needs to choose deliberately: the
 * languages and years of the printings that carried it. Unlike the picker of
 * lab/walls, e-book printings stay in — a Calibre library *is* e-books. Pure.
 */
import type { SourceEdition } from '../../lib/model';

export interface PickCover {
  /** `ol:<number>` */
  coverId: string;
  /** The medium-sized image, for the grid. */
  thumb: string;
  /** ISO 639-1 codes of the printings that carried it; empty when none says. */
  languages: string[];
  /** Newest year among the printings. */
  year?: number;
  publishers: string[];
  /** ISBN-13 of those printings. */
  isbns: string[];
}

export function pickCovers(editions: readonly SourceEdition[]): PickCover[] {
  const byId = new Map<string, PickCover>();
  for (const e of editions) {
    for (const c of e.covers) {
      if (!/^ol:\d{1,12}$/.test(c.id)) continue;
      const cover = byId.get(c.id) ?? { coverId: c.id, thumb: c.urlSmall ?? c.url, languages: [], publishers: [], isbns: [] };
      if (e.language && !cover.languages.includes(e.language)) cover.languages.push(e.language);
      if (e.publisher && !cover.publishers.includes(e.publisher)) cover.publishers.push(e.publisher);
      if (e.isbn13 && !cover.isbns.includes(e.isbn13)) cover.isbns.push(e.isbn13);
      if (e.year && (!cover.year || e.year > cover.year)) cover.year = e.year;
      byId.set(c.id, cover);
    }
  }
  return [...byId.values()];
}
