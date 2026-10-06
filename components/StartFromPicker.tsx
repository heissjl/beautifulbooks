'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CoverImage from './CoverImage';
import WallProposal, { type Destination } from './WallProposal';
import { postJson } from './useMyWalls';
import { useT } from './i18n';
import { coverUrlFor } from '@/lib/coverurl';
import { editHref } from '@/lib/walls/edit';
import type { StartOption } from '@/lib/walls/jumpstart';
import { tileCoverId, type PublicWall, type Tile } from '@/lib/walls/model';

type Loaded = { key: string; title: string; tiles: Tile[]; skipped: number } | { key: string; error: string };

/**
 * "Start from a collection" on /create (ROADMAP 5.13k; Julian, 2026-09-28:
 * „where i definitely want to have it is in the create page“): choose one of
 * ours or one a reader made, see its first covers, and start a collection of
 * one's own from it — unsaved, to keep, drop and add covers — in its editor.
 *
 * In the editor (`into`, 5.13m) the same choice shows all of its covers to
 * tick into the collection that is open, instead of starting a new one.
 */
export default function StartFromPicker({
  options,
  into,
  onCommit,
  onOtherCover,
  preferred,
}: {
  options: StartOption[];
  into?: PublicWall;
  onCommit?: (dest: Destination, tiles: Tile[]) => Promise<void>;
  onOtherCover?: (tile: Tile) => void;
  /** The option shown first when it is on offer, `curated:<slug>` or `reader:<id>`. */
  preferred?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [chosen, setChosen] = useState(
    preferred && options.some((o) => `${o.kind}:${o.key}` === preferred) ? preferred : options[0] ? `${options[0].kind}:${options[0].key}` : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const choices = into ? options.filter((o) => !(o.kind === 'reader' && o.key === into.id)) : options;
  if (choices.length === 0) return null;
  const option = choices.find((o) => `${o.kind}:${o.key}` === chosen) ?? choices[0];
  const key = `${option.kind}:${option.key}`;
  const ours = choices.filter((o) => o.kind === 'curated');
  const readers = choices.filter((o) => o.kind === 'reader');
  const query: Record<string, string> = option.kind === 'curated' ? { curated: option.key } : { reader: option.key };

  async function start() {
    setBusy(true);
    setError('');
    try {
      const { wall } = await postJson<{ wall: PublicWall }>('/api/walls/from', query);
      router.push(editHref(wall.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('That did not work.'));
      setBusy(false);
    }
  }

  async function show() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/walls/from?${new URLSearchParams(query)}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { title?: string; tiles?: Tile[]; skipped?: number; error?: string };
      if (!res.ok || !data.tiles) throw new Error(data.error ?? t('The collection did not answer.'));
      setLoaded({ key, title: data.title ?? option.title, tiles: data.tiles, skipped: data.skipped ?? 0 });
    } catch (err) {
      setLoaded({ key, error: err instanceof Error ? err.message : t('The collection did not answer.') });
    } finally {
      setBusy(false);
    }
  }

  const label = (o: StartOption) => `${o.title}${o.by ? ` — ${t('by {name}', { name: o.by })}` : ''} (${o.count}${!into && o.taken < o.count ? `, ${t('the first {n} go in', { n: o.taken })}` : ''})`;
  const current = loaded && loaded.key === key ? loaded : null;
  return (
    <div>
      {into ? (
        <h3 className="font-display text-lg text-ink">{t('From another collection')}</h3>
      ) : (
        <h3 className="font-display text-xl text-ink">{t('From a collection')}</h3>
      )}
      <p className="mt-1 text-sm text-ink-2">
        {into
          ? t('One of ours or one a reader showed — tick the covers you want in this one.')
          : t('Take one of ours or one a reader made as your first draft, then keep, drop and add covers.')}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={key}
          onChange={(e) => setChosen(e.target.value)}
          aria-label={into ? t('Collection to take covers from') : t('Collection to start from')}
          className={`w-0 min-w-[10rem] max-w-full flex-1 truncate rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink ${into ? '' : 'basis-full'}`}
        >
          {ours.length > 0 && (
            <optgroup label={t('Our collections')}>
              {ours.map((o) => (
                <option key={o.key} value={`curated:${o.key}`}>{label(o)}</option>
              ))}
            </optgroup>
          )}
          {readers.length > 0 && (
            <optgroup label={t('Collections by readers')}>
              {readers.map((o) => (
                <option key={o.key} value={`reader:${o.key}`}>{label(o)}</option>
              ))}
            </optgroup>
          )}
        </select>
        <button type="button" onClick={into ? show : start} disabled={busy} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent disabled:opacity-50">
          {busy ? (into ? t('Loading…') : t('Starting…')) : into ? t('Show its covers') : t('Start my own from this')}
        </button>
      </div>
      {!current && (
        <ul className="mt-3 grid max-w-sm grid-cols-6 gap-1.5" aria-label={t('First covers of {title}', { title: option.title })}>
          {option.covers.map((id) => (
            <li key={id} className="relative aspect-[2/3] overflow-hidden rounded-[2px] bg-surface-2">
              <CoverImage src={coverUrlFor(tileCoverId(id), 'M') ?? ''} alt="" sizes="64px" />
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-accent" role="alert">{error}</p>}
      {current && 'error' in current && <p className="mt-3 text-sm text-accent" role="alert">{current.error}</p>}
      {into && onCommit && current && 'tiles' in current && (
        <WallProposal
          key={current.key}
          proposals={current.tiles.map((t) => ({ label: t.title, tile: t }))}
          defaultTitle={current.title}
          target={into}
          onCommit={onCommit}
          onOtherCover={onOtherCover}
          summary={`${current.tiles.length === 1 ? t('1 cover from {title}', { title: current.title }) : t('{n} covers from {title}', { n: current.tiles.length, title: current.title })}${current.skipped ? `; ${t('{n} the site shows from its own images cannot go into a collection', { n: current.skipped })}` : ''}.`}
        />
      )}
    </div>
  );
}
