import { describe, expect, it } from 'vitest';
import { WALL_POOL, WALL_SIZE, WALL_WORKS, wallForHour, wallHour, type CuratedWork } from '../curated';

const pool: CuratedWork[] = Array.from({ length: 100 }, (_, i) => ({ id: `OL${i}W`, title: `T${i}`, author: 'A', coverId: i + 1 }));

describe('wallForHour (ROADMAP 6.17)', () => {
  it('is deterministic per hour', () => {
    expect(wallForHour(480000, pool)).toEqual(wallForHour(480000, pool));
    expect(wallForHour(480000, pool)).not.toEqual(wallForHour(480001, pool));
  });

  it('shows WALL_SIZE distinct works', () => {
    for (const h of [0, 1, 5, 479999, 480000]) {
      const ids = wallForHour(h, pool).map(w => w.id);
      expect(ids).toHaveLength(WALL_SIZE);
      expect(new Set(ids).size).toBe(WALL_SIZE);
    }
  });

  it('shows every work of the pool within a day', () => {
    const seen = new Set<string>();
    for (let h = 0; h < 24; h++) wallForHour(480000 + h, pool).forEach(w => seen.add(w.id));
    expect(seen.size).toBe(pool.length);
  });

  it('shows every work of the real pool within a day, at any starting hour', () => {
    for (const start of [0, 7, 479990]) {
      const seen = new Set<string>();
      for (let h = 0; h < 24; h++) wallForHour(start + h).forEach(w => seen.add(w.id));
      expect(seen.size).toBe(WALL_POOL.length);
    }
  });

  it('keeps the pool order inside a window', () => {
    const w = wallForHour(3, pool);
    expect(w.map(x => x.coverId)).toEqual(Array.from({ length: WALL_SIZE }, (_, i) => 3 * WALL_SIZE + i + 1));
  });

  it('leaves hidden covers out of the pool before windowing, so the wall stays full', () => {
    const hidden = (w: CuratedWork) => w.coverId % 2 === 0;
    for (let h = 0; h < 10; h++) {
      const w = wallForHour(h, pool, WALL_SIZE, hidden);
      expect(w).toHaveLength(WALL_SIZE);
      expect(w.some(hidden)).toBe(false);
    }
  });

  it('shows a small pool whole', () => {
    expect(wallForHour(9, pool.slice(0, 5))).toHaveLength(5);
  });

  it('counts whole UTC hours', () => {
    expect(wallHour(3_599_999)).toBe(0);
    expect(wallHour(3_600_000)).toBe(1);
  });

  it('prerenders a fixed set: the first window', () => {
    expect(WALL_WORKS).toEqual(WALL_POOL.slice(0, WALL_SIZE));
  });
});
