import { describe, expect, it } from 'vitest';
import { inkRows, INK_MIN, isInk, tileFilled } from '../pinprobe';

const W = 100;
const H = 100;

/** An RGB picture of one colour, with boxes painted on it. */
function picture(ground: number[], boxes: Array<{ x: number; y: number; w: number; h: number; colour: number[] }> = []): Uint8Array {
  const px = new Uint8Array(W * H * 3);
  const paint = (x: number, y: number, c: number[]) => px.set(c, (y * W + x) * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) paint(x, y, ground);
  for (const b of boxes) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) paint(x, y, b.colour);
  return px;
}

/** The brightest a mosaic cell can be on a pin: white at 45 %. */
const BRIGHTEST_GROUND = [115, 115, 115];
const INK = [0xf4, 0xf0, 0xe8];
/** The address and the author line. */
const INK2 = [0xa8, 0xa0, 0x9a];
const FLAT_GROUND = [0x13, 0x11, 0x10];

describe('ink on a pin (ROADMAP 5.5a)', () => {
  it('takes the brightest mosaic for ground and both type colours for ink', () => {
    expect(isInk(new Uint8Array(BRIGHTEST_GROUND), 0)).toBe(false);
    expect(isInk(new Uint8Array(FLAT_GROUND), 0)).toBe(false);
    expect(isInk(new Uint8Array(INK), 0)).toBe(true);
    expect(isInk(new Uint8Array(INK2), 0)).toBe(true);
    expect(BRIGHTEST_GROUND[0] * 3).toBeLessThan(INK_MIN);
  });

  it('finds no ink on a bright mosaic', () => {
    expect(inkRows(picture(BRIGHTEST_GROUND), W, 0, W, 0, H)).toEqual({ from: -1, to: -1 });
  });

  it('still reports a word on the mosaic, and where it runs past a margin', () => {
    const px = picture(BRIGHTEST_GROUND, [{ x: 10, y: 20, w: 85, h: 10, colour: INK2 }]);
    expect(inkRows(px, W, 0, W, 0, H)).toEqual({ from: 20, to: 29 });
    expect(inkRows(px, W, 92, W, 0, H)).toEqual({ from: 20, to: 29 });
    expect(inkRows(px, W, 96, W, 0, H)).toEqual({ from: -1, to: -1 });
  });

  it('looks only inside its box', () => {
    const px = picture(FLAT_GROUND, [{ x: 0, y: 50, w: W, h: 5, colour: INK }]);
    expect(inkRows(px, W, 0, W, 0, 50)).toEqual({ from: -1, to: -1 });
    expect(inkRows(px, W, 0, W, 50, H).from).toBe(50);
  });
});

describe('a tile', () => {
  const tile = { x: 10, y: 10, width: 60, height: 80 };

  it('is empty in the empty colour, whatever stands around it', () => {
    expect(tileFilled(picture(BRIGHTEST_GROUND, [{ x: 10, y: 10, w: 60, h: 80, colour: [0x26, 0x22, 0x1f] }]), W, tile)).toBe(false);
  });

  it('is filled by a light cover and by a black one with a line on it', () => {
    expect(tileFilled(picture(FLAT_GROUND, [{ x: 10, y: 10, w: 60, h: 80, colour: [200, 40, 40] }]), W, tile)).toBe(true);
    const black = picture(FLAT_GROUND, [{ x: 10, y: 10, w: 60, h: 80, colour: [0x20, 0x20, 0x20] }, { x: 10, y: 40, w: 60, h: 8, colour: [240, 240, 240] }]);
    expect(tileFilled(black, W, tile)).toBe(true);
  });
});
