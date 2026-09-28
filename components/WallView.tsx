'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CoverImage from './CoverImage';
import WallIdField from './WallIdField';
import { postJson, useMyWalls } from './useMyWalls';
import { coverUrlFor } from '@/lib/coverurl';
import { MAX_BY, MAX_INTRO, MIN_SHOWCASE_TILES, UNSAVED_HOURS, type PublicWall, type WallOp } from '@/lib/walls/model';

/**
 * A reader's wall (ROADMAP 5.13a). A cover wall like every other on the site
 * — no frames (Julian, 2026-09-28: „das soll nicht wie individuell geframte
 * cover aussehen, mache hier eine klassische cover wall“). Everyone sees it;
 * its owner, the browser whose visitor id made it (E22), also gets the tools.
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
      setNote('Saved.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  const others = me.walls.filter((w) => w.id !== wall.id);
  const moreCovers = (
    <Link href="/create" className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
      Go back to search and choose more covers
    </Link>
  );

  return (
    <>
      {/*
        A collection is a try until its owner saves it (5.13j): tries expire by
        themselves, so six random covers someone looked at once do not pile up.
      */}
      {canEdit && wall.unsaved && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/50 bg-surface p-4" role="status">
          <p className="text-sm text-ink-2">
            <strong className="font-medium text-ink">Not saved yet.</strong> Unsaved collections are deleted after {UNSAVED_HOURS / 24} days.
          </p>
          <button type="button" onClick={() => send([{ op: 'save' }])} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent">
            Save collection
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        {canEdit ? (
          <input
            defaultValue={wall.title}
            key={wall.title}
            onBlur={(e) => e.target.value.trim() !== wall.title && send([{ op: 'title', title: e.target.value }])}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Title of the collection"
            className="min-w-0 flex-1 border-b border-transparent bg-transparent font-display text-3xl leading-tight text-ink hover:border-line focus:border-accent focus:outline-none sm:text-4xl"
          />
        ) : (
          <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{wall.title}</h1>
        )}
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(`${location.origin}/c/${wall.id}`).then(() => setNote('Link copied.'))}
          className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent"
        >
          Copy link
        </button>
      </div>

      {canEdit ? (
        <input
          defaultValue={wall.by ?? ''}
          key={`by-${wall.by ?? ''}`}
          maxLength={MAX_BY}
          placeholder="Your name (optional, shown with the collection)"
          onBlur={(e) => e.target.value.trim() !== (wall.by ?? '') && send([{ op: 'by', by: e.target.value }])}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Your name"
          className="mt-3 block w-full max-w-sm rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 placeholder:text-ink-3"
        />
      ) : (
        wall.by && <p className="mt-2 text-sm text-ink-3">by {wall.by}</p>
      )}

      {canEdit ? (
        <textarea
          defaultValue={wall.intro ?? ''}
          key={wall.intro ?? ''}
          maxLength={MAX_INTRO}
          rows={2}
          placeholder="A few lines about this collection — what ties it together."
          onBlur={(e) => e.target.value.trim() !== (wall.intro ?? '') && send([{ op: 'intro', intro: e.target.value }])}
          aria-label="A few lines about this collection"
          className="mt-4 block w-full max-w-2xl resize-y rounded-md border border-line bg-surface px-3 py-2 text-base text-ink-2 placeholder:text-ink-3"
        />
      ) : (
        wall.intro && <p className="mt-4 max-w-2xl whitespace-pre-line text-base text-ink-2">{wall.intro}</p>
      )}

      <p className="mt-3 text-sm text-ink-3" role="status">
        {wall.tiles.length === 0 ? 'No covers yet.' : `${wall.tiles.length} ${wall.tiles.length === 1 ? 'cover' : 'covers'}.`}
        {note && <span className="ml-2 text-ink-2">{note}</span>}
      </p>

      {wall.tiles.length === 0 ? (
        <p className="mt-8 text-sm text-ink-2">{canEdit ? moreCovers : 'This collection is empty.'}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-5">
          {wall.tiles.map((t, i) => {
            const src = coverUrlFor(`ol:${t.coverId}`, 'M');
            const label = t.author ? `${t.title} by ${t.author}` : t.title;
            return (
              <li key={t.coverId} className="group relative">
                <Link href={`/book/${t.workId}?cover=ol:${t.coverId}`} title={label} className="cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 ease-out hover:-translate-y-1">
                  {src && <CoverImage src={src} alt={label} sizes="(max-width: 640px) 33vw, (max-width: 1280px) 25vw, 20vw" />}
                </Link>
                {canEdit && (
                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <ToolButton label="Move left" hidden={i === 0} onClick={() => send([{ op: 'move', coverId: t.coverId, to: i - 1 }])}>←</ToolButton>
                    <ToolButton label="Remove" onClick={() => send([{ op: 'remove', coverId: t.coverId }])}>✕</ToolButton>
                    <ToolButton label="Move right" hidden={i === wall.tiles.length - 1} onClick={() => send([{ op: 'move', coverId: t.coverId, to: i + 1 }])}>→</ToolButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && wall.tiles.length > 0 && <p className="mt-6 text-sm">{moreCovers}</p>}

      {canEdit && <Showcase wall={wall} onSend={send} />}
      {!canEdit && wall.showcase === 'shown' && <Report id={wall.id} />}

      {others.length > 0 && (
        <nav className="mt-12" aria-label="Your other collections">
          <h2 className="kicker">Your other collections</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {others.map((w) => (
              <li key={w.id}>
                <Link href={`/c/${w.id}`} className="inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent">
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
            <p className="mt-1 text-xs text-ink-3">Save the collection first.</p>
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
