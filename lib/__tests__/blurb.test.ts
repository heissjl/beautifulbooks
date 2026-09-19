/**
 * The work description from Open Library as a blurb (ROADMAP 6.46):
 * markdown cleaning, source attribution, and the server-side switch.
 */
import { describe, expect, it } from 'vitest';
import { cleanDescription, descriptionSource, workDescriptionPolicy } from '../blurb';

describe('cleanDescription', () => {
  it('reads both shapes Open Library uses', () => {
    expect(cleanDescription('A novel.')).toBe('A novel.');
    expect(cleanDescription({ type: '/type/text', value: 'A novel.' })).toBe('A novel.');
    expect(cleanDescription(undefined)).toBeUndefined();
    expect(cleanDescription({ type: '/type/text' })).toBeUndefined();
    expect(cleanDescription('   ')).toBeUndefined();
  });

  it('turns links and footnotes into their text', () => {
    // The shape measured on 2026-09-13: a sentence with a reference link and
    // the link definition at the end.
    const raw = 'A story of Jay Gatsby ([source][1]) set on Long Island.\n\n[1]: https://en.wikipedia.org/wiki/The_Great_Gatsby';
    expect(cleanDescription(raw)).toBe('A story of Jay Gatsby set on Long Island.');
    expect(cleanDescription('See [the novel](https://example.org) here.')).toBe('See the novel here.');
  });

  it('drops the trailing "also contained in" list and a source line', () => {
    const raw = 'The book.\n\n----------\nAlso contained in:\n- [Omnibus](https://example.org)\n- Another';
    expect(cleanDescription(raw)).toBe('The book.');
    expect(cleanDescription('The book.\nSource: Wikipedia')).toBe('The book.');
  });

  it('removes emphasis and headings but keeps the words', () => {
    expect(cleanDescription('**Bold** and *italic* and _under_.')).toBe('Bold and italic and under.');
    expect(cleanDescription('# Title\nBody.')).toBe('Title\nBody.');
    // An underscore inside a word is not emphasis.
    expect(cleanDescription('snake_case_name stays')).toBe('snake_case_name stays');
  });

  it('keeps paragraphs and collapses stray whitespace', () => {
    expect(cleanDescription('One.  \n\n\n\nTwo.')).toBe('One.\n\nTwo.');
  });
});

describe('descriptionSource', () => {
  it('names Wikipedia when the text does, else Open Library', () => {
    expect(descriptionSource('Plot. ([source][1])\n[1]: https://en.wikipedia.org/wiki/X')).toBe('wikipedia');
    expect(descriptionSource({ value: 'From Wikipedia, the free encyclopedia.' })).toBe('wikipedia');
    expect(descriptionSource('Publisher copy.')).toBe('openlibrary');
  });
});

describe('workDescriptionPolicy', () => {
  it('defaults to the fallback and knows the switch', () => {
    expect(workDescriptionPolicy(undefined)).toBe('fallback');
    expect(workDescriptionPolicy('')).toBe('fallback');
    expect(workDescriptionPolicy('editions')).toBe('fallback');
    expect(workDescriptionPolicy('work')).toBe('always');
    expect(workDescriptionPolicy(' Work ')).toBe('always');
    expect(workDescriptionPolicy('off')).toBe('never');
  });

  it('fails loudly on a typo instead of silently falling back', () => {
    expect(() => workDescriptionPolicy('wrok')).toThrow(/BLURB_SOURCE/);
  });
});
