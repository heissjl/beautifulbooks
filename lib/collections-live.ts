/**
 * Collections as the running site shows them (ROADMAP 5.10g): the file, with
 * publication switched from /curate applied on top. Server only.
 *
 * The switches live in the same Redis as the game and the drafts, under one
 * key holding a small JSON object. A store that does not answer within two
 * seconds leaves the file's own `published` in force — the site then shows
 * what was last deployed, never an error page, and never a draft (N12).
 */
import { commandsFromEnv, type RedisCommands } from '@/lib/hotornot/store';
import {
  applyOverrides,
  collectionRecords,
  draftsVisible,
  parseCollections,
  type Collection,
  type PublishOverrides,
} from './collections';

const KEY = 'collections:published';

export interface PublishStore {
  get(): Promise<PublishOverrides>;
  set(overrides: PublishOverrides): Promise<void>;
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
  };
}

const shared = globalThis as typeof globalThis & { __publishDevMemory?: PublishOverrides };

export function publishStoreFromEnv(env: Record<string, string | undefined> = process.env): PublishStore | null {
  const commands = commandsFromEnv(env);
  if (commands) return commandsPublishStore(commands);
  if (env.NODE_ENV === 'production') return null;
  return {
    async get() { return { ...(shared.__publishDevMemory ?? {}) }; },
    async set(o) { shared.__publishDevMemory = { ...o }; },
  };
}

async function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), ms); });
  try {
    return await Promise.race([work.catch(() => fallback), late]);
  } finally {
    clearTimeout(timer);
  }
}

export async function publishOverrides(): Promise<PublishOverrides> {
  const store = publishStoreFromEnv();
  return store ? withTimeout(store.get(), 2000, {}) : {};
}

/** Every collection the site shows now, drafts included only when asked (or under `next dev`). */
export async function liveCollections({ includeDrafts = draftsVisible() }: { includeDrafts?: boolean } = {}): Promise<Collection[]> {
  return parseCollections(applyOverrides(collectionRecords(), await publishOverrides()), { includeDrafts });
}

export async function liveCollectionBySlug(slug: string, options: { includeDrafts?: boolean } = {}): Promise<Collection | null> {
  return (await liveCollections(options)).find(c => c.slug === slug) ?? null;
}
