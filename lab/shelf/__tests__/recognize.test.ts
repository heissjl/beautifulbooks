import { describe, expect, it } from 'vitest';
import { parseRecognition } from '../recognize';

// The shape since 5.11a: short keys, whole percentages, a point per book. The lab reads what the site reads (lib/recognize.ts).
const good = JSON.stringify({
  books: [
    { t: 'Nineteen Eighty-Four', a: 'George Orwell', k: 'spine', x: 12, y: 40 },
    { t: '  The Great   Gatsby ', a: 'F. Scott Fitzgerald', k: 'cover', x: 60, y: 45 },
  ],
});

describe('parseRecognition', () => {
  it('reads a strict answer and tidies whitespace', () => {
    const r = parseRecognition(good);
    expect(r.problems).toEqual([]);
    expect(r.books).toHaveLength(2);
    expect(r.books[1]).toEqual({ title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', kind: 'cover', x: 0.6, y: 0.45 });
  });

  it('reads an answer inside a code fence or behind a sentence', () => {
    expect(parseRecognition('```json\n' + good + '\n```').books).toHaveLength(2);
    expect(parseRecognition('Here are the books I found:\n' + good + '\nHope that helps.').books).toHaveLength(2);
  });

  it('still reads the long keys of the first answers, and a bare array', () => {
    const r = parseRecognition('[{"title":"Dune","author":"Frank Herbert","kind":"spine"}]');
    expect(r.books).toEqual([{ title: 'Dune', author: 'Frank Herbert', kind: 'spine' }]);
  });

  it('says so when there is no JSON at all, rather than returning an empty shelf silently', () => {
    expect(parseRecognition('I cannot read any titles in this image.')).toEqual({ books: [], problems: ['Antwort war kein JSON'] });
    expect(parseRecognition('{"books": [ {"t": "Du')).toEqual({ books: [], problems: ['Antwort war kein JSON'] });
    expect(parseRecognition('{"items": []}').problems).toEqual(['JSON ohne Liste "books"']);
  });

  it('drops entries without a title and repairs the rest, naming each repair', () => {
    const r = parseRecognition(JSON.stringify({
      books: [
        { t: '', a: 'Nobody', k: 'spine', x: 10, y: 10 },
        'just a string',
        { t: 'Beloved', a: 'Toni Morrison', k: 'jacket', x: 'left', y: 20 },
        { t: 'Homo Faber', k: 'cover', x: 90, y: 150 },
      ],
    }));
    expect(r.books).toEqual([
      // A point beyond the picture means the answer was counted, not measured: every y is drawn back in proportion (settle).
      { title: 'Beloved', author: 'Toni Morrison', kind: 'spine', y: expect.closeTo(0.2 * (0.97 / 1.5), 6) },
      // A missing author is empty.
      { title: 'Homo Faber', author: '', kind: 'cover', x: 0.9, y: expect.closeTo(0.97, 6) },
    ]);
    expect(r.problems).toEqual(['#1: ohne Titel', '#2: kein Objekt', '#3: kind "jacket" als spine gelesen', '#3: Mitte unbrauchbar']);
  });
});
