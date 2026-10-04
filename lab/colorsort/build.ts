/**
 * Bundles app.ts into page.html and writes one self-contained file
 * (ROADMAP 5.16).
 *
 *   npx tsx lab/colorsort/build.ts            -> lab/colorsort/index.html
 *   npx tsx lab/colorsort/build.ts --out f    -> anywhere else
 *
 * The result needs no server: open it in a browser, or send it to a phone.
 * That is also why the photo cannot leave the device — there is nowhere for
 * it to go.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const here = import.meta.dirname;
const at = process.argv.indexOf('--out');
const out = at > 0 ? process.argv[at + 1] : join(here, 'index.html');

async function main() {
  const result = await build({
    entryPoints: [join(here, 'app.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
  });
  const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const page = readFileSync(join(here, 'page.html'), 'utf8').replace('/*APP*/', () => script);
  writeFileSync(out, page);
  console.log(`${out}: ${(page.length / 1024).toFixed(1)} KB`);
}

main().catch(err => { console.error(err); process.exit(1); });
