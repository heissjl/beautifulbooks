'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** One turn in 40 s when nobody touches it. */
const DEG_PER_MS = 360 / 40_000;
/** How quickly the ring catches up with where it should be (ms, 1/e). */
const EASE_MS = 110;
/** The ring's centre, as a fraction of the box height (`.rondell-seat` top). */
const CENTRE_Y = 0.46;
/** The ring's half-width on screen, as a fraction of the box width. */
const RX = 0.4;
/** Seen 18° from above, the ring's depth shows as sin 18° of its width. */
const RY_PER_RX = Math.sin((18 * Math.PI) / 180);
/** Closer to the centre than this (in ring radii) the angle jumps; it steers nothing there. */
const DEAD = 0.3;
/** One pointer event never turns the ring further than this, so a fast stroke that skips the middle cannot flip it half round. */
const MAX_STEP = 45;

/**
 * The home page's rondell (ROADMAP 1.9): covers on a ring that turns by
 * itself and can be turned by hand.
 *
 * The angle is one custom property, `--turn`, written on the box each frame;
 * the ring turns by it and every face turns back by it (globals.css), so a
 * cover travels round without showing its edge. Without script the ring
 * stands still at 0°, which is a finished picture.
 *
 * **The cover under the pointer follows the pointer** (Julian 2026-09-11:
 * „dass man dann wirklich den ganzen Kreis des Rondells bewegen kann … der
 * obere Bereich muss wahrscheinlich entgegengesetzt reagieren"). The pointer
 * is read as an angle on the ring's ellipse — 0° at the front, 180° at the
 * back — and the ring turns by however much that angle changed. A stroke to
 * the right along the front covers carries them right; the same stroke along
 * the back covers carries those right, which turns the ring the other way;
 * and a circle drawn round the ring turns it round and round.
 *
 * The pointer moves a target, not the ring: the ring eases toward it, so a
 * jerky mouse still makes a smooth turn, and leaving hands the ring back to
 * its own slow turn from wherever it stands. Under `prefers-reduced-motion`
 * it does not turn by itself, but still follows the pointer, because that
 * motion is the reader's own.
 */
export default function HeroRondell({ faces }: { faces: ReactNode[] }) {
  const box = useRef<HTMLDivElement>(null);
  const step = 360 / faces.length;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let turn = 0;
    let target = 0;
    let over = false; // while the pointer is over the ring, it turns only by hand
    let anchor: number | null = null; // the pointer's last angle on the ring
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      if (!over && !still.matches) target += dt * DEG_PER_MS;
      turn += (target - turn) * (1 - Math.exp(-dt / EASE_MS));
      el.style.setProperty('--turn', `${turn.toFixed(2)}deg`);
      frame = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      over = true;
      const r = el.getBoundingClientRect();
      const rx = r.width * RX;
      const x = (e.clientX - (r.left + r.width / 2)) / rx;
      const y = (e.clientY - (r.top + r.height * CENTRE_Y)) / (rx * RY_PER_RX);
      // Through the middle the angle swings from front to back; forget it there,
      // or crossing the middle would flip the ring half round (measured 2026-09-11).
      if (Math.hypot(x, y) < DEAD) {
        anchor = null;
        return;
      }
      const angle = (Math.atan2(x, y) * 180) / Math.PI;
      if (anchor !== null) {
        const moved = ((angle - anchor + 540) % 360) - 180;
        // A cover at ring angle a stands at a - turn, so following the pointer means turning against it.
        target -= Math.max(-MAX_STEP, Math.min(MAX_STEP, moved));
      }
      anchor = angle;
    };
    const leave = () => {
      over = false;
      anchor = null;
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <div ref={box} className="rondell relative mx-auto h-[12.5rem] w-[19rem]">
      <div className="rondell-ring">
        {faces.map((face, i) => (
          <div key={i} className="rondell-seat" style={{ ['--a' as string]: `${i * step}deg` }}>
            <div className="rondell-face">{face}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
