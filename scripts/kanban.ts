/**
 * A kanban board of the roadmap, generated — never hand-maintained.
 *
 *   npm run kanban          # writes docs/kanban.html and prints the tally
 *   npm run kanban -- --fetch   # same, after `git fetch origin`
 *
 * Julian asked for a board on 2026-09-12 ("damit ich besser den Überblick
 * behalte"). The rule that shapes it is CLAUDE.md's: **ROADMAP.md holds every
 * item exactly once.** A board people drag cards on would be a second place
 * holding the same state, and within a day the two would disagree. So this
 * board is a *view*: every card, column and count is derived from ROADMAP.md
 * and from git, the output is git-ignored like docs/worktrees.md, and moving
 * a card means editing the roadmap and running this again.
 *
 * Three sources, no invention:
 *   - **the item lines** `- [ ] **6.5 …**` give number, title, state, phase;
 *   - **the mermaid graph** under "### Abhängigkeiten" gives what waits on
 *     what — it already encodes the dependencies, so the board reads them
 *     rather than keeping a second list;
 *   - **git** gives what is being worked on: a branch that is ahead of
 *     production and names item numbers in its commit subjects, the same
 *     convention scripts/worktrees.ts relies on.
 *
 * Owner is the one field the roadmap does not carry as data — it is prose
 * ("Julian entscheidet", "(Julian, 2026-09-07: …)"). The rules below are a
 * documented heuristic, in this order: an explicit **Wer:** line, then
 * "Julian entscheidet", then the exceptions table, then the phase default
 * (phase 0 and 4 are accounts, money and law: Julian; everything else:
 * Claude). Where it guesses wrong, fix the roadmap line, not the guess.
 *
 * Read-only. Runs `git` only to inspect state; `--fetch` touches nothing but
 * the remote-tracking refs.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ROADMAP = path.join(ROOT, 'ROADMAP.md');
const OUT_FILE = path.join(ROOT, 'docs', 'kanban.html');
const PRODUCTION = 'origin/main';

type Owner = 'Julian' | 'Claude' | 'beide';

interface Item {
  /** "6.10a" */
  num: string;
  /** Sortable form of the number, so 6.8 comes before 6.10. */
  sort: [number, number, string];
  title: string;
  done: boolean;
  /** "0", "1", "2", "3", "4", "5", "6" */
  phase: string;
  /** "6.A Was ein Leser als Fehler sieht", when the phase has subsections. */
  group: string | null;
  owner: Owner;
  /** Item numbers (or names) this one waits on, from the dependency graph. */
  waitsOn: string[];
  /** Branches that name this item in a commit subject beyond production. */
  branches: string[];
  /** First sentence of the item, as the card's second line. */
  gist: string;
}

/* ------------------------------------------------------------------ roadmap */

const ITEM_LINE = /^- \[([ x])\] \*\*(\d+)\.(\d+)([a-z]?)\s+([^*]+?)\*\*/;
const PHASE_HEAD = /^## Phase (\d+)/;
const GROUP_HEAD = /^### (6\.[A-D] .+)$/;
const DONE_HEAD = /^### Erledigt in Phase/;

/** Owner where the text does not say and the phase default would be wrong. */
const OWNER_EXCEPTIONS: Record<string, Owner> = {
  '1.8': 'Julian',     // a look at two shops in a real browser
  '1.9a': 'Julian',    // Julian looks at the 90 rings; then Claude merges
  '2.2': 'Julian',     // domain and DNS
  '2.5': 'Julian',     // Search Console, Bing
  '2.6': 'Julian',     // the rest of the acceptance run needs his eyes
  '2.4': 'beide',      // Claude proposes the firewall rule, Julian clicks
  '4.9': 'beide',      // Claude builds the page, Julian picks the provider
  '6.6': 'Julian',     // costs an ISBNdb month
  '6.18': 'Julian',    // curating is his taste, not a program
  '5.5': 'Julian',     // the rights question
  '5.6': 'Julian',     // launch moments and Reddit, explicitly by hand
  '5.8a': 'beide',     // Claude builds, Julian decides what goes public
};

function parseRoadmap(): Item[] {
  const lines = readFileSync(ROADMAP, 'utf8').split('\n');
  const items: Item[] = [];
  let phase = '?';
  let group: string | null = null;
  let inDoneSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ph = PHASE_HEAD.exec(line);
    if (ph) { phase = ph[1]; group = null; inDoneSection = false; continue; }
    if (DONE_HEAD.test(line)) { inDoneSection = true; group = null; continue; }
    const gh = GROUP_HEAD.exec(line);
    if (gh) { group = gh[1]; inDoneSection = false; continue; }

    const m = ITEM_LINE.exec(line);
    if (!m) continue;

    const num = `${m[2]}.${m[3]}${m[4]}`;
    const title = m[5].replace(/[.:\s]+$/, '').trim();
    // The gist: the sentence after the bold title, cut to something readable.
    const rest = line.slice(m[0].length).replace(/^[\s.:—-]+/, '');
    const gist = rest
      .replace(/\*\*/g, '').replace(/[`*_]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .split(/(?<=[.!?])\s/)[0]
      .trim();

    items.push({
      num,
      sort: [Number(m[2]), Number(m[3]), m[4]],
      title,
      done: m[1] === 'x',
      phase,
      group: inDoneSection ? null : group,
      owner: 'Claude',
      waitsOn: [],
      branches: [],
      gist: cut(gist, 150),
    });
  }
  return items;
}

/** Owner from the item's own text, else the exceptions, else the phase. */
function assignOwners(items: Item[]): void {
  const body = readFileSync(ROADMAP, 'utf8');
  for (const item of items) {
    const start = body.indexOf(`**${item.num} `);
    const text = start === -1 ? '' : body.slice(start, start + 2500);
    if (/\*\*Wer:\*\*\s*Claude baut, Julian/.test(text)) { item.owner = 'beide'; continue; }
    if (/—\s*\*\*Julian entscheidet/.test(text)) { item.owner = 'Julian'; continue; }
    if (OWNER_EXCEPTIONS[item.num]) { item.owner = OWNER_EXCEPTIONS[item.num]; continue; }
    item.owner = item.phase === '0' || item.phase === '4' ? 'Julian' : 'Claude';
  }
}

/**
 * What waits on what, read out of the mermaid graph in "### Abhängigkeiten".
 *
 * Node ids carry a label, and the label starts with the item number where the
 * node is an item ("R67[\"6.7 Dubletten\"]"). Nodes that are not items — the
 * visitors, a day of production logs — keep their label as the reason.
 */
function parseDependencies(): Map<string, string[]> {
  const body = readFileSync(ROADMAP, 'utf8');
  const block = /### Abhängigkeiten[\s\S]*?```mermaid([\s\S]*?)```/.exec(body);
  const waits = new Map<string, string[]>();
  if (!block) return waits;

  const label = new Map<string, string>();
  const NODE = /(\w+)(?:\[\[?"([^"]+)"\]?\]|\(\["([^"]+)"\]\)|\(\("([^"]+)"\)\))/g;
  for (const m of block[1].matchAll(NODE)) {
    label.set(m[1], (m[2] ?? m[3] ?? m[4]).trim());
  }
  const name = (id: string) => {
    const text = label.get(id) ?? id;
    const num = /^(\d+\.\d+[a-z]?)/.exec(text);
    return num ? num[1] : text;
  };

  // Edges, solid and dashed; a line may chain: A --> B --> C
  for (const raw of block[1].split('\n')) {
    const line = raw.trim();
    if (!/-[.-]*->/.test(line)) continue;
    const ids = [...line.matchAll(/(\w+)(?:\[|\(|$|\s)/g)].map(m => m[1]);
    const parts = line.split(/\s*-[.-]*->\s*/).map(seg => {
      const m = /^(\w+)/.exec(seg.trim());
      return m ? m[1] : null;
    }).filter((x): x is string => !!x);
    for (let i = 1; i < parts.length; i++) {
      const from = name(parts[i - 1]);
      const to = name(parts[i]);
      if (!to || from === to) continue;
      const list = waits.get(to) ?? [];
      if (!list.includes(from)) list.push(from);
      waits.set(to, list);
    }
    void ids;
  }
  return waits;
}

/* ---------------------------------------------------------------------- git */

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** item number -> branches whose unmerged commit subjects name it. */
function branchesByItem(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const branches = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
    .split('\n').filter(Boolean);
  for (const branch of branches) {
    const subjects = git(['log', `${PRODUCTION}..${branch}`, '--format=%s']);
    if (!subjects) continue;
    const nums = new Set<string>();
    for (const m of subjects.matchAll(/^(\d+\.\d+[a-z]?)\s*[::]/gm)) nums.add(m[1]);
    for (const num of nums) {
      const list = out.get(num) ?? [];
      list.push(branch);
      out.set(num, list);
    }
  }
  return out;
}

/* -------------------------------------------------------------------- board */

type Column = 'julian' | 'ready' | 'blocked' | 'wip' | 'done';

const COLUMNS: Array<{ id: Column; title: string; note: string }> = [
  { id: 'julian', title: 'Wartet auf Julian', note: 'Konten, Geld, Recht, Entscheidungen — Claude kann hier nichts tun' },
  { id: 'wip', title: 'In Arbeit', note: 'ein Branch nennt den Punkt in einer Betreffzeile, noch nicht in Produktion' },
  { id: 'ready', title: 'Bereit', note: 'offen, nichts blockiert — hier wird das Nächste genommen' },
  { id: 'blocked', title: 'Wartet auf etwas', note: 'laut dem Abhängigkeits-Graphen der Roadmap' },
  { id: 'done', title: 'Erledigt', note: 'bleibt stehen, Langtext im Archiv' },
];

const PHASE_NAME: Record<string, string> = {
  '0': 'Entscheidungen', '1': 'Vor echtem Verkehr', '2': 'Betrieb',
  '3': 'Messen', '4': 'Geld', '5': 'Reichweite', '6': 'Qualität',
};

function columnOf(item: Item): Column {
  if (item.done) return 'done';
  if (item.branches.length > 0) return 'wip';
  // Blocked beats owner on purpose. Most of phase 4 is Julian's, but it waits
  // on visitors, not on him; putting it in his column would tell him he has
  // thirty things to do when the roadmap says the opposite.
  if (item.waitsOn.length > 0) return 'blocked';
  if (item.owner === 'Julian') return 'julian';
  return 'ready';
}

/**
 * Cut to a word boundary, never mid-word. A card that ends "…kalte Detai"
 * reads as a rendering bug rather than as a shortened sentence.
 */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const space = text.lastIndexOf(' ', max);
  return text.slice(0, space > max * 0.5 ? space : max).replace(/[\s,;:–—-]+$/, '') + '…';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function card(item: Item): string {
  const waits = item.waitsOn.length
    ? `<p class="waits">wartet auf ${item.waitsOn.map(w => `<span>${esc(w)}</span>`).join(', ')}</p>`
    : '';
  const branch = item.branches.length
    ? `<p class="branch">${item.branches.map(b => esc(b)).join(', ')}</p>`
    : '';
  const group = item.group ? `<span class="group">${esc(item.group.slice(0, 3))}</span>` : '';
  return `<article class="card" data-phase="${item.phase}" data-owner="${item.owner}">
  <header><span class="num">${esc(item.num)}</span><span class="phase">P${item.phase} ${esc(PHASE_NAME[item.phase] ?? '')}</span>${group}</header>
  <h3>${esc(item.title)}</h3>
  ${item.gist ? `<p class="gist">${esc(item.gist)}</p>` : ''}
  ${waits}${branch}
</article>`;
}

function render(items: Item[], stamp: string, production: string): string {
  const byColumn = new Map<Column, Item[]>(COLUMNS.map(c => [c.id, []]));
  for (const item of items) byColumn.get(columnOf(item))!.push(item);
  for (const list of byColumn.values()) list.sort((a, b) => {
    const pa = Number(a.phase), pb = Number(b.phase);
    return pa - pb || a.sort[1] - b.sort[1] || a.sort[2].localeCompare(b.sort[2]);
  });

  const open = items.filter(i => !i.done).length;
  const done = items.length - open;
  const columns = COLUMNS.map(col => {
    const list = byColumn.get(col.id)!;
    const cards = col.id === 'done' ? list.slice().reverse() : list;
    return `<section class="lane lane-${col.id}">
  <header class="lane-head">
    <h2>${col.title}<span class="count">${list.length}</span></h2>
    <p>${col.note}</p>
  </header>
  <div class="lane-cards">${cards.map(card).join('\n')}</div>
</section>`;
  }).join('\n');

  const phaseFilters = Object.entries(PHASE_NAME)
    .map(([n, name]) => `<button type="button" data-filter-phase="${n}">P${n} ${name}</button>`).join('');

  return `<title>Beautiful Books Roadmap-Brett</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&display=swap">
<style>
  /* The site's own tokens (app/globals.css): warm paper, one terracotta
     accent, covers carry the colour. Light is the base; dark redefines only
     the tokens, and both stamps win over the system setting. */
  :root {
    --bg: #f4f0e8; --surface: #fbf9f4; --surface-2: #ebe5da;
    --ink: #1a1714; --ink-2: #5a534a; --ink-3: #746c62;
    --line: #ddd5c8; --accent: #945138; --on-accent: #fff8f2;
    --wait: #7a6a3f; --go: #3f6a52;
    --shadow: 20 16 12;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #131110; --surface: #1b1815; --surface-2: #26221e;
      --ink: #efe8dd; --ink-2: #b2a99b; --ink-3: #837b6f;
      --line: #2e2925; --accent: #dbac94; --on-accent: #1a1210;
      --wait: #c4b283; --go: #8fbba1;
      --shadow: 0 0 0;
    }
  }
  :root[data-theme="dark"] {
    --bg: #131110; --surface: #1b1815; --surface-2: #26221e;
    --ink: #efe8dd; --ink-2: #b2a99b; --ink-3: #837b6f;
    --line: #2e2925; --accent: #dbac94; --on-accent: #1a1210;
    --wait: #c4b283; --go: #8fbba1;
    --shadow: 0 0 0;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: Geist, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 15px; line-height: 1.5;
  }
  .wrap { max-width: 1500px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }

  header.top { display: flex; flex-wrap: wrap; gap: 1rem 2rem; align-items: baseline; }
  h1 {
    font-family: Fraunces, Georgia, "Times New Roman", serif;
    font-weight: 600; font-size: clamp(1.6rem, 1.1rem + 1.6vw, 2.3rem);
    margin: 0; text-wrap: balance; letter-spacing: -0.01em;
  }
  .stamp { color: var(--ink-3); font-size: 0.8rem; }
  .lede { max-width: 62ch; color: var(--ink-2); margin: 0.75rem 0 0; }
  /* A long commit subject in a code span would otherwise widen the whole
     page: measured at 390 px, the body scrolled sideways (SPEC N14). */
  .lede code { font-family: "Geist Mono", ui-monospace, monospace; font-size: 0.85em; overflow-wrap: anywhere; }

  .tally { display: flex; flex-wrap: wrap; gap: 0.5rem 1.75rem; margin: 1.5rem 0 0; padding: 0; list-style: none; }
  .tally li { display: flex; align-items: baseline; gap: 0.4rem; color: var(--ink-2); font-size: 0.85rem; }
  .tally b {
    font-family: "Geist Mono", ui-monospace, monospace; font-size: 1.35rem;
    font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums;
  }

  .filters { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1.5rem 0 0; align-items: center; }
  .filters span { color: var(--ink-3); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; margin-right: 0.3rem; }
  .filters button {
    font: inherit; font-size: 0.8rem; cursor: pointer;
    background: var(--surface); color: var(--ink-2);
    border: 1px solid var(--line); border-radius: 999px; padding: 0.25rem 0.7rem;
  }
  .filters button:hover { border-color: var(--ink-3); color: var(--ink); }
  .filters button[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .filters button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .board {
    display: grid; grid-auto-flow: column; grid-auto-columns: minmax(17.5rem, 1fr);
    gap: 1.25rem; margin-top: 1.75rem; overflow-x: auto; padding-bottom: 1rem;
    align-items: start;
  }
  /* Stacked on a phone, and the 17.5rem minimum must not survive the switch,
     or the lanes keep forcing a 280 px page wider than the screen. */
  @media (max-width: 900px) {
    .board { grid-auto-flow: row; grid-auto-columns: minmax(0, 1fr); overflow-x: visible; }
  }

  .lane-head { border-top: 2px solid var(--line); padding-top: 0.6rem; }
  .lane-julian .lane-head { border-top-color: var(--wait); }
  .lane-wip .lane-head { border-top-color: var(--accent); }
  .lane-ready .lane-head { border-top-color: var(--go); }
  .lane-head h2 {
    font-family: Fraunces, Georgia, serif; font-size: 1.05rem; font-weight: 600;
    margin: 0; display: flex; align-items: baseline; gap: 0.5rem;
  }
  .count {
    font-family: "Geist Mono", ui-monospace, monospace; font-size: 0.8rem;
    color: var(--ink-3); font-variant-numeric: tabular-nums;
  }
  .lane-head p { margin: 0.25rem 0 0; color: var(--ink-3); font-size: 0.75rem; line-height: 1.4; }
  .lane-cards { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.9rem; }

  .card {
    background: var(--surface); border: 1px solid var(--line); border-radius: 3px;
    padding: 0.7rem 0.8rem;
  }
  .card header { display: flex; align-items: center; gap: 0.5rem; }
  /* The number is set like a call number on a spine label: this is a
     catalogue of covers, and the numbers never change (CLAUDE.md). */
  .num {
    font-family: "Geist Mono", ui-monospace, monospace; font-size: 0.78rem;
    font-weight: 500; color: var(--on-accent); background: var(--accent);
    padding: 0.1rem 0.4rem; border-radius: 2px; font-variant-numeric: tabular-nums;
  }
  .phase, .group { color: var(--ink-3); font-size: 0.7rem; letter-spacing: 0.04em; }
  .group { margin-left: auto; font-family: "Geist Mono", ui-monospace, monospace; }
  .card { overflow-wrap: anywhere; }
  .card h3 { margin: 0.45rem 0 0; font-size: 0.92rem; font-weight: 600; line-height: 1.35; text-wrap: balance; }
  .gist { margin: 0.3rem 0 0; color: var(--ink-2); font-size: 0.8rem; line-height: 1.45; }
  .waits, .branch { margin: 0.45rem 0 0; font-size: 0.72rem; color: var(--ink-3); }
  .waits span {
    font-family: "Geist Mono", ui-monospace, monospace;
    background: var(--surface-2); padding: 0.05rem 0.3rem; border-radius: 2px;
  }
  .branch { font-family: "Geist Mono", ui-monospace, monospace; color: var(--accent); word-break: break-all; }

  .lane-done .card { background: transparent; border-style: dashed; }
  .lane-done .card h3 { font-weight: 500; color: var(--ink-2); }
  .lane-done .num { background: var(--surface-2); color: var(--ink-3); }
  .lane-done .gist { display: none; }

  .hidden { display: none !important; }
  footer.note { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--ink-3); font-size: 0.78rem; max-width: 70ch; }
  footer.note code { font-family: "Geist Mono", ui-monospace, monospace; }
</style>

<div class="wrap">
  <header class="top">
    <h1>Roadmap-Brett</h1>
    <p class="stamp">Stand ${esc(stamp)} · erzeugt aus ROADMAP.md</p>
  </header>
  <p class="lede">
    Eine Ansicht, kein zweiter Ort: jede Karte, jede Spalte und jede Zahl steht so in
    <code>ROADMAP.md</code>. Eine Karte bewegt sich, indem der Punkt dort bearbeitet und
    <code>npm run kanban</code> erneut ausgeführt wird. Produktion ist <code>${esc(production)}</code>.
  </p>

  <ul class="tally">
    <li><b>${open}</b> offen</li>
    <li><b>${done}</b> erledigt</li>
    <li><b>${items.filter(i => columnOf(i) === 'julian').length}</b> warten auf Julian</li>
    <li><b>${items.filter(i => columnOf(i) === 'wip').length}</b> in Arbeit</li>
    <li><b>${items.filter(i => columnOf(i) === 'ready').length}</b> bereit</li>
  </ul>

  <div class="filters">
    <span>Phase</span>
    <button type="button" data-filter-phase="alle" aria-pressed="true">alle</button>
    ${phaseFilters}
  </div>

  <div class="board">
${columns}
  </div>

  <footer class="note">
    Spalten: <b>Wartet auf Julian</b> sind Konten, Geld, Recht und Entscheidungen; <b>In Arbeit</b>
    heißt, ein Branch nennt den Punkt in einer Betreffzeile und ist noch nicht in Produktion;
    <b>Wartet auf etwas</b> kommt aus dem Abhängigkeits-Graphen der Roadmap. Wer eine Karte für
    falsch einsortiert hält, ändert den Punkt in <code>ROADMAP.md</code> — das Brett hat kein
    eigenes Gedächtnis.
  </footer>
</div>

<script>
  // One filter, phase only: the board is small enough that anything more
  // would be chrome. "alle" is the resting state, so the page at rest shows
  // everything (no filter to discover before the board makes sense).
  const buttons = [...document.querySelectorAll('[data-filter-phase]')];
  buttons.forEach(btn => btn.addEventListener('click', () => {
    const want = btn.dataset.filterPhase;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    document.querySelectorAll('.card').forEach(card => {
      card.classList.toggle('hidden', want !== 'alle' && card.dataset.phase !== want);
    });
    document.querySelectorAll('.lane').forEach(lane => {
      const visible = lane.querySelectorAll('.card:not(.hidden)').length;
      lane.querySelector('.count').textContent = String(visible);
    });
  }));
</script>`;
}

/* --------------------------------------------------------------------- main */

function main(): void {
  if (process.argv.includes('--fetch')) git(['fetch', 'origin', '--quiet']);

  const items = parseRoadmap();
  assignOwners(items);

  const waits = parseDependencies();
  const branches = branchesByItem();
  for (const item of items) {
    item.waitsOn = (waits.get(item.num) ?? []).filter(w => w !== item.num);
    item.branches = branches.get(item.num) ?? [];
    // A finished item that a branch still names is finished, not in progress.
    if (item.done) item.branches = [];
  }

  const stamp = new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  const production = cut(git(['log', '-1', '--format=%h %ad %s', '--date=short', PRODUCTION]), 58) || PRODUCTION;
  writeFileSync(OUT_FILE, render(items, stamp, production), 'utf8');

  const tally: Record<string, number> = {};
  for (const item of items) tally[columnOf(item)] = (tally[columnOf(item)] ?? 0) + 1;
  console.log(`geschrieben: ${path.relative(ROOT, OUT_FILE)}`);
  console.log(COLUMNS.map(c => `${c.title}: ${tally[c.id] ?? 0}`).join(' · '));
}

main();
