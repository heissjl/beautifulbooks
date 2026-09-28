'use client';

import { useEffect, useState } from 'react';
import { postJson, type MyWalls } from './useMyWalls';
import { idFromHash } from '@/lib/walls/idlink';
import type { PublicWall } from '@/lib/walls/model';

/**
 * Opening a link with `#id=…` on /create (ROADMAP 5.13l). A browser without an
 * ID takes it at once. A browser that already has another one is asked first:
 * taking the linked ID would leave its own collections behind that ID, so the
 * notice shows it to copy. The fragment leaves the address as soon as it is read.
 */
export default function IdLinkNotice({ me, onChange }: { me: MyWalls; onChange: (me: MyWalls) => void }) {
  const [linked, setLinked] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    const id = idFromHash(window.location.hash);
    if (!window.location.hash.includes('id=')) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    Promise.resolve().then(() => (id ? setLinked(id) : setNote('That link carried no ID of this site.')));
  }, []);

  async function adopt(id: string) {
    try {
      const data = await postJson<{ visitor: string; walls: PublicWall[] }>('/api/walls/me', { visitor: id });
      onChange({ ...data, loaded: true });
      setLinked(null);
      setNote(data.walls.length === 1 ? 'This browser now uses the ID from the link: 1 collection.' : `This browser now uses the ID from the link: ${data.walls.length} collections.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  // Decide once it is known whether this browser has an ID of its own.
  const own = me.visitor;
  const same = !!linked && linked === own;
  const quiet = !!linked && me.loaded && !own;
  useEffect(() => {
    if (quiet && linked) adopt(linked);
    else if (same) Promise.resolve().then(() => {
      setLinked(null);
      setNote('This link carries the ID this browser already uses.');
    });
    // adopt is stable enough: it only reads its argument.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiet, same]);

  if (linked && me.loaded && own && !same) {
    return (
      <div className="mt-6 rounded-card border border-accent/50 bg-surface p-4" role="status">
        <p className="text-sm text-ink">This link carries someone&rsquo;s collections — or yours from another device.</p>
        <p className="mt-1 text-xs text-ink-3">
          This browser already has its own ID, <span className="font-mono">{own}</span>. If you switch, its collections stay with that ID; copy it first if you want them back later.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => adopt(linked)} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent">
            Use the ID from the link
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(own).then(() => setNote('Your current ID is copied.'), () => setNote('Select your ID above and copy it by hand.'))}
            className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent"
          >
            Copy my current ID
          </button>
          <button type="button" onClick={() => setLinked(null)} className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent">
            Keep mine
          </button>
        </div>
        {note && <p className="mt-2 text-xs text-ink-2">{note}</p>}
      </div>
    );
  }
  return note ? <p className="mt-6 text-sm text-ink-2" role="status">{note}</p> : null;
}
