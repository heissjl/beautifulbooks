/**
 * Open Library access for this experiment: one request at a time, 0.7 s
 * apart, 40 s timeout, four tries (30 s, 60 s … after a 429), answers cached in `cache.json` beside
 * this file (git-ignored). A failure is thrown as `SourceFailed` and never
 * cached, so the caller can tell "not asked" from "nothing there".
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ForeignEdition } from './pick';

const CACHE_FILE = join(import.meta.dirname, 'cache.json');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const cache: Record<string, unknown> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};

export class SourceFailed extends Error {}

export async function get<T>(path: string): Promise<T | null> {
  if (path in cache) return cache[path] as T | null;
  let lastError = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://openlibrary.org${path}`, {
        signal: AbortSignal.timeout(40_000),
        headers: { 'user-agent': 'beautifulbooks-lab-international-covers' },
      });
      if (res.status === 404) {
        cache[path] = null;
        writeFileSync(CACHE_FILE, JSON.stringify(cache));
        await sleep(700);
        return null;
      }
      if (res.status === 429) {
        // Slow down, never read a rate limit as "nothing there".
        lastError = '429';
        await sleep(attempt * 30_000);
        continue;
      }
      if (!res.ok) throw new Error(String(res.status));
      cache[path] = await res.json();
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      await sleep(700);
      return cache[path] as T;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await sleep(attempt * 4000);
    }
  }
  throw new SourceFailed(`Open Library did not answer for ${path}: ${lastError}`);
}

interface EditionsPage { size?: number; entries?: ForeignEdition[] }

export async function allEditions(workId: string): Promise<ForeignEdition[]> {
  const out: ForeignEdition[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = await get<EditionsPage>(`/works/${workId}/editions.json?limit=200&offset=${offset}`);
    const entries = page?.entries ?? [];
    out.push(...entries);
    if (entries.length < 200 || offset + 200 >= (page?.size ?? 0)) return out;
  }
}

