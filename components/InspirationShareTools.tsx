'use client';

import { useState, useSyncExternalStore } from 'react';
import { wasMade, watchMade } from './inspirationMemory';
import { PICTURE_VERSION } from '@/lib/inspiration/share';

/**
 * What on a shared board needs the browser (ROADMAP 5.18b): choosing how the
 * picture looks, saving it, copying it, handing it to an app where the
 * browser can (phones: Instagram, WhatsApp and Messages take a picture, not
 * a link), and copying the link. The rest of the page is rendered on the
 * server.
 */

type Format = 'story' | 'feed';
type Look = 'ambient' | 'mosaic' | 'paper';

const choice = (active: boolean) =>
  `rounded-full border px-3 py-0.5 text-sm transition-colors ${active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2 hover:border-accent hover:text-accent'}`;

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { id: T; label: string }[]; onChange: (next: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" role="group" aria-label={label}>
      <span className="w-full text-xs uppercase tracking-[0.12em] text-ink-3 sm:w-24">{label}</span>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)} className={choice(o.id === value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The picture as a PNG: a clipboard takes no JPEG. */
async function asPng(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(String(res.status));
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('no picture'))), 'image/png'));
}

/**
 * The picture, the three things a reader may choose about it, and the three
 * ways to take it away (Julian, 2026-10-05: „beides gut, mach beim sharen
 * einen toggle für den user", „make a toggle whether the author and title
 * should be shown", „vllt noch ein copy as a picture?").
 *
 * One picture is shown — the one the buttons hand over — so nobody saves a
 * look they have not seen. Each choice is a parameter of the poster route;
 * a picture drawn once is kept at the CDN, so going back to a look costs
 * nothing. `query` is the board's own query string.
 */
export function PictureShare({ query, link, text }: { query: string; link: string; text: string }) {
  const [format, setFormat] = useState<Format>('story');
  const [look, setLook] = useState<Look>('ambient');
  const [titles, setTitles] = useState(false);
  // The address whose picture has arrived (or failed): "drawing" is whatever the current address is not.
  const [arrived, setArrived] = useState<{ src: string; ok: boolean } | null>(null);
  const [note, setNote] = useState('');
  // Only where the browser offers it; false on the server and at first paint.
  const canShare = useSyncExternalStore(() => () => {}, () => typeof navigator.canShare === 'function', () => false);
  const canCopy = useSyncExternalStore(() => () => {}, () => typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function', () => false);

  const src = `/api/inspiration/poster?${query}&format=${format}${look === 'ambient' ? '' : `&look=${look}`}${titles ? '&titles=1' : ''}&v=${PICTURE_VERSION}`;
  const file = format === 'story' ? 'shelf-portrait-story.jpg' : 'shelf-portrait.jpg';
  const drawing = arrived?.src !== src;
  const failed = !drawing && !arrived?.ok;

  function copy() {
    setNote('Copying…');
    // The clipboard item is made inside the click and filled later: Safari refuses a write that starts after a wait.
    navigator.clipboard.write([new ClipboardItem({ 'image/png': asPng(src) })]).then(
      () => setNote('The picture is copied — paste it into a post or a message.'),
      () => setNote('The picture could not be copied here. Save it instead.'),
    );
  }

  async function share() {
    try {
      const blob = await (await fetch(src)).blob();
      const picture = new File([blob], file, { type: 'image/jpeg' });
      // The link goes with the picture, inside the sentence (Julian, 2026-10-05: WhatsApp shows the words under the picture, and
      // a `url` of its own makes some apps drop the file).
      const words = `${text} ${link}`;
      await navigator.share(navigator.canShare({ files: [picture] }) ? { files: [picture], text: words } : { text: words });
    } catch {
      // Closing the share sheet is not an error worth a sentence.
    }
  }

  return (
    <div className="mt-3 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6">
      {/* The frame keeps the picture's shape while it is drawn, so the buttons beside it do not jump. */}
      <div className={`relative self-start overflow-hidden rounded-card border border-line bg-surface-2 ${format === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
        {/*
          The sentence lies under the picture and shows through until it has come. It does not wait
          for `onLoad` to hide: a picture that arrived before the page woke up never fires it.
        */}
        {(drawing || failed) && (
          <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-ink-3" role="status">
            {failed ? 'The picture did not come. Choose again in a moment.' : 'Drawing the picture…'}
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- a picture this site draws itself; next/image would transform it again */}
        <img
          key={src}
          src={src}
          alt={`The picture as it will be saved: ${format === 'story' ? 'for a story' : 'for a post'}`}
          onLoad={() => setArrived({ src, ok: true })}
          onError={() => setArrived({ src, ok: false })}
          className={`absolute inset-0 h-full w-full object-cover ${failed ? 'hidden' : ''}`}
        />
      </div>
      <div className="min-w-0 space-y-3">
        <Choice label="Format" value={format} onChange={setFormat} options={[{ id: 'story', label: 'Story' }, { id: 'feed', label: 'Post' }]} />
        <Choice label="Background" value={look} onChange={setLook} options={[{ id: 'ambient', label: 'Cover colours' }, { id: 'mosaic', label: 'Mosaic' }, { id: 'paper', label: 'Paper' }]} />
        <Choice label="Titles" value={titles ? 'on' : 'off'} onChange={(v) => setTitles(v === 'on')} options={[{ id: 'off', label: 'Covers only' }, { id: 'on', label: 'With title and author' }]} />
        <div className="flex flex-wrap gap-2 pt-1">
          <a href={src} download={file} className="btn btn-accent">Save the picture</a>
          {canCopy && <button type="button" onClick={copy} className="btn">Copy the picture</button>}
          {canShare && <button type="button" onClick={share} className="btn">Share the picture…</button>}
        </div>
        <p className="min-h-5 text-sm text-ink-2" role="status">{note}</p>
      </div>
    </div>
  );
}

/** A link as a line can hold it: a board without a short link is some 190 characters of address. */
function shown(link: string): string {
  const bare = link.replace(/^https?:\/\//, '');
  return bare.length > 56 ? `${bare.slice(0, 48)}…` : bare;
}

export function CopyLink({ link }: { link: string }) {
  const [note, setNote] = useState('');
  return (
    <>
      <button
        type="button"
        // Say "copied" only when it was: a browser may refuse the clipboard, and then the whole link is shown to select.
        onClick={() => navigator.clipboard.writeText(link).then(() => setNote('copied'), () => setNote('refused'))}
        className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink hover:border-accent hover:text-accent"
      >
        Copy link
      </button>
      <span className="min-w-0 text-sm text-ink-3" role="status">
        {note === 'copied' && <span className="mr-1 text-ink">Copied.</span>}
        {note === 'refused' ? <span className="break-all"><span className="mr-1 text-ink">Not copied — select it here:</span>{link}</span> : shown(link)}
      </span>
    </>
  );
}

/**
 * The buy list's fold: open for the board's maker, closed for a visitor
 * (`inspirationMemory.ts` knows the maker). The server renders it closed;
 * the browser opens it once it knows. A reader may still fold or unfold it.
 */
export function BuyListDetails({ query, className, children }: { query: string; className: string; children: React.ReactNode }) {
  const mine = useSyncExternalStore(watchMade, () => wasMade(query), () => false);
  return <details open={mine || undefined} className={className}>{children}</details>;
}
