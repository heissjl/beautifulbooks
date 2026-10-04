'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from './useMyWalls';
import { editHref } from '@/lib/walls/edit';
import type { PublicWall } from '@/lib/walls/model';

/**
 * "Start my own from this" (ROADMAP 5.13k): a curated collection or a reader's
 * one becomes the first draft of a collection of one's own, then one keeps,
 * drops and adds covers on it. It lands unsaved (5.13j).
 */
export default function StartFromCollection({ curated, reader, className = '' }: { curated?: string; reader?: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    setBusy(true);
    setError('');
    try {
      const { wall } = await postJson<{ wall: PublicWall }>('/api/walls/from', curated ? { curated } : { reader });
      router.push(editHref(wall.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
      setBusy(false);
    }
  }
  return (
    <span className={className}>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {busy ? 'Starting…' : 'Start my own from this'}
      </button>
      {error && <span className="ml-2 text-xs text-accent" role="alert">{error}</span>}
    </span>
  );
}
