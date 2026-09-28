'use client';

import Link from 'next/link';
import { useState } from 'react';
import CoverImage from './CoverImage';
import { coverUrlFor } from '@/lib/coverurl';
import { ARTWORK_CM, artworkPlan, DEFAULT_ARTWORK, TONES, type PublicWall, type Tone, type WallOp } from '@/lib/walls/model';

const WANTED_KEY = (id: string) => `bb.wall.wanted.${id}`;
/** Height of a wedge under a book, in centimetres; drawn, not measured. */
const WEDGE_CM = 1.6;

function readWanted(id: string): boolean {
  try {
    return localStorage.getItem(WANTED_KEY(id)) === '1';
  } catch {
    return false;
  }
}

/**
 * Step 2 of the funnel (ROADMAP 5.13f): the collection as **one piece** — a
 * deep frame, a toned back panel, the books themselves standing on small
 * wedges (Julian, 2026-09-28: „a single big frame with books on little wedge
 * platforms with a toned background as one piece of artwork, that is
 * something for which the books themselves need to be bought“). Framed prints
 * of single covers would be the alternative, if the site may sell them — that
 * is being researched (docs/plans/research-cover-prints.md). Nothing is sold
 * yet; the last line counts who would order the piece.
 */
export default function WallPlan({ wall, onSend }: { wall: PublicWall; onSend: (ops: WallOp[]) => void }) {
  const tone = (wall.artwork ?? DEFAULT_ARTWORK).tone;
  const plan = artworkPlan(wall.tiles.length, wall.columns);
  const c = ARTWORK_CM;
  const [wanted, setWanted] = useState(() => readWanted(wall.id));
  const [error, setError] = useState('');

  // Everything is placed in centimetres on the back panel and shown in per cent of it.
  const pct = (cm: number, of: number) => `${(cm / of) * 100}%`;
  const bookAt = (i: number) => {
    const col = i % plan.columns;
    const row = Math.floor(i / plan.columns);
    return { x: c.margin + col * (c.bookW + c.gap), y: c.margin + row * (c.bookH + c.rowGap) };
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

  return (
    <section className="mt-10 rounded-card border border-line p-4 sm:p-6" aria-labelledby="make-a-wall">
      <p className="kicker">Next step</p>
      <h2 id="make-a-wall" className="font-display text-2xl text-ink">Make it a piece for your wall</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        One deep frame, the books themselves standing on small wedges against a toned background — your collection as a single piece of art. It is made of the real books, so it starts with finding them.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-2">
        <label className="flex items-center gap-2">
          Books per row
          <select
            value={plan.columns}
            onChange={(e) => onSend([{ op: 'columns', columns: Number(e.target.value) }])}
            className="rounded-full border border-line bg-surface px-2 py-1 text-sm text-ink"
          >
            {Array.from({ length: Math.min(8, wall.tiles.length) }, (_, i) => i + 1).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Background">
          Background
          {(Object.keys(TONES) as Tone[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={t === tone}
              title={TONES[t].label}
              aria-label={TONES[t].label}
              onClick={() => onSend([{ op: 'artwork', tone: t }])}
              className={`h-6 w-6 rounded-full border ${t === tone ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'border-line'}`}
              style={{ background: TONES[t].hex }}
            />
          ))}
        </div>
      </div>

      {/* The piece: moulding, back panel, books on wedges. */}
      <div className="mt-5 rounded bg-surface-2 p-4 sm:p-8">
        <div
          className="mx-auto bg-[#2a2724] p-[1.4%] shadow-lg"
          style={{ maxWidth: `min(100%, ${Math.round((460 * plan.widthCm) / plan.heightCm)}px)` }}
          role="img"
          aria-label={`Preview: ${wall.tiles.length} books on wedges in one frame, ${plan.columns} per row, ${TONES[tone].label} background`}
        >
          <div
            className="relative w-full"
            style={{
              aspectRatio: `${plan.widthCm} / ${plan.heightCm}`,
              background: TONES[tone].hex,
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.18), inset 0 10px 24px rgba(0,0,0,.28)',
            }}
          >
            {wall.tiles.map((t, i) => {
              const { x, y } = bookAt(i);
              const src = coverUrlFor(`ol:${t.coverId}`, 'M');
              return (
                <div key={t.coverId}>
                  <span
                    className="absolute"
                    style={{
                      left: pct(x + c.bookW * 0.2, plan.widthCm),
                      top: pct(y + c.bookH, plan.heightCm),
                      width: pct(c.bookW * 0.6, plan.widthCm),
                      height: pct(WEDGE_CM, plan.heightCm),
                      background: 'linear-gradient(to bottom, rgba(255,255,255,.35), rgba(0,0,0,.25))',
                      clipPath: 'polygon(12% 0, 88% 0, 100% 100%, 0 100%)',
                    }}
                  />
                  <span
                    className="absolute overflow-hidden rounded-[1px] bg-surface-2"
                    style={{
                      left: pct(x, plan.widthCm),
                      top: pct(y, plan.heightCm),
                      width: pct(c.bookW, plan.widthCm),
                      height: pct(c.bookH, plan.heightCm),
                      boxShadow: '3px 5px 9px rgba(0,0,0,.35), inset 3px 0 4px rgba(0,0,0,.25)',
                    }}
                  >
                    {src && <CoverImage src={src} alt="" sizes="120px" />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        About <strong className="font-medium text-ink">{plan.widthCm} × {plan.heightCm} cm</strong>, {plan.depthCm} cm deep: {wall.tiles.length} books, {plan.columns} per row.{' '}
        <span className="text-ink-3">Planned with paperbacks of {c.bookW} × {c.bookH} cm; hardcovers make it larger.</span>
      </p>

      <h3 className="mt-8 text-sm font-medium text-ink">The books it needs</h3>
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
        <p className="text-sm text-ink">Would you rather have it made — the books found, mounted and framed, sent to you?</p>
        <p className="mt-1 text-xs text-ink-3">We don&rsquo;t offer that yet. Press if you would order it; when enough people do, we will.</p>
        {wanted ? (
          <p className="mt-3 text-sm text-ink-2" role="status">Noted — thank you.</p>
        ) : (
          <button type="button" onClick={want} className="mt-3 rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent">
            I&rsquo;d order this piece
          </button>
        )}
        {error && <p className="mt-2 text-xs text-accent" role="alert">{error}</p>}
      </div>
    </section>
  );
}
