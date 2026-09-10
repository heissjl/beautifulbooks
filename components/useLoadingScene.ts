'use client';

import { useEffect, useRef, useState } from 'react';
import type { StageCover } from './LoadingStage';
import { measureStage, type StagedRect } from './flyCovers';
import type { Cover } from '@/lib/model';

/** Covers enter the stage at this cadence, however fast they arrive. */
export const SCENE_CADENCE_MS = 520;
/** Entrance animation length; a cover counts as shown once it has settled. */
export const SCENE_SETTLE_MS = 650;
/** The scene runs for at least this many covers, and at most this many. */
export const SCENE_MIN_COVERS = 2;
export const SCENE_MAX_COVERS = 4;
/** If images fail to arrive, end the scene this long after the covers are known. */
export const SCENE_GRACE_MS = 4000;
const PRELOAD = 8;

interface SceneControl {
  key: string;
  queue: StageCover[];
  seen: Set<string>;
  presenting: number;
  settled: number;
  dataDone: boolean;
  ended: boolean;
  cadenceTimer?: ReturnType<typeof setTimeout>;
  graceTimer?: ReturnType<typeof setTimeout>;
  settleTimers: Array<ReturnType<typeof setTimeout>>;
  aborted: boolean;
}

export interface LoadingScene {
  /** Covers currently on stage, in presentation order. */
  presented: StageCover[];
  /** True once the scene has finished for this key. */
  done: boolean;
  /** Stage geometry captured when the scene ended, for the FLIP to the gallery. */
  staged: StagedRect[];
}

/**
 * Paces the loading scene (SPEC 8.1): covers are preloaded as soon as the
 * fast response knows them, presented one at a time at a steady cadence,
 * and the scene ends only after at least SCENE_MIN_COVERS have fully
 * entered. If the data is still loading it keeps going up to
 * SCENE_MAX_COVERS. All state changes happen in timers and callbacks.
 */
export function useLoadingScene(key: string, covers: readonly Cover[] | null, dataDone: boolean): LoadingScene {
  const [presented, setPresented] = useState<{ key: string; covers: StageCover[] }>({ key: '', covers: [] });
  const [done, setDone] = useState<{ key: string; staged: StagedRect[] }>({ key: '', staged: [] });
  const ctl = useRef<SceneControl | null>(null);

  // One controller per request key; tear down timers on change.
  useEffect(() => {
    const c: SceneControl = { key, queue: [], seen: new Set(), presenting: 0, settled: 0, dataDone: false, ended: false, settleTimers: [], aborted: false };
    ctl.current = c;
    return () => {
      c.aborted = true;
      clearTimeout(c.cadenceTimer);
      clearTimeout(c.graceTimer);
      c.settleTimers.forEach(clearTimeout);
    };
  }, [key]);

  // Preload covers as soon as they are known; arrivals join the queue.
  useEffect(() => {
    const c = ctl.current;
    if (!c || c.key !== key || !covers) return;

    const end = () => {
      if (c.ended || c.aborted) return;
      c.ended = true;
      setDone({ key, staged: measureStage() });
    };

    const maybeEnd = () => {
      if (c.ended || c.aborted) return;
      const allSettled = c.settled === c.presenting;
      if (c.presenting >= SCENE_MIN_COVERS && allSettled && (c.dataDone || c.presenting >= SCENE_MAX_COVERS)) end();
      // Data is done and nothing more will arrive: end even below the minimum.
      else if (c.dataDone && allSettled && c.queue.length === 0 && c.presenting > 0 && c.presenting >= Math.min(SCENE_MIN_COVERS, c.seen.size)) end();
    };
    c.dataDone = dataDone;

    /*
      **The wait was over before the scene began.**

      `useWorkPages` keeps the last few books this tab has walked, so going
      back to one returns it whole on the first render — covers known and
      page 0 already hashed. Staging two of those covers at a 520 ms cadence
      and flying them into a wall that is ready to be drawn is not a loading
      scene, it is a four-second delay: measured on 2026-09-10 coming back
      from the decade page, the fan appeared after 1 s and stood until 5 s.
      SPEC F2.12 already promised this ends at once; now it does.

      On a cold page this cannot fire: the covers are known long before
      page 0 is hashed, so `dataDone` is false at this moment.
    */
    if (c.dataDone && covers.length > 0) {
      end();
      return;
    }

    const tick = () => {
      c.cadenceTimer = undefined;
      if (c.ended || c.aborted) return;
      if (c.presenting >= SCENE_MAX_COVERS || c.queue.length === 0) { maybeEnd(); return; }
      const next = c.queue.shift()!;
      c.presenting += 1;
      setPresented(p => (p.key === key ? { key, covers: [...p.covers, next] } : { key, covers: [next] }));
      c.settleTimers.push(setTimeout(() => { c.settled += 1; maybeEnd(); }, SCENE_SETTLE_MS));
      c.cadenceTimer = setTimeout(tick, SCENE_CADENCE_MS);
    };

    for (const cover of covers.slice(0, PRELOAD)) {
      const url = cover.urlSmall ?? cover.url;
      const img = new window.Image();
      img.onload = () => {
        if (c.aborted || c.ended || c.seen.has(cover.id)) return;
        c.seen.add(cover.id);
        c.queue.push({ id: cover.id, url });
        if (!c.cadenceTimer) tick();
      };
      img.src = url;
    }
    if (covers.length === 0) end();
    c.graceTimer = setTimeout(() => { if (!c.ended && c.presenting < SCENE_MIN_COVERS) end(); }, SCENE_GRACE_MS);
    // Expose maybeEnd for the dataDone effect below.
    (c as SceneControl & { maybeEnd?: () => void }).maybeEnd = maybeEnd;
  }, [key, covers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Data completion may end a scene that is already at its minimum.
  useEffect(() => {
    const c = ctl.current as (SceneControl & { maybeEnd?: () => void }) | null;
    if (!c || c.key !== key) return;
    c.dataDone = dataDone;
    if (dataDone) c.maybeEnd?.();
  }, [key, dataDone]);

  return {
    presented: presented.key === key ? presented.covers : [],
    done: done.key === key,
    staged: done.key === key ? done.staged : [],
  };
}
