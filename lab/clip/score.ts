/**
 * Pure arithmetic over CLIP vectors: similarity, zero-shot classification and
 * the separation measures the two questions of this experiment are read by.
 * No model, no network — tested in __tests__/score.test.ts.
 */

export type Vector = Float32Array | readonly number[];

export function cosine(a: Vector, b: Vector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/**
 * Zero-shot: the probability mass an image puts on the "not a cover" prompts,
 * a softmax over the cosine to every prompt at CLIP's own logit scale (100).
 * Several prompts per side, because one wording is a guess and CLIP is
 * sensitive to wording; each prompt competes on its own.
 */
export function notCoverProbability(
  image: Vector,
  coverPrompts: readonly Vector[],
  otherPrompts: readonly Vector[],
  scale = 100,
): number {
  const logits = [...coverPrompts, ...otherPrompts].map((t) => scale * cosine(image, t));
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const total = exps.reduce((s, e) => s + e, 0);
  const other = exps.slice(coverPrompts.length).reduce((s, e) => s + e, 0);
  return other / total;
}

/** Which "not a cover" prompt an image leans to most — the reason to show beside a score. */
export function strongestPrompt(image: Vector, prompts: readonly Vector[]): number {
  let best = 0;
  for (let i = 1; i < prompts.length; i++) if (cosine(image, prompts[i]) > cosine(image, prompts[best])) best = i;
  return best;
}

/**
 * Area under the ROC curve: the chance that a random positive scores above a
 * random negative. 0.5 is a coin, 1 separates perfectly. Ties count half.
 */
export function auc(positives: readonly number[], negatives: readonly number[]): number {
  if (positives.length === 0 || negatives.length === 0) return NaN;
  let wins = 0;
  for (const p of positives) for (const n of negatives) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (positives.length * negatives.length);
}

/**
 * The price of catching a share of the positives: the threshold that keeps
 * `recall` of them at or above it, and how many negatives stand there too.
 */
export function atRecall(
  positives: readonly number[],
  negatives: readonly number[],
  recall: number,
): { threshold: number; caught: number; falseAlarms: number } {
  const sorted = [...positives].sort((a, b) => b - a);
  const caught = Math.max(1, Math.ceil(recall * sorted.length));
  const threshold = sorted[caught - 1];
  return { threshold, caught, falseAlarms: negatives.filter((n) => n >= threshold).length };
}

/**
 * For a similarity where higher means "same": the least similar pair labelled
 * same, the most similar pair labelled different, and how many pairs sit in
 * the overlap between them. `separates` holds when a threshold exists at all.
 */
export function separation(same: readonly number[], diff: readonly number[]) {
  const worstSame = Math.min(...same);
  const bestDiff = Math.max(...diff);
  const overlap = same.filter((s) => s <= bestDiff).length + diff.filter((d) => d >= worstSame).length;
  return { worstSame, bestDiff, separates: worstSame > bestDiff, overlap };
}

export function toBase64(v: Float32Array): string {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');
}

export function fromBase64(s: string): Float32Array {
  const bytes = Buffer.from(s, 'base64');
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}
