/**
 * Preloaded into `next build` and `next start` (NODE_OPTIONS=--require) by
 * lab/visitcost/run.ts (ROADMAP 2.18b). Wraps the global fetch before Next
 * wraps it, so only the requests that really leave the process arrive here —
 * a data-cache hit never does, which is exactly what a visit costs.
 *
 * - Open Library and Google Books: answered from lib/__fixtures__, the same
 *   routing as lib/__tests__/integration.test.ts; unknown works answer empty.
 * - Cover images (covers.openlibrary.org, books.google.com, archive.org):
 *   one small grey JPEG.
 * - Redis: the site speaks Upstash's REST protocol when STORAGE_*_REST_API_*
 *   is set (lib/hotornot/store.ts), so a fake at VISITCOST_REDIS_HOST answers
 *   each command from memory and counts it.
 * - Anything else that is not localhost is refused and counted. Nothing in a
 *   measurement may reach a real service — least of all production's Redis.
 *
 * Every external call is one JSON line in VISITCOST_LOG.
 */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- a --require preload is CommonJS by definition */
const fs = require('node:fs');
const path = require('node:path');

const LOG = process.env.VISITCOST_LOG;
const REDIS_HOST = process.env.VISITCOST_REDIS_HOST || 'redis.visitcost.test';
const FIXTURES = path.join(__dirname, '..', '..', 'lib', '__fixtures__');

function log(entry) {
  if (!LOG) return;
  try { fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), pid: process.pid, ...entry }) + '\n'); } catch { /* measurement only */ }
}

const fixtureCache = new Map();
function fixture(slug, file) {
  const key = `${slug}/${file}`;
  if (!fixtureCache.has(key)) {
    try { fixtureCache.set(key, JSON.parse(fs.readFileSync(path.join(FIXTURES, slug, file), 'utf8'))); }
    catch { fixtureCache.set(key, undefined); }
  }
  return fixtureCache.get(key);
}

const SLUG_BY_QUERY = {
  'mumbo jumbo': 'mumbo-jumbo',
  '1984': '1984',
  "gravity's rainbow": 'gravitys-rainbow',
  'the great gatsby': 'the-great-gatsby',
  'pride and prejudice': 'pride-and-prejudice',
};
const SLUGS = Object.values(SLUG_BY_QUERY);

function catalogue(url) {
  const q = url.searchParams.get('q') || '';
  if (url.hostname === 'www.googleapis.com') {
    const slug = SLUG_BY_QUERY[q.replace(/^intitle:/, '').toLowerCase()];
    return { body: (slug && fixture(slug, 'googlebooks-search.json')) || { totalItems: 0, items: [] } };
  }
  if (url.pathname === '/search.json' && q.startsWith('key:/works/')) {
    const id = q.replace('key:/works/', '');
    for (const slug of SLUGS) {
      const doc = (fixture(slug, 'openlibrary-search.json') || { docs: [] }).docs.find(d => d.key === `/works/${id}`);
      if (doc) return { body: { numFound: 1, docs: [doc] } };
    }
    return { body: { numFound: 0, docs: [] } };
  }
  if (url.pathname === '/search.json') {
    const slug = SLUG_BY_QUERY[q.toLowerCase()];
    return { body: (slug && fixture(slug, 'openlibrary-search.json')) || { numFound: 0, docs: [] } };
  }
  const work = url.pathname.match(/^\/works\/(OL\d+W)\.json$/);
  if (work) {
    for (const slug of SLUGS) {
      if ((fixture(slug, 'openlibrary-editions.json') || {}).workId === work[1]) return { body: fixture(slug, 'openlibrary-work.json') };
    }
    return { status: 404, body: { error: 'notfound' } };
  }
  const editions = url.pathname.match(/^\/works\/(OL\d+W)\/editions\.json$/);
  if (editions) {
    for (const slug of SLUGS) {
      const first = fixture(slug, 'openlibrary-editions.json');
      if (!first || first.workId !== editions[1]) continue;
      const offset = Number(url.searchParams.get('offset') || 0);
      const page = offset === 0 ? first : fixture(slug, `openlibrary-editions-${offset}.json`);
      return { body: { size: first.size, entries: (page && page.entries) || [] } };
    }
    return { body: { size: 0, entries: [] } };
  }
  return { body: { docs: [], entries: [], numFound: 0 } };
}

let jpeg;
function coverJpeg() {
  if (!jpeg) {
    const { encode } = require('jpeg-js');
    const width = 180, height = 270;
    const data = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const y = Math.floor(i / width);
      data[i * 4] = 120 + (y % 60); data[i * 4 + 1] = 110; data[i * 4 + 2] = 100; data[i * 4 + 3] = 255;
    }
    jpeg = encode({ data, width, height }, 80).data;
  }
  return jpeg;
}

// --- the fake Redis, Upstash REST: POST a JSON array, answer { result } ---
const strings = new Map();
const hashes = new Map();
const lists = new Map();
function redis(args) {
  const [cmd, key, ...rest] = args.map(String);
  switch (cmd.toUpperCase()) {
    case 'GET': return strings.has(key) ? strings.get(key) : null;
    case 'SET': {
      const nx = rest.map(r => r.toUpperCase()).includes('NX');
      if (nx && strings.has(key)) return null;
      strings.set(key, rest[0]);
      return 'OK';
    }
    case 'DEL': return [key, ...rest].filter(k => strings.delete(k) || hashes.delete(k) || lists.delete(k)).length;
    case 'EXPIRE': return 1;
    case 'HINCRBY': {
      const h = hashes.get(key) || new Map(); hashes.set(key, h);
      const v = Number(h.get(rest[0]) || 0) + Number(rest[1]); h.set(rest[0], String(v));
      return v;
    }
    case 'HGETALL': return [...(hashes.get(key) || new Map())].flat();
    case 'HSETNX': {
      const h = hashes.get(key) || new Map(); hashes.set(key, h);
      if (h.has(rest[0])) return 0; h.set(rest[0], rest[1]); return 1;
    }
    case 'RPUSH': { const l = lists.get(key) || []; lists.set(key, l); l.push(...rest); return l.length; }
    case 'LLEN': return (lists.get(key) || []).length;
    case 'LRANGE': {
      const l = lists.get(key) || []; const start = Number(rest[0]); const stop = Number(rest[1]);
      return l.slice(start < 0 ? Math.max(0, l.length + start) : start, stop < 0 ? l.length + stop + 1 : stop + 1);
    }
    case 'KEYS': return [...strings.keys(), ...hashes.keys(), ...lists.keys()];
    case 'EVAL': {
      // Only the site's one script, HINCRBY_MANY_SCRIPT (lib/hotornot/store.ts): ARGV[1] the expiry, then pairs.
      const hashKey = rest[1];
      const argv = rest.slice(2);
      const h = hashes.get(hashKey) || new Map(); hashes.set(hashKey, h);
      for (let i = 1; i + 1 < argv.length; i += 2) h.set(argv[i], String(Number(h.get(argv[i]) || 0) + Number(argv[i + 1])));
      return (argv.length - 1) / 2;
    }
    case 'INCR': { const v = Number(strings.get(key) || 0) + 1; strings.set(key, String(v)); return v; }
    default: return null;
  }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const realFetch = globalThis.fetch;

globalThis.fetch = async function visitcostFetch(input, init) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  let url;
  try { url = new URL(raw); } catch { return realFetch(input, init); }
  const host = url.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return realFetch(input, init);

  if (host === REDIS_HOST) {
    const body = init && typeof init.body === 'string' ? init.body : '[]';
    const args = JSON.parse(body);
    const value = redis(args);
    // The key's shape, not the key: days and ids become placeholders.
    const shape = String((String(args[0]).toUpperCase() === 'EVAL' ? args[3] : args[1]) ?? '').replace(/\d{4}-\d{2}-\d{2}/g, '<day>').replace(/[A-Za-z0-9_-]{16,}/g, '<id>');
    log({ kind: 'redis', cmd: String(args[0]).toUpperCase(), key: shape, bytes: body.length + JSON.stringify(value ?? null).length });
    return json({ result: value });
  }
  if (host === 'openlibrary.org' || host === 'www.googleapis.com') {
    const { status = 200, body } = catalogue(url);
    log({ kind: host === 'openlibrary.org' ? 'openlibrary' : 'google', path: url.pathname });
    return json(body ?? {}, status);
  }
  if (host === 'covers.openlibrary.org' || host === 'books.google.com' || host.endsWith('archive.org') || host === 'buyitscovers.com') {
    log({ kind: 'image', host });
    return new Response(coverJpeg(), { status: 200, headers: { 'content-type': 'image/jpeg' } });
  }
  log({ kind: 'blocked', host, path: url.pathname });
  throw new TypeError(`visitcost: ${host} is not reachable during a measurement`);
};
