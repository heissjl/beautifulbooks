/**
 * Friends' collection drafts from the online curation tool (ROADMAP 5.10b,
 * SPEC F8.5). Server only.
 *
 * A draft is a whole collection as `data/collections.json` holds one —
 * title, paragraph, authors or publishers, works with their covers, in
 * order — plus who started it, if they said. It lives in the cover game's
 * Redis (`curate:drafts` lists the ids, `curate:draft:<id>` holds each one)
 * and **never reaches a page by itself**: Julian's local tool reads the drafts
 * and takes one into the file by hand. So a friend may put any author on a
 * draft; Julian's rule that nobody joins a published collection without his
 * OK (SPEC F8.2) is kept at the import.
 *
 * Every change is one small operation applied to the stored draft on the
 * server, not a whole draft sent from the browser: two friends working on
 * the same draft then lose at most the one step that raced, never each
 * other's work.
 */
import { randomBytes } from 'node:crypto';
import { commandsFromEnv, type RedisCommands } from '@/lib/hotornot/store';
import {
  addAuthor,
  removeAuthor,
  removePick,
  reorder,
  slugify,
  upsertPick,
} from '../collectionedit';
import type { CollectionKind, CollectionRecord } from '../collections';

export interface Draft extends CollectionRecord {
  id: string;
  /** A name the friend chose to give, nothing else about them (N11). */
  by?: string;
  /** Slug of the published collection this draft started from, if any. */
  basedOn?: string;
  createdOn: string;
  updatedAt: string;
  /** Set by Julian's tool once the draft has been taken into the file. */
  importedOn?: string;
  deleted?: boolean;
}

export interface DraftStore {
  readonly kind: 'memory' | 'redis';
  ids(): Promise<string[]>;
  get(id: string): Promise<Draft | null>;
  put(draft: Draft): Promise<void>;
  /** Appends an id to the list; call once, when a draft is created. */
  register(id: string): Promise<void>;
}

export const DRAFT_LIMITS = { title: 120, intro: 1200, by: 60, works: 120, authors: 40, publishers: 10 };

const KEYS = { ids: 'curate:drafts', draft: (id: string) => `curate:draft:${id}` };

export function isDraftId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,16}$/.test(value);
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/[ \t]+/g, ' ').trim().slice(0, max) : '';
}

export function newDraft(
  input: { title?: unknown; kind?: unknown; intro?: unknown; by?: unknown },
  now = new Date(),
  from?: CollectionRecord,
): Draft {
  const title = clip(input.title, DRAFT_LIMITS.title) || from?.title || '';
  if (!title) throw new Error('A title is needed.');
  const kind: CollectionKind = from?.kind ?? (input.kind === 'series' ? 'series' : 'authors');
  const by = clip(input.by, DRAFT_LIMITS.by);
  const stamp = now.toISOString();
  return {
    id: randomBytes(9).toString('base64url'),
    slug: from?.slug ?? (slugify(title) || 'collection'),
    title,
    kind,
    intro: clip(input.intro, DRAFT_LIMITS.intro) || from?.intro || '',
    published: false,
    ...(kind === 'series' ? { publishers: [...(from?.publishers ?? [])] } : { authors: (from?.authors ?? []).map(a => ({ ...a, keys: [...a.keys] })) }),
    works: (from?.works ?? []).map(w => ({ ...w })),
    ...(by ? { by } : {}),
    ...(from ? { basedOn: from.slug } : {}),
    createdOn: stamp.slice(0, 10),
    updatedAt: stamp,
  };
}

/** One change to a draft, as the browser sends it. */
export type DraftOp =
  | { op: 'meta'; title?: string; intro?: string; by?: string }
  | { op: 'addAuthor'; name: string; key: string }
  | { op: 'removeAuthor'; name: string }
  | { op: 'addPublisher'; name: string }
  | { op: 'removePublisher'; name: string }
  | { op: 'pick'; id: string; title: string; author: string; coverId: string; firstPublished?: number }
  | { op: 'remove'; id: string }
  | { op: 'order'; ids: string[] }
  | { op: 'delete' };

/**
 * Applies one operation, or throws with a sentence a friend can act on.
 * Everything from the browser is checked and clipped here, because Julian's
 * tool renders it later.
 */
export function applyOp(draft: Draft, raw: Record<string, unknown>, now = new Date()): Draft {
  const stamp = { updatedAt: now.toISOString() };
  switch (raw.op) {
    case 'meta': {
      const next = { ...draft, ...stamp };
      if (raw.title !== undefined) {
        const title = clip(raw.title, DRAFT_LIMITS.title);
        if (!title) throw new Error('A title is needed.');
        next.title = title;
        if (!draft.basedOn) next.slug = slugify(title) || draft.slug;
      }
      if (raw.intro !== undefined) next.intro = clip(raw.intro, DRAFT_LIMITS.intro);
      if (raw.by !== undefined) {
        const by = clip(raw.by, DRAFT_LIMITS.by);
        if (by) next.by = by;
        else delete next.by;
      }
      return next;
    }
    case 'addAuthor': {
      if (draft.kind !== 'authors') throw new Error('This collection is a series; add a publisher instead.');
      const key = clip(raw.key, 20).replace('/authors/', '');
      if (!/^OL\d+A$/.test(key)) throw new Error('That is not an Open Library author.');
      const name = clip(raw.name, 120).normalize('NFC');
      const known = (draft.authors ?? []).some(a => a.name === name);
      if (!known && (draft.authors ?? []).length >= DRAFT_LIMITS.authors) throw new Error(`At most ${DRAFT_LIMITS.authors} authors.`);
      return { ...addAuthor(draft, { name, keys: [key] }), ...stamp } as Draft;
    }
    case 'removeAuthor':
      return { ...removeAuthor(draft, clip(raw.name, 120)), ...stamp } as Draft;
    case 'addPublisher': {
      if (draft.kind !== 'series') throw new Error('This collection is by authors; add an author instead.');
      const name = clip(raw.name, 120);
      if (!name) throw new Error('A publisher name is needed.');
      const list = draft.publishers ?? [];
      if (list.includes(name)) return draft;
      if (list.length >= DRAFT_LIMITS.publishers) throw new Error(`At most ${DRAFT_LIMITS.publishers} spellings.`);
      return { ...draft, publishers: [...list, name], ...stamp };
    }
    case 'removePublisher':
      return { ...draft, publishers: (draft.publishers ?? []).filter(p => p !== raw.name), ...stamp };
    case 'pick': {
      const id = clip(raw.id, 20);
      const coverId = clip(raw.coverId, 30);
      const title = clip(raw.title, 200);
      if (!/^OL\d+W$/.test(id) || !/^ol:\d+$/.test(coverId) || !title) throw new Error('A book and a cover are needed.');
      if (!draft.works.some(w => w.id === id) && draft.works.length >= DRAFT_LIMITS.works) throw new Error(`At most ${DRAFT_LIMITS.works} books.`);
      const year = Number(raw.firstPublished);
      return {
        ...upsertPick(draft, {
          id,
          title,
          author: clip(raw.author, 200).normalize('NFC'),
          coverId,
          ...(Number.isInteger(year) && year > 0 ? { firstPublished: year } : {}),
          addedAt: now.toISOString().slice(0, 10),
        }),
        ...stamp,
      } as Draft;
    }
    case 'remove':
      return { ...removePick(draft, clip(raw.id, 20)), ...stamp } as Draft;
    case 'order':
      if (!Array.isArray(raw.ids)) throw new Error('No order given.');
      return { ...reorder(draft, raw.ids.filter((x): x is string => typeof x === 'string')), ...stamp } as Draft;
    case 'delete':
      return { ...draft, deleted: true, ...stamp };
    default:
      throw new Error('Unknown change.');
  }
}

/** A draft as Julian's tool writes it into `data/collections.json`: the collection fields only. */
export function toRecord(d: Draft): CollectionRecord {
  return {
    slug: d.slug,
    title: d.title,
    kind: d.kind,
    intro: d.intro,
    published: false,
    ...(d.kind === 'series' ? { publishers: d.publishers ?? [] } : { authors: d.authors ?? [] }),
    works: d.works,
  };
}

function parseDraft(raw: unknown): Draft | null {
  if (typeof raw !== 'string') return null;
  try {
    const d = JSON.parse(raw) as Draft;
    return typeof d.id === 'string' && Array.isArray(d.works) ? d : null;
  } catch {
    return null;
  }
}

export function memoryDraftStore(): DraftStore {
  const ids: string[] = [];
  const drafts = new Map<string, Draft>();
  return {
    kind: 'memory',
    async ids() { return [...ids]; },
    async get(id) { const d = drafts.get(id); return d ? structuredClone(d) : null; },
    async put(d) { drafts.set(d.id, structuredClone(d)); },
    async register(id) { if (!ids.includes(id)) ids.push(id); },
  };
}

export function commandsDraftStore(commands: RedisCommands): DraftStore {
  return {
    kind: 'redis',
    async ids() {
      const raw = await commands.lRange(KEYS.ids, 0, -1);
      return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string'))] : [];
    },
    async get(id) { return parseDraft(await commands.get(KEYS.draft(id))); },
    async put(d) { await commands.set(KEYS.draft(d.id), JSON.stringify(d)); },
    async register(id) { await commands.rPush(KEYS.ids, id); },
  };
}

/** Every draft that is not deleted, newest change first. */
export async function listDrafts(store: DraftStore): Promise<Draft[]> {
  const all = await Promise.all((await store.ids()).map(id => store.get(id)));
  return all
    .filter((d): d is Draft => d !== null && !d.deleted)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const shared = globalThis as typeof globalThis & { __curateDevMemory?: DraftStore };

/** Redis when configured; memory under `next dev`; nothing in a production build without it. */
export function draftStoreFromEnv(env: Record<string, string | undefined> = process.env): DraftStore | null {
  const commands = commandsFromEnv(env);
  if (commands) return commandsDraftStore(commands);
  if (env.NODE_ENV === 'production') return null;
  shared.__curateDevMemory ??= memoryDraftStore();
  return shared.__curateDevMemory;
}
