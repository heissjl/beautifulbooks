import { describe, expect, it } from 'vitest';
import { parseRecognition } from '../recognize';

const good = JSON.stringify({
  books: [
    { title: 'Nineteen Eighty-Four', author: 'George Orwell', kind: 'spine', box: [0.1, 0.05, 0.04, 0.9], confidence: 0.93 },
    { title: '  The Great   Gatsby ', author: 'F. Scott Fitzgerald', kind: 'cover', box: [0.5, 0.2, 0.3, 0.6], confidence: 0.99 },
  ],
});

describe('parseRecognition', () => {
  it('reads a strict answer and tidies whitespace', () => {
    const r = parseRecognition(good);
    expect(r.problems).toEqual([]);
    expect(r.books).toHaveLength(2);
    expect(r.books[1]).toEqual({ title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', kind: 'cover', box: [0.5, 0.2, 0.3, 0.6], confidence: 0.99 });
  });

  it('reads an answer inside a code fence or behind a sentence', () => {
    expect(parseRecognition('```json\n' + good + '\n```').books).toHaveLength(2);
    expect(parseRecognition('Here are the books I found:\n' + good + '\nHope that helps.').books).toHaveLength(2);
  });

  it('accepts a bare array', () => {
    const r = parseRecognition('[{"title":"Dune","author":"Frank Herbert","kind":"spine","confidence":0.8}]');
    expect(r.books).toEqual([{ title: 'Dune', author: 'Frank Herbert', kind: 'spine', confidence: 0.8 }]);
  });

  it('says so when there is no JSON at all, rather than returning an empty shelf silently', () => {
    expect(parseRecognition('I cannot read any titles in this image.')).toEqual({ books: [], problems: ['Antwort war kein JSON'] });
    expect(parseRecognition('{"books": [ {"title": "Du')).toEqual({ books: [], problems: ['Antwort war kein JSON'] });
    expect(parseRecognition('{"items": []}').problems).toEqual(['JSON ohne Liste "books"']);
  });

  it('drops entries without a title and repairs the rest, naming each repair', () => {
    const r = parseRecognition(JSON.stringify({
      books: [
        { title: '', author: 'Nobody', kind: 'spine', confidence: 0.2 },
        'just a string',
        { title: 'Beloved', author: 'Toni Morrison', kind: 'jacket', box: [120, 40, 30, 400], confidence: 7 },
        { title: 'Homo Faber', kind: 'cover', box: [0.9, 0.9, 0.5, 0.5] },
      ],
    }));
    expect(r.books).toEqual([
      { title: 'Beloved', author: 'Toni Morrison', kind: 'spine', confidence: 1 },
      // The box is clipped to the picture; a missing confidence is 0.5, a missing author empty.
      { title: 'Homo Faber', author: '', kind: 'cover', box: [0.9, 0.9, expect.closeTo(0.1, 6), expect.closeTo(0.1, 6)], confidence: 0.5 },
    ]);
    expect(r.problems).toEqual([
      '#1: ohne Titel',
      '#2: kein Objekt',
      '#3: kind "jacket" als spine gelesen',
      '#3: Ausschnitt unbrauchbar',
    ]);
  });
});

describe('publisher (ROADMAP 5.16)', () => {
  it('reads it when the answer carries one and leaves it out when empty', () => {
    const r = parseRecognition(JSON.stringify({ books: [
      { title: 'Homo Faber', author: 'Max Frisch', kind: 'spine', confidence: 0.9, publisher: ' suhrkamp  taschenbuch ' },
      { title: 'Dune', author: 'Frank Herbert', kind: 'spine', confidence: 0.9, publisher: '' },
    ] }));
    expect(r.books[0].publisher).toBe('suhrkamp taschenbuch');
    expect(r.books[1]).not.toHaveProperty('publisher');
  });
});

describe('boxes in pixels (ROADMAP 5.16)', () => {
  it('turns pixel corners into the fraction box callers already use', () => {
    const r = parseRecognition(JSON.stringify({ books: [
      { title: 'Kindred', author: 'Octavia E. Butler', kind: 'spine', box: [200, 400, 260, 1000], confidence: 0.9 },
      { title: 'Beloved', author: 'Toni Morrison', kind: 'spine', box: [300, 400, 280, 1000], confidence: 0.9 },
    ] }), { width: 2000, height: 2000 });
    expect(r.books[0].box).toEqual([0.1, 0.2, 0.03, 0.3]);
    expect(r.books[1]).not.toHaveProperty('box');
    expect(r.problems).toEqual(['#2: Ausschnitt unbrauchbar [300,400,280,1000]']);
  });
});

describe('centre line and thickness (ROADMAP 5.16)', () => {
  it('keeps the axis and puts the upright box around the turned book', () => {
    const r = parseRecognition(JSON.stringify({ books: [
      { title: 'Kindred', author: 'Octavia E. Butler', kind: 'spine', axis: [100, 1000, 100, 400, 60], confidence: 0.9 },
      { title: 'Dune', author: 'Frank Herbert', kind: 'spine', axis: [200, 900, 800, 900, 50], confidence: 0.9 },
    ] }), { width: 2000, height: 1000 });
    expect(r.books[0].axis).toEqual([0.05, 1, 0.05, 0.4, 0.03]);
    expect(r.books[0].box).toEqual([0.035, 0.4, 0.03, 0.6]);
    const [x, y, w, h] = r.books[1].box!;
    expect([x, y, w, h].map(v => +v.toFixed(3))).toEqual([0.1, 0.875, 0.3, 0.05]);
  });
});
