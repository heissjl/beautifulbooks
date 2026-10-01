'use client';

import { useRef, useState } from 'react';
import WallProposal, { type Destination, type Proposal } from './WallProposal';
import type { PublicWall, Tile } from '@/lib/walls/model';
import type { PhotoMatch, PhotoRead } from '@/lib/walls/photo';

/** Long edge the photo is shrunk to before it leaves the phone; the model reads no more (lab/shelf). */
const PHOTO_EDGE = 1600;

async function shrink(file: File): Promise<Blob> {
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
  // On 2026-09-30 a shelf photo reached the model with its full size and not one
  // book on it (20 answer tokens): most likely an empty canvas. Say so here
  // instead of "No title could be read", and spend nothing on it.
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
 * Since 5.11a the answer is a stream (Julian, 2026-09-30): a marker appears
 * on the photo for each book the moment the model has read it, grey; it
 * turns to the accent colour when the catalogue has found the book, and
 * stays grey when it has not. A cover lying flat gets a wider marker that
 * says so. The list to tick comes when every book has been looked up.
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
      const res = await fetch('/api/walls/photo', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: await shrink(file) });
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
            // A strip says which spine is meant, not where its edges are (the model estimates, it does not measure).
            const tone = m.found === true ? 'border-accent' : m.found === false ? 'border-ink-3 border-dashed' : 'border-bg/80';
            const badge = m.found === true ? 'bg-accent text-on-accent' : m.found === false ? 'bg-ink-3 text-bg' : 'bg-bg/80 text-ink';
            return (
              <span
                key={i}
                data-marker={cover ? 'cover' : 'spine'}
                className={`pointer-events-none absolute rounded-[2px] border-2 ${tone} ${cover ? 'bg-bg/10' : ''}`}
                style={{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${box[2] * 100}%`, height: `${box[3] * 100}%` }}
              >
                <span className={`absolute -left-px -top-px whitespace-nowrap px-1 text-[10px] ${badge}`}>
                  {i + 1}
                  {cover ? ' cover' : ''}
                </span>
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
