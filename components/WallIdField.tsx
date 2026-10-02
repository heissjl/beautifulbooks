'use client';

import { useState } from 'react';
import { idLink } from '@/lib/walls/idlink';
import { isVisitorId, normalVisitorId, type PublicWall } from '@/lib/walls/model';
import { stopEditing } from './editingSession';
import { postJson, type MyWalls } from './useMyWalls';

/**
 * The footer field from taketest.xyz (E22): your ID, and a Save button that
 * makes this browser the visitor whose ID was pasted.
 */
export default function WallIdField({ me, onChange }: { me: MyWalls; onChange: (me: MyWalls) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [leaving, setLeaving] = useState(false);
  const value = draft ?? me.visitor ?? '';
  // Another ID in the field than this browser's: the button takes it (Julian, 2026-09-28: „a way to enter an id to go on working on a collections project … in the same field“).
  const other = !!value.trim() && normalVisitorId(value) !== me.visitor;

  async function save() {
    try {
      const data = await postJson<{ visitor: string; walls: PublicWall[] }>('/api/walls/me', { visitor: value });
      onChange({ ...data, loaded: true });
      setDraft(null);
      setNote(data.walls.length === 1 ? '1 collection belongs to this ID.' : `${data.walls.length} collections belong to this ID.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  /**
   * Log out (Julian, 2026-09-30: „es braucht einen log-out button bei der
   * id“): the browser forgets the ID; the collections stay under it, so the
   * step asks once and points at Copy. The remembered target and the editing
   * session go with the cookie.
   */
  async function logOut() {
    try {
      const res = await fetch('/api/walls/me', { method: 'DELETE' });
      if (!res.ok) throw new Error('Logging out did not work. Try again in a moment.');
      try {
        localStorage.removeItem('bb.wall.target');
      } catch {
        // Nothing remembered, nothing to forget.
      }
      stopEditing();
      onChange({ visitor: null, walls: [], loaded: true });
      setDraft('');
      setLeaving(false);
      setNote('Logged out. This browser has no ID now; paste one to go on with its collections.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  return (
    <section className="mt-16 border-t border-line pt-6" aria-labelledby="wall-id">
      <h2 id="wall-id" className="text-sm font-medium text-ink">Your ID</h2>
      <p className="mt-1 max-w-2xl text-xs text-ink-3">
        Your collections belong to this ID, kept in a cookie in this browser. To go on with collections from another device or from someone else,
        paste their ID here and press <em>Use this ID</em> — or open the link that carries it. Anyone with your ID or its link can change your collections, so share it only with whom you mean to.
      </p>
      <div className="mt-3 flex max-w-2xl flex-wrap gap-2">
        <input
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste an ID to go on with its collections"
          spellCheck={false}
          autoComplete="off"
          aria-label="Your ID"
          className="min-w-[16rem] flex-1 rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(value.trim()).then(
              () => setNote('Copied.'),
              () => setNote('Copying did not work here; select the ID and copy it by hand.'),
            )
          }
          disabled={!value.trim()}
          className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(idLink(window.location.origin, normalVisitorId(value))).then(
              () => setNote('Link copied. Whoever opens it can work on these collections.'),
              () => setNote('Copying did not work here.'),
            )
          }
          disabled={!isVisitorId(normalVisitorId(value))}
          className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          Copy link
        </button>
        {other && (
          <button
            type="button"
            onClick={save}
            className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent disabled:opacity-40"
          >
            Use this ID
          </button>
        )}
        {me.visitor && !other && !leaving && (
          <button
            type="button"
            onClick={() => setLeaving(true)}
            className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent"
          >
            Log out
          </button>
        )}
      </div>
      {leaving && (
        <div className="mt-3 flex max-w-2xl flex-wrap items-center gap-2 rounded-card border border-accent/50 bg-surface p-3 text-sm" role="alertdialog" aria-label="Log out?">
          <p className="min-w-0 flex-1 text-ink-2">
            Your collections stay under this ID — copy it first if you want to come back to them. This browser then has no ID until one is pasted.
          </p>
          <button type="button" onClick={logOut} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent">
            Log out
          </button>
          <button type="button" onClick={() => setLeaving(false)} className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent">
            Keep
          </button>
        </div>
      )}
      {note && <p className="mt-2 text-xs text-ink-2" role="status">{note}</p>}
    </section>
  );
}
