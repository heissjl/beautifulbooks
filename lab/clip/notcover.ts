/**
 * Question A: does CLIP tell a cover from a thing that is not one — a page of
 * text, a placeholder, a blank board, an audiobook square, a photo of a book?
 *
 *   npx tsx lab/clip/notcover.ts [--sample 1500]
 *
 *   npx tsx lab/clip/notcover.ts --prompts v1   # score the sheets with another prompt set
 *
 * Truth: the 23 images taken out of the game by hand (data/versus-pool.json
 * `excluded`) and everything labelled by eye in notcover-labelled.json, against
 * the 1,000 covers that played. The game's covers already passed its filters
 * and are the easy half, so a seeded slice of the index outside the game is
 * looked at whole (outsideRandom) — the only place recall can be read.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rng } from '../../lib/loading';
import { embedCovers, embedTexts, OUT } from './clip';
import { atRecall, auc, cosine, notCoverProbability, strongestPrompt } from './score';

const ROOT = join(__dirname, '..', '..');
const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};

/**
 * Prompt sets, kept side by side so a change is measured, not assumed.
 * v1 was the first guess. Its "theatre poster", "square audiobook cover" and
 * "audio CD case" pulled illustrated real covers to the top (contact sheets,
 * 2026-09-22), so v2 drops them and names what the sheets actually showed:
 * back covers with blurbs, a library due-date slip, blank pages.
 */
export const PROMPT_SETS = {
  v1: {
    cover: [
      'a book cover',
      'the front cover of a novel',
      'an illustrated book jacket with the title and the author',
      'a paperback cover design',
    ],
    other: [
      'a scanned page of printed text',
      'the title page inside a book',
      'a copyright page with a library stamp',
      'a placeholder image that says cover not available',
      'a plain board of one colour with nothing on it',
      'a square audiobook cover',
      'an audio CD case',
      'a photograph of a book lying on a table',
      'a theatre poster',
      'a product photo of merchandise',
    ],
  },
  v2: {
    cover: [
      'a book cover',
      'the front cover of a novel',
      'an illustrated book jacket with the title and the author',
      'a paperback cover design',
      'a movie tie-in book cover with a film still',
      'a cloth-bound hardcover with the title stamped on it',
    ],
    other: [
      'a scanned page of printed text',
      'the title page inside a book',
      'the back cover of a book with a barcode and quotes from reviews',
      'a library date due slip with stamps',
      'a placeholder image that says cover not available',
      'a plain board of one colour with nothing on it',
      'a blank white page',
      'a photograph of a product that is not a book',
      'an audio CD',
    ],
  },
} as const;

type Label = 'cover' | 'notcover' | 'unsure';

interface LabelFile {
  covers: Array<{ id: string; label: Label; seenIn: string }>;
}

async function main() {
  const pool = JSON.parse(readFileSync(join(ROOT, 'data/versus-pool.json'), 'utf8')) as {
    excluded: Array<{ id: string; reason: string }>;
    covers: Array<{ id: string; title: string }>;
  };
  const index = JSON.parse(readFileSync(join(ROOT, 'data/cover-index.json'), 'utf8')) as {
    works: Array<[string, string, string]>;
    covers: Array<[number, string, ...unknown[]]>;
  };
  const labelFile = join(__dirname, 'notcover-labelled.json');
  const labels = existsSync(labelFile) ? (JSON.parse(readFileSync(labelFile, 'utf8')) as LabelFile).covers : [];
  const labelOf = new Map(labels.map((l) => [l.id, l.label]));

  const excluded = pool.excluded.map((e) => e.id);
  const game = pool.covers.map((c) => c.id).filter((id) => !excluded.includes(id));
  const inGame = new Set([...excluded, ...game]);
  const outside = index.covers.map((c) => c[1]).filter((id) => !inGame.has(id));
  const random = rng(22);
  for (let i = outside.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [outside[i], outside[j]] = [outside[j], outside[i]];
  }
  const unlabelled = outside.slice(0, arg('sample', 1500));
  const titleOf = new Map(index.covers.map((c) => [c[1], index.works[c[0]][1]]));

  const vectors = await embedCovers([...excluded, ...game, ...unlabelled]);
  const has = (id: string) => Boolean(vectors.get(id));
  const U = unlabelled.filter(has);
  // The honest check: a seeded slice of the outside sample, looked at whole, not just its top.
  const randomSlice = U.slice(0, arg('random', 120));

  // Truth: the hand-excluded and every image labelled by eye; a game cover nobody
  // looked at counts as a cover, which it is for all but a few (the sheets found
  // ten among the game's top forty).
  const notcover = [...excluded, ...labels.filter((l) => l.label === 'notcover').map((l) => l.id)].filter(has);
  const isCover = [
    ...labels.filter((l) => l.label === 'cover').map((l) => l.id),
    ...game.filter((id) => !labelOf.has(id)),
  ].filter(has);
  console.log(`truth: ${notcover.length} not a cover, ${isCover.length} covers (${labels.length} labelled by eye); ${U.length} outside the game`);

  const chosen = (process.argv.includes('--prompts') ? process.argv[process.argv.indexOf('--prompts') + 1] : 'v2') as keyof typeof PROMPT_SETS;
  const scorers = new Map<string, (id: string) => number>();
  const leans = new Map<string, (id: string) => string>();
  for (const [name, set] of Object.entries(PROMPT_SETS)) {
    const cover = await embedTexts(set.cover);
    const other = await embedTexts(set.other);
    scorers.set(name, (id) => notCoverProbability(vectors.get(id)!, cover, other));
    leans.set(name, (id) => set.other[strongestPrompt(vectors.get(id)!, other)]);
  }
  // Nearest known non-cover, leaving the image itself out: "have we seen one like it".
  scorers.set('nearest', (id) =>
    Math.max(...notcover.filter((p) => p !== id).map((p) => cosine(vectors.get(id)!, vectors.get(p)!))),
  );

  for (const [name, score] of scorers) {
    const p = notcover.map(score);
    const n = isCover.map(score);
    console.log(`\n${name}: AUC ${auc(p, n).toFixed(3)}`);
    for (const r of [0.5, 0.75, 0.9].map((share) => atRecall(p, n, share))) {
      console.log(`  catch ${r.caught}/${p.length} at ≥ ${r.threshold.toFixed(3)}: ${r.falseAlarms} of ${n.length} covers caught too`);
    }
  }

  const zeroShot = scorers.get(chosen)!;
  const randomLabels = randomSlice.map((id) => labelOf.get(id));
  if (randomLabels.every((l) => l !== undefined)) {
    const bad = randomSlice.filter((id) => labelOf.get(id) === 'notcover');
    const good = randomSlice.filter((id) => labelOf.get(id) === 'cover');
    console.log(`\nrandom slice outside the game (${chosen}): ${bad.length} of ${randomSlice.length} are not covers`);
    for (const t of [0.3, 0.5, 0.7]) {
      console.log(
        `  at ≥ ${t}: ${bad.filter((id) => zeroShot(id) >= t).length}/${bad.length} caught, ${good.filter((id) => zeroShot(id) >= t).length}/${good.length} covers caught too`,
      );
    }
  } else {
    console.log(`\nrandom slice not labelled yet: python3 lab/clip/sheet.py notcover --blind, then label outsideRandom`);
  }

  const describe = (id: string) => ({
    id,
    title: titleOf.get(id) ?? pool.covers.find((c) => c.id === id)?.title ?? '',
    zeroShot: Number(zeroShot(id).toFixed(3)),
    leansTo: leans.get(chosen)!(id),
    label: labelOf.get(id) ?? (excluded.includes(id) ? 'notcover' : undefined),
  });
  const outsideScores = U.map(zeroShot);
  for (const t of [0.5, 0.7, 0.9]) {
    console.log(`outside the game (${chosen}): ${outsideScores.filter((s) => s >= t).length} of ${U.length} at ≥ ${t}`);
  }
  writeFileSync(
    join(OUT, 'notcover.json'),
    JSON.stringify(
      {
        prompts: PROMPT_SETS[chosen],
        excluded: excluded.filter(has).map(describe),
        gameTop: game.filter(has).map(describe).sort((a, b) => b.zeroShot - a.zeroShot).slice(0, 40),
        outsideTop: U.map(describe).sort((a, b) => b.zeroShot - a.zeroShot).slice(0, 80),
        outsideRandom: randomSlice.map(describe),
      },
      null,
      1,
    ),
  );
  console.log(`\nwritten: ${join(OUT, 'notcover.json')} — python3 lab/clip/sheet.py notcover`);
}

if (require.main === module) main();
