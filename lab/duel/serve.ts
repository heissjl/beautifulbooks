/**
 * Two people, one link, the same covers — a prototype (ROADMAP 5.8, Spielart 2).
 *
 *   npx tsx lab/duel/serve.ts        # http://localhost:4322
 *
 * Both open `/?seed=<word>&me=<name>`, see the same books in the same order
 * with the same covers offered, choose without seeing each other, and get a
 * comparison once both are done.
 *
 * **The pool comes from `data/cover-index.json`** — a hundred works with
 * 10,362 covers, already built (E18). No request leaves this machine to run
 * a round; only the images do, straight from Open Library's CDN.
 *
 * Answers live in `lab/duel/rounds.json`. That file is exactly the thing the
 * finished game would need a server for, and it is why this stays in `lab/`:
 * the website has no store (E6), and whether the game earns one is a
 * question for the measurement below, not for a prototype.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { buildRound, compare, type DuelBook } from './seed';

const ROOT = join(import.meta.dirname, '..', '..');
const INDEX_FILE = join(ROOT, 'data', 'cover-index.json');
const ROUNDS_FILE = join(import.meta.dirname, 'rounds.json');
const HTML_FILE = join(import.meta.dirname, 'index.html');
const PORT = Number(process.env.PORT ?? 4322);

interface RawIndex {
  works: Array<[id: string, title: string, author: string]>;
  covers: Array<[work: number, cover: string, ...rest: unknown[]]>;
}

/** seed -> player -> bookId -> coverId */
type Rounds = Record<string, Record<string, Record<string, string>>>;

const index = JSON.parse(readFileSync(INDEX_FILE, 'utf8')) as RawIndex;
const rounds: Rounds = existsSync(ROUNDS_FILE) ? JSON.parse(readFileSync(ROUNDS_FILE, 'utf8')) : {};

const coversByWork = new Map<number, string[]>();
for (const [w, cover] of index.covers) {
  const list = coversByWork.get(w);
  if (list) list.push(cover);
  else coversByWork.set(w, [cover]);
}

const POOL: DuelBook[] = index.works.map(([id, title, author], i) => ({
  id, title, author, coverIds: coversByWork.get(i) ?? [],
}));

function save() {
  const tmp = `${ROUNDS_FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(rounds, null, 1)}\n`);
  renameSync(tmp, ROUNDS_FILE);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(readFileSync(HTML_FILE, 'utf8'));
    return;
  }

  if (url.pathname === '/api/round') {
    const seed = url.searchParams.get('seed') ?? 'beautiful';
    const round = buildRound(seed, POOL, { books: 10, choices: 6 });
    const players = rounds[seed] ?? {};
    send(200, { round, players: Object.keys(players), picks: players[url.searchParams.get('me') ?? ''] ?? {} });
    return;
  }

  if (url.pathname === '/api/pick' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const { seed, me, bookId, coverId } = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, string>;
    if (!seed || !me || !bookId || !coverId) return send(400, { error: 'incomplete' });
    rounds[seed] ??= {};
    rounds[seed][me] ??= {};
    rounds[seed][me][bookId] = coverId;
    save();
    send(200, { ok: true });
    return;
  }

  if (url.pathname === '/api/compare') {
    const seed = url.searchParams.get('seed') ?? '';
    const round = buildRound(seed, POOL, { books: 10, choices: 6 });
    const players = Object.keys(rounds[seed] ?? {});
    if (players.length < 2) return send(200, { players, ready: false });
    const [a, b] = players;
    send(200, {
      players, ready: true,
      a, b,
      picksA: rounds[seed][a], picksB: rounds[seed][b],
      agreement: compare(round, rounds[seed][a], rounds[seed][b]),
      books: round.books,
    });
    return;
  }

  send(404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`duel: ${POOL.length} books in the pool`);
  console.log(`open http://localhost:${PORT}/?seed=paperwhite&me=julian`);
});
