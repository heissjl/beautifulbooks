/**
 * Perceptual signatures for covers (SPEC §2.3 phase 2, §8.5). Server-side.
 *
 * Fetches the small image of each cover with bounded concurrency and a
 * global deadline, then hashes it. Image responses live in the Next data
 * cache, so a page that misses the deadline on first load converges to a
 * fully folded gallery on later requests without extra infrastructure.
 */
import { debug } from './debug';
import { signature, type ImageSignature } from './imagehash';
import type { Cover } from './model';
import { fetchBytes } from './sources/http';

export interface HashOptions {
  /** Stop starting new fetches after this many milliseconds. */
  deadlineMs?: number;
  /** Per-image fetch timeout. */
  timeoutMs?: number;
  concurrency?: number;
}

const IMAGE_REVALIDATE = 30 * 24 * 60 * 60;

/** In-process memo so repeated requests in one server instance skip decoding. */
const memo = new Map<string, ImageSignature | null>();

export async function signatureFor(cover: Pick<Cover, 'id' | 'url' | 'urlSmall'>, timeoutMs: number): Promise<ImageSignature | null> {
  const cached = memo.get(cover.id);
  if (cached !== undefined) return cached;
  try {
    const bytes = await fetchBytes(cover.urlSmall ?? cover.url, { timeoutMs, revalidate: IMAGE_REVALIDATE });
    const sig = signature(bytes);
    memo.set(cover.id, sig);
    return sig;
  } catch (err) {
    debug('coverhash', `${cover.id} failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Signatures for as many covers as the budget allows. Never throws; covers
 * that could not be hashed in time are simply absent from the result.
 */
export async function hashCovers(
  covers: readonly Cover[],
  { deadlineMs = 4000, timeoutMs = 3000, concurrency = 8 }: HashOptions = {},
): Promise<Map<string, ImageSignature>> {
  const out = new Map<string, ImageSignature>();
  const started = Date.now();
  const queue = [...covers];

  const worker = async () => {
    while (queue.length > 0 && Date.now() - started < deadlineMs) {
      const cover = queue.shift()!;
      const sig = await signatureFor(cover, timeoutMs);
      if (sig) out.set(cover.id, sig);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, covers.length) }, worker));
  debug('coverhash', `${out.size}/${covers.length} hashed in ${Date.now() - started}ms`);
  return out;
}
