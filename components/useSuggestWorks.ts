'use client';

import { useCallback, useState } from 'react';
import { parseSuggestRows, type SuggestedWork } from '@/lib/suggest';

/*
  The list behind the suggestions (ROADMAP 6.69) is its own chunk, fetched the
  first time the field gets focus or a keystroke — 16 KB gzip that a reader who
  never types never loads. Module memory keeps it for the rest of the visit.
*/
let loaded: SuggestedWork[] | null = null;
let pending: Promise<SuggestedWork[]> | null = null;

function load(): Promise<SuggestedWork[]> {
  pending ??= import('@/data/suggest-works.json').then(file => {
    loaded = parseSuggestRows(file.default.works);
    return loaded;
  });
  return pending;
}

/** The published works for suggestions, and the call that fetches them (from an event, never an effect). */
export function useSuggestWorks(): [SuggestedWork[] | null, () => void] {
  const [works, setWorks] = useState<SuggestedWork[] | null>(loaded);
  const ensure = useCallback(() => {
    if (works) return;
    // A failed chunk only means no suggestions; the search itself is untouched.
    load().then(setWorks, () => { pending = null; });
  }, [works]);
  return [works, ensure];
}
