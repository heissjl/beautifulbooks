'use client';

import { useEffect, useRef, useState } from 'react';
import type { StageCover } from './LoadingStage';
import { measureStage, type StagedRect } from './flyCovers';
import { proxiedCoverSrc } from '@/lib/coverurl';
import type { Cover } from '@/lib/model';

/** Covers enter the stage at this cadence, however fast they arrive. */
export const SCENE_CADENCE_MS = 520;
/** Entrance animation length; a cover counts as shown once it has settled. */
export const SCENE_SETTLE_MS = 650;
/** The scene runs for at least this many covers, and at most this many. */
export const SCENE_MIN_COVERS = 2;
export const SCENE_MAX_COVERS = 4;
/** If almost nothing arrives, end the scene this long after the covers are known. */
export const SCENE_GRACE_MS = 4000;
/**
 * And end it in any case after this long.
 *
 * The scene waits for the wall's first row (below), and a row that never
 * loads must not become an endless curtain. Eight seconds because the wall's
 * first row was measured ready at 7.6 s on a cold page in production
 * (2026-09-10) — a cap under that would cut in more often than it saves
 * anyone.
 */
export const SCENE_CAP_MS = 8000;
/**
 * How many covers should be ready before the scene hands over to the wall.
 *
 * The wall's first row, near enough. Until 2026-09-10 the scene ended when
 * the **data** was there and flew its covers onto a row that was two-thirds
 * empty — measured cold in production on *Silas Marner*: the scene ended at
 * 3,853 ms with two of six tiles carrying a picture (ROADMAP 6.25a step 3).
 *
 * This costs nothing extra to know: since the preload asks for the very
 * addresses the wall renders, a loaded preload **is** a wall tile that will
 * paint at once.
 */
export const SCENE_FIRST_ROW = 6;
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
  capTimer?: ReturnType<typeof setTimeout>;
  /** Whether the end waits for the wall's first row at all (only when the page says which covers that is). */
  wallGate: boolean;
  /** The covers the wall will show first, in its order, as last reported by the page. */
  wallIds: string[];
  /** Wall covers whose image has arrived — or failed, since waiting longer would not change that. */
  wallDone: Set<string>;
  /** Wall covers already asked for, so a re-render does not ask twice. */
  wallAsked: Set<string>;
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
export interface SceneOptions {
  /**
   * The cover the page already shows — the one a result card handed over.
   * It becomes the first tile at once, with its own address, so the fan
   * opens with the picture that is already there (`lib/scene.ts`).
   */
  lead?: StageCover;
  /**
   * The covers the wall will show first, in the wall's own order. When given,
   * the scene does not hand over until these have arrived: measured on
   * 2026-09-10, the preloads are page 0 in the catalogue's order while the
   * wall is sorted by language, and on *Daniel Deronda* only one of the wall's
   * first six was among them. An empty list means "not known yet" and holds
   * the scene, within its cap.
   */
  wallFirst?: readonly Cover[];
}

export function useLoadingScene(
  key: string,
  covers: readonly Cover[] | null,
  dataDone: boolean,
  options: SceneOptions = {},
): LoadingScene {
  const [presented, setPresented] = useState<{ key: string; covers: StageCover[] }>({ key: '', covers: [] });
  const [done, setDone] = useState<{ key: string; staged: StagedRect[] }>({ key: '', staged: [] });
  const ctl = useRef<SceneControl | null>(null);

  // One controller per request key; tear down timers on change.
  useEffect(() => {
    const c: SceneControl = {
      key, queue: [], seen: new Set(), presenting: 0, settled: 0, dataDone: false, ended: false, settleTimers: [], aborted: false,
      wallGate: false, wallIds: [], wallDone: new Set(), wallAsked: new Set(),
    };
    ctl.current = c;
    return () => {
      c.aborted = true;
      clearTimeout(c.cadenceTimer);
      clearTimeout(c.graceTimer);
      clearTimeout(c.capTimer);
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
      clearTimeout(c.capTimer);
      setDone({ key, staged: measureStage() });
    };

    /*
      The wall's first row has arrived when every one of its first covers has
      loaded or failed. A failed one will show the wall's quiet placeholder,
      and waiting longer would not change that; the cap bounds the rest.
    */
    const wallReady = () => {
      if (!c.wallGate) return true;
      if (c.wallIds.length === 0) return false;
      const need = Math.min(SCENE_FIRST_ROW, c.wallIds.length);
      return c.wallIds.slice(0, need).every(id => c.wallDone.has(id));
    };

    const maybeEnd = () => {
      if (c.ended || c.aborted) return;
      const allSettled = c.settled === c.presenting;
      // Below the first row the handover would fly onto grey.
      if (!wallReady()) return;
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

    /*
      The card's cover first, and at once: it is already painted, so there is
      nothing to preload and nothing to wait for. Marked as seen so that its
      own preload below, finishing later, does not stage it a second time.
    */
    const lead = options.lead;
    if (lead) {
      c.seen.add(lead.id);
      c.queue.push(lead);
      tick();
    }

    for (const cover of covers.slice(0, PRELOAD)) {
      /*
        **The address the tile will render, not the one the catalogue gave.**

        Since 1.3 every cover goes through `/img`, and this preload was left
        behind on `covers.openlibrary.org`: it loaded one address and the tile
        requested another, so `onload` here proved nothing about the tile and
        the staged frame stood empty while its own request ran (ROADMAP 6.25a,
        measured 2026-09-10 — in production not one staged tile ever held an
        image). The gallery renders the same address again, so one request now
        serves the preload, the staged tile and the wall tile alike.
      */
      const url = proxiedCoverSrc(cover.urlSmall ?? cover.url);
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
    /*
      Two deadlines, each with its own job. The first ends a scene that never
      got going — fewer than two covers after four seconds — which is the case
      the reader would otherwise spend staring at a single cover. The second
      is the cap on everything else: the scene now waits for the wall's first
      row, and a row that never loads must not hold the page for ever.
    */
    c.graceTimer = setTimeout(() => { if (!c.ended && c.presenting < SCENE_MIN_COVERS) end(); }, SCENE_GRACE_MS);
    c.capTimer = setTimeout(() => { if (!c.ended) end(); }, SCENE_CAP_MS);
    // Expose maybeEnd for the dataDone effect below.
    (c as SceneControl & { maybeEnd?: () => void }).maybeEnd = maybeEnd;
  }, [key, covers, options.lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
    The wall's first row, asked for as soon as the page knows what it is.

    Same address as the wall tile (`proxiedCoverSrc` of the small image, as
    `CoverGallery` renders it), so a finished request here is a tile that will
    paint the moment it mounts. Keyed by the ids rather than the array, which
    is rebuilt on every render of the page.
  */
  const wallKey = options.wallFirst ? options.wallFirst.map(cover => cover.id).join(',') : null;
  useEffect(() => {
    const c = ctl.current as (SceneControl & { maybeEnd?: () => void }) | null;
    if (!c || c.key !== key || wallKey === null) return;
    c.wallGate = true;
    c.wallIds = wallKey ? wallKey.split(',') : [];
    for (const cover of options.wallFirst ?? []) {
      if (c.wallAsked.has(cover.id)) continue;
      c.wallAsked.add(cover.id);
      const img = new window.Image();
      const arrived = () => {
        if (c.aborted) return;
        c.wallDone.add(cover.id);
        c.maybeEnd?.();
      };
      img.onload = arrived;
      img.onerror = arrived;
      img.src = proxiedCoverSrc(cover.urlSmall ?? cover.url);
    }
    c.maybeEnd?.();
  }, [key, wallKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
