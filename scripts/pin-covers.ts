/**
 * Cover pins for the test line (ROADMAP 5.5, 2026-11-04;
 * docs/pinterest-formate-recherche-2026-11-03.md §5.2 and §8): one cover
 * alone as the picture, no wordmark, a board with a search name, a link to
 * exactly this cover. Writes drafts into docs/pins/queue.json for Julian's
 * yes in the Cockpit; nothing here reaches Pinterest.
 *
 *   npx tsx scripts/pin-covers.ts --works OL893414W,OL103123W [--per-work 2] [--max-year 1990]
 *       [--min-width 500] [--from 2026-11-05] [--origin https://buyitscovers.com] [--dry]
 *
 * Per work: the catalogue's editions and covers (`getWorkDetail`, the decade
 * page's own reading, never Google — E10), folded over the built index, then
 * `pickCoverPins` (lib/coverpins.ts): a printing dated `--max-year` or
 * earlier, or one that is not English; a scanned page is skipped. Each
 * candidate's **original** scan is fetched once from Open Library's cover
 * server (`originalCoverUrl`: no size suffix — the L the site serves is
 * capped at 500 px on the long side, measured 2026-11-04) and measured with
 * sharp: under `--min-width` pixels it is skipped (Pinterest shows about
 * 236 px in the feed and about 500 in the closeup; a 300 px scan goes soft,
 * and nothing is upscaled), and so is a picture that is mostly one colour
 * (`plainShare`: a library binding without its jacket, barcode and all,
 * which archive.org scans often are). A picture that passes is kept under
 * docs/cockpit/pins/ as `<id>-prod.jpg` — JPEG, no taller than 3000 px —
 * where the Cockpit looks and the upload takes it from, so Julian sees it
 * without another fetch. A Google cover has no original and is skipped.
 *
 * Boards: a printing in another language goes to „<Language> book covers";
 * a paperback of 1979 or earlier to „Vintage paperback covers"; otherwise
 * the work's genre board from GENRE_BOARDS, or „Book cover design". The
 * board is a proposal, the note says so.
 *
 * Open Library is asked one work at a time, ten seconds between works and a
 * second between images (umgang §1: this address was refused after bursts).
 * A pin that is already in the queue is never touched; a cover that already
 * is a pin is not offered again.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { indexSignatures } from '../lib/coverindex';
import { pickCoverPins, PLAIN_SHARE, plainShare, type CoverPinCandidate, type Doubt } from '../lib/coverpins';
import { signature } from '../lib/imagehash';
import { looksLikeScannedPage } from '../lib/imagesig';
import { languageName } from '../lib/normalize';
import { coverPin, originalCoverUrl, PIN_DESCRIPTION_MAX, PIN_TITLE_MAX } from '../lib/pins';
import { authorLine } from '../lib/seo';
import { fetchBytes } from '../lib/sources/http';
import { getWorkDetail, MAX_EDITIONS_SCANNED } from '../lib/work';
import { foldDuplicateCovers } from '../lib/works';
import { kindOf, readQueue, withKinds, writeQueue, type QueuedPin } from './cockpit/pins';

const LIVE = 'https://buyitscovers.com';
const WORK_PAUSE_MS = 10_000;
const IMAGE_PAUSE_MS = 1_000;
/** The upload file's cap: Pinterest resizes anyway, and the Cockpit shows the picture at 220 px. */
const MAX_HEIGHT = 3000;
/** Three proposal slots a day, between the montages' 12:00 and 19:00. */
const SLOTS = ['09:00', '15:00', '21:00'];

/** Julian's boards with search names (queue.json, 2026-11-03), by the work's genre; a work not named here goes to the fallback. */
const GENRE_BOARDS: Record<string, string> = {
  OL893414W: 'Science fiction book covers', // Dune
  OL103123W: 'Science fiction book covers', // Fahrenheit 451
  OL64365W: 'Science fiction book covers', // Brave New World
  OL49488W: 'Science fiction book covers', // Ender's Game
  OL27258W: 'Science fiction book covers', // Neuromancer
  OL1168083W: 'Classic book covers', // Nineteen Eighty-Four
  OL1168007W: 'Classic book covers', // Animal Farm
  OL66554W: 'Classic book covers', // Pride and Prejudice
  OL468431W: 'Classic book covers', // The Great Gatsby
  OL3335245W: 'Classic book covers', // The Catcher in the Rye
  OL27482W: 'Fantasy book covers', // The Hobbit
  OL27513W: 'Fantasy book covers', // The Fellowship of the Ring
  OL257943W: 'Fantasy book covers', // A Game of Thrones
};
const FALLBACK_BOARD = 'Book cover design';
const VINTAGE_BOARD = 'Vintage paperback covers';
const VINTAGE_UNTIL = 1979;

/** What a doubt means, for Julian's note (`lib/coverpins.ts`). */
const DOUBTS: Record<Doubt, string> = {
  'isbn before 1970': 'der Eintrag trägt eine ISBN, ist aber vor 1970 datiert — das Bild ist wohl ein späterer Druck',
  'before first publication': 'das Jahr liegt vor der Erstausgabe',
  'carriers disagree': 'die Einträge mit diesem Bild liegen mehr als zehn Jahre auseinander',
};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (name: string) => process.argv.includes(name);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function boardFor(workId: string, c: CoverPinCandidate): string {
  if (c.language && c.language !== 'en') return `${languageName(c.language)} book covers`;
  if (c.year && c.year <= VINTAGE_UNTIL && c.edition?.format === 'paperback') return VINTAGE_BOARD;
  return GENRE_BOARDS[workId] ?? FALLBACK_BOARD;
}

/** The board's phrase in the singular, for the title: „Science fiction book covers" → „Science fiction book cover" (the case stays: „German book cover"). */
const whatOf = (board: string) => board.replace(/covers$/i, 'cover');

/** Cover ids that are pins already: named in a cover pin's link (`&cover=`). */
function pinnedCovers(pins: readonly QueuedPin[]): Set<string> {
  const out = new Set<string>();
  for (const p of pins) {
    const m = /[?&]cover=([^&]+)/.exec(p.link);
    if (m && kindOf(p) === 'cover') out.add(decodeURIComponent(m[1]));
  }
  return out;
}

/** Proposal slots, three a day from `from`, skipping any the queue already names. */
function slotsFrom(from: string, taken: ReadonlySet<string>): () => string {
  const day = new Date(`${from}T12:00:00Z`);
  let i = 0;
  return () => {
    for (;;) {
      const slot = `${day.toISOString().slice(0, 10)} ${SLOTS[i]}`;
      i = (i + 1) % SLOTS.length;
      if (i === 0) day.setUTCDate(day.getUTCDate() + 1);
      if (!taken.has(slot)) return slot;
    }
  };
}

interface Measured { width: number; height: number; bytes: Uint8Array; plain: number }

/** The original scan once from Open Library's cover server, its size, and how much of it is one colour (`plainShare`). */
async function measure(coverId: string): Promise<Measured | null> {
  const url = originalCoverUrl(coverId);
  if (!url) return null;
  const bytes = await fetchBytes(url, { timeoutMs: 40_000, revalidate: 0 });
  const image = sharp(Buffer.from(bytes));
  const meta = await image.metadata();
  if (!meta.width || !meta.height) return null;
  const raster = await image.clone().rotate().resize(24, 36, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  return { width: meta.width, height: meta.height, bytes, plain: plainShare(new Uint8Array(raster)) };
}

/** The file the pin is uploaded from: upright, JPEG, no taller than MAX_HEIGHT, never enlarged. */
function asPinFile(m: Measured): Promise<Buffer> {
  return sharp(Buffer.from(m.bytes)).rotate().resize({ height: MAX_HEIGHT, withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
}

async function main(): Promise<void> {
  const root = process.cwd();
  const works = arg('--works', '').split(',').map(s => s.trim()).filter(Boolean);
  if (works.length === 0) throw new Error('--works OL…W,OL…W is required');
  const perWork = Number(arg('--per-work', '2'));
  const maxYear = Number(arg('--max-year', '1990'));
  const minWidth = Number(arg('--min-width', '500'));
  const origin = arg('--origin', LIVE);
  const today = new Date().toISOString().slice(0, 10);
  const from = arg('--from', today);
  const dry = has('--dry');

  const queue = withKinds(readQueue(root) ?? { updated: today, pins: [] });
  const exclude = pinnedCovers(queue.pins);
  const ids = new Set(queue.pins.map(p => p.id));
  const nextSlot = slotsFrom(from, new Set(queue.pins.map(p => p.slot).filter((s): s is string => !!s)));
  const picturesDir = path.join(root, 'docs', 'cockpit', 'pins');
  const added: QueuedPin[] = [];
  const lines: string[] = [];

  for (const [i, workId] of works.entries()) {
    if (i > 0) await sleep(WORK_PAUSE_MS);
    process.stderr.write(`${workId} … `);
    let detail: Awaited<ReturnType<typeof getWorkDetail>>;
    try {
      detail = await getWorkDetail(workId, { maxEntries: MAX_EDITIONS_SCANNED, dedupeCovers: false, googleBooks: false });
    } catch (err) {
      const message = (err as Error).message;
      process.stderr.write(`${message}\n`);
      // A refused connection is Open Library's block of this address (umgang §1): stop, keep what came, do not retry.
      if (/fetch failed|ECONNREFUSED|ECONNRESET/.test(message)) { process.stderr.write('Open Library refuses this address — stopping here with what came; run again later\n'); break; }
      continue;
    }
    if (!detail) { process.stderr.write('not found\n'); continue; }
    if (!detail.complete) { process.stderr.write('Open Library stopped answering part of the way — skipped, run again later\n'); continue; }
    const signatures = indexSignatures(detail.covers.map(c => c.id));
    const folded = foldDuplicateCovers(detail.covers, signatures, detail.editions);
    // A scan's facts are its own record's: the fold would hand a reprint's scan the first edition's year
    // (the Berkley Dune of 1984 came out as „Chilton 1965" on 2026-11-04). The fold only says which scans
    // are one design, so that no design is pinned twice and a design already pinned is not offered again.
    const designOf = new Map<string, string>();
    for (const f of folded) {
      designOf.set(f.id, f.id);
      for (const s of f.similarIds ?? []) designOf.set(s, f.id);
    }
    const design = (id: string) => designOf.get(id) ?? id;
    const designs = new Set([...exclude].map(design));
    const candidates = pickCoverPins(detail.covers, detail.editions, signatures, { maxYear, perWork, spare: perWork * 3, exclude, firstYear: detail.work.firstPublishYear });
    process.stderr.write(`${detail.work.title}: ${folded.length} designs from ${detail.covers.length} covers, ${candidates.length} candidates\n`);
    let got = 0;
    for (const c of candidates) {
      if (got >= perWork) break;
      if (!c.cover.id.startsWith('ol:')) { process.stderr.write(`  ${c.cover.id}: a Google cover, no original scan\n`); continue; }
      if (designs.has(design(c.cover.id))) { process.stderr.write(`  ${c.cover.id}: the same design as a pin above\n`); continue; }
      await sleep(IMAGE_PAUSE_MS);
      let m: Measured | null = null;
      try {
        m = await measure(c.cover.id);
      } catch (err) {
        process.stderr.write(`  ${c.cover.id}: ${(err as Error).message}\n`);
        continue;
      }
      if (!m) { process.stderr.write(`  ${c.cover.id}: not an image\n`); continue; }
      if (m.width < minWidth) { process.stderr.write(`  ${c.cover.id}: ${m.width} px wide, under ${minWidth}\n`); continue; }
      if (m.plain >= PLAIN_SHARE) { process.stderr.write(`  ${c.cover.id}: ${Math.round(m.plain * 100)} % one colour — a binding without its jacket\n`); continue; }
      if (!signatures.has(c.cover.id) && looksLikeScannedPage(signature(m.bytes) ?? undefined)) { process.stderr.write(`  ${c.cover.id}: looks like a scanned page\n`); continue; }
      const id = `cover-${workId}-${c.cover.id.replace(':', '')}`;
      if (ids.has(id)) { process.stderr.write(`  ${id}: already in the queue\n`); continue; }
      const board = boardFor(workId, c);
      const pin = coverPin({
        workId,
        coverId: c.cover.id,
        title: detail.work.title,
        editionTitle: c.edition?.title,
        author: authorLine(detail.work.authors),
        board,
        what: whatOf(board),
        year: c.year,
        publisher: c.publisher,
        language: c.language,
        covers: folded.length,
      }, origin);
      if (pin.title.length > PIN_TITLE_MAX || pin.description.length > PIN_DESCRIPTION_MAX) throw new Error(`${id}: title ${pin.title.length} / description ${pin.description.length} characters — past Pinterest's limit`);
      const why = c.reasons.map(r => (r === 'old' ? `Druck von ${c.year}` : `${languageName(c.language, 'de')}, nicht Englisch`)).join('; ');
      const doubt = c.doubts.length > 0 ? ` VERDACHT: ${c.doubts.map(d => DOUBTS[d]).join('; ')}.` : '';
      const plain = m.plain >= 0.6 ? ` Das Bild ist zu ${Math.round(m.plain * 100)} % eine Farbe — vielleicht ein Einband ohne Umschlag.` : '';
      const note = `Einzel-Cover-Testlinie (${why}). Jahr und Verlag sind die des frühesten widerspruchsfreien Katalogeintrags mit diesem Bild (${c.carriers} ${c.carriers === 1 ? 'Eintrag trägt' : 'Einträge tragen'} es) — Bild ansehen, ob es dazu passt.${doubt}${plain} Scan ${m.width} × ${m.height} px, Open Librarys Original (die Seite zeigt höchstens 500 px). Pinnwand ist ein Vorschlag.`;
      const queued: QueuedPin = {
        id, kind: 'cover', status: 'entwurf', slot: nextSlot(), board,
        picture: pin.picture, title: pin.title, description: pin.description, alt: pin.alt, link: pin.link, note,
      };
      if (!dry) {
        mkdirSync(picturesDir, { recursive: true });
        writeFileSync(path.join(picturesDir, `${id}-prod.jpg`), await asPinFile(m));
      }
      added.push(queued);
      ids.add(id);
      designs.add(design(c.cover.id));
      got++;
      lines.push(`${id} | ${board} | ${pin.title} | ${m.width} × ${m.height}`);
    }
  }

  if (added.length === 0) { console.log('nothing to add'); return; }
  if (!dry) writeQueue(root, { updated: today, pins: [...queue.pins, ...added] });
  console.log(lines.join('\n'));
  console.log(`${added.length} cover pins ${dry ? 'would go' : 'went'} into docs/pins/queue.json`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
