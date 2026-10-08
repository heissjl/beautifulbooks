/**
 * Addresses in a collection's intro, made into links (Julian, 2026-10-06:
 * „bei feminist press und otherwise awards den link aber wieder dazu in den
 * text"). The intro is plain text written in /curate or the lab tool; an
 * `https://` address in it becomes a link labelled without the scheme, a
 * leading `www.` and a trailing slash. Punctuation after an address ends a
 * sentence, it is not part of the address. Pure, so the page and its test
 * share it; only `https` is taken, so a draft cannot slip in another scheme.
 */
export type IntroPart = { text: string } | { href: string; label: string };

const URL = /https:\/\/[^\s<>"]+/g;

export function linkLabel(href: string): string {
  return href.replace(/^https:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

export function introParts(intro: string): IntroPart[] {
  const parts: IntroPart[] = [];
  let at = 0;
  for (const m of intro.matchAll(URL)) {
    const href = m[0].replace(/[.,;:!?)\]]+$/, '');
    const start = m.index ?? 0;
    if (start > at) parts.push({ text: intro.slice(at, start) });
    parts.push({ href, label: linkLabel(href) });
    at = start + href.length;
  }
  if (at < intro.length) parts.push({ text: intro.slice(at) });
  return parts;
}

/** The intro as plain words, for a description: an address becomes its label. */
export function introText(intro: string): string {
  return introParts(intro).map(p => ('href' in p ? p.label : p.text)).join('');
}
