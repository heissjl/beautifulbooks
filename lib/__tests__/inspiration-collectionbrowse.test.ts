import { describe, expect, it } from 'vitest';
import type { Collection } from '@/lib/collections';
import { collectionEntries, pickerWorks } from '@/lib/inspiration/collectionbrowse';

const work = (id: string, coverId: number, extra: Record<string, unknown> = {}) => ({ id, title: `T ${id}`, author: 'A', coverId, ...extra });
const collection = (slug: string, published: boolean, works: ReturnType<typeof work>[]): Collection =>
  ({ slug, title: `C ${slug}`, kind: 'series', intro: '', published, scope: [], works } as unknown as Collection);

describe('pickerWorks', () => {
  it('offers a book with the collection’s cover, but not a site-served image, a cover under another work or a second copy', () => {
    const c = collection('a', true, [work('OL1W', 11), work('OL2W', 0, { image: '/collection-covers/a/x.jpg' }), work('OL3W', 33, { coverWork: 'OL9W' }), work('OL1W', 12), work('OL4W', 44)]);
    expect(pickerWorks(c)).toEqual([
      { id: 'OL1W', title: 'T OL1W', author: 'A', coverId: 'ol:11' },
      { id: 'OL4W', title: 'T OL4W', author: 'A', coverId: 'ol:44' },
    ]);
  });
});

describe('collectionEntries', () => {
  it('lists published collections that can offer a book, in order, with the count', () => {
    const list = [
      collection('one', true, [work('OL1W', 1), work('OL2W', 2)]),
      collection('draft', false, [work('OL3W', 3)]),
      collection('images', true, [work('OL4W', 0, { image: '/collection-covers/images/x.jpg' })]),
      collection('two', true, [work('OL5W', 5)]),
    ];
    expect(collectionEntries(list)).toEqual([
      { slug: 'one', title: 'C one', count: 2 },
      { slug: 'two', title: 'C two', count: 1 },
    ]);
  });
});
