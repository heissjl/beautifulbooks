/**
 * Draws the same cover wall in every candidate colour scheme, side by side
 * (ROADMAP 6.22).
 *
 *   npx tsx lab/palette/build.ts                 -> lab/palette/index.html
 *   npx tsx lab/palette/build.ts --base http://localhost:3000/img
 *   npx tsx lab/palette/build.ts --embed --out /tmp/mockup.html
 *
 * Covers come out of `data/cover-index.json`, so this asks nobody anything.
 * With `--base` pointing at a running dev server the images come through the
 * site's own image route (ROADMAP 1.3) and are therefore instant on a second
 * run; without it they load straight from Open Library, which is slow but
 * needs no server — that is the version that gets committed, so the file can
 * be opened on its own.
 *
 * The page shows both light and dark for every candidate, because
 * `prefers-color-scheme` ships both and a scheme that only works in one is
 * not a scheme. Under each wall stands its contrast table: a candidate that
 * fails WCAG AA is out however good it looks.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CANDIDATES, contrastRows, type Scheme } from './palettes';

interface CoverIndexFile {
  builtAt: string;
  works: Array<[string, string, string]>;
  /** [work index, cover id, hash, ...] — the work comes first, not the id. */
  covers: Array<[number, string, ...unknown[]]>;
}

const ROOT = join(import.meta.dirname, '..', '..');

/** How many tiles a mock-up wall shows. Three rows of six, like the real one. */
const TILES = 18;

function coverIdsOfWork(title: string, howMany: number): { work: string; ids: string[] } {
  const index = JSON.parse(readFileSync(join(ROOT, 'data', 'cover-index.json'), 'utf8')) as CoverIndexFile;
  const at = index.works.findIndex(w => w[1].toLowerCase().includes(title.toLowerCase()));
  if (at < 0) throw new Error(`No indexed work matches "${title}"`);
  const ids = index.covers.filter(c => c[0] === at).map(c => c[1]).slice(0, howMany);
  return { work: `${index.works[at][1]} — ${index.works[at][2]}`, ids };
}

function imageUrl(coverId: string, base: string | undefined): string {
  if (base) return `${base.replace(/\/$/, '')}/M/${coverId.replace(':', '-')}`;
  if (coverId.startsWith('ol:')) return `https://covers.openlibrary.org/b/id/${coverId.slice(3)}-M.jpg`;
  return `https://books.google.com/books/content?id=${coverId.slice(3)}&printsec=frontcover&img=1&zoom=1&source=gbs_api&fife=w300`;
}

/** One cover as a data URI, so the page can be handed to somebody. */
async function dataUri(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return url;
  const type = res.headers.get('content-type') ?? 'image/jpeg';
  const bytes = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${bytes.toString('base64')}`;
}

function vars(scheme: Scheme): string {
  return Object.entries({
    '--bg': scheme.bg, '--surface': scheme.surface, '--surface-2': scheme.surface2,
    '--ink': scheme.ink, '--ink-2': scheme.ink2, '--ink-3': scheme.ink3,
    '--line': scheme.line, '--accent': scheme.accent, '--on-accent': scheme.onAccent,
  }).map(([k, v]) => `${k}:${v}`).join(';');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/**
 * One wall, plus the controls that actually carry the accent on the real
 * site: the search button, the language pills, a link, and the verdict note.
 * A palette has to be judged on those, not on a swatch.
 */
function panel(scheme: Scheme, srcs: string[], mode: string): string {
  const tiles = srcs.map((src, i) =>
    `<div class="tile"${i === 4 ? ' data-selected="true"' : ''}><img src="${src}" alt="" loading="eager"></div>`).join('');
  const rows = contrastRows(scheme).map(r =>
    `<tr class="${r.passes ? 'ok' : 'bad'}"><td>${r.pair}</td><td>${r.ratio.toFixed(2)}</td><td>${r.passes ? 'AA' : `< ${r.needs}`}</td></tr>`).join('');
  return `
  <section class="panel" style="${vars(scheme)}">
    <p class="mode">${mode}</p>
    <div class="chrome">
      <div class="searchbar"><span>Judge a book by its covers.</span><button class="primary">Search</button></div>
      <div class="pills">
        <span class="pill on">English 34</span><span class="pill">German 6</span><span class="pill">French 5</span><span class="pill">Unknown 3</span>
      </div>
    </div>
    <div class="wall">${tiles}</div>
    <p class="meta">55 covers from 110 editions · <a href="#">See these covers by decade &rarr;</a></p>
    <p class="note"><span class="lead">The publisher&rsquo;s current image for this ISBN is this cover.</span> Shops list by number and mostly use that image.</p>
    <table class="contrast"><tbody>${rows}</tbody></table>
  </section>`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const baseAt = argv.indexOf('--base');
  const base = baseAt >= 0 ? argv[baseAt + 1] : undefined;
  const wanted = argv.find(a => a.startsWith('--work='))?.slice('--work='.length) ?? 'Beloved';
  const embed = argv.includes('--embed');
  const outAt = argv.indexOf('--out');
  const out = outAt >= 0 ? argv[outAt + 1] : join(import.meta.dirname, 'index.html');

  const { work, ids } = coverIdsOfWork(wanted, TILES);
  if (ids.length < TILES) console.warn(`Only ${ids.length} covers indexed for ${work}`);

  /*
    `--embed` inlines the covers as data URIs, which makes the file
    self-contained: it can be sent to somebody and opened anywhere, and it
    renders at once instead of waiting six to sixteen seconds per image on
    Open Library (the measurement behind ROADMAP 1.3). It also makes the file
    about half a megabyte, which is why it is not the default.
  */
  const srcs = embed ? await Promise.all(ids.map(id => dataUri(imageUrl(id, base)))) : ids.map(id => imageUrl(id, base));

  const blocks = CANDIDATES.map(c => `
  <article class="candidate">
    <h2>${escapeHtml(c.name)}</h2>
    <p class="claim">${escapeHtml(c.claim)}</p>
    <div class="pair">
      ${panel(c.light, srcs, 'hell')}
      ${panel(c.dark, srcs, 'dunkel')}
    </div>
  </article>`).join('');

  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Farbschema-Kandidaten · ROADMAP 6.22</title>
<style>
  :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; background: #6e6e6e; color: #111; padding: 24px; }
  header { max-width: 70ch; margin: 0 auto 28px; color: #fff; }
  header h1 { font-family: Georgia, serif; font-weight: 500; margin: 0 0 8px; }
  header p { margin: 0 0 6px; line-height: 1.5; font-size: 14px; opacity: .92; }
  .candidate { max-width: 1360px; margin: 0 auto 34px; }
  .candidate h2 { font-family: Georgia, serif; font-weight: 500; color: #fff; margin: 0 0 4px; font-size: 20px; }
  .claim { color: #f0f0f0; font-size: 13px; line-height: 1.55; margin: 0 0 12px; max-width: 90ch; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .panel { background: var(--bg); color: var(--ink); border-radius: 10px; padding: 16px; }
  .mode { margin: 0 0 10px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); }
  .searchbar { display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 8px 8px 14px; }
  .searchbar span { flex: 1; color: var(--ink-3); font-size: 13px; }
  .primary { background: var(--accent); color: var(--on-accent); border: 0; border-radius: 6px; padding: 7px 14px; font-size: 13px; font-weight: 500; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 12px; }
  .pill { border: 1px solid var(--line); color: var(--ink-2); border-radius: 999px; padding: 3px 10px; font-size: 11px; }
  .pill.on { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  .wall { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .tile { aspect-ratio: 2/3; background: var(--surface-2); border-radius: 3px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.18); }
  .tile[data-selected="true"] { outline: 2px solid var(--accent); outline-offset: 2px; }
  .tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .meta { font-size: 11px; color: var(--ink-3); margin: 10px 0 8px; }
  .meta a { color: var(--accent); }
  .note { font-size: 11px; line-height: 1.55; color: var(--ink-3); margin: 0 0 12px; }
  .note .lead { color: var(--ink-2); }
  .contrast { width: 100%; border-collapse: collapse; font-size: 10px; color: var(--ink-3); }
  .contrast td { padding: 2px 0; border-top: 1px solid var(--line); }
  .contrast td:nth-child(2), .contrast td:nth-child(3) { text-align: right; width: 3.2rem; font-variant-numeric: tabular-nums; }
  .contrast .bad td { color: #c0392b; font-weight: 600; }
</style></head>
<body>
<header>
  <h1>Farbschema-Kandidaten</h1>
  <p>ROADMAP 6.22. Dieselbe Wand, dieselben Bedienelemente, vier F&auml;rbungen &mdash; jeweils hell und dunkel,
  weil <code>prefers-color-scheme</code> beide ausliefert. Cover: ${escapeHtml(work)}.</p>
  <p>Die Frage ist die <strong>Akzentfarbe</strong>: sie steht heute auf Suchknopf, Sprach-Pillen, Fokusringen,
  Links und dem Verdikt-Hinweis und ist damit die einzige Farbe, die mit den Covern konkurriert. Der Hintergrund
  steht hinter hunderten Covern &mdash; je bunter er ist, desto mehr streitet er mit ihnen.</p>
  <p>Unter jeder Wand die Kontrasttabelle. Rot hei&szlig;t: f&auml;llt durch WCAG AA und ist damit raus,
  unabh&auml;ngig davon, wie es aussieht.</p>
</header>
${blocks}
</body></html>`;

  writeFileSync(out, html, 'utf8');
  console.log(`Wrote ${out} — ${CANDIDATES.length} candidates, ${ids.length} covers${base ? `, images via ${base}` : ''}${embed ? ', embedded' : ''}`);
  for (const c of CANDIDATES) {
    for (const [mode, scheme] of [['hell', c.light], ['dunkel', c.dark]] as const) {
      const failing = contrastRows(scheme).filter(r => !r.passes);
      if (failing.length > 0) console.warn(`  ${c.id} ${mode}: ${failing.map(f => `${f.pair} ${f.ratio}`).join(', ')}`);
    }
  }
}

// No top-level await: tsx transpiles this folder to CJS.
main().catch(error => { console.error(error); process.exitCode = 1; });
