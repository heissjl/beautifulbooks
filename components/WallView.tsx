'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CoverImage from './CoverImage';
import WallIdField from './WallIdField';
import { postJson, useMyWalls } from './useMyWalls';
import { coverUrlFor } from '@/lib/coverurl';
import { editHref } from '@/lib/walls/edit';
import { MIN_SHOWCASE_TILES, tileCoverId, UNSAVED_HOURS, type PublicWall, type WallOp } from '@/lib/walls/model';

/**
 * A reader's wall (ROADMAP 5.13a). A cover wall like every other on the site
 * — no frames (Julian, 2026-09-28: „das soll nicht wie individuell geframte
 * cover aussehen, mache hier eine klassische cover wall“). Everyone sees the
 * same wall; its owner, the browser whose visitor id made it (E22), gets
 * "Edit collection" into the editor (5.13m) — no tools on the wall itself
 * (Julian, 2026-09-29) — and keeps, shows and withdraws it here.
 */
export default function WallView({ initial }: { initial: PublicWall }) {
  const [wall, setWall] = useState(initial);
  const [canEdit, setCanEdit] = useState(false);
  const [note, setNote] = useState('');
  const { me, setMe } = useMyWalls();

  // Whether this browser owns the wall is the server's answer, asked once a visitor id is known.
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
      setNote('');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  // Logged out on this page: the tools go with the ID.
  const editable = canEdit && !!me.visitor;
  const others = me.walls.filter((w) => w.id !== wall.id);

  return (
    <>
      {/*
        A collection is a try until its owner saves it (5.13j): tries expire by
        themselves, so six random covers someone looked at once do not pile up.
      */}
      {editable && wall.unsaved && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/50 bg-surface p-4" role="status">
          <p className="text-sm text-ink-2">
            <strong className="font-medium text-ink">Not saved yet.</strong> Collections nobody keeps are deleted after {UNSAVED_HOURS / 24} days.
          </p>
          <button type="button" onClick={() => send([{ op: 'save' }])} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent">
            Keep it
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{wall.title}</h1>
        <div className="flex flex-wrap gap-2">
          {/* Into Arrange, not Add covers: the wall is what one came from (Julian, 2026-09-29). An empty collection still opens on Add covers below. */}
          {editable && (
            <Link href={editHref(wall.id, { mode: 'arrange' })} className="rounded-full bg-accent px-4 py-1 text-sm text-on-accent transition-opacity hover:opacity-90">
              Edit collection
            </Link>
          )}
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(`${location.origin}/c/${wall.id}`).then(() => setNote('Link copied.'))}
            className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent"
          >
            Copy link
          </button>
        </div>
      </div>
      {wall.by && <p className="mt-2 text-sm text-ink-3">by {wall.by}</p>}
      {wall.intro && <p className="mt-4 max-w-2xl whitespace-pre-line text-base text-ink-2">{wall.intro}</p>}

      <p className="mt-3 text-sm text-ink-3" role="status">
        {wall.tiles.length === 0 ? 'No covers yet.' : `${wall.tiles.length} ${wall.tiles.length === 1 ? 'cover' : 'covers'}.`}
        {editable && ' Yours.'}
        {note && <span className="ml-2 text-ink-2">{note}</span>}
      </p>

      {wall.tiles.length === 0 ? (
        <p className="mt-8 text-sm text-ink-2">
          {editable ? (
            <Link href={editHref(wall.id)} className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
              Add covers in the editor
            </Link>
          ) : (
            'This collection is empty.'
          )}
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-5">
          {wall.tiles.map((t) => {
            const src = coverUrlFor(tileCoverId(t), 'M');
            const label = t.author ? `${t.title} by ${t.author}` : t.title;
            return (
              <li key={t.coverId}>
                <Link href={`/book/${t.workId}?cover=${tileCoverId(t)}`} title={label} className="cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 ease-out hover:-translate-y-1">
                  {src && <CoverImage src={src} alt={label} sizes="(max-width: 640px) 33vw, (max-width: 1280px) 25vw, 20vw" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {editable && <Showcase wall={wall} onSend={send} />}
      {!editable && wall.showcase === 'shown' && <Report id={wall.id} />}

      {others.length > 0 && (
        <nav className="mt-12" aria-label="Your other collections">
          <h2 className="kicker">Your other collections</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {others.map((w) => (
              <li key={w.id}>
                <Link href={editHref(w.id)} className="inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent">
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

/**
 * Showing the wall among readers' walls (ROADMAP 5.13d): at once, without a
 * review (Julian, 2026-09-28). A wall Julian took down stays down.
 */
function Showcase({ wall, onSend }: { wall: PublicWall; onSend: (ops: WallOp[]) => void }) {
  const short = wall.tiles.length < MIN_SHOWCASE_TILES;
  const unsaved = !!wall.unsaved;
  return (
    <section className="mt-10" aria-labelledby="showcase">
      <h2 id="showcase" className="text-sm font-medium text-ink">Show it to others</h2>
      {!wall.showcase && (
        <>
          <p className="mt-1 text-sm text-ink-2">
            Put this collection on <Link href="/collections/readers" className="underline underline-offset-2 hover:text-accent">Collections by readers</Link>, with its title and your lines. Much-visited ones also stand among our own collections.
          </p>
          <button
            type="button"
            disabled={short || unsaved}
            onClick={() => onSend([{ op: 'submit' }])}
            className="mt-3 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent disabled:opacity-40"
          >
            Show it
          </button>
          {unsaved ? (
            <p className="mt-1 text-xs text-ink-3">Keep the collection first.</p>
          ) : (
            short && <p className="mt-1 text-xs text-ink-3">Add a cover first.</p>
          )}
        </>
      )}
      {wall.showcase === 'shown' && (
        <p className="mt-1 text-sm text-ink-2">
          Shown on <Link href="/collections/readers" className="underline underline-offset-2 hover:text-accent">Collections by readers</Link>.{' '}
          <button type="button" className="underline underline-offset-2 hover:text-accent" onClick={() => onSend([{ op: 'withdraw' }])}>Stop showing it</button>
        </p>
      )}
      {wall.showcase === 'hidden' && (
        <p className="mt-1 text-sm text-ink-2">
          {wall.hiddenBy === 'reports'
            ? 'Several readers reported this collection, so it is off Collections by readers until we have looked at it.'
            : 'We took this collection down from Collections by readers.'}{' '}
          The link still works for you and anyone you share it with.
        </p>
      )}
    </section>
  );
}

function Report({ id }: { id: string }) {
  const [done, setDone] = useState<string | null>(null);
  return (
    <p className="mt-10 text-xs text-ink-3">
      {done ?? (
        <button
          type="button"
          className="underline underline-offset-2 hover:text-accent"
          onClick={() =>
            fetch(`/api/walls/${id}/report`, { method: 'POST' })
              .then((r) => setDone(r.ok ? 'Thank you — we will have a look.' : 'That did not go through.'))
              .catch(() => setDone('That did not go through.'))
          }
        >
          Report this collection
        </button>
      )}
    </p>
  );
}
