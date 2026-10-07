import { describe, expect, it } from 'vitest';
import { captionLines } from '../inspiration/captionlines';

describe('a title under a cover', () => {
  it('stays on one line when it fits', () => {
    expect(captionLines('About Looking', 15)).toEqual(['About Looking']);
  });

  it('takes a second line between words instead of cutting the title', () => {
    expect(captionLines('Ways of Seeing', 12)).toEqual(['Ways of', 'Seeing']);
    expect(captionLines('Understanding a Photograph', 15)).toEqual(['Understanding a', 'Photograph']);
  });

  it('ends with an ellipsis only when two lines are not enough', () => {
    const lines = captionLines('And our faces, my heart, brief as photos', 15);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('And our faces,');
    expect(lines[1].endsWith('…')).toBe(true);
    expect(lines[1].length).toBeLessThanOrEqual(15);
  });

  it('cuts a word longer than a line and never returns more lines than asked', () => {
    const lines = captionLines('Donaudampfschifffahrtsgesellschaft', 10);
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.length <= 10)).toBe(true);
    expect(captionLines('', 10)).toEqual([]);
  });
});
