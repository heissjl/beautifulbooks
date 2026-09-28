'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CoverImage from './CoverImage';
import { postJson } from './useMyWalls';
import { coverUrlFor } from '@/lib/coverurl';
import type { StartOption } from '@/lib/walls/jumpstart';
import type { PublicWall } from '@/lib/walls/model';

/**
 * "Start from a collection" on /create (ROADMAP 5.13k; Julian, 2026-09-28:
 * „where i definitely want to have it is in the create page“): choose one of
 * ours or one a reader made, see its first covers, and start a collection of
 * one's own from it — unsaved, to keep, drop and add covers.
 */
export default function StartFromPicker({ options }: { options: StartOption[] }) {
  const router = useRouter();
  const [chosen, setChosen] = useState(options[0] ? `${options[0].kind}:${options[0].key}` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (options.length === 0) return null;
  const option = options.find((o) => `${o.kind}:${o.key}` === chosen) ?? options[0];
  const ours = options.filter((o) => o.kind === 'curated');
  const readers = options.filter((o) => o.kind === 'reader');

  async function start() {
    setBusy(true);
    setError('');
    try {
      const { wall } = await postJson<{ wall: PublicWall }>('/api/walls/from', option.kind === 'curated' ? { curated: option.key } : { reader: option.key });
      router.push(`/c/${wall.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
      setBusy(false);
    }
  }

  const label = (o: StartOption) => `${o.title}${o.by ? ` — by ${o.by}` : ''} (${o.count}${o.taken < o.count ? `, the first ${o.taken} go in` : ''})`;
  return (
    <div className="mt-8">
      <h3 className="text-sm font-medium text-ink">Or start from a collection</h3>
      <p className="mt-1 text-sm text-ink-2">Take one of ours or one a reader made as your first draft, then keep, drop and add covers.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={`${option.kind}:${option.key}`}
          onChange={(e) => setChosen(e.target.value)}
          aria-label="Collection to start from"
          className="w-0 min-w-[10rem] max-w-full flex-1 truncate rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink"
        >
          {ours.length > 0 && (
            <optgroup label="Our collections">
              {ours.map((o) => (
                <option key={o.key} value={`curated:${o.key}`}>{label(o)}</option>
              ))}
            </optgroup>
          )}
          {readers.length > 0 && (
            <optgroup label="Collections by readers">
              {readers.map((o) => (
                <option key={o.key} value={`reader:${o.key}`}>{label(o)}</option>
              ))}
            </optgroup>
          )}
        </select>
        <button type="button" onClick={start} disabled={busy} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent disabled:opacity-50">
          {busy ? 'Starting…' : 'Start my own from this'}
        </button>
      </div>
      <ul className="mt-3 flex gap-1.5" aria-label={`First covers of ${option.title}`}>
        {option.covers.map((id) => (
          <li key={id} className="relative h-16 w-11 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">
            <CoverImage src={coverUrlFor(`ol:${id}`, 'S') ?? ''} alt="" sizes="44px" />
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-accent" role="alert">{error}</p>}
    </div>
  );
}
