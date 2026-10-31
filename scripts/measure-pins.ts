/**
 * The N14 measurement of a pin picture (ROADMAP 5.5a): a pixel probe where
 * `/messen` would read the DOM, because a pin is a JPEG.
 *
 *   npx tsx scripts/measure-pins.ts <url> [<url> …]
 *
 * Against the dev server only; an address at buyitscovers.com is refused.
 * Each picture is saved under `docs/tests/pins/` (git-ignored) and probed
 * against `lib/pinlayout.ts`, with the route's own headers saying how many
 * covers it drew and how many title lines it reserved:
 *
 * - size 1000 × 1500 and `image/jpeg`;
 * - the head: where the type's ink begins and ends, and that it ends above
 *   the covers (a title that wraps where one line was reserved runs into
 *   them), and no ink right of the margin (a word that did not fit);
 * - the tiles: how many hold a picture (not the empty tile colour);
 * - the foot: where its ink ends, above the bottom margin.
 *
 * Ink is any pixel far from the ground colour (#131110) outside the tiles.
 * The numbers go to docs/history.md; a measurement in the chat is none.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { PIN_SIZE, pinLayout, type PinCount, type Rect } from '../lib/pinlayout';

const OUT_DIR = path.join(process.cwd(), 'docs', 'tests', 'pins');
const GROUND = [0x13, 0x11, 0x10];
const EMPTY_TILE = [0x26, 0x22, 0x1f];
const INK_DISTANCE = 60;

interface Probe {
  url: string;
  status: number;
  type: string;
  width: number;
  height: number;
  bytes: number;
  ms: number;
  covers: number;
  titleLines: string;
  cache: string;
  head: { from: number; to: number; limit: number; clear: boolean; overflowRight: boolean };
  tiles: { filled: number; of: number };
  foot: { from: number; to: number; limit: number; clear: boolean };
}

function far(px: Uint8Array, at: number, colour: number[]): boolean {
  return Math.abs(px[at] - colour[0]) + Math.abs(px[at + 1] - colour[1]) + Math.abs(px[at + 2] - colour[2]) > INK_DISTANCE;
}

function inkRows(px: Uint8Array, width: number, x0: number, x1: number, y0: number, y1: number): { from: number; to: number } {
  let from = -1;
  let to = -1;
  for (let y = y0; y < y1; y++) {
    let ink = false;
    for (let x = x0; x < x1 && !ink; x++) ink = far(px, (y * width + x) * 3, GROUND);
    if (ink) {
      if (from < 0) from = y;
      to = y;
    }
  }
  return { from, to };
}

function tileFilled(px: Uint8Array, width: number, r: Rect): boolean {
  // The middle of the tile: a cover is never the empty colour there.
  let different = 0;
  const samples = 64;
  for (let i = 0; i < samples; i++) {
    const x = r.x + Math.round(((i % 8) + 0.5) * (r.width / 8));
    const y = r.y + Math.round((Math.floor(i / 8) + 0.5) * (r.height / 8));
    if (far(px, (y * width + x) * 3, EMPTY_TILE)) different++;
  }
  return different > samples / 4;
}

async function probe(url: string): Promise<Probe> {
  const started = Date.now();
  const res = await fetch(url);
  const ms = Date.now() - started;
  const bytes = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') ?? '';
  const name = `${new URL(url).pathname.replace(/^\//, '').replace(/\//g, '-')}`;
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, name), bytes);
  if (!res.ok || !type.startsWith('image/')) throw new Error(`${url}: ${res.status} ${type} ${bytes.toString('utf8').slice(0, 200)}`);

  const covers = Number(res.headers.get('x-pin-covers') ?? 0);
  const credits = res.headers.get('x-pin-credits') === '1';
  const titleLines = res.headers.get('x-pin-title-lines') ?? '?';
  const L = pinLayout((covers >= 9 ? 9 : 6) as PinCount, { credits, titleLines: titleLines === '1' ? 1 : 2 });
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const w = info.width;
  const tilesTop = L.tiles[0].y;
  const tilesBottom = L.foot.y;

  const head = inkRows(px, w, L.head.x, L.head.x + L.head.width, L.head.y, tilesTop);
  const right = inkRows(px, w, L.head.x + L.head.width + 2, w, L.head.y, tilesTop);
  const foot = inkRows(px, w, L.foot.x, L.foot.x + L.foot.width, tilesBottom, info.height);
  const filled = L.tiles.filter(r => tileFilled(px, w, r)).length;

  return {
    url,
    status: res.status,
    type,
    width: info.width,
    height: info.height,
    bytes: bytes.length,
    ms,
    covers,
    titleLines,
    cache: res.headers.get('cache-control') ?? '',
    head: { ...head, limit: tilesTop, clear: head.to >= 0 && head.to < tilesTop - 4, overflowRight: right.from >= 0 },
    tiles: { filled, of: L.tiles.length },
    foot: { ...foot, limit: info.height - L.head.y, clear: foot.to >= 0 && foot.to <= info.height - L.head.y + 4 },
  };
}

async function main(): Promise<void> {
  const urls = process.argv.slice(2);
  if (urls.length === 0) throw new Error('usage: npx tsx scripts/measure-pins.ts <url> [<url> …]');
  for (const url of urls) if (/buyitscovers\.com/.test(url)) throw new Error('Pins are measured against the dev server, not production (CLAUDE.md).');
  let bad = 0;
  for (const url of urls) {
    const p = await probe(url);
    const ok = p.width === PIN_SIZE.width && p.height === PIN_SIZE.height && p.head.clear && !p.head.overflowRight && p.foot.clear && p.tiles.filled === p.tiles.of;
    if (!ok) bad++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${new URL(url).pathname}: ${p.width}×${p.height} ${p.type} ${(p.bytes / 1024).toFixed(0)} KB in ${(p.ms / 1000).toFixed(1)} s; ` +
      `covers ${p.covers} drawn, ${p.tiles.filled}/${p.tiles.of} tiles filled; title lines reserved ${p.titleLines}; ` +
      `head ink y ${p.head.from}–${p.head.to} (covers begin ${p.head.limit})${p.head.clear ? '' : ' RUNS INTO COVERS'}${p.head.overflowRight ? ' OVERFLOWS RIGHT' : ''}; ` +
      `foot ink y ${p.foot.from}–${p.foot.to} (margin ${p.foot.limit})${p.foot.clear ? '' : ' PAST MARGIN'}; cache ${p.cache}`,
    );
  }
  if (bad > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
