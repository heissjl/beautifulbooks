import { describe, expect, it } from 'vitest';
import { cosine, nearest, sampleOnePerWork } from '../rank';

describe('haiku rank', () => {
  it('samples one cover per work, spread across the list', () => {
    const works = [['W0', 'a', 'x'], ['W1', 'b', 'y'], ['W2', 'c', 'z'], ['W3', 'd', 'q']] as const;
    const covers = [[0, 'ol:1'], [0, 'ol:2'], [2, 'ol:3'], [3, 'ol:4']] as const;
    const s = sampleOnePerWork(works, covers, 2);
    expect(s.map((c) => c.coverId)).toEqual(['ol:1', 'ol:3']);
  });
  it('ranks by cosine and never returns itself', () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
    const n = nearest([[1, 0], [0.9, 0.1], [0, 1]], 0, 2);
    expect(n.map((x) => x.index)).toEqual([1, 2]);
  });
});
