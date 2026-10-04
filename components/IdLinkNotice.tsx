'use client';

import { useEffect, useState } from 'react';
import { postJson, type MyWalls } from './useMyWalls';
import { rich, useT } from './i18n';
import { idFromHash } from '@/lib/walls/idlink';
import type { PublicWall } from '@/lib/walls/model';

/**
 * Opening a link with `#id=…` on /create (ROADMAP 5.13l). A browser without an
 * ID takes it at once. A browser that already has another one is asked first:
 * taking the linked ID would leave its own collections behind that ID, so the
 * notice shows it to copy. The fragment leaves the address as soon as it is read.
 */
export default function IdLinkNotice({ me, onChange }: { me: MyWalls; onChange: (me: MyWalls) => void }) {
  const t = useT();
  const [linked, setLinked] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    const id = idFromHash(window.location.hash);
    if (!window.location.hash.includes('id=')) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    Promise.resolve().then(() => (id ? setLinked(id) : setNote(t('That link carried no ID of this site.'))));
    // t is stable for the page's locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function adopt(id: string) {
    try {
      const data = await postJson<{ visitor: string; walls: PublicWall[] }>('/api/walls/me', { visitor: id });
      onChange({ ...data, loaded: true });
      setLinked(null);
      setNote(data.walls.length === 1 ? t('This browser now uses the ID from the link: 1 collection.') : t('This browser now uses the ID from the link: {n} collections.', { n: data.walls.length }));
    } catch (err) {
      setNote(err instanceof Error ? err.message : t('That did not work.'));
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
      setNote(t('This link carries the ID this browser already uses.'));
    });
    // adopt is stable enough: it only reads its argument.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiet, same]);

  if (linked && me.loaded && own && !same) {
    return (
      <div className="mt-6 rounded-card border border-accent/50 bg-surface p-4" role="status">
        <p className="text-sm text-ink">{t('This link carries someone’s collections — or yours from another device.')}</p>
        <p className="mt-1 text-xs text-ink-3">
          {rich(t('This browser already has its own ID, {id}. If you switch, its collections stay with that ID; copy it first if you want them back later.'), { id: <span className="font-mono">{own}</span> })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => adopt(linked)} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent">
            {t('Use the ID from the link')}
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(own).then(() => setNote(t('Your current ID is copied.')), () => setNote(t('Select your ID above and copy it by hand.')))}
            className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent"
          >
            {t('Copy my current ID')}
          </button>
          <button type="button" onClick={() => setLinked(null)} className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent">
            {t('Keep mine')}
          </button>
        </div>
        {note && <p className="mt-2 text-xs text-ink-2">{note}</p>}
      </div>
    );
  }
  return note ? <p className="mt-6 text-sm text-ink-2" role="status">{note}</p> : null;
}
