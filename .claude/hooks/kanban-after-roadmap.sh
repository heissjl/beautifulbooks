#!/bin/sh
# PostToolUse hook on Edit|Write (ROADMAP 6.39): a change to ROADMAP.md
# rebuilds the Cockpit page, so the board is never an hour old. Offline, so
# production is not asked on every roadmap edit; only the file is written.
set -u
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
path="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path||"")}catch{}})')"
case "$path" in
  */ROADMAP.md|ROADMAP.md)
    cd "$root" || exit 0
    if npm run cockpit -- --build --offline >/dev/null 2>&1; then
      echo "cockpit rebuilt (docs/cockpit.html) after ROADMAP.md changed"
    else
      echo "cockpit rebuild failed after ROADMAP.md changed — run: npm run cockpit -- --build --offline"
    fi
    ;;
esac
exit 0
