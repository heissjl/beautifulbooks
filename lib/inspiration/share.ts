/**
 * What a share button sends, per platform (ROADMAP 5.18, pure).
 *
 * The picture travels on its own: Instagram, WhatsApp and the story formats
 * take no link, so the poster carries the address. Where text can go with a
 * link, each platform has its own intent address and its own limit, and the
 * sentence is written once here so that the hashtag and the invitation stay
 * the same everywhere. Lengths are tested against the platforms' limits as
 * they stood on 2026-10-04: X 280 characters with any link counted as 23,
 * Bluesky 300, Threads 500.
 */

/**
 * `#shelfportrait` since the page is called "My Shelf-Portrait" (2026-10-05);
 * it was `#booksthatinspiredme`. Claude followed the name, and Julian kept
 * it („ist gut so").
 */
export const HASHTAG = '#shelfportrait';

/**
 * The one line every shared page and picture carries (Julian, 2026-10-05:
 * „Oben: My Shelf-Portrait"). A second line stood under it for a day — „The
 * books that inspire me", then „A self-portrait in nine books." — until
 * Julian struck it („lösche den subheader ganz fürs erste"); the suggestions
 * are kept in the history, „Vorschläge für eine andere Unterzeile". With a
 * name on the board the line speaks of that person.
 */
export function titleOf(by: string): string {
  return by ? `${by}’s Shelf-Portrait` : 'My Shelf-Portrait';
}

/**
 * Appended to every picture address. The CDN keeps a whole picture for a
 * month under its address; a new number here is how a changed line reaches
 * boards that were already shared. 4 since 2026-10-05: more room under the
 * covers, the card's words in the middle of their column, the mosaic ground.
 * 5 since 2026-10-06: six in a story three by two, titles on two lines.
 */
export const PICTURE_VERSION = 5;

export interface ShareTarget {
  id: 'x' | 'threads' | 'bluesky' | 'whatsapp' | 'telegram';
  label: string;
  href: string;
}

/**
 * The sentence that goes with the link, with or without a name. "Favourite
 * covers", not "the editions they were read in" (Julian, 2026-10-05): what a
 * reader picks is a picture, and the one they love counts as much as the
 * printing they held.
 */
export function shareText(by: string): string {
  const what = by ? `the books that inspire ${by}, each with a favourite cover` : 'the books that inspire me, with my favourite covers';
  return `${titleOf(by)}: ${what}. What’s yours? ${HASHTAG}`;
}

/**
 * The link with the platform's `?via=` mark (Julian, 2026-10-06: the share
 * buttons mark their link, so the analytics can tell over which platform
 * readers pass a board on). The marks are classes of `VIA` in
 * `lib/insights/signals.ts`; an address that cannot be parsed goes as it is.
 */
export function withVia(link: string, via: 'x' | 'threads' | 'bluesky' | 'whatsapp' | 'telegram'): string {
  try {
    const url = new URL(link);
    url.searchParams.set('via', via);
    return url.toString();
  } catch {
    return link;
  }
}

export function shareTargets(link: string, by: string): ShareTarget[] {
  const text = shareText(by);
  const t = encodeURIComponent(text);
  const u = (via: Parameters<typeof withVia>[1]) => encodeURIComponent(withVia(link, via));
  const inText = (via: Parameters<typeof withVia>[1]) => encodeURIComponent(`${text} ${withVia(link, via)}`);
  return [
    // `/intent/tweet`, the address X documents and its apps open as a new post; `/intent/post` opened a message on Julian's phone (2026-10-05).
    { id: 'x', label: 'X', href: `https://x.com/intent/tweet?text=${t}&url=${u('x')}` },
    { id: 'threads', label: 'Threads', href: `https://www.threads.net/intent/post?text=${inText('threads')}` },
    { id: 'bluesky', label: 'Bluesky', href: `https://bsky.app/intent/compose?text=${inText('bluesky')}` },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${inText('whatsapp')}` },
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${u('telegram')}&text=${t}` },
  ];
}

/** How X counts a post: every link is 23 characters, whatever its length. */
export const X_LIMIT = 280;
export const X_LINK_LENGTH = 23;
export const BLUESKY_LIMIT = 300;
export const THREADS_LIMIT = 500;
