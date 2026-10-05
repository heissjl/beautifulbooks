/**
 * Short links for a finished board (ROADMAP 5.18b; server only).
 *
 * **Where they live.** Julian, 2026-10-04: „i'm thinking we should set up a
 * second redis for it" — a wave of boards must not fill the Redis the
 * collections and the game live in. On 2026-10-05, with that store about to
 * get its paid plan (250 MB, persistence): „was spricht dann dagegen das auch
 * für die kurzlinks zu benutzen?" — little, and he said yes. So the links go
 * into **the site's own store** (`STORAGE_`), under keys of their own
 * (`insp:link:<id>`), and what the second store was for is done by a **cap**:
 * past `LINK_CAP` links no new one is written and the reader is handed the
 * long address, as on a deployment without any store. A store under the
 * prefix `LINKS_` still wins where one is set, so the links can move out
 * again without a change here.
 *
 * One key per id, written once and never changed, with no expiry — a link is
 * a bookmark. **No owner, no visitor id (N11):** the record is the board's
 * own query string and the day it was first shared, nothing about who shared
 * it beyond the name they chose to put on the picture.
 *
 * **Without a store there is still a link.** The board fits in an address, so
 * a deployment without a store, a store that is full or one that does not
 * answer hands out the long form (`/shelfportrait/board?b=…`) instead of
 * failing.
 */
import { commandsFromEnv, type RedisCommands } from '../hotornot/store';
import { type Board, boardQuery, filledCount, parseBoard } from './board';
import { ID, shortId } from './shortid';

export const LINKS_PREFIX = 'LINKS_';

/**
 * How many links the store takes. A link is some 300 bytes with Redis's own
 * bookkeeping, so 50,000 are about 15 MB: half of the 30 MB the store has on
 * its free plan, a sixteenth of the 250 MB it is to get. Raise it with
 * `LINKS_CAP` once the plan has changed; the count lives in the store.
 */
export const LINK_CAP = 50_000;

/** Thrown by `put` at the cap. The link route answers with the long address. */
export class LinkStoreFull extends Error {}

export interface LinkStore {
  /** Returns the id; a board already stored is not written again. */
  put(board: Board): Promise<string>;
  /** Null when the id is not on record. Throws when the store does not answer (N12). */
  get(id: string): Promise<Board | null>;
}

/** A board as the store keeps it: its query string, which `parseBoard` reads back. */
interface Stored { q: string; at: string }

const key = (id: string) => `insp:link:${id}`;
/** One hash, one field: how many links were written. Counted, never listed — a scan of the store would cost more than it tells. */
const COUNT = 'insp:links';

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

export function commandsLinkStore(commands: Pick<RedisCommands, 'get' | 'set' | 'hIncrBy'>, now: () => Date = () => new Date(), cap: number = LINK_CAP): LinkStore {
  return {
    async put(board) {
      if (filledCount(board) === 0) throw new Error('An empty board gets no link.');
      const id = shortId(board);
      // The id is the hash of the content, so two writers racing here write the same value.
      if (!read(await commands.get(key(id)))) {
        // Counted before it is written: a store that cannot count (a test double without HINCRBY) has no cap.
        if (commands.hIncrBy && Number(await commands.hIncrBy(COUNT, 'count', 1)) > cap) {
          await commands.hIncrBy(COUNT, 'count', -1);
          throw new LinkStoreFull(`The link store holds its ${cap} links.`);
        }
        await commands.set(key(id), JSON.stringify({ q: boardQuery(board), at: now().toISOString().slice(0, 10) } satisfies Stored));
      }
      return id;
    },
    async get(id) {
      return ID.test(id) ? read(await commands.get(key(id))) : null;
    },
  };
}

export function memoryLinkStore(cap: number = LINK_CAP): LinkStore {
  const kept = new Map<string, string>();
  let count = 0;
  return commandsLinkStore({
    get: async k => kept.get(k) ?? null,
    set: async (k, v) => { kept.set(k, v); return 'OK'; },
    hIncrBy: async (_k, _f, by) => (count += by),
  }, undefined, cap);
}

// On `globalThis`: `next dev` gives API routes and pages separate copies of a module (lib/hotornot/store.ts).
const shared = globalThis as typeof globalThis & { __inspirationDevLinks?: LinkStore };

/**
 * The link store this deployment has: a Redis of its own behind `LINKS_…`
 * where one is set, otherwise the site's store, memory under `next dev`, and
 * none in a production build without either — the caller then hands out the
 * long address.
 */
export function linkStoreFromEnv(env: Record<string, string | undefined> = process.env): LinkStore | null {
  const commands = commandsFromEnv(env, LINKS_PREFIX) ?? commandsFromEnv(env);
  const asked = Number(env.LINKS_CAP);
  const cap = Number.isInteger(asked) && asked > 0 ? asked : LINK_CAP;
  if (commands) return commandsLinkStore(commands, undefined, cap);
  if (env.NODE_ENV === 'production') return null;
  shared.__inspirationDevLinks ??= memoryLinkStore(cap);
  return shared.__inspirationDevLinks;
}
