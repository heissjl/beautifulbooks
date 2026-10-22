/**
 * Reads a backup file back into an **empty** Redis (ROADMAP 2.11, lib/backup.ts):
 *
 *   npx tsx scripts/restore.ts <file.jsonl> --to redis://127.0.0.1:6379 [--force] [--allow-remote]
 *
 * The target comes only from `--to`, never from `STORAGE_*`: a sourced
 * `.env.local` once pointed a local run at the production store
 * (docs/umgang.md §4). A host other than localhost needs `--allow-remote`,
 * and the store must hold no key (DBSIZE 0) unless `--force` is given, which
 * overwrites keys of the same name and deletes a list or hash before it is
 * rewritten — nothing else is ever flushed. Each key gets the time it had
 * left when exported; a key whose time ran out in between is skipped and counted.
 */
import { readFileSync } from 'node:fs';
import { parseBackup, restoreRecords } from '../lib/backup';
import { redisCommands } from '../lib/redis';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = process.argv[2];
  const to = arg('--to');
  if (!file || !to || file.startsWith('--')) {
    throw new Error('usage: npx tsx scripts/restore.ts <file.jsonl> --to redis://127.0.0.1:6379 [--force] [--allow-remote]');
  }
  const url = new URL(to);
  if (!/^rediss?:$/.test(url.protocol)) throw new Error(`--to must be a redis:// or rediss:// address, not ${url.protocol}`);
  const local = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname);
  if (!local && !process.argv.includes('--allow-remote')) throw new Error(`${url.hostname} is not this machine; add --allow-remote if you mean it.`);
  const force = process.argv.includes('--force');

  const parsed = parseBackup(readFileSync(file, 'utf8'));
  if (!parsed.ok) throw new Error(`not restoring: ${parsed.error}`);
  const { backup } = parsed;

  const commands = redisCommands(to);
  const size = Number(await commands.dbSize?.());
  if (!force && size !== 0) throw new Error(`the store at ${url.host} holds ${Number.isFinite(size) ? size : '?'} keys; restore only into an empty one, or say --force to overwrite keys of the same name.`);

  const started = Date.now();
  const result = await restoreRecords(commands, backup, { now: new Date(), force });
  console.log(`${result.written} keys written to ${url.host} from ${backup.header.origin} as of ${backup.header.at}${result.expired ? `, ${result.expired} expired in between` : ''}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  process.exit(0);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
