/**
 * The tool catalogue (ROADMAP 6.54, view „Werkzeuge"): every app, server and
 * script the project has, read from package.json and from the usage line at
 * the top of each script — never a hand-kept list. Pure.
 *
 * **The catalogue is also the launcher's whitelist.** The local server
 * (server.ts) starts only an entry of this list, by id, with the argv stored
 * here, never a command line from the browser. A script whose usage names a
 * required argument (`<slug>`, `OL123W`) stays copy-only; a script that asks
 * Google Books gets a warning and no button (E10: the 1,000 a day are the
 * visitors').
 */

export type ToolKind = 'server' | 'oneshot' | 'online';

export interface Tool {
  id: string;
  group: string;
  name: string;
  why: string;
  kind: ToolKind;
  /** The command as shown and copied. */
  display: string;
  /** What the launcher runs, without a shell; absent when the tool may not be started from the page. */
  argv?: string[];
  /** Environment for the child: fixed values (never secrets). */
  env?: Record<string, string>;
  /** Names read from the main .env.local into the child's environment — the values never reach the page. */
  envFromLocal?: string[];
  port?: number;
  url?: string;
  /** Source file, for the link. */
  file?: string;
  items: string[];
  warn?: string;
  /** Why there is no start button. */
  copyOnly?: string;
}

export interface SourceFile { path: string; text: string }

export const LIVE = 'https://beautifulcovers.vercel.app';
export const DEV = 'http://localhost:3000';

/** The doc comment at the top of a file, without stars. */
export function headerComment(text: string): string {
  const m = /^\s*(?:#![^\n]*\n)?\/\*\*([\s\S]*?)\*\//.exec(text);
  if (!m) return '';
  return m[1].split('\n').map(l => l.replace(/^\s*\*\s?/, '')).join('\n').trim();
}

/** The first sentence of the header comment that is prose (not a command line). */
export function purpose(text: string): string {
  const header = headerComment(text);
  const prose = header.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim())
    .find(p => p && !/^(npx|npm|Usage:|Run:)/.test(p));
  if (!prose) return '';
  const first = prose.split(/(?<=[.!?])\s+(?=[A-Z„(])/)[0];
  return first.length > 220 ? first.slice(0, 217).replace(/\s+\S*$/, '') + '…' : first;
}

/** The usage line: the first `npx tsx <file> …` in the header, arguments and trailing comment split off. */
export function usageOf(text: string, file: string): { args: string; comment: string } | null {
  const header = headerComment(text);
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`npx tsx ${escaped}([^\\n#]*)(?:#\\s*(.*))?`).exec(header);
  if (!m) return null;
  return { args: m[1].replace(/\\$/, '').trim(), comment: (m[2] ?? '').trim() };
}

/** Required arguments: anything that is not an optional `[…]` group or a `>` redirect. */
export function requiresArgs(args: string): boolean {
  const rest = args.replace(/\[[^\]]*\]/g, '').replace(/>.*$/, '').trim();
  return rest.length > 0;
}

export function portOf(text: string): number | undefined {
  const m = /PORT\s*\?\?\s*(\d{4,5})/.exec(text);
  return m ? Number(m[1]) : undefined;
}

export function asksGoogle(text: string): boolean {
  return /googlebooks|GOOGLE_BOOKS_API_KEY|googleapis\.com\/books/i.test(text) && !/googleBooks:\s*false/.test(text);
}

function itemsIn(text: string): string[] {
  const header = headerComment(text);
  return [...new Set([...header.matchAll(/ROADMAP (\d+\.\d+[a-z]?)/g)].map(m => m[1]))];
}

const GROUP_OF = (file: string, server: boolean): string => {
  if (server && /^lab\/(curate|collections)\//.test(file)) return 'Kuratieren';
  if (server) return 'Lab mit Oberfläche';
  if (file.startsWith('lab/collections/') || file.startsWith('lab/isfdb/')) return 'Sammlungen bauen';
  if (file.startsWith('scripts/')) return 'Daten bauen und messen';
  return 'Lab-Skripte';
};

/** Names that read better than the file name, keyed by file. The rest is named by its path. */
const NAMES: Record<string, string> = {
  'lab/curate/serve.ts': 'Kuratier-App (Startseite)',
  'lab/collections/serve.ts': 'Sammlungs-App',
  'lab/duel/serve.ts': 'Duell',
  'lab/hotornot/serve.ts': 'Hot or Not (Lab)',
  'lab/loading/serve.ts': 'Ladebild-Vorlagen',
};

export function buildCatalog(packageJson: string, files: SourceFile[]): Tool[] {
  const tools: Tool[] = [];
  const pkg = JSON.parse(packageJson) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};

  // The website and the checks, from package.json.
  if (scripts.dev) tools.push({
    id: 'dev', group: 'Website', name: 'Dev-Server', kind: 'server', port: 3000, url: DEV,
    why: 'Die Seite lokal — hier wird geprüft, nicht in Produktion (CLAUDE.md).',
    display: 'npm run dev', argv: ['npm', 'run', 'dev'], file: 'package.json', items: [],
  });
  if (scripts['test:run']) tools.push({
    id: 'checks', group: 'Website', name: 'Prüfen: Tests, Typen, Lint', kind: 'oneshot',
    why: 'Was vor jedem Commit grün sein muss; der Build kommt vor einem Deploy dazu.',
    display: 'npm run test:run && npx tsc --noEmit && npx eslint .',
    argv: ['sh', '-c', 'npm run test:run && npx tsc --noEmit && npx eslint .'], file: 'package.json', items: [],
  });
  if (scripts.build) tools.push({
    id: 'build', group: 'Website', name: 'Build', kind: 'oneshot',
    why: 'Muss durchlaufen, bevor ein Schritt als fertig gilt. Braucht die IMPRINT_*-Angaben.',
    display: 'npm run build', argv: ['npm', 'run', 'build'], envFromLocal: ['IMPRINT_NAME', 'IMPRINT_STREET', 'IMPRINT_CITY', 'IMPRINT_EMAIL'],
    file: 'package.json', items: [],
  });
  if (scripts.worktrees) tools.push({
    id: 'worktrees', group: 'Übersichten', name: 'Worktrees und Branches', kind: 'oneshot',
    why: 'Vor jedem Merge nach main: wer ist wie weit von Produktion. Schreibt docs/worktrees.md.',
    display: 'npm run worktrees -- --fetch', argv: ['npm', 'run', 'worktrees', '--', '--fetch'], file: 'scripts/worktrees.ts', items: [],
  });
  tools.push(
    { id: 'curate-online', group: 'Kuratieren', name: '/curate online (Freunde)', kind: 'online', url: `${LIVE}/curate`,
      why: 'Die Sammlungs-App für Freunde, hinter Passwort; Entwürfe liegen im Redis der Produktion.', display: '', items: ['5.10b', '5.10g'] },
    { id: 'suggest-online', group: 'Kuratieren', name: '/suggest online (Freunde)', kind: 'online', url: `${LIVE}/suggest`,
      why: 'Ein Buch für eine Sammlung vorschlagen; ändert nie eine Seite.', display: '', items: ['5.10a'] },
  );

  for (const f of files) {
    if (!/^(scripts|lab)\/.+\.ts$/.test(f.path) || f.path.includes('__tests__') || f.path.startsWith('scripts/cockpit')) continue;
    const usage = usageOf(f.text, f.path);
    if (!usage) continue;
    const server = /\/serve\.ts$/.test(f.path);
    const port = server ? portOf(f.text) : undefined;
    const google = asksGoogle(f.text);
    const needsArgs = !server && requiresArgs(usage.args);
    const display = `npx tsx ${f.path}${usage.args ? ' ' + usage.args : ''}`;
    const tool: Tool = {
      id: f.path.replace(/\.ts$/, '').replace(/[^\w]+/g, '-'),
      group: GROUP_OF(f.path, server),
      name: NAMES[f.path] ?? f.path.replace(/\.ts$/, ''),
      why: purpose(f.text) || usage.comment,
      kind: server ? 'server' : 'oneshot',
      display: server ? `npx tsx ${f.path}` : display,
      file: f.path,
      items: itemsIn(f.text),
      ...(port ? { port, url: `http://localhost:${port}` } : {}),
    };
    if (google) { tool.warn = 'fragt Google Books'; tool.copyOnly = 'fragt Google Books — nur von Hand, mit Absicht (E10)'; }
    else if (needsArgs) tool.copyOnly = 'braucht Argumente — kopieren und ergänzen';
    else tool.argv = ['npx', 'tsx', f.path];
    tools.push(tool);

    // The collection tool once more, with friends' drafts and suggestions from production.
    if (f.path === 'lab/collections/serve.ts' && tool.argv) {
      tools.push({
        ...tool,
        id: `${tool.id}-remote`,
        name: 'Sammlungs-App mit Entwürfen aus Produktion',
        why: 'Wie die Sammlungs-App, dazu Vorschläge und /curate-Entwürfe der Produktion. Das Admin-Passwort kommt aus der .env.local des Hauptordners in den Prozess, nie in diese Seite.',
        display: `SUGGEST_REMOTE=${LIVE} SUGGEST_ADMIN_PASSWORD=… npx tsx ${f.path}`,
        env: { SUGGEST_REMOTE: LIVE },
        envFromLocal: ['SUGGEST_ADMIN_PASSWORD'],
      });
    }
  }
  return tools;
}

/** Ports that more than one server claims: "running?" is ambiguous there. */
export function portConflicts(tools: Tool[]): Array<{ port: number; tools: string[] }> {
  const byPort = new Map<number, string[]>();
  for (const t of tools) {
    if (t.kind !== 'server' || !t.port || t.id.endsWith('-remote')) continue;
    byPort.set(t.port, [...(byPort.get(t.port) ?? []), t.file ?? t.id]);
  }
  return [...byPort].filter(([, list]) => list.length > 1).map(([port, list]) => ({ port, tools: list }));
}
