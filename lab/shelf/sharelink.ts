/**
 * A shelf packed into a URL fragment (ROADMAP 5.11, Julian's default of
 * 2026-09-26: no storage, the list travels in the link).
 *
 * `#s=<payload>&t=<title>`: the payload is base64url of a version byte and
 * then, per book, two unsigned LEB128 varints — the Open Library work number
 * (`OL123W` -> 123) and the cover id (0 = none). Order is kept: it is the
 * order of the wall.
 *
 * A fragment never reaches a server — the browser keeps everything after `#`
 * to itself — so a shared wall is rendered from the link alone and nobody
 * learns whose shelf it was. Pure and dependency-free: the served page carries
 * a copy of `encode`/`decode` inline (index.html), and the tests pin both to
 * the same bytes.
 */

export const SHARE_VERSION = 1;

/** A generous bound: a work or cover number above this is not an Open Library id. */
const MAX_ID = 2 ** 40;

export interface ShelfEntry {
  /** `OL123W` */
  workId: string;
  /** Open Library cover id, 0 when the work shows no cover. */
  coverId: number;
}

const WORK = /^OL(\d+)W$/;

function pushVarint(out: number[], n: number) {
  let v = n;
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
}

function toBase64Url(bytes: readonly number[]): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): number[] | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return Array.from(bin, c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The payload alone, without `s=`. Throws on an id that is not an Open Library work. */
export function encodeShelf(entries: readonly ShelfEntry[]): string {
  const bytes: number[] = [SHARE_VERSION];
  for (const e of entries) {
    const m = WORK.exec(e.workId);
    if (!m) throw new Error(`not a work id: ${e.workId}`);
    const cover = Math.max(0, Math.floor(e.coverId || 0));
    pushVarint(bytes, Number(m[1]));
    pushVarint(bytes, cover);
  }
  return toBase64Url(bytes);
}

/** Null for anything that is not a well-formed payload of this version. */
export function decodeShelf(payload: string): ShelfEntry[] | null {
  const bytes = fromBase64Url(payload);
  if (!bytes || bytes[0] !== SHARE_VERSION) return null;
  const nums: number[] = [];
  let i = 1;
  while (i < bytes.length) {
    let n = 0;
    let scale = 1;
    for (;;) {
      if (i >= bytes.length) return null;
      const b = bytes[i++];
      n += (b & 0x7f) * scale;
      scale *= 0x80;
      if (n > MAX_ID) return null;
      if (b < 0x80) break;
    }
    nums.push(n);
  }
  if (nums.length % 2 !== 0) return null;
  const out: ShelfEntry[] = [];
  for (let k = 0; k < nums.length; k += 2) {
    if (nums[k] === 0) return null;
    out.push({ workId: `OL${nums[k]}W`, coverId: nums[k + 1] });
  }
  return out;
}

/** The whole fragment, `#s=…` and an optional `&t=` title. */
export function shelfFragment(entries: readonly ShelfEntry[], title?: string): string {
  const t = title?.trim();
  return `#s=${encodeShelf(entries)}${t ? `&t=${encodeURIComponent(t.slice(0, 80))}` : ''}`;
}

export function parseFragment(hash: string): { entries: ShelfEntry[]; title?: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const s = params.get('s');
  if (!s) return null;
  const entries = decodeShelf(s);
  if (!entries) return null;
  const title = params.get('t')?.trim();
  return title ? { entries, title } : { entries };
}
