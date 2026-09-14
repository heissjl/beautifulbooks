import { describe, expect, it } from 'vitest';
import type { Cover } from '../model';
import type { ImageSignature } from '../imagesig';
import { foldDuplicateCovers, withRetailCovers } from '../works';

const cover = (id: string, ...editionIds: string[]): Cover => ({
  id, url: `https://covers/${id}`, source: id.startsWith('gb:') ? 'googlebooks' : 'openlibrary', editionIds,
});
const sig = (hash: string): ImageSignature => ({ hash, contrast: 60, mean: 120 });

/**
 * ROADMAP 6.37, *Going Postal* on 2026-09-11: `gb:WkePEAAAQBAJ` came from the
 * title search on page 0 and again as Google's image for the selected ISBN.
 */
describe('withRetailCovers', () => {
  const wall = [cover('ol:8448550', 'ol:OL26794407M'), cover('gb:WkePEAAAQBAJ', 'gb:WkePEAAAQBAJ')];

  it('keeps a retail cover that is already on the wall once, and gives it the edition the lookup named', () => {
    const joined = withRetailCovers(wall, [cover('gb:WkePEAAAQBAJ', 'ol:OL26794407M')]);
    expect(joined.map(c => c.id)).toEqual(['ol:8448550', 'gb:WkePEAAAQBAJ']);
    expect(joined[1].editionIds).toEqual(['gb:WkePEAAAQBAJ', 'ol:OL26794407M']);
  });

  it('adds a retail cover the wall does not have, once even when two ISBNs return it', () => {
    const joined = withRetailCovers(wall, [cover('gb:new', 'e1'), cover('gb:new', 'e2')]);
    expect(joined.map(c => c.id)).toEqual(['ol:8448550', 'gb:WkePEAAAQBAJ', 'gb:new']);
    expect(joined[2].editionIds).toEqual(['e1', 'e2']);
  });

  it('changes neither of its inputs', () => {
    const extra = [cover('gb:WkePEAAAQBAJ', 'ol:OL26794407M')];
    withRetailCovers(wall, extra);
    expect(wall[1].editionIds).toEqual(['gb:WkePEAAAQBAJ']);
    expect(extra[0].editionIds).toEqual(['ol:OL26794407M']);
  });

  it('leaves the fold nothing to list twice', () => {
    const signatures = new Map([['ol:8448550', sig('0000000000000000')], ['gb:WkePEAAAQBAJ', sig('0000000000000001')]]);
    const joined = withRetailCovers(wall, [cover('gb:WkePEAAAQBAJ', 'ol:OL26794407M')]);
    const folded = foldDuplicateCovers(joined, signatures);
    expect(folded).toHaveLength(1);
    expect(folded[0].similarIds).toEqual(['gb:WkePEAAAQBAJ']);
  });
});
