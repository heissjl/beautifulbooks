import { describe, expect, it } from 'vitest';
import { browsable, popularFromDocs, type PopularDoc } from '../popularworks';

const doc = (over: Partial<PopularDoc>): PopularDoc => ({
  key: '/works/OL82563W',
  title: 'Harry Potter and the Philosopher’s Stone',
  author_name: ['J. K. Rowling', 'Jim Kay'],
  cover_i: 15155833,
  first_publish_year: 1997,
  edition_count: 400,
  already_read_count: 1710,
  readinglog_count: 24018,
  ratings_count: 1045,
  ...over,
});

describe('popularFromDocs', () => {
  it('keeps the order, the first author and the counts', () => {
    const [w] = popularFromDocs([doc({})]);
    expect(w).toEqual({
      id: 'OL82563W',
      title: 'Harry Potter and the Philosopher’s Stone',
      author: 'J. K. Rowling',
      coverId: 'ol:15155833',
      firstPublished: 1997,
      editionCount: 400,
      alreadyRead: 1710,
      readingLog: 24018,
      ratings: 1045,
    });
  });

  it('leaves out what cannot be shown or named', () => {
    const rows = popularFromDocs([
      doc({ key: '/works/OL1W', cover_i: undefined }),
      doc({ key: '/works/OL2W', cover_i: -1 }),
      doc({ key: '/works/OL3W', author_name: [] }),
      doc({ key: '/works/OL4W', title: ' ' }),
      doc({ key: '/authors/OL5A' }),
    ]);
    expect(rows).toEqual([]);
  });

  it('takes a second record of the same book once, the first one', () => {
    const rows = popularFromDocs([
      doc({ key: '/works/OL1168083W', title: 'Nineteen Eighty-Four', author_name: ['George Orwell'] }),
      doc({ key: '/works/OL999W', title: 'Nineteen eighty-four', author_name: ['George Orwell'] }),
      doc({ key: '/works/OL1168083W', title: 'Nineteen Eighty-Four', author_name: ['George Orwell'] }),
      doc({ key: '/works/OL1168007W', title: 'Animal Farm', author_name: ['George Orwell'] }),
    ]);
    expect(rows.map(r => r.id)).toEqual(['OL1168083W', 'OL1168007W']);
  });

  it('writes zero for a count Open Library does not send, and no year', () => {
    const [w] = popularFromDocs([doc({ first_publish_year: undefined, edition_count: undefined, ratings_count: undefined })]);
    expect(w.firstPublished).toBeUndefined();
    expect(w.editionCount).toBe(0);
    expect(w.ratings).toBe(0);
  });
});

describe('browsable', () => {
  it('cuts by editions on record and keeps the order', () => {
    const rows = popularFromDocs([
      doc({ key: '/works/OL1W', title: 'A', edition_count: 3 }),
      doc({ key: '/works/OL2W', title: 'B', edition_count: 40 }),
      doc({ key: '/works/OL3W', title: 'C', edition_count: 10 }),
    ]);
    expect(browsable(rows, 10).map(r => r.id)).toEqual(['OL2W', 'OL3W']);
  });
});
