#!/bin/sh
# SessionStart hook (ROADMAP 6.39): the worktree overview before anything else,
# so `npm run worktrees -- --fetch` cannot be forgotten (CLAUDE.md, 2026-09-10:
# local main was six ahead and fifteen behind production and nothing showed it).
# Also notes the commit this session began at, for the Stop hook's diff.
set -u
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" || exit 0
session="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).session_id||"")}catch{}})')"
state="$root/.claude/hooks/state"
mkdir -p "$state"
if [ -n "$session" ]; then
  git rev-parse HEAD > "$state/$session.start" 2>/dev/null || true
fi
# Network: one fetch. A session without network still starts; the overview then says so.
out="$(npm run worktrees -- --fetch 2>&1 | tail -4)"
echo "worktrees: $(echo "$out" | tr '\n' ' ' | cut -c1-300)"
exit 0
