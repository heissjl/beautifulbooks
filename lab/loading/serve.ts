/**
 * The three loading-screen animations, side by side (lab/loading/README.md).
 *
 *   npx tsx lab/loading/serve.ts        # then open http://localhost:4323
 *
 * A static file server and nothing else: it hands out `index.html` and the
 * built mosaics under `out/`. No API, no data written, no network — the whole
 * point of the experiment is that a loading screen costs one image and a few
 * kilobytes of JSON.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

const HERE = import.meta.dirname;
const PORT = Number(process.env.PORT ?? 4323);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  // Everything this server can serve lives under lab/loading; a path that
  // climbs out of it is a bug or a probe, and gets the same answer either way.
  const file = join(HERE, normalize(rel));
  if (!file.startsWith(HERE)) {
    res.writeHead(403).end('no');
    return;
  }
  try {
    const body = await readFile(file);
    const ext = rel.slice(rel.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end(`not found: ${rel}`);
  }
});

server.listen(PORT, () => {
  console.log(`loading: open http://localhost:${PORT}`);
  console.log('build a mosaic first: npx tsx lab/loading/build.ts --author "mark twain" --target <portrait url>');
});
