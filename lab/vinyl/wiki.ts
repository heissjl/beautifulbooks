/**
 * The artwork sections of an album's English Wikipedia article (ROADMAP 5.16).
 * Path: MusicBrainz release group → its Wikidata link → the enwiki sitelink →
 * the sections whose heading names the artwork → their plain text. Every step
 * is timed, because the question is whether this can run while a reader waits.
 * No cache here on purpose: the measurement is of a cold lookup.
 *
 * Wikipedia text is CC BY-SA 4.0; whatever the site shows from it needs the
 * article link and the licence beside it.
 */

const UA = 'beautifulbooks-lab/0.1 ( https://beautifulcovers.vercel.app )';

/** Headings that are about the sleeve; "Covers, tributes and samples" is about cover versions. */
export const ARTWORK_HEADING_RE = /^(?!covers?,)(.*\b(artwork|packaging|art direction|cover art(work)?|design|sleeve)\b.*)$/i;

/** HTML of a parsed section to plain text: no references, no edit links, no tables, no captions. */
export function sectionText(html: string): string {
  return html
    .replace(/<(table|figure|style|sup)[\s\S]*?<\/\1>/gi, '')
    .replace(/<span class="mw-editsection">[\s\S]*?<\/span><\/span>/gi, '')
    .replace(/<h\d[\s\S]*?<\/h\d>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\[\d+\]/g, '')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n\n').trim();
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export interface WikiArtwork {
  article: string | null;
  url: string | null;
  sections: Array<{ heading: string; text: string }>;
  /** Milliseconds per step: musicbrainz, wikidata, sections, texts. */
  ms: Record<string, number>;
}

export async function artworkFromWikipedia(releaseGroupId: string): Promise<WikiArtwork> {
  const ms: Record<string, number> = {};
  const time = async <T>(step: string, f: () => Promise<T>) => { const t = performance.now(); const r = await f(); ms[step] = Math.round(performance.now() - t); return r; };

  const rg = await time('musicbrainz', () => getJson<{ relations?: Array<{ type: string; url: { resource: string } }> }>(
    `https://musicbrainz.org/ws/2/release-group/${releaseGroupId}?inc=url-rels&fmt=json`));
  const qid = rg.relations?.find(r => r.type === 'wikidata')?.url.resource.match(/Q\d+/)?.[0];
  if (!qid) return { article: null, url: null, sections: [], ms };
  const wd = await time('wikidata', () => getJson<{ entities: Record<string, { sitelinks?: Record<string, { title: string }> }> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=enwiki&format=json`));
  const article = wd.entities[qid]?.sitelinks?.enwiki?.title ?? null;
  if (!article) return { article: null, url: null, sections: [], ms };
  const page = encodeURIComponent(article.replace(/ /g, '_'));
  const parsed = await time('sections', () => getJson<{ parse: { sections: Array<{ index: string; line: string }> } }>(
    `https://en.wikipedia.org/w/api.php?action=parse&page=${page}&prop=sections&format=json&redirects=1`));
  const wanted = parsed.parse.sections.filter(s => ARTWORK_HEADING_RE.test(s.line.replace(/<[^>]+>/g, '')));
  const sections = await time('texts', () => Promise.all(wanted.map(async s => {
    const r = await getJson<{ parse: { text: { '*': string } } }>(
      `https://en.wikipedia.org/w/api.php?action=parse&page=${page}&section=${s.index}&prop=text&format=json&redirects=1&disablelimitreport=1`);
    return { heading: s.line.replace(/<[^>]+>/g, ''), text: sectionText(r.parse.text['*']) };
  })));
  const found = sections.filter(s => s.text);
  if (found.length) return { article, url: `https://en.wikipedia.org/wiki/${page}`, sections: found, ms };
  // No artwork section (Kind of Blue, Autobahn): the sentences anywhere in the article that speak of the sleeve.
  const ex = await time('extract', () => getJson<{ query: { pages: Record<string, { extract?: string }> } }>(
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${page}&format=json&redirects=1`));
  const text = Object.values(ex.query.pages)[0]?.extract ?? '';
  const sentences = sleeveSentences(text);
  return { article, url: `https://en.wikipedia.org/wiki/${page}`, sections: sentences.length ? [{ heading: '(sentences about the sleeve)', text: sentences.join(' ') }] : [], ms };
}

/** Sentences that speak of the sleeve, not of cover versions of the songs. */
export function sleeveSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => /\b(sleeve|artwork|jacket|cover)\b/i.test(s))
    .filter(s => !/\b(cover(ed)? versions?|covered by|covers? of|recorded a cover|tribute|to cover)\b/i.test(s) && s.length < 400);
}
