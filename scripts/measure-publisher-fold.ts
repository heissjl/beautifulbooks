/**
 * Cover pairs that only a cross-publisher rule could fold (ROADMAP 6.36).
 *
 *   npx tsx scripts/measure-publisher-fold.ts 40 > /tmp/pairs.json
 *
 * The wall folds below distance 8 unconditionally, up to 20 under one ISBN
 * and up to 16 within one house in the same year. Julian's case — the same
 * design at Kiepenheuer & Witsch and at Rowohlt — sits at 19 and 22 and is
 * held apart. This collects exactly the pairs such a rule would decide:
 * **within one work, different houses, distance 9 to 22, no language
 * conflict**, each with its colour distance from the built index, so the
 * wedge that the game uses (`sameJacket`) can be judged on them.
 *
 * Structure alone cannot decide them — measured, different books share
 * layouts at 17-22 — so the output is made to be **looked at**, not averaged:
 * it writes JSON with both image URLs, and `scripts/fold-sheet.ts` turns that
 * into a page of pairs.
 *
 * Open Library only; no Google, no quota. One work takes 3-10 s.
 */
import indexFile from '../data/cover-index.json';
import { indexSignatures } from '../lib/coverindex';
import { hamming, colourDistance } from '../lib/imagesig';
import { coverUrlFor } from '../lib/coverurl';
import { getWorkDetail } from '../lib/work';
import type { Cover, Edition } from '../lib/model';

const MIN_DISTANCE = 9;
const MAX_DISTANCE = 22;

interface Side {
  id: string;
  url: string;
  publishers: string[];
  years: number[];
  isbns: string[];
  languages: string[];
}

interface Pair {
  workId: string;
  title: string;
  distance: number;
  colour: number | null;
  a: Side;
  b: Side;
}

function sideOf(cover: Cover, byId: Map<string, Edition>): Side {
  const editions = cover.editionIds.map(id => byId.get(id)).filter((e): e is Edition => !!e);
  return {
    id: cover.id,
    url: coverUrlFor(cover.id, 'M') ?? cover.url,
    publishers: [...new Set(editions.map(e => e.publisher).filter((p): p is string => !!p))],
    years: [...new Set(editions.map(e => e.year).filter((y): y is number => typeof y === 'number'))],
    isbns: [...new Set(editions.map(e => e.isbn13).filter((i): i is string => !!i))],
    languages: [...new Set(editions.map(e => e.language).filter((l): l is string => !!l))],
  };
}

const norm = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const shareName = (a: string[], b: string[]) =>
  a.some(x => b.some(y => norm(x) === norm(y) || norm(x).includes(norm(y)) || norm(y).includes(norm(x))));
const shareAny = (a: string[], b: string[]) => a.some(x => b.includes(x));

async function main() {
  const limit = Number(process.argv[2] ?? 40);
  const works = (indexFile.works as Array<[string, string, string]>)
    .map(([id, title]) => ({ id, title }))
    .slice(0, limit);
  const pairs: Pair[] = [];
  let looked = 0;

  for (const work of works) {
    let detail;
    try {
      detail = await getWorkDetail(work.id, { maxEntries: 400, dedupeCovers: false, googleBooks: false });
    } catch {
      continue;
    }
    if (!detail) continue;
    looked += 1;
    const sigs = indexSignatures(detail.covers.map(c => c.id));
    const byId = new Map(detail.editions.map(e => [e.id, e]));
    const sides = detail.covers.map(c => ({ cover: c, side: sideOf(c, byId), sig: sigs.get(c.id) }));

    for (let i = 0; i < sides.length; i++) {
      for (let j = i + 1; j < sides.length; j++) {
        const a = sides[i];
        const b = sides[j];
        if (!a.sig || !b.sig) continue;
        const distance = hamming(a.sig.hash, b.sig.hash);
        if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) continue;
        // Only the pairs the current rule leaves apart and a publisher rule could join.
        if (shareAny(a.side.isbns, b.side.isbns)) continue;
        if (shareName(a.side.publishers, b.side.publishers)) continue;
        if (a.side.publishers.length === 0 || b.side.publishers.length === 0) continue;
        if (a.side.languages.length > 0 && b.side.languages.length > 0 && !shareAny(a.side.languages, b.side.languages)) continue;
        pairs.push({
          workId: work.id,
          title: work.title,
          distance,
          colour: colourDistance(a.sig, b.sig),
          a: a.side,
          b: b.side,
        });
      }
    }
    process.stderr.write(`${work.id} ${work.title}: ${detail.covers.length} covers, ${pairs.length} pairs so far\n`);
  }

  pairs.sort((x, y) => x.distance - y.distance);
  process.stderr.write(`\n${looked} works looked at, ${pairs.length} cross-publisher pairs between ${MIN_DISTANCE} and ${MAX_DISTANCE}\n`);
  console.log(JSON.stringify({ works: looked, min: MIN_DISTANCE, max: MAX_DISTANCE, pairs }, null, 1));
}

main();
