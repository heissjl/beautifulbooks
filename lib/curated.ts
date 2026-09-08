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
 * **Deterministic on purpose.** Rotating the eighteen per page load is
 * ROADMAP 6.17 and needs a decision this file cannot make: the home page is
 * prerendered, so a rotation computed here would differ between the HTML and
 * the browser and React would tear it down. Order is therefore fixed until
 * the rotation has a server to come from.
 */
function pickedWorks(): CuratedWork[] {
  const out: CuratedWork[] = [];
  for (const p of curatedFile.works) {
    if (p.skipped || !p.coverId.startsWith('ol:')) continue;
    const coverId = Number(p.coverId.slice(3));
    if (!Number.isFinite(coverId) || coverId <= 0) continue;
    out.push({ id: p.id, title: p.title, author: p.author, coverId });
  }
  return out;
}

export const WALL_WORKS: CuratedWork[] = (() => {
  const picked = pickedWorks();
  const seen = new Set(picked.map(w => w.id));
  const filler = CURATED_WORKS.filter(w => !seen.has(w.id));
  return [...picked, ...filler].slice(0, WALL_SIZE);
})();
