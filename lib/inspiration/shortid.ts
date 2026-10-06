/**
 * The short id of a finished board (ROADMAP 5.18; server only — `node:crypto`).
 *
 * The id is the hash of the board, not a counter: the same nine books in the
 * same order with the same name give the same link, so sharing twice makes
 * no second record, and nobody can count the boards from the ids. Eight
 * characters of base 32 are 40 bits; a collision needs about a million
 * boards, and a collision only returns somebody else's board, which is
 * public anyway.
 */
import { createHash } from 'node:crypto';
import { type Board, boardQuery } from './board';

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
