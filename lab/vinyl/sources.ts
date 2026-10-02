/**
 * Network for the local MVP (ROADMAP 5.16a): MusicBrainz, the Cover Art
 * Archive and image bytes, each answer kept on disk under `out/mvp-cache/`
 * (git-ignored), so a second visit asks nothing it asked before.
 *
 * MusicBrainz allows one request a second per client and asks for a
 * User-Agent that names the application; every MusicBrainz call goes through
 * one queue. The Cover Art Archive names no limit, but it redirects to
 * archive.org, which drops a request now and then (measured 2026-09-29: one
 * or two images per run) — so a few at a time, with retries, and a failure is
 * reported as a failure, never cached as "nothing there".
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const UA = 'beautifulbooks-lab/0.1 ( https://beautifulcovers.vercel.app )';
export const MB = 'https://musicbrainz.org/ws/2';

export type Fetch = typeof fetch;

/** A failed lookup, kept apart from an empty answer. */
export class SourceError extends Error {
  constructor(readonly source: 'musicbrainz' | 'coverartarchive' | 'image' | 'wikipedia', message: string) { super(message); }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface SourceOptions { cacheDir: string; fetch?: Fetch; mbGapMs?: number; retryMs?: number }

export function createSources({ cacheDir, fetch: f = fetch, mbGapMs = 1100, retryMs = 2000 }: SourceOptions) {
  const jsonDir = join(cacheDir, 'json');
  const imgDir = join(cacheDir, 'img');
  mkdirSync(jsonDir, { recursive: true });
  mkdirSync(imgDir, { recursive: true });
  const key = (url: string) => createHash('sha1').update(url).digest('hex');

  let mbChain: Promise<unknown> = Promise.resolve();
  let mbLast = 0;
  /** Runs `task` after every earlier MusicBrainz request, at least `mbGapMs` after the last one started. */
  function mbTurn<T>(task: () => Promise<T>): Promise<T> {
    const run = mbChain.then(async () => {
      const wait = mbLast + mbGapMs - Date.now();
      if (wait > 0) await sleep(wait);
      mbLast = Date.now();
      return task();
    });
    mbChain = run.catch(() => undefined);
    return run;
  }

  /** JSON from disk or the network. 404 is an answer (null) and is cached; anything else failing throws. */
  async function json<T>(url: string, source: 'musicbrainz' | 'coverartarchive', tries = 3): Promise<T | null> {
    const file = join(jsonDir, `${key(url)}.json`);
    if (existsSync(file)) return (JSON.parse(readFileSync(file, 'utf8')) as { body: T | null }).body;
    let last = '';
    for (let attempt = 0; attempt < tries; attempt++) {
      if (attempt) await sleep(retryMs * attempt);
      try {
        const go = () => f(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
        const res = source === 'musicbrainz' ? await mbTurn(go) : await go();
        if (res.status === 404) { writeFileSync(file, JSON.stringify({ url, body: null })); return null; }
        if (!res.ok) { last = `HTTP ${res.status}`; continue; }
        const body = (await res.json()) as T;
        writeFileSync(file, JSON.stringify({ url, body }));
        return body;
      } catch (e) { last = e instanceof Error ? e.message : String(e); }
    }
    throw new SourceError(source, `${url}: ${last}`);
  }

  /** Image bytes from disk or the network; null when the archive has no such image, throws when it failed. */
  async function image(url: string, tries = 3): Promise<Uint8Array | null> {
    const file = join(imgDir, key(url));
    if (existsSync(file)) return new Uint8Array(readFileSync(file));
    let last = '';
    for (let attempt = 0; attempt < tries; attempt++) {
      if (attempt) await sleep(retryMs * attempt);
      try {
        const res = await f(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
        if (res.status === 404) return null;
        if (!res.ok) { last = `HTTP ${res.status}`; continue; }
        const bytes = new Uint8Array(await res.arrayBuffer());
        writeFileSync(file, bytes);
        return bytes;
      } catch (e) { last = e instanceof Error ? e.message : String(e); }
    }
    throw new SourceError('image', `${url}: ${last}`);
  }

  /** The local file name an image was cached under, for serving it from disk. */
  const imageFile = (url: string) => key(url);

  return { json, image, imageFile, imgDir };
}

export type Sources = ReturnType<typeof createSources>;

/** Run `f` over `items`, at most `n` at a time. */
export async function pool<T>(items: T[], n: number, f: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await f(items[next++]);
  }));
}
