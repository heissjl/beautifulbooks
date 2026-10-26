/**
 * Writes a copy of the production Redis to a file beside the project
 * (ROADMAP 2.11, lib/backup.ts):
 *
 *   set -a; source .env.local; set +a; npm run backup
 *
 * It asks production **once** — `GET /api/admin/export` with the admin
 * password as a bearer token, like the Cockpit and live-collections.ts —
 * streams the answer into `<dir>/bb-redis-<date>-<time>.jsonl.tmp`, checks
 * that the footer says `complete: true` and that the line count matches,
 * and only then renames the file. Without a complete footer the `.tmp`
 * stays and the script says so: an abort is not a backup (N12).
 *
 * The folder is `../bb-backups` beside the main checkout (as `../bb-lab-cache`
 * is for lab output), or `BB_BACKUP_DIR`; a folder inside the repository or
 * in iCloud Drive is refused. Folder 0700, file 0600: the file holds names
 * readers typed and the hashes of their ids. Nothing is ever deleted here;
 * which copies to keep is Julian's. `BACKUP_ALL=1` takes the volatile keys
 * (pair tokens, alert markers) too.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parseBackup, refuseBackupDir } from '../lib/backup';

const LIVE = process.env.SUGGEST_REMOTE ?? 'https://buyitscovers.com';

/** The main checkout: the parent of the common git dir, so a worktree lands beside the project too. */
function mainRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: here, encoding: 'utf8' }).trim();
    return dirname(common);
  } catch {
    return resolve(here, '..');
  }
}

async function main() {
  const password = process.env.SUGGEST_ADMIN_PASSWORD;
  if (!password) throw new Error("SUGGEST_ADMIN_PASSWORD is not set: source the main folder's .env.local for this command.");
  const root = mainRoot();
  const dir = resolve(process.env.BB_BACKUP_DIR ?? resolve(root, '..', 'bb-backups'));
  const refused = refuseBackupDir(dir, root);
  if (refused) throw new Error(`${refused}: ${dir}`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const file = resolve(dir, `bb-redis-${stamp}.jsonl`);
  const tmp = `${file}.tmp`;
  const started = Date.now();
  const res = await fetch(`${LIVE}/api/admin/export${process.env.BACKUP_ALL === '1' ? '?all=1' : ''}`, {
    headers: { authorization: `Bearer ${password}`, 'user-agent': 'beautifulbooks/backup' },
    signal: AbortSignal.timeout(330_000),
  });
  if (!res.ok || !res.body) throw new Error(`${LIVE} answered ${res.status} — nothing was written.`);
  await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(tmp, { mode: 0o600 }));

  const parsed = parseBackup(readFileSync(tmp, 'utf8'));
  if (!parsed.ok) {
    console.error(`not a backup: ${parsed.error}. The file stays at ${tmp} for a look; it must not be restored.`);
    process.exit(1);
  }
  renameSync(tmp, file);
  chmodSync(file, 0o600);
  const { keys, skipped, other } = parsed.backup.footer;
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`${keys} keys (${skipped} volatile left out${other.length ? `, ${other.length} of another type` : ''}), ${kb} KB, ${((Date.now() - started) / 1000).toFixed(1)} s -> ${file}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
