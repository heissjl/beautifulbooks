/**
 * The catalogue questions the online curation tool asks (ROADMAP 5.10b).
 * Server only; Open Library only — never Google (CLAUDE.md: Google is called
 * in exactly two places, and this is not one of them).
 *
 * The same three questions `lab/collections/serve.ts` asks from Julian's
 * machine: who an author is, which works are hers, which works came out
 * under a publisher. Each answer sits in the Next data cache for a day, so a
 * friend opening the same author twice asks once.
 */
import { authorCandidates, type Candidate, type SearchDoc } from '../collectionedit';
import type { CollectionRecord } from '../collections';
import { fetchJson } from '../sources/http';
import { OL_REVALIDATE, OL_TIMEOUTS } from '../sources/openlibrary';

const BASE = 'https://openlibrary.org';

/** Works listed per author or publisher, most-printed first. */
export const MAX_CANDIDATES = 40;

export interface FoundAuthor {
  key: string;
  name: string;
  works: number;
  topWork?: string;
  born?: string;
}

export async function findAuthors(query: string): Promise<FoundAuthor[]> {
  const body = await fetchJson<{ docs?: Array<Record<string, unknown>> }>(
    `${BASE}/search/authors.json?q=${encodeURIComponent(query)}&limit=8`,
    { timeoutMs: OL_TIMEOUTS.search, revalidate: OL_REVALIDATE.search },
  );
  return (body.docs ?? [])
    .filter(d => typeof d.key === 'string' && typeof d.name === 'string')
    .map(d => ({
      key: String(d.key),
      name: String(d.name),
      works: Number(d.work_count) || 0,
      ...(typeof d.top_work === 'string' ? { topWork: d.top_work } : {}),
      ...(typeof d.birth_date === 'string' ? { born: d.birth_date } : {}),
    }));
}

const FIELDS = 'key,title,author_key,author_name,edition_count,first_publish_year,cover_i';

async function search(query: string): Promise<SearchDoc[]> {
  const body = await fetchJson<{ docs?: SearchDoc[] }>(
    `${BASE}/search.json?q=${encodeURIComponent(query)}&sort=editions&limit=${MAX_CANDIDATES * 2}&fields=${FIELDS}`,
    { timeoutMs: OL_TIMEOUTS.search, revalidate: OL_REVALIDATE.search },
  );
  return body.docs ?? [];
}

/**
 * The works of one source of a collection: an author on its list, or a
 * publisher spelling of a series. A source that is not on the collection is
 * refused rather than searched, so the tool cannot be used as a free proxy
 * for arbitrary catalogue queries.
 */
export async function candidatesFor(c: CollectionRecord, source: string): Promise<Candidate[] | null> {
  if (c.kind === 'authors') {
    const author = (c.authors ?? []).find(a => a.name === source);
    if (!author) return null;
    const docs = (await Promise.all(author.keys.map(k => search(`author_key:${k}`)))).flat();
    return authorCandidates(docs, author).sort((a, b) => b.editions - a.editions).slice(0, MAX_CANDIDATES);
  }
  if (!(c.publishers ?? []).includes(source)) return null;
  const docs = await search(`publisher:"${source.replace(/"/g, '')}"`);
  return docs.slice(0, MAX_CANDIDATES).map(d => ({
    id: d.key.replace('/works/', ''),
    title: d.title,
    author: d.author_name?.[0] ?? '',
    editions: d.edition_count ?? 0,
    firstPublished: d.first_publish_year,
    coverId: d.cover_i && d.cover_i > 0 ? `ol:${d.cover_i}` : undefined,
  }));
}
