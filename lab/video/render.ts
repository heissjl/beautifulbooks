/**
 * Builds one vertical clip of a work's covers (lab/video/README.md, ROADMAP 5.5).
 *
 * Run:
 *   npx tsx lab/video/render.ts OL893414W
 *   npx tsx lab/video/render.ts OL468431W --count 30 --seconds 15
 *   npx tsx lab/video/render.ts OL893414W --lang de --count 20
 *
 * Writes under lab/video/out/<workId>/ (git-ignored): one PNG per shot in
 * frames/, the ffmpeg concat list, encode.sh, an animated WebP preview, and —
 * when ffmpeg is installed — <workId>.mp4 (H.264, yuv420p, 1080×1920).
 *
 * **Generate yes, post by hand.** Nothing here uploads anything anywhere, and
 * the rights question of 5.5 is open until Julian answers it.
 *
 * **No Google Books** (lab/README.md rule 6): the data comes from Open
 * Library's work and editions endpoints only, and every fetch goes through a
 * gate that refuses googleapis.com outright and counts requests per host, so
 * "zero Google requests" is a measurement, not a promise. The same gate
 * keeps Open Library polite: one request at a time per host, ≥ 1.1 s between
 * openlibrary.org API calls and ≥ 0.3 s between cover images.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { indexSignatures } from '../../lib/coverindex';
import { signature, type ImageSignature } from '../../lib/imagehash';
import type { Cover, Edition, SourceEdition, Work } from '../../lib/model';
import { SITE_NAME } from '../../lib/seo';
import { fetchBytes } from '../../lib/sources/http';
import { OL_EDITIONS_PAGE, getEditionsPage, getWork } from '../../lib/sources/openlibrary';
import { parseEditions } from '../../lib/sources/openlibrary-parse';
import { MAX_EDITIONS_SCANNED } from '../../lib/work';
import { assembleEditions } from '../../lib/works';
import { storyboard, type CardShot, type CoverShot, type Storyboard } from './storyboard';

const ROOT = path.join('lab', 'video', 'out');
const CACHE = path.join(ROOT, 'cache');

// ---------------------------------------------------------------------------
// The fetch gate: politeness and the request count.

const GAP_MS = { 'openlibrary.org': 1100, covers: 300 } as const;
const requestsByHost = new Map<string, number>();
const lanes = new Map<string, Promise<void>>();
const lastEnd = new Map<string, number>();
const realFetch = globalThis.fetch;

function laneOf(host: string): keyof typeof GAP_MS | 'other' {
  if (host === 'covers.openlibrary.org' || host.endsWith('archive.org')) return 'covers';
  if (host === 'openlibrary.org') return 'openlibrary.org';
  return 'other';
}

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (/(^|\.)googleapis\.com$|(^|\.)google\.com$/.test(url.hostname)) {
    throw new Error(`refused: ${url.hostname} (no Google Books from lab/, rule 6)`);
  }
  const lane = laneOf(url.hostname);
  const previous = lanes.get(lane) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>(r => { release = r; });
  lanes.set(lane, previous.then(() => mine));
  await previous;
  if (lane !== 'other') {
    const wait = (lastEnd.get(lane) ?? 0) + GAP_MS[lane] - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }
  requestsByHost.set(url.hostname, (requestsByHost.get(url.hostname) ?? 0) + 1);
  try {
    return await realFetch(input, init);
  } finally {
    lastEnd.set(lane, Date.now());
    release();
  }
};

// ---------------------------------------------------------------------------
// Arguments.

interface Options {
  workId: string;
  count: number;
  seconds: number;
  fps: number;
  language?: string;
  maxRecords: number;
  preview: boolean;
}

function parseArgs(argv: string[]): Options {
  const [workId, ...rest] = argv;
  if (!workId || !/^OL\d+W$/.test(workId)) {
    throw new Error('usage: npx tsx lab/video/render.ts <OL…W> [--count 30] [--seconds 15] [--fps 30] [--lang en] [--max-records 1500] [--preview false]');
  }
  const flags = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith('--')) throw new Error(`expected a --flag, got ${rest[i]}`);
    flags.set(rest[i].slice(2), rest[i + 1] ?? '');
  }
  const num = (name: string, fallback: number) => {
    const raw = flags.get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`--${name} needs a positive number, got ${raw}`);
    return value;
  };
  return {
    workId,
    count: num('count', 30),
    seconds: num('seconds', 15),
    fps: num('fps', 30),
    language: flags.get('lang') || undefined,
    maxRecords: Math.min(num('max-records', MAX_EDITIONS_SCANNED), MAX_EDITIONS_SCANNED),
    preview: (flags.get('preview') ?? 'true') !== 'false',
  };
}

// ---------------------------------------------------------------------------
// Data: the work and every edition page, Open Library only, cached on disk.

interface WorkData { work: Work; editions: Edition[]; covers: Cover[]; records: number; complete: boolean }

async function loadWork(workId: string, maxRecords: number): Promise<WorkData & { cached: boolean }> {
  const file = path.join(CACHE, `work_${workId}.json`);
  try {
    return { ...(JSON.parse(await readFile(file, 'utf8')) as WorkData), cached: true };
  } catch {
    // Not cached; ask Open Library.
  }
  const work = await getWork(workId);
  if (!work) throw new Error(`no such work at Open Library: ${workId}`);
  const sources: SourceEdition[] = [];
  let records = 0;
  let complete = true;
  for (let offset = 0; offset < maxRecords; offset += OL_EDITIONS_PAGE) {
    let page;
    try {
      page = await getEditionsPage(workId, offset);
    } catch {
      try {
        page = await getEditionsPage(workId, offset);
      } catch (err) {
        // A failure is not a finding: say the work is partial, do not cache it.
        console.log(`  Open Library stopped answering at offset ${offset}: ${(err as Error).message}`);
        complete = false;
        break;
      }
    }
    records += page.entries.length;
    sources.push(...parseEditions(page.entries, work));
    process.stdout.write(`  editions ${offset}–${offset + page.entries.length} of ${page.size}\n`);
    if (page.entries.length < OL_EDITIONS_PAGE || offset + OL_EDITIONS_PAGE >= page.size) break;
  }
  const { editions, covers } = assembleEditions(sources);
  const data: WorkData = { work, editions, covers, records, complete };
  if (complete) {
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, JSON.stringify(data));
  }
  return { ...data, cached: false };
}

/** A cover image in one size, from disk if asked for before. */
async function coverImage(cover: Cover, size: 'M' | 'L'): Promise<Uint8Array> {
  const dir = path.join(CACHE, 'img');
  const file = path.join(dir, `${cover.id.replace(/[^a-z0-9]/gi, '_')}-${size}.jpg`);
  try {
    return new Uint8Array(await readFile(file));
  } catch {
    const url = size === 'L' ? cover.url : (cover.urlSmall ?? cover.url);
    const bytes = await fetchBytes(url, { timeoutMs: 20_000, revalidate: 0 });
    await mkdir(dir, { recursive: true });
    await writeFile(file, bytes);
    return bytes;
  }
}

/**
 * A signature per cover: the built index first (free, and it carries the
 * colour fields the fourth fold tier needs), then the M-size image hashed
 * here with colour, so both kinds fold alike. A cover whose image does not
 * arrive gets no signature and is counted.
 */
async function signaturesFor(covers: readonly Cover[]): Promise<{ sigs: Map<string, ImageSignature>; fromIndex: number; hashed: number; failed: number }> {
  const sigs = indexSignatures(covers.map(c => c.id));
  const fromIndex = sigs.size;
  let hashed = 0;
  let failed = 0;
  const missing = covers.filter(c => !sigs.has(c.id));
  for (const [i, cover] of missing.entries()) {
    try {
      const sig = signature(await coverImage(cover, 'M'), { colour: true });
      if (sig) { sigs.set(cover.id, sig); hashed++; } else failed++;
    } catch {
      failed++;
    }
    if ((i + 1) % 25 === 0) process.stdout.write(`  hashed ${i + 1} of ${missing.length}\n`);
  }
  return { sigs, fromIndex, hashed, failed };
}

// ---------------------------------------------------------------------------
// Frames.

const BG = '#141414';
const INK = '#f2efe9';
const MUTED = '#9a958c';
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Greedy word wrap by character count; good enough for titles and captions. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + word).length > maxChars) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, '') + ' …';
    return kept;
  }
  return lines;
}

interface TextLine { text: string; y: number; size: number; font: string; fill: string }

function textSvg(width: number, height: number, lines: TextLine[], extra = ''): Buffer {
  const body = lines.map(l =>
    `<text x="${width / 2}" y="${l.y}" font-family="${esc(l.font)}" font-size="${l.size}" fill="${l.fill}" text-anchor="middle">${esc(l.text)}</text>`,
  ).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${extra}${body}</svg>`);
}

function cardFrame(board: Storyboard, shot: CardShot): Promise<Buffer> {
  const { width, height } = board;
  const lines: TextLine[] = [];
  if (shot.kind === 'title') {
    const [lead, title, byline] = shot.lines;
    const titleLines = wrap(title, 14, 4);
    const titleSize = 112;
    const block = titleLines.length * titleSize * 1.1;
    let y = height / 2 - block / 2 - 40;
    lines.push({ text: lead, y, size: 56, font: SANS, fill: MUTED });
    y += 50;
    for (const t of titleLines) { y += titleSize * 1.1; lines.push({ text: t, y, size: titleSize, font: SERIF, fill: INK }); }
    if (byline) lines.push({ text: byline, y: y + 100, size: 46, font: SANS, fill: MUTED });
  } else {
    const [site, credit] = shot.lines;
    lines.push({ text: site, y: height / 2, size: 60, font: SERIF, fill: INK });
    if (credit) lines.push({ text: credit, y: height / 2 + 70, size: 34, font: SANS, fill: MUTED });
  }
  return sharp({ create: { width, height, channels: 3, background: BG } })
    .composite([{ input: textSvg(width, height, lines), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

/** Box a cover is fitted into: wide margins, room above for the title and below for the caption. */
const BOX = { width: 860, height: 1290, centreY: 900 };

async function coverFrame(board: Storyboard, shot: CoverShot, image: Uint8Array, title: string): Promise<{ png: Buffer; sourceWidth: number }> {
  const { width, height } = board;
  const meta = await sharp(image).metadata();
  const resized = await sharp(image)
    .resize({ width: BOX.width, height: BOX.height, fit: 'inside', kernel: 'lanczos3' })
    .flatten({ background: BG })
    .png()
    .toBuffer({ resolveWithObject: true });
  const w = resized.info.width;
  const h = resized.info.height;
  const left = Math.round((width - w) / 2);
  const top = Math.round(BOX.centreY - h / 2);
  // A soft shadow under the cover, so a white jacket does not merge with a
  // light frame edge and a dark one still reads as an object.
  const shadow = `<defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter></defs>`
    + `<rect x="${left + 6}" y="${top + 18}" width="${w}" height="${h}" fill="#000" opacity="0.7" filter="url(#s)"/>`;
  const lines: TextLine[] = [
    { text: wrap(title, 34, 1)[0], y: 190, size: 40, font: SERIF, fill: MUTED },
  ];
  const captionLines = shot.caption ? wrap(shot.caption, 38, 2) : [];
  captionLines.forEach((c, i) => lines.push({ text: c, y: top + h + 110 + i * 56, size: 44, font: SANS, fill: INK }));
  const png = await sharp({ create: { width, height, channels: 3, background: BG } })
    .composite([
      { input: textSvg(width, height, [], shadow), top: 0, left: 0 },
      { input: resized.data, top, left },
      { input: textSvg(width, height, lines), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
  return { png, sourceWidth: meta.width ?? 0 };
}

// ---------------------------------------------------------------------------

function hasFfmpeg(): boolean {
  return spawnSync('which', ['ffmpeg'], { encoding: 'utf8' }).status === 0;
}

function seconds(ms: number): number {
  return Math.round(ms / 100) / 10;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const outDir = path.join(ROOT, options.workId + (options.language ? `-${options.language}` : ''));
  const framesDir = path.join(outDir, 'frames');
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  console.log(`Loading ${options.workId} from Open Library …`);
  const data = await loadWork(options.workId, options.maxRecords);
  console.log(`  ${data.work.title} by ${data.work.authors[0]}: ${data.records || '?'} records, ${data.editions.length} editions with a cover, ${data.covers.length} covers${data.cached ? ' (cached)' : ''}${data.complete ? '' : ' — PARTIAL, Open Library stopped answering'}`);
  const loaded = Date.now();

  console.log('Signatures …');
  const { sigs, fromIndex, hashed, failed } = await signaturesFor(data.covers);
  console.log(`  ${fromIndex} from the built index, ${hashed} hashed here, ${failed} images did not arrive`);
  const signed = Date.now();

  const board = storyboard(
    { work: data.work, editions: data.editions, covers: data.covers, signatures: sigs },
    { count: options.count, seconds: options.seconds, fps: options.fps, language: options.language, siteName: SITE_NAME },
  );
  const coverShots = board.shots.filter((s): s is CoverShot => s.kind === 'cover');
  console.log(`  ${board.designs} designs after folding; showing ${coverShots.length}, ${seconds((coverShots[0].frames / board.fps) * 1000)} s each`);

  console.log('Frames …');
  const concat: string[] = [];
  const previewFrames: Buffer[] = [];
  const previewDelays: number[] = [];
  const sourceWidths: number[] = [];
  let lFailed = 0;
  let index = 0;
  for (const shot of board.shots) {
    let png: Buffer;
    if (shot.kind === 'cover') {
      const cover = data.covers.find(c => c.id === shot.coverId)!;
      let image: Uint8Array;
      try {
        image = await coverImage(cover, 'L');
      } catch {
        lFailed++;
        image = await coverImage(cover, 'M');
      }
      const frame = await coverFrame(board, shot, image, data.work.title);
      png = frame.png;
      sourceWidths.push(frame.sourceWidth);
    } else {
      png = await cardFrame(board, shot);
    }
    const name = `${String(index++).padStart(3, '0')}.png`;
    await writeFile(path.join(framesDir, name), png);
    concat.push(`file 'frames/${name}'`, `duration ${(shot.frames / board.fps).toFixed(6)}`);
    if (options.preview) {
      previewFrames.push(await sharp(png).resize({ width: board.width / 2 }).png().toBuffer());
      previewDelays.push(Math.round((shot.frames / board.fps) * 1000));
    }
  }
  // The concat demuxer ignores the last duration unless the file is repeated.
  concat.push(concat[concat.length - 2]);
  await writeFile(path.join(outDir, 'concat.txt'), concat.join('\n') + '\n');
  const mp4 = `${options.workId}${options.language ? `-${options.language}` : ''}.mp4`;
  const ffmpegArgs = [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
    '-vf', `fps=${board.fps},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-r', String(board.fps), '-movflags', '+faststart', '-an', mp4,
  ];
  await writeFile(
    path.join(outDir, 'encode.sh'),
    `#!/bin/sh\n# Encodes the frames into ${mp4} (needs ffmpeg: brew install ffmpeg).\ncd "$(dirname "$0")" && ffmpeg ${ffmpegArgs.map(a => (/[\s,+=]/.test(a) ? `'${a}'` : a)).join(' ')}\n`,
    { mode: 0o755 },
  );
  const framed = Date.now();

  let previewBytes = 0;
  if (options.preview) {
    const webp = path.join(outDir, 'preview.webp');
    await sharp(previewFrames, { join: { animated: true } }).webp({ quality: 80, delay: previewDelays, loop: 0 }).toFile(webp);
    previewBytes = (await stat(webp)).size;
  }

  let mp4Bytes = 0;
  let encodeMs = 0;
  if (hasFfmpeg()) {
    console.log('Encoding …');
    const t = Date.now();
    execFileSync('ffmpeg', ffmpegArgs, { cwd: outDir, stdio: 'inherit' });
    encodeMs = Date.now() - t;
    mp4Bytes = (await stat(path.join(outDir, mp4))).size;
  }

  const framesBytes = (await Promise.all(index > 0 ? Array.from({ length: index }, (_, i) =>
    stat(path.join(framesDir, `${String(i).padStart(3, '0')}.png`)).then(s => s.size)) : [])).reduce((a, b) => a + b, 0);
  const widths = [...sourceWidths].sort((a, b) => a - b);
  const report = {
    work: `${data.work.title} (${options.workId})`,
    covers: data.covers.length,
    designs: board.designs,
    shown: coverShots.length,
    secondsPerCover: seconds((coverShots[0].frames / board.fps) * 1000),
    coversPerSecond: Math.round((coverShots.length / (coverShots.reduce((s, x) => s + x.frames, 0) / board.fps)) * 10) / 10,
    years: [coverShots.find(s => s.year)?.year, [...coverShots].reverse().find(s => s.year)?.year],
    withCaption: coverShots.filter(s => s.caption).length,
    lImageWidthMedian: widths[Math.floor(widths.length / 2)],
    lImageWidthMin: widths[0],
    lImagesFallenBackToM: lFailed,
    requests: Object.fromEntries(requestsByHost),
    googleRequests: [...requestsByHost].filter(([h]) => h.includes('google')).reduce((s, [, n]) => s + n, 0),
    timeSeconds: {
      load: seconds(loaded - started),
      signatures: seconds(signed - loaded),
      frames: seconds(framed - signed),
      encode: encodeMs ? seconds(encodeMs) : null,
      total: seconds(Date.now() - started),
    },
    bytes: { frames: framesBytes, previewWebp: previewBytes, mp4: mp4Bytes || null },
  };
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!mp4Bytes) {
    console.log(`\nffmpeg is not installed, so no MP4. Frames, concat.txt and encode.sh are in ${outDir};`
      + ` after \`brew install ffmpeg\` run ${path.join(outDir, 'encode.sh')} or this script again.`);
  } else {
    console.log(`\nWrote ${path.join(outDir, mp4)}`);
  }
}

main().catch(err => {
  console.error((err as Error).message);
  process.exit(1);
});
