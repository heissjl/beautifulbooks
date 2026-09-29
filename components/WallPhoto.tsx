'use client';

import { useRef, useState } from 'react';
import WallProposal, { type Proposal } from './WallProposal';
import type { Tile } from '@/lib/walls/model';
import type { PhotoMatch } from '@/lib/walls/photo';
import { PHOTO_EDGE, looksLikeHeif } from '@/lib/walls/photofile';

async function shrink(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The photo could not be prepared.'))), 'image/jpeg', 0.9));
}

const HEIC_HELP = 'Open this page in Safari, or send the photo as a JPEG (on an iPhone: Settings › Camera › Formats › Most Compatible).';

/**
 * Chrome cannot open an iPhone photo (HEIC, ROADMAP 6.74): the server turns
 * it into a JPEG of the size `shrink` would make, in memory, and keeps
 * nothing. Every way this can fail is said, with what to do instead.
 */
async function fromHeic(file: File): Promise<Blob> {
  const lead = 'This browser cannot open iPhone photos (HEIC).';
  let res: Response;
  try {
    res = await fetch('/api/walls/heic', { method: 'POST', headers: { 'content-type': 'image/heic' }, body: file });
  } catch {
    throw new Error(`${lead} The conversion did not answer. ${HEIC_HELP}`);
  }
  if (res.ok) return res.blob();
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  const reason = (data.error ?? 'Converting it did not work').replace(/\.?$/, '.');
  throw new Error(`${lead} ${reason} ${HEIC_HELP}`);
}

type State =
  | { step: 'idle' }
  | { step: 'reading'; preview?: string }
  | { step: 'read'; preview?: string; matches: PhotoMatch[] }
  | { step: 'error'; preview?: string; message: string };

/**
 * A wall from a photo of a shelf (ROADMAP 5.13a, from lab/shelf 5.11): drop
 * or choose a photo, see it with a numbered box on every book that was read,
 * tick the ones to keep. The photo stays in this browser as a preview and
 * goes to the server once, shrunk; the server does not keep it. An iPhone
 * photo in a browser that cannot open HEIC goes twice: first whole, to be
 * turned into a JPEG, then as that JPEG.
 */
export default function WallPhoto({ photoOn, onCreate }: { photoOn: boolean; onCreate: (title: string, tiles: Tile[]) => Promise<void> }) {
  const [state, setState] = useState<State>({ step: 'idle' });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function read(file: File | undefined) {
    if (!file) return;
    let preview: string | undefined = URL.createObjectURL(file);
    setState({ step: 'reading', preview });
    try {
      let photo: Blob;
      try {
        photo = await shrink(file);
      } catch {
        // Nor can it show the file: no broken image beside the message.
        preview = undefined;
        setState({ step: 'reading' });
        if (!looksLikeHeif(new Uint8Array(await file.slice(0, 12).arrayBuffer()))) throw new Error('This browser could not open this file as a photo. Try a JPEG or PNG.');
        photo = await fromHeic(file);
        preview = URL.createObjectURL(photo);
        setState({ step: 'reading', preview });
      }
      const res = await fetch('/api/walls/photo', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: photo });
      const data = (await res.json()) as { matches?: PhotoMatch[]; error?: string };
      if (!res.ok || !data.matches) throw new Error(data.error ?? 'The photo could not be read.');
      setState({ step: 'read', preview, matches: data.matches });
    } catch (err) {
      setState({ step: 'error', preview, message: err instanceof Error ? err.message : 'The photo could not be read.' });
    }
  }

  const preview = state.step === 'idle' ? undefined : state.preview;
  const matches = state.step === 'read' ? state.matches : [];
  const proposals: Proposal[] = matches.map((m, i) => ({
    number: i + 1,
    label: m.read.title,
    sub: m.tile ? undefined : m.read.author || undefined,
    tile: m.tile,
    missing: m.failed ? 'the search did not answer' : 'not found',
  }));

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
        <input ref={input} type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />
        <span className="font-medium text-ink">Choose a photo</span> or drop it here
        <span className="mt-1 block text-xs text-ink-3">Spines or covers, as sharp as you can. It is read once and not kept.</span>
      </label>

      {preview && (
        <div className="relative mt-4 inline-block max-w-full">
          {/* A local object URL, never uploaded as such; next/image has nothing to optimise here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your photo" className="block max-h-[28rem] max-w-full rounded-card" />
          {matches.map((m, i) =>
            m.read.box ? (
              <span
                key={i}
                className={`pointer-events-none absolute rounded-[2px] border-2 ${m.tile ? 'border-accent' : 'border-ink-3'}`}
                style={{ left: `${m.read.box[0] * 100}%`, top: `${m.read.box[1] * 100}%`, width: `${m.read.box[2] * 100}%`, height: `${m.read.box[3] * 100}%` }}
              >
                <span className={`absolute -left-px -top-px px-1 text-[10px] ${m.tile ? 'bg-accent text-on-accent' : 'bg-ink-3 text-bg'}`}>{i + 1}</span>
              </span>
            ) : null,
          )}
        </div>
      )}

      {state.step === 'reading' && <p className="mt-3 text-sm text-ink-2" role="status">Reading the photo and looking the books up&hellip;</p>}
      {state.step === 'error' && <p className="mt-3 text-sm text-accent" role="alert">{state.message}</p>}
      {state.step === 'read' &&
        (matches.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">No title could be read in this photo.</p>
        ) : (
          <WallProposal
            key={preview}
            proposals={proposals}
            defaultTitle="My shelf"
            onCreate={onCreate}
            summary={`${matches.length} ${matches.length === 1 ? 'book' : 'books'} read, ${matches.filter((m) => m.tile).length} found with a cover. Each gets the book's usual cover — change it in the picker below.`}
          />
        ))}
    </div>
  );
}
