import { describe, expect, it } from 'vitest';
import type { WorkSummary } from '../model';
import { matchPhotoBooks, tileFromWork } from '../walls/photo';

const work = (id: string, title: string, author: string, cover = 12345): WorkSummary => ({
  id,
  title,
  authors: [author],
  coverUrls: [`https://covers.openlibrary.org/b/id/${cover}-L.jpg`],
  languages: [],
});

const book = (title: string, author: string) => ({ title, author, kind: 'spine' as const, confidence: 0.9 });

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
});
