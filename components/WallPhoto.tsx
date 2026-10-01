'use client';

import { useRef, useState } from 'react';
import WallProposal, { type Destination, type Proposal } from './WallProposal';
import type { PublicWall, Tile } from '@/lib/walls/model';
import type { PhotoMatch, PhotoRead } from '@/lib/walls/photo';

/** Long edge the photo is shrunk to before it leaves the phone; the model reads no more (lab/shelf). */
const PHOTO_EDGE = 1600;

/** What the server takes as it is when the canvas cannot be trusted (app/api/walls/photo/route.ts has the same number). */
const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;

/**
 * Whether what this browser draws on a canvas is what it reads back.
 * LibreWolf, Firefox with resistFingerprinting and the Tor Browser answer
 * with a made-up pattern instead (Julian's LibreWolf, 2026-09-30: 64 of 64
 * test pixels wrong, the model got 1.1 MB of stripes and read nothing).
 */
function canvasIsHonest(): boolean {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const ctx = c.getContext('2d');
  if (!ctx) return false;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = `rgb(${x * 32},${y * 32},128)`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const d = ctx.getImageData(0, 0, 8, 8).data;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 8 + x) * 4;
      if (Math.abs(d[i] - x * 32) > 2 || Math.abs(d[i + 1] - y * 32) > 2 || Math.abs(d[i + 2] - 128) > 2) return false;
    }
  }
  return true;
}

/**
 * The photo as it goes to the server: shrunk on a canvas where the canvas can
 * be trusted, otherwise the file as it is — the server turns and shrinks it
 * then (`lib/photoprep.ts`), at the price of a bigger upload.
 */
async function prepare(file: File): Promise<Blob> {
  if (!canvasIsHonest()) {
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') throw new Error('This browser keeps its canvas private, so the photo goes as it is — and that works for a JPEG or PNG only. Save it as a JPEG first.');
    if (file.size > MAX_ORIGINAL_BYTES) throw new Error('This browser keeps its canvas private, so the photo would go as it is — and this one is larger than 12 MB. Choose a smaller copy.');
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Chrome says "The source image could not be decoded." — for a HEIC from an iPhone, measured 2026-09-30.
    throw new Error('This browser cannot open this photo’s format (an iPhone HEIC, perhaps). Save it as a JPEG first, or set the camera to “Most Compatible”.');
  }
  const scale = Math.min(1, PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (ctx && looksBlank(ctx, canvas.width, canvas.height)) throw new Error('The photo came out blank when it was prepared. Choose it again, or another copy of it.');
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The photo could not be prepared.'))), 'image/jpeg', 0.9));
}

/** No photograph of a shelf is one flat tone: a 16 × 16 sample whose brightest and darkest pixels are within 8 of each other is empty. */
function looksBlank(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  let min = 255;
  let max = 0;
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      const [r, g, b] = ctx.getImageData(Math.floor(((i + 0.5) * width) / 16), Math.floor(((j + 0.5) * height) / 16), 1, 1).data;
      const lum = (r + g + b) / 3;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
  }
  return max - min < 8;
}

/** One line of the route's stream (app/api/walls/photo/route.ts). */
type Line =
  | { book: PhotoRead; i: number }
  | { read: PhotoRead[]; problems: number; capped: boolean }
  | { i: number; match: PhotoMatch }
  | { done: true }
  | { error: string };

type State =
  | { step: 'idle' }
  /** The model is reading: books appear one by one as it writes them. */
  | { step: 'reading'; preview: string; reads: PhotoRead[] }
  /** Every book is read; the catalogue answers one by one. */
  | { step: 'looking'; preview: string; reads: PhotoRead[]; matches: (PhotoMatch | undefined)[]; capped: boolean }
  | { step: 'read'; preview: string; matches: PhotoMatch[]; capped: boolean }
  | { step: 'error'; preview?: string; message: string };

/** The lines of a JSON-lines body, each as it completes. */
async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<Line> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let rest = '';
  for (;;) {
    const { value, done } = await reader.read();
    rest += decoder.decode(value, { stream: !done });
    const parts = rest.split('\n');
    rest = parts.pop() ?? '';
    for (const part of parts) if (part.trim()) yield JSON.parse(part) as Line;
    if (done) return;
  }
}

/**
 * A wall from a photo of a shelf (ROADMAP 5.13a, from lab/shelf 5.11): drop
 * or choose a photo, see it with a numbered marker on every book that was
 * read, tick the ones to keep. The photo stays in this browser as a preview
 * and goes to the server once, shrunk; the server does not keep it.
 *
 * Since 5.11a the answer is a stream (Julian, 2026-09-30): a numbered pin
 * appears on the photo for each book the moment the model has read it,
 * pale; it turns to the accent colour when the catalogue has found the book,
 * and grey when it has not. The pin sits at the model's estimate of the
 * book's centre and claims nothing about its edges — square for a cover,
 * round for a spine. The list to tick comes when every book has been looked up.
 */
export default function WallPhoto({
  photoOn,
  target,
  walls,
  onCommit,
  onOtherCover,
  onSearchFor,
}: {
  photoOn: boolean;
  /** The collection open in the editor: the books go into it (5.13m). */
  target?: PublicWall;
  /** On /create: the reader's collections, offered beside a new one. */
  walls?: PublicWall[];
  onCommit: (dest: Destination, tiles: Tile[]) => Promise<void>;
  onOtherCover?: (tile: Tile) => void;
  onSearchFor?: (label: string) => void;
}) {
  const [state, setState] = useState<State>({ step: 'idle' });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function read(file: File | undefined) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setState({ step: 'reading', preview, reads: [] });
    try {
      const body = await prepare(file);
      const res = await fetch('/api/walls/photo', { method: 'POST', headers: { 'content-type': body.type || 'image/jpeg' }, body });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'The photo could not be read.');
      }
      let reads: PhotoRead[] = [];
      let matches: (PhotoMatch | undefined)[] = [];
      let capped = false;
      for await (const line of lines(res.body)) {
        if ('error' in line) throw new Error(line.error);
        if ('book' in line) {
          reads = [...reads.slice(0, line.i), line.book, ...reads.slice(line.i + 1)];
          setState({ step: 'reading', preview, reads });
        } else if ('read' in line) {
          reads = line.read;
          matches = new Array<PhotoMatch | undefined>(reads.length).fill(undefined);
          capped = line.capped;
          setState({ step: 'looking', preview, reads, matches, capped });
        } else if ('match' in line) {
          matches = [...matches.slice(0, line.i), line.match, ...matches.slice(line.i + 1)];
          setState({ step: 'looking', preview, reads, matches, capped });
        } else if ('done' in line) {
          setState({ step: 'read', preview, matches: matches.map((m, i) => m ?? { read: reads[i], failed: true }), capped });
        }
      }
      setState((s) => (s.step === 'looking' || s.step === 'reading' ? { step: 'error', preview, message: 'The answer broke off. Try again in a moment.' } : s));
    } catch (err) {
      setState({ step: 'error', preview, message: err instanceof Error ? err.message : 'The photo could not be read.' });
    }
  }

  const preview = state.step === 'idle' ? undefined : state.preview;
  // The markers: every book read so far, with what the catalogue said about it, if anything yet.
  const markers: { read: PhotoRead; found?: boolean }[] =
    state.step === 'reading'
      ? state.reads.map((read) => ({ read }))
      : state.step === 'looking'
        ? state.reads.map((read, i) => ({ read, found: state.matches[i] ? !!state.matches[i]?.tile : undefined }))
        : state.step === 'read'
          ? state.matches.map((m) => ({ read: m.read, found: !!m.tile }))
          : [];
  const matches = state.step === 'read' ? state.matches : [];
  const proposals: Proposal[] = matches.map((m, i) => ({
    number: i + 1,
    label: m.read.title,
    sub: m.tile && !m.unsure ? undefined : m.read.author || undefined,
    tile: m.tile,
    missing: m.failed ? 'the search did not answer' : 'not in the catalogue',
    ...(m.failed ? { failed: true } : {}),
    ...(m.unsure ? { unsure: true } : {}),
  }));
  const found = matches.filter((m) => m.tile && !m.unsure).length;
  const maybe = matches.filter((m) => m.unsure).length;
  const notFound = matches.filter((m) => !m.tile && !m.failed).length;
  const failed = matches.filter((m) => m.failed).length;
  const looked = state.step === 'looking' ? state.matches.filter(Boolean).length : 0;

  return (
    <div className="mt-4">
      {!photoOn && (
        <p className="mb-3 text-xs text-ink-3">Reading photos needs a key this server does not have yet — you can choose a photo, but it will not be read.</p>
      )}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          read(e.dataTransfer.files[0]);
        }}
        className={`block cursor-pointer rounded-card border-[1.5px] border-dashed bg-surface px-4 py-7 text-center text-sm text-ink-2 transition-colors ${over ? 'border-accent' : 'border-line hover:border-accent'}`}
      >
        <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />
        <span className="font-medium text-ink">Choose a photo</span> or drop it here
        <span className="mt-1 block text-xs text-ink-3">Spines or covers, as sharp as you can. It is read once and not kept.</span>
      </label>

      {preview && (
        <div className="relative mt-4 inline-block max-w-full">
          {/* A local object URL, never uploaded as such; next/image has nothing to optimise here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your photo" className="block max-h-[28rem] max-w-full rounded-card" />
          {markers.map((m, i) => {
            const box = m.read.box;
            if (!box) return null;
            const cover = m.read.kind === 'cover';
            // A pin at the estimated centre, not a box: the model estimates where a book is, it does not segment the
            // picture, and a rectangle promised edges it never had (Julian, 2026-10-01: „entweder eine gute
            // segmentierung oder eine grundsätzlich andere darstellung“). Round for a spine, square for a cover.
            const tone = m.found === true ? 'bg-accent text-on-accent' : m.found === false ? 'bg-ink-3 text-bg' : 'bg-bg/90 text-ink';
            return (
              <span
                key={i}
                data-marker={cover ? 'cover' : 'spine'}
                className={`pointer-events-none absolute flex h-6 min-w-6 -translate-x-1/2 items-center justify-center px-1 text-[11px] font-medium leading-none shadow-md ring-1 ring-black/20 ${cover ? 'rounded-[4px]' : 'rounded-full'} ${tone} ${i % 2 ? 'max-sm:-translate-y-[110%] sm:-translate-y-1/2' : 'max-sm:translate-y-[10%] sm:-translate-y-1/2'}`}
                style={{ left: `${(box[0] + box[2] / 2) * 100}%`, top: `${(box[1] + box[3] / 2) * 100}%` }}
              >
                {i + 1}
              </span>
            );
          })}
        </div>
      )}

      {state.step === 'reading' && (
        <p className="mt-3 text-sm text-ink-2" role="status">
          {state.reads.length === 0 ? 'Reading the photo…' : `Reading the photo… ${state.reads.length} ${state.reads.length === 1 ? 'book' : 'books'} so far.`}
        </p>
      )}
      {state.step === 'looking' && (
        <p className="mt-3 text-sm text-ink-2" role="status">
          {state.reads.length} {state.reads.length === 1 ? 'book' : 'books'} read, looking them up… {looked} of {state.reads.length}.
        </p>
      )}
      {state.step === 'error' && <p className="mt-3 text-sm text-accent" role="alert">{state.message}</p>}
      {state.step === 'read' &&
        (matches.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">No title could be read in this photo.</p>
        ) : (
          <WallProposal
            key={preview}
            proposals={proposals}
            defaultTitle="My shelf"
            target={target}
            walls={walls}
            onCommit={onCommit}
            onOtherCover={onOtherCover}
            onSearchFor={onSearchFor}
            summary={[
              `${matches.length} ${matches.length === 1 ? 'book' : 'books'} read${state.capped ? ' (the first 80 of more)' : ''}: ${found} found with a cover`,
              maybe ? `${maybe} maybe` : '',
              notFound ? `${notFound} not in the catalogue` : '',
              failed ? `${failed} ${failed === 1 ? 'search' : 'searches'} did not answer` : '',
            ]
              .filter(Boolean)
              .join(', ') + `. Each gets the book’s usual cover — ${onOtherCover ? '“another cover” shows all of its covers' : 'you can change it in the collection’s editor'}.`}
          />
        ))}
    </div>
  );
}
