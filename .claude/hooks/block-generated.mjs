// PreToolUse hook on Edit|Write (ROADMAP 6.39): generated files are never
// edited by hand — exit 2 names the script that writes them. The list is
// what `scripts/build-*.ts`, `scripts/find-decade-pages.ts`, `npm run
// worktrees` and `npm run cockpit` write (Julian, 2026-10-18: all of them).
// `data/collections.json` is curated data written by lab/collections/ and
// stays editable; `data/index-works.json` and `data/curated.json` are read,
// not written, by the build scripts.
const GENERATED = [
  ['docs/worktrees.md', 'npm run worktrees -- --fetch'],
  ['docs/cockpit.html', 'npm run cockpit -- --build'],
  ['docs/cockpit/', 'npm run cockpit -- --build'],
  ['data/cover-index.json', 'npx tsx scripts/build-cover-index.ts'],
  ['data/cover-measures.json', 'npx tsx scripts/build-versus-pool.ts'],
  ['data/versus-pool.json', 'npx tsx scripts/build-versus-pool.ts'],
  ['data/hero-rings.json', 'npx tsx scripts/build-hero-rings.ts'],
  ['data/hero-ring-signatures.json', 'npx tsx scripts/build-hero-rings.ts'],
  ['data/popular-works.json', 'npx tsx scripts/build-popular-works.ts'],
  ['data/decade-pages.json', 'npx tsx scripts/find-decade-pages.ts'],
  ['public/loading/', 'npx tsx scripts/build-loading-assets.ts'],
];

let raw = '';
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const file = String(input?.tool_input?.file_path ?? '');
  if (!file) process.exit(0);
  const root = (process.env.CLAUDE_PROJECT_DIR || process.cwd()).replace(/\/$/, '');
  const rel = file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file.replace(/^\.\//, '');
  const hit = GENERATED.find(([p]) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
  if (!hit) process.exit(0);
  process.stderr.write(`${rel} is generated and never edited by hand (ROADMAP 6.39). Change its source and run: ${hit[1]}\n`);
  process.exit(2);
});
