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
    .replace(/<(table|figure|style|sup|blockquote)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<span class="mw-editsection">[\s\S]*?<\/span><\/span>/gi, '')
    .replace(/<h\d[\s\S]*?<\/h\d>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\[\d+\]/g, '')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n\n')
    // What is left of a quote box: its attribution line ("— Richard Wright").
    .split('\n\n').filter(p => !/^[—–-]\s*\S[^.]{0,60}$/.test(p.trim())).join('\n\n')
    .trim();
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
  const t = performance.now();
  const rg = await getJson<{ relations?: Array<{ type: string; url: { resource: string } }> }>(
    `https://musicbrainz.org/ws/2/release-group/${releaseGroupId}?inc=url-rels&fmt=json`);
  const musicbrainz = Math.round(performance.now() - t);
  const qid = rg.relations?.find(r => r.type === 'wikidata')?.url.resource.match(/Q\d+/)?.[0];
  if (!qid) return { article: null, url: null, sections: [], ms: { musicbrainz } };
  const found = await artworkFromWikidata(qid);
  return { ...found, ms: { musicbrainz, ...found.ms } };
}

/** The same from a Wikidata id the site already stores: one request fewer, and not the slow one. */
export async function artworkFromWikidata(qid: string): Promise<WikiArtwork> {
  const ms: Record<string, number> = {};
  const time = async <T>(step: string, f: () => Promise<T>) => { const t = performance.now(); const r = await f(); ms[step] = Math.round(performance.now() - t); return r; };
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
    .split('\n')
    // Headings, and personnel lines ("Johann Zambryski – artwork reconstruction") that have no sentence end.
    .filter(line => !/^=+ .* =+$/.test(line.trim()) && !/^[^.!?–]{1,60} [–-] /.test(line.trim()))
    .flatMap(line => line.split(/(?<=[.!?])\s+(?=[A-Z"“])/))
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => /\b(sleeve|artwork|jacket|cover)\b/i.test(s))
    .filter(s => !/\b(cover(ed)? versions?|covered by|covers? of|recorded a cover|tribute|to cover)\b/i.test(s) && s.length < 400);
}

/**
 * The opening of a text, whole paragraphs only, up to `max` characters — what
 * the page shows before "Read more on Wikipedia". A first paragraph longer than
 * `max` is cut at its last sentence end that fits.
 */
export function excerpt(text: string, max = 700): string {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  let out = '';
  for (const p of paragraphs) {
    if (!out && p.length > max) {
      const cut = p.slice(0, max);
      const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('." '));
      return end > 0 ? cut.slice(0, end + 1) : cut;
    }
    if (out && out.length + p.length + 2 > max) break;
    out = out ? `${out}\n\n${p}` : p;
  }
  return out;
}
