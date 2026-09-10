/**
 * Which session is working on what: a generated overview of every worktree
 * and branch of this repository, as a table and a diagram.
 *
 *   npm run worktrees            # writes docs/worktrees.md and prints the table
 *   npm run worktrees -- --fetch # same, after `git fetch origin`
 *
 * Julian asked for it on 2026-09-10, after a morning on which two Claude
 * sessions each believed they held `main`: one had pushed fifteen commits to
 * `origin/main` while the other fast-forwarded a local `main` that had never
 * seen them. Nothing in the repository showed that. This script does, and it
 * is **generated, never hand-edited**: `docs/worktrees.md` is git-ignored, so
 * it is current whenever it is looked at and can never be stale in a commit.
 *
 * Read-only. Runs only `git` commands that inspect state; `--fetch` is the one
 * exception and touches nothing but the remote-tracking refs. No dependency
 * beyond Node.
 *
 * **Topics are read from commit subjects.** Every commit here names its
 * roadmap item ("6.28: a search field in the header"), so the items a branch
 * touches are the numbers in the subjects it has beyond production. That is
 * a convention, not a guarantee — a branch with unnamed commits shows its
 * branch name and nothing else.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT_FILE = path.join(process.cwd(), 'docs', 'worktrees.md');
/** Production, in this project: `main` on GitHub deploys to Vercel. */
const PRODUCTION = 'origin/main';
const LOCAL_MAIN = 'main';

function git(args: string[], cwd = process.cwd()): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

interface Worktree { path: string; head: string; branch: string | null }

function worktrees(): Worktree[] {
  const out: Worktree[] = [];
  let cur: Partial<Worktree> = {};
  for (const line of git(['worktree', 'list', '--porcelain']).split('\n')) {
    if (line.startsWith('worktree ')) cur = { path: line.slice(9), branch: null };
    else if (line.startsWith('HEAD ')) cur.head = line.slice(5);
    else if (line.startsWith('branch ')) cur.branch = line.slice(7).replace(/^refs\/heads\//, '');
    else if (line === '' && cur.path) { out.push(cur as Worktree); cur = {}; }
  }
  if (cur.path) out.push(cur as Worktree);
  return out;
}

interface Branch {
  name: string;
  worktree: string | null;
  lastDate: string;
  lastSubject: string;
  aheadOfProduction: number;
  behindProduction: number;
  aheadOfMain: number;
  behindMain: number;
  dirty: number;
  topics: string[];
  /** True when nothing is beyond production and the topics come from the last five commits instead. */
  topicsFromRecent: boolean;
  upstream: string;
}

function counts(a: string, b: string): [number, number] {
  const s = git(['rev-list', '--left-right', '--count', `${a}...${b}`]);
  const [left, right] = s.split(/\s+/).map(Number);
  return [left || 0, right || 0];
}

/** Roadmap numbers ("6.28", "1.11a", "5.4a") and spec ids ("N13", "E20", "F2.9") in commit subjects. */
function topicsOf(subjects: string[]): string[] {
  const found = new Set<string>();
  for (const s of subjects) {
    for (const m of s.matchAll(/(?<![\w.])(\d\.\d{1,2}[a-z]?)(?![\w.])/g)) found.add(m[1]);
    for (const m of s.matchAll(/\b([NEF]\d{1,2}(?:\.\d+)?[a-z]?)\b/g)) found.add(m[1]);
  }
  return [...found].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
}

function describe(name: string, worktree: string | null): Branch {
  const [aheadP, behindP] = counts(PRODUCTION, name).reverse() as [number, number];
  const [aheadM, behindM] = counts(LOCAL_MAIN, name).reverse() as [number, number];
  const log = git(['log', '-1', '--format=%cs%x09%s', name]);
  const [lastDate = '', lastSubject = ''] = log.split('\t');
  const beyond = git(['log', '--format=%s', `${PRODUCTION}..${name}`]).split('\n').filter(Boolean);
  /*
    A branch whose every commit is already in production still tells what
    its session was doing: read the last few subjects then, and say so.
  */
  const recent = git(['log', '-5', '--format=%s', name]).split('\n').filter(Boolean);
  const dirty = worktree ? git(['status', '--porcelain'], worktree).split('\n').filter(Boolean).length : 0;
  const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${name}@{upstream}`]);
  return {
    name, worktree, lastDate, lastSubject,
    aheadOfProduction: aheadP, behindProduction: behindP,
    aheadOfMain: aheadM, behindMain: behindM,
    dirty, topics: topicsOf(beyond.length ? beyond : recent), topicsFromRecent: beyond.length === 0, upstream,
  };
}

function shortPath(p: string): string {
  const common = git(['rev-parse', '--git-common-dir']);
  const mainRoot = path.resolve(common, '..');
  if (p === mainRoot) return '(Hauptordner)';
  return path.relative(mainRoot, p) || p;
}

function files(n: number): string {
  return n === 1 ? '1 Datei' : `${n} Dateien`;
}

function nodeId(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '_');
}

function main() {
  if (process.argv.includes('--fetch')) git(['fetch', 'origin', '--prune']);

  const trees = worktrees();
  const byBranch = new Map<string, string>();
  for (const t of trees) if (t.branch) byBranch.set(t.branch, t.path);
  const names = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads/']).split('\n').filter(Boolean);
  const branches = names.map(n => describe(n, byBranch.get(n) ?? null));
  const production = git(['log', '-1', '--format=%h %cs %s', PRODUCTION]);
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

  const fmt = (b: Branch) => {
    const state =
      b.name === LOCAL_MAIN
        ? b.aheadOfProduction === 0 && b.behindProduction === 0
          ? 'gleich `origin/main`'
          : `**+${b.aheadOfProduction} / −${b.behindProduction}** gegen \`origin/main\``
        : `+${b.aheadOfProduction} / −${b.behindProduction}`;
    const where = b.worktree ? `\`${shortPath(b.worktree)}\`` : '—';
    const dirty = b.worktree ? (b.dirty ? `**${files(b.dirty)} ungespeichert**` : 'sauber') : '—';
    const topics = b.topics.length
      ? (b.topicsFromRecent ? `zuletzt ${b.topics.join(', ')} (alles in Produktion)` : b.topics.join(', '))
      : (b.aheadOfProduction ? '*(keine Nummer im Commit)*' : '—');
    return `| \`${b.name}\` | ${where} | ${b.lastDate} | ${state} | ${dirty} | ${topics} | ${b.lastSubject.replace(/\|/g, '\\|')} |`;
  };

  const active = branches.filter(b => b.worktree || b.aheadOfProduction > 0);
  const merged = branches.filter(b => !b.worktree && b.aheadOfProduction === 0 && b.name !== LOCAL_MAIN);

  const mermaid = ['```mermaid', 'flowchart LR'];
  const shortProd = production.length > 70 ? production.slice(0, 67) + '…' : production;
  mermaid.push(`  P["origin/main — Produktion<br/>${shortProd.replace(/"/g, "'")}"]`);
  const local = branches.find(b => b.name === LOCAL_MAIN);
  if (local) {
    mermaid.push(`  M["main (lokal)<br/>+${local.aheadOfProduction} / −${local.behindProduction}"]`);
    mermaid.push(local.behindProduction ? '  P -. "noch nicht geholt" .-> M' : '  P --> M');
    if (local.aheadOfProduction) mermaid.push('  M -. "push = Deploy" .-> P');
  }
  for (const b of active) {
    if (b.name === LOCAL_MAIN) continue;
    const label = [
      b.name,
      b.worktree ? `Session: ${shortPath(b.worktree)}` : 'kein Worktree',
      `+${b.aheadOfProduction} / −${b.behindProduction} · ${b.lastDate}`,
      b.topics.length ? `${b.topicsFromRecent ? 'zuletzt' : 'Themen'}: ${b.topics.join(', ')}` : '',
      b.dirty ? `${files(b.dirty)} ungespeichert` : '',
    ].filter(Boolean).join('<br/>');
    mermaid.push(`  ${nodeId(b.name)}["${label}"]`);
    mermaid.push(`  M --> ${nodeId(b.name)}`);
    if (b.behindProduction) mermaid.push(`  ${nodeId(b.name)} -. "${b.behindProduction} hinter Produktion" .-> P`);
  }
  mermaid.push('```');

  const doc = [
    '# Worktrees und Branches — wer arbeitet woran',
    '',
    `Stand: ${stamp} (lokale Uhr). **Erzeugt mit \`npm run worktrees\`, nie von Hand bearbeitet**; die Datei ist git-ignoriert und deshalb nie veraltet in einem Commit. \`--fetch\` holt vorher den Stand von GitHub. Jede Claude-Session arbeitet in einem eigenen Worktree unter \`.claude/worktrees/\`; der Branch heißt wie die Session, und die Themen stehen in den Betreffzeilen ihrer Commits.`,
    '',
    `**Produktion** ist \`${PRODUCTION}\` (deployt bei Vercel): \`${production}\`. Ein Push auf \`main\` ist ein Deploy.`,
    '',
    mermaid.join('\n'),
    '',
    '## Aktive Branches',
    '',
    '| Branch | Worktree (Session) | Letzter Commit | vor / hinter Produktion | Arbeitskopie | Themen (Roadmap) | Letzte Betreffzeile |',
    '|---|---|---|---|---|---|---|',
    ...active.map(fmt),
    '',
    merged.length ? '## In Produktion enthalten, ohne Worktree' : '',
    merged.length ? '' : '',
    merged.length ? 'Nichts davon trägt Arbeit, die nicht schon in `origin/main` wäre. Löschen ist gefahrlos (`git branch -d <name>`).' : '',
    merged.length ? '' : '',
    ...merged.map(b => `- \`${b.name}\` — zuletzt ${b.lastDate}, „${b.lastSubject}“${b.upstream ? ` (Upstream \`${b.upstream}\`)` : ''}`),
    '',
    '## Lesehilfe',
    '',
    '- **vor / hinter Produktion** zählt Commits gegen `origin/main` nach dem letzten `git fetch`. Steht `main` (lokal) *vor* Produktion, wartet ein Deploy; steht es *hinter*, hat eine andere Session direkt auf GitHub geschoben und `main` muss erst nachgezogen werden (`git merge origin/main`), bevor irgendetwas darauf aufsetzt.',
    '- **Themen** sind die Roadmap-Nummern aus den Betreffzeilen der Commits, die der Branch über Produktion hinaus hat. Ein Branch ohne solche Commits hat keine Themen, auch wenn in seinem Worktree gerade gearbeitet wird — dann zählt die Spalte *Arbeitskopie*.',
    '- **Arbeitskopie** nennt ungespeicherte Änderungen im Worktree. Sie sind für andere Sessions unsichtbar, bis sie committet sind.',
    '',
  ].join('\n');

  writeFileSync(OUT_FILE, doc);
  console.log(doc.split('\n').filter(l => l.startsWith('|') || l.startsWith('- `') || l.startsWith('**Produktion')).join('\n'));
  console.log(`\nwritten: ${path.relative(process.cwd(), OUT_FILE)}`);
}

main();
