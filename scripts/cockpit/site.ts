/**
 * The website's own map (ROADMAP 6.54, „Website-Karte"): its routes, read
 * from app/ — pages, API routes, their states (loading.tsx, notFound(),
 * status codes), the components a page imports and the APIs those fetch.
 * Pure: file paths and texts in.
 */
import { headerComment, type SourceFile } from './tools';

export interface Route {
  route: string;
  kind: 'page' | 'api' | 'route';
  file: string;
  what: string;
  states: string[];
  components: string[];
  apis: string[];
  methods: string[];
  /** A URL that opens the page without parameters to invent; null for dynamic routes. */
  example: string | null;
  /** May the Cockpit take a screenshot on request? Never for a work page (Google quota, 0.2). */
  shot: boolean;
}

/** app/book/[id]/page.tsx → /book/[id] */
export function routeOf(file: string): string {
  const r = file.replace(/^app/, '').replace(/\/(page\.tsx|route\.ts)$/, '');
  return r === '' ? '/' : r;
}

function firstSentences(text: string): string {
  const doc = headerComment(text) || (/\/\*\*([\s\S]*?)\*\//.exec(text)?.[1] ?? '').split('\n').map(l => l.replace(/^\s*\*\s?/, '')).join('\n');
  const para = doc.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
  return para.length > 280 ? para.slice(0, 277).replace(/\s+\S*$/, '') + '…' : para;
}

export function mapSite(files: SourceFile[]): Route[] {
  const byPath = new Map(files.map(f => [f.path, f.text]));
  const component = (name: string) => byPath.get(`components/${name}.tsx`) ?? byPath.get(`components/${name}.ts`) ?? '';
  const routes: Route[] = [];
  for (const f of files) {
    const m = /^app\/(.*\/)?(page\.tsx|route\.ts)$/.exec(f.path);
    if (!m) continue;
    const route = routeOf(f.path);
    const isApi = route.startsWith('/api/');
    const kind: Route['kind'] = f.path.endsWith('page.tsx') ? 'page' : isApi ? 'api' : 'route';
    const dir = f.path.replace(/\/(page\.tsx|route\.ts)$/, '');
    const states: string[] = [];
    if (byPath.has(`${dir}/loading.tsx`)) states.push('Ladezustand (loading.tsx)');
    if (/notFound\(\)/.test(f.text)) states.push('404 (notFound)');
    if (/redirect\(/.test(f.text)) states.push('Weiterleitung');
    if (/force-dynamic/.test(f.text)) states.push('je Anfrage gerendert');
    if (/revalidate\s*=/.test(f.text)) states.push('ISR');
    const codes = [...new Set([...f.text.matchAll(/\b(4\d\d|5\d\d)\b/g)].map(x => x[1]))].filter(c => ['400', '401', '403', '404', '429', '503'].includes(c));
    if (kind !== 'page' && codes.length) states.push(`antwortet ${codes.join(', ')}`);
    const components = [...new Set([...f.text.matchAll(/from '@\/components\/([\w/]+)'/g)].map(x => x[1]))];
    const apis = new Set<string>();
    for (const c of [f.text, ...components.map(component)]) {
      for (const a of c.matchAll(/[`'"](\/api\/[\w/-]+)/g)) apis.add(a[1]);
    }
    const methods = kind === 'page' ? [] : [...f.text.matchAll(/export async function (GET|POST|PUT|DELETE)/g)].map(x => x[1]);
    const example = kind === 'page' && !route.includes('[') ? route : null;
    routes.push({
      route, kind, file: f.path, what: firstSentences(f.text), states, components, apis: [...apis].sort(), methods,
      example, shot: kind === 'page' && !route.startsWith('/book'),
    });
  }
  const order = (r: Route) => (r.kind === 'page' ? 0 : r.kind === 'route' ? 1 : 2);
  return routes.sort((a, b) => order(a) - order(b) || a.route.localeCompare(b.route));
}
