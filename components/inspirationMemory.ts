/**
 * Whether the board on a shared page is the one this reader just finished
 * (ROADMAP 5.18b; client only).
 *
 * "Make your own" makes no sense to someone who came from making this one
 * (Julian, 2026-10-05), and a board has no owner to ask: its link is the hash
 * of its content, with no visitor id (N11). So the editor notes the board it
 * handed over in this module's memory, as `NavMemory` keeps the previous
 * address — "Done" is a client-side navigation, and the module lives through
 * it. Nothing is written to the device.
 *
 * Since the ways to share are shown to the maker only (Julian, 2026-10-05:
 * „the sharing options should only be there when you edited the picture, not
 * when you get on the portrait from a link"), the memory alone is too short:
 * a phone reloads a tab it had put away, and the maker would come back to a
 * page without its share buttons. So "Done" also lands on the address with
 * `#mine` behind it. A fragment is never sent to the server, survives a
 * reload, and is still nothing stored. The links the page hands out do not
 * carry it; whoever copies the address bar instead passes the maker's view
 * along, which shows a visitor nothing they may not see.
 */
export const MINE = '#mine';

let made: string | null = null;

export function rememberMade(query: string): void {
  made = query;
}

export function wasMade(query: string): boolean {
  return made === query || (typeof window !== 'undefined' && window.location.hash === MINE);
}

/** For `useSyncExternalStore`: the answer changes when the fragment does. */
export function watchMade(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
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
