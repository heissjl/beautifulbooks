/**
 * The four loading animations, and the ticker that runs them
 * (lab/loading/README.md, ROADMAP 6.19a).
 *
 * Plain JavaScript, because the lab pages have no bundler; the site would
 * import the same logic as TypeScript. Kept in one file so that `index.html`
 * (all four side by side) and `rotation.html` (3b, as it would appear) run
 * the **same** 3b and cannot drift apart.
 *
 * Everything they need is a `scene`: the manifest's grid, the chosen image,
 * the decoded bitmap, how wide the frame is and how long the animation should
 * take. No animation fetches anything or sorts anything — the orders are
 * worked out offline (`orders.ts`) and shipped in the manifest.
 */

/** A Uint16Array as the manifest carries it. */
export function unpack16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Uint16Array(bytes.buffer);
}

/**
 * How much smaller than the screen wants the file may be.
 *
 * A photograph would show a 25 % upscale; a wall of cover thumbnails does
 * not, because there is no line in it that has to stay straight. Without
 * this tolerance a 260 px frame at two device pixels asks for 520 and gets
 * the 640 px file — 60 % more bytes for pixels nobody can point at.
 */
const UPSCALE_ALLOWED = 0.8;

/**
 * Which of the built sizes to fetch for a frame this wide.
 *
 * The smallest file that is within the tolerance of what the screen wants,
 * at a device ratio capped at 2 — a mosaic is a picture made of noise, and
 * the third device pixel buys nothing anybody can see while costing half
 * again as many bytes.
 */
export function pickImage(grid, frameWidth, dpr = window.devicePixelRatio || 1) {
  const wanted = frameWidth * Math.min(2, dpr) * UPSCALE_ALLOWED;
  const sorted = [...grid.images].sort((a, b) => a.width - b.width);
  return sorted.find(image => image.width >= wanted) ?? sorted[sorted.length - 1];
}

/** One ticker for every animation on the page — the way the site would run it. */
export const ticker = {
  running: new Set(),
  raf: 0,
  last: 0,
  add(anim) {
    this.running.add(anim);
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.tick(t)); }
  },
  remove(anim) { this.running.delete(anim); },
  tick(now) {
    const delta = now - this.last;
    this.last = now;
    for (const anim of [...this.running]) anim.tick(now, delta);
    this.raf = this.running.size > 0 ? requestAnimationFrame(t => this.tick(t)) : 0;
  },
};

/** Frame intervals and draw calls, so a proposal can be argued about in numbers. */
export class Cost {
  constructor(el) { this.el = el; this.reset(); }
  reset() { this.frames = 0; this.worst = 0; this.total = 0; this.late = 0; this.draws = 0; }
  frame(delta, draws) {
    // The first interval after a start is the gap since the last animation,
    // not a frame time.
    if (this.frames > 0) {
      this.total += delta;
      if (delta > this.worst) this.worst = delta;
      if (delta > 20) this.late++;
    }
    this.frames++;
    this.draws += draws;
  }
  render(scene, extra = '') {
    if (!this.el) return;
    const mean = this.frames > 1 ? this.total / (this.frames - 1) : 0;
    this.el.textContent =
      `${Math.round(scene.bytes / 1024)} KB Bild, ${Math.round(scene.decodeMs)} ms dekodiert\n`
      + `${this.frames} Bilder, im Mittel ${mean.toFixed(1)} ms, schlechtestes ${this.worst.toFixed(1)} ms, ${this.late} über 20 ms\n`
      + `${this.frames ? (this.draws / this.frames).toFixed(1) : 0} drawImage je Bild${extra ? `\n${extra}` : ''}`;
  }
}

/** Vorschlag 1: the pull-back. One <img>, one transform, no work per frame. */
export class ZoomOut {
  constructor(img, frame, costEl) { this.img = img; this.frame = frame; this.cost = new Cost(costEl); }
  configure(scene) {
    this.scene = scene;
    this.img.src = scene.imageUrl;
    this.frame.style.width = `${scene.frameWidth}px`;
    this.frame.style.height = `${Math.round(scene.frameWidth * scene.image.height / scene.image.width)}px`;
  }
  start() {
    const scene = this.scene;
    // Start close enough to read a cover, not so close that the JPEG shows:
    // at most twice the pixels the file actually has.
    const maxScale = Math.max(2, (scene.image.width / scene.frameWidth) * 2);
    this.img.style.transformOrigin = '52% 30%';
    /*
      Scale falls geometrically, not linearly: halving the zoom looks the same
      whether it goes 8 to 4 or 2 to 1, so a linear tween spends three
      quarters of its time in the last, least interesting doubling.
    */
    const steps = 20;
    const frames = Array.from({ length: steps + 1 }, (_, i) => ({
      offset: i / steps,
      transform: `scale(${(maxScale ** (1 - i / steps)).toFixed(3)})`,
    }));
    this.animation?.cancel();
    this.animation = this.img.animate(frames, { duration: scene.duration, easing: 'linear', fill: 'forwards' });
    this.cost.reset();
    this.cost.render(scene, 'läuft auf dem Compositor, keine Arbeit je Bild');
  }
  stop() { this.animation?.pause(); this.cost.render(this.scene, 'eingefroren, wo die Suche fertig wurde'); }
  finish() {
    this.animation?.cancel();
    this.img.style.transform = 'scale(1)';
    this.cost.render(this.scene, 'reduced motion: das fertige Bild, keine Bewegung');
  }
  renderAt(progress) {
    this.start();
    this.animation.currentTime = progress * this.scene.duration;
    this.animation.pause();
    this.cost.render(this.scene, `stehend bei ${Math.round(progress * 100)} %`);
  }
  tick() {}
}

/** Shared canvas work: a cell of the sprite drawn into a cell of the frame. */
class TileCanvas {
  constructor(canvas, frame, costEl) { this.canvas = canvas; this.frame = frame; this.cost = new Cost(costEl); }
  configure(scene) { this.scene = scene; this.layout(); }
  layout() {
    const scene = this.scene;
    const w = scene.frameWidth;
    const h = Math.round(w * scene.image.height / scene.image.width);
    // A loading screen is not a photograph: two device pixels are plenty and
    // four would double the fill cost for nothing.
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.frame.style.width = `${w}px`;
    this.frame.style.height = `${h}px`;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.dw = this.canvas.width / scene.grid.cols;
    this.dh = this.canvas.height / scene.grid.rows;
    this.cells = scene.grid.cols * scene.grid.rows;
    this.ground = getComputedStyle(document.body).getPropertyValue('--surface-2') || '#eee';
    this.surface = getComputedStyle(document.body).getPropertyValue('--surface') || '#fff';
  }
  clear() {
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = this.ground;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  /** Draws cell `from` of the sprite at the place of cell `at`. */
  draw(at, from = at, alpha = 1, ctx = this.ctx) {
    const { cols } = this.scene.grid;
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
  drawAll() {
    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(this.scene.bitmap, 0, 0, this.canvas.width, this.canvas.height);
  }
  stop() {
    ticker.remove(this);
    this.cost.render(this.scene, `abgebrochen bei ${Math.round(100 * this.placed / this.cells)} % der Kacheln`);
  }
  finish() {
    this.layout();
    this.drawAll();
    this.cost.render(this.scene, 'reduced motion: das fertige Bild, keine Bewegung');
  }
  /**
   * The animation held still at one moment.
   *
   * Simulated at 60 frames a second rather than played, so the picture at
   * 30 % is the same picture every time — which is what makes two proposals
   * comparable, and what lets a screenshot mean something. It is also the
   * only way to see them at all in a hidden browser pane, which runs no
   * animation frames (2026-09-09).
   */
  renderAt(progress) {
    this.start();
    ticker.remove(this);
    const frames = Math.max(1, Math.round((progress * this.scene.duration) / 16.7));
    for (let i = 1; i <= frames; i++) this.tick(this.t0 + i * 16.7, 16.7);
    this.cost.render(this.scene, `stehend bei ${Math.round(progress * 100)} %`);
  }
}

/** How many frames a single tile takes to fade in. */
const FADE_FRAMES = 9;
/** How long the flash lasts where a tile lands, in frames. */
const FLASH_FRAMES = 8;
/** A tile settles more slowly when the point is clearing, not sweeping. */
const CLEAR_FADE_FRAMES = 20;
/** How far the wall is dimmed at the start, as a fraction of the ground colour. */
const CLEAR_DIM = 0.5;

/**
 * Vorschlag 2: the assignment's own order. Cells arrive furthest-from-average
 * first, each fading over nine frames; the picture is a shadow long before it
 * is a wall.
 */
export class Reveal extends TileCanvas {
  start() {
    this.layout();
    this.clear();
    this.order = this.scene.orders.extreme;
    this.placed = 0;
    this.active = [];
    this.t0 = performance.now();
    this.cost.reset();
    ticker.add(this);
  }
  tick(now, delta) {
    const progress = Math.min(1, (now - this.t0) / this.scene.duration);
    const target = Math.round(progress * this.cells);
    while (this.placed < target) this.active.push({ cell: this.order[this.placed++], age: 0 });
    let draws = 0;
    for (const tile of this.active) {
      tile.age++;
      // The last draw is opaque, so a tile ends exactly right rather than at
      // 95 % of itself.
      this.draw(tile.cell, tile.cell, tile.age >= FADE_FRAMES ? 1 : 1 / FADE_FRAMES);
      draws++;
    }
    this.active = this.active.filter(t => t.age < FADE_FRAMES);
    this.cost.frame(delta, draws);
    if (this.cost.frames % 10 === 0) this.cost.render(this.scene);
    if (progress >= 1 && this.active.length === 0) { ticker.remove(this); this.cost.render(this.scene, 'fertig'); }
  }
}

/**
 * Vorschlag 3: the wall sorts itself out, in a diagonal wave with a flash
 * where each tile lands.
 */
export class Sort extends TileCanvas {
  start() {
    this.layout();
    this.ctx.globalAlpha = 1;
    // The wrong wall, in one frame: every cell shows another cell's cover.
    for (let i = 0; i < this.cells; i++) this.draw(i, this.scene.shuffle[i]);
    /*
      And then dimmed, in one more. Measured 2026-09-09: without this the
      animation is invisible — a wall of covers in the wrong order and the
      same wall in the right order look alike until enough of the picture is
      right. Dimming what is not yet sorted gives the sweep a front line.
    */
    this.ctx.globalAlpha = CLEAR_DIM + 0.05;
    this.ctx.fillStyle = this.surface;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.order = this.scene.orders.wave;
    this.placed = 0;
    this.active = [];
    this.flashes = [];
    this.t0 = performance.now();
    this.cost.reset();
    ticker.add(this);
  }
  tick(now, delta) {
    const progress = Math.min(1, (now - this.t0) / this.scene.duration);
    const target = Math.round(progress * this.cells);
    while (this.placed < target) this.active.push({ cell: this.order[this.placed++], age: 0 });
    let draws = 0;
    for (const tile of this.active) {
      tile.age++;
      this.draw(tile.cell, tile.cell, tile.age >= FADE_FRAMES ? 1 : 1 / FADE_FRAMES);
      draws++;
      if (tile.age === FADE_FRAMES) this.flashes.push({ cell: tile.cell, age: 0 });
    }
    this.active = this.active.filter(t => t.age < FADE_FRAMES);
    for (const flash of this.flashes) {
      flash.age++;
      const alpha = 0.3 * (1 - flash.age / FLASH_FRAMES);
      if (alpha <= 0) continue;
      this.draw(flash.cell, flash.cell, 1);
      const dc = flash.cell % this.scene.grid.cols, dr = (flash.cell - dc) / this.scene.grid.cols;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(Math.floor(dc * this.dw), Math.floor(dr * this.dh), Math.ceil(this.dw) + 1, Math.ceil(this.dh) + 1);
      draws++;
    }
    this.flashes = this.flashes.filter(f => f.age < FLASH_FRAMES);
    this.cost.frame(delta, draws);
    if (this.cost.frames % 10 === 0) this.cost.render(this.scene);
    if (progress >= 1 && this.active.length === 0 && this.flashes.length === 0) {
      ticker.remove(this);
      this.cost.render(this.scene, 'fertig');
    }
  }
}

/**
 * Vorschlag 3b, the one that was chosen (Julian, 2026-09-09: „3b ist perfekt
 * so"): the noise clears.
 *
 * The same scrambled wall as proposal 3, but the cells find their place in
 * random order, so nothing travels across the picture and there is no front
 * to see. The dimming lifts as the wait goes on, which is the second half of
 * the clearing.
 *
 * An off-screen canvas holds the true state of the wall and the visible one
 * is that plus the dimming — otherwise lifting the dim would mean redrawing
 * every cell each frame instead of one image.
 */
export class Clearing extends TileCanvas {
  layout() {
    super.layout();
    this.buffer = this.buffer ?? document.createElement('canvas');
    this.buffer.width = this.canvas.width;
    this.buffer.height = this.canvas.height;
    this.bctx = this.buffer.getContext('2d', { alpha: false });
  }
  start() {
    this.layout();
    for (let i = 0; i < this.cells; i++) this.draw(i, this.scene.shuffle[i], 1, this.bctx);
    this.order = this.scene.orders.random;
    this.placed = 0;
    this.active = [];
    this.t0 = performance.now();
    this.cost.reset();
    this.present(0);
    ticker.add(this);
  }
  /** The wall as it stands, under what is left of the dimming. */
  present(progress) {
    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(this.buffer, 0, 0);
    const dim = CLEAR_DIM * (1 - progress);
    if (dim <= 0) return;
    this.ctx.globalAlpha = dim;
    this.ctx.fillStyle = this.surface;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  tick(now, delta) {
    const progress = Math.min(1, (now - this.t0) / this.scene.duration);
    /*
      Cells resolve fastest at the beginning.

      Measured on the contact sheet: with a flat rate the first third of the
      animation looks identical to the frame before it — and the first
      seconds are exactly where a reader is, because most searches come back
      in one or two. Easing out puts the visible clearing there and leaves
      the rest as a settling.
    */
    const eased = 1 - (1 - progress) ** 2;
    const target = Math.round(eased * this.cells);
    while (this.placed < target) this.active.push({ cell: this.order[this.placed++], age: 0 });
    let draws = 0;
    for (const tile of this.active) {
      tile.age++;
      this.draw(tile.cell, tile.cell, tile.age >= CLEAR_FADE_FRAMES ? 1 : 1 / CLEAR_FADE_FRAMES, this.bctx);
      draws++;
    }
    this.active = this.active.filter(t => t.age < CLEAR_FADE_FRAMES);
    this.present(eased);
    this.cost.frame(delta, draws + 1);
    if (this.cost.frames % 10 === 0) this.cost.render(this.scene);
    if (progress >= 1 && this.active.length === 0) { ticker.remove(this); this.cost.render(this.scene, 'fertig'); }
  }
}

/**
 * Everything an animation needs for one template at one size.
 *
 * The one place a picture is fetched: one request, one decode, and the byte
 * count and decode time come back with it, because those are the two numbers
 * the whole experiment is judged on.
 */
export async function loadScene(manifest, { gridIndex = 0, frameWidth, duration, image }) {
  const grid = manifest.grids[gridIndex];
  const chosen = image ?? pickImage(grid, frameWidth);
  const url = `out/${chosen.file}`;
  const started = performance.now();
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  return {
    manifest, grid, image: chosen, imageUrl: url, bitmap,
    bytes: blob.size, decodeMs: performance.now() - started,
    frameWidth, duration,
    orders: Object.fromEntries(Object.entries(grid.orders).map(([k, v]) => [k, unpack16(v)])),
    shuffle: unpack16(grid.shuffle),
  };
}
