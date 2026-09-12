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
 * Four sources, no invention:
 *   - **the item lines** `- [ ] **6.5 …**` give number, title, state, phase,
 *     and the whole block underneath is the card's full text;
 *   - **the assessment table** under "### Bewertung der offenen Punkte" gives
 *     verdict, effort and reason per item — Julian asked for the assessment
 *     the same day, and the board shows it on the card rather than in a
 *     second document;
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
/** Relative links in the roadmap resolve here, so a card can open the file it cites. */
const REPO_BLOB = 'https://github.com/heissjl/beautifulbooks/blob/main/';

type Owner = 'Julian' | 'Claude' | 'beide';

interface Assessment {
  /** The first word of the verdict cell, lower-cased: tun, entscheiden, zurückstellen, … */
  verdict: string;
  /** The cell as written, e.g. "tun, kleiner" — the verdict keeps its nuance. */
  verdictRaw: string;
  effort: string;
  why: string;
}

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
  /** The first sentences of the item, as the card's second line. */
  gist: string;
  /** The whole block from the roadmap, raw markdown lines. */
  body: string[];
  assessment: Assessment | null;
}

/* ------------------------------------------------------------------ roadmap */

const ITEM_LINE = /^- \[([ x])\] \*\*(\d+)\.(\d+)([a-z]?)\s+([^*]+?)\*\*/;
const PHASE_HEAD = /^## Phase (\d+)/;
const GROUP_HEAD = /^### (6\.[A-D] .+)$/;
const DONE_HEAD = /^### Erledigt in Phase/;
const ANY_HEAD = /^#{2,3} /;
const LIST_LINE = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/;

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

    // The block: this line and everything up to the next item, heading or rule.
    const body = [line];
    for (let j = i + 1; j < lines.length; j++) {
      if (ITEM_LINE.test(lines[j]) || ANY_HEAD.test(lines[j]) || lines[j].trim() === '---') break;
      body.push(lines[j]);
    }
    while (body.length > 1 && body[body.length - 1].trim() === '') body.pop();

    const num = `${m[2]}.${m[3]}${m[4]}`;
    const title = m[5].replace(/[.:\s]+$/, '').trim();
    // The gist: what follows the bold title, two sentences of it.
    const rest = line.slice(m[0].length).replace(/^[\s.:—-]+/, '');
    const plain = rest
      .replace(/\*\*/g, '').replace(/[`*_]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    const sentences = plain.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„«(])/);
    const gist = cut(sentences.slice(0, 2).join(' '), 260);

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
      gist,
      body,
      assessment: null,
    });
  }
  return items;
}

/** Owner from the item's own text, else the exceptions, else the phase. */
function assignOwners(items: Item[]): void {
  for (const item of items) {
    const text = item.body.join('\n');
    if (/\*\*Wer:\*\*\s*Claude baut, Julian/.test(text)) { item.owner = 'beide'; continue; }
    if (/—\s*\*\*Julian entscheidet/.test(text)) { item.owner = 'Julian'; continue; }
    if (OWNER_EXCEPTIONS[item.num]) { item.owner = OWNER_EXCEPTIONS[item.num]; continue; }
    item.owner = item.phase === '0' || item.phase === '4' ? 'Julian' : 'Claude';
  }
}

/**
 * The assessment table: `| 6.5 | aufteilen | je 1 h | … |`. The first word of
 * the verdict cell is the vocabulary word; the cell as written is kept too,
 * because "tun, kleiner" says more than "tun".
 */
function parseAssessment(): Map<string, Assessment> {
  const body = readFileSync(ROADMAP, 'utf8');
  const out = new Map<string, Assessment>();
  const start = body.indexOf('### Bewertung der offenen Punkte');
  if (start === -1) return out;
  const end = body.indexOf('\n### ', start + 10);
  const section = body.slice(start, end === -1 ? undefined : end);
  for (const line of section.split('\n')) {
    const m = /^\|\s*(\d+\.\d+[a-z]?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    const verdictRaw = m[2];
    const verdict = verdictRaw.split(/[\s,/]/)[0].toLowerCase();
    out.set(m[1], { verdict, verdictRaw, effort: m[3] === '—' ? '' : m[3], why: m[4] });
  }
  return out;
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

type Column = 'julian' | 'wip' | 'ready' | 'blocked' | 'deferred' | 'done';

const COLUMNS: Array<{ id: Column; title: string; note: string }> = [
  { id: 'julian', title: 'Wartet auf Julian', note: 'Konten, Geld, Recht, Entscheidungen — Claude kann hier nichts tun' },
  { id: 'wip', title: 'In Arbeit', note: 'ein Branch nennt den Punkt in einer Betreffzeile, noch nicht in Produktion' },
  { id: 'ready', title: 'Bereit', note: 'offen, nichts blockiert, laut Bewertung zu tun — hier wird das Nächste genommen' },
  { id: 'blocked', title: 'Wartet auf etwas', note: 'laut dem Abhängigkeits-Graphen der Roadmap' },
  { id: 'deferred', title: 'Zurückgestellt', note: 'richtig, aber der Auslöser fehlt noch — laut Bewertung vom 2026-09-12' },
  { id: 'done', title: 'Erledigt', note: 'bleibt stehen, Langtext im Archiv' },
];

const PHASE_NAME: Record<string, string> = {
  '0': 'Entscheidungen', '1': 'Vor echtem Verkehr', '2': 'Betrieb',
  '3': 'Messen', '4': 'Geld', '5': 'Reichweite', '6': 'Qualität',
};

function columnOf(item: Item): Column {
  if (item.done) return 'done';
  if (item.branches.length > 0) return 'wip';
  const v = item.assessment?.verdict;
  // The assessment knows more than the graph: an item whose trigger has not
  // come is not "blocked" on a number, it is parked.
  if (v === 'zurückstellen') return 'deferred';
  if (v === 'entscheiden' || v === 'streichen' || v === 'erledigt?') return 'julian';
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

/** Inline markdown of the roadmap: bold, italics, code, links. Escapes first. */
function inline(md: string): string {
  let s = esc(md);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?![\w*])/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const url = /^https?:\/\//.test(href) ? href : href.startsWith('#') ? REPO_BLOB + 'ROADMAP.md' + href : REPO_BLOB + href.replace(/^\.\//, '');
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  return s;
}

/**
 * The item's whole block as HTML: paragraphs, bullets (one level of nesting),
 * numbered steps, and the small tables the roadmap uses for measurements.
 * This is a reader for one document's habits, not a markdown engine.
 */
function renderBody(body: string[]): string {
  const out: string[] = [];
  const first = body[0].replace(ITEM_LINE, '').replace(/^[\s.:—-]+/, '');
  if (first.trim()) out.push(`<p>${inline(first)}</p>`);

  let i = 1;
  while (i < body.length) {
    const t = body[i].trim();
    if (t === '') { i++; continue; }

    if (t.startsWith('|')) {
      const rows: string[] = [];
      while (i < body.length && body[i].trim().startsWith('|')) { rows.push(body[i].trim()); i++; }
      const cells = (r: string) => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(rows[0]);
      const data = rows.slice(1).filter(r => !/^\|\s*:?-{2,}/.test(r));
      out.push('<table><thead><tr>' + head.map(h => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>'
        + data.map(r => '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('')
        + '</tbody></table>');
      continue;
    }

    const li = LIST_LINE.exec(body[i]);
    if (li) {
      const indent = li[1].length;
      const tag = /^\s*\d+\./.test(body[i]) ? 'ol' : 'ul';
      out.push(`<${tag}>`);
      while (i < body.length) {
        const m = LIST_LINE.exec(body[i]);
        if (m && m[1].length === indent) {
          // the bullet and its continuation lines (deeper indent, no marker)
          let text = m[2].replace(/^\[ \]\s*/, '☐ ');
          i++;
          const nested: string[] = [];
          while (i < body.length && body[i].trim() !== '') {
            const n = LIST_LINE.exec(body[i]);
            if (n && n[1].length === indent) break;
            if (n && n[1].length > indent) { nested.push(body[i].slice(indent + 2)); i++; continue; }
            if (nested.length) { nested.push(body[i].slice(indent + 2)); i++; continue; }
            if (body[i].trim().startsWith('|')) break;
            text += ' ' + body[i].trim(); i++;
          }
          const sub = nested.length ? renderBody(['- [ ] **0.0 x** ', ...nested]).replace(/^<p>[^]*?<\/p>\n?/, '') : '';
          out.push(`<li>${inline(text)}${sub}</li>`);
        } else if (body[i].trim() === '') {
          // a blank line ends the list unless the next non-blank is a same-level item
          let k = i + 1;
          while (k < body.length && body[k].trim() === '') k++;
          const n = k < body.length ? LIST_LINE.exec(body[k]) : null;
          if (n && n[1].length === indent) { i = k; continue; }
          break;
        } else break;
      }
      out.push(`</${tag}>`);
      continue;
    }

    // paragraph: consecutive lines that are not blank, not a table, not a list
    let text = t;
    i++;
    while (i < body.length && body[i].trim() !== '' && !body[i].trim().startsWith('|') && !LIST_LINE.test(body[i])) {
      text += ' ' + body[i].trim(); i++;
    }
    out.push(`<p>${inline(text)}</p>`);
  }
  return out.join('\n');
}

function card(item: Item): string {
  const a = item.assessment;
  const waits = item.waitsOn.length
    ? `<p class="waits">wartet auf ${item.waitsOn.map(w => `<span>${esc(w)}</span>`).join(', ')}</p>`
    : '';
  const branch = item.branches.length
    ? `<p class="branch">${item.branches.map(b => esc(b)).join(', ')}</p>`
    : '';
  const group = item.group ? `<span class="group" title="${esc(item.group)}">${esc(item.group.slice(0, 3))}</span>` : '';
  const verdict = a
    ? `<span class="verdict v-${esc(a.verdict.replace('?', 'q'))}" title="Bewertung 2026-09-12">${esc(a.verdictRaw)}</span>`
    : '';
  const effort = a?.effort ? `<span class="effort">${esc(a.effort)}</span>` : '';
  const why = a ? `<p class="why">${inline(a.why)}</p>` : '';
  return `<article class="card" data-phase="${item.phase}" data-owner="${item.owner}" data-verdict="${esc(a?.verdict ?? '')}">
  <header>
    <span class="num">${esc(item.num)}</span>
    <span class="phase">P${item.phase} ${esc(PHASE_NAME[item.phase] ?? '')}</span>
    ${group}
    <span class="owner owner-${item.owner}">${item.owner}</span>
  </header>
  <h3>${esc(item.title)}</h3>
  ${item.done ? '' : `<p class="gist">${esc(item.gist)}</p>`}
  ${a ? `<div class="assessment"><div class="chips">${verdict}${effort}</div>${why}</div>` : ''}
  ${waits}${branch}
  ${item.done ? '' : `<details><summary>Ganzer Text aus ROADMAP.md</summary><div class="body">${renderBody(item.body)}</div></details>`}
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
  const n = (c: Column) => byColumn.get(c)!.length;
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
    .map(([num, name]) => `<button type="button" data-filter="phase" data-value="${num}">P${num} ${name}</button>`).join('');

  // The published page gets a viewport meta from its host; the local file
  // needs its own, or a phone lays it out at 980 px and every measurement
  // at 390 px is a picture of the wrong page (seen 2026-09-12).
  return `<title>Beautiful Books Roadmap-Brett</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
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
    --wait: #7a6a3f; --go: #3f6a52; --park: #6b6560;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #131110; --surface: #1b1815; --surface-2: #26221e;
      --ink: #efe8dd; --ink-2: #b2a99b; --ink-3: #837b6f;
      --line: #2e2925; --accent: #dbac94; --on-accent: #1a1210;
      --wait: #c4b283; --go: #8fbba1; --park: #9a938c;
    }
  }
  :root[data-theme="dark"] {
    --bg: #131110; --surface: #1b1815; --surface-2: #26221e;
    --ink: #efe8dd; --ink-2: #b2a99b; --ink-3: #837b6f;
    --line: #2e2925; --accent: #dbac94; --on-accent: #1a1210;
    --wait: #c4b283; --go: #8fbba1; --park: #9a938c;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: Geist, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 15px; line-height: 1.5;
  }
  .wrap { max-width: 1700px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }

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
  code { font-family: "Geist Mono", ui-monospace, monospace; font-size: 0.85em; overflow-wrap: anywhere; }

  .tally { display: flex; flex-wrap: wrap; gap: 0.5rem 1.75rem; margin: 1.5rem 0 0; padding: 0; list-style: none; }
  .tally li { display: flex; align-items: baseline; gap: 0.4rem; color: var(--ink-2); font-size: 0.85rem; }
  .tally b {
    font-family: "Geist Mono", ui-monospace, monospace; font-size: 1.35rem;
    font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums;
  }

  .filters { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0 0; align-items: center; }
  .filters .label { color: var(--ink-3); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; margin-right: 0.3rem; min-width: 3.2rem; }
  .filters button {
    font: inherit; font-size: 0.8rem; cursor: pointer;
    background: var(--surface); color: var(--ink-2);
    border: 1px solid var(--line); border-radius: 999px; padding: 0.25rem 0.7rem;
  }
  .filters button:hover { border-color: var(--ink-3); color: var(--ink); }
  .filters button[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .filters button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .board {
    display: grid; grid-auto-flow: column; grid-auto-columns: minmax(19rem, 1fr);
    gap: 1.25rem; margin-top: 1.75rem; overflow-x: auto; padding-bottom: 1rem;
    align-items: start;
  }
  /* Stacked on a phone, and the minimum must not survive the switch, or the
     lanes keep forcing a page wider than the screen. */
  @media (max-width: 900px) {
    .board { grid-auto-flow: row; grid-auto-columns: minmax(0, 1fr); overflow-x: visible; }
  }

  .lane-head { border-top: 2px solid var(--line); padding-top: 0.6rem; }
  .lane-julian .lane-head { border-top-color: var(--wait); }
  .lane-wip .lane-head { border-top-color: var(--accent); }
  .lane-ready .lane-head { border-top-color: var(--go); }
  .lane-deferred .lane-head { border-top-color: var(--park); }
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
    padding: 0.7rem 0.8rem; overflow-wrap: anywhere;
  }
  .card header { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  /* The number is set like a call number on a spine label: this is a
     catalogue of covers, and the numbers never change (CLAUDE.md). */
  .num {
    font-family: "Geist Mono", ui-monospace, monospace; font-size: 0.78rem;
    font-weight: 500; color: var(--on-accent); background: var(--accent);
    padding: 0.1rem 0.4rem; border-radius: 2px; font-variant-numeric: tabular-nums;
  }
  .phase, .group { color: var(--ink-3); font-size: 0.7rem; letter-spacing: 0.04em; }
  .group { font-family: "Geist Mono", ui-monospace, monospace; }
  .owner {
    margin-left: auto; font-size: 0.66rem; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 0.05rem 0.45rem; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-2);
  }
  .owner-Julian { border-color: var(--wait); color: var(--wait); }
  .owner-beide { border-style: dashed; }
  .card h3 { margin: 0.45rem 0 0; font-size: 0.92rem; font-weight: 600; line-height: 1.35; text-wrap: balance; }
  .gist { margin: 0.3rem 0 0; color: var(--ink-2); font-size: 0.8rem; line-height: 1.45; }

  .assessment { margin-top: 0.55rem; padding-top: 0.5rem; border-top: 1px dashed var(--line); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
  .verdict {
    font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em;
    padding: 0.1rem 0.5rem; border-radius: 2px; background: var(--surface-2); color: var(--ink);
  }
  .v-tun { background: var(--go); color: var(--on-accent); }
  .v-entscheiden, .v-erledigtq { background: var(--wait); color: var(--on-accent); }
  .v-zurückstellen { background: var(--park); color: var(--on-accent); }
  .v-streichen { background: var(--accent); color: var(--on-accent); }
  .effort {
    font-family: "Geist Mono", ui-monospace, monospace; font-size: 0.72rem; color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }
  .why { margin: 0.35rem 0 0; font-size: 0.78rem; line-height: 1.45; color: var(--ink-2); }
  .why a { color: var(--accent); }

  .waits, .branch { margin: 0.45rem 0 0; font-size: 0.72rem; color: var(--ink-3); }
  .waits span {
    font-family: "Geist Mono", ui-monospace, monospace;
    background: var(--surface-2); padding: 0.05rem 0.3rem; border-radius: 2px;
  }
  .branch { font-family: "Geist Mono", ui-monospace, monospace; color: var(--accent); }

  details { margin-top: 0.55rem; }
  summary { cursor: pointer; font-size: 0.74rem; color: var(--ink-3); list-style: none; display: flex; align-items: center; gap: 0.35rem; }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: ""; width: 0; height: 0; border: 4px solid transparent; border-left: 5px solid var(--ink-3); transition: transform 0.15s; }
  details[open] summary::before { transform: rotate(90deg); }
  summary:hover { color: var(--ink); }
  summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .body { margin-top: 0.5rem; font-size: 0.8rem; line-height: 1.5; color: var(--ink-2); }
  .body p { margin: 0.4rem 0; }
  .body ul, .body ol { margin: 0.3rem 0; padding-left: 1.2rem; }
  .body li { margin: 0.2rem 0; }
  .body table { border-collapse: collapse; margin: 0.5rem 0; font-size: 0.75rem; display: block; overflow-x: auto; max-width: 100%; }
  .body th, .body td { border: 1px solid var(--line); padding: 0.2rem 0.45rem; text-align: left; vertical-align: top; }
  .body th { color: var(--ink); font-weight: 600; background: var(--surface-2); }
  .body a { color: var(--accent); }
  .body strong { color: var(--ink); }

  .lane-done .card { background: transparent; border-style: dashed; }
  .lane-done .card h3 { font-weight: 500; color: var(--ink-2); }
  .lane-done .num { background: var(--surface-2); color: var(--ink-3); }

  .hidden { display: none !important; }
  footer.note { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--ink-3); font-size: 0.78rem; max-width: 70ch; line-height: 1.6; }
  @media (prefers-reduced-motion: reduce) { summary::before { transition: none; } }
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
    <li><b>${n('ready')}</b> bereit</li>
    <li><b>${n('wip')}</b> in Arbeit</li>
    <li><b>${n('julian')}</b> bei Julian</li>
    <li><b>${n('blocked') + n('deferred')}</b> warten</li>
    <li><b>${done}</b> erledigt</li>
  </ul>

  <div class="filters">
    <span class="label">Phase</span>
    <button type="button" data-filter="phase" data-value="alle" aria-pressed="true">alle</button>
    ${phaseFilters}
  </div>
  <div class="filters">
    <span class="label">Wer</span>
    <button type="button" data-filter="owner" data-value="alle" aria-pressed="true">alle</button>
    <button type="button" data-filter="owner" data-value="Julian">Julian</button>
    <button type="button" data-filter="owner" data-value="Claude">Claude</button>
    <button type="button" data-filter="owner" data-value="beide">beide</button>
  </div>

  <div class="board">
${columns}
  </div>

  <footer class="note">
    Jede offene Karte trägt die <b>Bewertung vom 2026-09-12</b> aus der Roadmap: das Urteil
    (<span class="verdict v-tun">tun</span> <span class="verdict v-entscheiden">entscheiden</span>
    <span class="verdict v-zurückstellen">zurückstellen</span> <span class="verdict v-streichen">streichen</span>
    <span class="verdict">zusammenlegen · aufteilen · erledigt?</span>), den geschätzten Aufwand und den Grund.
    „Ganzer Text" klappt den Punkt auf, wie er in <code>ROADMAP.md</code> steht. Wer eine Karte für falsch
    einsortiert hält, ändert den Punkt oder seine Bewertungszeile dort — das Brett hat kein eigenes Gedächtnis.
  </footer>
</div>

<script>
  // Two filters, phase and owner, combined; "alle" is the resting state, so
  // the page at rest shows everything.
  const state = { phase: 'alle', owner: 'alle' };
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const apply = () => {
    document.querySelectorAll('.card').forEach(card => {
      const hide = (state.phase !== 'alle' && card.dataset.phase !== state.phase)
        || (state.owner !== 'alle' && card.dataset.owner !== state.owner);
      card.classList.toggle('hidden', hide);
    });
    document.querySelectorAll('.lane').forEach(lane => {
      lane.querySelector('.count').textContent = String(lane.querySelectorAll('.card:not(.hidden)').length);
    });
  };
  buttons.forEach(btn => btn.addEventListener('click', () => {
    const kind = btn.dataset.filter;
    state[kind] = btn.dataset.value;
    buttons.filter(b => b.dataset.filter === kind).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    apply();
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
  const assessment = parseAssessment();
  for (const item of items) {
    item.waitsOn = (waits.get(item.num) ?? []).filter(w => w !== item.num);
    item.branches = branches.get(item.num) ?? [];
    // A finished item that a branch still names is finished, not in progress.
    if (item.done) item.branches = [];
    item.assessment = assessment.get(item.num) ?? null;
  }

  const stamp = new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  const production = cut(git(['log', '-1', '--format=%h %ad %s', '--date=short', PRODUCTION]), 58) || PRODUCTION;
  writeFileSync(OUT_FILE, render(items, stamp, production), 'utf8');

  const tally: Record<string, number> = {};
  for (const item of items) tally[columnOf(item)] = (tally[columnOf(item)] ?? 0) + 1;
  const unassessed = items.filter(i => !i.done && !i.assessment).map(i => i.num);
  console.log(`geschrieben: ${path.relative(ROOT, OUT_FILE)}`);
  console.log(COLUMNS.map(c => `${c.title}: ${tally[c.id] ?? 0}`).join(' · '));
  if (unassessed.length) console.log(`ohne Bewertung: ${unassessed.join(', ')}`);
}

main();
