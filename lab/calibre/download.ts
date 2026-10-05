/**
 * A cover's image, fetched once per run and checked (lab/calibre, ROADMAP 5.16).
 *
 * The address is rebuilt from the cover id (`imageUrls`), two downloads run
 * at a time, and only image files are asked for — never the Google Books API
 * (lab rule 6). A failed download is not remembered: the next look tries again.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { signature, userAgent } from './site';
import { checkCover, imageSizeFast, type CoverCheck } from './image';
import { imageUrls } from './source';

export interface Fetched {
  check: CoverCheck;
  bytes?: Buffer;
}

export class CoverDownloads {
  private readonly done = new Map<string, Promise<Fetched>>();
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly site: string, private readonly atOnce = 2) {}

  get(coverId: string): Promise<Fetched> {
    let p = this.done.get(coverId);
    if (!p) {
      p = this.download(coverId).then((f) => {
        if (!f.check.ok) this.done.delete(coverId);
        return f;
      });
      this.done.set(coverId, p);
    }
    return p;
  }

  private async download(coverId: string): Promise<Fetched> {
    if (this.active >= this.atOnce) await new Promise<void>((go) => this.waiting.push(go));
    this.active++;
    try {
      let last = 'No address for this cover.';
      for (const url of imageUrls(coverId)) {
        try {
          const res = await fetch(url, { headers: { 'user-agent': userAgent(this.site) }, signal: AbortSignal.timeout(45_000) });
          if (!res.ok) {
            last = `The image source answered ${res.status}.`;
            continue;
          }
          const bytes = Buffer.from(await res.arrayBuffer());
          const check = checkCover(bytes);
          if (check.ok) return { check, bytes };
          last = check.reason;
        } catch {
          // A source that did not answer is not "no cover" (SPEC N12).
          last = 'The image source did not answer in time. Try again.';
        }
      }
      return { check: { ok: false, reason: last } };
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

/**
 * One fact per cover, read out of its image and kept in a file beside the
 * backups: a cover id never changes its image, so nothing is asked twice —
 * not in the next run either. The image host is asked by cover id, which
 * Open Library does not rate-limit; a few at a time all the same. A fact that
 * could not be read is not remembered: the next look tries again.
 */
class CoverFacts<T> {
  private readonly known: Record<string, T>;
  private readonly asking = new Map<string, Promise<T | null>>();
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private dirty: NodeJS.Timeout | null = null;

  constructor(
    private readonly file: string,
    private readonly site: string,
    private readonly atOnce: number,
    /** Where to ask, in order, and how to read each answer; the first that yields the fact wins. */
    private readonly sources: (coverId: string) => { url: string; read: (bytes: Buffer) => T | null }[],
  ) {
    this.known = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, T>) : {};
  }

  /** What is already known, without asking. */
  peek(coverId: string): T | undefined {
    return this.known[coverId];
  }

  remember(coverId: string, fact: T): void {
    if (this.known[coverId]) return;
    this.known[coverId] = fact;
    // Written a moment later, once for a burst of answers.
    this.dirty ??= setTimeout(() => {
      this.dirty = null;
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(`${this.file}.tmp`, JSON.stringify(this.known));
      renameSync(`${this.file}.tmp`, this.file);
    }, 1500);
  }

  /** The fact, or null when the source did not answer or sent no image — which is not remembered. */
  get(coverId: string): Promise<T | null> {
    const have = this.known[coverId];
    if (have) return Promise.resolve(have);
    let p = this.asking.get(coverId);
    if (!p) {
      p = this.ask(coverId).finally(() => this.asking.delete(coverId));
      this.asking.set(coverId, p);
    }
    return p;
  }

  private async ask(coverId: string): Promise<T | null> {
    if (this.active >= this.atOnce) await new Promise<void>((go) => this.waiting.push(go));
    this.active++;
    try {
      for (const { url, read } of this.sources(coverId)) {
        try {
          const res = await fetch(url, { headers: { 'user-agent': userAgent(this.site) }, signal: AbortSignal.timeout(45_000) });
          if (!res.ok) continue;
          const fact = read(Buffer.from(await res.arrayBuffer()));
          if (fact) {
            this.remember(coverId, fact);
            return fact;
          }
        } catch {
          // Not answered: try the next address, and leave the fact unknown rather than guess.
        }
      }
      return null;
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

/**
 * How large a cover's image is, without fetching the image (ROADMAP 5.16a;
 * Julian, 2026-10-03: „sort the images that are big enough to use as covers
 * the front").
 *
 * Open Library's cover host says so itself: `/b/id/<n>.json` is the cover's
 * record, with `width` and `height` of the scan as uploaded, answered in
 * about 0.08 s. Until 2026-10-04 the app fetched every original instead —
 * 4 to 10 s each from the Internet Archive's zip files, eighty of them for
 * one much-printed work — and those downloads crowded out the thumbnails and
 * the one full image Julian had clicked on („manchmal lädt es die cover nicht
 * oder zeigt sie zumindest nicht an"). Measured that day on 40 covers whose
 * size the app had read from the image: 39 records state the same size, one
 * states none. For that one, and for a Google image, the image itself is
 * still fetched and its header read.
 */
export type CoverSize = { width: number; height: number };

/** The size a cover record states, or null when it states none. */
export function sizeFromRecord(bytes: Buffer): CoverSize | null {
  try {
    const record = JSON.parse(bytes.toString('utf8')) as { width?: unknown; height?: unknown };
    const { width, height } = record;
    return typeof width === 'number' && typeof height === 'number' && Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  }
}

export class CoverSizes extends CoverFacts<CoverSize> {
  constructor(file: string, site: string, atOnce = 4) {
    super(file, site, atOnce, (coverId) => [
      ...(/^ol:\d{1,12}$/.test(coverId) ? [{ url: `https://covers.openlibrary.org/b/id/${coverId.slice(3)}.json`, read: sizeFromRecord }] : []),
      ...imageUrls(coverId).map((url) => ({ url, read: imageSizeFast })),
    ]);
  }

  remember(coverId: string, size: CoverSize): void {
    super.remember(coverId, { width: size.width, height: size.height });
  }
}

/**
 * What a cover looks like, as the site's fold sees it: the dHash of
 * `lib/imagehash.ts`, from the medium image the site hashes too. Two scans
 * of one design are told apart from two designs by this (`larger.ts`).
 * Open Library's scans only — a Google image has no second scan to compare with.
 */
export class CoverHashes extends CoverFacts<string> {
  constructor(file: string, site: string, atOnce = 6) {
    super(file, site, atOnce, (coverId) =>
      /^ol:\d{1,12}$/.test(coverId) ? [{ url: `https://covers.openlibrary.org/b/id/${coverId.slice(3)}-M.jpg?default=false`, read: (bytes: Buffer) => signature(bytes)?.hash ?? null }] : [],
    );
  }
}
