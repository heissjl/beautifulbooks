/**
 * Collections as the running site shows them (ROADMAP 5.10g): the file, with
 * publication switched from /curate applied on top. Server only.
 *
 * The switches live in the same Redis as the game and the drafts, under three
 * keys holding small JSON values. **The pages read them from memory**
 * (ROADMAP 2.18c): an instance asks the store once and keeps the answer for
 * `LIVE_TTL_MS`; the home page, `/collections` and every collection page
 * render from that for the next minute. Measured 2026-10-05 (2.18b), each of
 * them asked three `GET`s per request, one with whole collections in it. A
 * write through `publishStoreFromEnv` — publishing from /curate, taking a
 * draft into the file, arranging the order — throws the instance's copy away,
 * so Julian sees his change at once on the instance that took it and within
 * a minute on the others; his tools read fresh (`fresh: true`), never from
 * memory.
 *
 * A store that does not answer within two seconds leaves what was last read
 * in force, or the file's own `published` when nothing was read yet — the
 * site then shows what was last deployed, never an error page, and never a
 * draft (N12) — and trips the pause (`lib/storepause.ts`): for thirty seconds
 * the instance renders without asking, instead of waiting two seconds per
 * request on a store that is down.
 */
import { cache } from 'react';
import { commandsFromEnv, type RedisCommands } from './redis';
import { Pause, storePause } from './storepause';
import {
  applyContent,
  applyOrder,
  applyOverrides,
  collectionRecords,
  draftsVisible,
  parseCollections,
  type Collection,
  type CollectionRecord,
  type ContentOverrides,
  type PublishOverrides,
} from './collections';

const KEY = 'collections:published';
/** The published drafts, the one value that grows with the collections — read by the fill level too (2.18g). */
export const CONTENT_KEY = 'collections:content';
const ORDER_KEY = 'collections:order';

export interface PublishStore {
  get(): Promise<PublishOverrides>;
  set(overrides: PublishOverrides): Promise<void>;
  /** Drafts published from /curate, slug → the collection as the draft holds it. */
  getContent(): Promise<ContentOverrides>;
  setContent(content: ContentOverrides): Promise<void>;
  /** Slugs in the order Julian arranged on /curate (5.10h). */
  getOrder(): Promise<string[]>;
  setOrder(order: string[]): Promise<void>;
}

function parseOrder(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function parseContent(raw: unknown): ContentOverrides {
  if (typeof raw !== 'string') return {};
  try {
    const value = JSON.parse(raw) as Record<string, CollectionRecord>;
    return Object.fromEntries(Object.entries(value).filter(([, r]) => r && typeof r.slug === 'string' && Array.isArray(r.works)));
  } catch {
    return {};
  }
}

function parse(raw: unknown): PublishOverrides {
  if (typeof raw !== 'string') return {};
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(value).filter((e): e is [string, boolean] => typeof e[1] === 'boolean'));
  } catch {
    return {};
  }
}

export function commandsPublishStore(commands: RedisCommands): PublishStore {
  return {
    async get() { return parse(await commands.get(KEY)); },
    async set(overrides) { await commands.set(KEY, JSON.stringify(overrides)); },
    async getContent() { return parseContent(await commands.get(CONTENT_KEY)); },
    async setContent(content) { await commands.set(CONTENT_KEY, JSON.stringify(content)); },
    async getOrder() { return parseOrder(await commands.get(ORDER_KEY)); },
    async setOrder(order) { await commands.set(ORDER_KEY, JSON.stringify(order)); },
  };
}

/** How long an instance keeps what it read from the store before asking again (2.18c). */
export const LIVE_TTL_MS = 60_000;
/** How long a page waits for the store before rendering from what it has. */
export const LIVE_TIMEOUT_MS = 2000;

/** The three keys as read together. */
export interface LiveState {
  content: ContentOverrides;
  switches: PublishOverrides;
  order: string[];
}

/** What an instance remembers between requests: the records as last read, and when. */
export interface LiveMemory {
  held?: { records: CollectionRecord[]; at: number };
}

const shared = globalThis as typeof globalThis & {
  __publishDevMemory?: PublishOverrides;
  __contentDevMemory?: ContentOverrides;
  __orderDevMemory?: string[];
  __liveMemory?: LiveMemory;
};

/** This instance's memory of the live records, shared by pages and routes. */
export function liveMemory(): LiveMemory {
  return (shared.__liveMemory ??= {});
}

/** Forgets what this instance read: the next render asks the store. */
export function forgetLiveRecords(memory: LiveMemory = liveMemory()): void {
  memory.held = undefined;
}

/** Every write forgets the instance's copy (2.18c); the other instances see the change within `LIVE_TTL_MS`. */
export function forgettingPublishStore(store: PublishStore, memory: LiveMemory = liveMemory()): PublishStore {
  const forget = async (write: Promise<void>) => {
    await write;
    forgetLiveRecords(memory);
  };
  return {
    get: () => store.get(),
    getContent: () => store.getContent(),
    getOrder: () => store.getOrder(),
    set: overrides => forget(store.set(overrides)),
    setContent: content => forget(store.setContent(content)),
    setOrder: order => forget(store.setOrder(order)),
  };
}

export function publishStoreFromEnv(env: Record<string, string | undefined> = process.env): PublishStore | null {
  const commands = commandsFromEnv(env);
  if (commands) return forgettingPublishStore(commandsPublishStore(commands));
  if (env.NODE_ENV === 'production') return null;
  return forgettingPublishStore({
    async get() { return { ...(shared.__publishDevMemory ?? {}) }; },
    async set(o) { shared.__publishDevMemory = { ...o }; },
    async getContent() { return structuredClone(shared.__contentDevMemory ?? {}); },
    async setContent(c) { shared.__contentDevMemory = structuredClone(c); },
    async getOrder() { return [...(shared.__orderDevMemory ?? [])]; },
    async setOrder(o) { shared.__orderDevMemory = [...o]; },
  });
}

/**
 * The three keys in one go, or `null` when the store did not answer in time
 * or at all — a silence, which is not an empty state (N12).
 */
export async function readLiveState(store: PublishStore, timeoutMs: number = LIVE_TIMEOUT_MS): Promise<LiveState | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); });
  try {
    return await Promise.race([
      Promise.all([store.getContent(), store.get(), store.getOrder()])
        .then(([content, switches, order]): LiveState => ({ content, switches, order }))
        .catch(() => null),
      late,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The file, published drafts on top, then the switches, in Julian's order. */
export function recordsWith(state: LiveState, file: CollectionRecord[] = collectionRecords()): CollectionRecord[] {
  return applyOrder(applyOverrides(applyContent(file, state.content), state.switches), state.order);
}

export interface LiveOptions {
  memory?: LiveMemory;
  pause?: Pause;
  now?: number;
  file?: CollectionRecord[];
  timeoutMs?: number;
  /** Ask the store whatever the memory holds: Julian's tools, which must see their own change. */
  fresh?: boolean;
}

/**
 * The records as the site uses them: from memory when it is younger than
 * `LIVE_TTL_MS`, from the store otherwise, and from what was last read — or
 * the file — while the store is silent.
 */
export async function liveRecordsFrom(store: PublishStore | null, options: LiveOptions = {}): Promise<CollectionRecord[]> {
  const memory = options.memory ?? liveMemory();
  const pause = options.pause ?? storePause();
  const now = options.now ?? Date.now();
  const file = options.file ?? collectionRecords();
  if (!store) return file;
  const held = memory.held;
  if (!options.fresh) {
    if (held && now - held.at < LIVE_TTL_MS) return held.records;
    if (pause.active(now)) return held?.records ?? file;
  }
  const state = await readLiveState(store, options.timeoutMs);
  if (!state) {
    if (!options.fresh) pause.trip(now);
    return held?.records ?? file;
  }
  const records = recordsWith(state, file);
  memory.held = { records, at: now };
  return records;
}

/**
 * Once per request, however many parts of a page ask (React's `cache` keeps
 * the answer for the render it was asked in), and once per minute per
 * instance (2.18c). No caller writes and then reads in one request, so
 * nothing sees an old answer.
 */
export const liveRecords = cache(async function liveRecords(): Promise<CollectionRecord[]> {
  return liveRecordsFrom(publishStoreFromEnv());
});

/** For Julian's tools: the store as it is now, never the instance's copy. */
export async function liveRecordsFresh(): Promise<CollectionRecord[]> {
  return liveRecordsFrom(publishStoreFromEnv(), { fresh: true });
}

/** Every collection the site shows now, drafts included only when asked (or under `next dev`). */
export async function liveCollections({ includeDrafts = draftsVisible(), fresh = false }: { includeDrafts?: boolean; fresh?: boolean } = {}): Promise<Collection[]> {
  return parseCollections(await (fresh ? liveRecordsFresh() : liveRecords()), { includeDrafts });
}

export async function liveCollectionBySlug(slug: string, options: { includeDrafts?: boolean; fresh?: boolean } = {}): Promise<Collection | null> {
  return (await liveCollections(options)).find(c => c.slug === slug) ?? null;
}
