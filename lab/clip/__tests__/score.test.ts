import { describe, expect, it } from 'vitest';
import { atRecall, auc, cosine, fromBase64, notCoverProbability, separation, strongestPrompt, toBase64 } from '../score';

describe('cosine', () => {
  it('is 1 for the same direction, 0 for orthogonal, and 0 for a zero vector', () => {
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe('notCoverProbability', () => {
  const cover = [1, 0, 0];
  const page = [0, 1, 0];
  it('leans to the side whose prompt the image is nearer', () => {
    expect(notCoverProbability([1, 0.1, 0], [cover], [page])).toBeLessThan(0.01);
    expect(notCoverProbability([0.1, 1, 0], [cover], [page])).toBeGreaterThan(0.99);
  });
  it('is one half when the image is as near to both', () => {
    expect(notCoverProbability([1, 1, 0], [cover], [page])).toBeCloseTo(0.5);
  });
  it('names the nearest prompt', () => {
    expect(strongestPrompt([0.2, 1, 0], [cover, page])).toBe(1);
  });
});

describe('auc', () => {
  it('is 1 when every positive scores above every negative, 0.5 for ties', () => {
    expect(auc([0.9, 0.8], [0.1, 0.2])).toBe(1);
    expect(auc([0.5], [0.5])).toBe(0.5);
    expect(auc([0.1], [0.9])).toBe(0);
  });
});

describe('atRecall', () => {
  it('counts the negatives at or above the threshold that keeps the share', () => {
    const r = atRecall([0.9, 0.8, 0.3, 0.2], [0.85, 0.5, 0.1], 0.5);
    expect(r).toEqual({ threshold: 0.8, caught: 2, falseAlarms: 1 });
    expect(atRecall([0.9, 0.8, 0.3, 0.2], [0.85, 0.5, 0.1], 1).falseAlarms).toBe(2);
  });
});

describe('separation', () => {
  it('finds a threshold when every same pair is more similar than every different one', () => {
    expect(separation([0.95, 0.9], [0.7, 0.8])).toEqual({ worstSame: 0.9, bestDiff: 0.8, separates: true, overlap: 0 });
  });
  it('counts the pairs caught in the overlap', () => {
    const s = separation([0.95, 0.75], [0.7, 0.8]);
    expect(s.separates).toBe(false);
    expect(s.overlap).toBe(2);
  });
});

describe('base64 round trip', () => {
  it('keeps every float', () => {
    const v = new Float32Array([0.25, -1.5, 3e-5]);
    expect([...fromBase64(toBase64(v))]).toEqual([...v]);
  });
});
