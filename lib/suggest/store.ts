/**
 * Where friends' suggestions for collections wait for Julian (ROADMAP 5.10a,
 * SPEC F8.4). Server only.
 *
 * The same Redis as the cover game (`lib/hotornot/store.ts`), under its own
 * keys: a list of suggestions and a hash of decisions. A suggestion is a
 * proposal, never a change — the website's collections come from
 * `data/collections.json`, which only Julian's local tool writes, so nothing
 * a friend submits reaches a page without him taking it over by hand.
 *
 * What is stored is what the friend typed and chose: the collection (or an
 * idea for a new one), a book, a cover, a note and, only if they give one, a
 * name. No IP, no user agent, no session id (N11).
 */
import { randomBytes } from 'node:crypto';
import { commandsFromEnv, type RedisCommands } from '@/lib/hotornot/store';

export interface Suggestion {
  id: string;
  /** YYYY-MM-DD, as for votes: a day, not a moment. */
  on: string;
  /** Slug of an existing collection, or null for an idea for a new one. */
  collection: string | null;
  /** Title of a proposed new collection; set when `collection` is null. */
  newCollection?: string;
  work: { id: string; title: string; author: string; coverId: string };
  note?: string;
  by?: string;
}

export type Decision = 'taken' | 'declined';

export interface SuggestStore {
  readonly kind: 'memory' | 'redis';
  add(s: Suggestion): Promise<void>;
  list(): Promise<Suggestion[]>;
  decisions(): Promise<Record<string, Decision>>;
  /** Keeps the first decision; a second click changes nothing. */
  decide(id: string, decision: Decision): Promise<void>;
}

const KEYS = { list: 'suggest:items', decisions: 'suggest:decisions' };

export const LIMITS = { note: 500, by: 60, title: 200, newCollection: 120 };

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/**
 * A suggestion from a request body, or the reason it is not one. Every field
 * is checked and clipped here, because the body comes from a browser and the
 * local tool renders it.
 */
export function parseSuggestion(body: Record<string, unknown>, knownSlugs: string[], now = new Date()): Suggestion | string {
  const work = (body.work ?? {}) as Record<string, unknown>;
  const id = clip(work.id, 20);
  const coverId = clip(work.coverId, 30);
  if (!/^OL\d+W$/.test(id)) return 'Pick a book first.';
  if (!/^ol:\d+$/.test(coverId)) return 'Pick a cover first.';
  const title = clip(work.title, LIMITS.title);
  if (!title) return 'The book has no title.';
  const slug = clip(body.collection, 80);
  const newCollection = clip(body.newCollection, LIMITS.newCollection);
  if (slug && !knownSlugs.includes(slug)) return 'That collection does not exist.';
  if (!slug && !newCollection) return 'Choose a collection, or name a new one.';
  const note = clip(body.note, LIMITS.note);
  const by = clip(body.by, LIMITS.by);
  return {
    id: randomBytes(6).toString('base64url'),
    on: now.toISOString().slice(0, 10),
    collection: slug || null,
    ...(slug ? {} : { newCollection }),
    work: { id, title, author: clip(work.author, LIMITS.title), coverId },
    ...(note ? { note } : {}),
    ...(by ? { by } : {}),
  };
}

function parseStored(raw: unknown): Suggestion | null {
  if (typeof raw !== 'string') return null;
  try {
    const s = JSON.parse(raw) as Suggestion;
    return typeof s.id === 'string' && s.work && typeof s.work.id === 'string' ? s : null;
  } catch {
    return null;
  }
}

export function memorySuggestStore(): SuggestStore {
  const items: Suggestion[] = [];
  const decided: Record<string, Decision> = {};
  return {
    kind: 'memory',
    async add(s) { items.push(s); },
    async list() { return [...items]; },
    async decisions() { return { ...decided }; },
    async decide(id, decision) { decided[id] ??= decision; },
  };
}

export function commandsSuggestStore(commands: RedisCommands): SuggestStore {
  return {
    kind: 'redis',
    async add(s) { await commands.rPush(KEYS.list, JSON.stringify(s)); },
    async list() {
      const raw = await commands.lRange(KEYS.list, 0, -1);
      return Array.isArray(raw) ? raw.map(parseStored).filter((s): s is Suggestion => s !== null) : [];
    },
    async decisions() {
      const raw = await commands.hGetAll(KEYS.decisions);
      const entries = raw instanceof Map ? [...raw.entries()] : Object.entries((raw ?? {}) as Record<string, unknown>);
      const out: Record<string, Decision> = {};
      for (const [id, value] of entries) out[String(id)] = String(value) === 'declined' ? 'declined' : 'taken';
      return out;
    },
    async decide(id, decision) { await commands.hSetNX(KEYS.decisions, id, decision); },
  };
}

/** On `globalThis` for the reason given in `lib/hotornot/store.ts`: `next dev` splits modules. */
const shared = globalThis as typeof globalThis & { __suggestDevMemory?: SuggestStore };

/** Redis when configured; memory under `next dev`; nothing in a production build without it. */
export function suggestStoreFromEnv(env: Record<string, string | undefined> = process.env): SuggestStore | null {
  const commands = commandsFromEnv(env);
  if (commands) return commandsSuggestStore(commands);
  if (env.NODE_ENV === 'production') return null;
  shared.__suggestDevMemory ??= memorySuggestStore();
  return shared.__suggestDevMemory;
}
