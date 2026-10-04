/**
 * A prepared photo → the books on it (ROADMAP 5.11a). Server only: it calls
 * the model. The photo route streams what this reports; the shelf lab's
 * test set (lab/shelf/evaluate.ts) runs the very same function, so a number
 * measured there is a number about the site.
 *
 * One read, and for a dense photo a second: the first read stops at
 * DENSE_AT books, the shelves are found in the picture, and every shelf is
 * read again in pieces cut from the full-size photo (lib/walls/dense.ts).
 */
import { crop, shrink, toJpeg, type PreparedPhoto } from '@/lib/photoprep';
import { recognize, type RecognizedBook } from '@/lib/recognize';
import { shelvesOf } from '@/lib/shelfrows';
import { DENSE_AT, inWhole, mergeReads, piecesOf } from './dense';

export interface PhotoReading {
  /** Every book read, each once, uncapped. */
  books: RecognizedBook[];
  model: string;
  /** Time spent with the model, both looks. */
  msModel: number;
  tokensIn: number;
  tokensOut: number;
  /** Entries the parser repaired or dropped. */
  problems: number;
  /** Pieces of the second look; 0 when one look was enough. */
  pieces: number;
  piecesFailed: number;
}

export interface ReadHooks {
  /** A book of the first look, the moment the model has written it. */
  onBook?: (book: RecognizedBook, index: number) => void;
  /** The second look began (`done` 0) or one more of its pieces is back. */
  onAgain?: (pieces: number, done: number) => void;
}

/** Throws when the model does not answer the first look; a piece that fails is counted and left out. */
export async function readPhoto(prepared: PreparedPhoto, hooks: ReadHooks = {}): Promise<PhotoReading> {
  const started = Date.now();
  const first = await recognize(prepared.bytes, 'image/jpeg', hooks.onBook, DENSE_AT);
  const reading: PhotoReading = {
    books: first.books,
    model: first.model,
    msModel: first.ms,
    tokensIn: first.inputTokens,
    tokensOut: first.outputTokens,
    problems: first.problems.length,
    pieces: 0,
    piecesFailed: 0,
  };
  if (!first.stopped) return reading;

  const cut = piecesOf(prepared.full.width, prepared.full.height, shelvesOf(prepared.full));
  reading.pieces = cut.length;
  hooks.onAgain?.(cut.length, 0);
  let done = 0;
  const runs = await Promise.allSettled(
    cut.map(async (piece) => {
      const r = await recognize(toJpeg(shrink(crop(prepared.full, ...piece))), 'image/jpeg');
      hooks.onAgain?.(cut.length, ++done);
      return { ...r, books: r.books.map((b) => inWhole(b, piece)) };
    }),
  );
  const read = runs.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  reading.piecesFailed = cut.length - read.length;
  reading.books = mergeReads(first.books, read.flatMap((r) => r.books));
  reading.msModel = Date.now() - started;
  reading.tokensIn += read.reduce((n, r) => n + r.inputTokens, 0);
  reading.tokensOut += read.reduce((n, r) => n + r.outputTokens, 0);
  reading.problems += read.reduce((n, r) => n + r.problems.length, 0);
  return reading;
}
