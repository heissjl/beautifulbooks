/**
 * What git knows, for the Cockpit: branches, worktrees, their distance to
 * production, and which roadmap items their commits name. Runs only git
 * commands that inspect state; `--fetch` (in main.ts) is the one exception
 * and touches nothing but the remote-tracking refs.
 *
 * The parsing is pure and tested; the `git()` calls are the thin rest.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const PRODUCTION = 'origin/main';

export function git(args: string[], cwd = process.cwd()): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch {
    return '';
  }
}

export interface Commit { hash: string; date: string; subject: string; files: string[] }

export interface BranchInfo {
  name: string;
  worktree: string | null;
  ahead: number;
  behind: number;
  lastDate: string;
  lastSubject: string;
  /** Uncommitted files in its worktree. */
  dirty: string[];
  commits: Commit[];
}

const SEP = '\x1e';

/** `git log --format=%x1e%H%x09%cs%x09%s --name-only` → commits with their files. */
export function parseLog(out: string): Commit[] {
  return out.split(SEP).map(chunk => chunk.trim()).filter(Boolean).map(chunk => {
    const [head, ...files] = chunk.split('\n');
    const [hash, date, ...subject] = head.split('\t');
    return { hash, date, subject: subject.join('\t'), files: files.map(f => f.trim()).filter(Boolean) };
  });
}

/** Roadmap numbers a commit subject names at its start ("6.28: …", "5.10b, 6.52: …"). */
export function itemsInSubject(subject: string): string[] {
  const head = /^(\d+\.\d+[a-z]?(?:[–-][a-z])?(?:\s*,\s*\d+\.\d+[a-z]?(?:[–-][a-z])?)*)\s*:/.exec(subject);
  if (!head) return [];
  return [...head[1].matchAll(/(\d+\.\d+[a-z]?)/g)].map(m => m[1]);
}

/**
 * A commit that changes only ROADMAP.md (it opens or rewords an item) is not
 * work on the item. Measured 2026-09-25: 6.53 showed as "in progress" because
 * the commit that created its roadmap line named it.
 */
export function isRoadmapOnly(commit: Commit): boolean {
  return commit.files.length > 0 && commit.files.every(f => f === 'ROADMAP.md');
}

export interface ItemWork { branch: string; commits: Commit[]; roadmapOnly: Commit[] }

/** item → the branches that work on it (commits beyond production naming it). */
export function workByItem(branches: Array<Pick<BranchInfo, 'name' | 'commits'>>): Map<string, ItemWork[]> {
  const out = new Map<string, ItemWork[]>();
  for (const b of branches) {
    const per = new Map<string, ItemWork>();
    for (const c of b.commits) {
      for (const num of itemsInSubject(c.subject)) {
        const w = per.get(num) ?? { branch: b.name, commits: [], roadmapOnly: [] };
        (isRoadmapOnly(c) ? w.roadmapOnly : w.commits).push(c);
        per.set(num, w);
      }
    }
    for (const [num, w] of per) out.set(num, [...(out.get(num) ?? []), w]);
  }
  return out;
}

export function parseWorktrees(out: string): Array<{ path: string; branch: string | null }> {
  const list: Array<{ path: string; branch: string | null }> = [];
  let cur: { path: string; branch: string | null } | null = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) { if (cur) list.push(cur); cur = { path: line.slice(9), branch: null }; }
    else if (line.startsWith('branch ') && cur) cur.branch = line.slice(7).replace(/^refs\/heads\//, '');
  }
  if (cur) list.push(cur);
  return list;
}

/** The main checkout: the parent of the common git dir. Worktrees live below it. */
export function mainRoot(cwd = process.cwd()): string {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  return common ? path.dirname(common) : cwd;
}

export function readBranches(cwd = process.cwd()): BranchInfo[] {
  const trees = parseWorktrees(git(['worktree', 'list', '--porcelain'], cwd));
  const byBranch = new Map(trees.filter(t => t.branch).map(t => [t.branch as string, t.path]));
  const names = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads/'], cwd).split('\n').filter(Boolean);
  return names.map(name => {
    const [behind, ahead] = git(['rev-list', '--left-right', '--count', `${PRODUCTION}...${name}`], cwd).split(/\s+/).map(Number);
    const [lastDate = '', lastSubject = ''] = git(['log', '-1', '--format=%cs%x09%s', name], cwd).split('\t');
    const worktree = byBranch.get(name) ?? null;
    const dirty = worktree ? git(['status', '--porcelain'], worktree).split('\n').filter(Boolean) : [];
    const commits = ahead ? parseLog(git(['log', `--format=${SEP}%H%x09%cs%x09%s`, '--name-only', `${PRODUCTION}..${name}`], cwd)) : [];
    return { name, worktree, ahead: ahead || 0, behind: behind || 0, lastDate, lastSubject, dirty, commits };
  });
}

export function productionHead(cwd = process.cwd()): string {
  return git(['log', '-1', '--format=%h %cs %s', PRODUCTION], cwd);
}

/** A file as production (origin/main) has it, or null. */
export function fileAtProduction(file: string, cwd = process.cwd()): string | null {
  return git(['show', `${PRODUCTION}:${file}`], cwd) || null;
}

/** Date of the last commit on production that touched a file. */
export function lastProductionChange(file: string, cwd = process.cwd()): string {
  return git(['log', '-1', '--format=%cs %h %s', PRODUCTION, '--', file], cwd);
}
