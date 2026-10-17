/**
 * Was this API request made by one of the site's own pages? (ROADMAP 2.18f,
 * 2026-10-17.) Pure.
 *
 * On 16–17 October a scraper called `/api/works` about 9,500 times in two
 * days — ten old browser user agents in rotation (Chrome 118–120, Firefox
 * 120–121), several hundred addresses worldwide, about fifty calls each — and
 * every cold page 0 it asked for spent a Google Books request: Google's own
 * alert fired at 80 % of the day's 1,000 at 01:01 UTC. Per-address limits do
 * not bind a scraper with that many addresses, and robots.txt (which closes
 * `/api/` to every crawler) does not bind one that ignores it.
 *
 * What does tell the two apart: a browser that fetches from a page of this
 * site sends `Sec-Fetch-Site: same-origin` (every current Chrome, Firefox,
 * Edge, and Safari since 16.4), and a script calling the API directly sends
 * none, or `none`, or `cross-site`. So the Google request — the one scarce
 * thing — is spent only for a same-origin request; everyone else still gets
 * the page, from Open Library alone. Nothing about the reader is read or
 * kept beyond this one header of this one request.
 */
export interface HeaderBag { get(name: string): string | null }

export function askedFromOwnPage(headers: HeaderBag): boolean {
  return (headers.get('sec-fetch-site') ?? '').toLowerCase() === 'same-origin';
}
