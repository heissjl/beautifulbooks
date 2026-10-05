/**
 * Nine books that inspired someone, on one board held entirely in the
 * address (ROADMAP 5.18, pure and client-safe).
 *
 * Nine slots fit in a query string, so a board being made needs no store, no
 * visitor id and no question of how long it is kept — the address *is* the
 * board. Each slot carries the work (for the link to its book page) and the
 * cover the reader chose: the edition they read.
 *
 * The compact form (Julian, 2026-10-04: „shared links are gigantic?"):
 * numbers in base 36, one character between slots, nothing repeated —
 *
 *   ?b=a1fz.7gxh3~p1ar.7gy8v~~~~~~~&by=Julian
 *
 * is 134 characters for nine books with a name, against 238 for the first
 * form with `OL…W` and `ol-…` spelled out. `~` and `.` are unreserved in a
 * URL and appear in no id. A Google cover id is not a number and is kept as
 * it is behind a `g`.
 *
 * Parsing is tolerant: whatever a stranger types into the address bar yields
 * a board, with every slot that does not parse left empty.
 *
 * **Imports nothing and uses no Node API:** the editor runs it in the browser,
 * and the lab's server hands the same file to its page with the types stripped.
 */

/** Nine places is the board; six is the alternative Julian asked to see beside it (2026-10-05). */
export const SLOTS = 9;
export type BoardSize = 6 | 9;
export const NAME_MAX = 40;

/** "Nine" and "Six", for the sentences that count the books. */
export const SIZE_WORD: Record<BoardSize, string> = { 6: 'Six', 9: 'Nine' };

export interface Slot {
  /** `OL…W` */
  workId: string;
  /** `ol:<number>` or `gb:<id>`, as the rest of the site writes it. */
  coverId: string;
}

export interface Board {
  /** Nine entries, or six on the smaller board, row by row; null is an empty slot. The length is the board's size. */
  slots: (Slot | null)[];
  /** The name the reader chose to show, possibly empty. */
  by: string;
}

const WORK = /^OL\d{1,10}W$/;
const OL_COVER = /^ol:\d{1,12}$/;
const GB_COVER = /^gb:[\w.-]{1,64}$/;

export const isWorkId = (s: string): boolean => WORK.test(s);
export const isCoverId = (s: string): boolean => OL_COVER.test(s) || GB_COVER.test(s);

export function emptyBoard(size: BoardSize = SLOTS): Board {
  return { slots: Array.from({ length: size }, () => null), by: '' };
}

export const sizeOf = (board: Board): BoardSize => (board.slots.length === 6 ? 6 : 9);

/** The same books on a board of another size: the first six stay when a board of nine shrinks. */
export function resize(board: Board, size: BoardSize): Board {
  return { ...board, slots: Array.from({ length: size }, (_, i) => board.slots[i] ?? null) };
}

/** A name as the poster can print it: one line, no control characters, at most NAME_MAX. */
export function cleanName(raw: string): string {
  const one = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...one].slice(0, NAME_MAX).join('').trim();
}

/** `OL468431W` → `a1fz`; `ol:12547191` → `7gxh3`; `gb:AbC-1` → `gAbC-1`. */
export function encodeSlot(slot: Slot): string {
  const work = Number(slot.workId.slice(2, -1)).toString(36);
  const cover = slot.coverId.startsWith('ol:') ? Number(slot.coverId.slice(3)).toString(36) : `g${slot.coverId.slice(3)}`;
  return `${work}.${cover}`;
}

export function decodeSlot(code: string): Slot | null {
  const m = /^([0-9a-z]{1,8})\.(g[\w.-]{1,64}|[0-9a-z]{1,8})$/.exec(code);
  if (!m) return null;
  const work = parseInt(m[1], 36);
  if (!Number.isFinite(work) || work <= 0) return null;
  const workId = `OL${work}W`;
  if (m[2].startsWith('g')) return { workId, coverId: `gb:${m[2].slice(1)}` };
  const cover = parseInt(m[2], 36);
  return Number.isFinite(cover) && cover > 0 ? { workId, coverId: `ol:${cover}` } : null;
}

/** The `b` parameter of a board; `''` for an empty board. */
export function encodeBoard(board: Board): string {
  if (board.slots.every(s => !s)) return '';
  return board.slots.map(s => (s ? encodeSlot(s) : '')).join('~');
}

export function decodeBoard(b: string, size: BoardSize = SLOTS): (Slot | null)[] {
  const codes = b.split('~');
  return Array.from({ length: size }, (_, i) => (codes[i] ? decodeSlot(codes[i]) : null));
}

/** `n=6` in the address is the smaller board; anything else is nine. */
export function parseBoard(params: URLSearchParams): Board {
  const size: BoardSize = params.get('n') === '6' ? 6 : SLOTS;
  return { slots: decodeBoard(params.get('b') ?? '', size), by: cleanName(params.get('by') ?? '') };
}

/** The query string of a board, without the leading `?`; empty for an empty board. */
export function boardQuery(board: Board): string {
  const b = encodeBoard(board);
  const parts: string[] = [];
  if (b) parts.push(`b=${b}`);
  // Nine is the default and stays unsaid, so every address made before the smaller board reads as it did.
  if (sizeOf(board) === 6) parts.push('n=6');
  if (board.by) parts.push(`by=${encodeURIComponent(board.by)}`);
  return parts.join('&');
}

export const filledCount = (board: Board): number => board.slots.filter(Boolean).length;

function withSlots(board: Board, slots: (Slot | null)[]): Board {
  return { ...board, slots };
}

/** Puts a book into a slot, replacing whatever was there. A work already on the board moves. */
export function place(board: Board, index: number, slot: Slot): Board {
  if (index < 0 || index >= board.slots.length || !isWorkId(slot.workId) || !isCoverId(slot.coverId)) return board;
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
  if (a === b || a < 0 || b < 0 || a >= board.slots.length || b >= board.slots.length) return board;
  const slots = [...board.slots];
  [slots[a], slots[b]] = [slots[b], slots[a]];
  return withSlots(board, slots);
}

/** Changes the cover of a slot, keeping its place — the edition you read. */
export function setCover(board: Board, index: number, coverId: string): Board {
  const slot = board.slots[index];
  if (!slot || !isCoverId(coverId)) return board;
  return withSlots(board, board.slots.map((s, i) => (i === index ? { ...slot, coverId } : s)));
}

/** A cover id as one path segment, as the site's share addresses write it: `ol:123` → `ol-123`. */
export const coverSegment = (coverId: string): string => coverId.replace(':', '-');
