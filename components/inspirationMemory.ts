/**
 * Whether the board on a shared page is the one this reader just finished
 * (ROADMAP 5.18b; client only).
 *
 * "Make your own" makes no sense to someone who came from making this one
 * (Julian, 2026-10-05), and a board has no owner to ask: its link is the hash
 * of its content, with no visitor id (N11). So the editor notes the board it
 * handed over in this module's memory, as `NavMemory` keeps the previous
 * address — "Done" is a client-side navigation, and the module lives through
 * it. Nothing is written to the device; after a reload the reader is a
 * visitor like any other, which costs them one button's wording.
 */
let made: string | null = null;

export function rememberMade(query: string): void {
  made = query;
}

export function wasMade(query: string): boolean {
  return made === query;
}

/**
 * The titles of the books on the board being made, for the editor that
 * mounts again after "Back": the page it is given then is the one first
 * loaded, which knew none of the books added since.
 */
let names: Record<string, { title: string; author?: string | null }> = {};

export function keepNames(next: Record<string, { title: string; author?: string | null }>): void {
  names = next;
}

export function keptNames(): Record<string, { title: string; author?: string | null }> {
  return names;
}
