/**
 * A cover's image, fetched once per run and checked (lab/calibre, ROADMAP 5.16).
 *
 * The address is rebuilt from the cover id (`imageUrls`) and only image files
 * are asked for — never the Google Books API (lab rule 6). A failed download
 * is not remembered: the next look tries again.
 *
 * **The image Julian is waiting for goes first** (2026-10-04: „das ist sehr
 * langsam, kann man den download priorisieren?"). Measured that evening, in a
 * quiet moment, nothing in the app stood before a clicked cover: the request
 * left 11 ms after the click and a 3.2 MB original was checked 0.4 s later.
 * The wait is the image host's — the same day an original took 4 to 10 s. So
 * three things, none of which makes the host faster:
 *
 *  - `get` never stands in line. `warm` — the pointer rests on a tile — does:
 *    two at a time, three waiting at most, and a waiting one that is then
 *    clicked starts at once.
 *  - an address that has not answered within `SECOND_ASK_MS` is asked a second
 *    time and the first answer wins. The Internet Archive keeps two copies of
 *    each archive on different machines (seen in the redirects: ia800506 and
 *    ia600506 for the same zip), so the second ask may reach the other one.
 *  - every download is noted with its time (`DownloadNote`), so the next slow
 *    moment is a measurement and not a memory.
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

/** An address silent for this long is asked a second time. */
export const SECOND_ASK_MS = 2500;
/** Downloads ahead of a click: this many at once, this many waiting. */
const WARM_AT_ONCE = 2;
const WARM_WAITING = 3;

/** One download as it went: how long, and whether the second ask was needed and won. */
export interface DownloadNote {
  coverId: string;
  ms: number;
  ok: boolean;
  bytes?: number;
  /** Started ahead of a click. */
  warm?: true;
  /** The address was asked a second time; `won` says which answer was used. */
  second?: true;
  won?: 1 | 2;
}

export interface DownloadOptions {
  secondAskAfter?: number;
  fetch?: typeof fetch;
  note?: (n: DownloadNote) => void;
}

const NOT_FETCHED = 'Not fetched: other covers were pointed at since.';

export class CoverDownloads {
  private readonly done = new Map<string, Promise<Fetched>>();
  private active = 0;
  /** Warm downloads that have not started, oldest first; called with false they give up. */
  private readonly waiting = new Map<string, (run: boolean) => void>();
  private readonly secondAskAfter: number;
  private readonly fetch: typeof fetch;
  private readonly note: (n: DownloadNote) => void;

  constructor(private readonly site: string, options: DownloadOptions = {}) {
    this.secondAskAfter = options.secondAskAfter ?? SECOND_ASK_MS;
    this.fetch = options.fetch ?? fetch;
    this.note = options.note ?? (() => {});
  }

  /** The image someone is waiting for: started at once, whatever else is running. */
  get(coverId: string): Promise<Fetched> {
    // Asked for ahead and still in line: it starts now.
    if (this.waiting.has(coverId)) this.release(true, coverId);
    return this.start(coverId, false);
  }

  /** The image someone may click next: fetched when there is room, so the click finds it there. */
  warm(coverId: string): void {
    void this.start(coverId, true);
  }

  /** Lets a waiting download go — the oldest, unless one is named — or tells it to give up. */
  private release(run: boolean, coverId: string | undefined = this.waiting.keys().next().value): void {
    if (coverId === undefined) return;
    const go = this.waiting.get(coverId);
    this.waiting.delete(coverId);
    go?.(run);
  }

  private start(coverId: string, warm: boolean): Promise<Fetched> {
    let p = this.done.get(coverId);
    if (!p) {
      p = this.download(coverId, warm).then((f) => {
        if (!f.check.ok) this.done.delete(coverId);
        return f;
      });
      this.done.set(coverId, p);
    }
    return p;
  }

  private async download(coverId: string, warm: boolean): Promise<Fetched> {
    if (warm && this.active >= WARM_AT_ONCE) {
      // The pointer has moved on over more covers than are worth fetching: the oldest in line gives up.
      if (this.waiting.size >= WARM_WAITING) this.release(false);
      const run = await new Promise<boolean>((go) => this.waiting.set(coverId, go));
      if (!run) return { check: { ok: false, reason: NOT_FETCHED } };
    }
    this.active++;
    const t0 = Date.now();
    const asked: Pick<DownloadNote, 'second' | 'won'> = {};
    try {
      let last = 'No address for this cover.';
      for (const url of imageUrls(coverId)) {
        const got = await this.ask(url, asked);
        if (typeof got === 'string') {
          last = got;
          continue;
        }
        const check = checkCover(got);
        if (check.ok) {
          this.note({ coverId, ms: Date.now() - t0, ok: true, bytes: got.length, ...(warm ? { warm: true as const } : {}), ...asked });
          return { check, bytes: got };
        }
        last = check.reason;
      }
      this.note({ coverId, ms: Date.now() - t0, ok: false, ...(warm ? { warm: true as const } : {}), ...asked });
      return { check: { ok: false, reason: last } };
    } finally {
      this.active--;
      if (this.active < WARM_AT_ONCE) this.release(true);
    }
  }

  /** The bytes at an address, or why not. Asked a second time when the first ask is slow; whichever answers first is used. */
  private ask(url: string, asked: Pick<DownloadNote, 'second' | 'won'>): Promise<Buffer | string> {
    return new Promise((settle) => {
      const stop = new AbortController();
      let open = 0;
      let failure = '';
      let settled = false;
      const one = (n: 1 | 2): void => {
        open++;
        this.fetch(url, { headers: { 'user-agent': userAgent(this.site) }, signal: AbortSignal.any([stop.signal, AbortSignal.timeout(45_000)]) })
          .then(async (res) => (res.ok ? Buffer.from(await res.arrayBuffer()) : `The image source answered ${res.status}.`))
          // A source that did not answer is not "no cover" (SPEC N12).
          .catch(() => 'The image source did not answer in time. Try again.')
          .then((got) => {
            open--;
            if (settled) return;
            if (typeof got === 'string') {
              failure ||= got;
              // The other ask may still bring the image; only when nothing is on its way is this the answer.
              if (open > 0) return;
            } else if (asked.second) asked.won = n;
            settled = true;
            clearTimeout(second);
            stop.abort();
            settle(typeof got === 'string' ? failure : got);
          });
      };
      const second = setTimeout(() => {
        asked.second = true;
        one(2);
      }, this.secondAskAfter);
      one(1);
    });
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
