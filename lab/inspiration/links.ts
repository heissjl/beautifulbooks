/**
 * Short links for a finished board (lab/inspiration).
 *
 * Julian, 2026-10-04: „i'm thinking we should set up a second redis for it".
 * The lab stands in for that store with a JSON file; the shape is what a
 * Redis would hold — one key per id, written once, never changed — so the
 * site's version swaps the file for `SET NX` and nothing else.
 *
 * The id is the hash of the board, not a counter: the same nine books in the
 * same order with the same name give the same link, so sharing twice makes
 * no second record, and nobody can count the boards from the ids. Eight
 * characters of base 32 are 40 bits; a collision needs about a million
 * boards, and a collision here only returns somebody else's board, which is
 * public anyway. No owner, no visitor id (N11): a short link is a bookmark,
 * not an account.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { type Board, boardQuery, filledCount, parseBoard } from '../../lib/inspiration/board';
import { ID, shortId } from '../../lib/inspiration/shortid';

export { ID, shortId };

export interface LinkStore {
  /** Returns the id; a board already stored is not written again. */
  put(board: Board): Promise<string>;
  get(id: string): Promise<Board | null>;
}

/** A board as the store keeps it: its query string, which `parseBoard` reads back. */
type Stored = { q: string; at: string };

export function fileLinkStore(file: string): LinkStore {
  const load = (): Record<string, Stored> =>
    existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, Stored>) : {};
  return {
    async put(board) {
      if (filledCount(board) === 0) throw new Error('An empty board gets no link.');
      const id = shortId(board);
      const all = load();
      if (!all[id]) {
        all[id] = { q: boardQuery(board), at: new Date().toISOString() };
        writeFileSync(`${file}.tmp`, JSON.stringify(all, null, 2));
        renameSync(`${file}.tmp`, file);
      }
      return id;
    },
    async get(id) {
      if (!ID.test(id)) return null;
      const hit = load()[id];
      return hit ? parseBoard(new URLSearchParams(hit.q)) : null;
    },
  };
}
