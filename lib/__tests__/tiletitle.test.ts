/**
 * The short title on a small tile (ROADMAP 6.30, SPEC N14, lib/normalize.ts).
 */
import { describe, expect, it } from 'vitest';
import { tileTitle } from '../normalize';

describe('tileTitle', () => {
  it('drops the alternative title', () => {
    expect(tileTitle('Frankenstein; or, The Modern Prometheus')).toBe('Frankenstein');
    expect(tileTitle('Moby-Dick; or, The Whale')).toBe('Moby-Dick');
    expect(tileTitle('Candide, or Optimism')).toBe('Candide');
  });

  it('leaves a title alone that only contains the word', () => {
    expect(tileTitle('Things Fall Apart')).toBe('Things Fall Apart');
    expect(tileTitle('Or Else')).toBe('Or Else');
    expect(tileTitle('To Be or Not to Be')).toBe('To Be or Not to Be');
  });

  it('keeps what displayTitle keeps', () => {
    expect(tileTitle('Der Steppenwolf (Roman)')).toBe('Der Steppenwolf');
  });
});
