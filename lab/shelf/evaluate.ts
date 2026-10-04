/**
 * The shelf photo test set (ROADMAP 5.11a): every photo under docs/tests/
 * named in testset/truth.json goes through the very function the website
 * uses (lib/walls/readphoto.ts), and what comes back is held against the
 * list of what a person can read on the photo.
 *
 *   set -a; source ../../../.env.local; set +a          # ANTHROPIC_API_KEY, from the main folder
 *   npx tsx lab/shelf/evaluate.ts                        # all photos
 *   npx tsx lab/shelf/evaluate.ts --only 02,08 --label "point prompt"
 *
 * It calls the model (about 1.5 ct a photo, 6–9 ct for a dense one) and no
 * catalogue. The photos are Julian's and stay local (git-ignored); the truth
 * lists and the results are text and are committed, so a change to the
 * prompt, the threshold or the cutting can be compared with the run before.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { costUsd } from '../../lib/insights/prices';
import { preparePhoto } from '../../lib/photoprep';
import type { RecognizedBook } from '../../lib/recognize';
import { sameBook, wordsOf } from '../../lib/walls/dense';
import { readPhoto } from '../../lib/walls/readphoto';

interface TruthPhoto {
  file: string;
  what: string;
  /** true: the list is everything readable, a further reading is a mistake. false: a lower bound. */
  complete: boolean;
  books: [string, string][];
  optional: [string, string][];
}

export interface PhotoScore {
  file: string;
  what: string;
  complete: boolean;
  truth: number;
  read: number;
  /** Truth books that were read. */
  hit: number;
  /** Of those with an author on the photo, how many came back with that author. */
  authorOnPhoto: number;
  authorRead: number;
  /** Readings that are no book of the truth list or the optional list. */
  extra: number;
  missed: string[];
  extras: string[];
  pieces: number;
  ms: number;
  tokensIn: number;
  tokensOut: number;
  cents: number;
}

const asBook = ([title, author]: [string, string]): RecognizedBook => ({ title, author, kind: 'spine' });

/**
 * Whether a reading is this book of the truth list. Kinder than `sameBook`,
 * which keeps "Picasso" and "Picasso and Françoise Gilot" apart on one shelf:
 * here the list is known, so a one-word title counts when the reading
 * contains it ("Babel" in "Babel: An Arcane History").
 */
export function isTruth(truth: RecognizedBook, read: RecognizedBook): boolean {
  if (sameBook(truth, read)) return true;
  const want = wordsOf(truth.title);
  const have = new Set(wordsOf(`${read.title} ${read.author}`));
  return want.length > 0 && want.every((w) => have.has(w));
}

/** The author's last word, as it would be printed on a spine. */
const surname = (author: string) => wordsOf(author).pop() ?? '';

export function score(photo: TruthPhoto, reads: readonly RecognizedBook[]): Pick<PhotoScore, 'truth' | 'read' | 'hit' | 'authorOnPhoto' | 'authorRead' | 'extra' | 'missed' | 'extras'> {
  const truth = photo.books.map(asBook);
  const optional = photo.optional.map(asBook);
  const missed: string[] = [];
  let hit = 0;
  let authorOnPhoto = 0;
  let authorRead = 0;
  for (const t of truth) {
    const found = reads.filter((r) => isTruth(t, r));
    if (found.length === 0) {
      missed.push(t.author ? `${t.title} — ${t.author}` : t.title);
      continue;
    }
    hit++;
    if (t.author) {
      authorOnPhoto++;
      const name = surname(t.author);
      if (found.some((r) => wordsOf(`${r.author} ${r.title}`).includes(name))) authorRead++;
    }
  }
  const extras = reads.filter((r) => !truth.some((t) => isTruth(t, r)) && !optional.some((t) => isTruth(t, r))).map((r) => (r.author ? `${r.title} — ${r.author}` : r.title));
  return { truth: truth.length, read: reads.length, hit, authorOnPhoto, authorRead, extra: extras.length, missed, extras };
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const only = arg('only')?.split(',').map((n) => n.padStart(2, '0'));
  const label = arg('label') ?? '';
  const truth = JSON.parse(readFileSync(join(here, 'testset', 'truth.json'), 'utf8')) as { photos: TruthPhoto[] };
  const photos = truth.photos.filter((p) => !only || only.some((n) => p.file.includes(`-${n}.`)));

  const scores: PhotoScore[] = [];
  for (const photo of photos) {
    const path = join(root, 'docs', 'tests', photo.file);
    if (!existsSync(path)) {
      console.error(`${photo.file}: not here (the photos are local, see testset/truth.json)`);
      continue;
    }
    const prepared = preparePhoto(readFileSync(path));
    if (!prepared) {
      console.error(`${photo.file}: could not be opened`);
      continue;
    }
    try {
      const reading = await readPhoto(prepared);
      const s = score(photo, reading.books);
      // List price of the model that read it (lib/insights/prices.ts); 0 for a model the table does not know.
      const cents = Math.round((costUsd(reading.model, reading.tokensIn, reading.tokensOut) ?? 0) * 1000) / 10;
      scores.push({ file: photo.file, what: photo.what, complete: photo.complete, ...s, pieces: reading.pieces, ms: reading.msModel, tokensIn: reading.tokensIn, tokensOut: reading.tokensOut, cents });
      console.error(`${photo.file}: ${s.hit}/${s.truth} read, ${s.extra} beyond the list, ${reading.pieces} pieces, ${(reading.msModel / 1000).toFixed(1)} s, ${cents} ct`);
    } catch (err) {
      console.error(`${photo.file}: the model did not answer (${err instanceof Error ? err.message.slice(0, 120) : 'unknown'})`);
    }
  }

  const sum = (f: (s: PhotoScore) => number) => scores.reduce((n, s) => n + f(s), 0);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '–');
  const lines = [
    '| Foto | Was | gelesen von Liste | mit Autor | darüber hinaus | Teile | Zeit | Kosten |',
    '|---|---|---|---|---|---|---|---|',
    ...scores.map((s) => `| ${s.file.replace('regalfoto-set-', '').replace('.jpg', '')} | ${s.what} | ${s.hit} / ${s.truth} (${pct(s.hit, s.truth)}) | ${s.authorRead} / ${s.authorOnPhoto} | ${s.extra}${s.complete ? ' (Fehler)' : ' (ungeprüft)'} | ${s.pieces || '–'} | ${(s.ms / 1000).toFixed(1)} s | ${s.cents} ct |`),
    `| **alle** | ${scores.length} Fotos | **${sum((s) => s.hit)} / ${sum((s) => s.truth)} (${pct(sum((s) => s.hit), sum((s) => s.truth))})** | ${sum((s) => s.authorRead)} / ${sum((s) => s.authorOnPhoto)} | ${sum((s) => (s.complete ? s.extra : 0))} Fehler auf vollzähligen Fotos | | ${(sum((s) => s.ms) / 1000).toFixed(0)} s | ${sum((s) => s.cents).toFixed(1)} ct |`,
  ];
  console.log(lines.join('\n'));

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const dir = join(here, 'testset', 'results');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${stamp}${label ? `-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` : ''}.json`);
  writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), label, scores }, null, 1));
  console.error(`written: ${out}`);
}

// Only when run as a script; the tests import `score` and `isTruth`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
