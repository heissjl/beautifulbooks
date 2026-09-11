'use client';

import { useState } from 'react';
import CoverImage from './CoverImage';
import { useRowFit, type RowMeasure } from './useRowFit';
import type { Cover } from '@/lib/model';
import { languageName } from '@/lib/normalize';
import { fitCount } from '@/lib/rowfit';

export interface CoverTab {
  language?: string;
  covers: Cover[];
}

interface CoverGalleryProps {
  /** Already ordered by the server (SPEC §3 F2.3). */
  groups: CoverTab[];
  /** Every cover of the wall, newest first, for the "All languages" pill (ROADMAP 6.8). */
  allCovers: readonly Cover[];
  selectedCover: Cover | null;
  onSelectCover: (cover: Cover) => void;
  /** Caption per cover id, e.g. "Scribner 1996". */
  captions: ReadonlyMap<string, string>;
  /**
   * Rendered directly under the language pills (Julian, 2026-09-09: „den link
   * unter die pillen, nicht darüber").
   *
   * A slot rather than the link itself, so the gallery keeps knowing nothing
   * about decade pages — which of them exist is `data/decade-pages.json`, and
   * that belongs to the page, not to a list of covers.
   */
  belowTabs?: React.ReactNode;
}

const tabKey = (g: CoverTab) => g.language ?? 'unknown';
/** The key of the "All languages" pill; no language code is spelled like it. */
const ALL = '*all';
/** The probe key of the "+n more" pill, measured with two digits. */
const MORE = '*more';
/**
 * Until the row has been measured, a phone shows this many languages — the
 * rule before the rows were counted, so the first frame does not show all
 * seventeen of a much-translated book and then fold them away.
 */
const PHONE_TABS = 6;

/**
 * Which named languages stay visible so that the pills take at most two rows
 * on a phone and three on a desktop (Julian, 2026-09-11) — "+n more",
 * "Unknown" and "All languages" included, which are never tucked away. The
 * active tab always stays; if it lies past the limit, it is counted in.
 */
function visibleLanguages(
  named: readonly CoverTab[],
  activeKey: string,
  m: RowMeasure,
  fixedKeys: readonly string[],
): Set<string> {
  const width = (k: string) => m.widths[k] ?? 0;
  const fixed = fixedKeys.map(width);
  const base = { rowWidth: m.rowWidth, gap: m.gap, maxRows: m.maxRows, start: m.start };
  const keys = named.map(tabKey);
  const k = fitCount({ ...base, lead: keys.map(width), tail: [width(MORE), ...fixed], tailIfAll: fixed });
  const activeAt = keys.indexOf(activeKey);
  if (activeAt < 0 || activeAt < k) return new Set(keys.slice(0, k));
  // The active tab lies past the limit: it stays, and takes a place.
  const others = keys.filter(key => key !== activeKey);
  const kept = fitCount({
    ...base,
    lead: others.map(width),
    tail: [width(activeKey), width(MORE), ...fixed],
    tailIfAll: [width(activeKey), ...fixed],
  });
  return new Set([...others.slice(0, kept), activeKey]);
}

export default function CoverGallery({ groups, allCovers, selectedCover, onSelectCover, captions, belowTabs }: CoverGalleryProps) {
  // The tab follows the selected cover unless the user picked a tab since
  // the selection last changed (derived state, no effect needed).
  const [picked, setPicked] = useState<{ key: string; forSelectedId: string | null } | null>(null);
  // Whether every language pill is shown. Once opened it stays open.
  const [expanded, setExpanded] = useState(false);
  // Destructured, as with `useOverflowsX`: reading members of the hook's
  // result in render trips `react-hooks/refs`.
  const { row: pillRow, probe: pillProbe, measure: rowMeasure } = useRowFit();
  const selectedId = selectedCover?.id ?? null;
  const owner = selectedCover ? groups.find(g => g.covers.some(c => c.id === selectedCover.id)) : undefined;
  const hasAll = groups.length > 1;
  const activeKey =
    picked && picked.forSelectedId === selectedId && (picked.key !== ALL || hasAll)
      ? picked.key
      : owner ? tabKey(owner) : groups[0] ? tabKey(groups[0]) : 'unknown';

  const showingAll = activeKey === ALL;
  const shown = showingAll ? allCovers : (groups.find(g => tabKey(g) === activeKey) ?? groups[0])?.covers ?? [];
  const total = groups.reduce((n, g) => n + g.covers.length, 0);

  /*
    "Unknown" is never tucked away (Julian, 2026-09-11: „unter unknown
    verstecken sich oft noch Sachen"; on Nineteen Eighty-Four it holds 100 of
    224 covers), nor is "All languages". They stand after "+n more".
  */
  const named = groups.filter(g => g.language !== undefined);
  const unknown = groups.find(g => g.language === undefined);
  const fixedKeys = [...(unknown ? [tabKey(unknown)] : []), ...(hasAll ? [ALL] : [])];
  const measured = !expanded && rowMeasure ? visibleLanguages(named, activeKey, rowMeasure, fixedKeys) : null;
  const tucked = expanded
    ? []
    : measured
      ? named.filter(g => !measured.has(tabKey(g)))
      : named.slice(PHONE_TABS).filter(g => tabKey(g) !== activeKey);
  // Measured: hidden on every screen. Not yet measured: only on a phone.
  const tuckedClass = measured ? 'hidden' : 'max-sm:hidden';
  const isTucked = (g: CoverTab) => tucked.includes(g);

  const pill = (key: string, label: React.ReactNode, count: number, extra = '') => (
    <button
      key={key}
      role="tab"
      aria-selected={key === activeKey}
      onClick={() => setPicked({ key, forSelectedId: selectedId })}
      className={`chip shrink-0 ${extra}`}
    >
      {label}
      <span className="text-xs opacity-70">{count}</span>
    </button>
  );
  const tab = (g: CoverTab) => pill(tabKey(g), languageName(g.language), g.covers.length, isTucked(g) ? tuckedClass : '');

  return (
    <section aria-label="Covers">
      {/*
        The pills **wrap** (ROADMAP 6.8, Julian 2026-09-11, "Weg 1"), and take
        **at most two rows on a phone and three on a desktop**: what does not
        fit stands behind "+n more". Until then they scrolled sideways on a
        phone, and a pill at the end of that row — "All languages" — stood out
        of sight there while a desktop showed it (SPEC N14).
      */}
      <div className="relative mb-4">
      <div ref={pillRow} className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Language">
        <span className="kicker mr-2 w-full sm:w-auto">{total} cover{total !== 1 ? 's' : ''}</span>
        {named.map(tab)}
        {tucked.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={`chip shrink-0 ${measured ? '' : 'sm:hidden'}`}
            aria-label={`Show ${tucked.length} more languages`}
          >
            +{tucked.length} more
          </button>
        )}
        {unknown && tab(unknown)}
        {/*
          At the end, behind "Unknown": in front it would read as the default
          and undo the language order of F2.4, which exists so that the
          searched language comes first (Julian, 2026-09-07).
        */}
        {hasAll && pill(ALL, 'All languages', total)}
      </div>
      {/*
        One copy of every pill, invisible and out of the flow, so the widths of
        the ones currently tucked away are known too (`useRowFit`).
      */}
      <div ref={pillProbe} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex w-max gap-2">
        <span data-k="kicker" className="kicker">{total} cover{total !== 1 ? 's' : ''}</span>
        {groups.map(g => (
          <span key={tabKey(g)} data-k={tabKey(g)} className="chip shrink-0">
            {languageName(g.language)}
            <span className="text-xs opacity-70">{g.covers.length}</span>
          </span>
        ))}
        <span data-k={MORE} className="chip shrink-0">+99 more</span>
        <span data-k={ALL} className="chip shrink-0">
          All languages
          <span className="text-xs opacity-70">{total}</span>
        </span>
      </div>
      {/* 5 px, one more than the 4 the link had above the pills. */}
      {belowTabs && <div className="mt-[5px]">{belowTabs}</div>}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-5" role="tabpanel">
        {shown.map((cover, index) => {
          const selected = selectedCover?.id === cover.id;
          const caption = captions.get(cover.id) ?? '';
          return (
            <button
              key={cover.id}
              data-cover-id={cover.id}
              style={{ animationDelay: `${Math.min(index, 24) * 35}ms` }}
              onClick={() => {
                // Picking a cover in the whole wall keeps the whole wall; it
                // must not jump to that cover's language tab.
                if (showingAll) setPicked({ key: ALL, forSelectedId: cover.id });
                onSelectCover(cover);
              }}
              aria-pressed={selected}
              aria-label={caption ? `Cover, ${caption}` : 'Cover'}
              className={`tile-in group relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 text-left transition-transform duration-300 ease-out focus-visible:outline-none ${
                selected
                  ? 'cover-shadow ring-2 ring-accent ring-offset-2 ring-offset-bg'
                  : 'cover-shadow hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
              }`}
            >
              <CoverImage
                src={cover.urlSmall ?? cover.url}
                alt={caption ? `Cover, ${caption}` : 'Cover'}
                sizes="(max-width: 640px) 33vw, (max-width: 1280px) 20vw, 12vw"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8 text-left text-[11px] font-medium leading-tight text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                {caption}
              </div>
              {cover.similarIds && cover.similarIds.length > 0 && (
                <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white" title={`${cover.similarIds.length} more scan${cover.similarIds.length > 1 ? 's' : ''} of this cover`}>
                  +{cover.similarIds.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
