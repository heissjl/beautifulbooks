'use client';

import { useEffect, useRef, useState } from 'react';
import WallProposal, { type Destination, type Proposal } from './WallProposal';
import WallPicker from './WallPicker';
import { rich, useT } from './i18n';
import type { Translate } from '@/lib/i18n/translate';
import type { PublicWall, Tile } from '@/lib/walls/model';
import type { PhotoMatch, PhotoRead } from '@/lib/walls/photo';
import { spreadPins } from '@/lib/walls/pins';

/**
 * Long edge the photo is shrunk to before it leaves the phone. 2000, not the 1600 the model reads in one look:
 * a dense photo is read again in pieces (lib/walls/dense.ts), and a piece is cut from what was sent — at 1600
 * a piece would hold no more than the first look saw.
 */
const PHOTO_EDGE = 2000;

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
async function prepare(file: File, t: Translate): Promise<Blob> {
  if (!canvasIsHonest()) {
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') throw new Error(t('This browser keeps its canvas private, so the photo goes as it is — and that works for a JPEG or PNG only. Save it as a JPEG first.'));
    if (file.size > MAX_ORIGINAL_BYTES) throw new Error(t('This browser keeps its canvas private, so the photo would go as it is — and this one is larger than 12 MB. Choose a smaller copy.'));
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Chrome says "The source image could not be decoded." — for a HEIC from an iPhone, measured 2026-09-30.
    throw new Error(t('This browser cannot open this photo’s format (an iPhone HEIC, perhaps). Save it as a JPEG first, or set the camera to “Most Compatible”.'));
  }
  const scale = Math.min(1, PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (ctx && looksBlank(ctx, canvas.width, canvas.height)) throw new Error(t('The photo came out blank when it was prepared. Choose it again, or another copy of it.'));
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t('The photo could not be prepared.')))), 'image/jpeg', 0.9));
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

/** A pin's size in pixels, with a little air: what `spreadPins` keeps apart. */
const PIN = 24;

/** One line of the route's stream (app/api/walls/photo/route.ts). */
type Line =
  | { book: PhotoRead; i: number }
  | { again: number; done?: number }
  | { read: PhotoRead[]; problems: number; capped: boolean }
  | { i: number; match: PhotoMatch }
  | { done: true }
  | { error: string };

type State =
  | { step: 'idle' }
  /** The model is reading: books appear one by one as it writes them. */
  | { step: 'reading'; preview: string; reads: PhotoRead[]; again?: { of: number; done: number } }
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
  const t = useT();
  const [state, setState] = useState<State>({ step: 'idle' });
  const [over, setOver] = useState(false);
  // The size the photo is shown at, read when it has loaded: pins step aside in pixels (lib/walls/pins.ts).
  const [shown, setShown] = useState<{ w: number; h: number } | null>(null);
  /*
    Another cover before there is a collection (Julian, 2026-10-04: „i want a user to be able to
    change covers in the from photo funnel before they create a collection“). Without a collection
    to swap in, the choice stays here, per row, and replaces the row's tile in the list; nothing is
    written until the reader adds the ticked rows. The editor uses the same window; a parent's `onOtherCover` would replace it.
  */
  const [swapped, setSwapped] = useState<Record<number, Tile>>({});
  const [picking, setPicking] = useState<{ index: number; tile: Tile } | null>(null);
  const otherCover = onOtherCover ?? ((tile: Tile, index: number) => setPicking({ index, tile }));
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);
  const input = useRef<HTMLInputElement>(null);

  async function read(file: File | undefined) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setState({ step: 'reading', preview, reads: [] });
    setSwapped({});
    setPicking(null);
    try {
      const body = await prepare(file, t);
      const res = await fetch('/api/walls/photo', { method: 'POST', headers: { 'content-type': body.type || 'image/jpeg' }, body });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t('The photo could not be read.'));
      }
      let reads: PhotoRead[] = [];
      let matches: (PhotoMatch | undefined)[] = [];
      let capped = false;
      for await (const line of lines(res.body)) {
        if ('error' in line) throw new Error(line.error);
        if ('again' in line) {
          // A full wall: the server reads it again in pieces (lib/walls/dense.ts) and says how far it is.
          setState({ step: 'reading', preview, reads, again: { of: line.again, done: line.done ?? 0 } });
        } else if ('book' in line) {
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
      setState((s) => (s.step === 'looking' || s.step === 'reading' ? { step: 'error', preview, message: t('The answer broke off. Try again in a moment.') } : s));
    } catch (err) {
      setState({ step: 'error', preview, message: err instanceof Error ? err.message : t('The photo could not be read.') });
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
  // The list grows while the catalogue is still answering (Julian, 2026-10-01: „während die bücher
  // nachgeschaut werden können die ersten ergebnisse auch schon angezeigt werden“): a row per book
  // read, pending until its search answers, then a tile or a reason.
  const rows: { read: PhotoRead; match?: PhotoMatch }[] =
    state.step === 'looking'
      ? state.reads.map((read, i) => ({ read, match: state.matches[i] }))
      : state.step === 'read'
        ? state.matches.map((m) => ({ read: m.read, match: m }))
        : [];
  const proposals: Proposal[] = rows.map(({ read, match: m }, i) => ({
    number: i + 1,
    label: read.title,
    sub: m?.tile && !m.unsure ? undefined : read.author || undefined,
    ...(m
      ? {
          tile: m.tile && swapped[i] ? swapped[i] : m.tile,
          missing: m.failed ? t('the search did not answer') : t('not in the catalogue'),
          ...(m.failed ? { failed: true } : {}),
          ...(m.unsure ? { unsure: true } : {}),
        }
      : { pending: true }),
  }));
  // No pin hides another: neighbours on a shelf step up and down, books in a pile step left and right.
  const pins = shown ? spreadPins(markers.map((m) => m.read.at), shown.w, shown.h, PIN) : [];
  const matches = rows.flatMap((r) => (r.match ? [r.match] : []));
  const found = matches.filter((m) => m.tile && !m.unsure).length;
  const maybe = matches.filter((m) => m.unsure).length;
  const notFound = matches.filter((m) => !m.tile && !m.failed).length;
  const failed = matches.filter((m) => m.failed).length;
  const capped = state.step === 'looking' || state.step === 'read' ? state.capped : false;
  const counts = [
    t('{n} found with a cover', { n: found }),
    maybe ? t('{n} maybe', { n: maybe }) : '',
    notFound ? t('{n} not in the catalogue', { n: notFound }) : '',
    failed ? (failed === 1 ? t('1 search did not answer') : t('{n} searches did not answer', { n: failed })) : '',
  ].filter(Boolean);
  const booksRead = rows.length === 1 ? t('1 book read') : t('{n} books read', { n: rows.length });
  const summary =
    state.step === 'looking'
      ? `${booksRead}, ${t('looking them up… {done} of {total}', { done: matches.length, total: rows.length })}${counts.length && found ? `: ${counts.join(', ')}` : ''}. ${t('You can tick and add while the rest come in.')}`
      : `${booksRead}${capped ? ` ${t('(the first 100 of more)')}` : ''}: ${counts.join(', ')}. ${t('Each gets the book’s usual cover — “another cover” shows the others it has had.')}`;

  return (
    <div className="mt-4">
      {!photoOn && (
        <p className="mb-3 text-xs text-ink-3">{t('Reading photos needs a key this server does not have yet — you can choose a photo, but it will not be read.')}</p>
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
        {rich(t('{choose} or drop it here'), { choose: <span className="font-medium text-ink">{t('Choose a photo')}</span> })}
        <span className="mt-1 block text-xs text-ink-3">{t('Spines or covers, as sharp as you can. It is read once and not kept.')}</span>
      </label>

      {preview && (
        <div className="relative mt-4 inline-block max-w-full">
          {/* A local object URL, never uploaded as such; next/image has nothing to optimise here. */}
          {/* 44rem, not 28: a portrait photo of a gallery wall was 336 px wide at 28rem and forty pins overlapped (2026-10-01). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={t('Your photo')}
            className="block max-h-[44rem] max-w-full rounded-card"
            onLoad={(e) => setShown({ w: e.currentTarget.clientWidth, h: e.currentTarget.clientHeight })}
          />
          {shown &&
            pins.map((at, i) => {
              if (!at) return null;
              const m = markers[i];
              const cover = m.read.kind === 'cover';
              // A pin at the model's point, not a box: the model estimates where a book is, it does not segment the
              // picture, and a rectangle promised edges it never had (Julian, 2026-10-01: „entweder eine gute
              // segmentierung oder eine grundsätzlich andere darstellung“). Round for a spine, square for a cover.
              const tone = m.found === true ? 'bg-accent text-on-accent' : m.found === false ? 'bg-ink-3 text-bg' : 'bg-bg/90 text-ink';
              return (
                <span
                  key={i}
                  data-marker={cover ? 'cover' : 'spine'}
                  className={`pointer-events-none absolute flex h-[22px] min-w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center px-1 text-[11px] font-medium leading-none shadow-md ring-1 ring-black/20 ${cover ? 'rounded-[4px]' : 'rounded-full'} ${tone}`}
                  style={{ left: `${at[0]}px`, top: `${at[1]}px` }}
                >
                  {i + 1}
                </span>
              );
            })}
        </div>
      )}

      {state.step === 'reading' && (
        <p className="mt-3 text-sm text-ink-2" role="status">
          {state.again ? t('Many books — reading the photo again in {of} parts, closer up… {done} of {of} done.', { of: state.again.of, done: state.again.done }) : state.reads.length === 0 ? t('Reading the photo…') : state.reads.length === 1 ? t('Reading the photo… 1 book so far.') : t('Reading the photo… {n} books so far.', { n: state.reads.length })}
        </p>
      )}
      {state.step === 'error' && <p className="mt-3 text-sm text-accent" role="alert">{state.message}</p>}
      {(state.step === 'looking' || state.step === 'read') &&
        (rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">{t('No title could be read in this photo.')}</p>
        ) : (
          <WallProposal
            key={preview}
            proposals={proposals}
            defaultTitle={t('My shelf')}
            target={target}
            walls={walls}
            onCommit={onCommit}
            onOtherCover={otherCover}
            onSearchFor={onSearchFor}
            summary={summary}
          />
        ))}
      {picking && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={t('Covers of {title}', { title: picking.tile.title })}
          onClick={(e) => e.target === e.currentTarget && setPicking(null)}
        >
          <div className="w-full max-w-5xl rounded-lg border border-line bg-bg p-4 sm:p-6">
            <WallPicker
              key={picking.tile.coverId}
              workId={picking.tile.workId}
              target={null}
              choose={{
                current: picking.tile,
                onChoose: (tile) => {
                  setSwapped((prev) => ({ ...prev, [picking.index]: tile }));
                  setPicking(null);
                },
              }}
              onWall={() => {}}
              onClose={() => setPicking(null)}
              className=""
            />
          </div>
        </div>
      )}
    </div>
  );
}
