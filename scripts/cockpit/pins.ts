/**
 * The pin queue (ROADMAP 5.5; Julian, 2026-10-31: „ich brauche einen
 * interaktiveren modus um zu editieren und ja oder nein zu sagen. am besten
 * wir bauen das in das cockpit als app ein").
 *
 * `docs/pins/queue.json` is **the one list** of pins for Pinterest: what was
 * scheduled, what waits for Julian's word, what he struck. The Cockpit's view
 * „Pins" shows it and writes Julian's edits and decisions back into it; the
 * plan (PLAN-5.5-5.6 §7.1) points here instead of holding a second table.
 * Claude writes new drafts into the file; Julian says yes or no; only a pin
 * with `ja` is uploaded and scheduled, by hand in his account, and then set
 * to `geplant`.
 *
 * The checks are the rules the site's own copy keeps: Pinterest's limits
 * (100 characters of title, 500 of description, `lib/pins.ts`), no word that
 * claims completeness (CLAUDE.md), a link back to the site through
 * `?via=pinterest` (K16), and a picture from the site's own pin routes — or,
 * for a cover pin (the test line of 2026-11-04), one cover from the site's
 * image route, with an alt text for Pinterest's field.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PIN_ALT_MAX, PIN_DESCRIPTION_MAX, PIN_TITLE_MAX, type PinKind } from '../../lib/pins';

export const QUEUE_FILE = path.join('docs', 'pins', 'queue.json');

/** Where a pin stands. Only `entwurf`, `ja` and `nein` are Julian's to set; `geplant` and `veröffentlicht` follow what happened on Pinterest. */
export const PIN_STATUSES = ['entwurf', 'ja', 'nein', 'geplant', 'veröffentlicht'] as const;
export type PinStatus = (typeof PIN_STATUSES)[number];
export const DECISIONS: readonly PinStatus[] = ['entwurf', 'ja', 'nein'];

export interface QueuedPin {
  /** Stable, e.g. `decades-OL49488W`, `collection-sf-masterworks` or `cover-OL893414W-ol15230634`. */
  id: string;
  /** What the pin shows (the test line of 2026-11-04 compares these); a pin from before carries none and is read from its id, `kindOf`. */
  kind?: PinKind;
  board: string;
  /** The picture as Pinterest gets it: the site's pin route, or Open Library's original scan for a cover pin. */
  picture: string;
  title: string;
  description: string;
  /** Pinterest's alt text (under „More options" in its form); the cover pins carry one. */
  alt?: string;
  link: string;
  status: PinStatus;
  /** Proposed or booked slot, `2026-11-07 19:00` (the time Pinterest's form shows). */
  slot?: string;
  /** Claude's hint: what to look at before saying yes. */
  note?: string;
  /** Julian's own remark, kept with the pin. */
  remark?: string;
  /** When the status last changed, `YYYY-MM-DD`. */
  decided?: string;
}

export interface PinQueue {
  updated: string;
  pins: QueuedPin[];
}

const SITE = 'https://buyitscovers.com/';
/** The copy rule (CLAUDE.md, `lib/seo.ts` tests): no word that claims completeness. */
const COMPLETENESS = /\b(every|all|complete)\b/i;
/** The pictures a pin may carry: the montage routes, or one cover from the site's own image route (the cover pins, 2026-11-04). */
const PICTURE = /\/pin\.jpg(\?|$)|\/compare\.jpg\?covers=|\/img\/L\/(ol|gb)-[\w.-]{1,64}$/;
/** Open Library's original scan (`originalCoverUrl` in lib/pins.ts): what a cover pin is uploaded from, since the site's L is capped at 500 px. */
const ORIGINAL = /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+\.jpg$/;

export interface Problem { field: 'title' | 'description' | 'alt' | 'link' | 'picture' | 'status'; message: string }

/** What keeps a pin from being said yes to; empty when it may go. */
export function problems(pin: Pick<QueuedPin, 'title' | 'description' | 'alt' | 'link' | 'picture' | 'status'>): Problem[] {
  const out: Problem[] = [];
  const title = pin.title.trim();
  const description = pin.description.trim();
  if (!title) out.push({ field: 'title', message: 'Titel fehlt' });
  if (title.length > PIN_TITLE_MAX) out.push({ field: 'title', message: `Titel ${title.length} von ${PIN_TITLE_MAX} Zeichen` });
  if (!description) out.push({ field: 'description', message: 'Beschreibung fehlt' });
  if (description.length > PIN_DESCRIPTION_MAX) out.push({ field: 'description', message: `Beschreibung ${description.length} von ${PIN_DESCRIPTION_MAX} Zeichen` });
  const alt = (pin.alt ?? '').trim();
  if (alt.length > PIN_ALT_MAX) out.push({ field: 'alt', message: `Alt-Text ${alt.length} von ${PIN_ALT_MAX} Zeichen` });
  for (const [field, text] of [['title', title], ['description', description], ['alt', alt]] as const) {
    const m = text.match(COMPLETENESS);
    if (m) out.push({ field, message: `„${m[0]}“ behauptet Vollständigkeit` });
  }
  if (!pin.link.startsWith(SITE) || !/[?&]via=pinterest(&|$)/.test(pin.link)) out.push({ field: 'link', message: 'Link muss auf buyitscovers.com zeigen und ?via=pinterest tragen' });
  if (!((pin.picture.startsWith(SITE) && PICTURE.test(pin.picture)) || ORIGINAL.test(pin.picture))) out.push({ field: 'picture', message: 'Bild muss eine Pin-Route der Seite sein (pin.jpg, compare.jpg, /img/L/<cover>) oder Open Librarys Original-Scan' });
  if (!PIN_STATUSES.includes(pin.status)) out.push({ field: 'status', message: `unbekannter Status ${String(pin.status)}` });
  return out;
}

export interface Edit {
  id: string;
  title?: string;
  description?: string;
  alt?: string;
  remark?: string;
  status?: PinStatus;
}

/**
 * Applies one edit from the Cockpit, or says why not. Text is trimmed and
 * kept on one line; a pin that is booked or out is not edited here, because
 * the file would then differ from Pinterest (it is changed there, on its
 * „Edit this Pin“ page, umgang §15); `ja` only for a pin without problems.
 */
export function applyEdit(queue: PinQueue, edit: Edit, today: string): { queue: PinQueue } | { error: string } {
  const i = queue.pins.findIndex(p => p.id === edit.id);
  if (i < 0) return { error: `kein Pin ${edit.id}` };
  const old = queue.pins[i];
  if (!DECISIONS.includes(old.status)) return { error: `${old.status} — hier gesperrt, Änderung in Pinterest („Edit this Pin“)` };
  if (edit.status !== undefined && !DECISIONS.includes(edit.status)) return { error: 'nur entwurf, ja oder nein' };
  const line = (s: string) => s.replace(/\s+/g, ' ').trim();
  const next: QueuedPin = {
    ...old,
    ...(edit.title !== undefined ? { title: line(edit.title) } : {}),
    ...(edit.description !== undefined ? { description: line(edit.description) } : {}),
    ...(edit.alt !== undefined ? { alt: line(edit.alt) || undefined } : {}),
    ...(edit.remark !== undefined ? { remark: line(edit.remark) || undefined } : {}),
  };
  if (next.alt === undefined) delete next.alt;
  if (next.remark === undefined) delete next.remark;
  if (edit.status !== undefined && edit.status !== old.status) {
    next.status = edit.status;
    next.decided = today;
  }
  if (next.status === 'ja') {
    const p = problems(next);
    if (p.length > 0) return { error: p.map(x => x.message).join('; ') };
  }
  const pins = queue.pins.slice();
  pins[i] = next;
  return { queue: { updated: today, pins } };
}

/** The file as written: stable key order, one pin per block, a newline at the end. */
export function serializeQueue(queue: PinQueue): string {
  const order: Array<keyof QueuedPin> = ['id', 'kind', 'status', 'slot', 'board', 'picture', 'title', 'description', 'alt', 'link', 'note', 'remark', 'decided'];
  const pins = queue.pins.map(p => Object.fromEntries(order.filter(k => p[k] !== undefined).map(k => [k, p[k]])));
  return JSON.stringify({ updated: queue.updated, pins }, null, 2) + '\n';
}

export function parseQueue(text: string): PinQueue {
  const raw = JSON.parse(text) as Partial<PinQueue>;
  if (!raw || !Array.isArray(raw.pins)) throw new Error('queue.json: pins fehlt');
  const ids = new Set<string>();
  for (const p of raw.pins) {
    if (!p.id || ids.has(p.id)) throw new Error(`queue.json: Id ${p.id} fehlt oder doppelt`);
    ids.add(p.id);
  }
  return { updated: String(raw.updated ?? ''), pins: raw.pins };
}

/** What a pin shows: as the file says, else read from the id's prefix (the pins before 2026-11-04 carry none; `general-…` are walls with search names). */
export function kindOf(pin: Pick<QueuedPin, 'id' | 'kind'>): PinKind {
  if (pin.kind) return pin.kind;
  if (pin.id.startsWith('cover-')) return 'cover';
  if (pin.id.startsWith('compare-')) return 'compare';
  if (pin.id.startsWith('decades-')) return 'decades';
  return 'wall';
}

/** The queue with every pin's kind written out, so the comparison of the lines (1.12.2026) can count them. */
export function withKinds(queue: PinQueue): PinQueue {
  return { ...queue, pins: queue.pins.map(p => (p.kind ? p : { ...p, kind: kindOf(p) })) };
}

export function readQueue(root: string): PinQueue | null {
  const file = path.join(root, QUEUE_FILE);
  return existsSync(file) ? parseQueue(readFileSync(file, 'utf8')) : null;
}

/** Written beside and renamed, so a reader never sees half a file (the watcher ignores `.tmp`). */
export function writeQueue(root: string, queue: PinQueue): void {
  const file = path.join(root, QUEUE_FILE);
  writeFileSync(`${file}.tmp`, serializeQueue(queue));
  renameSync(`${file}.tmp`, file);
}

/** The cached picture's file name: the pin's id and where it came from, nothing from the request. */
export function pictureFile(id: string, source: 'prod' | 'dev'): string | null {
  return /^[a-z0-9-]+$/i.test(id) ? `${id}-${source}.jpg` : null;
}

/** The address a picture is fetched from: production as the queue names it, or the same path on the local dev server; Open Library's original only as it is. */
export function pictureUrl(pin: Pick<QueuedPin, 'picture'>, source: 'prod' | 'dev'): string | null {
  if (ORIGINAL.test(pin.picture)) return source === 'prod' ? pin.picture : null;
  if (!pin.picture.startsWith(SITE)) return null;
  return source === 'prod' ? pin.picture : `http://localhost:3000/${pin.picture.slice(SITE.length)}`;
}
