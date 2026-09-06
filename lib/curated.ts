/**
 * Curated works for the empty home page (SPEC §8.1): visually strong books
 * with many editions. Cover ids are Open Library `cover_i` values verified
 * on 2026-09-06; the ids are work ids so cards link straight to the detail
 * page.
 */
export interface CuratedWork {
  id: string;
  title: string;
  author: string;
  coverId: number;
}

export const CURATED_WORKS: CuratedWork[] = [
  { id: 'OL1168083W', title: 'Nineteen Eighty-Four', author: 'George Orwell', coverId: 9267242 },
  { id: 'OL468431W', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', coverId: 10590366 },
  { id: 'OL66554W', title: 'Pride and Prejudice', author: 'Jane Austen', coverId: 14348537 },
  { id: 'OL893414W', title: 'Dune', author: 'Frank Herbert', coverId: 11481354 },
  { id: 'OL27482W', title: 'The Hobbit', author: 'J. R. R. Tolkien', coverId: 14627509 },
  { id: 'OL102749W', title: 'Moby Dick', author: 'Herman Melville', coverId: 10544254 },
  { id: 'OL86318W', title: 'Ulysses', author: 'James Joyce', coverId: 13136548 },
  { id: 'OL627084W', title: 'Lolita', author: 'Vladimir Nabokov', coverId: 12984540 },
  { id: 'OL450063W', title: 'Frankenstein', author: 'Mary Shelley', coverId: 12356249 },
  { id: 'OL85892W', title: 'Dracula', author: 'Bram Stoker', coverId: 12216503 },
  { id: 'OL50548W', title: 'Beloved', author: 'Toni Morrison', coverId: 8261367 },
  { id: 'OL2636675W', title: "Gravity's Rainbow", author: 'Thomas Pynchon', coverId: 97894 },
];

export function olCover(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}
