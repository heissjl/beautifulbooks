/**
 * Reads everything the Cockpit shows from files and git, and hands the
 * values to the pure modules (ROADMAP 6.54). The network is not touched here:
 * production's snapshot and the `vercel env ls` names are passed in, so a
 * regeneration after a file change never asks production again.
 *
 * **No secret value enters the returned data.** Settings carry names and
 * where they are set; the values stay in the main `.env.local` and are read
 * by the server only when „zeigen" is pressed (env.ts).
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { CollectionRecord } from '../../lib/collections';
import { latestFeatureDate, parseFeatures, parseHistory, parseLabTable, parsePlansIndex, readmeGist, type HistoryEntry } from './docs';
import { envChecks, envNamesInCode, isSecret, type VercelVar } from './env';
import { fileAtProduction, git, itemsInSubject, lastProductionChange, mainRoot, parseWorktrees, productionHead, readBranches, workByItem, PRODUCTION } from './git';
import { deriveHints, type Hint } from './hints';
import { renderBody } from './markdown';
import type { ProductionSnapshot } from './production';
import { openWaits, parseRoadmap, statusOf, STATUSES, THEMES, type Assessment, type NextStep, type Status } from './roadmap';
import { SERVICES, type Service } from './services';
import { mapSite, type Route } from './site';
import { compareCollections, documentedRebuilds, listSlug, type ListInfo, type SlugSync } from './sync';
import { buildCatalog, portConflicts, portOf, type SourceFile, type Tool } from './tools';

export interface ItemView {
  num: string; title: string; done: boolean; phase: string; group: string | null;
  owner: string; ownerSource: string; theme: string; themeSource: string; status: Status;
  waitsOn: string[]; openWaits: string[]; gist: string; bodyHtml: string;
  assessment: Assessment | null; files: string[]; line: number;
  work: Array<{ branch: string; commits: Array<{ hash: string; date: string; subject: string }> }>;
  roadmapOnly: string[];
  history: Array<{ date: string; title: string; line: number }>;
  plans: string[];
}

export interface SettingRow {
  name: string; secret: boolean; what: string;
  local: boolean | null; production: boolean | null; preview: boolean | null;
  readIn: string[];
}

export interface CollectionCopy { checkout: string; path: string; mtime: string; sameAsProduction: boolean; dirty: boolean; unpushed: number; chosen: boolean }

export interface CockpitData {
  generatedAt: string;
  root: string;
  mainRoot: string;
  production: { head: string; ref: string };
  themes: typeof THEMES;
  statuses: typeof STATUSES;
  items: ItemView[];
  nextSteps: NextStep[];
  stand: string[];
  ideas: Array<{ idea: string; uses: string }>;
  branches: Array<{ name: string; worktree: string | null; ahead: number; behind: number; lastDate: string; lastSubject: string; dirty: number; items: string[] }>;
  history: HistoryEntry[];
  features: ReturnType<typeof parseFeatures> & { latest: string | null };
  lab: Array<{ name: string; hasReadme: boolean; gist: string; port: number | null; status: string; items: string[]; inTable: boolean }>;
  labTableOnly: Array<{ folder: string; question: string; status: string; items: string[] }>;
  plans: ReturnType<typeof parsePlansIndex>;
  artefacts: Array<{ group: string; rows: Array<{ name: string; path: string; note: string; local?: boolean }> }>;
  tools: Tool[];
  portConflicts: Array<{ port: number; tools: string[] }>;
  ports: Record<string, boolean | null>;
  /** port → where its server runs from and what it runs. */
  listeners: Record<string, { checkout: string; script: string | null }>;
  site: Route[];
  services: Service[];
  settings: SettingRow[];
  envChecks: ReturnType<typeof envChecks>;
  vercelKnown: boolean;
  sync: {
    rows: SlugSync[];
    copies: CollectionCopy[];
    productionFile: { lastChange: string; count: number | null };
    local: { label: string; path: string } | null;
    lists: ListInfo[];
    remote: Omit<ProductionSnapshot, 'drafts' | 'content' | 'switches'> & { drafts: number | null; content: number | null; switches: number | null };
  };
  hints: Hint[];
}

function read(file: string): string {
  try { return readFileSync(file, 'utf8'); } catch { return ''; }
}

function walk(dir: string, root: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__fixtures__') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, root, out);
    else if (/\.(ts|tsx|mjs)$/.test(e.name) && !/ \d\.(ts|tsx)$/.test(e.name)) out.push(path.relative(root, full));
  }
  return out;
}

function sources(root: string, dirs: string[]): SourceFile[] {
  return dirs.flatMap(d => walk(path.join(root, d), root)).map(p => ({ path: p, text: read(path.join(root, p)) }));
}

function short(p: string, main: string): string {
  if (p === main) return 'Hauptordner';
  return path.relative(main, p).replace(/^\.claude\/worktrees\//, '');
}

function parseCollections(text: string | null): CollectionRecord[] | null {
  if (!text) return null;
  try { return (JSON.parse(text) as { collections: CollectionRecord[] }).collections; } catch { return null; }
}

/** Every checkout's copy of data/collections.json, against production's. */
function collectionCopies(root: string, main: string, production: string | null, toolCwd: string | null): { copies: CollectionCopy[]; chosen: { label: string; path: string; text: string } | null } {
  const trees = parseWorktrees(git(['worktree', 'list', '--porcelain'], root));
  const prodHash = production ? createHash('sha256').update(production.trim()).digest('hex') : null;
  const copies: Array<CollectionCopy & { text: string; mtimeMs: number }> = [];
  for (const t of trees) {
    const file = path.join(t.path, 'data', 'collections.json');
    if (!existsSync(file)) continue;
    const text = read(file);
    const st = statSync(file);
    copies.push({
      checkout: short(t.path, main) + (t.branch ? ` (${t.branch})` : ''),
      path: file,
      mtime: new Date(st.mtimeMs).toISOString().slice(0, 16).replace('T', ' '),
      mtimeMs: st.mtimeMs,
      sameAsProduction: prodHash !== null && createHash('sha256').update(text.trim()).digest('hex') === prodHash,
      dirty: git(['status', '--porcelain', '--', 'data/collections.json'], t.path) !== '',
      unpushed: Number(git(['rev-list', '--count', `${PRODUCTION}..HEAD`, '--', 'data/collections.json'], t.path)) || 0,
      chosen: false,
      text,
    });
  }
  // The working file: where the running collection tool writes (it writes
  // the checkout it was started in); else the newest copy that differs from
  // production — the edit that can still be lost; else the newest copy.
  const byTool = toolCwd ? copies.find(c => c.path === path.join(toolCwd, 'data', 'collections.json')) : undefined;
  const newest = (list: typeof copies) => list.slice().sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  const pick = byTool ?? newest(copies.filter(c => !c.sameAsProduction || c.dirty || c.unpushed)) ?? newest(copies) ?? null;
  if (byTool) byTool.checkout += ' · hier läuft die Sammlungs-App';
  if (pick) pick.chosen = true;
  return {
    copies: copies.map(c => ({ checkout: c.checkout, path: c.path, mtime: c.mtime, sameAsProduction: c.sameAsProduction, dirty: c.dirty, unpushed: c.unpushed, chosen: c.chosen })),
    chosen: pick ? { label: pick.checkout, path: pick.path, text: pick.text } : null,
  };
}

function seriesLists(dir: string, slugs: string[], documented: Array<{ file: string; slug: string }>): ListInfo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
    let entries: Array<{ isbn?: string; skip?: string }> = [];
    try { entries = JSON.parse(read(path.join(dir, f))); } catch { /* not a list */ }
    const skipped = entries.filter(e => e.skip);
    const { slug, source } = listSlug(`lab/collections/lists/${f}`, slugs, documented);
    return { file: `lab/collections/lists/${f}`, slug, slugSource: source, entries: entries.length, skipped: skipped.length, skippedIsbns: skipped.map(e => e.isbn ?? '').filter(Boolean) };
  });
}

/** The comment block above each `NAME=` line of .env.example. */
function exampleDocs(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let comment: string[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('#')) { comment.push(line.replace(/^#\s?/, '')); continue; }
    const m = /^([A-Z][A-Z0-9_]*)=/.exec(line);
    if (m) out.set(m[1], comment.join(' ').trim());
    else if (!line.trim()) comment = [];
  }
  return out;
}

export interface CollectInput {
  root: string;
  snapshot: ProductionSnapshot;
  vercel: VercelVar[] | null;
  /** Names of the main .env.local, the values already dropped. */
  localEnvNames: Set<string> | null;
  /** For the one check that compares two values by hash. */
  localEnv: Map<string, string> | null;
  ports: Record<string, boolean | null>;
  /** Who listens on the open ports: absolute cwd and the script it runs. */
  listeners: Record<string, { cwd: string; script: string | null }>;
}

export function collect(input: CollectInput): CockpitData {
  const { root, snapshot } = input;
  const main = mainRoot(root);
  const roadmapText = read(path.join(root, 'ROADMAP.md'));
  const roadmap = parseRoadmap(roadmapText);
  const history = parseHistory(read(path.join(root, 'docs', 'history.md')));
  const branches = readBranches(root);
  const work = workByItem(branches);
  const byNum = new Map(roadmap.items.map(i => [i.num, i]));
  const planFiles = existsSync(path.join(root, 'docs', 'plans')) ? readdirSync(path.join(root, 'docs', 'plans')) : [];

  const items: ItemView[] = roadmap.items.map(i => {
    const w = i.done ? [] : (work.get(i.num) ?? []);
    const working = w.filter(x => x.commits.length);
    const waits = openWaits(i, byNum);
    return {
      num: i.num, title: i.title, done: i.done, phase: i.phase, group: i.group,
      owner: i.owner, ownerSource: i.ownerSource, theme: i.theme, themeSource: i.themeSource,
      status: statusOf(i, working.map(x => x.branch), waits),
      waitsOn: i.waitsOn, openWaits: waits, gist: i.gist, bodyHtml: renderBody(i.body),
      assessment: i.assessment, files: i.files, line: i.line,
      work: working.map(x => ({ branch: x.branch, commits: x.commits.map(c => ({ hash: c.hash.slice(0, 7), date: c.date, subject: c.subject })) })),
      roadmapOnly: w.filter(x => !x.commits.length && x.roadmapOnly.length).map(x => x.branch),
      history: history.filter(h => h.items.includes(i.num)).map(h => ({ date: h.date, title: h.title, line: h.line })),
      plans: planFiles.filter(p => p.startsWith(`PLAN-${i.num}-`) || p === `PLAN-${i.num}.md`),
    };
  });

  const features = parseFeatures(read(path.join(root, 'docs', 'features.md')));
  const labTable = parseLabTable(read(path.join(root, 'lab', 'README.md')));
  const labDirs = existsSync(path.join(root, 'lab'))
    ? readdirSync(path.join(root, 'lab'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name) : [];
  const lab = labDirs.map(name => {
    const readme = read(path.join(root, 'lab', name, 'README.md'));
    const row = labTable.find(r => r.folder === name);
    const port = portOf(read(path.join(root, 'lab', name, 'serve.ts'))) ?? null;
    return { name, hasReadme: !!readme, gist: readme ? readmeGist(readme) : row?.question ?? '', port, status: row?.status ?? '', items: row?.roadmap ?? [], inTable: !!row };
  });

  const toolSources = sources(root, ['scripts', 'lab']);
  const tools = buildCatalog(read(path.join(root, 'package.json')), toolSources);
  const conflicts = portConflicts(tools);

  const appSources = sources(root, ['app', 'components']);
  const site = mapSite(appSources);

  // Settings: names from .env.example, the code, Vercel and the main .env.local.
  const exampleText = read(path.join(root, '.env.example'));
  const exampleNames = [...exampleDocs(exampleText).keys()];
  const docs = exampleDocs(exampleText);
  const codeFiles = [...sources(root, ['lib', 'app', 'components', 'scripts', 'lab']), { path: 'next.config.ts', text: read(path.join(root, 'next.config.ts')) }];
  const codeNames = [...new Set(codeFiles.flatMap(f => envNamesInCode(f.text)))];
  const names = new Set([...exampleNames, ...codeNames, ...(input.vercel ?? []).map(v => v.name), ...(input.localEnvNames ?? [])]);
  const vercelBy = new Map((input.vercel ?? []).map(v => [v.name, v.environments]));
  const settings: SettingRow[] = [...names].filter(n => !['NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'PORT', 'DEBUG'].includes(n)).sort().map(name => ({
    name,
    secret: isSecret(name),
    what: docs.get(name) ?? '',
    local: input.localEnvNames ? input.localEnvNames.has(name) : null,
    production: input.vercel ? (vercelBy.get(name) ?? []).includes('Production') : null,
    preview: input.vercel ? (vercelBy.get(name) ?? []).includes('Preview') : null,
    readIn: codeFiles.filter(f => new RegExp(`\\benv(?:\\.|\\[['"])${name}\\b`).test(f.text)).map(f => f.path).slice(0, 4),
  }));
  const checks = envChecks(input.localEnv, exampleNames, codeNames, input.vercel);

  // Collections and their layers.
  const productionText = fileAtProduction('data/collections.json', root);
  const productionRecords = parseCollections(productionText);
  const toolCwd = Object.values(input.listeners).find(l => l.script?.includes('lab/collections/serve.ts'))?.cwd ?? null;
  const { copies, chosen } = collectionCopies(root, main, productionText, toolCwd);
  const localRecords = chosen ? parseCollections(chosen.text) : null;
  const allSlugs = [...new Set([...(localRecords ?? []), ...(productionRecords ?? [])].map(r => r.slug))];
  const documented = documentedRebuilds([read(path.join(root, 'lab', 'collections', 'README.md')), roadmapText, read(path.join(root, 'docs', 'history.md'))].join('\n'));
  const listsDir = chosen ? path.join(path.dirname(path.dirname(chosen.path)), 'lab', 'collections', 'lists') : path.join(root, 'lab', 'collections', 'lists');
  const lists = seriesLists(listsDir, allSlugs, documented);
  const rows = compareCollections({
    production: productionRecords,
    local: chosen && localRecords ? { label: chosen.label, records: localRecords } : null,
    drafts: snapshot.drafts,
    content: snapshot.content,
    switches: snapshot.switches,
    lists,
  });

  const branchRows = branches
    .filter(b => b.worktree || b.ahead > 0 || b.name === 'main')
    .map(b => ({
      name: b.name, worktree: b.worktree ? short(b.worktree, main) : null, ahead: b.ahead, behind: b.behind,
      lastDate: b.lastDate, lastSubject: b.lastSubject, dirty: b.dirty.length,
      items: [...new Set(b.commits.flatMap(c => itemsInSubject(c.subject)))],
    }));

  const artefacts = [
    { group: 'Steuerung', rows: ['SPEC.md', 'ROADMAP.md', 'CLAUDE.md', 'docs/features.md', 'docs/history.md', 'docs/roadmap-archive.md', 'lab/README.md'].filter(f => existsSync(path.join(root, f))).map(f => ({ name: f, path: f, note: `${Math.round(statSync(path.join(root, f)).size / 1024)} KB` })) },
    { group: 'Recherchen und Berichte', rows: (existsSync(path.join(root, 'docs')) ? readdirSync(path.join(root, 'docs')) : []).filter(f => f.endsWith('.md') && !['features.md', 'history.md', 'roadmap-archive.md', 'worktrees.md'].includes(f)).map(f => ({ name: f, path: `docs/${f}`, note: (/^# (.+)$/m.exec(read(path.join(root, 'docs', f)))?.[1] ?? '') })) },
    { group: 'Testberichte', rows: (existsSync(path.join(root, 'docs', 'tests')) ? readdirSync(path.join(root, 'docs', 'tests')) : []).filter(f => f.endsWith('.md')).map(f => ({ name: f, path: `docs/tests/${f}`, note: (/^# (.+)$/m.exec(read(path.join(root, 'docs', 'tests', f)))?.[1] ?? '') })) },
    { group: 'Daten', rows: (existsSync(path.join(root, 'data')) ? readdirSync(path.join(root, 'data')) : []).filter(f => f.endsWith('.json')).map(f => {
      const writers = toolSources.filter(s => s.text.includes(f) && /writeFileSync|writeAtomically|renameSync/.test(s.text)).map(s => s.path).slice(0, 3);
      return { name: `data/${f}`, path: `data/${f}`, note: `${Math.round(statSync(path.join(root, 'data', f)).size / 1024)} KB${writers.length ? ' · geschrieben von ' + writers.join(', ') : ''}` };
    }) },
    { group: 'Erzeugte Ansichten (git-ignoriert)', rows: [
      { name: 'docs/cockpit.html', path: 'docs/cockpit.html', note: 'diese Seite', local: true },
      { name: 'docs/worktrees.md', path: 'docs/worktrees.md', note: 'npm run worktrees', local: true },
    ] },
  ];

  const data: CockpitData = {
    generatedAt: new Date().toISOString(),
    root, mainRoot: main,
    production: { head: productionHead(root), ref: PRODUCTION },
    themes: THEMES, statuses: STATUSES,
    items,
    nextSteps: roadmap.nextSteps, stand: roadmap.stand, ideas: roadmap.ideas,
    branches: branchRows,
    history,
    features: { ...features, latest: latestFeatureDate(features.sections) },
    lab,
    labTableOnly: labTable.filter(r => !labDirs.includes(r.folder)).map(r => ({ folder: r.folder, question: r.question, status: r.status, items: r.roadmap })),
    plans: parsePlansIndex(read(path.join(root, 'docs', 'plans', 'README.md'))),
    artefacts,
    tools, portConflicts: conflicts, ports: input.ports,
    listeners: Object.fromEntries(Object.entries(input.listeners).map(([port, l]) => [port, { checkout: short(l.cwd, main), script: l.script }])),
    site, services: SERVICES, settings, envChecks: checks, vercelKnown: input.vercel !== null,
    sync: {
      rows, copies,
      productionFile: { lastChange: lastProductionChange('data/collections.json', root), count: productionRecords?.length ?? null },
      local: chosen ? { label: chosen.label, path: chosen.path } : null,
      lists,
      remote: {
        at: snapshot.at, origin: snapshot.origin, publishRoute: snapshot.publishRoute, notes: snapshot.notes,
        drafts: snapshot.drafts?.length ?? null,
        content: snapshot.content ? Object.keys(snapshot.content).length : null,
        switches: snapshot.switches ? Object.keys(snapshot.switches).length : null,
      },
    },
    hints: [],
  };
  data.hints = deriveHints({
    items: items.map(i => ({ ...i, workBranches: i.work.map(w => w.branch), roadmapOnlyBranches: i.roadmapOnly })),
    features: { stand: features.stand, latest: data.features.latest },
    lab: { table: labTable, folders: lab.map(l => ({ name: l.name, hasReadme: l.hasReadme })) },
    portConflicts: conflicts,
    branches: branches.map(b => ({ name: b.name, ahead: b.ahead, behind: b.behind, worktree: b.worktree })),
    sync: rows,
    envChecks: checks,
    history,
  });
  return data;
}
