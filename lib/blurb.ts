/**
 * The work's own description from Open Library, as a blurb (ROADMAP 6.46).
 *
 * Google Books was the only source of the blurb in the work panel: measured
 * 2026-09-13, 0 of 567 Open Library *edition* records carry a description,
 * while Google's result lists carry 6–20 per work. But Open Library keeps a
 * description on the *work* — 132 of 134 published works had one, median
 * 631 characters — and that record is one request away, cached a day.
 *
 * Two things the measurement showed and this module handles:
 *   - the texts are markdown: reference links, `[source][1]` footnotes,
 *     emphasis, and a trailing "Also contained in:" list;
 *   - fifteen of them name their source, mostly Wikipedia (CC BY-SA), so the
 *     panel must attribute Wikipedia where the text does — "via Open
 *     Library" alone would be wrong.
 *
 * Pure. Safe on the client.
 */

export type DescriptionSource = 'openlibrary' | 'wikipedia';

/** Open Library stores the field either as a string or as `{type, value}`. */
export type RawDescription = string | { type?: string; value?: string } | undefined | null;

/**
 * When the server asks Open Library for the work record on page 0:
 *   - `fallback` (default): only when no edition on the page has a blurb —
 *     Google failed, its quota is gone, or it simply had none;
 *   - `always`: prefer the work's description over edition blurbs (this is
 *     the switch away from Google);
 *   - `never`: leave it out.
 *
 * `BLURB_SOURCE` is read on the server only, where the request is made. Any
 * other value fails loudly, like NEXT_PUBLIC_SITE_MODE (lib/sitemode.ts).
 */
export type WorkDescriptionPolicy = 'fallback' | 'always' | 'never';

export function workDescriptionPolicy(raw: string | undefined = process.env.BLURB_SOURCE): WorkDescriptionPolicy {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '' || value === 'editions' || value === 'fallback') return 'fallback';
  if (value === 'work' || value === 'openlibrary' || value === 'always') return 'always';
  if (value === 'off' || value === 'none' || value === 'never') return 'never';
  throw new Error(`BLURB_SOURCE must be "editions", "work" or "off", got "${raw}"`);
}

export function rawText(raw: RawDescription): string {
  if (!raw) return '';
  return (typeof raw === 'string' ? raw : raw.value ?? '').trim();
}

/** Lines after which an Open Library description stops describing the book. */
const TAIL = /^\s*(also contained in|contains|see also|also published as|source|sources|quelle)\s*:?\s*$/i;

/**
 * Plain text out of Open Library's markdown. A reader for this one field's
 * habits, not a markdown engine: it removes what would read as noise in a
 * panel and keeps the sentences.
 */
export function cleanDescription(raw: RawDescription): string | undefined {
  let text = rawText(raw);
  if (!text) return undefined;

  const kept: string[] = [];
  for (const line of text.split('\n')) {
    if (/^\s*\[[^\]]+\]:\s*\S+/.test(line)) continue;          // [1]: https://…
    if (/^\s*-{3,}\s*$|^\s*\*{3,}\s*$/.test(line)) continue;   // ---- rules
    if (TAIL.test(line.replace(/[-*#]/g, '').trim()) || TAIL.test(line)) break;
    if (/^\s*(source|quelle)\s*:/i.test(line)) continue;       // Source: Wikipedia
    kept.push(line);
  }
  text = kept.join('\n');

  text = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                      // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                   // [text](url)
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')                  // [text][1]
    .replace(/\(\s*(source|sources|quelle)\s*\)/gi, '')        // (source) left over
    .replace(/\[(?:source|\d+)\]/gi, '')                       // [source], [1]
    .replace(/^#+\s*/gm, '')                                   // headings
    .replace(/^\s*[-*]\s+/gm, '– ')                            // bullets
    .replace(/(\*\*|__)(.+?)\1/g, '$2')                        // bold
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2') // emphasis
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text.length > 0 ? text : undefined;
}

/**
 * Who wrote it, as far as the text says. A description that names Wikipedia
 * is CC BY-SA and must be attributed to Wikipedia; everything else is
 * attributed to Open Library, where a contributor entered it.
 */
export function descriptionSource(raw: RawDescription): DescriptionSource {
  return /wikipedia/i.test(rawText(raw)) ? 'wikipedia' : 'openlibrary';
}
