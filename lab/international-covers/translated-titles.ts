/**
 * Translated titles for the works still without an international cover, and
 * the Open Library records under them (Julian, 2026-09-26, yes to „a
 * targeted lookup").
 *
 *   npx tsx lab/international-covers/translated-titles.ts [list.json]
 *
 * For each `none` row of the list (default
 * `lab/collections/lists/sf-relaunch-international.json`):
 * 1. The English Wikipedia article of the book (`article`: a page that names
 *    the author in its introduction), its interlanguage links, and the
 *    Wikidata labels of its item — or, without an article, a Wikidata item
 *    whose description names the author (`wikidataOnly`). Those are the
 *    translated titles.
 * 2. Each non-English title is searched at Open Library (`title=` + author
 *    surname, then `q=` if nothing). A record is taken only when an author
 *    name contains the surname and its title is the translated one
 *    (`sameTitle`); its editions must then hold a non-English cover.
 * 3. Hits are added to `translations.json` with `via` and the language;
 *    `international.ts` then picks from them. What was searched per book is
 *    written to `translated-titles.json`.
 *
 * Wikipedia, Wikidata and Open Library only; one request at a time, paused,
 * 40 s timeout, retries with back-off on 429; everything cached
 * (`wiki-cache.json`, and Open Library's `cache.json`), failures never cached.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeTitle } from '../../lib/normalize';
import { WIKI_TO_MARC } from './evidence';
import { get as olGet, SourceFailed } from './ol';
import { sameTitle, surnameOf, stripNote, translationCandidates, type EditionWithOriginal, type TranslationMatch } from './pick';

const ROOT = join(import.meta.dirname, '..', '..');
const WIKI_CACHE = join(import.meta.dirname, 'wiki-cache.json');
const HAND_FILE = join(import.meta.dirname, 'translations.json');
const REPORT_FILE = join(import.meta.dirname, 'translated-titles.json');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const wikiCache: Record<string, unknown> = existsSync(WIKI_CACHE) ? JSON.parse(readFileSync(WIKI_CACHE, 'utf8')) : {};

async function wiki<T>(url: string): Promise<T> {
  if (url in wikiCache) return wikiCache[url] as T;
  let last = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(40_000), headers: { 'user-agent': 'beautifulbooks-lab-international-covers/1.0 (research script, one request at a time)' } });
      if (res.status === 429) { last = '429'; await sleep(attempt * 30_000); continue; }
      if (!res.ok) throw new Error(String(res.status));
      wikiCache[url] = await res.json();
      writeFileSync(WIKI_CACHE, JSON.stringify(wikiCache));
      await sleep(500);
      return wikiCache[url] as T;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      await sleep(attempt * 4000);
    }
  }
  throw new SourceFailed(`no answer for ${url}: ${last}`);
}

const WP = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&';

interface Title { wiki: string; lang: string; title: string; via: TranslationMatch }

/**
 * The English article of the book: the first of "<title> (<surname> novel)",
 * "<title> (novel)", "<title>", "The <title>" and the search hits on title
 * and surname whose page exists, is not a disambiguation page, and names the
 * author's surname in its introduction but is not the author's own article —
 * so "Light" is not the article on light, "Castles Made of Sand" not the
 * song, and "Floating Worlds" not the redirect to Cecelia Holland.
 */
async function article(title: string, author: string): Promise<string | null> {
  const surname = surnameOf(author);
  const search = await wiki<{ query?: { search?: Array<{ title: string }> } }>(`${WP}action=query&list=search&srlimit=8&srsearch=${encodeURIComponent(`${title} ${surname}`)}`);
  const fromSearch = (search.query?.search ?? []).map(h => h.title).filter(t => normalizeTitle(stripNote(t)) === normalizeTitle(title));
  const tries = [...new Set([`${title} (${surname} novel)`, `${title} (novel)`, title, ...(/^the /i.test(title) ? [] : [`The ${title}`]), ...fromSearch])];
  for (const t of tries) {
    const body = await wiki<{ query?: { pages?: Array<{ title: string; missing?: boolean; extract?: string; pageprops?: { disambiguation?: string } }> } }>(
      `${WP}action=query&prop=extracts|pageprops&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(t)}`);
    const page = body.query?.pages?.[0];
    if (!page || page.missing || page.pageprops?.disambiguation !== undefined) continue;
    // A redirect to the author's own article ("Floating Worlds" → "Cecelia Holland") is not the book's.
    const resolved = normalizeTitle(stripNote(page.title));
    if (resolved.includes(normalizeTitle(surname)) && !resolved.includes(normalizeTitle(title))) continue;
    if ((page.extract ?? '').toLowerCase().includes(surname.toLowerCase())) return page.title;
  }
  return null;
}

async function translatedTitles(articleTitle: string): Promise<Title[]> {
  const body = await wiki<{ query?: { pages?: Array<{ langlinks?: Array<{ lang: string; title: string }>; pageprops?: { wikibase_item?: string } }> } }>(
    `${WP}action=query&prop=langlinks|pageprops&ppprop=wikibase_item&lllimit=500&redirects=1&titles=${encodeURIComponent(articleTitle)}`);
  const page = body.query?.pages?.[0];
  const out: Title[] = [];
  const add = (wikiLang: string, title: string, via: TranslationMatch) => {
    const lang = WIKI_TO_MARC[wikiLang];
    const clean = stripNote(title);
    if (!lang || !clean || out.some(t => t.lang === lang && normalizeTitle(t.title) === normalizeTitle(clean))) return;
    out.push({ wiki: wikiLang, lang, title: clean, via });
  };
  for (const l of page?.langlinks ?? []) add(l.lang, l.title, 'wikipedia-langlink');
  const item = page?.pageprops?.wikibase_item;
  if (item) {
    const wd = await wiki<{ entities?: Record<string, { labels?: Record<string, { language: string; value: string }> }> }>(
      `https://www.wikidata.org/w/api.php?format=json&action=wbgetentities&props=labels&ids=${item}`);
    for (const l of Object.values(wd.entities?.[item]?.labels ?? {})) add(l.language, l.value, 'wikidata');
  }
  return out;
}

/**
 * Where English Wikipedia has no article: a Wikidata item found by title
 * whose English description names the author's surname ("1969 novel by
 * Brian Aldiss"). Its labels and sitelink titles are the translated titles.
 */
async function wikidataOnly(title: string, author: string): Promise<{ item: string; titles: Title[] } | null> {
  const surname = surnameOf(author).toLowerCase();
  const found = await wiki<{ search?: Array<{ id: string; label?: string; description?: string }> }>(
    `https://www.wikidata.org/w/api.php?format=json&action=wbsearchentities&language=en&type=item&limit=10&search=${encodeURIComponent(title)}`);
  const hit = (found.search ?? []).find(h => (h.description ?? '').toLowerCase().includes(surname) && normalizeTitle(h.label ?? '') === normalizeTitle(title));
  if (!hit) return null;
  const wd = await wiki<{ entities?: Record<string, { labels?: Record<string, { language: string; value: string }>; sitelinks?: Record<string, { site: string; title: string }> }> }>(
    `https://www.wikidata.org/w/api.php?format=json&action=wbgetentities&props=labels|sitelinks&ids=${hit.id}`);
  const entity = wd.entities?.[hit.id];
  const titles: Title[] = [];
  const add = (wikiLang: string, t: string) => {
    const lang = WIKI_TO_MARC[wikiLang];
    const clean = stripNote(t);
    if (lang && clean && !titles.some(x => x.lang === lang && normalizeTitle(x.title) === normalizeTitle(clean))) titles.push({ wiki: wikiLang, lang, title: clean, via: 'wikidata' });
  };
  for (const l of Object.values(entity?.labels ?? {})) add(l.language, l.value);
  for (const l of Object.values(entity?.sitelinks ?? {})) if (/^[a-z]+wiki$/.test(l.site)) add(l.site.replace(/wiki$/, ''), l.title);
  return { item: hit.id, titles };
}

interface Doc { key: string; title: string; author_name?: string[]; language?: string[] }

async function olRecords(t: Title, author: string, bookTitle: string): Promise<Doc[]> {
  const surname = surnameOf(author);
  const fields = 'key,title,author_name,language,edition_count';
  const accept = (docs: Doc[]) => docs.filter(d =>
    (d.author_name ?? []).some(a => normalizeTitle(a).includes(normalizeTitle(surname))) &&
    sameTitle(d.title, t.title) && !sameTitle(d.title, bookTitle));
  const byTitle = await olGet<{ docs?: Doc[] }>(`/search.json?${new URLSearchParams({ title: t.title, author: surname, fields, limit: '10' })}`);
  const hits = accept(byTitle?.docs ?? []);
  if (hits.length) return hits;
  const byQ = await olGet<{ docs?: Doc[] }>(`/search.json?${new URLSearchParams({ q: `${t.title} ${surname}`, fields, limit: '10' })}`);
  return accept(byQ?.docs ?? []);
}

interface Report {
  order: number; id: string; title: string; author: string;
  article: string | null;
  searched: Array<Title & { works: string[]; covers: number }>;
  outcome: 'found' | 'translation not on Open Library' | 'no translation known' | 'no article' | 'failed';
}

async function main() {
  const listFile = process.argv[2] ?? join(ROOT, 'lab', 'collections', 'lists', 'sf-relaunch-international.json');
  const rows = (JSON.parse(readFileSync(listFile, 'utf8')) as Array<{ order: number; id: string; title: string; author: string; status: string }>)
    .filter(r => r.status === 'none');
  const hand = existsSync(HAND_FILE) ? (JSON.parse(readFileSync(HAND_FILE, 'utf8')) as Record<string, unknown>) : {};
  const reports: Report[] = [];
  for (const r of rows) {
    const title = stripNote(r.title);
    const rep: Report = { order: r.order, id: r.id, title: r.title, author: r.author, article: null, searched: [], outcome: 'no article' };
    try {
      rep.article = await article(title, r.author);
      const wdOnly = rep.article ? null : await wikidataOnly(title, r.author);
      if (wdOnly) rep.article = `wikidata:${wdOnly.item}`;
      if (rep.article) {
        const titles = (wdOnly ? wdOnly.titles : await translatedTitles(rep.article)).filter(t => !sameTitle(t.title, title));
        rep.outcome = titles.length ? 'translation not on Open Library' : 'no translation known';
        for (const t of titles) {
          const docs = await olRecords(t, r.author, title);
          let covers = 0;
          for (const d of docs) {
            const workKey = d.key.replace('/works/', '');
            if (workKey === r.id) continue;
            const page = await olGet<{ entries?: EditionWithOriginal[] }>(`/works/${workKey}/editions.json?limit=50`);
            const found = translationCandidates(page?.entries ?? [], t.lang, workKey, t.via);
            covers += found.length;
            if (found.length && !(workKey in hand)) hand[workKey] = { id: r.id, via: t.via, lang: t.lang, title: d.title };
          }
          rep.searched.push({ ...t, works: docs.map(d => d.key.replace('/works/', '')), covers });
          if (covers) rep.outcome = 'found';
        }
      }
    } catch (err) {
      if (!(err instanceof SourceFailed)) throw err;
      console.error(`\n${r.title}: ${err.message}`);
      rep.outcome = 'failed';
    }
    reports.push(rep);
    process.stdout.write(rep.outcome === 'found' ? '+' : rep.outcome === 'failed' ? 'x' : '.');
  }
  writeFileSync(HAND_FILE, `${JSON.stringify(hand, null, 1)}\n`);
  writeFileSync(REPORT_FILE, `${JSON.stringify(reports, null, 1)}\n`);
  const tally = reports.reduce<Record<string, number>>((m, x) => ({ ...m, [x.outcome]: (m[x.outcome] ?? 0) + 1 }), {});
  console.log(`\n${JSON.stringify(tally)}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
