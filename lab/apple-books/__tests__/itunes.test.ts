import { describe, expect, it } from 'vitest';
import { artistMatches, artworkAt, artworkKey, candidatesFor, matchResult, type ItunesResult } from '../itunes';

const gatsby = { id: 'OL468431W', title: 'The Great Gatsby(Published In 1925)', author: 'F. Scott Fitzgerald', aliases: ['Der große Gatsby'] };
const art = (n: number) => `https://is1-ssl.mzstatic.com/image/thumb/Publication1/v4/x/${n}.jpg/100x100bb.jpg`;
const r = (trackId: number, trackName: string, artistName: string, image = trackId): ItunesResult =>
  ({ trackId, trackName, artistName, artworkUrl100: art(image), releaseDate: '2024-02-03T08:00:00Z' });

describe('artistMatches', () => {
  it('finds the author among several people and in surname-first form', () => {
    expect(artistMatches('Jane Austen & Vivien Jones', 'Jane Austen')).toBe(true);
    expect(artistMatches('Austen, Jane & Jane Austen', 'Jane Austen')).toBe(true);
    expect(artistMatches('J Austen', 'Jane Austen')).toBe(true);
    expect(artistMatches('Jane Austin', 'Jane Austen')).toBe(false);
  });
});

describe('matchResult', () => {
  it('matches the work title, ignoring the bracket note and the article', () => {
    expect(matchResult(r(1, 'The Great Gatsby', 'F. Scott Fitzgerald'), gatsby)).toBe('title');
  });
  it('drops the author from a title only when it is the author', () => {
    expect(matchResult(r(2, 'Fitzgerald - The Great Gatsby', 'F. Scott Fitzgerald'), gatsby)).toBe('title');
    expect(matchResult(r(3, 'The Great Gatsby - Teil 1', 'F. Scott Fitzgerald'), gatsby)).toBeNull();
  });
  it('tells an alias from the title', () => {
    expect(matchResult(r(4, 'Der große Gatsby', 'F. Scott Fitzgerald'), gatsby)).toBe('alias');
  });
  it('refuses guides and other authors', () => {
    expect(matchResult(r(5, 'The Great Gatsby: Study Guide', 'SparkNotes'), gatsby)).toBeNull();
    expect(matchResult(r(6, 'Gatsby', 'F. Scott Fitzgerald'), gatsby)).toBeNull();
  });
});

describe('artwork', () => {
  it('asks for any size and keys the image without it', () => {
    expect(artworkAt(art(7), 2000)).toMatch(/\/7\.jpg\/2000x2000bb\.jpg$/);
    expect(artworkKey(art(7))).toMatch(/\/7\.jpg$/);
  });
});

describe('candidatesFor', () => {
  it('keeps one candidate per image and remembers each store', () => {
    const { candidates, rejected } = candidatesFor([
      { country: 'us', results: [r(1, 'The Great Gatsby', 'F. Scott Fitzgerald', 9), r(5, 'Gatsby Notes', 'Someone')] },
      { country: 'de', results: [r(2, 'The Great Gatsby', 'F. Scott Fitzgerald', 9), r(4, 'Der große Gatsby', 'F. Scott Fitzgerald')] },
    ], gatsby);
    expect(candidates.map(c => [c.trackId, c.countries, c.matchedBy, c.year])).toEqual([
      [1, ['us', 'de'], 'title', 2024],
      [4, ['de'], 'alias', 2024],
    ]);
    expect(rejected).toEqual([{ title: 'Gatsby Notes', artist: 'Someone' }]);
  });
});
