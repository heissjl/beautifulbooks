/**
 * Question B: does CLIP tell two scans of one jacket from two jackets of one
 * book — where the dHash cannot (lab/fold, SPEC §2.3)?
 *
 *   npx tsx lab/clip/fold.ts            # measure against every labelled pair
 *   npx tsx lab/clip/fold.ts --sample   # also draw new pairs to label by eye
 *
 * Labels: lab/fold/pairs-labelled.json (2026-09-09, 17 judged) and
 * lab/clip/pairs-labelled.json (this experiment's, same format). Pairs come
 * from the disputed bands of the dHash, 9–24 bits, inside one work; above 24
 * the dHash already calls them different and is rarely wrong, below 9 it folds.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rng } from '../../lib/loading';
import { hamming } from '../../lib/imagesig';
import { embedCovers, OUT } from './clip';
import { auc, cosine, separation } from './score';

const ROOT = join(__dirname, '..', '..');

interface Labelled {
  a: string;
  b: string;
  indexDistance: number;
  label: 'same' | 'diff' | 'skip';
  note?: string;
}

const BANDS: Array<[number, number]> = [[9, 12], [13, 16], [17, 20], [21, 24]];
const PER_BAND = 25;

function labelledPairs(): Labelled[] {
  const files = [join(ROOT, 'lab/fold/pairs-labelled.json'), join(__dirname, 'pairs-labelled.json')];
  return files.filter(existsSync).flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')) as { pairs: Labelled[] }).pairs);
}

async function main() {
  const index = JSON.parse(readFileSync(join(ROOT, 'data/cover-index.json'), 'utf8')) as {
    works: Array<[string, string, string]>;
    covers: Array<[number, string, string, ...unknown[]]>;
  };
  const labelled = labelledPairs().filter((p) => p.label !== 'skip');
  const vectors = await embedCovers([...new Set(labelled.flatMap((p) => [p.a, p.b]))]);
  const scored = labelled
    .filter((p) => vectors.get(p.a) && vectors.get(p.b))
    .map((p) => ({ ...p, clip: cosine(vectors.get(p.a)!, vectors.get(p.b)!) }));
  const same = scored.filter((p) => p.label === 'same');
  const diff = scored.filter((p) => p.label === 'diff');
  console.log(`labelled pairs with both vectors: ${same.length} same, ${diff.length} different`);

  const clipSep = separation(same.map((p) => p.clip), diff.map((p) => p.clip));
  // The dHash measures distance, so "similarity" is its negative.
  const hashSep = separation(same.map((p) => -p.indexDistance), diff.map((p) => -p.indexDistance));
  console.log(`  dHash:  worst same ${-hashSep.worstSame} bits, best different ${-hashSep.bestDiff} bits — ${hashSep.separates ? 'separates' : `overlap ${hashSep.overlap} pairs`}`);
  console.log(`  CLIP:   worst same ${clipSep.worstSame.toFixed(3)}, best different ${clipSep.bestDiff.toFixed(3)} — ${clipSep.separates ? 'separates' : `overlap ${clipSep.overlap} pairs`}`);
  console.log(`  AUC: dHash ${auc(same.map((p) => -p.indexDistance), diff.map((p) => -p.indexDistance)).toFixed(3)}, CLIP ${auc(same.map((p) => p.clip), diff.map((p) => p.clip)).toFixed(3)}`);
  // Every pair here is above 8 bits, so the dHash alone folds none of them; a CLIP threshold would fold these.
  const translated = (p: Labelled) => /translation/.test(p.note ?? '');
  const sameOwnLanguage = same.filter((p) => !translated(p));
  console.log('  a CLIP threshold would fold:');
  for (const t of [0.95, 0.92, 0.9, 0.88, 0.85, 0.8]) {
    const hit = same.filter((p) => p.clip >= t);
    const wrong = diff.filter((p) => p.clip >= t);
    console.log(
      `    ≥ ${t.toFixed(2)}: ${hit.length}/${same.length} same (${hit.filter((p) => !translated(p)).length}/${sameOwnLanguage.length} without translations), ${wrong.length}/${diff.length} different folded wrongly`,
    );
  }
  for (const p of [...scored].sort((x, y) => y.clip - x.clip)) {
    console.log(`  ${p.clip.toFixed(3)}  ${String(p.indexDistance).padStart(2)} bits  ${p.label.padEnd(4)}  ${(p.note ?? '').slice(0, 70)}`);
  }

  if (!process.argv.includes('--sample')) return;

  // New pairs to label: seeded, PER_BAND per dHash band, inside one work, never a pair already labelled.
  const seen = new Set(labelledPairs().flatMap((p) => [`${p.a}|${p.b}`, `${p.b}|${p.a}`]));
  const byWork = new Map<number, Array<[string, string]>>();
  for (const [w, id, hash] of index.covers) byWork.set(w, [...(byWork.get(w) ?? []), [id, hash]]);
  const inBand: Array<Array<{ a: string; b: string; bits: number; work: number }>> = BANDS.map(() => []);
  for (const [w, covers] of byWork) {
    for (let i = 0; i < covers.length; i++) {
      for (let j = i + 1; j < covers.length; j++) {
        const bits = hamming(covers[i][1], covers[j][1]);
        const band = BANDS.findIndex(([lo, hi]) => bits >= lo && bits <= hi);
        if (band >= 0 && !seen.has(`${covers[i][0]}|${covers[j][0]}`)) inBand[band].push({ a: covers[i][0], b: covers[j][0], bits, work: w });
      }
    }
  }
  const random = rng(9);
  const sample = inBand.flatMap((pairs) => {
    const picked: typeof pairs = [];
    const works = new Set<number>();
    while (picked.length < PER_BAND && pairs.length > 0) {
      const [p] = pairs.splice(Math.floor(random() * pairs.length), 1);
      if (works.has(p.work)) continue; // one pair per work and band, so no single book dominates
      works.add(p.work);
      picked.push(p);
    }
    return picked;
  });
  const sv = await embedCovers([...new Set(sample.flatMap((p) => [p.a, p.b]))]);
  const out = sample
    .filter((p) => sv.get(p.a) && sv.get(p.b))
    .map((p) => ({
      a: p.a,
      b: p.b,
      indexDistance: p.bits,
      clip: Number(cosine(sv.get(p.a)!, sv.get(p.b)!).toFixed(3)),
      title: index.works[p.work][1],
    }));
  writeFileSync(join(OUT, 'fold-sample.json'), JSON.stringify(out, null, 1));
  console.log(`\n${out.length} new pairs written to ${join(OUT, 'fold-sample.json')} — python3 lab/clip/sheet.py fold`);
}

main();
