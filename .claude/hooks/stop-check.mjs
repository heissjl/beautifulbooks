// Stop hook (ROADMAP 6.39): when this session changed code, lint and the test
// suite must have passed before it stops — exit 2 with the failure as the
// reason, at most eight times per session, and never when Claude is already
// continuing because of this hook (`stop_hook_active`). Only code counts:
// app/, components/, lib/, scripts/, proxy.ts, next.config.ts — docs can stop
// whenever they like. A passing run is remembered for the exact tree it ran
// on, so a stop after a docs-only edit does not run everything again.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CODE = /^(app|components|lib|scripts)\/|^(proxy|next\.config|package)\.(ts|json)$/;
const MAX_BLOCKS = 8;

let raw = '';
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  if (input?.stop_hook_active) process.exit(0);
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const session = String(input?.session_id ?? 'unknown').replace(/[^\w-]/g, '');
  const stateDir = join(root, '.claude', 'hooks', 'state');
  mkdirSync(stateDir, { recursive: true });
  const startFile = join(stateDir, `${session}.start`);
  const stateFile = join(stateDir, `${session}.stop.json`);
  const sh = (cmd, timeout = 600_000) => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout });

  let changed = [];
  try {
    const start = existsSync(startFile) ? readFileSync(startFile, 'utf8').trim() : '';
    const committed = start ? sh(`git diff --name-only ${start} HEAD`).split('\n') : [];
    const pending = sh('git status --porcelain').split('\n').map(l => l.slice(3).trim());
    changed = [...new Set([...committed, ...pending])].filter(f => CODE.test(f));
  } catch {
    process.exit(0); // not a repository, or git unavailable: nothing to insist on
  }
  if (changed.length === 0) process.exit(0);

  let state = { blocks: 0, passedTree: '' };
  try { state = { ...state, ...JSON.parse(readFileSync(stateFile, 'utf8')) }; } catch { /* first stop */ }
  let tree = '';
  try { tree = `${sh('git rev-parse HEAD').trim()} ${sh('git status --porcelain').trim()}`; } catch { /* ignore */ }
  if (tree && state.passedTree === tree) process.exit(0);
  if (state.blocks >= MAX_BLOCKS) process.exit(0);

  const failures = [];
  for (const [name, cmd] of [['eslint', 'npx eslint .'], ['vitest', 'npm run test:run']]) {
    try { sh(cmd); } catch (err) {
      const out = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim().split('\n').slice(-25).join('\n');
      failures.push(`${name} failed:\n${out}`);
    }
  }
  if (failures.length === 0) {
    writeFileSync(stateFile, JSON.stringify({ ...state, passedTree: tree }));
    process.exit(0);
  }
  writeFileSync(stateFile, JSON.stringify({ ...state, blocks: state.blocks + 1 }));
  process.stderr.write(`Code changed in this session (${changed.slice(0, 6).join(', ')}${changed.length > 6 ? ', …' : ''}) and the checks are not green (CLAUDE.md: tests and lint before a step is done). Block ${state.blocks + 1} of ${MAX_BLOCKS}.\n\n${failures.join('\n\n')}`);
  process.exit(2);
});
