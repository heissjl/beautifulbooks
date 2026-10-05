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
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { type Board, boardQuery, filledCount, parseBoard } from './board';

export const ID = /^[a-z2-7]{8}$/;

/** RFC 4648 base 32, lower case: readable aloud, no 0/O or 1/l confusion. */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

export function shortId(board: Board): string {
  const digest = createHash('sha256').update(boardQuery(board)).digest();
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of digest) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < 8) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    if (out.length === 8) break;
  }
  return out;
}

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
