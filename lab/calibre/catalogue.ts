/**
 * Where the app asks for works and their covers (lab/calibre, ROADMAP 5.16a).
 *
 * Two ways to the same catalogue, behind one shape:
 *
 *  - **through the website** (`siteCatalogue`): `/api/search` and
 *    `/api/works/<id>?offset=&sibling=1` of buyitscovers.com. The site asks
 *    Open Library from its own servers and keeps every answer for a day at
 *    its CDN, so a book opened before costs the catalogue nothing — and a
 *    block of Julian's address, as on 2026-10-04, does not reach the app
 *    (Julian that day: „vielleicht wär es deshalb doch besser die lokale app
 *    mit der website zu verbinden und von dort die abfrage machen zu lassen?").
 *    `sibling=1` is the route's Open-Library-only mode: no Google request and
 *    no charge on the site's `google` bucket („google können wir doch für
 *    diese app weglassen" — measured the same day: Google's images are no
 *    larger than Open Library's).
 *  - **directly** (`directCatalogue`): the site's own code run here, as the
 *    app did at first. The fallback when the website does not answer.
 *
 * Only ever on a click, one book at a time: a loop through this door would
 * draw Open Library's block onto the website instead of onto one Mac. What
 * either way answered is kept on this Mac (`kept.ts`).
 */
import { pickCovers, pickCoversFromPage, type PickCover } from './covers';
import { getEditionsPage, getWork, isWorkId, parseEditions, search, userAgent, type Work, type WorkSummary } from './site';

export interface CataloguePage {
  work: Work;
  covers: PickCover[];
  /** Edition records the catalogue has for the work. */
  editions: number;
  /** Offset of the next page, null when there is none. */
  next: number | null;
}

export interface Catalogue {
  search(query: string): Promise<WorkSummary[]>;
  /** One page of a work's covers; null when the catalogue does not know the work. */
  page(workId: string, offset: number): Promise<CataloguePage | null>;
}

/** The website answered, and the answer was a refusal the reader should hear in its own words. */
export class CatalogueError extends Error {}

const real = (works: readonly WorkSummary[]): WorkSummary[] => works.filter((w) => isWorkId(w.id));

export function directCatalogue(): Catalogue {
  return {
    search: async (query) => real((await search(query)).works),
    page: async (workId, offset) => {
      const work = await getWork(workId);
      if (!work) return null;
      const page = await getEditionsPage(workId, offset);
      return { work, covers: pickCovers(parseEditions(page.entries, work)), editions: page.size, next: offset + 100 < page.size ? offset + 100 : null };
    },
  };
}

interface SitePage {
  work: Work;
  editions: Parameters<typeof pickCoversFromPage>[1];
  covers: Parameters<typeof pickCoversFromPage>[0];
  page: { total: number; nextOffset?: number };
}

export function siteCatalogue(base: string, fetcher: typeof fetch = fetch): Catalogue {
  const get = async <T>(path: string): Promise<T | null> => {
    let res: Response;
    try {
      res = await fetcher(`${base}${path}`, { headers: { 'user-agent': userAgent(base), accept: 'application/json' }, signal: AbortSignal.timeout(35_000) });
    } catch {
      // Without its cause on purpose: a website that cannot be reached must not be read as Open Library shutting the door (`refusedConnection`).
      throw new Error('The website did not answer.');
    }
    if (res.status === 404) return null;
    if (res.status === 429) throw new CatalogueError('The website is holding back: too many requests in a short time. Wait a minute and open the book again.');
    if (res.status === 403) throw new CatalogueError('The website turned the app away (its bot protection). Try again in a few minutes.');
    if (!res.ok) throw new Error(`The website answered ${res.status}.`);
    return (await res.json()) as T;
  };
  return {
    search: async (query) => real((await get<{ works: WorkSummary[] }>(`/api/search?q=${encodeURIComponent(query)}`))?.works ?? []),
    page: async (workId, offset) => {
      const body = await get<SitePage>(`/api/works/${workId}?offset=${offset}&sibling=1`);
      if (!body) return null;
      return { work: body.work, covers: pickCoversFromPage(body.covers, body.editions), editions: body.page.total, next: body.page.nextOffset ?? null };
    },
  };
}

/**
 * The first catalogue, and the second when the first fails and `mayFallBack`
 * allows it. A refusal the website put into words (`CatalogueError`) is kept
 * when the second cannot be asked either.
 */
export function withFallback(first: Catalogue, second: Catalogue, mayFallBack: () => boolean): Catalogue {
  const either = async <T>(ask: (c: Catalogue) => Promise<T>): Promise<T> => {
    try {
      return await ask(first);
    } catch (err) {
      if (!mayFallBack()) throw err;
      return ask(second);
    }
  };
  return { search: (q) => either((c) => c.search(q)), page: (id, offset) => either((c) => c.page(id, offset)) };
}
