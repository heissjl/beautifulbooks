'use client';

import Link from 'next/link';
import { useState } from 'react';
import CoverImage from './CoverImage';
import { coverUrlFor } from '@/lib/coverurl';
import { DEFAULT_FRAME, FRAME_SIZES, GAPS_CM, wallPlan, type FrameSize, type PublicWall, type WallOp } from '@/lib/walls/model';

const WANTED_KEY = (id: string) => `bb.wall.wanted.${id}`;

function readWanted(id: string): boolean {
  try {
    return localStorage.getItem(WANTED_KEY(id)) === '1';
  } catch {
    return false;
  }
}

/**
 * Step 2 of the funnel (ROADMAP 5.14a; Julian, 2026-09-28: „hier dazwischen
 * können wir jetzt step 2 anbieten: eine physische cover wall aus der
 * collection basteln“): plan the frames, see the size, find the books. Nothing
 * is sold yet — the last line counts who would order the wall framed, which
 * is the number the gate before buying and framing needs (PLAN-5.13).
 */
export default function WallPlan({ wall, onSend }: { wall: PublicWall; onSend: (ops: WallOp[]) => void }) {
  const frame = wall.frame ?? DEFAULT_FRAME;
  const size = FRAME_SIZES[frame.size];
  const plan = wallPlan(wall.tiles.length, wall.columns, frame);
  const [wanted, setWanted] = useState(() => readWanted(wall.id));
  const [error, setError] = useState('');

  // The preview is the wall to scale: every frame placed in centimetres, shown in per cent.
  const place = (i: number) => {
    const col = i % plan.columns;
    const row = Math.floor(i / plan.columns);
    return {
      left: `${((col * (size.w + frame.gap)) / plan.widthCm) * 100}%`,
      top: `${((row * (size.h + frame.gap)) / plan.heightCm) * 100}%`,
      width: `${(size.w / plan.widthCm) * 100}%`,
      height: `${(size.h / plan.heightCm) * 100}%`,
    };
  };

  async function want() {
    setError('');
    try {
      const res = await fetch(`/api/walls/${wall.id}/interest`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setWanted(true);
      try {
        localStorage.setItem(WANTED_KEY(wall.id), '1');
      } catch {
        // Not remembered in a private window; counted anyway.
      }
    } catch {
      setError('That did not go through. Try again in a moment.');
    }
  }

  const select = 'rounded-full border border-line bg-surface px-2 py-1 text-sm text-ink';

  return (
    <section className="mt-10 rounded-card border border-line p-4 sm:p-6" aria-labelledby="make-a-wall">
      <p className="kicker">Next step</p>
      <h2 id="make-a-wall" className="font-display text-2xl text-ink">Make it a wall</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">Hang this collection at home: choose frames and a layout, see how large it gets, and find the books with these covers.</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
        <label className="flex items-center gap-2">
          Columns
          <select value={plan.columns} onChange={(e) => onSend([{ op: 'columns', columns: Number(e.target.value) }])} className={select}>
            {Array.from({ length: Math.min(8, wall.tiles.length) }, (_, i) => i + 1).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Frames
          <select value={frame.size} onChange={(e) => onSend([{ op: 'frame', size: e.target.value as FrameSize, gap: frame.gap }])} className={select}>
            {(Object.keys(FRAME_SIZES) as FrameSize[]).map((k) => (
              <option key={k} value={k}>
                {FRAME_SIZES[k].w} × {FRAME_SIZES[k].h} cm
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Gap
          <select value={frame.gap} onChange={(e) => onSend([{ op: 'frame', size: frame.size, gap: Number(e.target.value) }])} className={select}>
            {GAPS_CM.map((g) => (
              <option key={g} value={g}>
                {g} cm
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 rounded bg-surface-2 p-4 sm:p-8">
        <div
          className="relative mx-auto w-full"
          style={{ aspectRatio: `${plan.widthCm} / ${plan.heightCm}`, maxWidth: `min(100%, ${Math.round((420 * plan.widthCm) / plan.heightCm)}px)` }}
          aria-label={`Preview: ${wall.tiles.length} frames, ${plan.columns} across`}
          role="img"
        >
          {wall.tiles.map((t, i) => {
            const src = coverUrlFor(`ol:${t.coverId}`, 'M');
            return (
              <div key={t.coverId} className="absolute bg-[#2a2724] p-[2.5%] shadow-md" style={place(i)}>
                <div className="flex h-full w-full items-center justify-center bg-[#fbfaf7] p-[10%]">
                  <span className="relative block h-full w-full">{src && <CoverImage src={src} alt="" sizes="120px" fit="contain" />}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        About <strong className="font-medium text-ink">{plan.widthCm} × {plan.heightCm} cm</strong> with frames: {wall.tiles.length} frames of {size.w} × {size.h} cm, {frame.gap} cm apart, {plan.columns} × {plan.rows}. This size suits {size.fits}.
      </p>

      <h3 className="mt-8 text-sm font-medium text-ink">Find the books</h3>
      <p className="mt-1 max-w-2xl text-xs text-ink-3">
        An ISBN names a printing, not its picture: the same number has carried other covers. Each book&rsquo;s page says what the publisher shows for it and where to look.
      </p>
      <ol className="mt-3 divide-y divide-line">
        {wall.tiles.map((t) => {
          const p = t.printings[0];
          const isbns = t.printings.map((x) => x.isbn13 ?? x.isbn10).filter(Boolean);
          return (
            <li key={t.coverId} className="flex items-center gap-3 py-2">
              <span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">
                <CoverImage src={coverUrlFor(`ol:${t.coverId}`, 'S') ?? ''} alt="" sizes="32px" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{t.title}{t.author ? ` — ${t.author}` : ''}</span>
                <span className="block truncate text-xs text-ink-3">
                  {[p?.publisher, p?.year].filter(Boolean).join(' ') || 'Printing not on record'}
                  {isbns.length > 0 ? ` · ISBN ${isbns.slice(0, 2).join(', ')}${isbns.length > 2 ? ` +${isbns.length - 2}` : ''}` : ''}
                </span>
              </span>
              <Link href={`/book/${t.workId}?cover=ol:${t.coverId}`} className="shrink-0 whitespace-nowrap text-xs text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
                Where to find it
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 rounded-md bg-surface-2 p-4">
        <p className="text-sm text-ink">Would you rather have it done for you — the books found, framed and sent?</p>
        <p className="mt-1 text-xs text-ink-3">We don&rsquo;t offer that yet. Press if you would order it; when enough people do, we will.</p>
        {wanted ? (
          <p className="mt-3 text-sm text-ink-2" role="status">Noted — thank you.</p>
        ) : (
          <button type="button" onClick={want} className="mt-3 rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent">
            I&rsquo;d order this wall framed
          </button>
        )}
        {error && <p className="mt-2 text-xs text-accent" role="alert">{error}</p>}
      </div>
    </section>
  );
}
