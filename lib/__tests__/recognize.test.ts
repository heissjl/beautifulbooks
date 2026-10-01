import { describe, expect, it } from 'vitest';
import { parseRecognition, scanPartial } from '../recognize';

describe('parseRecognition (5.11a): a point per book', () => {
  it('reads title, author, kind and the point as fractions', () => {
    const r = parseRecognition('{"books": [{"t": " The  Plague ", "a": "Albert Camus", "k": "spine", "x": 42, "y": 57}, {"t": "Happy Days", "a": "", "k": "cover", "x": 50, "y": 50}]}');
    expect(r.problems).toEqual([]);
    expect(r.books).toEqual([
      { title: 'The Plague', author: 'Albert Camus', kind: 'spine', x: 0.42, y: 0.57 },
      { title: 'Happy Days', author: '', kind: 'cover', x: 0.5, y: 0.5 },
    ]);
  });

  it('keeps a book whose point is unusable, without the point, and says so', () => {
    const r = parseRecognition('{"books": [{"t": "Jazz", "a": "Toni Morrison", "k": "spine", "x": "left", "y": null}]}');
    expect(r.books).toEqual([{ title: 'Jazz', author: 'Toni Morrison', kind: 'spine' }]);
    expect(r.problems).toEqual(['#1: Mitte unbrauchbar', '#1: Höhe unbrauchbar']);
  });
});

describe('scanPartial (5.11a): books from an answer still arriving', () => {
  const answer = '{"books": [{"t": "Dune", "a": "Frank Herbert", "k": "spine", "x": 10, "y": 30}, {"t": "Beloved {with} \\"braces\\"", "a": "Toni Morrison", "k": "cover", "x": 70, "y": 80}]}';

  it('finds nothing before the list of books has begun', () => {
    expect(scanPartial('{"bo')).toEqual({ books: [] });
  });

  it('hands out each book the moment its object has closed', () => {
    const upToFirst = answer.indexOf('}') + 1;
    expect(scanPartial(answer.slice(0, upToFirst)).books).toEqual([{ title: 'Dune', author: 'Frank Herbert', kind: 'spine', x: 0.1, y: 0.3 }]);
    // Half of the second object: still one book.
    expect(scanPartial(answer.slice(0, upToFirst + 30)).books).toHaveLength(1);
  });

  it('is not fooled by braces or quotes inside a title', () => {
    const all = scanPartial(answer);
    expect(all.books.map((b) => b.title)).toEqual(['Dune', 'Beloved {with} "braces"']);
    expect(all.books[1]).toMatchObject({ kind: 'cover', x: 0.7, y: 0.8 });
  });

  it('stops at the end of the list', () => {
    expect(scanPartial(answer + '{"t": "After the list"}').books).toHaveLength(2);
  });
});
