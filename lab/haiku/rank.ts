/** Pure helpers for the haiku experiment (ROADMAP 6.102): sampling and nearest neighbours by cosine. */

export interface SampleCover {
  coverId: string;
  workId: string;
  title: string;
  author: string;
}

/** Every `stride`-th work, its first cover in the index: one cover per work, so a neighbour is never the same book. */
export function sampleOnePerWork(
  works: ReadonlyArray<readonly [string, string, string]>,
  covers: ReadonlyArray<readonly [number, string, ...unknown[]]>,
  count: number,
): SampleCover[] {
  const first = new Map<number, string>();
  for (const [w, id] of covers) if (!first.has(w)) first.set(w, id);
  const withCover = works.map((w, i) => ({ w, i })).filter(({ i }) => first.has(i));
  const stride = Math.max(1, withCover.length / count);
  const out: SampleCover[] = [];
  for (let k = 0; k < count && Math.floor(k * stride) < withCover.length; k++) {
    const { w, i } = withCover[Math.floor(k * stride)];
    out.push({ coverId: first.get(i)!, workId: w[0], title: w[1], author: w[2] });
  }
  return out;
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** The `k` nearest other entries to `at`, most similar first. */
export function nearest(vectors: readonly (readonly number[])[], at: number, k: number): Array<{ index: number; score: number }> {
  return vectors
    .map((v, index) => ({ index, score: index === at ? -Infinity : cosine(vectors[at], v) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}
