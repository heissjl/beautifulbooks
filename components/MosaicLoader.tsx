'use client';

import { useEffect, useRef, useState } from 'react';
import AssemblingWall from './AssemblingWall';
import { Clearing, type MosaicScene } from './mosaicClearing';
import {
  frameHeight, pickImage, pickTemplate, revealOrder, shuffledSources, unpackBytes,
  type MosaicEntry, type MosaicManifest,
} from '@/lib/loading';

/**
 * What a search looks like while it runs (ROADMAP 6.19a): an author's face
 * assembling out of the covers of their own books.
 *
 * **One picture and 2 KB of JSON.** The mosaic is computed offline
 * (`lab/loading/build-all.ts`) and lives in `public/loading`; the browser
 * fetches one JPEG, decodes it once, and every cell of the animation is a
 * `drawImage` from that same file. No cover is ever requested on its own —
 * that was the constraint the whole thing was built against (Julian,
 * 2026-09-08: „es darf clientseitig nicht zu ressourcenverbrauchend sein").
 *
 * **If anything is missing or slow, this is the old wall.** A picture that
 * has not arrived is not a reason to show an empty box: until the mosaic is
 * decoded — and for good if it fails — the reader sees `AssemblingWall`,
 * which is what the site showed before and needs nothing new.
 */

/** How wide the picture is, by the site's own phone/desktop breakpoint. */
const PHONE_WIDTH = 260;
const DESKTOP_WIDTH = 420;
/**
 * Long enough to be a picture, short enough that most waits do not outlast it.
 *
 * Four seconds at first, a quarter faster since 2026-09-10 (Julian:
 * „verschnellere die Animation des Mosaik um 25%"). The clearing is eased, so
 * the visible part of it happens in the first second either way.
 */
const DURATION_MS = 3000;

function frameWidthFor(innerWidth: number): number {
  return innerWidth >= 640 ? DESKTOP_WIDTH : PHONE_WIDTH;
}

/** The one shown last, so the next throw is visibly a different picture. */
let lastShown: string | null = null;

/**
 * Which template comes next.
 *
 * **A fresh throw every time the picture is shown** (Julian, 2026-09-10:
 * „überprüfe ob wirklich random zwischen den 20 Autoren gewechselt wird bei
 * jedem neuen Anzeigen der Animation" — it was not; it was drawn once per
 * session and kept). The one just shown is excluded, because two throws in
 * twenty land on the same author often enough to look like a bug.
 *
 * The price is bytes: a reader who searches ten times pays for up to ten
 * pictures instead of one, about 90 KB each, and each is then in their
 * browser cache for the rest of the session. That is the trade Julian asked
 * for, and it is written down in ROADMAP 6.19a.
 */
function chooseTemplate(rotation: MosaicEntry[]): MosaicEntry | undefined {
  const fresh = rotation.filter(entry => entry.id !== lastShown);
  return pickTemplate(fresh.length > 0 ? fresh : rotation);
}

async function loadScene(frameWidth: number): Promise<MosaicScene> {
  const rotation = (await (await fetch('/loading/index.json')).json()) as MosaicEntry[];
  const entry = chooseTemplate(rotation);
  if (!entry) throw new Error('no loading mosaics');
  const manifest = (await (await fetch(`/loading/${entry.id}.json`)).json()) as MosaicManifest;
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const image = pickImage(manifest.images, frameWidth, dpr);
  const blob = await (await fetch(`/loading/${image.file}`)).blob();
  const bitmap = await createImageBitmap(blob);
  const lum = unpackBytes(manifest.lum);
  const cells = manifest.cols * manifest.rows;
  return {
    manifest,
    image,
    bitmap,
    frameWidth,
    // Seeded with the cell count, the same way the lab does it, so a template
    // always clears in the same arrangement.
    order: revealOrder('random', lum, manifest.cols, manifest.rows, cells),
    shuffle: shuffledSources(cells, cells),
  };
}

/**
 * The next picture, fetched early and held until it is shown.
 *
 * A search is where this is needed, and a search starts with typing: by the
 * time the reader presses Enter the picture is usually there, and whoever
 * never searches never fetches one. It is **consumed** when a loader mounts,
 * so the next wait draws a new author rather than reusing this one.
 */
let pending: Promise<MosaicScene> | null = null;

export function preloadMosaic() {
  if (pending || typeof window === 'undefined') return;
  pending = loadScene(frameWidthFor(window.innerWidth)).catch(err => {
    pending = null;
    throw err;
  });
}

/** The picture for the wait that is starting now, and the next one begins fresh. */
function takeMosaic(): Promise<MosaicScene> {
  preloadMosaic();
  const taken = pending!;
  pending = null;
  return taken;
}

export default function MosaicLoader({ caption }: { caption: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<MosaicScene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    takeMosaic()
      .then(loaded => {
        lastShown = loaded.manifest.id;
        if (alive) setScene(loaded);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!scene || !canvas) return;
    const clearing = new Clearing(canvas, scene, DURATION_MS);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clearing.finish();
      return;
    }
    /*
      The clock starts on the **first frame**, not here.

      Between this line and the first animation frame the browser has to draw
      the scrambled wall — 1,440 tiles — and lay the page out, and on a phone
      that is a stall of a few hundred milliseconds with a search still in
      flight. Timing from before it spends part of the animation before
      anything is on screen, and a long enough stall would show the finished
      picture and nothing else.
    */
    let raf = 0;
    let started = false;
    clearing.paint();
    const step = (now: number) => {
      if (!started) {
        started = true;
        clearing.begin(now);
      }
      raf = clearing.tick(now) ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [scene]);

  // Nothing to draw yet, or nothing to draw at all: the wall the site had
  // before, which costs no new request.
  if (failed || !scene) return <AssemblingWall caption={caption} />;

  // Decided when the picture was chosen, not during render: the two must
  // agree, or the file fetched is not the size that is shown.
  const width = scene.frameWidth;
  const height = frameHeight(scene.manifest.cols, scene.manifest.rows, width);

  return (
    <div className="py-10 sm:py-14" aria-busy="true" aria-live="polite" aria-label={caption}>
      {/*
        What is being waited for, **above** the picture and set like a heading
        (Julian, 2026-09-09: „beim Lademosaik sollte der Ladetext grafisch
        über dem Mosaik stehen, nicht als Overlay"). A line laid on the mosaic
        needs a ground of its own and then reads as a label stuck to a
        picture; standing over it, in the display face the rest of the site
        uses for headings, it reads as what the page is doing.
      */}
      <p className="stage-pulse mx-auto mb-4 max-w-md text-balance text-center font-display text-xl leading-snug text-ink sm:mb-5 sm:text-2xl">
        {caption}
      </p>
      <div
        className="mx-auto overflow-hidden rounded-[3px] bg-surface-2"
        style={{ width, height }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
      {/*
        What the picture is, so nobody takes it for an answer to their search
        (SPEC §4 N12). It says what was actually used and nothing more.
      */}
      <p className="mt-3 text-center text-xs text-ink-3">
        {scene.manifest.author} &middot; made of {scene.manifest.tiles.toLocaleString('en')} covers
        of {scene.manifest.works} of their books
      </p>
    </div>
  );
}
