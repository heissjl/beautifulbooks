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
const CONTENT_KEY = 'collections:content';
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

const shared = globalThis as typeof globalThis & { __publishDevMemory?: PublishOverrides; __contentDevMemory?: ContentOverrides; __orderDevMemory?: string[] };

export function publishStoreFromEnv(env: Record<string, string | undefined> = process.env): PublishStore | null {
  const commands = commandsFromEnv(env);
  if (commands) return commandsPublishStore(commands);
  if (env.NODE_ENV === 'production') return null;
  return {
    async get() { return { ...(shared.__publishDevMemory ?? {}) }; },
    async set(o) { shared.__publishDevMemory = { ...o }; },
    async getContent() { return structuredClone(shared.__contentDevMemory ?? {}); },
    async setContent(c) { shared.__contentDevMemory = structuredClone(c); },
    async getOrder() { return [...(shared.__orderDevMemory ?? [])]; },
    async setOrder(o) { shared.__orderDevMemory = [...o]; },
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

export async function contentOverrides(): Promise<ContentOverrides> {
  const store = publishStoreFromEnv();
  return store ? withTimeout(store.getContent(), 2000, {}) : {};
}

/** The records as the site uses them: the file, published drafts on top, then the switches. */
export async function collectionOrder(): Promise<string[]> {
  const store = publishStoreFromEnv();
  return store ? withTimeout(store.getOrder(), 2000, []) : [];
}

export async function liveRecords(): Promise<CollectionRecord[]> {
  const [content, switches, order] = await Promise.all([contentOverrides(), publishOverrides(), collectionOrder()]);
  return applyOrder(applyOverrides(applyContent(collectionRecords(), content), switches), order);
}

/** Every collection the site shows now, drafts included only when asked (or under `next dev`). */
export async function liveCollections({ includeDrafts = draftsVisible() }: { includeDrafts?: boolean } = {}): Promise<Collection[]> {
  return parseCollections(await liveRecords(), { includeDrafts });
}

export async function liveCollectionBySlug(slug: string, options: { includeDrafts?: boolean } = {}): Promise<Collection | null> {
  return (await liveCollections(options)).find(c => c.slug === slug) ?? null;
}
