import { describe, expect, it } from 'vitest';
import type { WorkSummary } from '../model';
import { matchPhotoBooks, matchPhotoBooksEach, MAX_PHOTO_BOOKS, tileFromWork } from '../walls/photo';

const work = (id: string, title: string, author: string, cover = 12345): WorkSummary => ({
  id,
  title,
  authors: [author],
  coverUrls: [`https://covers.openlibrary.org/b/id/${cover}-L.jpg`],
  languages: [],
});

const book = (title: string, author: string) => ({ title, author, kind: 'spine' as const });

describe('matchPhotoBooks', () => {
  it('takes the work whose author and title agree, with its usual cover', async () => {
    const find = async () => [work('OL1W', 'Animal Farm: A Study Guide', 'Someone'), work('OL2W', 'Animal Farm', 'George Orwell', 777)];
    const [m] = await matchPhotoBooks([book('Animal Farm', 'ORWELL')], find);
    expect(m.tile).toMatchObject({ workId: 'OL2W', coverId: '777', title: 'Animal Farm', printings: [] });
    expect(m.reason).toBe('author+title');
  });

  it('tries the title alone when the author was misread', async () => {
    const calls: string[] = [];
    const find = async (q: string) => {
      calls.push(q);
      return q === 'Beloved' ? [work('OL3W', 'Beloved', 'Toni Morrison')] : [];
    };
    const [m] = await matchPhotoBooks([book('Beloved', 'Morisson Tony')], find);
    expect(calls).toEqual(['Beloved Morisson Tony', 'Beloved']);
    expect(m.tile?.workId).toBe('OL3W');
  });

  it('marks a hit by title alone as unsure (5.11a): offered, but not as a finding', async () => {
    const [m] = await matchPhotoBooks([book('The Virgin', '')], async () => [work('OL5W', 'The Virgin', 'Jeffrey Eugenides')]);
    expect(m.tile?.workId).toBe('OL5W');
    expect(m.reason).toBe('title-only');
    expect(m.unsure).toBe(true);
    const [sure] = await matchPhotoBooks([book('Beloved', 'Toni Morrison')], async () => [work('OL3W', 'Beloved', 'Toni Morrison')]);
    expect(sure.unsure).toBeUndefined();
  });

  it('offers nothing when neither author nor title agrees, rather than the first hit', async () => {
    const [m] = await matchPhotoBooks([book('In Nacht und Eis', 'Nansen')], async () => [work('OL9W', 'Titanic', 'Someone Else')]);
    expect(m.tile).toBeUndefined();
    expect(m.failed).toBeUndefined();
  });

  it('says when the search failed instead of reporting nothing found', async () => {
    const [m] = await matchPhotoBooks([book('Dune', 'Herbert')], async () => {
      throw new Error('timeout');
    });
    expect(m).toEqual({ read: { title: 'Dune', author: 'Herbert', kind: 'spine' }, failed: true });
  });

  it('prefers the cover Julian picked for a curated work', () => {
    expect(tileFromWork(work('OL468431W', 'The Great Gatsby', 'F. Scott Fitzgerald', 1))?.coverId).toBe('13853193');
  });

  it('offers no tile for a work without a cover', () => {
    expect(tileFromWork({ ...work('OL4W', 'X', 'Y'), coverUrls: [] })).toBeUndefined();
  });

  it('looks books up three at a time and hands each result on as it comes, in the photo\'s order at the end', async () => {
    let inFlight = 0;
    let most = 0;
    const find = async (q: string) => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, q.includes('slow') ? 30 : 1));
      inFlight--;
      return [work(`OL${q.length}W`, q, 'Same Author')];
    };
    const seen: number[] = [];
    const books = ['slow one', 'two', 'three', 'four', 'five'].map((t) => book(t, 'Same Author'));
    const out = await matchPhotoBooksEach(books, (i) => seen.push(i), find);
    expect(most).toBe(3);
    expect(seen[0]).not.toBe(0);
    expect(seen).toHaveLength(5);
    expect(out.map((m) => m.read.title)).toEqual(['slow one', 'two', 'three', 'four', 'five']);
    expect(out.every((m) => m.tile)).toBe(true);
  });

  it('reads no more than the cap', async () => {
    const many = Array.from({ length: MAX_PHOTO_BOOKS + 5 }, (_, i) => book(`B${i}`, 'A'));
    const out = await matchPhotoBooksEach(many, () => {}, async () => []);
    expect(out).toHaveLength(MAX_PHOTO_BOOKS);
  });
});
