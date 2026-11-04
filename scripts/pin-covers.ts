/**
 * Cover pins for the test line (ROADMAP 5.5, 2026-11-04;
 * docs/pinterest-formate-recherche-2026-11-03.md §5.2 and §8): one cover
 * alone as the picture, no wordmark, a board with a search name, a link to
 * exactly this cover. Writes drafts into docs/pins/queue.json for Julian's
 * yes in the Cockpit; nothing here reaches Pinterest.
 *
 * Two sources:
 *
 *   npx tsx scripts/pin-covers.ts --works OL893414W,OL103123W [--per-work 2] [--max-year 1990]
 *   npx tsx scripts/pin-covers.ts --collection tom-adams-christie --board "Tom Adams – Agatha Christie covers"
 *       --what "Tom Adams cover art" [--artist "Tom Adams" --artist-source collectingchristie.com] [--years 1963-1979] [--max 50]
 *   both: [--min-width 500] [--from 2026-11-05] [--origin https://buyitscovers.com] [--dry]
 *
 * **Works:** the catalogue's editions and covers per work (`getWorkDetail`,
 * the decade page's own reading, never Google — E10), then `pickCoverPins`
 * (lib/coverpins.ts): a printing dated `--max-year` or earlier, or one that
 * is not English; a scanned page is skipped. A scan's facts are its own
 * record's (the fold would hand a reprint's scan the first edition's year,
 * as it did for the Berkley *Dune* of 1984); the fold only says which scans
 * are one design, so no design is pinned twice.
 *
 * **Collection** (Julian, 2026-11-04: „testweise ein pin board … alle aus
 * einer sammlung … nur die tom adams cover"): the picks of a collection in
 * `data/collections.json`, one pin per cover, all on the one board named
 * here. The collection file holds work, title and cover id, not the
 * printing, so the record behind the scan is read from Open Library (the
 * cover's `.json` names the edition, the edition names publisher and date);
 * a record whose publisher is not one of the collection's is said so in the
 * note. The artist comes from the command line, with who credits them.
 *
 * Each candidate's **original** scan is fetched once from Open Library's
 * cover server (`originalCoverUrl`: no size suffix — the L the site serves
 * is capped at 500 px on the long side, measured 2026-11-04) and measured
 * with sharp: under `--min-width` pixels it is skipped (Pinterest shows
 * about 236 px in the feed and about 500 in the closeup; a 300 px scan goes
 * soft, and nothing is upscaled), and so is a picture that is mostly one
 * colour (`plainShare`: a library binding without its jacket, barcode and
 * all, which archive.org scans often are). A picture that passes is kept
 * under docs/cockpit/pins/ as `<id>-prod.jpg` — JPEG, no taller than
 * 3000 px — where the Cockpit looks and the upload takes it from, so Julian
 * sees it without another fetch. A Google cover has no original and is
 * skipped.
 *
 * Boards in works mode: a printing in another language goes to „<Language>
 * book covers"; a paperback of 1979 or earlier to „Vintage paperback
 * covers"; otherwise the work's genre board from GENRE_BOARDS, or „Book
 * cover design". The board is a proposal, the note says so.
 *
 * Open Library is asked one work at a time, ten seconds between works, two
 * seconds between a collection's picks and a second between images (umgang
 * §1: this address was refused after bursts; the script stops at the first
 * refused connection and keeps what came). A pin that is already in the
 * queue is never touched; a cover that already is a pin is not offered
 * again.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { collectionRecords } from '../lib/collections';
import { indexSignatures } from '../lib/coverindex';
import { pickCoverPins, PLAIN_SHARE, plainShare, recordDoubts, type CoverPinCandidate, type Doubt } from '../lib/coverpins';
import { signature } from '../lib/imagehash';
import { looksLikeScannedPage } from '../lib/imagesig';
import { languageName } from '../lib/normalize';
import { coverPin, originalCoverUrl, PIN_DESCRIPTION_MAX, PIN_TITLE_MAX } from '../lib/pins';
import { authorLine } from '../lib/seo';
import { fetchBytes, fetchJson } from '../lib/sources/http';
import { getWorkDetail, MAX_EDITIONS_SCANNED } from '../lib/work';
import { foldDuplicateCovers } from '../lib/works';
import { kindOf, readQueue, withKinds, writeQueue, type QueuedPin } from './cockpit/pins';

const LIVE = 'https://buyitscovers.com';
const WORK_PAUSE_MS = 10_000;
const PICK_PAUSE_MS = 2_000;
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

/** Open Library's language keys to the site's ISO 639-1 codes, as far as a pin needs them. */
const OL_LANGUAGES: Record<string, string> = {
  eng: 'en', ger: 'de', fre: 'fr', spa: 'es', ita: 'it', por: 'pt', dut: 'nl', swe: 'sv', dan: 'da', nor: 'no',
  fin: 'fi', pol: 'pl', cze: 'cs', hun: 'hu', tur: 'tr', rus: 'ru', jpn: 'ja', chi: 'zh', gre: 'el', cat: 'ca',
};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (name: string) => process.argv.includes(name);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const refused = (message: string) => /fetch failed|ECONNREFUSED|ECONNRESET/.test(message);

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

/** What a draft is made from, whichever source named the cover. */
interface Candidate {
  workId: string;
  coverId: string;
  title: string;
  editionTitle?: string;
  author: string;
  board: string;
  what: string;
  year?: number;
  publisher?: string;
  language?: string;
  artist?: string;
  artistSource?: string;
  covers?: number;
  /** How many records carry the image, when known. */
  carriers?: number;
  doubts: Doubt[];
  /** Why it is a candidate, in German, for the note. */
  why: string;
  /** More for the note, after the doubts. */
  extra?: string;
}

interface Run {
  origin: string;
  minWidth: number;
  dry: boolean;
  picturesDir: string;
  ids: Set<string>;
  nextSlot: () => string;
  added: QueuedPin[];
  lines: string[];
}

/** Fetches and measures the picture, builds the words, and queues the draft; says on stderr why a candidate was passed over. */
async function draft(c: Candidate, run: Run): Promise<boolean> {
  if (!c.coverId.startsWith('ol:')) { process.stderr.write(`  ${c.coverId}: a Google cover, no original scan\n`); return false; }
  await sleep(IMAGE_PAUSE_MS);
  let m: Measured | null = null;
  try {
    m = await measure(c.coverId);
  } catch (err) {
    process.stderr.write(`  ${c.coverId}: ${(err as Error).message}\n`);
    return false;
  }
  if (!m) { process.stderr.write(`  ${c.coverId}: not an image\n`); return false; }
  if (m.width < run.minWidth) { process.stderr.write(`  ${c.coverId}: ${m.width} px wide, under ${run.minWidth}\n`); return false; }
  if (m.plain >= PLAIN_SHARE) { process.stderr.write(`  ${c.coverId}: ${Math.round(m.plain * 100)} % one colour — a binding without its jacket\n`); return false; }
  if (looksLikeScannedPage(signature(m.bytes) ?? undefined)) { process.stderr.write(`  ${c.coverId}: looks like a scanned page\n`); return false; }
  const id = `cover-${c.workId}-${c.coverId.replace(':', '')}`;
  if (run.ids.has(id)) { process.stderr.write(`  ${id}: already in the queue\n`); return false; }
  const pin = coverPin({
    workId: c.workId, coverId: c.coverId, title: c.title, editionTitle: c.editionTitle, author: c.author, board: c.board, what: c.what,
    year: c.year, publisher: c.publisher, language: c.language, artist: c.artist, artistSource: c.artistSource, covers: c.covers,
  }, run.origin);
  if (pin.title.length > PIN_TITLE_MAX || pin.description.length > PIN_DESCRIPTION_MAX) throw new Error(`${id}: title ${pin.title.length} / description ${pin.description.length} characters — past Pinterest's limit`);
  const doubt = c.doubts.length > 0 ? ` VERDACHT: ${c.doubts.map(d => DOUBTS[d]).join('; ')}.` : '';
  const plain = m.plain >= 0.6 ? ` Das Bild ist zu ${Math.round(m.plain * 100)} % eine Farbe — vielleicht ein Einband ohne Umschlag.` : '';
  const carriers = c.carriers === undefined ? '' : ` (${c.carriers} ${c.carriers === 1 ? 'Eintrag trägt' : 'Einträge tragen'} es)`;
  const note = `${c.why} Jahr und Verlag sind die des frühesten widerspruchsfreien Katalogeintrags mit diesem Bild${carriers} — Bild ansehen, ob es dazu passt.${doubt}${c.extra ? ` ${c.extra}` : ''}${plain} Scan ${m.width} × ${m.height} px, Open Librarys Original (die Seite zeigt höchstens 500 px). Pinnwand ist ein Vorschlag.`;
  const queued: QueuedPin = {
    id, kind: 'cover', status: 'entwurf', slot: run.nextSlot(), board: c.board,
    picture: pin.picture, title: pin.title, description: pin.description, alt: pin.alt, link: pin.link, note,
  };
  if (!run.dry) {
    mkdirSync(run.picturesDir, { recursive: true });
    writeFileSync(path.join(run.picturesDir, `${id}-prod.jpg`), await asPinFile(m));
  }
  run.added.push(queued);
  run.ids.add(id);
  run.lines.push(`${id} | ${c.board} | ${pin.title} | ${m.width} × ${m.height}`);
  return true;
}

/** Works mode: old or foreign printings of each work, up to `perWork` each. */
async function fromWorks(works: string[], run: Run, perWork: number, maxYear: number, exclude: Set<string>): Promise<void> {
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
      if (refused(message)) { process.stderr.write('Open Library refuses this address — stopping here with what came; run again later\n'); break; }
      continue;
    }
    if (!detail) { process.stderr.write('not found\n'); continue; }
    if (!detail.complete) { process.stderr.write('Open Library stopped answering part of the way — skipped, run again later\n'); continue; }
    const signatures = indexSignatures(detail.covers.map(c => c.id));
    const folded = foldDuplicateCovers(detail.covers, signatures, detail.editions);
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
      if (designs.has(design(c.cover.id))) { process.stderr.write(`  ${c.cover.id}: the same design as a pin above\n`); continue; }
      const board = boardFor(workId, c);
      const why = `Einzel-Cover-Testlinie (${c.reasons.map(r => (r === 'old' ? `Druck von ${c.year}` : `${languageName(c.language, 'de')}, nicht Englisch`)).join('; ')}).`;
      const ok = await draft({
        workId, coverId: c.cover.id, title: detail.work.title, editionTitle: c.edition?.title, author: authorLine(detail.work.authors),
        board, what: whatOf(board), year: c.year, publisher: c.publisher, language: c.language, covers: folded.length, carriers: c.carriers, doubts: c.doubts, why,
      }, run);
      if (ok) { designs.add(design(c.cover.id)); got++; }
    }
  }
}

/** The record behind a scan: the cover's `.json` names the edition, the edition names publisher, date, ISBNs and language. */
interface OlCoverRecord { olid?: string }
interface OlEditionRecord { title?: string; publish_date?: string; publishers?: string[]; isbn_10?: string[]; isbn_13?: string[]; languages?: Array<{ key?: string }> }

async function recordBehind(coverId: string): Promise<{ olid: string; edition: OlEditionRecord } | null> {
  const n = coverId.slice(3);
  const cover = await fetchJson<OlCoverRecord>(`https://covers.openlibrary.org/b/id/${n}.json`, { timeoutMs: 15_000, revalidate: 0 });
  if (!cover.olid) return null;
  const edition = await fetchJson<OlEditionRecord>(`https://openlibrary.org/books/${cover.olid}.json`, { timeoutMs: 15_000, revalidate: 0 });
  return { olid: cover.olid, edition };
}

/** Collection mode: every pick of the collection, one pin per cover, all on the one board. */
async function fromCollection(slug: string, run: Run, exclude: Set<string>, max: number): Promise<void> {
  const record = collectionRecords().find(c => c.slug === slug);
  if (!record) throw new Error(`no collection ${slug} in data/collections.json`);
  const board = arg('--board', '');
  if (!board) throw new Error('--board "<name>" is required with --collection');
  const what = arg('--what', whatOf(board));
  const artist = arg('--artist', '') || undefined;
  const artistSource = arg('--artist-source', '') || undefined;
  const houses = (record.publishers ?? []).map(p => p.toLowerCase());
  // `--years 1963-1979`: the span the series was printed in; a record dated outside it is doubted in the note.
  const span = /^(\d{4})-(\d{4})$/.exec(arg('--years', ''));
  const years = span ? [Number(span[1]), Number(span[2])] as const : undefined;
  process.stderr.write(`${record.title}: ${record.works.length} picks, ${record.published ? 'published' : 'a draft'}\n`);
  let got = 0;
  for (const [i, pick] of record.works.entries()) {
    if (got >= max) break;
    if (i > 0) await sleep(PICK_PAUSE_MS);
    if (exclude.has(pick.coverId)) { process.stderr.write(`  ${pick.coverId}: already a pin\n`); continue; }
    process.stderr.write(`${pick.id} ${pick.title} … `);
    let behind: Awaited<ReturnType<typeof recordBehind>> = null;
    try {
      behind = await recordBehind(pick.coverId);
    } catch (err) {
      const message = (err as Error).message;
      process.stderr.write(`${message}\n`);
      if (refused(message)) { process.stderr.write('Open Library refuses this address — stopping here with what came; run again later\n'); break; }
    }
    const e = behind?.edition;
    const year = e?.publish_date ? Number(/\d{4}/.exec(e.publish_date)?.[0]) || undefined : undefined;
    // A record typed in lower case („fontana books") is set in title case; anything with a capital stays as the record has it.
    const raw = e?.publishers?.[0]?.trim() || undefined;
    const publisher = raw && raw === raw.toLowerCase() ? raw.replace(/(^|[\s/-])\p{L}/gu, ch => ch.toUpperCase()) : raw;
    const langKey = e?.languages?.[0]?.key?.split('/').pop();
    const language = langKey ? OL_LANGUAGES[langKey] : undefined;
    const doubts = e ? recordDoubts({ year, isbn10: e.isbn_10?.[0], isbn13: e.isbn_13?.[0] }, pick.firstPublished) : [];
    const foreignHouse = publisher && houses.length > 0 && !houses.some(h => publisher.toLowerCase().includes(h));
    const outsideYears = year && years && (year < years[0] || year > years[1]);
    const extra = [
      behind ? `Datensatz ${behind.olid}.` : 'Kein Datensatz hinter dem Scan gelesen — Verlag und Jahr fehlen.',
      foreignHouse ? `VERDACHT: der Datensatz nennt „${publisher}“, die Sammlung ${record.publishers!.join(', ')} — das Bild kann trotzdem der Fontana-Druck sein, oder der Eintrag ist ein anderer.` : '',
      outsideYears ? `VERDACHT: ${year} liegt außerhalb der Jahre der Reihe (${years![0]}–${years![1]}) — der Eintrag ist wohl ein anderer Druck als das Bild.` : '',
      pick.from ? `Quelle der Sammlung: ${pick.from}.` : '',
    ].filter(Boolean).join(' ');
    process.stderr.write(`${publisher ?? '?'} ${year ?? '?'}\n`);
    const ok = await draft({
      workId: pick.id, coverId: pick.coverId, title: pick.title, editionTitle: e?.title, author: pick.author, board, what,
      year, publisher, language, artist, artistSource, carriers: behind ? 1 : undefined, doubts,
      why: `Einzel-Cover-Testlinie, Pinnwand nur aus der Sammlung „${record.title}“ (Julian, 2026-11-04).`, extra,
    }, run);
    if (ok) got++;
  }
}

async function main(): Promise<void> {
  const root = process.cwd();
  const works = arg('--works', '').split(',').map(s => s.trim()).filter(Boolean);
  const collection = arg('--collection', '');
  if (works.length === 0 && !collection) throw new Error('--works OL…W,OL…W or --collection <slug> is required');
  const perWork = Number(arg('--per-work', '2'));
  const maxYear = Number(arg('--max-year', '1990'));
  const max = Number(arg('--max', '200'));
  const origin = arg('--origin', LIVE);
  const today = new Date().toISOString().slice(0, 10);
  const dry = has('--dry');

  const queue = withKinds(readQueue(root) ?? { updated: today, pins: [] });
  const exclude = pinnedCovers(queue.pins);
  const run: Run = {
    origin,
    minWidth: Number(arg('--min-width', '500')),
    dry,
    picturesDir: path.join(root, 'docs', 'cockpit', 'pins'),
    ids: new Set(queue.pins.map(p => p.id)),
    nextSlot: slotsFrom(arg('--from', today), new Set(queue.pins.map(p => p.slot).filter((s): s is string => !!s))),
    added: [],
    lines: [],
  };

  if (works.length > 0) await fromWorks(works, run, perWork, maxYear, exclude);
  if (collection) await fromCollection(collection, run, exclude, max);

  if (run.added.length === 0) { console.log('nothing to add'); return; }
  if (!dry) writeQueue(root, { updated: today, pins: [...queue.pins, ...run.added] });
  console.log(run.lines.join('\n'));
  console.log(`${run.added.length} cover pins ${dry ? 'would go' : 'went'} into docs/pins/queue.json`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
