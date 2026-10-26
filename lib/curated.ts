/**
 * Curated works for the empty home page (SPEC §3 F1.6, §5).
 *
 * Picked by eye, not by a rule: twelve books whose covers stand next to each
 * other well and whose walls are worth opening. Cover ids are Open Library
 * `cover_i` values, each one looked at; the ids are work ids so a card links
 * straight to the detail page.
 *
 * **Not the same list as the ~500 works of ROADMAP 5.1.** Those are chosen by
 * edition count and reader numbers for the sitemap; these twelve are chosen
 * for how the wall looks. Keep them separate.
 *
 * The list is deliberately uneven since 2026-09-07 (Julian): most of these
 * have dozens of covers, *KAFF auch Mare Crisium* has two. The caption on the
 * wall says so rather than promising what one tile cannot deliver.
 *
 * Eleven since 2026-09-08: *Nineteen Eighty-Four* is out on Julian's
 * instruction, here and from the hundred behind ROADMAP 6.17. The wall is a
 * plain grid and does not care about the count; the list itself is on its way
 * out, replaced by the curated hundred in rotation.
 */
import curatedFile from '@/data/curated.json';

export interface CuratedWork {
  id: string;
  title: string;
  author: string;
  coverId: number;
}

export const CURATED_WORKS: CuratedWork[] = [
  // Ordered for the wall, not by rank: light next to dark, no two reds side by side.
  { id: 'OL27258W', title: 'Neuromancer', author: 'William Gibson', coverId: 283860 },
  { id: 'OL1434640W', title: 'Berlin Alexanderplatz', author: 'Alfred Döblin', coverId: 577140 },
  { id: 'OL893414W', title: 'Dune', author: 'Frank Herbert', coverId: 11481354 },
  { id: 'OL86318W', title: 'Ulysses', author: 'James Joyce', coverId: 13136548 },
  { id: 'OL627084W', title: 'Lolita', author: 'Vladimir Nabokov', coverId: 12984540 },
  { id: 'OL62744W', title: 'Vom Kriege', author: 'Carl von Clausewitz', coverId: 9933109 },
  { id: 'OL468431W', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', coverId: 10590366 },
  { id: 'OL102749W', title: 'Moby Dick', author: 'Herman Melville', coverId: 10544254 },
  { id: 'OL3801690W', title: 'KAFF auch Mare Crisium', author: 'Arno Schmidt', coverId: 12550462 },
  { id: 'OL50548W', title: 'Beloved', author: 'Toni Morrison', coverId: 8261367 },
  { id: 'OL2636675W', title: "Gravity's Rainbow", author: 'Thomas Pynchon', coverId: 97894 },
];

export function olCover(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/**
 * The image of a wall tile: the collection's own file where it has one
 * (`WallWork.image`), otherwise Open Library's cover.
 */
export function wallCover(w: { coverId: number; image?: string }, size: 'S' | 'M' | 'L' = 'M'): string {
  return w.image ?? olCover(w.coverId, size);
}

/** How many tiles the home page shows: three full rows of six (ROADMAP 6.17). */
export const WALL_SIZE = 18;

/**
 * The wall the home page actually renders.
 *
 * Julian's own picks from `data/curated.json` come first — one cover chosen
 * by eye per work in the curation tool (ROADMAP 6.18) — and the hand-written
 * list above fills up whatever is missing, so the wall is full from the first
 * day of curating rather than the last. Works picked in both places appear
 * once, with the chosen cover winning.
 *
 * The rotation over this list is `wallForHour` below.
 */
/**
 * One row of `data/curated.json`, as the tool writes it. The JSON is typed
 * here rather than inferred: TypeScript reads the file as literals, so a flag
 * no row carries yet — `dropped`, until the first work is struck off — would
 * not exist on the inferred type at all.
 */
interface CuratedPick {
  id: string;
  title: string;
  author: string;
  coverId: string;
  firstPublished?: number;
  skipped?: boolean;
  dropped?: boolean;
}

function pickedWorks(): CuratedWork[] {
  const out: CuratedWork[] = [];
  for (const p of (curatedFile as { works: CuratedPick[] }).works) {
    if (p.skipped || p.dropped || !p.coverId.startsWith('ol:')) continue;
    const coverId = Number(p.coverId.slice(3));
    if (!Number.isFinite(coverId) || coverId <= 0) continue;
    out.push({ id: p.id, title: p.title, author: p.author, coverId });
  }
  return out;
}

/**
 * Every work Julian has picked a cover for — the list ROADMAP 5.1 asks for,
 * as far as it goes today (a hundred at 2026-09-09).
 *
 * Three jobs, and the sitemap is the one that matters first: a work page
 * exists for a crawler only once something points at it, and nothing does.
 * With eighteen in the sitemap, seventeen of a hundred walls were invisible.
 *
 * **Not the same as `WALL_WORKS`**, which is the eighteen on the home page.
 * This is the whole shelf.
 */
export const CURATED_LIST: CuratedWork[] = pickedWorks();

/**
 * Every work the wall may show: Julian's picks, then the hand-written list for
 * whatever he has not picked yet. The rotation turns through this list.
 */
export const WALL_POOL: CuratedWork[] = (() => {
  const picked = CURATED_LIST;
  const seen = new Set(picked.map(w => w.id));
  return [...picked, ...CURATED_WORKS.filter(w => !seen.has(w.id))];
})();

/**
 * The first window of the pool, and **the fixed set of prerendered book pages**
 * (`generateStaticParams`, ROADMAP 6.17). It does not follow the rotation: a
 * build is one moment, the rotation moves every hour, and a build-time set
 * would be stale within the hour. The other works are rendered on first
 * request and cached (`revalidate` on the book page), which is the same speed
 * from the second reader on. Keep it small — every page is an Open Library
 * request inside the build (`scripts/check-prerender.mjs`).
 */
export const WALL_WORKS: CuratedWork[] = WALL_POOL.slice(0, WALL_SIZE);

const HOUR_MS = 3_600_000;

/** The wall's clock: whole hours since the epoch, UTC. Every reader in the same hour gets the same number. */
export function wallHour(now: number = Date.now()): number {
  return Math.floor(now / HOUR_MS);
}

/**
 * The eighteen tiles of one hour (ROADMAP 6.17): a window of `size`
 * consecutive works of the pool, moved on by one window per hour and wrapping
 * round, so Julian's order — light next to dark — holds inside a window and
 * every work appears once in `ceil(pool / size)` hours.
 *
 * **A pure function of the hour** — no randomness, nothing from the reader —
 * so the server and the browser agree and a page cached for the hour is right.
 * `hidden` takes covers off the site (2.18k) from the pool before windowing,
 * so a hidden cover does not leave a hole of seventeen.
 */
export function wallForHour(
  hour: number,
  pool: readonly CuratedWork[] = WALL_POOL,
  size: number = WALL_SIZE,
  hidden: (w: CuratedWork) => boolean = () => false,
): CuratedWork[] {
  const live = pool.filter(w => !hidden(w));
  if (live.length <= size) return live;
  const windows = Math.ceil(live.length / size);
  const start = ((hour % windows) + windows) % windows * size;
  const out: CuratedWork[] = [];
  for (let i = 0; i < size; i++) out.push(live[(start + i) % live.length]);
  return out;
}
