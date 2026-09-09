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
/** Long enough to be a picture, short enough that most waits do not outlast it. */
const DURATION_MS = 4000;
/** Remembering the choice is what keeps a rotation of twenty to one download. */
const SESSION_KEY = 'loading-mosaic';

function frameWidthFor(innerWidth: number): number {
  return innerWidth >= 640 ? DESKTOP_WIDTH : PHONE_WIDTH;
}

/**
 * Which template this reader sees.
 *
 * Drawn once per session and remembered: twenty templates with a fresh throw
 * per search would mean nineteen searches out of twenty pay for a file the
 * browser has never seen. The rotation is meant to vary between readers and
 * days, not between keystrokes.
 */
function chooseTemplate(rotation: MosaicEntry[]): MosaicEntry | undefined {
  let kept: string | null = null;
  try {
    kept = sessionStorage.getItem(SESSION_KEY);
  } catch {
    // Private mode, or storage switched off. A random one per search is a
    // worse deal, not a broken one.
  }
  const known = rotation.find(entry => entry.id === kept);
  if (known) return known;
  const chosen = pickTemplate(rotation);
  try {
    if (chosen) sessionStorage.setItem(SESSION_KEY, chosen.id);
  } catch {
    // As above.
  }
  return chosen;
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
 * The fetch, started early and shared.
 *
 * A search is where this is needed, and a search starts with typing: by the
 * time the reader presses Enter the picture is usually there, and whoever
 * never searches never fetches one.
 */
let pending: Promise<MosaicScene> | null = null;

export function preloadMosaic() {
  if (pending || typeof window === 'undefined') return;
  pending = loadScene(frameWidthFor(window.innerWidth)).catch(err => {
    pending = null;
    throw err;
  });
}

export default function MosaicLoader({ caption }: { caption: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<MosaicScene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    preloadMosaic();
    pending
      ?.then(loaded => { if (alive) setScene(loaded); })
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
    let raf = 0;
    const start = performance.now();
    clearing.start(start);
    const step = (now: number) => {
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
      <div
        className="relative mx-auto overflow-hidden rounded-[3px] bg-surface-2"
        style={{ width, height }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        {/*
          What is being waited for, **on** the picture (Julian, 2026-09-09:
          „das ‚looking for …‘ im Ladezustand einfach über das Mosaik
          schreiben und etwas größer, dann ist niemand verwirrt"). A mosaic is
          busy at every point, so the line needs a ground of its own; it sits
          on the site's surface colour at 90 %, which keeps it readable
          through the whole animation — the wall starts dimmed towards that
          same colour and clears out from under it.
        */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-3">
          <p className="stage-pulse mx-auto w-fit rounded bg-surface/90 px-3 py-2 text-center text-base leading-snug text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)] sm:text-lg">
            {caption}
          </p>
        </div>
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
