/**
 * The Shelf-Portrait's link card under an address outside `/api/` (ROADMAP
 * 2.18q): the `og:image` of a shared board. X's Twitterbot asks robots.txt
 * for the image too and keeps its answer for a while, so a picture under
 * `Disallow: /api/` stayed a grey box even after the rule was opened. The
 * extension keeps the language proxy away (its matcher skips paths with one),
 * and `card.jpg` is a static segment, so it wins over `[id]`.
 * Same handler, same rate bucket, same cache rules as the poster.
 */
export { GET } from '@/app/api/inspiration/poster/route';

export const maxDuration = 30;
