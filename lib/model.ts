/**
 * Domain model as defined in SPEC.md §2.
 *
 * A Work is the abstract book; an Edition is one published version with its
 * own cover. Language is an edition attribute, never part of work identity.
 */

export type Source = 'openlibrary' | 'googlebooks';

export interface Work {
  /** Open Library work id (`OL30751W`) or synthetic `t:<title>::a:<author>`. */
  id: string;
  title: string;
  /** At least one entry. First entry is the primary author. */
  authors: string[];
  /** Open Library author keys aligned with `authors`, when known. */
  authorKeys?: string[];
  firstPublishYear?: number;
  /** Total edition count reported by the source, not just what was loaded. */
  editionCount?: number;
}

export interface Edition {
  /** `ol:OL123M` or `gb:abc123` */
  id: string;
  workId: string;
  source: Source;
  title: string;
  /** ISO 639-1 (`en`, `de`). Unknown = undefined. */
  language?: string;
  publisher?: string;
  publishedDate?: string;
  year?: number;
  isbn13?: string;
  isbn10?: string;
  pageCount?: number;
  format?: 'hardcover' | 'paperback' | 'ebook' | 'other';
  description?: string;
  previewUrl?: string;
}

/**
 * A cover image carried by one or more editions (SPEC §2.3, decision E8).
 * Identity is the image, never the ISBN: reprints change covers under the
 * same ISBN, and one design appears under several ISBNs.
 */
export interface Cover {
  /** `ol:<cover_i>` or `gb:<volumeId>` */
  id: string;
  url: string;
  urlSmall?: string;
  source: Source;
  /** Ids of editions that carry this cover, at least one. */
  editionIds: string[];
  /** Ids of covers folded into this one because their image is the same design (SPEC §2.3 phase 2). */
  similarIds?: string[];
}

/** An edition as parsed from a source, before covers are split out. */
export interface SourceEdition extends Edition {
  covers: Array<Pick<Cover, 'id' | 'url' | 'urlSmall'>>;
  /** Open Library author keys on this edition (translators appear here). */
  authorKeys?: string[];
}

/** A work as it appears in search results: enough to render a card. */
export interface WorkSummary extends Work {
  /** Up to 4 distinct cover URLs for the mosaic; first is the primary cover. */
  coverUrls: string[];
  /** ISO 639-1 codes of languages this work has editions in (from the source). */
  languages: string[];
}

/** Covers of one work grouped for the detail page (SPEC §3 F2.3). */
export interface LanguageGroup {
  /** ISO 639-1 code, or `undefined` for covers whose editions lack language data. */
  language?: string;
  coverIds: string[];
}

/** A purchase link generated from an ISBN at display time (SPEC §2.3). */
export interface BuyLink {
  provider: string;
  label: string;
  url: string;
}

/** Edition as delivered by /api/works/[id]: with display-time purchase links. */
export interface EditionView extends Edition {
  buyLinks: BuyLink[];
}
