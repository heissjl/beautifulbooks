/**
 * A cover's image, fetched once per run and checked (lab/calibre, ROADMAP 5.16).
 *
 * The address is rebuilt from the cover id (`imageUrls`), two downloads run
 * at a time, and only image files are asked for — never the Google Books API
 * (lab rule 6). A failed download is not remembered: the next look tries again.
 */
import { userAgent } from '../../lib/seo';
import { checkCover, type CoverCheck } from './image';
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
