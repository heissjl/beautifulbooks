'use client';

import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import CoverImage from './CoverImage';
import IsbnText from './IsbnText';
import LocalShops from './LocalShops';
import MarketSwitcher from './MarketSwitcher';
import { useMarket } from './useMarket';
import { buyLinksFor, searchLinksFor, trackedBuyHref } from '@/lib/buylinks';
import { coverUrlFor } from '@/lib/coverurl';
import { agentList, shoppingText } from '@/lib/walls/shoppinglist';
import { linkPlan } from '@/lib/linkplan';
import type { Market } from '@/lib/market';
import type { BuyLink } from '@/lib/model';
import { FORMAT_CM, formatLength, isEstimate, ASSUMED_THICKNESS_CM, clearDepth, layoutPiece, ledges, measurements, PIECE_CM, pieceRange, roughWeightKg, unitLabel, type BookSize, type Units } from '@/lib/walls/dimensions';
import { mouldingEdge, mouldingImage, SAMPLE } from '@/lib/walls/moulding';
import { DEFAULT_ARTWORK, FRAMES, MAX_COLUMNS, TONES, type FrameColor, type PublicWall, type Tile, type Tone, type WallOp } from '@/lib/walls/model';

const WANTED_KEY = (id: string) => `bb.wall.wanted.${id}`;
const UNITS_KEY = 'bb.units';
/** Which books of a collection are bought: this browser's own note, never sent anywhere (5.14 stage 1). */
const BOUGHT_KEY = (id: string) => `bb.wall.bought.${id}`;

function readBought(id: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(BOUGHT_KEY(id)) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
function writeBought(id: string, bought: ReadonlySet<string>) {
  try {
    localStorage.setItem(BOUGHT_KEY(id), JSON.stringify([...bought]));
  } catch {
    // A private window: the ticks last for this visit only.
  }
}

function readUnits(): Units | null {
  try {
    const v = localStorage.getItem(UNITS_KEY);
    return v === 'metric' || v === 'imperial' ? v : null;
  } catch {
    return null;
  }
}

/** Where a book's size came from, in words for its row (5.13i). */
const SOURCE_NOTE: Record<BookSize['source'], string> = {
  openlibrary: 'size from Open Library',
  library: 'height from a national library, width from the cover',
  format: 'typical size for its format',
  assumed: 'size unknown, a paperback assumed',
};

function readWanted(id: string): boolean {
  try {
    return localStorage.getItem(WANTED_KEY(id)) === '1';
  } catch {
    return false;
  }
}

/**
 * Step 2 of the funnel (ROADMAP 5.13f): the collection as **one piece** — a
 * deep frame, a toned back panel, the books themselves standing on small
 * wedges (Julian, 2026-09-28: „a single big frame with books on little wedge
 * platforms with a toned background as one piece of artwork, that is
 * something for which the books themselves need to be bought“). Framed prints
 * of single covers would be the alternative, if the site may sell them — that
 * is being researched (docs/plans/research-cover-prints.md). Nothing is sold
 * yet; the last line counts who would order the piece.
 */
export default function WallPlan({
  wall,
  onSend,
  onWall,
  market: detected,
}: {
  wall: PublicWall;
  onSend: (ops: WallOp[]) => void;
  onWall: (wall: PublicWall) => void;
  market: Market;
}) {
  const [chosenMarket, setMarket] = useMarket();
  const market = chosenMarket ?? detected;
  const [open, setOpen] = useState<string | null>(null);
  const [bought, setBought] = useState<Set<string>>(() => readBought(wall.id));
  const [listNote, setListNote] = useState('');
  const toggleBought = (coverId: string) =>
    setBought((prev) => {
      const next = new Set(prev);
      if (next.has(coverId)) next.delete(coverId);
      else next.add(coverId);
      writeBought(wall.id, next);
      return next;
    });
  const pageUrl = () => `${window.location.origin}/c/${wall.id}`;
  const nextToGet = wall.tiles.find((t) => !bought.has(t.coverId));
  // A real link with target=_blank, not window.open: a script-opened window is a
  // popup to some browsers, and the app's own browser opened it in place
  // (Julian, 2026-09-29: „open next shop muss in einem neuen tab öffnen“).
  const nextShop = nextToGet ? (() => {
    const { plan, href } = shopsFor(nextToGet, market);
    const link = plan.lead[0] ?? plan.rest[0];
    return link ? { label: link.label, href: href(link) } : null;
  })() : null;
  const openedNext = () => {
    if (!nextToGet) return;
    setListNote(nextShop ? `Opened ${nextShop.label} for ${nextToGet.title}. Tick it once you have bought it.` : `No shop to open for ${nextToGet.title}.`);
  };
  const copyList = () =>
    navigator.clipboard.writeText(shoppingText(wall, bought, pageUrl())).then(
      () => setListNote('List copied.'),
      () => setListNote('Copying did not work here.'),
    );
  const downloadForAgent = () => {
    const blob = new Blob([JSON.stringify(agentList(wall, bought, pageUrl()), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shopping-list-${wall.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setListNote('Saved. Give the file to your own browser agent; it buys in your accounts, after you confirm.');
  };
  const tone = wall.artwork?.tone ?? DEFAULT_ARTWORK.tone;
  const frameColor = wall.artwork?.frame ?? DEFAULT_ARTWORK.frame;
  const [chosenUnits, setChosenUnits] = useState<Units | null>(readUnits);
  const units: Units = chosenUnits ?? (market === 'us' ? 'imperial' : 'metric');
  const chooseUnits = (u: Units) => {
    setChosenUnits(u);
    try {
      localStorage.setItem(UNITS_KEY, u);
    } catch {
      // Not remembered in a private window.
    }
  };
  const L = (cm: number) => formatLength(cm, units);
  const U = unitLabel(units);
  // The preview draws every book at its size; one without a size yet as a paperback.
  const sizes = wall.tiles.map((t) => t.size);
  const plan = layoutPiece(sizes.map((z) => z ?? FORMAT_CM.trade), wall.columns);
  const [showMeasures, setShowMeasures] = useState(false);
  // Front, or at an angle that shows the depth (Julian, 2026-09-29: „bau … die Schrägansicht“).
  const [angled, setAngled] = useState(false);
  const measures = showMeasures && !angled ? measurements(plan) : [];
  /** A length on the piece as a CSS length: the wrapper is a size container as wide as the frame. */
  const len = (cmValue: number) => `calc(100cqw * ${(cmValue / plan.outerWidthCm).toFixed(5)})`;
  const moulding = FRAMES[frameColor].moulding;
  // Edges of 3D-transformed boxes are drawn without antialiasing in Chrome and Safari; a
  // transparent outline makes the browser smooth them (Julian, 2026-09-29: „mehr antialiasing im bild“).
  const smooth = angled ? { outline: '1px solid transparent', backfaceVisibility: 'visible' as const } : {};
  const shelves = ledges(plan, sizes.map((z) => z ?? FORMAT_CM.trade));
  // The box is as deep as its thickest book needs (Julian, 2026-09-29: „rechne die Tiefe nach“).
  const depth = clearDepth(shelves);
  const weight = roughWeightKg(sizes.map((z) => z ?? FORMAT_CM.trade), { w: plan.widthCm, h: plan.heightCm }, { w: plan.outerWidthCm, h: plan.outerHeightCm }, shelves);
  const unknownThickness = sizes.filter((z) => z?.t === undefined).length;
  const range = pieceRange(sizes, wall.columns);
  const pending = sizes.filter((z) => !z).length;
  const c = PIECE_CM;
  const sizeText = (a: number, b: number) => (Math.round(a) === Math.round(b) || L(a) === L(b) ? L(a) : `${L(a)}–${L(b)}`);
  const [wanted, setWanted] = useState(() => readWanted(wall.id));
  const [error, setError] = useState('');
  // Tiles that came without a printing (six random covers, a photo) or without a size are
  // looked up once, here. Counting only missing printings left a tile that had its printing
  // but no size waiting forever under "Sizes are being looked up" (found 2026-09-29).
  const unlooked = wall.tiles.filter((t) => (t.printings.length === 0 && !t.looked) || !t.size).length;
  const [lookup, setLookup] = useState<'idle' | 'looking' | 'failed'>('idle');
  useEffect(() => {
    if (unlooked === 0) return;
    let live = true;
    Promise.resolve().then(() => live && setLookup('looking'));
    fetch(`/api/walls/${wall.id}/printings`, { method: 'POST' })
      .then(async (r) => {
        const d = (await r.json()) as { wall?: PublicWall; failed?: number };
        if (!live) return;
        if (r.ok && d.wall) onWall(d.wall);
        setLookup(r.ok && !d.failed ? 'idle' : 'failed');
      })
      .catch(() => live && setLookup('failed'));
    return () => {
      live = false;
    };
    // Once per collection and count of tiles still waiting; onWall is stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wall.id, unlooked]);

  // Everything is placed in centimetres on the back panel and shown in per cent of it.
  const pct = (cm: number, of: number) => `${(cm / of) * 100}%`;

  async function want() {
    setError('');
    try {
      const res = await fetch(`/api/walls/${wall.id}/interest`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setWanted(true);
      try {
        localStorage.setItem(WANTED_KEY(wall.id), '1');
      } catch {
        // Not remembered in a private window; counted anyway.
      }
    } catch {
      setError('That did not go through. Try again in a moment.');
    }
  }

  return (
    <section className="mt-16 border-t border-line pt-6" aria-labelledby="make-a-wall">
      <p className="kicker">Next step</p>
      <h2 id="make-a-wall" className="font-display text-2xl text-ink">Make it a piece for your wall</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        One deep frame, the books themselves standing on clear acrylic ledges against a toned background — your collection as a single piece of art. It is made of the real books, so it starts with finding them.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-2">
        <label className="flex items-center gap-2">
          Books per row
          <select
            value={Math.min(wall.columns, MAX_COLUMNS)}
            onChange={(e) => onSend([{ op: 'columns', columns: Number(e.target.value) }])}
            className="rounded-full border border-line bg-surface px-2 py-1 text-sm text-ink"
          >
            {Array.from({ length: MAX_COLUMNS }, (_, i) => i + 1).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Background">
          Background
          {(Object.keys(TONES) as Tone[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={t === tone}
              title={TONES[t].label}
              aria-label={TONES[t].label}
              onClick={() => onSend([{ op: 'artwork', tone: t }])}
              className={`h-6 w-6 rounded-full border ${t === tone ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'border-line'}`}
              style={{ background: TONES[t].hex }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Frame">
          Frame
          {(Object.keys(FRAMES) as FrameColor[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={f === frameColor}
              title={FRAMES[f].label}
              aria-label={FRAMES[f].label}
              onClick={() => onSend([{ op: 'artwork', frame: f }])}
              className={`h-6 w-6 rounded-sm border ${f === frameColor ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'border-line'}`}
              // A mitred corner of the moulding, as a framer's sample shows it.
              style={{ backgroundImage: mouldingImage(FRAMES[f].moulding), backgroundSize: '280%', backgroundPosition: '0 0' }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs" role="radiogroup" aria-label="View">
          {([false, true] as const).map((a) => (
            <button
              key={String(a)}
              type="button"
              role="radio"
              aria-checked={angled === a}
              onClick={() => setAngled(a)}
              className={`rounded-full border px-2.5 py-0.5 ${angled === a ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:border-accent hover:text-accent'}`}
            >
              {a ? 'Angle' : 'Front'}
            </button>
          ))}
        </div>
        <label className={`flex items-center gap-2 ${angled ? 'opacity-40' : ''}`}>
          <input type="checkbox" checked={showMeasures} disabled={angled} onChange={(e) => setShowMeasures(e.target.checked)} className="accent-accent" />
          Show measurements
        </label>
      </div>

      {/* The piece: the moulding drawn from a sample frame with border-image, the back panel, books on acrylic ledges. */}
      <div className="mt-5 overflow-hidden rounded bg-surface-2 px-4 pb-4 pt-7 sm:px-8 sm:pb-8 sm:pt-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(255,255,255,.35), transparent 70%)' }}>
        <div
          className="relative mx-auto"
          style={{
            maxWidth: `min(100%, ${Math.round((460 * plan.outerWidthCm) / plan.outerHeightCm)}px)`,
            aspectRatio: `${plan.outerWidthCm} / ${plan.outerHeightCm}`,
            containerType: 'inline-size',
            perspective: '1800px',
          }}
          role="img"
          aria-label={`Preview${angled ? ' at an angle' : ''}: ${wall.tiles.length} books on acrylic ledges in a ${FRAMES[frameColor].label.toLowerCase()} frame, ${plan.columns} per row, ${TONES[tone].label} background`}
        >
          <div
            className="absolute inset-0 transition-transform duration-500"
            style={{
              ...smooth,
              transformStyle: 'preserve-3d',
              transform: angled ? 'rotateY(-28deg) rotateX(-6deg) scale(.86)' : 'none',
              boxShadow: angled ? 'none' : '0 14px 30px -12px rgba(0,0,0,.5), 0 2px 4px rgba(0,0,0,.2)',
            }}
          >
            <div
              className="absolute"
              style={{
                ...smooth,
                left: pct(c.moulding, plan.outerWidthCm),
                top: pct(c.moulding, plan.outerHeightCm),
                right: pct(c.moulding, plan.outerWidthCm),
                bottom: pct(c.moulding, plan.outerHeightCm),
                transformStyle: 'preserve-3d',
                transform: angled ? `translateZ(calc(-1 * ${len(depth)}))` : 'none',
              // The back panel is cloth or paper, not flat paint: a fine noise over the tone
              // (Julian, 2026-09-28: „gib dem background etwas textur“).
              backgroundColor: TONES[tone].hex,
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"), repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.03) 0 1px, transparent 1px 3px)`,
              // The moulding throws a shadow onto the panel, heavier from the top left.
                // The moulding throws a shadow onto the panel, heavier from the top left.
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.18), inset 4px 8px 18px rgba(0,0,0,.3)',
              }}
            >
              {wall.tiles.map((t, i) => {
                const { x, y, w: bw, h: bh } = plan.books[i];
                const src = coverUrlFor(`ol:${t.coverId}`, 'M');
                // In the angled view a book stands out from the panel by its thickness. The view comes
                // from the right, so the fore-edge shows and the spine, which is not drawn, stays hidden
                // (Julian, 2026-09-29: „von der anderen seite … fällt nicht auf, dass die bücherrücken fehlen“).
                const thick = t.size?.t ?? ASSUMED_THICKNESS_CM;
                return (
                  <Fragment key={t.coverId}>
                    {angled && (
                      <span
                        className="absolute"
                        style={{
                          ...smooth,
                          left: pct(x + bw, plan.widthCm),
                          top: pct(y, plan.heightCm),
                          width: len(thick),
                          height: pct(bh, plan.heightCm),
                          transformOrigin: 'left',
                          transform: `translateZ(${len(thick)}) rotateY(90deg)`,
                          // The fore-edge: paper, in fine lines.
                          background: 'repeating-linear-gradient(90deg, #efe8d8 0 1px, #d9d0bd 1px 2px)',
                        }}
                      />
                    )}
                    <span
                      className="absolute overflow-hidden rounded-[1px] bg-surface-2"
                      style={{
                        ...smooth,
                        left: pct(x, plan.widthCm),
                        top: pct(y, plan.heightCm),
                        width: pct(bw, plan.widthCm),
                        height: pct(bh, plan.heightCm),
                        boxShadow: '3px 5px 9px rgba(0,0,0,.35), inset 3px 0 4px rgba(0,0,0,.25)',
                        transform: angled ? `translateZ(${len(thick)})` : undefined,
                      }}
                    >
                      {src && <CoverImage src={src} alt="" sizes={angled ? "240px" : "120px"} />}
                    </span>
                  </Fragment>
                );
              })}
              {/* One clear acrylic ledge per row, the books standing on it (5.15). */}
              {shelves.map((l, r) => (
                <Fragment key={`ledge-${r}`}>
                  <span
                    className="absolute"
                    style={{
                      left: pct(l.x, plan.widthCm),
                      top: pct(l.y, plan.heightCm),
                      width: pct(l.length, plan.widthCm),
                      height: pct(c.ledge, plan.heightCm),
                      background: 'linear-gradient(rgba(255,255,255,.55), rgba(255,255,255,.12) 18%, rgba(255,255,255,.06) 80%, rgba(255,255,255,.3))',
                      borderTop: '1px solid rgba(255,255,255,.8)',
                      boxShadow: '0 1px 2px rgba(0,0,0,.18)',
                    }}
                  />
                  {angled && (
                    <span
                      className="absolute"
                      style={{
                        ...smooth,
                        left: pct(l.x, plan.widthCm),
                        top: pct(l.y, plan.heightCm),
                        width: pct(l.length, plan.widthCm),
                        height: len(l.depth),
                        transformOrigin: 'top',
                        transform: 'rotateX(90deg)',
                        background: 'linear-gradient(rgba(255,255,255,.35), rgba(255,255,255,.15))',
                        borderBottom: '1px solid rgba(255,255,255,.85)',
                      }}
                    />
                  )}
                </Fragment>
              ))}
            </div>
            {angled && (
              <>
                {/* The shadow the box throws on the wall behind it. */}
                <span
                  className="absolute inset-0"
                  style={{ ...smooth, transform: `translateZ(calc(-1 * ${len(depth)} - 1px))`, boxShadow: '-10px 30px 40px -6px rgba(0,0,0,.4)' }}
                />
                {/* The inside of the box: four walls from the moulding back to the panel, lined like the panel. */}
                {(['left', 'right', 'top', 'bottom'] as const).map((side) => {
                  const across = side === 'left' || side === 'right';
                  const inset = { x: pct(c.moulding, plan.outerWidthCm), y: pct(c.moulding, plan.outerHeightCm) };
                  return (
                    <span
                      key={side}
                      className="absolute"
                      style={{
                        ...smooth,
                        ...(across
                          ? { top: inset.y, bottom: inset.y, width: len(depth), [side]: inset.x }
                          : { left: inset.x, right: inset.x, height: len(depth), [side]: inset.y }),
                        transformOrigin: side,
                        transform: { left: 'rotateY(90deg)', right: 'rotateY(-90deg)', top: 'rotateX(-90deg)', bottom: 'rotateX(90deg)' }[side],
                        backgroundColor: TONES[tone].hex,
                        backgroundImage: `linear-gradient(rgba(0,0,0,${side === 'right' ? 0.12 : side === 'top' ? 0.3 : 0.2}), rgba(0,0,0,${side === 'right' ? 0.12 : side === 'top' ? 0.3 : 0.2}))`,
                      }}
                    />
                  );
                })}
                {/* The outside of the moulding, as deep as the box. */}
                <span
                  className="absolute right-0 top-0 h-full"
                  style={{ ...smooth, width: len(depth), transformOrigin: 'right', transform: 'rotateY(-90deg)', background: mouldingEdge(moulding) }}
                />
                <span
                  className="absolute left-0 top-0 w-full"
                  style={{ ...smooth, height: len(depth), transformOrigin: 'top', transform: 'rotateX(-90deg)', background: mouldingEdge(moulding) }}
                />
              </>
            )}
            {/* The moulding: a sample frame, its corners kept and its pieces stretched along their length. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                borderStyle: 'solid',
                borderWidth: len(c.moulding),
                borderImage: `${mouldingImage(moulding)} ${SAMPLE.band} stretch`,
              }}
            />
          </div>
          {showMeasures && (
            <>
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                viewBox={`0 0 ${plan.outerWidthCm} ${plan.outerHeightCm}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {measures.map((d, i) => (
                  <line key={i} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="#c2410c" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
              {measures.map((d, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[10px] leading-tight text-[#9a3412] shadow-sm"
                  style={{ left: pct((d.x1 + d.x2) / 2, plan.outerWidthCm), top: pct((d.y1 + d.y2) / 2, plan.outerHeightCm) }}
                >
                  {L(d.cm)}
                </span>
              ))}
              <span
                className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[10px] leading-tight text-[#9a3412]"
                style={{ left: '50%', top: 0, transform: 'translate(-50%, calc(-100% - 6px))' }}
              >
                {L(plan.outerWidthCm)} × {L(plan.outerHeightCm)} {U} outside
              </span>
            </>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-ink-2">
          {range.estimated === 0 && pending === 0 ? 'About ' : 'Between '}
          <strong className="font-medium text-ink">
            {sizeText(range.min.w, range.max.w)} × {sizeText(range.min.h, range.max.h)} {U}
          </strong>
          , {L(depth)} {U} deep inside, about {weight} kg: {wall.tiles.length} books, {plan.columns} per row.{' '}
          <span className="text-ink-3">
            {pending > 0
              ? 'Sizes are being looked up.'
              : range.estimated > 0
                ? `${range.estimated} of ${wall.tiles.length} ${wall.tiles.length === 1 ? 'size is' : 'sizes are'} estimated, so this is a range.`
                : 'From the sizes the catalogues give.'}
          </span>
        </p>
        <div className="flex items-center gap-1 text-xs">
          {/* The plan a framing workshop builds from (ROADMAP 5.15). */}
          <a
            href={`/api/walls/${wall.id}/plan?units=${units}`}
            download
            className="mr-2 rounded-full border border-line px-2.5 py-0.5 text-ink-2 hover:border-accent hover:text-accent"
          >
            Frame plan (PDF)
          </a>
          <div className="flex gap-1" role="radiogroup" aria-label="Units">
          {(['metric', 'imperial'] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={units === u}
              onClick={() => chooseUnits(u)}
              className={`rounded-full border px-2.5 py-0.5 ${units === u ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:border-accent hover:text-accent'}`}
            >
              {unitLabel(u)}
            </button>
          ))}
          </div>
        </div>
      </div>
      {/* What a reader should know before it goes on the wall (Julian, 2026-09-29: „bau die Warnhinweise ein“;
          from the conservation sources in research-book-wall-artists.md). Says what the site knows, no more. */}
      <details className="mt-3 max-w-2xl text-sm text-ink-2">
        <summary className="cursor-pointer text-ink">Before it goes on the wall</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            It weighs about {weight} kg, estimated. Hang it from two points on fixings rated for at least twice that, not from one nail.
          </li>
          <li>Keep it out of direct sun. Covers fade behind UV-filtering glazing too, only more slowly.</li>
          <li>
            Not above a radiator, and not in a bathroom or kitchen: paper covers warp when the air turns from dry to damp and back.
          </li>
          <li>Nothing is glued to the books. They stand on their ledges and come out again to be read; ask for a front that opens.</li>
          {unknownThickness > 0 && (
            <li>
              The thickness of {unknownThickness === wall.tiles.length ? 'the books is' : `${unknownThickness} of ${wall.tiles.length} books is`} not known, so the
              depth assumes {L(ASSUMED_THICKNESS_CM)} {U} each. A thick hardcover needs a deeper frame: measure the thickest book before ordering.
            </li>
          )}
        </ul>
      </details>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">
          Get the books{' '}
          <span className="font-normal text-ink-3">
            · {wall.tiles.filter((t) => bought.has(t.coverId)).length} of {wall.tiles.length} bought
          </span>
        </h3>
        <MarketSwitcher market={market} onChange={setMarket} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {nextShop ? (
          <a href={nextShop.href} target="_blank" rel="noopener" onClick={openedNext} className="rounded-full bg-ink px-3 py-1 text-bg transition-colors hover:bg-accent">
            Open next shop
          </a>
        ) : (
          <button type="button" onClick={openedNext} disabled={!nextToGet} className="rounded-full bg-ink px-3 py-1 text-bg transition-colors hover:bg-accent disabled:opacity-40">
            {nextToGet ? 'Open next shop' : 'All bought'}
          </button>
        )}
        <button type="button" onClick={copyList} className="rounded-full border border-line bg-surface px-3 py-1 text-ink-2 hover:border-accent hover:text-accent">
          Copy list
        </button>
        <button type="button" onClick={downloadForAgent} className="rounded-full border border-line bg-surface px-3 py-1 text-ink-2 hover:border-accent hover:text-accent">
          Download for your agent
        </button>
      </div>
      {listNote && <p className="mt-2 text-xs text-ink-2" role="status">{listNote}</p>}
      <p className="mt-1 max-w-2xl text-xs text-ink-3">
        An ISBN names a printing, not its picture: the same number has carried other covers. Whether a shop shows this very cover today is checked on the book&rsquo;s page.
      </p>
      <ol className="mt-3 divide-y divide-line">
        {wall.tiles.map((t) => {
          const p = t.printings[0];
          const isbns = t.printings.map((x) => x.isbn13 ?? x.isbn10).filter(Boolean);
          const isOpen = open === t.coverId;
          return (
            <li key={t.coverId} className="py-2">
              <div className={`flex items-center gap-3 ${bought.has(t.coverId) ? 'opacity-60' : ''}`}>
                <input
                  type="checkbox"
                  checked={bought.has(t.coverId)}
                  onChange={() => toggleBought(t.coverId)}
                  aria-label={`Bought ${t.title}`}
                  title="Bought"
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">
                  <CoverImage src={coverUrlFor(`ol:${t.coverId}`, 'S') ?? ''} alt="" sizes="32px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm text-ink ${bought.has(t.coverId) ? 'line-through decoration-ink-3' : ''}`}>{t.title}{t.author ? ` — ${t.author}` : ''}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {p
                      ? [p.publisher, p.year].filter(Boolean).join(' ') || 'Printing on record, without publisher or year'
                      : t.looked
                        ? 'No printing on record for this cover'
                        : lookup === 'failed'
                          ? 'The catalogue did not answer — the printing is not looked up yet'
                          : 'Looking up the printing…'}
                    {isbns.length > 0 && (
                      <>
                        {' · ISBN '}
                        {isbns.slice(0, 2).map((n, i) => (
                          <span key={n}>
                            {i > 0 && ', '}
                            <IsbnText isbn={n as string} />
                          </span>
                        ))}
                        {isbns.length > 2 ? ` +${isbns.length - 2}` : ''}
                      </>
                    )}
                    {t.size && (
                      <span title={SOURCE_NOTE[t.size.source]}>
                        {' · '}
                        {isEstimate(t.size) ? '≈ ' : ''}
                        {L(t.size.h)} × {L(t.size.w)} {U}
                      </span>
                    )}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : t.coverId)}
                  aria-expanded={isOpen}
                  aria-controls={`find-${t.coverId}`}
                  className="shrink-0 whitespace-nowrap text-xs text-accent underline decoration-line underline-offset-4 hover:decoration-accent"
                >
                  {isOpen ? 'Close' : 'Find it'}
                </button>
              </div>
              {isOpen && <FindIt id={`find-${t.coverId}`} tile={t} market={market} />}
            </li>
          );
        })}
      </ol>

      <div className="mt-8 rounded-md bg-surface-2 p-4">
        <p className="text-sm text-ink">Would you rather have it made — the books found, mounted and framed, sent to you?</p>
        <p className="mt-1 text-xs text-ink-3">We don&rsquo;t offer that yet. Press if you would order it; when enough people do, we will.</p>
        {wanted ? (
          <p className="mt-3 text-sm text-ink-2" role="status">Noted — thank you.</p>
        ) : (
          <button type="button" onClick={want} className="mt-3 rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent">
            I&rsquo;d order this piece
          </button>
        )}
        {error && <p className="mt-2 text-xs text-accent" role="alert">{error}</p>}
      </div>
    </section>
  );
}

/**
 * The shops for one printing, opened in its row (Julian, 2026-09-28: „lass die
 * kauflinks hier ausklappen statt auf die andere seite umzuleiten“). The same
 * shops and order as the book page (`linkPlan`): its own ISBN field where the
 * number belongs to the market, title/author/publisher/year elsewhere. An ISBN
 * link goes through /go/, which counts it and rebuilds the target. What the
 * page cannot do here is the verdict — whether the publisher's image is this
 * cover — so the last line leads there.
 */
/**
 * The shops for one book, as the book page orders them (`linkPlan`), and the
 * address to open for each: through /go/ when built from the ISBN, so the
 * click is counted as on the book page. Shared by "Find it" and "Open next shop".
 */
function shopsFor(tile: Tile, market: Market) {
  const p = tile.printings.find((x) => x.isbn13) ?? tile.printings[0];
  const isbn13 = p?.isbn13;
  const buyLinks = isbn13 ? buyLinksFor({ isbn13 }, market) : [];
  const byIsbn = new Set(buyLinks.map((l) => l.provider));
  const plan = linkPlan({
    edition: { isbn13 },
    buyLinks,
    searchLinks: searchLinksFor(
      { title: tile.title, author: tile.author, publisher: p?.publisher, year: p?.year, coverUrl: coverUrlFor(`ol:${tile.coverId}`, 'L') ?? undefined },
      market,
    ),
    market,
  });
  const href = (link: BuyLink) => (isbn13 && byIsbn.has(link.provider) ? trackedBuyHref(link.provider, isbn13, market) : link.url);
  return { plan, isbn13, href };
}

function FindIt({ id, tile, market }: { id: string; tile: Tile; market: Market }) {
  const { plan, isbn13, href } = shopsFor(tile, market);
  const shop = (link: BuyLink) => {
    return (
      <a
        key={link.provider}
        href={href(link)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn"
      >
        {link.label}
      </a>
    );
  };
  return (
    <div id={id} className="mb-2 ml-11 mt-3">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="min-w-0">
          {plan.note && <p className="mb-2 max-w-xl text-xs text-ink-3">{plan.note}</p>}
          <div className="flex flex-wrap gap-2">{plan.lead.map(shop)}</div>
          {plan.rest.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-ink-2 hover:text-accent">More places to look</summary>
              <div className="mt-2 flex flex-wrap gap-2">{plan.rest.map(shop)}</div>
            </details>
          )}
        </div>
        {/* Beside the online shops: a local bookshop that can order it (5.12). */}
        <div className="min-w-0 md:border-l md:border-line md:pl-6">
          <LocalShops edition={{ isbn13, title: tile.title, author: tile.author }} market={market} beside />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        <Link href={`/book/${tile.workId}?cover=ol:${tile.coverId}`} className="underline underline-offset-2 hover:text-accent">
          Check on the book&rsquo;s page whether shops show this cover
        </Link>
      </p>
    </div>
  );
}
