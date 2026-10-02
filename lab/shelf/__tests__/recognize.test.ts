import { describe, expect, it } from 'vitest';
import { parseRecognition } from '../recognize';

// The shape since 5.11a: rows first, short keys, whole percentages. The lab reads what the site reads (lib/recognize.ts).
const good = JSON.stringify({
  rows: [[10, 60]],
  books: [
    { t: 'Nineteen Eighty-Four', a: 'George Orwell', k: 'spine', r: 1, x: 12 },
    { t: '  The Great   Gatsby ', a: 'F. Scott Fitzgerald', k: 'cover', r: 1, x: 60 },
  ],
});

describe('parseRecognition', () => {
  it('reads a strict answer, tidies whitespace and places each book in its row', () => {
    const r = parseRecognition(good);
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([[0.1, 0.6]]);
    expect(r.books).toHaveLength(2);
    expect(r.books[1]).toMatchObject({ title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', kind: 'cover', row: 0, x: 0.6 });
    expect(r.books[1].box?.[1]).toBeCloseTo(0.1);
    expect(r.books[1].box?.[3]).toBeCloseTo(0.5);
  });

  it('reads an answer inside a code fence or behind a sentence', () => {
    expect(parseRecognition('```json\n' + good + '\n```').books).toHaveLength(2);
    expect(parseRecognition('Here are the books I found:\n' + good + '\nHope that helps.').books).toHaveLength(2);
  });

  it('still reads the long keys of the first answers, and a bare array', () => {
    const r = parseRecognition('[{"title":"Dune","author":"Frank Herbert","kind":"spine"}]');
    expect(r.books).toEqual([{ title: 'Dune', author: 'Frank Herbert', kind: 'spine', box: [0, 0, 1, 1] }]);
  });

  it('says so when there is no JSON at all, rather than returning an empty shelf silently', () => {
    expect(parseRecognition('I cannot read any titles in this image.')).toEqual({ books: [], rows: [], problems: ['Antwort war kein JSON'] });
    expect(parseRecognition('{"books": [ {"t": "Du')).toEqual({ books: [], rows: [], problems: ['Antwort war kein JSON'] });
    expect(parseRecognition('{"items": []}').problems).toEqual(['JSON ohne Liste "books"']);
  });

  it('drops entries without a title and repairs the rest, naming each repair', () => {
    const r = parseRecognition(JSON.stringify({
      rows: [[5, 50]],
      books: [
        { t: '', a: 'Nobody', k: 'spine', r: 1, x: 10 },
        'just a string',
        { t: 'Beloved', a: 'Toni Morrison', k: 'jacket', r: 0, x: 'left' },
        { t: 'Homo Faber', k: 'cover', r: 1, x: 90 },
      ],
    }));
    expect(r.books).toEqual([
      // No usable row: no box. A missing author is empty.
      { title: 'Beloved', author: 'Toni Morrison', kind: 'spine' },
      { title: 'Homo Faber', author: '', kind: 'cover', row: 0, x: 0.9, box: [expect.closeTo(0.85, 6), 0.05, expect.closeTo(0.1, 6), 0.45] },
    ]);
    expect(r.problems).toEqual([
      '#1: ohne Titel',
      '#2: kein Objekt',
      '#3: kind "jacket" als spine gelesen',
      '#3: Reihe unbrauchbar',
      '#3: Mitte unbrauchbar',
    ]);
  });
});
