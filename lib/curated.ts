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
 */
export interface CuratedWork {
  id: string;
  title: string;
  author: string;
  coverId: number;
}

export const CURATED_WORKS: CuratedWork[] = [
  // Ordered for the wall, not by rank: light next to dark, no two reds side by side.
  { id: 'OL1168083W', title: 'Nineteen Eighty-Four', author: 'George Orwell', coverId: 9267242 },
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
