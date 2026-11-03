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
 * A comparison pin (`compare.jpg`, header `X-Pin-Format: compare`) is
 * probed against `lib/comparelayout.ts`: three tiles, and the labels under
 * them — ink in each label (year or publisher), and no ink in the gaps
 * between the labels (a publisher that ran into the next column).
 *
 * Ink is a bright pixel outside the tiles, on the mosaic as on a plain ground
 * (`lib/pinprobe.ts`, with the measurement behind the threshold).
 * The numbers go to docs/history.md; a measurement in the chat is none.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { compareLayoutSized } from '../lib/comparelayout';
import { inkRows, tileFilled } from '../lib/pinprobe';
import { PIN_SIZE, pinLayout, type PinCount } from '../lib/pinlayout';

const OUT_DIR = path.join(process.cwd(), 'docs', 'tests', 'pins');
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
  /** Comparison pins only: labels with ink, and whether ink stands between them. */
  labels?: { inked: number; of: number; between: boolean; to: number };
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
  const compare = res.headers.get('x-pin-format') === 'compare';
  const C = compare ? compareLayoutSized(Number(res.headers.get('x-pin-title-size') ?? 60), titleLines === '1' ? 1 : 2) : null;
  const L = C ?? pinLayout((covers >= 9 ? 9 : 6) as PinCount, { credits, titleLines: titleLines === '1' ? 1 : 2 });
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const w = info.width;
  const tilesTop = L.tiles[0].y;
  const tilesBottom = L.foot.y;

  const head = inkRows(px, w, L.head.x, L.head.x + L.head.width, L.head.y, tilesTop);
  const right = inkRows(px, w, L.head.x + L.head.width + 2, w, L.head.y, tilesTop);
  const foot = inkRows(px, w, L.foot.x, L.foot.x + L.foot.width, tilesBottom, info.height);
  const filled = L.tiles.filter(r => tileFilled(px, w, r)).length;
  let labels: Probe['labels'];
  if (C) {
    const inks = C.labels.map(r => inkRows(px, w, r.x, r.x + r.width, r.y, r.y + r.height));
    let between = false;
    for (let i = 0; i + 1 < C.labels.length; i++) {
      const a = C.labels[i];
      const b = C.labels[i + 1];
      if (inkRows(px, w, a.x + a.width + 1, b.x - 1, a.y, a.y + a.height).from >= 0) between = true;
    }
    labels = { inked: inks.filter(k => k.from >= 0).length, of: C.labels.length, between, to: Math.max(...inks.map(k => k.to)) };
  }

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
    labels,
  };
}

async function main(): Promise<void> {
  const urls = process.argv.slice(2);
  if (urls.length === 0) throw new Error('usage: npx tsx scripts/measure-pins.ts <url> [<url> …]');
  for (const url of urls) if (/buyitscovers\.com/.test(url)) throw new Error('Pins are measured against the dev server, not production (CLAUDE.md).');
  let bad = 0;
  for (const url of urls) {
    const p = await probe(url);
    const labelsOk = !p.labels || (p.labels.inked === p.labels.of && !p.labels.between);
    const ok = p.width === PIN_SIZE.width && p.height === PIN_SIZE.height && p.head.clear && !p.head.overflowRight && p.foot.clear && p.tiles.filled === p.tiles.of && labelsOk;
    if (!ok) bad++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${new URL(url).pathname}: ${p.width}×${p.height} ${p.type} ${(p.bytes / 1024).toFixed(0)} KB in ${(p.ms / 1000).toFixed(1)} s; ` +
      `covers ${p.covers} drawn, ${p.tiles.filled}/${p.tiles.of} tiles filled; title lines reserved ${p.titleLines}; ` +
      `head ink y ${p.head.from}–${p.head.to} (covers begin ${p.head.limit})${p.head.clear ? '' : ' RUNS INTO COVERS'}${p.head.overflowRight ? ' OVERFLOWS RIGHT' : ''}; ` +
      (p.labels ? `labels ${p.labels.inked}/${p.labels.of} inked, end y ${p.labels.to}${p.labels.between ? ' INK BETWEEN COLUMNS' : ''}; ` : '') +
      `foot ink y ${p.foot.from}–${p.foot.to} (margin ${p.foot.limit})${p.foot.clear ? '' : ' PAST MARGIN'}; cache ${p.cache}`,
    );
  }
  if (bad > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
