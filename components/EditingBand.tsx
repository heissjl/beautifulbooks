'use client';

import Link from '@/components/Link';
import { stopEditing, useEditingId } from './editingSession';
import { useMyWalls } from './useMyWalls';
import { editHref } from '@/lib/walls/edit';
import { useT } from './i18n';

/**
 * The editor's band, carried onto a book page (ROADMAP 5.13m, step 4): when
 * this tab came from editing a collection, the book page says which one and
 * leads back. Only while the tab is editing (`sessionStorage`), and only for
 * a collection of this browser's.
 */
export default function EditingBand() {
  const id = useEditingId();
  return id ? <Band id={id} /> : null;
}

function Band({ id }: { id: string }) {
  const t = useT();
  const { me } = useMyWalls();
  const wall = me.walls.find((w) => w.id === id);
  if (!wall) return null;
  // Not sticky: the book page's sidebar sticks at top-20, and a band there would cover its top.
  return (
    <div className="bg-ink text-bg">
      <div className="mx-auto flex min-h-10 max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-sm sm:px-6 lg:px-8">
        <span className="text-[11px] uppercase tracking-[0.14em] text-bg/70">{t('Editing')}</span>
        <span className="min-w-0 flex-1 truncate sm:flex-none">
          {wall.title}
          <span className="text-bg/70"> · {wall.tiles.length === 1 ? t('{n} cover', { n: 1 }) : t('{n} covers', { n: wall.tiles.length })}</span>
        </span>
        <span className="ml-auto flex items-center gap-4">
          <Link href={editHref(id)} className="underline underline-offset-4 hover:text-bg/80">
            {t('Back to the editor')}
          </Link>
          <button type="button" onClick={stopEditing} className="text-bg/70 hover:text-bg">
            {t('Stop editing')}
          </button>
        </span>
      </div>
    </div>
  );
}
