/**
 * Draws the Gatsby page in each look of `looks.ts`, plus the proposals for
 * labels, arrows, dot lines and the header slogan as before/after rows
 * (docs/gestaltung-ki-anmutung.md, Julian 2026-10-02).
 *
 *   npx tsx lab/look/build.ts            -> lab/look/index.html (images from Open Library)
 *   npx tsx lab/look/build.ts --embed    -> lab/look/out/look.html (images and font inline, sendable)
 *
 * The printings are real records from the Gatsby fixtures, never made up
 * (publisher, year, ISBN and cover id as Open Library holds them).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRows, LOOKS, type Look, type Scheme } from './looks';

const HERE = import.meta.dirname;
const ROOT = join(HERE, '..', '..');
const EMBED = process.argv.includes('--embed');

interface Printing { cover: number; publisher: string; year: string; isbn: string }

/** English printings with a cover, picked from lib/__fixtures__/the-great-gatsby/. */
const COVERS = [14811162, 8241389, 8249081, 14656333, 8247997, 8248025, 8247781, 8247951, 8249104, 8248037, 274844, 8247931];
const SELECTED = 8241389;

function printings(): Printing[] {
  const dir = join(ROOT, 'lib', '__fixtures__', 'the-great-gatsby');
  const entries = ['openlibrary-editions.json', 'openlibrary-editions-100.json', 'openlibrary-editions-200.json']
    .flatMap(f => (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { entries: Array<Record<string, unknown>> }).entries);
  return COVERS.map(id => {
    const e = entries.find(x => (x.covers as number[] | undefined)?.[0] === id);
    if (!e) throw new Error(`cover ${id} not in the fixtures`);
    const year = String(e.publish_date ?? '').match(/\d{4}/)?.[0] ?? '';
    return { cover: id, publisher: (e.publishers as string[])[0], year, isbn: (e.isbn_13 as string[])[0] };
  });
}

async function src(id: number): Promise<string> {
  const url = `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
  if (!EMBED) return url;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

function fontUrl(): string {
  const file = join(ROOT, 'assets', 'fonts', 'xanh-proportional-regular.woff2');
  return EMBED ? `data:font/woff2;base64,${readFileSync(file).toString('base64')}` : '../../assets/fonts/xanh-proportional-regular.woff2';
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function vars(s: Scheme): string {
  return Object.entries({
    '--bg': s.bg, '--surface': s.surface, '--ink': s.ink, '--ink-2': s.ink2, '--ink-3': s.ink3, '--line': s.line,
    '--accent': s.accent, '--button': s.button, '--on-button': s.onButton, '--select': s.select, '--on-select': s.onSelect,
    '--band': s.band ?? 'transparent',
  }).map(([k, v]) => `${k}:${v}`).join(';');
}

/** The Gatsby page, cut down to what carries the look: header, title, tabs, wall, sidebar, shops. */
function page(look: Look, scheme: Scheme, ps: Printing[], imgs: Map<number, string>): string {
  const today = look.form === 'today';
  const sel = ps.find(p => p.cover === SELECTED)!;
  const tiles = ps.map(p => `<figure class="tile${p.cover === SELECTED ? ' is-sel' : ''}"><img src="${imgs.get(p.cover)}" alt="${esc(p.publisher)} ${p.year}"></figure>`).join('');
  const langs: Array<[string, number]> = [['English', 123], ['German', 13], ['Spanish', 16], ['Italian', 13], ['French', 9]];
  const tabs = langs.map(([l, n], i) => today
    ? `<span class="pill${i === 0 ? ' on' : ''}">${l} <b>${n}</b></span>`
    : `<span class="tab${i === 0 ? ' on' : ''}">${l} <small>${n}</small></span>`).join('');
  const arrow = today ? ' →' : '';
  const head = today ? `${esc(sel.publisher)} · ${sel.year} · English` : `${esc(sel.publisher)}, ${sel.year} <span class="muted">(English)</span>`;
  const meta = today
    ? 'Open Library dates it to 1920 · 251 covers · 1,100 of 1,180 editions checked'
    : '251 covers from 1,100 of 1,180 editions. Open Library dates the book to 1920.';
  return `<div class="site" style="${vars(scheme)}">
  ${scheme.band ? '<div class="band"></div>' : ''}
  <header class="hd"><span class="logo">Beautiful Books</span>${today ? '<span class="slogan">Covers, side by side.</span>' : ''}<span class="search">Search a book</span></header>
  <div class="body">
    <div class="main">
      <h1>The Great Gatsby</h1>
      <p class="author">F. Scott Fitzgerald</p>
      <p class="meta">${meta}</p>
      <div class="tabs">${today ? '<span class="kicker">251 covers</span>' : ''}${tabs}</div>
      <p class="decade"><a>${today ? 'See these covers by decade' : 'The same covers by decade'}${arrow}</a></p>
      <div class="wall">${tiles}</div>
    </div>
    <aside class="side">
      ${today ? '<p class="kicker">Selected cover</p>' : ''}
      <img class="big" src="${imgs.get(SELECTED)}" alt="">
      <p class="ed">${head}</p>
      <p class="isbn">ISBN ${sel.isbn}</p>
      ${today ? '<p class="kicker">Get this printing</p>' : '<h3>Get this printing</h3>'}
      <div class="shops"><span class="btn fill">Bookshop.org</span><span class="btn">Amazon</span><span class="btn">AbeBooks</span></div>
      ${today ? '<p class="kicker">Looks like this</p>' : '<h3>Covers that look like this one</h3>'}
      <div class="alike">${ps.slice(4, 7).map(p => `<img src="${imgs.get(p.cover)}" alt="">`).join('')}</div>
      <p class="more"><a>Other ways to find it (6)</a></p>
    </aside>
  </div>
</div>`;
}

function contrastTable(scheme: Scheme): string {
  return `<table class="ct">${contrastRows(scheme).map(r =>
    `<tr class="${r.passes ? '' : 'fail'}"><td>${r.pair}</td><td>${r.ratio.toFixed(2)}</td><td>${r.passes ? 'AA' : 'unter 4,5'}</td></tr>`).join('')}</table>`;
}

/** Before/after rows for the three proposals, with the place in the code. */
const KICKERS: Array<[string, string, string]> = [
  ['251 COVERS (über den Sprachreitern)', 'streichen — die Zahl steht schon in der Zeile unter dem Autor', 'CoverGallery.tsx:150, :186'],
  ['THIS BOOK', 'streichen — der Absatz beginnt mit „Editions here run from …"', 'WorkPanel.tsx:38'],
  ['SELECTED COVER (Blatt am Telefon)', 'Verlag und Jahr des Drucks: „Penguin Books, 2010"', 'CoverSheet.tsx:155'],
  ['LOOKS LIKE THIS', 'Überschrift in der Serifenschrift: „Covers that look like this one"', 'BookDetail.tsx:590'],
  ['3 PRINTINGS WITH THIS COVER', 'kleiner Satz: „On 3 printings:"', 'BookDetail.tsx:732'],
  ['GET THIS PRINTING / FIND THIS PRINTING / FIND THE COVER YOU PICKED', 'Überschrift in der Serifenschrift, normale Schreibung', 'BookDetail.tsx:938'],
  ['OR READ IT IN ANOTHER EDITION', 'Überschrift in der Serifenschrift, normale Schreibung', 'BookDetail.tsx:1060'],
  ['SHOP IN', '„Shops in" in normaler Schreibung vor der Auswahl', 'MarketSwitcher.tsx:16'],
  ['COUNTRY', 'normales Formularlabel „Country"', 'LocalShops.tsx:75'],
  ['RECENT / POPULAR (Vorschlagsliste)', '„Recent searches" / „Popular", klein, normale Schreibung', 'SearchBar.tsx:158, :171'],
  ['3 BOOKS · 1,180 EDITIONS', '„3 books, 1,180 editions"', 'BookGrid.tsx:288'],
  ['12 BOOKS · 3,400 EDITIONS · MOST PRINTED FIRST', '„12 books and 3,400 editions, the most printed first."', 'BookGrid.tsx:357'],
  ['BY OTHER AUTHORS (12)', 'Überschrift in der Serifenschrift', 'BookGrid.tsx:304, :310'],
  ['PICK COVERS / PUT THIS COVER INTO / YOUR COLLECTION', 'normale Schreibung, klein', 'WallPicker.tsx:104, AddToWall.tsx:156, CollectionSheet.tsx:82'],
  ['YOUR OTHER COLLECTIONS', 'Überschrift in der Serifenschrift', 'WallView.tsx:126'],
  ['WHICH COVER? (über „The standings")', 'streichen — die Überschrift sagt es', 'versus/board/page.tsx:120'],
  ['RESPONSIBLE FOR THIS SITE', 'normales Label, die Seite ist ein Formular des Gesetzes', 'contact/page.tsx:33'],
];

const ARROWS: Array<[string, string, string]> = [
  ['Help us find the prettiest cover of all time! →', 'ohne Pfeil; die Unterstreichung sagt „Link"', 'app/page.tsx:106'],
  ['Create your own collection of covers →', 'ohne Pfeil', 'WallsInvite.tsx:16'],
  ['Collections … See all →', 'die Überschrift „Collections" selbst ist der Link; „See all" fällt weg', 'CollectionsShelf.tsx:34'],
  ['/collections: „76 books →" und Kachel „All 76 →" — zwei Links zum selben Ziel', 'der Titel ist der Link, „76 books" grau ohne Link; die letzte Kachel „70 more" ohne Pfeil', 'collections/page.tsx:61, CollectionGrid.tsx:72'],
  ['all of them →', '„All collections by readers"', 'collections/page.tsx:74'],
  ['See these covers by decade →', '„The same covers by decade"', 'DecadeLink.tsx:46'],
  ['More by Ray Bradbury →', 'ohne Pfeil', 'AuthorWorks.tsx:72'],
  ['12 covers →', '„12 covers"', 'ReaderWallCard.tsx:19'],
];

const DOTS: Array<[string, string, string]> = [
  ['Kopfzeile: Beautiful Books  Covers, side by side.', 'Slogan streichen; Logo und Suche genügen. Was die Seite ist, sagt die Startseite in ihrem ersten Satz', 'SiteHeader.tsx:30'],
  ['Open Library dates it to 1920 · 251 covers · 1,100 of 1,180 editions checked', '251 covers from 1,100 of 1,180 editions. Open Library dates the book to 1920.', 'BookDetail.tsx:417'],
  ['Penguin Books · 2010 · English', 'Penguin Books, 2010 (English) — wie auf einer Katalogkarte', 'BookDetail.tsx:898'],
  ['2010 · no ISBN', '2010, no ISBN', 'BookDetail.tsx:766'],
  ['AbeBooks · ISBN / AbeBooks · title & year', 'AbeBooks by ISBN / AbeBooks by title and year', 'lib/linkplan.ts:256'],
  ['… · on 3 editions', '…, on 3 editions', 'BookDetail.tsx:830'],
  ['About · Beautiful Books (Browser-Tab)', 'bleibt — im Tab ist der Mittelpunkt üblich und unsichtbar genug', 'app/*/page.tsx'],
];

function rows(list: Array<[string, string, string]>, beforeClass = ''): string {
  return `<table class="pr"><tr><th>Heute</th><th>Vorschlag</th><th>Stelle</th></tr>${list.map(([a, b, c]) =>
    `<tr><td class="${beforeClass}">${esc(a)}</td><td>${esc(b)}</td><td class="code">${esc(c)}</td></tr>`).join('')}</table>`;
}

async function main() {
  const ps = printings();
  const imgs = new Map<number, string>();
  for (const p of ps) imgs.set(p.cover, await src(p.cover));

  const panels = LOOKS.map(l => `<section class="look" id="${l.id}">
  <h2>${esc(l.name)}</h2>
  <p class="claim">${esc(l.claim)}</p>
  <div class="mode light">${page(l, l.light, ps, imgs)}${contrastTable(l.light)}</div>
  <div class="mode dark">${page(l, l.dark, ps, imgs)}${contrastTable(l.dark)}</div>
</section>`).join('\n');

  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Look Mockup</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
<style>
@font-face { font-family: Xanh; src: url("${fontUrl()}") format("woff2"); }
:root { --frame-bg:#ececea; --frame-ink:#1b1b1b; --frame-2:#5b5b58; --frame-line:#d4d4d0; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --frame-bg:#0c0c0c; --frame-ink:#e8e8e4; --frame-2:#a5a5a0; --frame-line:#2a2a28; } }
:root[data-theme="dark"] { --frame-bg:#0c0c0c; --frame-ink:#e8e8e4; --frame-2:#a5a5a0; --frame-line:#2a2a28; }
* { box-sizing: border-box; }
body { margin:0; background:var(--frame-bg); color:var(--frame-ink); font:15px/1.5 Jost, system-ui, sans-serif; padding:24px 16px 80px; }
.wrap { max-width:1180px; margin:0 auto; }
h1.top { font:400 34px/1.15 Xanh, Georgia, serif; margin:0 0 6px; }
.lede { color:var(--frame-2); max-width:760px; }
nav.jump { display:flex; flex-wrap:wrap; gap:6px 16px; margin:14px 0 8px; font-size:14px; }
nav.jump a { color:var(--frame-ink); }
.toggle { margin:6px 0 24px; font-size:14px; color:var(--frame-2); }
.toggle button { font:inherit; border:1px solid var(--frame-line); background:transparent; color:var(--frame-ink); padding:4px 10px; border-radius:4px; cursor:pointer; }
.toggle button[aria-pressed="true"] { background:var(--frame-ink); color:var(--frame-bg); }
section.look, section.prop { margin-top:44px; }
section > h2 { font:400 26px/1.2 Xanh, Georgia, serif; margin:0 0 4px; }
.claim { color:var(--frame-2); max-width:780px; margin:0 0 14px; }
body[data-mode="light"] .mode.dark, body[data-mode="dark"] .mode.light { display:none; }
.mode { margin-bottom:10px; }
.ct { font-size:12px; color:var(--frame-2); border-collapse:collapse; margin:6px 0 0; }
.ct td { padding:1px 12px 1px 0; } .ct tr.fail td { color:#c0392b; font-weight:600; }

/* the mocked site */
.site { background:var(--bg); color:var(--ink); border:1px solid var(--frame-line); border-radius:6px; overflow:hidden; }
.band { height:10px; background:var(--band); }
.hd { display:flex; align-items:center; gap:14px; padding:12px 22px; border-bottom:1px solid var(--line); }
.logo { font:400 19px Xanh, Georgia, serif; }
.slogan { font-size:13px; color:var(--ink-3); }
.search { margin-left:auto; font-size:13px; color:var(--ink-3); border:1px solid var(--line); background:var(--surface); padding:5px 12px; border-radius:4px; width:200px; }
.body { display:grid; grid-template-columns:minmax(0,1fr) 270px; gap:30px; padding:22px; }
.site h1 { font:400 38px/1.1 Xanh, Georgia, serif; margin:0; }
.author { margin:6px 0 2px; color:var(--ink-2); }
.meta { margin:0 0 16px; font-size:13px; color:var(--ink-3); }
.tabs { display:flex; flex-wrap:wrap; align-items:center; gap:8px 6px; }
.kicker { font-size:11px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); margin:0 6px 0 0; }
.pill { border:1px solid var(--line); border-radius:999px; padding:3px 11px; font-size:13px; color:var(--ink-2); }
.pill b { font-weight:400; color:var(--ink-3); margin-left:3px; }
.pill.on { background:var(--select); border-color:var(--select); color:var(--on-select); } .pill.on b { color:inherit; opacity:.75; }
.tab { font-size:14px; color:var(--ink-2); padding:2px 8px 4px; margin-right:4px; border-bottom:2px solid transparent; }
.tab small { color:var(--ink-3); font-size:12px; margin-left:2px; }
.tab.on { color:var(--ink); background:var(--select); color:var(--on-select); border-radius:2px; } .tab.on small { color:inherit; opacity:.8; }
.decade { font-size:13px; margin:12px 0 14px; } .site a { color:var(--accent); text-decoration:underline; text-underline-offset:3px; text-decoration-thickness:1px; }
.wall { display:grid; grid-template-columns:repeat(6, 1fr); gap:14px 12px; align-items:end; }
.tile { margin:0; } .tile img { width:100%; display:block; box-shadow:0 1px 2px rgba(0,0,0,.18), 0 10px 22px -14px rgba(0,0,0,.45); }
.tile.is-sel img { outline:3px solid var(--select); outline-offset:3px; }
.side { font-size:14px; }
.side .big { width:150px; display:block; margin:4px 0 12px; box-shadow:0 1px 2px rgba(0,0,0,.2), 0 12px 26px -14px rgba(0,0,0,.5); }
.side .kicker { display:block; margin:16px 0 8px; }
.side h3 { font:400 17px/1.25 Xanh, Georgia, serif; margin:18px 0 8px; }
.ed { margin:0; } .muted { color:var(--ink-3); } .isbn { margin:2px 0 0; font-size:13px; color:var(--ink-3); }
.shops { display:flex; flex-wrap:wrap; gap:6px; }
.btn { border:1px solid var(--line); background:var(--surface); padding:5px 11px; border-radius:4px; font-size:13px; }
.btn.fill { background:var(--button); border-color:var(--button); color:var(--on-button); }
.alike { display:flex; gap:8px; } .alike img { width:58px; display:block; }
.more { font-size:13px; margin-top:14px; }

/* proposals */
table.pr { width:100%; border-collapse:collapse; font-size:14px; margin-top:8px; }
table.pr th { text-align:left; font-weight:500; color:var(--frame-2); border-bottom:1px solid var(--frame-line); padding:6px 10px 6px 0; }
table.pr td { vertical-align:top; padding:7px 10px 7px 0; border-bottom:1px solid var(--frame-line); }
td.caps { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--frame-2); }
td.code { font-family: ui-monospace, monospace; font-size:12px; color:var(--frame-2); }
.rule { background:color-mix(in oklab, var(--frame-ink) 6%, transparent); padding:10px 14px; border-radius:4px; max-width:820px; }
@media (max-width: 760px) {
  .body { grid-template-columns:1fr; padding:16px; }
  .wall { grid-template-columns:repeat(3, 1fr); }
  .search, .slogan { display:none; }
  table.pr td.code, table.pr th:last-child { display:none; }
}
</style></head>
<body data-mode="light"><div class="wrap">
<h1 class="top">Weniger nach Claude aussehen — Mockup</h1>
<p class="lede">Die Gatsby-Seite in fünf Fassungen, verkleinert auf das, was den Eindruck macht: Kopf, Titel, Sprachreiter, Wand, Seitenleiste, Läden. Die Drucke sind echte Datensätze aus den Fixtures. Unter jeder Fassung die Kontrasttabelle; was unter 4,5 fällt, ist raus. Darunter die drei Vorschläge mit jeder Stelle im Code. Befund: <code>docs/gestaltung-ki-anmutung.md</code>, 2026-10-02.</p>
<nav class="jump">${LOOKS.map(l => `<a href="#${l.id}">${esc(l.name)}</a>`).join('')}<a href="#kicker">Etiketten</a><a href="#arrows">Pfeile</a><a href="#dots">Mittelpunkte und Slogan</a></nav>
<p class="toggle">Modus der Entwürfe: <button type="button" data-m="light" aria-pressed="true">hell</button> <button type="button" data-m="dark" aria-pressed="false">dunkel</button></p>
${panels}
<section class="prop" id="kicker"><h2>Etiketten in Großbuchstaben</h2>
<p class="claim">23 Stellen tragen die Klasse <code>.kicker</code>. Vorschlag in zwei Schritten: erst die Klasse selbst ändern — normale Schreibung, keine Sperrung, Schrift <code>ink-2</code> —, das trifft alle Stellen auf einmal. Dann je Stelle: streichen, wo die Seite ohne das Etikett klar ist; zur Überschrift in der Serifenschrift machen, wo es eine ist.</p>
<p class="rule">Regel: Ein Kasten bekommt nur dann eine Beschriftung, wenn er ohne sie unklar wäre. Dann als Satz, nicht als Stempel.</p>
${rows(KICKERS, 'caps')}</section>
<section class="prop" id="arrows"><h2>Pfeile hinter Links</h2>
<p class="claim">Ein Pfeil hinter einem Textlink sagt nichts, was die Unterstreichung nicht sagt. Pfeile bleiben nur, wo sie eine Richtung meinen: „← Home", die Tastenhilfe im Spiel, die Verschiebeknöpfe im Sammlungseditor.</p>
${rows(ARROWS)}</section>
<section class="prop" id="dots"><h2>Mittelpunkte und der Slogan</h2>
<p class="claim">Zeilen aus Fakten mit Mittelpunkten sind das Metadaten-Muster jeder generierten Seite. Vorschlag: ganze Sätze, wo es Aussagen sind, und Komma mit Klammer wie auf einer Katalogkarte, wo es Angaben sind.</p>
${rows(DOTS)}</section>
</div>
<script>
const start = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
document.body.dataset.mode = start;
for (const o of document.querySelectorAll('.toggle button')) o.setAttribute('aria-pressed', String(o.dataset.m === start));
for (const b of document.querySelectorAll('.toggle button')) b.addEventListener('click', () => {
  document.body.dataset.mode = b.dataset.m;
  for (const o of document.querySelectorAll('.toggle button')) o.setAttribute('aria-pressed', String(o === b));
});
</script>
</body></html>`;

  const out = EMBED ? join(HERE, 'out', 'look.html') : join(HERE, 'index.html');
  if (EMBED) mkdirSync(join(HERE, 'out'), { recursive: true });
  writeFileSync(out, html);
  console.log(`${out} (${Math.round(html.length / 1024)} KB)`);
}

void main();
