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

/**
 * Nine places is the board a link without a size means; three and six are
 * the reader's choice when making one (Julian, 2026-10-05: „gib die
 * möglichkeit sich zwischen 3, 6 und 9 zu entscheiden beim erstellen").
 */
export const SLOTS = 9;
export type BoardSize = 3 | 6 | 9;
export const SIZES: readonly BoardSize[] = [3, 6, 9];
export const NAME_MAX = 40;
/**
 * A line of the reader's own under the title (Julian, 2026-10-06: „lass uns
 * eine möglichkeit machen einen eigenen untertitel zu wählen", after
 * 9things.me's „Make it specific": „9 sci-fi books that define me"). Sixty
 * characters fit one line on every picture at the line's size.
 */
export const SUB_MAX = 60;

/** "Nine" and "Six", for the sentences that count the books. */
export const SIZE_WORD: Record<BoardSize, string> = { 3: 'Three', 6: 'Six', 9: 'Nine' };

export interface Slot {
  /** `OL…W` */
  workId: string;
  /** `ol:<number>` or `gb:<id>`, as the rest of the site writes it. */
  coverId: string;
}

export interface Board {
  /** Nine entries, or six or three on a smaller board, row by row; null is an empty slot. The length is the board's size. */
  slots: (Slot | null)[];
  /** The name the reader chose to show, possibly empty. */
  by: string;
  /** The reader's own line under the title, possibly empty. */
  sub: string;
}

const WORK = /^OL\d{1,10}W$/;
const OL_COVER = /^ol:\d{1,12}$/;
const GB_COVER = /^gb:[\w.-]{1,64}$/;

export const isWorkId = (s: string): boolean => WORK.test(s);
export const isCoverId = (s: string): boolean => OL_COVER.test(s) || GB_COVER.test(s);

export function emptyBoard(size: BoardSize = SLOTS): Board {
  return { slots: Array.from({ length: size }, () => null), by: '', sub: '' };
}

export const sizeOf = (board: Board): BoardSize => (board.slots.length === 3 ? 3 : board.slots.length === 6 ? 6 : 9);

/**
 * The same books on a board of another size. A smaller board keeps the first
 * books and hands the others back as `spare`, in their order; a bigger one
 * takes `spare` books into its empty places. Nothing is thrown away by
 * choosing a size: whoever goes from nine to three and back has nine again.
 * Places are kept where the books fit, and closed up only where they do not.
 */
export function resize(board: Board, size: BoardSize, spare: readonly Slot[] = []): { board: Board; spare: Slot[] } {
  const beyond = board.slots.slice(size).some(Boolean);
  const books = board.slots.flatMap((s) => (s ? [s] : []));
  const slots: (Slot | null)[] = beyond
    ? Array.from({ length: size }, (_, i) => books[i] ?? null)
    : Array.from({ length: size }, (_, i) => board.slots[i] ?? null);
  const waiting = beyond ? [...books.slice(size), ...spare] : spare;
  // A book set aside and since added again is on the board once, not twice.
  const known = new Set(slots.flatMap((s) => (s ? [s.workId] : [])));
  const rest: Slot[] = [];
  for (const book of waiting) {
    if (known.has(book.workId)) continue;
    known.add(book.workId);
    const free = slots.indexOf(null);
    if (free < 0) rest.push(book);
    else slots[free] = book;
  }
  return { board: { ...board, slots }, spare: rest };
}

/** A name as the poster can print it: one line, no control characters, at most `max` (NAME_MAX for a name, SUB_MAX for the line under the title). */
export function cleanName(raw: string, max: number = NAME_MAX): string {
  const one = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...one].slice(0, max).join('').trim();
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

/** `n=3` or `n=6` in the address is a smaller board; anything else is nine. */
export function parseBoard(params: URLSearchParams): Board {
  const n = params.get('n');
  const size: BoardSize = n === '3' ? 3 : n === '6' ? 6 : SLOTS;
  return { slots: decodeBoard(params.get('b') ?? '', size), by: cleanName(params.get('by') ?? ''), sub: cleanName(params.get('sub') ?? '', SUB_MAX) };
}

/** The query string of a board, without the leading `?`; empty for an empty board. */
export function boardQuery(board: Board): string {
  const b = encodeBoard(board);
  const parts: string[] = [];
  if (b) parts.push(`b=${b}`);
  // Nine is the default and stays unsaid, so every address made before the smaller boards reads as it did.
  if (sizeOf(board) !== SLOTS) parts.push(`n=${sizeOf(board)}`);
  if (board.by) parts.push(`by=${encodeURIComponent(board.by)}`);
  if (board.sub) parts.push(`sub=${encodeURIComponent(board.sub)}`);
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
