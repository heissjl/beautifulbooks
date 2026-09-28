/**
 * Settings for the Cockpit's „Dienste & Einstellungen" (ROADMAP 6.54): which
 * variables exist, where each is set, and checks that need no value.
 *
 * **The rule for secrets** (proposal §5a, Julian's answer 8, 2026-09-25):
 *   1. A value is read only from the **main folder's** `.env.local`, held in
 *      the generator's memory, and handed out only by the local server on
 *      127.0.0.1 with its token, after a click on „zeigen". It is never
 *      written into docs/cockpit.html or any other file.
 *   2. Vercel values are never read; `vercel env ls` gives names and
 *      environments only (Julian's answer 9).
 *   3. Checks that compare values (two passwords equal?) compare hashes and
 *      report only „gleich" / „verschieden".
 */
import { createHash } from 'node:crypto';

/** `.env` text → name → value. Comments and blank lines skipped, surrounding quotes removed. */
export function parseEnv(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    out.set(m[1], value);
  }
  return out;
}

/** Secret by name: keys, passwords, tokens, the store, and the imprint (personal data). */
export function isSecret(name: string): boolean {
  return /KEY|PASSWORD|TOKEN|SECRET|^STORAGE_|^IMPRINT_|REDIS|_URL$/.test(name) && name !== 'NEXT_PUBLIC_SITE_URL';
}

/** Variable names the code reads: `process.env.X`, `env.X`, and `env['X']`. */
export function envNamesInCode(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/\benv(?:\.|\[['"])([A-Z][A-Z0-9_]+)/g)) names.add(m[1]);
  return [...names];
}

export interface VercelVar { name: string; environments: string[] }

/** `vercel env ls` output → names and environments. The value column is dropped unread. */
export function parseVercelEnvLs(out: string): VercelVar[] {
  const vars = new Map<string, Set<string>>();
  let inTable = false;
  for (const line of out.split('\n')) {
    if (/^\s*name\s+value\s+type\s+environments/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.trim()) { if (vars.size) break; continue; }
    const cols = line.trim().split(/\s{2,}/);
    if (cols.length < 4 || !/^[A-Z][A-Z0-9_]*$/.test(cols[0])) continue;
    const set = vars.get(cols[0]) ?? new Set<string>();
    for (const e of cols[3].split(/,\s*/)) if (e) set.add(e);
    vars.set(cols[0], set);
  }
  return [...vars].map(([name, envs]) => ({ name, environments: [...envs] }));
}

export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface EnvCheck { level: 'act' | 'info' | 'ok'; text: string }

/**
 * Checks on the main `.env.local` that report no value: equal passwords,
 * variables from `.env.example` that are set nowhere, variables Vercel has
 * that no code reads.
 */
export function envChecks(
  local: Map<string, string> | null,
  example: string[],
  codeNames: string[],
  vercel: VercelVar[] | null,
): EnvCheck[] {
  const out: EnvCheck[] = [];
  if (local) {
    const a = local.get('SUGGEST_PASSWORD'), b = local.get('SUGGEST_ADMIN_PASSWORD');
    if (a && b) {
      out.push(fingerprint(a) === fingerprint(b)
        ? { level: 'act', text: 'SUGGEST_PASSWORD und SUGGEST_ADMIN_PASSWORD sind in .env.local gleich; .env.example verlangt verschiedene (verglichen per Hash).' }
        : { level: 'ok', text: 'SUGGEST_PASSWORD und SUGGEST_ADMIN_PASSWORD sind verschieden (verglichen per Hash).' });
    }
  } else {
    out.push({ level: 'info', text: 'Keine .env.local im Hauptordner gefunden — „lokal gesetzt“ ist unbekannt.' });
  }
  const vnames = new Set((vercel ?? []).map(v => v.name));
  for (const name of example) {
    if (local && !local.get(name) && vercel && !vnames.has(name) && !/^AFFILIATE_|^BLURB_SOURCE$/.test(name)) {
      out.push({ level: 'info', text: `${name} steht in .env.example, ist aber weder lokal noch in Vercel gesetzt.` });
    }
  }
  if (vercel) {
    const known = new Set([...codeNames, ...example]);
    for (const v of vercel) {
      if (!known.has(v.name) && !v.name.startsWith('STORAGE_')) out.push({ level: 'info', text: `${v.name} ist in Vercel gesetzt, aber kein Code liest es.` });
    }
    if (!vnames.has('SUGGEST_ADMIN_PASSWORD')) out.push({ level: 'info', text: 'SUGGEST_ADMIN_PASSWORD fehlt in Vercel — die Sammlungs-App kann Produktion nicht lesen.' });
  } else {
    out.push({ level: 'info', text: '`vercel env ls` lief nicht (CLI nicht angemeldet oder nicht verknüpft) — die Spalten Prod und Preview sind unbekannt, nicht leer.' });
  }
  return out;
}
