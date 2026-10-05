import { describe, expect, it } from 'vitest';
import { readChoice, writeChoice } from '../batch';

describe('a cover chosen and not written yet', () => {
  it('comes back as it was kept, with the word that a smaller one was chosen knowingly', () => {
    expect(readChoice(writeChoice({ coverId: 'ol:12585750' }))).toEqual({ coverId: 'ol:12585750' });
    expect(readChoice(writeChoice({ coverId: 'ol:7', smaller: true }))).toEqual({ coverId: 'ol:7', smaller: true });
  });

  it('is nothing when the file holds anything else', () => {
    expect(readChoice(undefined)).toBeNull();
    expect(readChoice('')).toBeNull();
    expect(readChoice('ol:7')).toBeNull();
    expect(readChoice('{"coverId":7}')).toBeNull();
    // An id that is not a cover's must never reach the image host.
    expect(readChoice('{"coverId":"../../etc"}')).toBeNull();
    expect(readChoice('{"coverId":"ol:7","smaller":"yes"}')).toEqual({ coverId: 'ol:7' });
  });
});
