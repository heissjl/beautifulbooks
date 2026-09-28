/**
 * A reader's own cover wall, saved without an account (lab/walls, ROADMAP 5.13).
 *
 * Pure: no network, no file system, no clock except where a date is passed in.
 * The server in `serve.ts` holds walls in a file; the website, if this is ever
 * promoted, would hold them in the cover game's Redis (SPEC F7.3).
 *
 * **How a wall is kept without a login** — the taketest.xyz idea, turned
 * round. taketest gives every *visitor* an id in a cookie and shows it in the
 * footer so it can be pasted on another device. That id describes a person,
 * which N11 forbids here. So the secret belongs to the *wall*, not to whoever
 * made it:
 *
 * - every wall has a public id (the view link) and a random edit key;
 * - the server keeps only the SHA-256 of the key, so a leaked store edits
 *   nothing;
 * - the browser keeps `{ id, key }` for the walls it made, in localStorage;
 * - the edit link carries the key in the **fragment** (`/w/<id>#k=<key>`),
 *   which a browser never sends to a server, a log or a referrer;
 * - the key ring (`encodeKeyRing`) is taketest's footer field: one string,
 *   shown on the page, that brings every wall of this browser to another one.
 *
 * Nothing about the reader is stored: no IP, no cookie, no user agent. A
 * wall is a title, a column count and a list of covers.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** One framed cover. Carries enough to buy the book later (stage 2 of the plan). */
export interface Tile {
  workId: string;
  /** Open Library cover id as a string, e.g. `"8231856"`. */
  coverId: string;
  title: string;
  author?: string;
  /**
   * Printings that carried this cover at Open Library, newest first, at most
   * MAX_PRINTINGS. The ISBN names a printing, not the picture (E8): the shop
   * search in stage 2 starts here and must still compare photos.
   */
  printings: Printing[];
}

export interface Printing {
  isbn13?: string;
  isbn10?: string;
  publisher?: string;
  year?: number;
}

export interface Wall {
  id: string;
  /** SHA-256 of the edit key, hex. Never sent to a browser. */
  keyHash: string;
  title: string;
  /** Columns of the frame grid, 1–8. The physical wall is planned from this. */
  columns: number;
  tiles: Tile[];
  createdOn: string;
  updatedAt: string;
}

/** What a view link returns: the wall without its key hash. */
export type PublicWall = Omit<Wall, 'keyHash'>;

export const MAX_TILES = 60;
export const MAX_TITLE = 80;
export const MAX_PRINTINGS = 5;
export const DEFAULT_COLUMNS = 4;

const ID = /^[a-z0-9]{10}$/;
const KEY = /^[A-Za-z0-9_-]{22}$/;
const WORK = /^OL\d+W$/;
const COVER = /^\d{1,12}$/;

export const isWallId = (s: unknown): s is string => typeof s === 'string' && ID.test(s);
export const isEditKey = (s: unknown): s is string => typeof s === 'string' && KEY.test(s);

/** Ten characters from a 36-letter alphabet: ~51 bits, enough that ids are not guessed in sequence. */
export function newWallId(bytes: Buffer = randomBytes(10)): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return [...bytes].map((b) => alphabet[b % 36]).join('');
}

/** 128 random bits, base64url: the only thing that lets someone change a wall. */
export function newEditKey(bytes: Buffer = randomBytes(16)): string {
  return bytes.toString('base64url');
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Constant-time check of a presented key against a stored hash. */
export function keyOpens(wall: Pick<Wall, 'keyHash'>, key: unknown): boolean {
  if (!isEditKey(key)) return false;
  const a = Buffer.from(hashKey(key), 'hex');
  const b = Buffer.from(wall.keyHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newWall(id: string, key: string, title: string, today: string): Wall {
  return {
    id,
    keyHash: hashKey(key),
    title: cleanTitle(title) || 'Untitled wall',
    columns: DEFAULT_COLUMNS,
    tiles: [],
    createdOn: today,
    updatedAt: today,
  };
}

export function toPublic(wall: Wall): PublicWall {
  return { id: wall.id, title: wall.title, columns: wall.columns, tiles: wall.tiles, createdOn: wall.createdOn, updatedAt: wall.updatedAt };
}

function cleanTitle(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE) : '';
}

/**
 * One change to a wall. The browser sends operations, not whole walls, so two
 * tabs editing the same wall lose at most the step that raced — the same rule
 * as the friends' drafts (lib/curate/drafts.ts).
 */
export type WallOp =
  | { op: 'add'; tile: Tile }
  | { op: 'remove'; coverId: string }
  | { op: 'move'; coverId: string; to: number }
  | { op: 'title'; title: string }
  | { op: 'columns'; columns: number };

export class WallError extends Error {}

export function applyOp(wall: Wall, op: WallOp, now: string): Wall {
  const next = { ...wall, tiles: [...wall.tiles], updatedAt: now };
  switch (op.op) {
    case 'add': {
      const tile = validTile(op.tile);
      if (next.tiles.some((t) => t.coverId === tile.coverId)) return wall;
      if (next.tiles.length >= MAX_TILES) throw new WallError(`A wall holds at most ${MAX_TILES} covers.`);
      next.tiles.push(tile);
      return next;
    }
    case 'remove':
      next.tiles = next.tiles.filter((t) => t.coverId !== op.coverId);
      return next;
    case 'move': {
      const from = next.tiles.findIndex((t) => t.coverId === op.coverId);
      if (from < 0) return wall;
      const [tile] = next.tiles.splice(from, 1);
      const to = Math.max(0, Math.min(next.tiles.length, Math.floor(op.to)));
      next.tiles.splice(to, 0, tile);
      return next;
    }
    case 'title':
      next.title = cleanTitle(op.title) || wall.title;
      return next;
    case 'columns':
      if (!Number.isFinite(op.columns)) throw new WallError('Columns must be a number.');
      next.columns = Math.max(1, Math.min(8, Math.round(op.columns)));
      return next;
    default:
      throw new WallError('Unknown operation.');
  }
}

/** Accepts a tile from the browser only in the shape the server would have built. */
export function validTile(raw: unknown): Tile {
  const t = raw as Partial<Tile> | null;
  if (!t || typeof t !== 'object') throw new WallError('No tile.');
  if (typeof t.workId !== 'string' || !WORK.test(t.workId)) throw new WallError('Bad work id.');
  if (typeof t.coverId !== 'string' || !COVER.test(t.coverId)) throw new WallError('Bad cover id.');
  if (typeof t.title !== 'string' || !t.title.trim()) throw new WallError('A tile needs a title.');
  const printings = Array.isArray(t.printings) ? t.printings.slice(0, MAX_PRINTINGS).map(validPrinting) : [];
  return {
    workId: t.workId,
    coverId: t.coverId,
    title: t.title.trim().slice(0, 200),
    ...(typeof t.author === 'string' && t.author.trim() ? { author: t.author.trim().slice(0, 120) } : {}),
    printings,
  };
}

function validPrinting(raw: unknown): Printing {
  const p = (raw ?? {}) as Partial<Printing>;
  const out: Printing = {};
  if (typeof p.isbn13 === 'string' && /^97[89]\d{10}$/.test(p.isbn13)) out.isbn13 = p.isbn13;
  if (typeof p.isbn10 === 'string' && /^\d{9}[\dX]$/.test(p.isbn10)) out.isbn10 = p.isbn10;
  if (typeof p.publisher === 'string' && p.publisher.trim()) out.publisher = p.publisher.trim().slice(0, 120);
  if (typeof p.year === 'number' && p.year > 1400 && p.year < 2100) out.year = p.year;
  return out;
}

/** An entry of the key ring: a wall this browser may edit. */
export interface KeyRingEntry {
  id: string;
  key: string;
}

const RING_PREFIX = 'bbw1.';

/**
 * The key ring as one pasteable string (taketest's footer field). Versioned by
 * prefix so a later format can still read this one. Not encrypted: it *is*
 * the secret, and the page says so.
 */
export function encodeKeyRing(entries: readonly KeyRingEntry[]): string {
  const valid = entries.filter((e) => isWallId(e.id) && isEditKey(e.key));
  return RING_PREFIX + valid.map((e) => `${e.id}.${e.key}`).join('~');
}

/** Reads a key ring; unknown or broken parts are dropped, never guessed. */
export function decodeKeyRing(text: string): KeyRingEntry[] {
  const s = text.trim();
  if (!s.startsWith(RING_PREFIX)) return [];
  const seen = new Set<string>();
  const out: KeyRingEntry[] = [];
  for (const part of s.slice(RING_PREFIX.length).split('~')) {
    const dot = part.indexOf('.');
    const id = part.slice(0, dot);
    const key = part.slice(dot + 1);
    if (dot < 0 || !isWallId(id) || !isEditKey(key) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, key });
  }
  return out;
}

/** Merges two rings; the incoming key wins for a wall both know. */
export function mergeKeyRings(mine: readonly KeyRingEntry[], incoming: readonly KeyRingEntry[]): KeyRingEntry[] {
  const byId = new Map(mine.map((e) => [e.id, e]));
  for (const e of incoming) byId.set(e.id, e);
  return [...byId.values()];
}

/**
 * The shopping list for stage 2: one line per tile, with every ISBN known to
 * have carried the cover. Plain text, because the first buyer is a person
 * (Julian) with a spreadsheet, not an agent.
 */
export function shoppingList(wall: PublicWall): string {
  const lines = wall.tiles.map((t, i) => {
    const isbns = t.printings.map((p) => p.isbn13 ?? p.isbn10).filter(Boolean);
    const facts = t.printings[0] ? [t.printings[0].publisher, t.printings[0].year].filter(Boolean).join(' ') : '';
    return [`${i + 1}.`, t.title, t.author ? `— ${t.author}` : '', facts ? `(${facts})` : '', isbns.length ? `ISBN ${isbns.join(' / ')}` : 'no ISBN on record', `cover ${t.coverId}`]
      .filter(Boolean)
      .join(' ');
  });
  return [`${wall.title} — ${wall.tiles.length} covers, ${wall.columns} columns`, ...lines].join('\n');
}
