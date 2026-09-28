/**
 * A link that carries a visitor ID to /create (ROADMAP 5.13l; Julian,
 * 2026-09-28: „add an option to copy a link to the create site with that id
 * key set, so one can send it to someone else to collaborate or just send it
 * to oneself“). The ID travels in the fragment (`#id=…`), which a browser
 * never sends to a server, a log or a referrer, and the page removes it from
 * the address as soon as it has read it. Pure.
 */
import { isVisitorId, normalVisitorId } from './model';

export function idLink(origin: string, visitor: string): string {
  return `${origin}/create#id=${visitor}`;
}

/** The ID a `#id=…` fragment carries, or null when there is none or it is not an ID of this site. */
export function idFromHash(hash: string): string | null {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('id');
  if (!raw) return null;
  const id = normalVisitorId(raw);
  return isVisitorId(id) ? id : null;
}
