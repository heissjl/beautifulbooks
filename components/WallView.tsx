'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CoverImage from './CoverImage';
import WallIdField from './WallIdField';
import { postJson, useMyWalls } from './useMyWalls';
import { coverUrlFor } from '@/lib/coverurl';
import type { PublicWall, WallOp } from '@/lib/walls/model';

/**
 * A reader's wall as frames (ROADMAP 5.13a). Everyone sees it; its owner —
 * the browser whose visitor id made it (E22) — also gets the tools. The
 * column count is the one of the real wall; a phone may show fewer and says so.
 */
export default function WallView({ initial }: { initial: PublicWall }) {
  const [wall, setWall] = useState(initial);
  const [canEdit, setCanEdit] = useState(false);
  const [note, setNote] = useState('');
  const { me, setMe } = useMyWalls();
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setNarrow(query.matches);
    query.addEventListener('change', update);
    Promise.resolve().then(update);
    return () => query.removeEventListener('change', update);
  }, []);

  // Whether this browser owns the wall is the server's answer, asked once it
  // is known that there is a visitor id at all.
  const visitor = me.visitor;
  useEffect(() => {
    if (!visitor) return;
    fetch(`/api/walls/${initial.id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { wall: PublicWall; canEdit: boolean } | null) => {
        if (!d) return;
        setWall(d.wall);
        setCanEdit(d.canEdit);
      })
      .catch(() => {});
  }, [initial.id, visitor]);

  async function send(ops: WallOp[]) {
    try {
      const d = await postJson<{ wall: PublicWall }>(`/api/walls/${wall.id}`, { ops });
      setWall(d.wall);
      setMe((m) => ({ ...m, walls: m.walls.map((w) => (w.id === d.wall.id ? d.wall : w)) }));
      setNote('Saved.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  const shown = Math.min(wall.columns, narrow ? 3 : 8);
  const rows = Math.ceil(wall.tiles.length / wall.columns);
  const others = me.walls.filter((w) => w.id !== wall.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        {canEdit ? (
          <input
            defaultValue={wall.title}
            key={wall.title}
            onBlur={(e) => e.target.value.trim() !== wall.title && send([{ op: 'title', title: e.target.value }])}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Title of the wall"
            className="min-w-0 flex-1 border-b border-transparent bg-transparent font-display text-3xl leading-tight text-ink hover:border-line focus:border-accent focus:outline-none sm:text-4xl"
          />
        ) : (
          <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{wall.title}</h1>
        )}
        <div className="flex items-center gap-3 text-sm text-ink-2">
          {canEdit && (
            <label className="flex items-center gap-2">
              Columns
              <select
                value={wall.columns}
                onChange={(e) => send([{ op: 'columns', columns: Number(e.target.value) }])}
                className="rounded-full border border-line bg-surface px-2 py-1 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(`${location.origin}/w/${wall.id}`).then(() => setNote('Link copied.'))}
            className="rounded-full border border-line bg-surface px-3 py-1 hover:border-accent hover:text-accent"
          >
            Copy link
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-3" role="status">
        {wall.tiles.length === 0
          ? 'No covers yet.'
          : `${wall.tiles.length} ${wall.tiles.length === 1 ? 'cover' : 'covers'}, ${wall.columns} × ${rows} on the wall${shown < wall.columns ? `, shown in ${shown} columns here` : ''}.`}
        {note && <span className="ml-2 text-ink-2">{note}</span>}
      </p>

      <div
        className="mt-6 grid gap-3 rounded bg-surface-2 p-4 sm:gap-5 sm:p-8"
        style={{ gridTemplateColumns: `repeat(${shown}, minmax(0, 1fr))` }}
      >
        {wall.tiles.length === 0 && (
          <p className="col-span-full py-16 text-center text-sm text-ink-3">
            {canEdit ? (
              <>
                Pick a cover on any book&rsquo;s wall and press <em>Add to wall</em>, or{' '}
                <Link href="/walls" className="underline underline-offset-2 hover:text-accent">start from a search or a photo</Link>.
              </>
            ) : (
              'This wall is empty.'
            )}
          </p>
        )}
        {wall.tiles.map((t, i) => {
          const src = coverUrlFor(`ol:${t.coverId}`, 'M');
          return (
            <figure key={t.coverId} className="group relative m-0 bg-[#2a2724] p-[5px] shadow-md">
              <Link
                href={`/book/${t.workId}?cover=ol:${t.coverId}`}
                className="flex aspect-[5/7] items-center justify-center bg-[#fbfaf7] p-[9%]"
                title={t.author ? `${t.title} by ${t.author}` : t.title}
              >
                <span className="relative block h-full w-full">
                  {src && <CoverImage src={src} alt={t.author ? `${t.title} by ${t.author}` : t.title} sizes="(max-width: 640px) 30vw, 180px" fit="contain" />}
                </span>
              </Link>
              {canEdit && (
                <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <ToolButton label="Move left" hidden={i === 0} onClick={() => send([{ op: 'move', coverId: t.coverId, to: i - 1 }])}>←</ToolButton>
                  <ToolButton label="Remove" onClick={() => send([{ op: 'remove', coverId: t.coverId }])}>✕</ToolButton>
                  <ToolButton label="Move right" hidden={i === wall.tiles.length - 1} onClick={() => send([{ op: 'move', coverId: t.coverId, to: i + 1 }])}>→</ToolButton>
                </div>
              )}
            </figure>
          );
        })}
      </div>

      {canEdit && wall.tiles.length > 0 && (
        <p className="mt-4 text-sm text-ink-2">
          Add more: pick a cover on any book&rsquo;s wall and press <em>Add to wall</em>, or{' '}
          <Link href="/walls" className="underline underline-offset-2 hover:text-accent">search from the walls page</Link>.
        </p>
      )}

      {others.length > 0 && (
        <nav className="mt-12" aria-label="Your other walls">
          <h2 className="kicker">Your other walls</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {others.map((w) => (
              <li key={w.id}>
                <Link href={`/w/${w.id}`} className="inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent">
                  {w.title} <span className="text-ink-3">{w.tiles.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {me.visitor && <WallIdField me={me} onChange={setMe} />}
    </>
  );
}

function ToolButton({ label, hidden, onClick, children }: { label: string; hidden?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`h-7 w-7 rounded-full bg-black/75 text-sm text-white hover:bg-accent ${hidden ? 'invisible' : ''}`}
    >
      {children}
    </button>
  );
}
