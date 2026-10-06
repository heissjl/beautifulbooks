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
 * The two lines every shared page and picture carries. The first is Julian's
 * (2026-10-05: „Oben: My Shelf-Portrait"); the second was „The books that
 * inspire me" until later that day, when he chose „A self-portrait in nine
 * books." from a list of suggestions (history, „Vorschläge für eine andere
 * Unterzeile") — „vorerst", so it may change again. The count follows the
 * board. With a name on the board they speak of that person; the editor
 * page keeps its own second line.
 */
export function titleOf(by: string): string {
  return by ? `${by}’s Shelf-Portrait` : 'My Shelf-Portrait';
}

const COUNT_WORD: Record<3 | 6 | 9, string> = { 3: 'three', 6: 'six', 9: 'nine' };

export function subtitleOf(by: string, size: 3 | 6 | 9 = 9): string {
  return by ? `${by}, in ${COUNT_WORD[size]} books.` : `A self-portrait in ${COUNT_WORD[size]} books.`;
}

/**
 * Appended to every picture address. The CDN keeps a whole picture for a
 * month under its address; a new number here is how a changed line reaches
 * boards that were already shared.
 */
export const PICTURE_VERSION = 2;

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

export function shareTargets(link: string, by: string): ShareTarget[] {
  const text = shareText(by);
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(link);
  return [
    // `/intent/tweet`, the address X documents and its apps open as a new post; `/intent/post` opened a message on Julian's phone (2026-10-05).
    { id: 'x', label: 'X', href: `https://x.com/intent/tweet?text=${t}&url=${u}` },
    { id: 'threads', label: 'Threads', href: `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${link}`)}` },
    { id: 'bluesky', label: 'Bluesky', href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${link}`)}` },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}` },
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
  ];
}

/** How X counts a post: every link is 23 characters, whatever its length. */
export const X_LIMIT = 280;
export const X_LINK_LENGTH = 23;
export const BLUESKY_LIMIT = 300;
export const THREADS_LIMIT = 500;
