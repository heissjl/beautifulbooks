import { describe, expect, it } from 'vitest';
import { envChecks, envNamesInCode, isSecret, parseEnv, parseVercelEnvLs } from '../env';
import { hostAllowed, originAllowed, shotFileName, tokenMatches } from '../guard';
import { parseCwd, scriptOf } from '../listeners';
import { readProduction } from '../production';
import { embedJson, renderPage, SERVER_SLOT } from '../render';
import { mapSite } from '../site';
import { buildCatalog, portConflicts, requiresArgs, usageOf } from '../tools';
import type { CockpitData } from '../collect';

const PKG = JSON.stringify({ scripts: { dev: 'next dev', 'test:run': 'vitest run', build: 'next build', worktrees: 'x' } });
const file = (path: string, header: string, body = '') => ({ path, text: `/**\n${header.split('\n').map(l => ` * ${l}`).join('\n')}\n */\n${body}` });

describe('tool catalogue', () => {
  const files = [
    file('lab/collections/serve.ts', 'The collection tool.\n\n  npx tsx lab/collections/serve.ts     # then open http://localhost:4322', 'const PORT = Number(process.env.PORT ?? 4322);'),
    file('lab/duel/serve.ts', 'Two people, one link.\n\n  npx tsx lab/duel/serve.ts', 'const PORT = Number(process.env.PORT ?? 4322);'),
    file('lab/collections/from-isbns.ts', 'A series from a list.\n\n  npx tsx lab/collections/from-isbns.ts <list.json> <slug> "<title>" [publisher …]'),
    file('scripts/build-cover-index.ts', 'Builds the index (ROADMAP 6.10).\n\n  npx tsx scripts/build-cover-index.ts [--force] [--only=OL123W]'),
    file('scripts/record-fixtures.ts', 'Records fixtures.\n\nRun: npx tsx scripts/record-fixtures.ts [slug ...]', "import { x } from '../lib/sources/googlebooks';"),
    file('lib/other.ts', 'Not a tool.'),
  ];
  const tools = buildCatalog(PKG, files);
  const by = new Map(tools.map(t => [t.id, t]));

  it('reads usage lines, and tells required from optional arguments', () => {
    expect(usageOf(files[2].text, files[2].path)?.args).toBe('<list.json> <slug> "<title>" [publisher …]');
    expect(requiresArgs('<list.json> <slug>')).toBe(true);
    expect(requiresArgs('[--force] [--only=OL123W]')).toBe(false);
    expect(requiresArgs('30 > /tmp/pairs.json')).toBe(true);
  });

  it('makes startable only what needs no argument and asks no Google', () => {
    expect(by.get('scripts-build-cover-index')!.argv).toEqual(['npx', 'tsx', 'scripts/build-cover-index.ts']);
    expect(by.get('scripts-build-cover-index')!.items).toEqual(['6.10']);
    expect(by.get('lab-collections-from-isbns')!.argv).toBeUndefined();
    expect(by.get('lab-collections-from-isbns')!.copyOnly).toContain('Argumente');
    expect(by.get('scripts-record-fixtures')!.argv).toBeUndefined();
    expect(by.get('scripts-record-fixtures')!.warn).toBe('fragt Google Books');
    expect(tools.some(t => t.file === 'lib/other.ts')).toBe(false);
  });

  it('puts the admin password into the collection tool by name only', () => {
    const remote = by.get('lab-collections-serve-remote')!;
    expect(remote.envFromLocal).toEqual(['SUGGEST_ADMIN_PASSWORD']);
    expect(remote.display).toContain('SUGGEST_ADMIN_PASSWORD=…');
    expect(JSON.stringify(remote)).not.toMatch(/SUGGEST_ADMIN_PASSWORD=[^…]/);
  });

  it('finds two servers on one port', () => {
    expect(portConflicts(tools)).toEqual([{ port: 4322, tools: ['lab/collections/serve.ts', 'lab/duel/serve.ts'] }]);
  });
});

describe('settings', () => {
  it('parses .env text and knows secrets by name', () => {
    const env = parseEnv('# c\nA=1\nexport B="two words"\n\nC=\n');
    expect([...env]).toEqual([['A', '1'], ['B', 'two words'], ['C', '']]);
    for (const n of ['GOOGLE_BOOKS_API_KEY', 'SUGGEST_PASSWORD', 'STORAGE_REDIS_URL', 'IMPRINT_NAME']) expect(isSecret(n)).toBe(true);
    for (const n of ['HOTORNOT', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SITE_MODE']) expect(isSecret(n)).toBe(false);
    expect(envNamesInCode("process.env.GOOGLE_BOOKS_API_KEY; env.HOTORNOT; env['SUGGEST_PASSWORD']").sort()).toEqual(['GOOGLE_BOOKS_API_KEY', 'HOTORNOT', 'SUGGEST_PASSWORD']);
  });

  it('reads names and environments from `vercel env ls`, never the value column', () => {
    const out = `\n name                       value                       type      environments                created    \n SUGGEST_PASSWORD           Hidden                      Secret    Preview                     1d ago     \n SUGGEST_PASSWORD           Hidden                      Secret    Production                  1d ago     \n HOTORNOT                   eyJ2IjoidjIiLCJjIj…         Config    Production                  3d ago     \n\nNext steps:\n`;
    const vars = parseVercelEnvLs(out);
    expect(vars).toEqual([{ name: 'SUGGEST_PASSWORD', environments: ['Preview', 'Production'] }, { name: 'HOTORNOT', environments: ['Production'] }]);
    expect(JSON.stringify(vars)).not.toContain('eyJ2');
  });

  it('compares two passwords by hash and says only "gleich"', () => {
    const local = new Map([['SUGGEST_PASSWORD', 'same-secret-1'], ['SUGGEST_ADMIN_PASSWORD', 'same-secret-1']]);
    const checks = envChecks(local, [], [], [{ name: 'SUGGEST_ADMIN_PASSWORD', environments: ['Production'] }]);
    expect(checks[0]).toMatchObject({ level: 'act' });
    expect(JSON.stringify(checks)).not.toContain('same-secret-1');
    expect(envChecks(null, [], [], null).map(c => c.text).join(' ')).toMatch(/unbekannt/);
  });
});

describe('local server guard', () => {
  it('accepts only its own host, origin and token', () => {
    expect(hostAllowed('127.0.0.1:4320', 4320)).toBe(true);
    expect(hostAllowed('localhost:4320', 4320)).toBe(true);
    expect(hostAllowed('evil.example:4320', 4320)).toBe(false);
    expect(hostAllowed(undefined, 4320)).toBe(false);
    expect(originAllowed(undefined, 4320)).toBe(true);
    expect(originAllowed('http://127.0.0.1:4320', 4320)).toBe(true);
    expect(originAllowed('http://evil.example', 4320)).toBe(false);
    expect(tokenMatches('abc', 'abc')).toBe(true);
    expect(tokenMatches('abd', 'abc')).toBe(false);
    expect(tokenMatches(null, 'abc')).toBe(false);
    expect(shotFileName('/collections', 1280)).toBe('collections-1280.png');
    expect(shotFileName('/', 500)).toBe('start-500.png');
  });

  it('reads who listens on a port', () => {
    expect(parseCwd('p42\nfcwd\nn/Users/x/repo\n')).toBe('/Users/x/repo');
    expect(scriptOf('/usr/bin/node --import file:///x/loader.mjs lab/collections/serve.ts')).toBe('lab/collections/serve.ts');
  });
});

describe('production read', () => {
  it('reads drafts, says when the read route is missing, and never repeats the password', async () => {
    const seen: string[] = [];
    const fetcher = async (url: string, init: { headers: Record<string, string> }) => {
      seen.push(init.headers.authorization);
      return url.endsWith('/drafts')
        ? new Response(JSON.stringify({ drafts: [{ id: 'd1', works: [] }] }), { status: 200 })
        : new Response('{}', { status: 405 });
    };
    const snap = await readProduction('https://example.test', 'pw-canary-123', fetcher);
    expect(snap.drafts).toHaveLength(1);
    expect(snap.publishRoute).toBe('missing');
    expect(snap.switches).toBeNull();
    expect(seen).toEqual(['Bearer pw-canary-123', 'Bearer pw-canary-123']);
    expect(JSON.stringify(snap)).not.toContain('pw-canary-123');
  });

  it('does not ask at all without the password', async () => {
    const snap = await readProduction('https://example.test', undefined, async () => { throw new Error('asked'); });
    expect(snap.publishRoute).toBe('skipped');
  });
});

describe('page', () => {
  it('embeds JSON that cannot close its script element, and leaves the server slot empty', () => {
    expect(embedJson({ a: '</script><script>alert(1)</script>' })).not.toContain('</script>');
    const data = { hints: [], canary: 'x' } as unknown as CockpitData;
    const html = renderPage(data, { css: '', js: '' });
    expect(html).toContain(SERVER_SLOT);
    expect(html).not.toContain('COCKPIT_SERVER=');
  });
});

describe('site map', () => {
  it('reads routes, states and the APIs a page asks, and never offers a screenshot of a work page', () => {
    const routes = mapSite([
      { path: 'app/book/[id]/page.tsx', text: "import BookDetail from '@/components/BookDetail';\n/**\n * The work page.\n */\nexport const revalidate = 86400; notFound();" },
      { path: 'app/book/[id]/decades/loading.tsx', text: '' },
      { path: 'app/book/[id]/decades/page.tsx', text: '/** Decades. */' },
      { path: 'app/collections/page.tsx', text: '/** All collections. */' },
      { path: 'app/api/search/route.ts', text: "export async function GET() { return json({}, 503); }" },
      { path: 'components/BookDetail.tsx', text: "fetch(`/api/works/${id}`)" },
    ]);
    const by = new Map(routes.map(r => [r.route, r]));
    expect(by.get('/book/[id]')).toMatchObject({ kind: 'page', example: null, shot: false, apis: ['/api/works/'] });
    expect(by.get('/book/[id]')!.states).toEqual(['404 (notFound)', 'ISR']);
    expect(by.get('/book/[id]/decades')!.states).toContain('Ladezustand (loading.tsx)');
    expect(by.get('/collections')).toMatchObject({ example: '/collections', shot: true });
    expect(by.get('/api/search')).toMatchObject({ kind: 'api', methods: ['GET'], states: ['antwortet 503'] });
  });
});
