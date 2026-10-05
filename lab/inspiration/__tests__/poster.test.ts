import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { emptyBoard, place } from '../../../lib/inspiration/board';
import { posterLayout } from '../../../lib/inspiration/layout';
import { renderPoster } from '../poster';

const TEXT = { title: 'The books that inspired me', site: 'Buy Its Covers', address: 'buyitscovers.com/inspiration' };

/** A flat red "cover" of an awkward size, no network. */
const red = () => sharp({ create: { width: 180, height: 290, channels: 3, background: '#d00000' } }).jpeg().toBuffer();

describe('renderPoster', () => {
  it('paints the chosen cover into its tile and survives a silent source', async () => {
    let board = place(emptyBoard(), 0, { workId: 'OL1W', coverId: 'ol:1' });
    board = place(board, 4, { workId: 'OL2W', coverId: 'ol:2' });
    const bytes = await red();
    const png = await renderPoster({ ...board, by: 'Julian' }, 'story', TEXT, async id => (id === 'ol:1' ? bytes : null));

    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([1080, 1920]);
    // Whole pixels: a tile's height may be odd (375 in a story since its words moved into the safe block).
    const px = (fx: number, fy: number) => { const x = Math.floor(fx), y = Math.floor(fy); return [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)]; };
    const [t0, , , , t4] = posterLayout('story').tiles;
    const [r, g, b] = px(t0.x + t0.width / 2, t0.y + t0.height / 2);
    expect(r).toBeGreaterThan(180);
    expect(g + b).toBeLessThan(60);
    // Slot 4 has a book but its image did not come: an empty tile, not a crash.
    expect(px(t4.x + t4.width / 2, t4.y + t4.height / 2)[0]).toBeLessThan(80);
  });
});
