/**
 * ROADMAP.md read as data (ROADMAP 6.54, the Cockpit). Pure: every function
 * here takes the text and returns values, so the tests run on a fixture and
 * the generator on the real file. Moved and extended from the old
 * scripts/kanban.ts, whose rules it keeps:
 *
 *   - **the item lines** `- [ ] **6.5 …**` give number, title, state, and the
 *     block underneath is the item's full text;
 *   - **the assessment table** under "### Bewertung der offenen Punkte" gives
 *     verdict, effort and reason;
 *   - **the mermaid graph** under "### Abhängigkeiten" gives what waits on what;
 *   - **git** (not here, see git.ts) gives what is being worked on.
 *
 * Two fields are not data in the roadmap and are guessed by documented rules,
 * each of which a roadmap line can overrule: the **owner** (`**Wer:**`,
 * „Julian entscheidet", an exceptions table, the phase) and the **theme**
 * (`Thema: …` in the item, then its title, its subsection, the paths it
 * names, the phase). Julian, 2026-09-25: themes by rules in the script, a
 * wrong one corrected with „Thema:" in the roadmap line — never in the script.
 */
import { cut, plain } from './markdown';

export type Owner = 'Julian' | 'Claude' | 'beide';
export type Status = 'open' | 'julian' | 'wip' | 'deferred' | 'done';

export interface Assessment {
  /** First word of the verdict cell, lower-cased: tun, entscheiden, zurückstellen, … */
  verdict: string;
  verdictRaw: string;
  effort: string;
  why: string;
}

export interface Item {
  num: string;
  sort: [number, number, string];
  title: string;
  done: boolean;
  /** The major number: 4.1 is phase 4 wherever it stands in the document. */
  phase: string;
  /** "6.A Was ein Leser als Fehler sieht", when the phase has subsections. */
  group: string | null;
  owner: Owner;
  ownerSource: string;
  theme: string;
  /** Which rule gave the theme, so a wrong one can be traced and corrected. */
  themeSource: string;
  waitsOn: string[];
  gist: string;
  body: string[];
  assessment: Assessment | null;
  /** Repository paths named in backticks in the item's text. */
  files: string[];
  /** Line number (1-based) of the item line in ROADMAP.md. */
  line: number;
}

export interface NextStep {
  rank: string;
  what: string;
  who: string;
  effort: string;
  why: string;
  items: string[];
}

export interface Idea { idea: string; uses: string }

export interface Roadmap {
  items: Item[];
  nextSteps: NextStep[];
  /** Bullet lines of "### Stand", markdown. */
  stand: string[];
  ideas: Idea[];
}

export interface Theme { id: string; name: string; hint: string }

/** The twelve themes of the mock, in board order. */
export const THEMES: Theme[] = [
  { id: 'samml', name: 'Sammlungen', hint: '/collections, lab/collections, /curate, /suggest' },
  { id: 'start', name: 'Startseite', hint: 'Rondell, kuratierte Wand, Regal' },
  { id: 'suche', name: 'Suche', hint: 'Suchfeld, Karten, Ranking' },
  { id: 'detail', name: 'Detailseite', hint: 'Wand, Seitenleiste, Jahrzehnte, Ladeszene' },
  { id: 'cover', name: 'Cover & Faltung', hint: 'Signaturen, Dubletten, Index' },
  { id: 'daten', name: 'Daten & Quellen', hint: 'Open Library, Google, ISFDB, Jahre' },
  { id: 'spiel', name: 'Cover-Spiel', hint: '/versus, Redis, Stimmen' },
  { id: 'reich', name: 'Reichweite & Messen', hint: 'Domain, Search Console, Gattungen, Analyse' },
  { id: 'betrieb', name: 'Betrieb & Recht', hint: 'Kontingent, Firewall, Impressum, Hobby-Plan' },
  { id: 'geld', name: 'Geld', hint: 'Partnerprogramme, Werbung, Spenden' },
  { id: 'werk', name: 'Werkzeug & Arbeitsweise', hint: 'Hooks, Skills, CLAUDE.md, Cockpit' },
  { id: 'lab', name: 'Lab-Ideen', hint: 'Experimente ohne eigenen Seitenpunkt' },
];

export const STATUSES: Array<{ id: Status; name: string; sub: string }> = [
  { id: 'open', name: 'Offen', sub: 'Claude kann anfangen' },
  { id: 'julian', name: 'Wartet auf Julian', sub: 'Entscheidung, Konto, Blick' },
  { id: 'wip', name: 'In Arbeit', sub: 'Branch mit Commits vor Produktion' },
  { id: 'deferred', name: 'Zurückgestellt', sub: 'Auslöser fehlt noch' },
  { id: 'done', name: 'Erledigt', sub: 'abgehakt' },
];

/** Title words → theme, first match wins. Checked against the title only, which says what the item is about. */
const TITLE_RULES: Array<[RegExp, string]> = [
  [/Sammlung|Kuratier-App für Sammlungen|Reihe\b|Vorschläge von Freunden|\/curate|\/suggest/i, 'samml'],
  [/Cover-Spiel|Hot or Not|\/versus|Duell|Stimmen/i, 'spiel'],
  [/Cockpit|Dashboard|Kanban|Brett|Hook|Skill|CLAUDE\.md|Checkliste|Worktree|Arbeitsweise|Lab\b/i, 'werk'],
  [/Startseite|Rondell|Kuratierung|Rotation|Startwand/i, 'start'],
  [/Suche|Suchfeld|Ranking|Tippfehler|Query/i, 'suche'],
  [/Falt|Dublette|Signatur|Index|Ähnlich|gleiche[rn]? Entwurf|Hash/i, 'cover'],
  [/Detailseite|Werkseite|Wand|Seitenleiste|Jahrzehnt|Ladeszene|Ladebild|Kauf-Link/i, 'detail'],
  [/Open Library|Google|ISFDB|ISBNdb|Übersetzung|Quelle|Jahr\b|Erstausgabe|Klappentext|Cover-Gestalter|Wer hat das Cover/i, 'daten'],
  [/Domain|Search Console|Sitemap|Analyse|Messen|Reichweite|Gattung|SEO|Kanal/i, 'reich'],
  [/Firewall|Impressum|Datenschutz|Kontingent|Hobby|Überwachung|Recht|Konto|Abnahme/i, 'betrieb'],
  [/Partner|Werbung|Spende|Affiliate|Provision|Geld|Einnahme/i, 'geld'],
];

/** Subsection of phase 6 → theme. */
const GROUP_RULES: Record<string, string> = { '6.D': 'start', '6.E': 'werk' };

/** Paths named in the text → theme, used when title and group say nothing. */
const PATH_RULES: Array<[RegExp, string]> = [
  [/^(lib\/collections|lab\/collections|app\/collections|app\/curate|app\/suggest|lib\/curate|lib\/suggest|data\/collections)/, 'samml'],
  [/^(app\/versus|lib\/hotornot|lab\/hotornot|lab\/duel|data\/versus)/, 'spiel'],
  [/^(lib\/imagehash|lib\/imagesig|lib\/coverhash|lib\/coverindex|data\/cover-index|lab\/fold)/, 'cover'],
  [/^(lib\/works\.ts|lib\/work\.ts|components\/BookDetail|components\/CoverGallery|app\/book)/, 'detail'],
  [/^(lib\/search|components\/SearchBar|components\/BookGrid|app\/api\/search)/, 'suche'],
  [/^(lib\/sources|lib\/isbn|lib\/googlequota|lib\/blurb)/, 'daten'],
  [/^(components\/Hero|lib\/hero|data\/curated|lab\/curate|app\/page\.tsx)/, 'start'],
  [/^(scripts\/kanban|scripts\/worktrees|scripts\/cockpit|\.claude\/)/, 'werk'],
  [/^lab\//, 'lab'],
];

const PHASE_THEME: Record<string, string> = {
  '0': 'betrieb', '1': 'betrieb', '2': 'betrieb', '3': 'reich', '4': 'geld', '5': 'reich', '6': 'daten',
};

/** Owner where the text does not say and the phase default would be wrong (from kanban.ts). */
export const OWNER_EXCEPTIONS: Record<string, Owner> = {
  '1.8': 'Julian', '1.9a': 'Julian', '2.2': 'Julian', '2.5': 'Julian', '2.6': 'Julian',
  '2.4': 'beide', '4.9': 'beide', '6.6': 'Julian', '6.18': 'Julian', '5.5': 'Julian',
  '5.6': 'Julian', '5.8a': 'beide',
};

const ITEM_LINE = /^- \[([ x])\] \*\*(\d+)\.(\d+)([a-z]?)\s+([^*]+?)\*\*/;
const GROUP_HEAD = /^### (6\.[A-E] .+)$/;
const ANY_HEAD = /^#{2,3} /;
const PATH_IN_TICKS = /`((?:app|components|lib|scripts|lab|data|docs|public)\/[\w./@\[\]-]*|(?:SPEC|ROADMAP|CLAUDE|README)\.md|package\.json|next\.config\.ts)`/g;

export function themeName(id: string): string {
  return THEMES.find(t => t.id === id)?.name ?? id;
}

/** Paths named in backticks, first occurrence order, without trailing punctuation. */
export function filesIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(PATH_IN_TICKS)) {
    const p = m[1].replace(/[.,;:]+$/, '');
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

/** The theme of an item, and the rule that gave it. */
export function themeOf(item: Pick<Item, 'num' | 'title' | 'group' | 'body' | 'files'>): { theme: string; source: string } {
  const text = item.body.join('\n');
  const tag = /(?:\*\*)?Thema:(?:\*\*)?\s*([^.;\n*]+)/.exec(text);
  if (tag) {
    const want = tag[1].trim().toLowerCase();
    const hit = THEMES.find(t => t.name.toLowerCase() === want || t.id === want || t.name.toLowerCase().startsWith(want));
    if (hit) return { theme: hit.id, source: `„Thema: ${tag[1].trim()}“ im Punkt` };
  }
  for (const [re, id] of TITLE_RULES) {
    const m = re.exec(item.title);
    if (m) return { theme: id, source: `Titel („${m[0]}“)` };
  }
  const g = item.group?.slice(0, 3);
  if (g && GROUP_RULES[g]) return { theme: GROUP_RULES[g], source: `Abschnitt ${item.group}` };
  for (const f of item.files) {
    for (const [re, id] of PATH_RULES) if (re.test(f)) return { theme: id, source: `Pfad ${f}` };
  }
  const phase = item.num.split('.')[0];
  return { theme: PHASE_THEME[phase] ?? 'daten', source: `Phase ${phase}` };
}

export function ownerOf(item: Pick<Item, 'num' | 'body' | 'phase'>): { owner: Owner; source: string } {
  const text = item.body.join('\n');
  if (/\*\*Wer:\*\*\s*Claude baut, Julian/.test(text)) return { owner: 'beide', source: '„Wer: Claude baut, Julian …“' };
  if (/—\s*\*\*Julian entscheidet/.test(text)) return { owner: 'Julian', source: '„Julian entscheidet“' };
  if (OWNER_EXCEPTIONS[item.num]) return { owner: OWNER_EXCEPTIONS[item.num], source: 'Ausnahmetabelle im Skript' };
  const julian = item.phase === '0' || item.phase === '4';
  return { owner: julian ? 'Julian' : 'Claude', source: `Phase ${item.phase}` };
}

function parseItems(lines: string[]): Item[] {
  const items: Item[] = [];
  let group: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^## /.test(line) || /^### Erledigt in Phase/.test(line)) { group = null; }
    const gh = GROUP_HEAD.exec(line);
    if (gh) { group = gh[1]; continue; }
    const m = ITEM_LINE.exec(line);
    if (!m) continue;

    const body = [line];
    for (let j = i + 1; j < lines.length; j++) {
      if (ITEM_LINE.test(lines[j]) || ANY_HEAD.test(lines[j]) || lines[j].trim() === '---') break;
      body.push(lines[j]);
    }
    while (body.length > 1 && body[body.length - 1].trim() === '') body.pop();

    const num = `${m[2]}.${m[3]}${m[4]}`;
    const title = m[5].replace(/[.:\s]+$/, '').trim();
    const rest = plain(line.slice(m[0].length).replace(/^[\s.:—-]+/, ''));
    const sentences = rest.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„«(])/);
    const phase = m[2];
    const partial = { num, title, group, body, phase, files: filesIn(body.join('\n')) };
    const { theme, source: themeSource } = themeOf(partial);
    const { owner, source: ownerSource } = ownerOf(partial);
    items.push({
      ...partial,
      sort: [Number(m[2]), Number(m[3]), m[4]],
      done: m[1] === 'x',
      owner, ownerSource, theme, themeSource,
      waitsOn: [],
      gist: cut(sentences.slice(0, 2).join(' '), 260),
      assessment: null,
      line: i + 1,
    });
  }
  return items;
}

function section(text: string, heading: string): string {
  const start = text.indexOf(heading);
  if (start === -1) return '';
  const end = text.slice(start + heading.length).search(/\n#{2,3} /);
  return end === -1 ? text.slice(start) : text.slice(start, start + heading.length + end);
}

export function parseAssessment(text: string): Map<string, Assessment> {
  const out = new Map<string, Assessment>();
  for (const line of section(text, '### Bewertung der offenen Punkte').split('\n')) {
    const m = /^\|\s*(\d+\.\d+[a-z]?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    const verdict = m[2].split(/[\s,/]/)[0].toLowerCase();
    out.set(m[1], { verdict, verdictRaw: m[2], effort: m[3] === '—' ? '' : m[3], why: m[4] });
  }
  return out;
}

/** What waits on what, from the mermaid graph (kanban.ts's reading). */
export function parseDependencies(text: string): Map<string, string[]> {
  const waits = new Map<string, string[]>();
  const block = /### Abhängigkeiten[\s\S]*?```mermaid([\s\S]*?)```/.exec(text);
  if (!block) return waits;
  const label = new Map<string, string>();
  const NODE = /(\w+)(?:\[\[?"([^"]+)"\]?\]|\(\["([^"]+)"\]\)|\(\("([^"]+)"\)\))/g;
  for (const m of block[1].matchAll(NODE)) label.set(m[1], (m[2] ?? m[3] ?? m[4]).trim());
  const name = (id: string) => {
    const t = label.get(id) ?? id;
    const num = /^(\d+\.\d+[a-z]?)/.exec(t);
    return num ? num[1] : t;
  };
  for (const raw of block[1].split('\n')) {
    const line = raw.trim();
    if (!/-[.-]*->/.test(line)) continue;
    const parts = line.split(/\s*-[.-]*->\s*/).map(seg => /^(\w+)/.exec(seg.trim())?.[1] ?? null).filter((x): x is string => !!x);
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

function tableRows(block: string): string[][] {
  return block.split('\n')
    .filter(l => l.trim().startsWith('|') && !/^\|\s*:?-{2,}/.test(l.trim()))
    .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
}

export function parseNextSteps(text: string): NextStep[] {
  const rows = tableRows(section(text, '### Nächste Schritte')).slice(1);
  return rows.filter(r => r.length >= 5).map(([rank, what, who, effort, why]) => ({
    rank, what, who, effort, why,
    items: [...new Set([...what.matchAll(/(?<![\w.])(\d\.\d{1,2}[a-z]?)(?![\w.])/g)].map(m => m[1]))],
  }));
}

export function parseStand(text: string): string[] {
  return section(text, '### Stand').split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
}

export function parseIdeas(text: string): Idea[] {
  const block = section(text, '### Ideen vom');
  return tableRows(block).slice(1).filter(r => r.length >= 2).map(r => ({ idea: r[0], uses: r[1] }));
}

export function parseRoadmap(text: string): Roadmap {
  const items = parseItems(text.split('\n'));
  const assessment = parseAssessment(text);
  const waits = parseDependencies(text);
  for (const item of items) {
    item.assessment = assessment.get(item.num) ?? null;
    item.waitsOn = (waits.get(item.num) ?? []).filter(w => w !== item.num);
  }
  return { items, nextSteps: parseNextSteps(text), stand: parseStand(text), ideas: parseIdeas(text) };
}

/**
 * The five columns (Julian, 2026-09-25: no "blocked" column, a „wartet auf"
 * label instead). Branch beats assessment: work that exists is in progress,
 * whatever the table said on 2026-09-12 — the contradiction is a hint.
 */
export function statusOf(
  item: Pick<Item, 'done' | 'assessment' | 'owner' | 'ownerSource'>,
  workingBranches: string[],
  openWaits: string[] = [],
): Status {
  if (item.done) return 'done';
  if (workingBranches.length > 0) return 'wip';
  const v = item.assessment?.verdict;
  if (v === 'zurückstellen') return 'deferred';
  if (v === 'entscheiden' || v === 'streichen' || v === 'erledigt?') return 'julian';
  // Most of phase 4 is Julian's by the phase default, but it waits on
  // visitors, not on him; his column would tell him he has thirty things to
  // do when the roadmap says the opposite (kanban.ts, 2026-09-12).
  if (item.owner === 'Julian' && openWaits.length > 0 && item.ownerSource.startsWith('Phase')) return 'deferred';
  if (item.owner === 'Julian') return 'julian';
  return 'open';
}

/** The waits that still hold: an open item, or something that is not an item (visitors, a day of logs). */
export function openWaits(item: Pick<Item, 'waitsOn'>, byNum: Map<string, Pick<Item, 'done'>>): string[] {
  return item.waitsOn.filter(w => !byNum.get(w)?.done);
}
