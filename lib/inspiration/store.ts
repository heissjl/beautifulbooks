/**
 * Short links for a finished board (ROADMAP 5.18b; server only).
 *
 * Julian, 2026-10-04: „i'm thinking we should set up a second redis for it".
 * So the links have a store of their own, found under the prefix `LINKS_`
 * exactly as the game's is found under `STORAGE_` (`storeConfig`): a wave of
 * boards must not fill the Redis the collections and the game live in.
 *
 * One key per id, written once and never changed, with no expiry — a link is
 * a bookmark. **No owner, no visitor id (N11):** the record is the board's
 * own query string and the day it was first shared, nothing about who shared
 * it beyond the name they chose to put on the picture.
 *
 * **Without a store there is still a link.** The board fits in an address, so
 * a deployment that has no `LINKS_` variables hands out the long form
 * (`/inspiration/board?b=…`) instead of failing — which is how a preview
 * works before the second Redis exists.
 */
import { commandsFromEnv, type RedisCommands } from '../hotornot/store';
import { type Board, boardQuery, filledCount, parseBoard } from './board';
import { ID, shortId } from './shortid';

export const LINKS_PREFIX = 'LINKS_';

export interface LinkStore {
  /** Returns the id; a board already stored is not written again. */
  put(board: Board): Promise<string>;
  /** Null when the id is not on record. Throws when the store does not answer (N12). */
  get(id: string): Promise<Board | null>;
}

/** A board as the store keeps it: its query string, which `parseBoard` reads back. */
interface Stored { q: string; at: string }

const key = (id: string) => `insp:link:${id}`;

function read(raw: unknown): Board | null {
  if (typeof raw !== 'string') return null;
  try {
    const stored = JSON.parse(raw) as Partial<Stored>;
    if (typeof stored.q !== 'string') return null;
    const board = parseBoard(new URLSearchParams(stored.q));
    return filledCount(board) > 0 ? board : null;
  } catch {
    return null;
  }
}

export function commandsLinkStore(commands: Pick<RedisCommands, 'get' | 'set'>, now: () => Date = () => new Date()): LinkStore {
  return {
    async put(board) {
      if (filledCount(board) === 0) throw new Error('An empty board gets no link.');
      const id = shortId(board);
      // The id is the hash of the content, so two writers racing here write the same value.
      if (!read(await commands.get(key(id)))) {
        await commands.set(key(id), JSON.stringify({ q: boardQuery(board), at: now().toISOString().slice(0, 10) } satisfies Stored));
      }
      return id;
    },
    async get(id) {
      return ID.test(id) ? read(await commands.get(key(id))) : null;
    },
  };
}

export function memoryLinkStore(): LinkStore {
  const kept = new Map<string, string>();
  return commandsLinkStore({
    get: async k => kept.get(k) ?? null,
    set: async (k, v) => { kept.set(k, v); return 'OK'; },
  });
}

// On `globalThis`: `next dev` gives API routes and pages separate copies of a module (lib/hotornot/store.ts).
const shared = globalThis as typeof globalThis & { __inspirationDevLinks?: LinkStore };

/**
 * The link store this deployment has: the Redis behind `LINKS_…`, memory
 * under `next dev`, and none in a production build without the variables —
 * the caller then hands out the long address.
 */
export function linkStoreFromEnv(env: Record<string, string | undefined> = process.env): LinkStore | null {
  const commands = commandsFromEnv(env, LINKS_PREFIX);
  if (commands) return commandsLinkStore(commands);
  if (env.NODE_ENV === 'production') return null;
  shared.__inspirationDevLinks ??= memoryLinkStore();
  return shared.__inspirationDevLinks;
}
