/**
 * Builds one loading-screen mosaic by hand (lab/loading/README.md).
 *
 *   npx tsx lab/loading/build.ts --author "mark twain" \
 *     --target "https://commons.wikimedia.org/wiki/Special:FilePath/MarkTwain.LOC.jpg?width=1200" \
 *     --credit "Unknown author, 1907 — public domain"
 *
 * The twenty of the rotation are built by `build-all.ts` from
 * `templates.json`; this is for trying one picture, or one setting, on its
 * own. Both run the same code in `template.ts`.
 */
import { buildTemplate, type Options } from './template';

function parseArgs(argv: string[]): Options {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) throw new Error(`expected a --flag, got ${argv[i]}`);
    flags.set(argv[i].slice(2), argv[i + 1] ?? '');
  }
  const num = (name: string, fallback: number) => {
    const raw = flags.get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`--${name} needs a number, got ${raw}`);
    return value;
  };
  const list = (name: string, fallback: number[]) => {
    const raw = flags.get(name);
    if (!raw) return fallback;
    return raw.split(',').map(s => {
      const value = Number(s.trim());
      if (!Number.isFinite(value)) throw new Error(`--${name} needs numbers, got ${raw}`);
      return value;
    });
  };
  const author = flags.get('author') ?? '';
  const works = (flags.get('work') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!author && works.length === 0) throw new Error('--author or --work is needed');
  return {
    author,
    works,
    id: flags.get('id') ?? (author || works.join('-')).replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    target: flags.get('target') ?? 'auto',
    credit: flags.get('credit') ?? '',
    // Two grids, because the trade-off is the whole question: at 24 columns a
    // cell is still visibly a book, at 48 the face is better and the tiles
    // turn into confetti.
    cols: list('cols', [24, 40]),
    // 480 covers a phone at 2x for a 240 px picture; 960 covers a desktop.
    widths: list('width', [480, 720, 960]),
    quality: num('quality', 72),
    colourWeight: num('colour-weight', 0.15),
    maxWorks: num('max-works', 8),
    maxPages: num('max-pages', 12),
    aspect: num('aspect', 0),
    crop: flags.get('crop')
      ? (flags.get('crop')!.split(',').map(Number) as [number, number, number, number])
      : undefined,
  };
}

async function main() {
  const started = Date.now();
  await buildTemplate(parseArgs(process.argv.slice(2)));
  console.log(`took ${Math.round((Date.now() - started) / 100) / 10}s`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
