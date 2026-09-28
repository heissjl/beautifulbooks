'use client';

import { useState } from 'react';
import { idLink } from '@/lib/walls/idlink';
import { isVisitorId, normalVisitorId, type PublicWall } from '@/lib/walls/model';
import { postJson, type MyWalls } from './useMyWalls';

/**
 * The footer field from taketest.xyz (E22): your ID, and a Save button that
 * makes this browser the visitor whose ID was pasted.
 */
export default function WallIdField({ me, onChange }: { me: MyWalls; onChange: (me: MyWalls) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const value = draft ?? me.visitor ?? '';

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

  return (
    <section className="mt-16 border-t border-line pt-6" aria-labelledby="wall-id">
      <h2 id="wall-id" className="text-sm font-medium text-ink">Your ID</h2>
      <p className="mt-1 max-w-2xl text-xs text-ink-3">
        Your collections belong to this ID, kept in a cookie in this browser. To work on them on another device, paste it there and press Save, or
        copy the link, which carries the ID, and open it there. Anyone with the ID or the link can change your collections, so share it only with whom you mean to.
      </p>
      <div className="mt-3 flex max-w-2xl flex-wrap gap-2">
        <input
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Comes with your first collection"
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
        <button
          type="button"
          onClick={save}
          disabled={!value.trim()}
          className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {note && <p className="mt-2 text-xs text-ink-2" role="status">{note}</p>}
    </section>
  );
}
