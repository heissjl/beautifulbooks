/**
 * The fourth run (5.10i): finding translations that Open Library does not
 * hold, in other open catalogues, and a cover for them.
 *
 *   npx tsx lab/international-covers/lookup.ts dnb '<CQL>'        German National Library SRU, MARC21 → ISBN, title, publisher, year
 *   npx tsx lab/international-covers/lookup.ts bnf '<CQL>'        BnF SRU, Dublin Core → ISBN, title, publisher, year
 *   npx tsx lab/international-covers/lookup.ts isfdb <isbn>       ISFDB REST getpub → printings with image and artist
 *   npx tsx lab/international-covers/lookup.ts ol <isbn>          Open Library /isbn/<isbn>.json → edition key, works, covers
 *   npx tsx lab/international-covers/lookup.ts wd '<SPARQL>'      Wikidata query service
 *   npx tsx lab/international-covers/lookup.ts get <url>          any other open API (text)
 *   npx tsx lab/international-covers/lookup.ts img <url> <file>   download an image into lab/collections/for-openlibrary/international/
 *
 * Politeness as in the earlier runs: one request at a time, 1.5 s after each,
 * 40 s timeout, three tries. Text answers are cached in `lookup-cache.json`
 * (git-ignored); a failure is never cached and never read as "nothing there".
 * Google Books is never asked (lab rule 6); ISFDB only through its REST
 * interface, never the HTML pages behind Cloudflare.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_FILE = join(import.meta.dirname, 'lookup-cache.json');
export const IMAGE_DIR = join(import.meta.dirname, '..', 'collections', 'for-openlibrary', 'international');
const UA = 'beautifulbooks-lab-international-covers (julian.heiss@posteo.de)';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const cache: Record<string, { status: number; body: string }> = existsSync(CACHE_FILE)
  ? JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
  : {};

export class SourceFailed extends Error {}

/** Text of a URL; 404 is an answer ("not there") and cached, anything else that fails is thrown. */
export async function getText(url: string, accept = '*/*'): Promise<{ status: number; body: string }> {
  if (url in cache) return cache[url];
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(40_000), headers: { 'user-agent': UA, accept } });
      if (res.status === 429 || res.status >= 500 || res.status === 403) {
        last = String(res.status);
        await sleep(attempt * 10_000);
        continue;
      }
      const body = res.ok ? await res.text() : '';
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      cache[url] = { status: res.status, body };
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      await sleep(1500);
      return cache[url];
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      await sleep(attempt * 4000);
    }
  }
  throw new SourceFailed(`${url}: ${last}`);
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));

function marcField(rec: string, tag: string, code: string): string[] {
  const out: string[] = [];
  for (const f of rec.matchAll(new RegExp(`<datafield tag="${tag}"[^>]*>([\\s\\S]*?)</datafield>`, 'g'))) {
    for (const s of f[1].matchAll(new RegExp(`<subfield code="${code}">([\\s\\S]*?)</subfield>`, 'g'))) out.push(decode(s[1].trim()));
  }
  return out;
}

export async function dnb(cql: string) {
  const url = `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=${encodeURIComponent(cql)}&recordSchema=MARC21-xml&maximumRecords=50`;
  const { body } = await getText(url);
  const total = body.match(/<numberOfRecords>(\d+)/)?.[1];
  const recs = body.match(/<record xmlns="http:\/\/www.loc.gov\/MARC21\/slim"[\s\S]*?<\/record>/g) ?? [];
  return {
    total,
    records: recs.map(r => ({
      id: r.match(/<controlfield tag="001">([^<]+)/)?.[1],
      isbn: marcField(r, '020', 'a').concat(marcField(r, '020', '9')),
      title: [...marcField(r, '245', 'a'), ...marcField(r, '245', 'b')].join(' : '),
      original: marcField(r, '240', 'a').concat(marcField(r, '246', 'a')),
      author: marcField(r, '100', 'a'),
      publisher: marcField(r, '264', 'b').concat(marcField(r, '260', 'b')),
      year: marcField(r, '264', 'c').concat(marcField(r, '260', 'c')),
      lang: marcField(r, '041', 'a'),
      form: r.match(/<controlfield tag="007">([^<]+)/)?.[1]?.slice(0, 2),
    })),
  };
}

export async function bnf(cql: string) {
  const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=${encodeURIComponent(cql)}&recordSchema=dublincore&maximumRecords=50`;
  const { body } = await getText(url);
  const total = body.match(/<srw:numberOfRecords>(\d+)/)?.[1];
  const recs = body.match(/<oai_dc:dc[\s\S]*?<\/oai_dc:dc>/g) ?? [];
  const all = (r: string, t: string) => [...r.matchAll(new RegExp(`<dc:${t}>([\\s\\S]*?)</dc:${t}>`, 'g'))].map(m => decode(m[1].trim()));
  return {
    total,
    records: recs.map(r => ({
      title: all(r, 'title'),
      creator: all(r, 'creator'),
      publisher: all(r, 'publisher'),
      date: all(r, 'date'),
      id: all(r, 'identifier'),
      type: all(r, 'type'),
      lang: all(r, 'language'),
    })),
  };
}

/** Polish National Library, data.bn.org.pl: `author=…&title=…` (substring match). */
export async function bn(query: string) {
  const { body } = await getText(`https://data.bn.org.pl/api/institutions/bibs.json?limit=50&${query}`, 'application/json');
  const j = JSON.parse(body) as { bibs?: { title: string; author: string; publisher: string; publicationYear: string; isbnIssn: string; language: string }[] };
  return (j.bibs ?? []).map(b => ({ title: b.title, author: b.author, publisher: b.publisher, year: b.publicationYear, isbn: b.isbnIssn, lang: b.language }));
}

export async function isfdb(isbn: string) {
  const { status, body } = await getText(`https://www.isfdb.org/cgi-bin/rest/getpub.cgi?${isbn}`);
  const blocks = body.match(/<Publication>[\s\S]*?<\/Publication>/g) ?? [];
  const tag = (b: string, n: string) => decode(b.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`))?.[1]?.trim() ?? '');
  return {
    status,
    publications: blocks.map(b => ({
      record: tag(b, 'Record'),
      title: tag(b, 'Title'),
      authors: [...b.matchAll(/<Author>([\s\S]*?)<\/Author>/g)].map(m => decode(m[1])),
      year: tag(b, 'Year'),
      publisher: tag(b, 'Publisher'),
      isbn: tag(b, 'Isbn'),
      type: tag(b, 'PubType'),
      series: tag(b, 'PubSeries'),
      artists: [...(b.match(/<CoverArtists>([\s\S]*?)<\/CoverArtists>/)?.[1] ?? '').matchAll(/<Artist>([\s\S]*?)<\/Artist>/g)].map(m => decode(m[1])),
      image: tag(b, 'Image'),
      note: tag(b, 'Note').slice(0, 300),
    })),
  };
}

export async function ol(isbn: string) {
  const { status, body } = await getText(`https://openlibrary.org/isbn/${isbn}.json`, 'application/json');
  if (status === 404) return { status, edition: null };
  const e = JSON.parse(body);
  return { status, edition: e.key, title: e.title, works: e.works, covers: e.covers, languages: e.languages, publishers: e.publishers, date: e.publish_date };
}

export async function wd(sparql: string) {
  const { body } = await getText(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, 'application/sparql-results+json');
  const j = JSON.parse(body);
  return j.results.bindings.map((b: Record<string, { value: string }>) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}

/**
 * Whether a URL answers with an image, and how many bytes: only status and
 * size are cached, not the picture. The DNB cover service answers 404 with an
 * HTML page when it has no cover (measured 2026-09-26).
 */
export async function probeImage(url: string): Promise<{ status: number; bytes: number; type: string }> {
  const key = `probe:${url}`;
  if (key in cache) return JSON.parse(cache[key].body);
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(40_000), headers: { 'user-agent': UA } });
      if (res.status === 429 || res.status >= 500) { last = String(res.status); await sleep(attempt * 10_000); continue; }
      const buf = await res.arrayBuffer();
      const r = { status: res.status, bytes: buf.byteLength, type: res.headers.get('content-type') ?? '' };
      cache[key] = { status: res.status, body: JSON.stringify(r) };
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      await sleep(1500);
      return r;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      await sleep(attempt * 4000);
    }
  }
  throw new SourceFailed(`${url}: ${last}`);
}

/** Downloads an image once; never overwrites. Returns size in bytes and the content type. */
export async function img(url: string, file: string) {
  mkdirSync(IMAGE_DIR, { recursive: true });
  const path = join(IMAGE_DIR, file);
  if (existsSync(path)) return { path, cached: true };
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000), headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(String(res.status));
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(path, buf);
      await sleep(1500);
      return { path, bytes: buf.length, type: res.headers.get('content-type') };
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      await sleep(attempt * 5000);
    }
  }
  throw new SourceFailed(`${url}: ${last}`);
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  const run: Record<string, () => Promise<unknown>> = {
    dnb: () => dnb(a), bnf: () => bnf(a), bn: () => bn(a), isfdb: () => isfdb(a), ol: () => ol(a), wd: () => wd(a),
    get: async () => (await getText(a)).body, img: () => img(a, b),
  };
  if (!run[cmd]) throw new Error(`unknown command ${cmd}`);
  const out = await run[cmd]();
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
}

if (process.argv[1] === import.meta.filename) main();
