/**
 * Builds one vertical clip of a work's covers (lab/video/README.md, ROADMAP 5.5).
 *
 * Run:
 *   npx tsx lab/video/render.ts OL893414W
 *   npx tsx lab/video/render.ts OL468431W --count 30 --seconds 15   # default 20
 *   npx tsx lab/video/render.ts OL893414W --lang de --count 20
 *
 * Writes under lab/video/out/<workId>/ (git-ignored): every frame as JPEG in
 * frames/, six key moments as PNG in stills/, encode.sh, an animated WebP
 * preview, report.json, and — when ffmpeg is installed — <workId>.mp4
 * (H.264, yuv420p, 1080×1920). The choice is `storyboard.ts`, the drawing
 * `frames.ts`, the text `text.py`.
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
import { FrameRenderer, textItems, type TextImage, type TextItem } from './frames';
import {
  chooseDesigns, storyboard, type CoverMeasure, type CoverShot, type Storyboard, type StoryboardInput, type StoryboardOptions,
} from './storyboard';

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
  previewFps: number;
  previewWidth: number;
}

function parseArgs(argv: string[]): Options {
  const [workId, ...rest] = argv;
  if (!workId || !/^OL\d+W$/.test(workId)) {
    throw new Error('usage: npx tsx lab/video/render.ts <OL…W> [--count 30] [--seconds 20] [--fps 30] [--lang en] [--max-records 1500] [--preview false] [--preview-fps 15] [--preview-width 360]');
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
    seconds: num('seconds', 20),
    fps: num('fps', 30),
    language: flags.get('lang') || undefined,
    maxRecords: Math.min(num('max-records', MAX_EDITIONS_SCANNED), MAX_EDITIONS_SCANNED),
    preview: (flags.get('preview') ?? 'true') !== 'false',
    previewFps: num('preview-fps', 15),
    previewWidth: Math.round(num('preview-width', 360)),
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
// Measuring the chosen covers, until the choice holds still.

/** Width, height and tone of a cover's L image, for the clip's rules (storyboard.ts). */
async function measure(bytes: Uint8Array): Promise<CoverMeasure | null> {
  const meta = await sharp(bytes).metadata();
  const sig = signature(bytes, { colour: true });
  if (!meta.width || !meta.height || !sig) return null;
  return { width: meta.width, height: meta.height, mean: sig.mean ?? 128, contrast: sig.contrast, saturation: sig.saturation ?? 0 };
}

/**
 * The clip's rules need the L image (its size, its tone), and fetching it for
 * every design of a 280-design book would be 280 downloads for 30 frames. So
 * only the chosen covers are measured; a rejected one frees its slot, the
 * choice is made again, and the newcomers are measured — until nothing new is
 * chosen. Ten rounds is far more than it takes (three for Gatsby).
 */
async function chooseAndMeasure(
  input: StoryboardInput,
  options: StoryboardOptions,
): Promise<{ measures: Map<string, CoverMeasure>; images: Map<string, Uint8Array>; rounds: number; failed: number; unusable: Set<string> }> {
  const measures = new Map<string, CoverMeasure>();
  const images = new Map<string, Uint8Array>();
  const covers = new Map(input.covers.map(c => [c.id, c]));
  let failed = 0;
  let rounds = 0;
  const unusable = new Set<string>();
  for (; rounds < 10; rounds++) {
    const { chosen } = chooseDesigns({ ...input, measures, covers: input.covers.filter(c => !unusable.has(c.id)) }, options);
    const fresh = chosen.filter(d => !measures.has(d.cover.id));
    if (fresh.length === 0) break;
    for (const d of fresh) {
      try {
        const bytes = await coverImage(covers.get(d.cover.id)!, 'L');
        const m = await measure(bytes);
        if (!m) throw new Error('undecodable');
        measures.set(d.cover.id, m);
        images.set(d.cover.id, bytes);
      } catch {
        failed++;
        unusable.add(d.cover.id);
      }
    }
  }
  return { measures, images, rounds, failed, unusable };
}

// ---------------------------------------------------------------------------
// Text, in the site's fonts, set by text.py in one run.

async function setText(items: TextItem[], outDir: string): Promise<{ text: Map<string, TextImage>; fonts: string }> {
  const textDir = path.join(outDir, 'text');
  await rm(textDir, { recursive: true, force: true });
  const mainRepo = path.dirname(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim());
  const run = spawnSync('python3', [path.join('lab', 'video', 'text.py'), path.join(ROOT, 'fonts'), textDir, process.cwd(), mainRepo], {
    input: JSON.stringify({ items }), encoding: 'utf8', maxBuffer: 1 << 24,
  });
  if (run.status !== 0) throw new Error(`text.py failed: ${run.stderr}`);
  const result = JSON.parse(run.stdout) as { fonts: string; items: Record<string, { w: number; h: number }> };
  const text = new Map<string, TextImage>();
  for (const [id, { w, h }] of Object.entries(result.items)) {
    text.set(id, { png: await readFile(path.join(textDir, `${id}.png`)), w, h });
  }
  return { text, fonts: result.fonts };
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
  const slug = options.workId + (options.language ? `-${options.language}` : '');
  const outDir = path.join(ROOT, slug);
  const framesDir = path.join(outDir, 'frames');
  const stillsDir = path.join(outDir, 'stills');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(stillsDir, { recursive: true });

  console.log(`Loading ${options.workId} from Open Library …`);
  const data = await loadWork(options.workId, options.maxRecords);
  console.log(`  ${data.work.title} by ${data.work.authors[0]}: ${data.records || '?'} records, ${data.editions.length} editions with a cover, ${data.covers.length} covers${data.cached ? ' (cached)' : ''}${data.complete ? '' : ' — PARTIAL, Open Library stopped answering'}`);
  const loaded = Date.now();

  console.log('Signatures …');
  const { sigs, fromIndex, hashed, failed } = await signaturesFor(data.covers);
  console.log(`  ${fromIndex} from the built index, ${hashed} hashed here, ${failed} images did not arrive`);
  const signed = Date.now();

  const sbOptions: StoryboardOptions = {
    count: options.count, seconds: options.seconds, fps: options.fps, language: options.language, siteName: SITE_NAME,
  };
  const input: StoryboardInput = { work: data.work, editions: data.editions, covers: data.covers, signatures: sigs };
  console.log('Choosing and measuring …');
  const chosen = await chooseAndMeasure(input, sbOptions);
  const board = storyboard({ ...input, covers: input.covers.filter(c => !chosen.unusable.has(c.id)), measures: chosen.measures }, sbOptions);
  const coverShots = board.shots.filter((s): s is CoverShot => s.kind === 'cover');
  console.log(`  ${board.designs} designs eligible; showing ${coverShots.length} (${chosen.rounds} rounds, ${chosen.measures.size} L images measured); left out: ${JSON.stringify(board.excluded)}`);
  const measured = Date.now();

  console.log('Text …');
  const { text, fonts } = await setText(textItems(board, { title: data.work.title, author: data.work.authors[0] ?? '' }), outDir);
  if (fonts !== 'site') console.log('  the site fonts were not found (run `npm run dev` once so next/font fetches them); set in system fonts');

  console.log(`Frames (${board.totalFrames}) …`);
  const renderer = new FrameRenderer({ board, text, images: chosen.images });
  const previewEvery = Math.max(1, Math.round(board.fps / options.previewFps));
  const previewFrames: Buffer[] = [];
  const stillAt = keyMoments(board);
  let index = 0;
  let framesBytes = 0;
  const raw = { raw: { width: board.width, height: board.height, channels: 3 as const } };
  for await (const frame of renderer.frames()) {
    const jpg = await sharp(frame, raw).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    framesBytes += jpg.length;
    await writeFile(path.join(framesDir, `${String(index).padStart(4, '0')}.jpg`), jpg);
    const still = stillAt.get(index);
    if (still) await sharp(frame, raw).png().toFile(path.join(stillsDir, `${still}.png`));
    if (options.preview && index % previewEvery === 0) {
      previewFrames.push(await sharp(frame, raw).resize({ width: options.previewWidth }).png().toBuffer());
    }
    if ((index + 1) % 100 === 0) process.stdout.write(`  ${index + 1} of ${board.totalFrames}\n`);
    index++;
  }
  const mp4 = `${slug}.mp4`;
  const ffmpegArgs = [
    '-y', '-loglevel', 'error', '-framerate', String(board.fps), '-i', 'frames/%04d.jpg',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4,
  ];
  await writeFile(
    path.join(outDir, 'encode.sh'),
    `#!/bin/sh\n# Encodes the frames into ${mp4} (needs ffmpeg: brew install ffmpeg).\ncd "$(dirname "$0")" && ffmpeg ${ffmpegArgs.map(a => (/[\s%+]/.test(a) ? `'${a}'` : a)).join(' ')}\n`,
    { mode: 0o755 },
  );
  const framed = Date.now();

  let previewBytes = 0;
  if (options.preview) {
    const webp = path.join(outDir, 'preview.webp');
    const delay = Math.round((1000 * previewEvery) / board.fps);
    await sharp(previewFrames, { join: { animated: true } })
      .webp({ quality: 72, delay: previewFrames.map(() => delay), loop: 0, effort: 4 })
      .toFile(webp);
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

  const widths = [...chosen.measures.entries()].filter(([id]) => coverShots.some(s => s.coverId === id)).map(([, m]) => m.width).sort((a, b) => a - b);
  const report = {
    work: `${data.work.title} (${options.workId})`,
    covers: data.covers.length,
    designs: board.designs,
    excluded: board.excluded,
    shown: coverShots.length,
    secondsFirstCover: seconds((coverShots[0].frames / board.fps) * 1000),
    secondsLastCover: seconds((coverShots[coverShots.length - 1].frames / board.fps) * 1000),
    coversPerSecond: Math.round((coverShots.length / (coverShots.reduce((s, x) => s + x.frames, 0) / board.fps)) * 10) / 10,
    years: board.span ? [board.span.from, board.span.to] : null,
    withCaption: coverShots.filter(s => s.caption).length,
    fonts,
    lImageWidthMedian: widths[Math.floor(widths.length / 2)],
    lImageWidthMin: widths[0],
    lImagesMeasured: chosen.measures.size,
    measureRounds: chosen.rounds,
    requests: Object.fromEntries(requestsByHost),
    googleRequests: [...requestsByHost].filter(([h]) => h.includes('google')).reduce((s, [, n]) => s + n, 0),
    frames: board.totalFrames,
    timeSeconds: {
      load: seconds(loaded - started),
      signatures: seconds(signed - loaded),
      chooseAndMeasure: seconds(measured - signed),
      frames: seconds(framed - measured),
      encode: encodeMs ? seconds(encodeMs) : null,
      total: seconds(Date.now() - started),
    },
    bytes: { framesJpeg: framesBytes, previewWebp: previewBytes, mp4: mp4Bytes || null },
    preview: { fps: board.fps / previewEvery, width: options.previewWidth },
  };
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  console.log(mp4Bytes
    ? `\nWrote ${path.join(outDir, mp4)}`
    : `\nffmpeg is not installed, so no MP4. Frames and encode.sh are in ${outDir}; after \`brew install ffmpeg\` run ${path.join(outDir, 'encode.sh')}.`);
}

/** Frame numbers worth a full-size still: the title settled, a cover, the wall held, the end card. */
function keyMoments(board: Storyboard): Map<number, string> {
  const out = new Map<number, string>();
  let at = 0;
  let coverSeen = 0;
  for (const shot of board.shots) {
    if (shot.kind === 'title') out.set(at + shot.frames - 1, '1-title');
    if (shot.kind === 'cover') {
      if (coverSeen === 0) out.set(at + shot.frames - 1, '2-first-cover');
      if (coverSeen === 1) out.set(at + Math.floor(shot.transition / 2), '3-dissolve');
      coverSeen++;
    }
    if (shot.kind === 'grid') {
      out.set(at + Math.floor(shot.frames * 0.22), '4-wall-filling');
      out.set(at + shot.frames - 1, '5-wall');
    }
    if (shot.kind === 'end') out.set(at + shot.frames - 1, '6-end');
    at += shot.frames;
  }
  return out;
}

main().catch(err => {
  console.error((err as Error).stack ?? (err as Error).message);
  process.exit(1);
});
