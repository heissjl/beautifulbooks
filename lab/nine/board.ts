/**
 * Nine books on one board, held entirely in the address (lab/nine, pure).
 *
 * Nine slots fit in a query string, so the board needs no store, no visitor
 * id and no question of how long it is kept — the link *is* the board. Each
 * slot carries the work (for the link to its book page) and the cover the
 * reader chose (the edition they read), written the way the share address of
 * a cover already writes it (`coverPathSegment`: `ol-123`, `gb-abc`).
 *
 *   ?w=OL45804W,OL1168083W,,…&c=ol-12547191,ol-8231856,,…&by=Julian
 *
 * Parsing is tolerant: whatever a stranger types into the address bar yields
 * a board, with every slot that does not parse left empty.
 */
import { coverIdFromSegment, coverPathSegment } from '../../lib/coverurl';

export const SLOTS = 9;
export const NAME_MAX = 40;

export interface Slot {
  workId: string;
  /** `ol:<number>` or `gb:<id>`, as the rest of the site writes it. */
  coverId: string;
}

export interface Board {
  /** Always nine entries, row by row; null is an empty slot. */
  slots: (Slot | null)[];
  /** The name the reader chose to show, possibly empty. */
  by: string;
}

const WORK = /^OL\d{1,10}W$/;

export const isWorkId = (s: string): boolean => WORK.test(s);

export function emptyBoard(): Board {
  return { slots: Array.from({ length: SLOTS }, () => null), by: '' };
}

/** A name as the poster can print it: one line, no control characters, at most NAME_MAX. */
export function cleanName(raw: string): string {
  const one = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...one].slice(0, NAME_MAX).join('').trim();
}

export function parseBoard(params: URLSearchParams): Board {
  const works = (params.get('w') ?? '').split(',');
  const covers = (params.get('c') ?? '').split(',');
  const slots = Array.from({ length: SLOTS }, (_, i): Slot | null => {
    const workId = (works[i] ?? '').trim();
    const coverId = coverIdFromSegment((covers[i] ?? '').trim());
    return isWorkId(workId) && coverId ? { workId, coverId } : null;
  });
  return { slots, by: cleanName(params.get('by') ?? '') };
}

/** The query string of a board, without the leading `?`; empty for an empty board. */
export function boardQuery(board: Board): string {
  if (board.slots.every(s => !s) && !board.by) return '';
  const params = new URLSearchParams();
  params.set('w', board.slots.map(s => s?.workId ?? '').join(','));
  params.set('c', board.slots.map(s => (s ? coverPathSegment(s.coverId) : '')).join(','));
  if (board.by) params.set('by', board.by);
  // URLSearchParams writes the separating comma as %2C; it is safe in a query and reads better bare.
  return params.toString().replace(/%2C/g, ',');
}

export const filledCount = (board: Board): number => board.slots.filter(Boolean).length;

function withSlots(board: Board, slots: (Slot | null)[]): Board {
  return { ...board, slots };
}

/** Puts a book into a slot, replacing whatever was there. A work already on the board moves. */
export function place(board: Board, index: number, slot: Slot): Board {
  if (index < 0 || index >= SLOTS) return board;
  const slots = board.slots.map(s => (s?.workId === slot.workId ? null : s));
  slots[index] = slot;
  return withSlots(board, slots);
}

/** The first empty slot, or -1 when the board is full. */
export const firstEmpty = (board: Board): number => board.slots.findIndex(s => !s);

export function remove(board: Board, index: number): Board {
  if (!board.slots[index]) return board;
  return withSlots(board, board.slots.map((s, i) => (i === index ? null : s)));
}

/** Swaps two slots; moving into an empty slot is a swap with nothing. */
export function swap(board: Board, a: number, b: number): Board {
  if (a === b || a < 0 || b < 0 || a >= SLOTS || b >= SLOTS) return board;
  const slots = [...board.slots];
  [slots[a], slots[b]] = [slots[b], slots[a]];
  return withSlots(board, slots);
}

/** Changes the cover of a slot, keeping its place — "the edition you read". */
export function setCover(board: Board, index: number, coverId: string): Board {
  const slot = board.slots[index];
  if (!slot) return board;
  return withSlots(board, board.slots.map((s, i) => (i === index ? { ...slot, coverId } : s)));
}
