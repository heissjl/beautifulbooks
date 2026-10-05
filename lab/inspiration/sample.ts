/**
 * A poster from nine flat colours, no network (lab/inspiration): for looking at the
 * layout where Open Library cannot be reached.
 *
 *   npx tsx lab/inspiration/sample.ts [outdir]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { SITE_NAME } from '../../lib/seo';
import { emptyBoard, place } from './board';
import { renderPoster } from './poster';

const COLOURS = ['#c8102e', '#f2c500', '#1d3c6e', '#e87722', '#2f6b4f', '#f4f0e8', '#111111', '#7a4ea3', '#9bc4cb'];

async function main() {
  const out = process.argv[2] ?? join(__dirname, 'out');
  await mkdir(out, { recursive: true });
  let board = emptyBoard();
  COLOURS.forEach((_, i) => { board = place(board, i, { workId: `OL${i + 1}W`, coverId: `ol:${i + 1}` }); });
  board = { ...board, by: 'Julian' };
  // Scans are rarely exactly 2:3; 180 × 290 shows the trim.
  const load = async (id: string) => sharp({ create: { width: 180, height: 290, channels: 3, background: COLOURS[Number(id.slice(3)) - 1] } }).jpeg().toBuffer();
  for (const format of ['story', 'feed'] as const) {
    const png = await renderPoster(board, format, { title: 'The books that inspired me', site: SITE_NAME, address: 'buyitscovers.com/inspiration' }, load);
    await writeFile(join(out, `sample-${format}.png`), png);
    console.log(join(out, `sample-${format}.png`));
  }
}
main();
