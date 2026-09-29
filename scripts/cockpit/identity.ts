/**
 * The view „Identität" (ROADMAP 6.61): the site's visual identity and the
 * choices that led to it, read from the files that hold them — never a
 * second list. Decisions come from the table in docs/identitaet.md (§0),
 * colours from app/globals.css, the mark from app/icon.svg and the raster
 * icons, the faces from the font files themselves (so the specimens are set
 * in the real thing), the discarded mark directions from the numbers they
 * were drawn with on 2026-09-28/29.
 *
 * The parsers are pure; `collectIdentity` reads the files.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isbnRuns } from '../../lib/isbnformat';

export interface IdentityDecision { date: string; topic: string; decision: string; rejected: string; items: string[] }
export interface Token { name: string; light: string; dark: string | null }
export interface FontFace { family: string; style: 'normal' | 'italic'; url: string; source: string }
export interface MarkSketch { id: string; label: string; note: string; svg: string; chosen: boolean }

export interface IdentityData {
  decisions: IdentityDecision[];
  tokens: Token[];
  fonts: FontFace[];
  iconSvg: string | null;
  rasterIcons: Array<{ name: string; path: string; url: string; bytes: number }>;
  sketches: MarkSketch[];
  isbn: { raw: string; runs: Array<{ text: string; mono: boolean }> };
  missing: string[];
}

/** The table under „## 0. Entscheidungen" in docs/identitaet.md. */
export function parseDecisions(text: string): IdentityDecision[] {
  const start = text.indexOf('## 0. Entscheidungen');
  if (start < 0) return [];
  const rest = text.slice(start);
  const next = rest.indexOf('\n## ', 3);
  const section = next < 0 ? rest : rest.slice(0, next);
  const out: IdentityDecision[] = [];
  for (const line of section.split('\n')) {
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 5 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[0])) continue;
    out.push({
      date: cells[0], topic: cells[1], decision: cells[2], rejected: cells[3],
      items: [...cells[4].matchAll(/\d+\.\d+[a-z]?/g)].map(m => m[0]),
    });
  }
  return out;
}

/** `--name: #hex;` in the light `:root` and in the dark media block. */
export function parseTokens(css: string): Token[] {
  const darkAt = css.indexOf('@media (prefers-color-scheme: dark)');
  const lightPart = darkAt < 0 ? css : css.slice(0, darkAt);
  const darkEnd = darkAt < 0 ? -1 : css.indexOf('@theme', darkAt);
  const darkPart = darkAt < 0 ? '' : css.slice(darkAt, darkEnd < 0 ? undefined : darkEnd);
  const read = (part: string) => new Map([...part.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map(m => [m[1], m[2]]));
  const light = read(lightPart);
  const dark = read(darkPart);
  return [...light].map(([name, value]) => ({ name, light: value, dark: dark.get(name) ?? null }));
}

/** The mark directions compared on 2026-09-28 and 2026-09-29 (identitaet §3). */
export function markSketches(): MarkSketch[] {
  const ink = '#2a2622', acc = '#945138';
  const wall = (n: number, toned: boolean, seed: number, gapY: number, pickedFill: string | null, outline = false) => {
    const w = 10, h = 15, g = 3, W = n * w + (n - 1) * g, H = n * h + (n - 1) * gapY, c = Math.floor(n / 2);
    const tones = ['#2a2622', '#3a342f', '#4a433c', '#6b635a', '#8a8178', '#b8ab9c', '#d9cfc1'];
    let s = seed;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    let out = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (x === c && y === c) continue;
      out += `<rect x="${x * (w + g)}" y="${y * (h + gapY)}" width="${w}" height="${h}" rx="0.6" fill="${toned ? tones[Math.floor(r() * tones.length)] : ink}"/>`;
    }
    const px = c * (w + g), py = c * (h + gapY);
    if (outline) out += `<rect x="${px + 0.5}" y="${py + 0.5}" width="${w - 1}" height="${h - 1}" fill="none" stroke="${acc}" stroke-width="1" stroke-dasharray="2 1.5"/>`;
    else if (pickedFill) out += `<rect x="${px - w * 0.15}" y="${py - h * 0.15}" width="${w * 1.3}" height="${h * 1.3}" rx="0.8" fill="${pickedFill}"/>`;
    return svgBox(out, W, H);
  };
  const mosaicBook = () => {
    const tones = ['#2a2622', '#4a433c', '#945138', '#6b635a', '#b8876f', '#3a342f'];
    let s = 7;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    let out = '';
    for (let y = 0; y < 40; y += 4) for (let x = 0; x < 30; x += 3) out += `<rect x="${x + 0.25}" y="${y + 0.25}" width="2.5" height="3.5" fill="${x < 3 ? ink : tones[Math.floor(r() * tones.length)]}"/>`;
    return svgBox(out, 30, 40);
  };
  const fan = svgBox(`<rect x="4" y="10" width="20" height="30" fill="#8a8178" transform="rotate(-14 14 40)"/><rect x="10" y="8" width="20" height="30" fill="${ink}" transform="rotate(-4 20 38)"/><rect x="16" y="8" width="20" height="30" fill="${acc}" transform="rotate(8 26 38)"/>`, 40, 46);
  return [
    { id: 'A', label: 'A · die gewählte Kachel', note: 'Gewählt und gebaut 2026-09-29, am selben Tag durch die Mischung A + C ersetzt.', svg: wall(3, false, 1, 3, acc), chosen: false },
    { id: 'A0', label: 'A, Skizze vom 2026-09-28', note: 'Die erste Skizze: Reihen ohne Abstand.', svg: wall(3, false, 1, 0, acc), chosen: false },
    { id: 'B', label: 'B · Wand mit Lücke', note: 'Bei 16 px kaum von einem Gitter zu unterscheiden.', svg: wall(3, false, 1, 0, null, true), chosen: false },
    { id: 'C', label: 'C · Mosaik-Buch', note: 'Groß lebendig, klein ein bunter Fleck.', svg: mosaicBook(), chosen: false },
    { id: 'D', label: 'D · Fächer', note: 'Wie der Cover-Ring der Startseite.', svg: fan, chosen: false },
    { id: 'AC3', label: 'Mischung A + C, 3 × 3', note: 'Gewählt 2026-09-29. Im dunklen Modus kehrt sich die Tonleiter um, damit keine Kachel im Grund versinkt.', svg: wall(3, true, 5, 3, acc), chosen: true },
    { id: 'AC5', label: 'Mischung A + C, 5 × 5', note: 'Groß wie die Karte, bei 16 px Rauschen.', svg: wall(5, true, 11, 3, acc), chosen: false },
  ];
}

function svgBox(inner: string, w: number, h: number): string {
  const side = Math.max(w, h) * 1.12;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(w - side) / 2} ${(h - side) / 2} ${side} ${side}">${inner}</svg>`;
}

const MIME: Record<string, string> = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };

function dataUrl(file: string): string {
  return `data:${MIME[path.extname(file)] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`;
}

export function collectIdentity(root: string): IdentityData {
  const read = (p: string) => { try { return readFileSync(path.join(root, p), 'utf8'); } catch { return ''; } };
  const missing: string[] = [];
  const fonts: FontFace[] = [];
  const face = (family: string, style: 'normal' | 'italic', rel: string) => {
    const file = path.join(root, rel);
    if (existsSync(file)) fonts.push({ family, style, url: dataUrl(file), source: rel });
    else missing.push(rel);
  };
  // Today: the respaced Xanh and Jost. Before: the monospaced original.
  // Fraunces and Geist were Google fonts and never lived in the repository.
  face('BB Xanh', 'normal', 'assets/fonts/xanh-proportional-regular.woff2');
  face('BB Xanh', 'italic', 'assets/fonts/xanh-proportional-italic.woff2');
  face('BB Jost', 'normal', 'assets/og/jost-latin-400-normal.woff');
  face('BB Xanh Mono', 'normal', 'lab/xanh-spacing/source/XanhMono-Regular.ttf');
  face('BB Xanh Mono', 'italic', 'lab/xanh-spacing/source/XanhMono-Italic.ttf');

  const rasterIcons = ['app/favicon.ico', 'app/apple-icon.png'].filter(p => {
    const ok = existsSync(path.join(root, p));
    if (!ok) missing.push(p);
    return ok;
  }).map(p => ({ name: path.basename(p), path: p, url: dataUrl(path.join(root, p)), bytes: readFileSync(path.join(root, p)).length }));

  const icon = read('app/icon.svg');
  if (!icon) missing.push('app/icon.svg');
  const sample = '9780141439471';
  return {
    decisions: parseDecisions(read('docs/identitaet.md')),
    tokens: parseTokens(read('app/globals.css')),
    fonts,
    iconSvg: icon || null,
    rasterIcons,
    sketches: markSketches(),
    isbn: { raw: sample, runs: isbnRuns(sample) },
    missing,
  };
}
