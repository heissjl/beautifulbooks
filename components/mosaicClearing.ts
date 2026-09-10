/**
 * The loading animation: a wall of covers in the wrong order that clears into
 * a face (ROADMAP 6.19a, proposal 3b — chosen by Julian on 2026-09-09).
 *
 * The cells find their place in **random** order, so nothing travels across
 * the picture and there is no front to see; the dimming lifts as the wait
 * goes on. Because a search comes back after one or two seconds far more
 * often than after ten, what matters is not how the animation ends but what
 * it looks like when it is cut — and this one shows a full frame at every
 * moment and leaves nothing visibly half-done behind.
 *
 * Everything is drawn from **one** JPEG. No cover is ever loaded on its own.
 */
import type { MosaicImage, MosaicManifest } from '@/lib/loading';

/** A tile settles more slowly when the point is clearing, not sweeping. */
const FADE_FRAMES = 20;
/** How far the wall is dimmed at the start, as a fraction of the ground colour. */
const DIM = 0.5;
/** Two device pixels are plenty for a picture made of noise; four cost double. */
const MAX_DPR = 2;

export interface MosaicScene {
  manifest: MosaicManifest;
  image: MosaicImage;
  bitmap: ImageBitmap;
  /** Cell indices in the order they resolve. */
  order: Uint16Array;
  /** Which cell's cover each cell shows before it resolves. */
  shuffle: Uint16Array;
  /** How wide the picture is shown, which decided which file was fetched. */
  frameWidth: number;
}

export class Clearing {
  private ctx: CanvasRenderingContext2D;
  private buffer: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private dw: number;
  private dh: number;
  private cells: number;
  private surface: string;
  private t0 = 0;
  private placed = 0;
  private active: { cell: number; age: number }[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private scene: MosaicScene,
    private duration: number,
  ) {
    const { cols, rows } = scene.manifest;
    const dpr = Math.min(MAX_DPR, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
    const cssWidth = canvas.clientWidth || scene.image.width;
    const cssHeight = Math.round((cssWidth * scene.image.height) / scene.image.width);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.buffer = document.createElement('canvas');
    this.buffer.width = canvas.width;
    this.buffer.height = canvas.height;
    this.bctx = this.buffer.getContext('2d', { alpha: false })!;
    this.dw = canvas.width / cols;
    this.dh = canvas.height / rows;
    this.cells = cols * rows;
    // Read once: asking for a computed style every frame forces a recalc.
    this.surface = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#fff';
  }

  /** Draws cell `from` of the sprite at the place of cell `at`. */
  private draw(at: number, from: number, alpha: number, ctx: CanvasRenderingContext2D) {
    const { cols } = this.scene.manifest;
    const { cellWidth, cellHeight } = this.scene.image;
    const sc = from % cols, sr = (from - sc) / cols;
    const dc = at % cols, dr = (at - dc) / cols;
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      this.scene.bitmap,
      sc * cellWidth, sr * cellHeight, cellWidth, cellHeight,
      Math.floor(dc * this.dw), Math.floor(dr * this.dh),
      Math.ceil(this.dw) + 1, Math.ceil(this.dh) + 1,
    );
  }

  /** The wall as it stands, under what is left of the dimming. */
  private present(progress: number) {
    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(this.buffer, 0, 0);
    const dim = DIM * (1 - progress);
    if (dim <= 0) return;
    this.ctx.globalAlpha = dim;
    this.ctx.fillStyle = this.surface;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * The scrambled wall, dimmed: what stands there before anything moves.
   *
   * Separate from `begin` because the two want different moments. This has to
   * happen **at once**, or the frame is empty for as long as it takes to draw
   * 1,440 tiles; the clock has to start on the **first animation frame**, or
   * that drawing and the page's layout are counted as animation that nobody
   * saw. On a phone with a search in flight the gap between them is a few
   * hundred milliseconds, and a long enough one would leave nothing but the
   * finished picture.
   */
  paint() {
    for (let i = 0; i < this.cells; i++) this.draw(i, this.scene.shuffle[i], 1, this.bctx);
    this.placed = 0;
    this.active = [];
    this.present(0);
  }

  /** Starts the clock. */
  begin(now: number) {
    this.t0 = now;
  }

  /** One frame. Returns whether there is anything left to do. */
  tick(now: number): boolean {
    const progress = Math.min(1, (now - this.t0) / this.duration);
    /*
      Cells resolve fastest at the beginning. Measured on the contact sheet:
      at a flat rate the first third of the animation looks identical to the
      frame before it — and the first seconds are exactly where a reader is,
      because most searches come back in one or two.
    */
    const eased = 1 - (1 - progress) ** 2;
    const target = Math.round(eased * this.cells);
    while (this.placed < target) this.active.push({ cell: this.scene.order[this.placed++], age: 0 });
    for (const tile of this.active) {
      tile.age++;
      // The last draw is opaque, so a tile ends exactly right rather than at
      // 95 % of itself.
      this.draw(tile.cell, tile.cell, tile.age >= FADE_FRAMES ? 1 : 1 / FADE_FRAMES, this.bctx);
    }
    this.active = this.active.filter(t => t.age < FADE_FRAMES);
    this.present(eased);
    return progress < 1 || this.active.length > 0;
  }

  /** The finished picture, at once: what `prefers-reduced-motion` gets. */
  finish() {
    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(this.scene.bitmap, 0, 0, this.canvas.width, this.canvas.height);
  }
}
