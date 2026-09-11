/**
 * Hot or Not for book covers, played locally (ROADMAP 5.8, Spielart 4).
 *
 *   npx tsx lab/hotornot/serve.ts                    # 100 covers, one from each of 100 books
 *   npx tsx lab/hotornot/serve.ts --work OL468431W   # every design of one book
 *   npx tsx lab/hotornot/serve.ts --size 60 --seed paperwhite
 *
 * Then http://localhost:4324 — two covers, click the one you would rather
 * look at; #board for the standings.
 *
 * The pool comes from `data/cover-index.json` (E18), offline; only the images
 * come from Open Library's CDN, straight into the browser. Google Books is
 * never asked (lab rule 6).
 *
 * Votes go to `lab/hotornot/votes/<pool>.json` after every click, atomically.
 * **Nothing in them identifies a voter** — no name, no session, no address;
 * a vote is two covers, a winner and a day (N11). So the file cannot tell one
 * player from ten, and it does not need to: consensus is computed over votes.
 * The file also keeps the pool itself, so a rebuilt index cannot change the
 * covers underneath votes already cast.
 */
import { createServer, type IncomingMessage } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rng } from '../../lib/loading';
import { buildPool, poolName, type PoolCover, type PoolOptions, type RawIndex } from '../../lib/hotornot/pool';
import {
  CROWN_HOLD, applyVote, crowns, favouriteRate, newElo, nextPair, verdictFor,
  type Crown, type Standing, type Vote,
} from '../../lib/hotornot/rating';

const ROOT = join(import.meta.dirname, '..', '..');
const HTML_FILE = join(import.meta.dirname, 'index.html');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * `--votes <dir>` sends the votes elsewhere. A test against the running game
 * must use it: the curation tool learned that a test writing to the same file
 * as a person leaves invented choices in real data (lab/curate/README.md).
 */
const VOTES_DIR = arg('votes') ?? join(import.meta.dirname, 'votes');
const PORT = Number(arg('port') ?? process.env.PORT ?? 4324);
const work = arg('work');
const options: PoolOptions = work
  ? { mode: 'work', workId: work }
  : { mode: 'mix', size: Number(arg('size') ?? 100), seed: arg('seed') ?? 'paperwhite' };

interface Stored {
  pool: { name: string; indexBuiltAt: string; covers: PoolCover[] };
  votes: Array<Vote & { on: string }>;
  notCovers: Array<{ id: string; reason: 'reported' | 'broken' }>;
}

const index = JSON.parse(readFileSync(join(ROOT, 'data', 'cover-index.json'), 'utf8')) as RawIndex;
const name = poolName(options);
const file = join(VOTES_DIR, `${name}.json`);
const built = buildPool(index, options);
if (built.length < 2) {
  console.error(options.mode === 'work'
    ? `${options.workId}: not in the index, or fewer than two distinct designs`
    : 'the index yields fewer than two covers');
  process.exit(1);
}

const stored: Stored = existsSync(file)
  ? JSON.parse(readFileSync(file, 'utf8')) as Stored
  : { pool: { name, indexBuiltAt: index.builtAt, covers: built }, votes: [], notCovers: [] };
if (stored.pool.covers.map(c => c.id).join() !== built.map(c => c.id).join()) {
  console.warn(`the index has changed since ${stored.pool.indexBuiltAt}; keeping the pool the votes were cast on`);
}

const covers = new Map(stored.pool.covers.map(c => [c.id, c]));
const elo = newElo(stored.pool.covers.map(c => c.id));
for (const vote of stored.votes) applyVote(elo, vote);
const random = rng(Date.now() >>> 0);
let lastPair: [string, string] | undefined;

const excluded = () => new Set(stored.notCovers.map(n => n.id));
const active = () => {
  const out = excluded();
  return stored.pool.covers.map(c => c.id).filter(id => !out.has(id));
};

function save() {
  mkdirSync(VOTES_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(stored, null, 1)}\n`);
  renameSync(tmp, file);
}

/** `default=false`: a cover Open Library does not have answers 404 instead of a grey placeholder. */
const imageUrl = (id: string, size: 'M' | 'L') =>
  `https://covers.openlibrary.org/b/id/${id.slice(3)}-${size}.jpg?default=false`;

/**
 * What the board may say about one end. `exact` only for a crown held
 * CROWN_HOLD rounds in a row; a crown held for less is `rising` — shown,
 * but not yet a finding.
 */
function judge(crown: Crown, standing: Standing | undefined, end: 'best' | 'worst'): string {
  if (!standing) return 'open';
  if (crown.held >= CROWN_HOLD) return 'exact';
  if (crown.held > 0) return 'rising';
  return verdictFor(standing, end);
}

async function body(req: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const send = (code: number, payload: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(payload));
  };

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(readFileSync(HTML_FILE, 'utf8'));
    return;
  }

  if (url.pathname === '/api/pair') {
    const ids = active();
    const pair = nextPair(ids, elo, random, { last: lastPair });
    if (!pair) return send(200, { done: true, pool: name, votes: stored.votes.length, covers: ids.length });
    lastPair = pair;
    const [a, b] = pair;
    return send(200, {
      pool: name,
      votes: stored.votes.length,
      covers: ids.length,
      a: { id: a, url: imageUrl(a, 'L') },
      b: { id: b, url: imageUrl(b, 'L') },
    });
  }

  if (url.pathname === '/api/vote' && req.method === 'POST') {
    const { a, b, winner } = await body(req);
    if (!covers.has(a) || !covers.has(b) || a === b || (winner !== a && winner !== b)) {
      return send(400, { error: 'not a vote between two covers of this pool' });
    }
    const vote = { a, b, winner };
    stored.votes.push({ ...vote, on: new Date().toISOString().slice(0, 10) });
    applyVote(elo, vote);
    save();
    return send(200, { ok: true, votes: stored.votes.length });
  }

  if (url.pathname === '/api/not-a-cover' && req.method === 'POST') {
    const { id, reason } = await body(req);
    if (!covers.has(id)) return send(400, { error: 'not in this pool' });
    if (!excluded().has(id)) {
      stored.notCovers.push({ id, reason: reason === 'broken' ? 'broken' : 'reported' });
      save();
    }
    return send(200, { ok: true });
  }

  if (url.pathname === '/api/board') {
    const ids = active();
    const out = excluded();
    const votes = stored.votes.filter(v => !out.has(v.a) && !out.has(v.b));
    // One round is as many votes as there are covers: the spacing sim.ts judges at.
    const { table, best, worst } = crowns(ids, votes, { step: Math.max(1, ids.length) });
    const show = (s: Standing) => ({ ...covers.get(s.id), ...s, url: imageUrl(s.id, 'M') });
    const top = table.slice(0, 5);
    const bottom = table.slice(-5).reverse();
    return send(200, {
      pool: name,
      covers: ids.length,
      votes: votes.length,
      perCover: ids.length ? (2 * votes.length) / ids.length : 0,
      favourite: favouriteRate(ids, votes),
      notCovers: stored.notCovers.length,
      hold: CROWN_HOLD,
      best: judge(best, top[0], 'best'),
      bestHeld: best.held,
      worst: judge(worst, bottom[0], 'worst'),
      worstHeld: worst.held,
      top: top.map(show),
      bottom: bottom.map(show),
    });
  }

  send(404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`hotornot: pool ${name}, ${active().length} covers, ${stored.votes.length} votes so far`);
  console.log(`open http://localhost:${PORT}`);
});
