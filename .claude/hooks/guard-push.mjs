// PreToolUse hook on Bash (ROADMAP 6.39): a `git push` first refreshes the
// worktree overview, and a push that reaches `main` asks — origin/main is
// production (CLAUDE.md), and Julian decides every deploy (docs/umgang.md §11).
// Reads the tool call from stdin; answers with the hook JSON on stdout.
import { execSync } from 'node:child_process';

let raw = '';
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const command = String(input?.tool_input?.command ?? '');
  if (!/\bgit\s+(?:-[^\s]+\s+)*push\b/.test(command)) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let overview = '';
  try {
    overview = execSync('npm run worktrees -- --fetch', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 90_000 }).trim().split('\n').slice(-3).join(' ');
  } catch {
    overview = 'the worktree overview could not be refreshed (no network?)';
  }

  // `git push` with `main` anywhere after it (origin main, HEAD:main, --force main…), or a bare push on the main branch.
  let onMain = false;
  try { onMain = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === 'main'; } catch { /* not a repo */ }
  const namesMain = /\bpush\b[^|;&]*\bmain\b/.test(command);
  const bareOnMain = onMain && !/\bpush\s+\S+\s+\S/.test(command);
  if (namesMain || bareOnMain) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `This push reaches main — origin/main is production, and a push there is a deploy Julian decides (docs/umgang.md §11). Worktrees: ${overview}`,
      },
    }));
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({ systemMessage: `Worktree overview refreshed before the push. ${overview}` }));
  process.exit(0);
});
