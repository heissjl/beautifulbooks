/**
 * Writes each tile's `coverRatio` (height over width of its scan) into
 * data/collections.json, read from Open Library's cover record — the size of
 * the image as uploaded, without downloading the image (CLAUDE.md: about
 * 0.08 s each). A wall with ratios shows every cover in its own shape.
 *
 *   npx tsx lab/collections/cover-ratios.ts <slug> [<slug> …]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(import.meta.dirname, '..', '..', 'data', 'collections.json');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function ratioOf(coverId: string): Promise<number | null> {
  const n = /^ol:(\d+)$/.exec(coverId)?.[1];
  if (!n) return null;
  const res = await fetch(`https://covers.openlibrary.org/b/id/${n}.json`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const { width, height } = (await res.json()) as { width?: number; height?: number };
  return width && height ? Math.round((height / width) * 1000) / 1000 : null;
}

async function main() {
  const slugs = process.argv.slice(2);
  if (!slugs.length) throw new Error('usage: cover-ratios.ts <slug> [<slug> …]');
  const data = JSON.parse(readFileSync(FILE, 'utf8')) as { collections: Array<{ slug: string; works: Array<{ coverId: string; coverRatio?: number }> }> };
  for (const slug of slugs) {
    const c = data.collections.find(x => x.slug === slug);
    if (!c) throw new Error(`${slug} is not in data/collections.json`);
    let set = 0;
    for (const w of c.works) {
      const r = await ratioOf(w.coverId).catch(() => null);
      if (r) { w.coverRatio = r; set += 1; }
      await sleep(150);
    }
    console.log(`${slug}: ${set} of ${c.works.length} shapes`);
  }
  writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
}

main();
