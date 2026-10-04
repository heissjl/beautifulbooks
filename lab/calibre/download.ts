/**
 * A cover's image, fetched once per run and checked (lab/calibre, ROADMAP 5.16).
 *
 * The address is rebuilt from the cover id (`imageUrls`), two downloads run
 * at a time, and only image files are asked for — never the Google Books API
 * (lab rule 6). A failed download is not remembered: the next look tries again.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { userAgent } from './site';
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
 * How large a cover's image is, without keeping the image (ROADMAP 5.16a;
 * Julian, 2026-10-03: „sort the images that are big enough to use as covers
 * the front"). Open Library does not say how large a scan is until it is
 * fetched, so the picker asks for every cover of the open work — by cover id,
 * which Open Library does not rate-limit — reads the size out of the file
 * header and forgets the bytes. Sizes are kept in a file beside the backups:
 * a cover id never changes its image, so a work opened twice asks nothing.
 */
export type CoverSize = { width: number; height: number };

export class CoverSizes {
  private readonly known: Record<string, CoverSize>;
  private readonly asking = new Map<string, Promise<CoverSize | null>>();
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private dirty: NodeJS.Timeout | null = null;

  constructor(private readonly file: string, private readonly site: string, private readonly atOnce = 4) {
    this.known = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, CoverSize>) : {};
  }

  /** What is already known, without asking. */
  peek(coverId: string): CoverSize | undefined {
    return this.known[coverId];
  }

  remember(coverId: string, size: CoverSize): void {
    if (this.known[coverId]) return;
    this.known[coverId] = { width: size.width, height: size.height };
    // Written a moment later, once for a burst of answers.
    this.dirty ??= setTimeout(() => {
      this.dirty = null;
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(`${this.file}.tmp`, JSON.stringify(this.known));
      renameSync(`${this.file}.tmp`, this.file);
    }, 1500);
  }

  /** The size, or null when the source did not answer or sent no image — which is not remembered. */
  get(coverId: string): Promise<CoverSize | null> {
    const have = this.known[coverId];
    if (have) return Promise.resolve(have);
    let p = this.asking.get(coverId);
    if (!p) {
      p = this.ask(coverId).finally(() => this.asking.delete(coverId));
      this.asking.set(coverId, p);
    }
    return p;
  }

  private async ask(coverId: string): Promise<CoverSize | null> {
    if (this.active >= this.atOnce) await new Promise<void>((go) => this.waiting.push(go));
    this.active++;
    try {
      for (const url of imageUrls(coverId)) {
        try {
          const res = await fetch(url, { headers: { 'user-agent': userAgent(this.site) }, signal: AbortSignal.timeout(45_000) });
          if (!res.ok) continue;
          const size = imageSizeFast(Buffer.from(await res.arrayBuffer()));
          if (size) {
            this.remember(coverId, size);
            return size;
          }
        } catch {
          // Not answered: try the next address, and leave the size unknown rather than guess.
        }
      }
      return null;
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}
