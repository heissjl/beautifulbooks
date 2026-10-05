/**
 * The page (ROADMAP 5.16): photo in, the same shelf sorted by colour out.
 * Bundled into index.html by build.ts; everything runs in the browser and
 * the photo is never sent anywhere.
 */
import { spineColor, type SpineColor } from './color';
import { findRowCuts, findSpineCuts, rowsFromCuts, spinesFromCuts, toLabImage, type Band, type Box, type LabImage } from './spines';
import { DEFAULTS, layout, sortBooks, unmoved, type Book, type Mode, type SortOptions } from './sort';
import { syntheticShelf } from './synthetic';

/** Long edge after scaling; enough for spines, quick to scan. */
const MAX_EDGE = 1400;

interface Spine { box: Box; color: SpineColor; excluded: boolean }
interface Row { band: Band; cuts: number[]; spines: Spine[] }
type Tool = 'line' | 'exclude' | 'row';

const state: {
  width: number; height: number;
  rgba: Uint8ClampedArray | null;
  lab: LabImage | null;
  source: HTMLCanvasElement | null;
  rowCuts: number[];
  rows: Row[];
  tool: Tool;
  options: SortOptions;
} = { width: 0, height: 0, rgba: null, lab: null, source: null, rowCuts: [], rows: [], tool: 'line', options: { ...DEFAULTS } };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function status(text: string) { $('status').textContent = text; }

function readSpines(row: Row) {
  const old = row.spines;
  row.spines = spinesFromCuts(row.cuts, row.band, state.width).map(box => ({
    box,
    color: spineColor(state.rgba!, state.width, box),
    // keep an exclusion when the box itself did not move
    excluded: old.some(s => s.excluded && s.box.x0 === box.x0 && s.box.x1 === box.x1),
  }));
}

function buildRows(detectCuts: boolean, keep?: Row[]) {
  const bands = rowsFromCuts(state.rowCuts, state.height);
  state.rows = bands.map(band => {
    const same = keep?.find(r => r.band.y0 === band.y0 && r.band.y1 === band.y1);
    const row: Row = { band, cuts: same && !detectCuts ? same.cuts : findSpineCuts(state.lab!, band), spines: same?.spines ?? [] };
    readSpines(row);
    return row;
  });
}

function analyse(canvas: HTMLCanvasElement) {
  const started = performance.now();
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  state.source = canvas;
  state.width = canvas.width; state.height = canvas.height;
  state.rgba = data;
  state.lab = toLabImage(data, canvas.width, canvas.height);
  state.rowCuts = findRowCuts(state.lab);
  buildRows(true);
  const n = state.rows.reduce((s, r) => s + r.spines.length, 0);
  status(`${state.rows.length} Reihe(n), ${n} Bücher erkannt in ${Math.round(performance.now() - started)} ms — Linien antippen, um zu korrigieren.`);
  $('work').hidden = false;
  render();
}

async function loadFile(file: File) {
  status('Foto wird gelesen …');
  const bitmap = await createImageBitmap(file); // honours the EXIF rotation
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  analyse(canvas);
}

function loadSample() {
  const shelf = syntheticShelf(900, 620, 2, Math.floor(Math.random() * 1000));
  const canvas = document.createElement('canvas');
  canvas.width = shelf.width; canvas.height = shelf.height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(shelf.width, shelf.height);
  image.data.set(shelf.rgba);
  ctx.putImageData(image, 0, 0);
  analyse(canvas);
}

function books(): Book[] {
  const out: Book[] = [];
  state.rows.forEach((row, r) => {
    let pos = 0;
    row.spines.forEach((s, i) => {
      if (s.excluded) return;
      out.push({ id: r * 1000 + i, row: r, pos: pos++, width: s.box.x1 - s.box.x0, lch: s.color.lch });
    });
  });
  return out;
}

function spineOf(book: Book): Spine {
  return state.rows[Math.floor(book.id / 1000)].spines[book.id % 1000];
}

function drawPhoto() {
  const canvas = $<HTMLCanvasElement>('photo');
  canvas.width = state.width; canvas.height = state.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(state.source!, 0, 0);
  const unit = Math.max(1, state.width / 700);
  ctx.lineWidth = 2 * unit;
  for (const y of state.rowCuts) {
    ctx.strokeStyle = 'rgba(0, 170, 255, 0.9)';
    ctx.setLineDash([8 * unit, 6 * unit]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.width, y); ctx.stroke();
  }
  ctx.setLineDash([]);
  const placed = new Map<number, number>();
  sortedPlacements().forEach((p, i) => placed.set(p.book.id, i + 1));
  state.rows.forEach((row, r) => {
    const { y0, y1 } = row.band;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    for (const x of row.cuts) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
    row.spines.forEach((s, i) => {
      const { x0, x1 } = s.box;
      const w = x1 - x0;
      if (s.excluded) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(x0, y0, w, y1 - y0);
        return;
      }
      const d = Math.min(w * 0.7, 22 * unit);
      const cx = x0 + w / 2, cy = y1 - d * 0.9;
      ctx.fillStyle = s.color.hex;
      ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const n = placed.get(r * 1000 + i);
      if (n !== undefined && d > 10) {
        ctx.fillStyle = s.color.lch.L > 0.6 ? '#000' : '#fff';
        ctx.font = `600 ${Math.round(d * 0.5)}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n), cx, cy + 1);
      }
    });
  });
}

function sortedPlacements() {
  const list = books();
  const capacity = state.rows.map(row => row.spines.filter(s => !s.excluded).reduce((s, x) => s + x.box.x1 - x.box.x0, 0));
  return layout(sortBooks(list, state.options), capacity);
}

/** The shelf rebuilt from the photo's own spines, in the new order. */
function drawSorted() {
  const placements = sortedPlacements();
  const canvas = $<HTMLCanvasElement>('sorted');
  const gap = Math.round(state.height * 0.03);
  const rowHeights = state.rows.map(r => r.band.y1 - r.band.y0);
  const rowWidths = state.rows.map((_, r) => placements.filter(p => p.row === r).reduce((s, p) => s + p.book.width, 0));
  canvas.width = Math.max(state.width, ...rowWidths);
  canvas.height = rowHeights.reduce((s, h) => s + h + gap, gap);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--wall').trim() || '#e9e4da';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let y = gap;
  state.rows.forEach((_, r) => {
    let x = Math.round((canvas.width - rowWidths[r]) / 2);
    const bottom = y + rowHeights[r];
    for (const p of placements.filter(q => q.row === r)) {
      const s = spineOf(p.book);
      const { x0, y0, x1, y1 } = s.box;
      const h = y1 - y0;
      ctx.drawImage(state.source!, x0, y0, x1 - x0, h, x, bottom - h, x1 - x0, h);
      x += x1 - x0;
    }
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(0, bottom, canvas.width, Math.max(3, gap * 0.4));
    y = bottom + gap;
  });

  const strip = $('strip');
  strip.replaceChildren(...placements.map(p => {
    const el = document.createElement('span');
    el.style.background = spineOf(p.book).color.hex;
    el.style.flexGrow = String(p.book.width);
    el.title = spineOf(p.book).color.hex;
    return el;
  }));

  const kept = unmoved(placements);
  $('summary').textContent = `${placements.length} Bücher · ${kept} bleiben stehen, ${placements.length - kept} ziehen um.`;
  const list = $('moves');
  list.replaceChildren(...placements.map((p, i) => {
    const li = document.createElement('li');
    const sw = document.createElement('span');
    sw.className = 'sw';
    sw.style.background = spineOf(p.book).color.hex;
    const stays = p.book.row === p.row && p.book.pos === p.pos;
    li.append(sw, `${i + 1}. Reihe ${p.row + 1}, Platz ${p.pos + 1} ← ${stays ? 'steht schon da' : `jetzt Reihe ${p.book.row + 1}, Platz ${p.book.pos + 1}`}`);
    if (stays) li.className = 'stays';
    return li;
  }));
}

function render() {
  drawPhoto();
  drawSorted();
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === state.tool)));
}

function photoPoint(e: MouseEvent): [number, number] {
  const canvas = $<HTMLCanvasElement>('photo');
  const rect = canvas.getBoundingClientRect();
  return [((e.clientX - rect.left) / rect.width) * state.width, ((e.clientY - rect.top) / rect.height) * state.height];
}

function onPhotoClick(e: MouseEvent) {
  if (!state.lab) return;
  const [x, y] = photoPoint(e);
  const reach = Math.max(6, state.width / 120);
  if (state.tool === 'row') {
    const near = state.rowCuts.findIndex(c => Math.abs(c - y) < reach);
    if (near >= 0) state.rowCuts.splice(near, 1); else state.rowCuts.push(Math.round(y));
    state.rowCuts.sort((p, q) => p - q);
    buildRows(false, state.rows);
    render();
    return;
  }
  const row = state.rows.find(r => y >= r.band.y0 && y < r.band.y1);
  if (!row) return;
  if (state.tool === 'line') {
    const near = row.cuts.findIndex(c => Math.abs(c - x) < reach);
    if (near >= 0) row.cuts.splice(near, 1); else row.cuts.push(Math.round(x));
    row.cuts.sort((p, q) => p - q);
    readSpines(row);
  } else {
    const spine = row.spines.find(s => x >= s.box.x0 && x < s.box.x1);
    if (spine) spine.excluded = !spine.excluded;
  }
  render();
}

function bindOptions() {
  const mode = $<HTMLSelectElement>('mode');
  const start = $<HTMLInputElement>('start');
  const neutral = $<HTMLInputElement>('neutral');
  const bucket = $<HTMLInputElement>('bucket');
  const update = () => {
    state.options = {
      mode: mode.value as Mode,
      startHue: Number(start.value),
      neutralChroma: Number(neutral.value) / 1000,
      bucket: Number(bucket.value),
    };
    $('start-v').textContent = `${start.value}°`;
    $('neutral-v').textContent = (Number(neutral.value) / 1000).toFixed(3);
    $('bucket-v').textContent = bucket.value === '0' ? 'aus' : `${bucket.value}°`;
    $('start-sw').style.background = `oklch(0.65 0.15 ${start.value})`;
    for (const el of [start, neutral, bucket]) el.disabled = mode.value !== 'rainbow';
    if (state.lab) render();
  };
  for (const el of [mode, start, neutral, bucket]) el.addEventListener('input', update);
  update();
}

function main() {
  for (const id of ['file', 'camera']) {
    $<HTMLInputElement>(id).addEventListener('change', e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) loadFile(file).catch(err => status(`Das Foto ließ sich nicht lesen: ${err instanceof Error ? err.message : err}`));
    });
  }
  $('sample').addEventListener('click', loadSample);
  $('redetect').addEventListener('click', () => {
    if (!state.lab) return;
    state.rowCuts = findRowCuts(state.lab);
    buildRows(true);
    render();
  });
  $('photo').addEventListener('click', onPhotoClick);
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.addEventListener('click', () => {
    state.tool = b.dataset.tool as Tool;
    render();
  }));
  $('download').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = $<HTMLCanvasElement>('sorted').toDataURL('image/jpeg', 0.9);
    a.download = 'regal-nach-farben.jpg';
    a.click();
  });
  bindOptions();
}

main();
