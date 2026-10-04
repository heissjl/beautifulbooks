import { describe, expect, it } from 'vitest';
import { isTruth, score } from '../evaluate';

const read = (title: string, author = '') => ({ title, author, kind: 'spine' as const });

describe('the shelf photo test set: scoring a reading against the truth list', () => {
  it('counts a one-word title when the reading contains it, and a misread letter', () => {
    expect(isTruth(read('Babel', 'R. F. Kuang'), read('Babel: An Arcane History', 'R.F. Kuang'))).toBe(true);
    expect(isTruth(read('Blood Dawn', 'Hans van de Ven'), read('Blood Dawn: World War II and the Making of Modern Asia'))).toBe(true);
    expect(isTruth(read('Gliff', 'Ali Smith'), read('Winter', 'Ali Smith'))).toBe(false);
  });

  it('gives hits, misses, authors and what lies beyond the list; an optional book is neither', () => {
    const s = score(
      { file: 'x.jpg', what: '', complete: true, books: [['Babel', 'R. F. Kuang'], ['Assata', 'Assata Shakur'], ['The Odyssey', 'Homer']], optional: [['Monsters', '']] },
      [read('Babel', 'R.F. Kuang'), read('Assata: An Autobiography'), read('Monsters: A Fan’s Dilemma', 'Claire Dederer'), read('Twilight')],
    );
    expect(s).toMatchObject({ truth: 3, read: 4, hit: 2, authorOnPhoto: 2, authorRead: 1, extra: 1, missed: ['The Odyssey — Homer'], extras: ['Twilight'], unsure: 0, hitUnsure: 0, extraUnsure: 0, stumps: 0 });
  });

  it('tells readings the model marked as unsure, and the stumps of cut-off books', () => {
    const s = score(
      { file: 'x.jpg', what: '', complete: false, books: [['Babel', ''], ['Assata', '']], optional: [] },
      [read('Babel'), { ...read('Assata'), unsure: true as const }, { ...read('SETH'), unsure: true as const }, read('Go')],
    );
    expect(s).toMatchObject({ hit: 2, hitUnsure: 1, unsure: 2, extra: 2, extraUnsure: 1, stumps: 2, extras: ['SETH (?)', 'Go'] });
  });
});
