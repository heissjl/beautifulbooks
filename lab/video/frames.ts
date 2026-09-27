/**
 * Draws the clip's frames from a storyboard (lab/video/README.md).
 *
 * The look is the site's, light theme (app/globals.css): the warm ground
 * `--bg`, ink in three steps, the terracotta accent used once per frame, the
 * header row with the italic wordmark and a hairline under it
 * (components/SiteHeader.tsx), covers as cards with `rounded-card` corners
 * and the two-part `cover-shadow`, and the wall's tiles on `--surface-2`.
 * Text is set in the site's Fraunces and Geist by `text.py`.
 *
 * Motion, per shot kind:
 *   - title: kicker, title, an accent rule drawing out, author and years —
 *     each rising 24 px into place, staggered;
 *   - cover: pushed in from the right while the previous card leaves to the
 *     left, then a slow 3 % push-in for the rest of the shot; the caption
 *     fades in once the card has landed; a dot on the timeline at the foot of
 *     the frame travels to the cover's year;
 *   - grid: the last cover flies into its tile while the others settle in one
 *     by one, like the wall filling on the site, then the wall holds;
 *   - end: crossfades in over the wall.
 */
import sharp, { type OverlayOptions } from 'sharp';
import type { CoverShot, GridShot, Shot, Storyboard, TitleShot, EndShot } from './storyboard';

export const THEME = {
  bg: '#f4f0e8',
  surface2: '#ebe5da',
  ink: '#1a1714',
  ink2: '#5a534a',
  ink3: '#746c62',
  line: '#ddd5c8',
  accent: '#945138',
  /** `--shadow-color` in light mode. */
  shadow: '20,16,12',
};

/** A line of text as `text.py` set it: a transparent PNG and its size. */
export interface TextImage { png: Buffer; w: number; h: number }

export interface TextItem {
  id: string;
  text: string;
  font: 'display' | 'display-italic' | 'sans' | 'sans-medium';
  size: number;
  color: string;
  tracking?: number;
  maxWidth?: number;
  lineHeight?: number;
}

const W = 1080;
const H = 1920;
const HEADER = 128;
/** The box a cover card is fitted into; its centre sits a little above the frame's. */
const BOX = { width: 760, height: 1100, centreY: 880 };
const CARD_RADIUS = 12;
const TIMELINE = { left: 150, right: 930, y: 1776 };
/** A push moves both cards by a card's width and a gap, so they travel side by side like a carousel and never overlap. */
const PUSH = BOX.width * 1.03 + 60;

// ---------------------------------------------------------------------------
// Which texts a board needs, so text.py runs once.

export function textItems(board: Storyboard, work: { title: string; author: string }): TextItem[] {
  const items: TextItem[] = [
    { id: 'wordmark', text: 'Beautiful Books', font: 'display-italic', size: 44, color: THEME.ink },
    { id: 'book-title', text: work.title, font: 'display', size: 50, color: THEME.ink, maxWidth: 900 },
    { id: 'book-author', text: work.author, font: 'sans', size: 30, color: THEME.ink3 },
  ];
  if (board.span) {
    items.push({ id: 'span-from', text: String(board.span.from), font: 'sans', size: 26, color: THEME.ink3 });
    items.push({ id: 'span-to', text: String(board.span.to), font: 'sans', size: 26, color: THEME.ink3 });
  }
  const covers = board.shots.filter((s): s is CoverShot => s.kind === 'cover');
  for (const s of board.shots) {
    if (s.kind === 'title') {
      items.push(
        { id: 'title-kicker', text: s.kicker.toUpperCase(), font: 'sans-medium', size: 32, color: THEME.ink3, tracking: 0.12 },
        { id: 'title-title', text: s.title, font: 'display', size: 132, color: THEME.ink, maxWidth: 920, lineHeight: 1.04 },
        { id: 'title-author', text: s.author, font: 'sans', size: 46, color: THEME.ink2 },
        { id: 'title-span', text: s.span, font: 'sans', size: 36, color: THEME.ink3 },
      );
    } else if (s.kind === 'cover') {
      if (s.year !== undefined) items.push({ id: `year-${s.index}`, text: String(s.year), font: 'display', size: 68, color: THEME.ink });
      if (s.publisher) items.push({ id: `pub-${s.index}`, text: s.publisher, font: 'sans', size: 34, color: THEME.ink3, maxWidth: 880 });
      items.push({ id: `count-${s.index}`, text: `${String(s.index + 1).padStart(2, '0')} / ${String(covers.length).padStart(2, '0')}`, font: 'sans', size: 28, color: THEME.ink3 });
    } else if (s.kind === 'grid') {
      const span = board.span ? (board.span.from === board.span.to ? ` · ${board.span.from}` : ` · ${board.span.from}–${board.span.to}`) : '';
      items.push({ id: 'grid-kicker', text: `${s.coverIds.length} covers${span}`.toUpperCase(), font: 'sans-medium', size: 28, color: THEME.ink3, tracking: 0.12 });
    } else if (s.kind === 'end') {
      items.push(
        { id: 'end-wordmark', text: s.wordmark, font: 'display-italic', size: 112, color: THEME.ink },
        { id: 'end-tagline', text: s.tagline, font: 'sans', size: 40, color: THEME.ink3 },
        { id: 'end-url', text: s.url, font: 'sans-medium', size: 44, color: THEME.accent },
        { id: 'end-credit', text: s.credit, font: 'sans', size: 28, color: THEME.ink3 },
      );
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Small tools.

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t: number) => { const x = clamp(t); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const alphaCache = new Map<string, Buffer>();

/** `png` with its alpha scaled by `a`, quantised to 1/24 steps and remembered. */
async function faded(key: string, png: Buffer, a: number): Promise<Buffer | null> {
  const q = Math.round(clamp(a) * 24);
  if (q === 0) return null;
  if (q === 24) return png;
  const k = `${key}@${q}`;
  let out = alphaCache.get(k);
  if (!out) {
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const k24 = q / 24;
    for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * k24);
    out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 0 }).toBuffer();
    alphaCache.set(k, out);
  }
  return out;
}

/** A frame as raw RGB bytes, W × H × 3: what every frame is between steps, so nothing is encoded twice. */
export type Frame = Buffer;
const RAW = { raw: { width: W, height: H, channels: 3 as const } };

function blend(under: Frame, over: Frame, a: number): Frame {
  const out = Buffer.allocUnsafe(under.length);
  for (let i = 0; i < under.length; i++) out[i] = Math.round(under[i] + (over[i] - under[i]) * a);
  return out;
}

async function ground(layers: Layer[] = []): Promise<Frame> {
  return sharp({ create: { width: W, height: H, channels: 3, background: THEME.bg } }).composite(layers).removeAlpha().raw().toBuffer();
}

function svg(body: string, width = W, height = H): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
}

/**
 * `cover-shadow` for a card of this size, scaled to the frame: a hairline,
 * a close 1-2 px shadow and a long soft cast shadow pulled in at the sides.
 * The site's numbers are for a 200 px card; a 760 px card gets them ×2.5.
 */
function shadowSvg(w: number, h: number, scale: number): { png: Promise<Buffer>; pad: number } {
  const pad = Math.round(90 * scale);
  const rgb = THEME.shadow;
  const r = CARD_RADIUS * (scale / 2.5);
  const body = `<defs>
      <filter id="a" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${1 * scale}"/></filter>
      <filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${14 * scale}"/></filter>
    </defs>
    <rect x="${pad + 14 * scale}" y="${pad + 12 * scale}" width="${w - 28 * scale}" height="${h}" rx="${r}" fill="rgb(${rgb})" opacity="0.45" filter="url(#b)"/>
    <rect x="${pad}" y="${pad + 1 * scale}" width="${w}" height="${h}" rx="${r}" fill="rgb(${rgb})" opacity="0.18" filter="url(#a)"/>
    <rect x="${pad - 1}" y="${pad - 1}" width="${w + 2}" height="${h + 2}" rx="${r + 1}" fill="rgb(${rgb})" opacity="0.06"/>`;
  return { png: sharp(svg(body, w + 2 * pad, h + 2 * pad)).png().toBuffer(), pad };
}

/** The image fitted into `w`×`h`, corners rounded like `rounded-card`. */
async function card(image: Uint8Array, w: number, h: number, radius: number, fit: 'inside' | 'contain'): Promise<{ png: Buffer; w: number; h: number }> {
  const resized = await sharp(image)
    .resize({ width: w, height: h, fit, background: THEME.surface2, kernel: 'lanczos3' })
    .flatten({ background: THEME.surface2 })
    .png()
    .toBuffer({ resolveWithObject: true });
  const cw = resized.info.width;
  const ch = resized.info.height;
  const mask = svg(`<rect width="${cw}" height="${ch}" rx="${radius}" fill="#fff"/>`, cw, ch);
  const png = await sharp(resized.data).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return { png, w: cw, h: ch };
}

// ---------------------------------------------------------------------------

interface CoverAsset {
  card: { png: Buffer; w: number; h: number };
  shadow: { png: Buffer; pad: number };
}

interface TileAsset { card: { png: Buffer; w: number; h: number }; shadow: { png: Buffer; pad: number } }

export interface FrameContext {
  board: Storyboard;
  text: Map<string, TextImage>;
  images: Map<string, Uint8Array>;
}

/** Layers are collected per frame and composited once onto the ground. */
type Layer = OverlayOptions;

export class FrameRenderer {
  private covers = new Map<string, CoverAsset>();
  private tiles = new Map<string, TileAsset>();
  private chrome: Frame | null = null;
  private lastFrame: Frame | null = null;
  private readonly coverShots: CoverShot[];

  constructor(private readonly ctx: FrameContext) {
    this.coverShots = ctx.board.shots.filter((s): s is CoverShot => s.kind === 'cover');
  }

  private t(id: string): TextImage | undefined {
    return this.ctx.text.get(id);
  }

  private async textLayer(id: string, cx: number, top: number, alpha = 1, dy = 0): Promise<Layer | null> {
    const img = this.t(id);
    if (!img) return null;
    const png = await faded(id, img.png, alpha);
    if (!png) return null;
    return { input: png, left: Math.round(cx - img.w / 2), top: Math.round(top + dy) };
  }

  private async coverAsset(id: string): Promise<CoverAsset> {
    let asset = this.covers.get(id);
    if (!asset) {
      const image = this.ctx.images.get(id);
      if (!image) throw new Error(`no image for ${id}`);
      // Drawn at the end size of the push-in, and scaled down per frame.
      const c = await card(image, Math.round(BOX.width * 1.03), Math.round(BOX.height * 1.03), CARD_RADIUS, 'inside');
      const s = shadowSvg(c.w, c.h, 2.5);
      asset = { card: c, shadow: { png: await s.png, pad: s.pad } };
      this.covers.set(id, asset);
    }
    return asset;
  }

  private async tileAsset(id: string, layout: GridShot['layout']): Promise<TileAsset> {
    let asset = this.tiles.get(id);
    if (!asset) {
      const image = this.ctx.images.get(id);
      if (!image) throw new Error(`no image for ${id}`);
      const c = await card(image, layout.tileWidth, layout.tileHeight, 6, 'contain');
      const s = shadowSvg(c.w, c.h, 0.8);
      asset = { card: c, shadow: { png: await s.png, pad: s.pad } };
      this.tiles.set(id, asset);
    }
    return asset;
  }

  /** Header row, book title and the timeline's rule: everything that holds still behind the covers. */
  private async chromeFrame(): Promise<Frame> {
    if (this.chrome) return this.chrome;
    const { board } = this.ctx;
    const layers: Layer[] = [];
    const rule = `<rect x="0" y="${HEADER - 2}" width="${W}" height="2" fill="${THEME.line}"/>`;
    let timeline = '';
    if (board.span && board.span.to > board.span.from) {
      timeline = `<rect x="${TIMELINE.left}" y="${TIMELINE.y - 1.5}" width="${TIMELINE.right - TIMELINE.left}" height="3" rx="1.5" fill="${THEME.line}"/>`;
      for (const s of this.coverShots) {
        if (s.year === undefined) continue;
        const x = this.yearX(s.year);
        timeline += `<rect x="${x - 1}" y="${TIMELINE.y - 9}" width="2" height="18" fill="${THEME.line}"/>`;
      }
    }
    layers.push({ input: svg(rule + timeline), left: 0, top: 0 });
    const wm = this.t('wordmark');
    if (wm) layers.push({ input: wm.png, left: 64, top: Math.round((HEADER - wm.h) / 2) });
    const title = this.t('book-title');
    if (title) layers.push({ input: title.png, left: Math.round((W - title.w) / 2), top: 176 });
    const author = this.t('book-author');
    if (author && title) layers.push({ input: author.png, left: Math.round((W - author.w) / 2), top: 176 + title.h + 6 });
    if (board.span && board.span.to > board.span.from) {
      const from = this.t('span-from');
      const to = this.t('span-to');
      if (from) layers.push({ input: from.png, left: TIMELINE.left - from.w - 22, top: TIMELINE.y - Math.round(from.h / 2) });
      if (to) layers.push({ input: to.png, left: TIMELINE.right + 22, top: TIMELINE.y - Math.round(to.h / 2) });
    }
    this.chrome = await ground(layers);
    return this.chrome;
  }

  private yearX(year: number): number {
    const span = this.ctx.board.span!;
    return lerp(TIMELINE.left, TIMELINE.right, (year - span.from) / Math.max(1, span.to - span.from));
  }

  private dot: Buffer | null = null;

  private async dotLayer(x: number): Promise<Layer> {
    this.dot ??= await sharp(svg(`<circle cx="12" cy="12" r="11" fill="${THEME.accent}"/>`, 24, 24)).png().toBuffer();
    return { input: this.dot, left: Math.round(x - 12), top: TIMELINE.y - 12 };
  }

  /** The card of a cover at a given scale and horizontal offset, with its shadow. */
  private async cardLayers(id: string, scale: number, dx: number, alpha: number): Promise<Layer[]> {
    const asset = await this.coverAsset(id);
    const k = scale / 1.03;
    const w = Math.round(asset.card.w * k);
    const h = Math.round(asset.card.h * k);
    const left = Math.round(W / 2 - w / 2 + dx);
    const top = Math.round(BOX.centreY - h / 2);
    const scaled = k >= 0.999
      ? asset.card.png
      : await sharp(asset.card.png).resize({ width: w, height: h }).png({ compressionLevel: 0 }).toBuffer();
    const out: Layer[] = [];
    const shadow = await faded(`shadow-${id}`, asset.shadow.png, alpha);
    const body = alpha >= 0.999 ? scaled : await faded(`card-${id}-${w}`, scaled, alpha);
    const sLeft = Math.round(W / 2 - asset.card.w / 2 + dx) - asset.shadow.pad;
    const sTop = Math.round(BOX.centreY - asset.card.h / 2) - asset.shadow.pad;
    if (shadow) out.push(...await clip(shadow, sLeft, sTop, asset.card.w + 2 * asset.shadow.pad, asset.card.h + 2 * asset.shadow.pad));
    if (body) out.push(...await clip(body, left, top, w, h));
    return out;
  }

  private async captionLayers(shot: CoverShot, alpha: number, dy: number): Promise<Layer[]> {
    const out: Layer[] = [];
    const year = this.t(`year-${shot.index}`);
    const pub = this.t(`pub-${shot.index}`);
    const top = BOX.centreY + BOX.height / 2 + 64;
    const a = await this.textLayer(`year-${shot.index}`, W / 2, top, alpha, dy);
    if (a) out.push(a);
    const b = await this.textLayer(`pub-${shot.index}`, W / 2, top + (year ? year.h + 4 : 0), alpha, dy);
    if (b && pub) out.push(b);
    return out;
  }

  private async countLayer(shot: CoverShot, alpha = 1): Promise<Layer | null> {
    const img = this.t(`count-${shot.index}`);
    if (!img) return null;
    const png = await faded(`count-${shot.index}`, img.png, alpha);
    return png ? { input: png, left: W - 64 - img.w, top: Math.round((HEADER - img.h) / 2) } : null;
  }

  private async compose(base: Frame, layers: Layer[]): Promise<Frame> {
    if (layers.length === 0) return base;
    return sharp(base, RAW).composite(layers.filter(Boolean)).removeAlpha().raw().toBuffer();
  }

  /** Every frame of the board, in order. */
  async *frames(): AsyncGenerator<Frame> {
    const shots = this.ctx.board.shots;
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const prev = shots[i - 1];
      for (let f = 0; f < shot.frames; f++) {
        let frame = await this.frame(shot, prev, f);
        // Between shots of different kinds (title → first cover, wall → end), a crossfade.
        const fade = shot.kind === 'cover' && prev?.kind === 'title' ? shot.transition + 4 : shot.kind === 'end' ? 12 : 0;
        if (fade > 0 && f < fade && this.lastFrame) {
          frame = blend(this.lastFrame, frame, easeInOut((f + 1) / (fade + 1)));
        }
        if (f === shot.frames - 1) this.lastFrame = frame;
        yield frame;
      }
    }
  }

  private frame(shot: Shot, prev: Shot | undefined, f: number): Promise<Frame> {
    switch (shot.kind) {
      case 'title': return this.titleFrame(shot, f);
      case 'cover': return this.coverFrame(shot, prev, f);
      case 'grid': return this.gridFrame(shot, f);
      case 'end': return this.endFrame(shot, f);
    }
  }

  private async titleFrame(shot: TitleShot, f: number): Promise<Frame> {
    const layers: (Layer | null)[] = [];
    const rise = (start: number) => ({ a: easeOut((f - start) / 10), dy: 24 * (1 - easeOut((f - start) / 10)) });
    const kicker = this.t('title-kicker');
    const title = this.t('title-title');
    const author = this.t('title-author');
    const span = this.t('title-span');
    const block = (kicker?.h ?? 0) + 36 + (title?.h ?? 0) + 60 + 3 + 60 + (author?.h ?? 0) + 10 + (span?.h ?? 0);
    let y = Math.round(H / 2 - block / 2);
    const header = [
      { input: svg(`<rect x="0" y="${HEADER - 2}" width="${W}" height="2" fill="${THEME.line}"/>`), left: 0, top: 0 },
    ] as Layer[];
    const wm = this.t('wordmark');
    if (wm) header.push({ input: wm.png, left: 64, top: Math.round((HEADER - wm.h) / 2) });
    let r = rise(0);
    layers.push(await this.textLayer('title-kicker', W / 2, y, r.a, r.dy));
    y += (kicker?.h ?? 0) + 36;
    r = rise(4);
    layers.push(await this.textLayer('title-title', W / 2, y, r.a, r.dy));
    y += (title?.h ?? 0) + 60;
    const ruleW = 140 * easeInOut((f - 10) / 12);
    if (ruleW > 1) layers.push(await this.ruleLayer(ruleW, y, THEME.accent));
    y += 3 + 60;
    r = rise(14);
    layers.push(await this.textLayer('title-author', W / 2, y, r.a, r.dy));
    y += (author?.h ?? 0) + 10;
    r = rise(17);
    layers.push(await this.textLayer('title-span', W / 2, y, r.a, r.dy));
    this.titleGround ??= await ground(header);
    return this.compose(this.titleGround, layers.filter((l): l is Layer => !!l));
  }

  private titleGround: Frame | null = null;
  private endGround: Frame | null = null;

  private async ruleLayer(width: number, y: number, colour: string): Promise<Layer> {
    const w = Math.max(1, Math.round(width));
    const input = await sharp({ create: { width: w, height: 3, channels: 4, background: colour } }).png().toBuffer();
    return { input, left: Math.round(W / 2 - w / 2), top: Math.round(y) };
  }

  private async coverFrame(shot: CoverShot, prev: Shot | undefined, f: number): Promise<Frame> {
    const layers: Layer[] = [];
    const pushing = prev?.kind === 'cover';
    const t = easeInOut(f / Math.max(1, shot.transition));
    const settled = f >= shot.transition;
    // The slow push-in runs over the whole shot, 1.00 → 1.03.
    const zoom = 1 + 0.03 * (f / Math.max(1, shot.frames - 1));
    if (pushing && !settled) {
      const p = prev as CoverShot;
      layers.push(...await this.cardLayers(p.coverId, 1.03, -t * PUSH, 1));
      layers.push(...await this.cardLayers(shot.coverId, zoom, (1 - t) * PUSH, 1));
      layers.push(...await this.captionLayers(p, 1 - clamp(t * 2), 0));
    } else {
      layers.push(...await this.cardLayers(shot.coverId, zoom, 0, 1));
    }
    // The caption rises in once the card has mostly landed.
    const capStart = pushing ? shot.transition * 0.6 : 0;
    const capLen = Math.max(2, Math.min(8, Math.round(shot.frames * 0.3)));
    const capT = easeOut((f - capStart) / capLen);
    layers.push(...await this.captionLayers(shot, capT, 16 * (1 - capT)));
    const count = await this.countLayer(pushing && t < 0.5 ? (prev as CoverShot) : shot);
    if (count) layers.push(count);
    const span = this.ctx.board.span;
    if (span && span.to > span.from) {
      const fromYear = pushing ? ((prev as CoverShot).year ?? shot.year) : shot.year;
      const year = fromYear === undefined || shot.year === undefined ? (shot.year ?? fromYear) : lerp(fromYear, shot.year, t);
      if (year !== undefined) layers.push(await this.dotLayer(this.yearX(year)));
    }
    return this.compose(await this.chromeFrame(), layers);
  }

  private async gridFrame(shot: GridShot, f: number): Promise<Frame> {
    const layers: Layer[] = [];
    const { layout } = shot;
    const last = this.coverShots[this.coverShots.length - 1];
    const kicker = await this.textLayer('grid-kicker', W / 2, 330, easeOut(f / 10), 0);
    if (kicker) layers.push(kicker);
    // The last cover's caption and counter leave as its card flies home.
    if (f < 8) {
      layers.push(...await this.captionLayers(last, 1 - f / 8, 0));
      const count = await this.countLayer(last, 1 - f / 8);
      if (count) layers.push(count);
    }
    const n = shot.coverIds.length;
    const flyFrames = Math.min(14, Math.max(4, Math.round(shot.frames * 0.2)));
    for (let i = 0; i < n; i++) {
      const id = shot.coverIds[i];
      const col = i % layout.cols;
      const row = Math.floor(i / layout.cols);
      const x = layout.left + col * (layout.tileWidth + layout.gap);
      const y = layout.top + row * (layout.tileHeight + layout.gap);
      if (i === n - 1) {
        const t = easeInOut(f / flyFrames);
        if (t < 1) {
          // Fly: from the big card's place and size to the tile's.
          const asset = await this.coverAsset(id);
          const bigW = asset.card.w / 1.03 * 1.03;
          const bigH = asset.card.h / 1.03 * 1.03;
          const tile = await this.tileAsset(id, layout);
          const w = Math.max(8, Math.round(lerp(bigW, tile.card.w, t)));
          const h = Math.max(8, Math.round(lerp(bigH, tile.card.h, t)));
          const cx = lerp(W / 2, x + layout.tileWidth / 2, t);
          const cy = lerp(BOX.centreY, y + layout.tileHeight / 2, t);
          const png = await sharp(asset.card.png).resize({ width: w, height: h, fit: 'fill' }).png({ compressionLevel: 0 }).toBuffer();
          layers.push(...await clip(png, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h));
          continue;
        }
      } else {
        const start = i * shot.stagger;
        const a = easeOut((f - start) / shot.tileFrames);
        if (a <= 0) continue;
        const tile = await this.tileAsset(id, layout);
        const dy = Math.round(18 * (1 - a));
        const ox = x + Math.round((layout.tileWidth - tile.card.w) / 2);
        const oy = y + Math.round((layout.tileHeight - tile.card.h) / 2) + dy;
        const sh = await faded(`tshadow-${id}`, tile.shadow.png, a);
        const body = await faded(`tile-${id}`, tile.card.png, a);
        if (sh) layers.push(...await clip(sh, ox - tile.shadow.pad, oy - tile.shadow.pad, tile.card.w + 2 * tile.shadow.pad, tile.card.h + 2 * tile.shadow.pad));
        if (body) layers.push({ input: body, left: ox, top: oy });
        continue;
      }
      const tile = await this.tileAsset(id, layout);
      const ox = x + Math.round((layout.tileWidth - tile.card.w) / 2);
      const oy = y + Math.round((layout.tileHeight - tile.card.h) / 2);
      layers.push(...await clip(tile.shadow.png, ox - tile.shadow.pad, oy - tile.shadow.pad, tile.card.w + 2 * tile.shadow.pad, tile.card.h + 2 * tile.shadow.pad));
      layers.push({ input: tile.card.png, left: ox, top: oy });
    }
    if (this.ctx.board.span && this.ctx.board.span.to > this.ctx.board.span.from) layers.push(await this.dotLayer(TIMELINE.right));
    return this.compose(await this.chromeFrame(), layers);
  }

  private async endFrame(shot: EndShot, f: number): Promise<Frame> {
    void shot;
    const layers: (Layer | null)[] = [];
    const wm = this.t('end-wordmark');
    const tag = this.t('end-tagline');
    const url = this.t('end-url');
    const credit = this.t('end-credit');
    const block = (wm?.h ?? 0) + 12 + (tag?.h ?? 0) + 70 + 3 + 70 + (url?.h ?? 0);
    let y = Math.round(H / 2 - block / 2 - 40);
    const rise = (start: number) => ({ a: easeOut((f - start) / 12), dy: 20 * (1 - easeOut((f - start) / 12)) });
    let r = rise(2);
    layers.push(await this.textLayer('end-wordmark', W / 2, y, r.a, r.dy));
    y += (wm?.h ?? 0) + 12;
    r = rise(6);
    layers.push(await this.textLayer('end-tagline', W / 2, y, r.a, r.dy));
    y += (tag?.h ?? 0) + 70;
    const ruleW = 140 * easeInOut((f - 8) / 12);
    if (ruleW > 1) layers.push(await this.ruleLayer(ruleW, y, THEME.line));
    y += 3 + 70;
    r = rise(12);
    layers.push(await this.textLayer('end-url', W / 2, y, r.a, r.dy));
    r = rise(16);
    if (credit) layers.push(await this.textLayer('end-credit', W / 2, TIMELINE.y - credit.h / 2, r.a, 0));
    this.endGround ??= await ground();
    return this.compose(this.endGround, layers.filter((l): l is Layer => !!l));
  }
}

/**
 * A layer cropped to the frame. sharp refuses an overlay that reaches past
 * the base image, and a card pushed half off the edge does exactly that.
 */
async function clip(png: Buffer, left: number, top: number, w: number, h: number): Promise<Layer[]> {
  if (left >= 0 && top >= 0 && left + w <= W && top + h <= H) return [{ input: png, left, top }];
  const x0 = Math.max(0, -left);
  const y0 = Math.max(0, -top);
  const x1 = Math.min(w, W - left);
  const y1 = Math.min(h, H - top);
  if (x1 - x0 < 1 || y1 - y0 < 1) return [];
  const input = await sharp(png).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).png({ compressionLevel: 0 }).toBuffer();
  return [{ input, left: left + x0, top: top + y0 }];
}
