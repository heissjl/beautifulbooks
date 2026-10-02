/**
 * Fold pressings whose fronts are the same design (ROADMAP 5.16a), moved out
 * of `mockup.html` so the server and the tests share one rule.
 *
 * Single linkage on the dHash of the front at distance ≤ 20 — Julian's choice
 * on 2026-09-29 („für das hashing nimm die 20er schwelle"). Measured on the
 * 57 fronts of Kind of Blue, sorted by hand into 8 designs: photos of one
 * sleeve lie at 18 (median), different designs from 21, mostly 27+; at ≤ 20
 * the album shows 9 sleeves, and elsewhere the black UHQR box joins the prism
 * (Dark Side) and two different folklore photos become one. Not the book
 * wall's tiers: sleeves are photographed, not scanned.
 */
import { hamming } from '../../lib/imagesig';
import { byDate, type Pressing } from './pressing';

export const FOLD_AT = 20;

export interface Sleeve { ids: string[] }

type Foldable = Pick<Pressing, 'id' | 'date' | 'front' | 'hash'>;

/**
 * Sleeves from pressings with a front, oldest first, each with its pressings
 * oldest first. A pressing whose front has no hash yet (not loaded, or the
 * image failed) stands alone: it can never fold, and is never dropped.
 */
export function foldSleeves(pressings: Foldable[], at = FOLD_AT): Sleeve[] {
  const groups: Foldable[][] = [];
  for (const p of pressings) {
    if (!p.front) continue;
    const hits = p.hash ? groups.filter(g => g.some(m => !!m.hash && hamming(m.hash, p.hash!) <= at)) : [];
    if (!hits.length) { groups.push([p]); continue; }
    // A pressing that matches two stacks joins them: single linkage, not first match.
    const [first, ...rest] = hits;
    first.push(p);
    for (const g of rest) { first.push(...g); groups.splice(groups.indexOf(g), 1); }
  }
  for (const g of groups) g.sort(byDate);
  groups.sort((a, b) => byDate(a[0], b[0]));
  return groups.map(g => ({ ids: g.map(p => p.id) }));
}
