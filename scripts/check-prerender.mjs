/**
 * After `next build`: did the prerendered book pages get their catalogue data?
 * (ROADMAP 2.18e, red team 2026-10-09 B3.)
 *
 * The build renders the home page's works (`generateStaticParams` in
 * app/book/[id]/page.tsx) with Open Library's answers. When the catalogue is
 * silent or turning us away during the build, `loadWork` returns null and the
 * page goes out with the site's default title and no JSON-LD — cached for a
 * day, and nobody would know. This fails the build instead, so Vercel keeps the
 * deployment that is live and the next build tries again.
 *
 * Plain JavaScript on purpose: it runs inside Vercel's build after `next
 * build`, where `tsx` is not installed.
 *
 *   node scripts/check-prerender.mjs [.next]
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** More pages without data than this share fails the build; one stray page does not. */
export const MAX_MISSING_SHARE = 0.1;

/** A book page has its data when the work's JSON-LD was rendered into it. */
export function hasCatalogueData(html) {
  return html.includes('application/ld+json') && html.includes('"@type":"Book"');
}

/** The verdict over all pages: which lack data, and whether that is too many. */
export function verdict(pages) {
  const missing = pages.filter(p => !hasCatalogueData(p.html)).map(p => p.id);
  const tooMany = pages.length > 0 && missing.length / pages.length > MAX_MISSING_SHARE;
  return { total: pages.length, missing, ok: !tooMany };
}

function readPages(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => /^OL\d+W\.html$/.test(f))
    .map(f => ({ id: f.replace(/\.html$/, ''), html: readFileSync(path.join(dir, f), 'utf8') }));
}

function main() {
  const root = process.argv[2] ?? '.next';
  const pages = readPages(path.join(root, 'server', 'app', 'book'));
  const result = verdict(pages);
  if (result.total === 0) {
    console.log('check-prerender: no prerendered book pages found; nothing to check');
    return;
  }
  const line = `check-prerender: ${result.total - result.missing.length} of ${result.total} book pages carry catalogue data`;
  if (result.ok) {
    console.log(result.missing.length ? `${line}; without: ${result.missing.join(', ')}` : line);
    return;
  }
  console.error(`${line} — too many without (${result.missing.join(', ')}). Open Library was probably silent or busy during the build; the live deployment stays, build again later.`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
