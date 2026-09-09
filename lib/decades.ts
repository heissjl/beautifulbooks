/**
 * A book by decade: the same covers as the wall, grouped by the year of the
 * printing they belong to (ROADMAP 5.4a, PLAN-5 §3).
 *
 * The first of the generated page genres, and it was chosen first because it
 * needs **no model and no Google request**: every number below is counted
 * from edition records we already hold. What a sentence here says, a script
 * can prove — which is rule R1 of PLAN-5 §2 (numbers never come from a
 * model) taken to its conclusion: here nothing comes from a model at all.
 *
 * Pure, no I/O.
 */
import type { Cover, Edition } from './model';

/** Below this a page has nothing to show that the wall does not (R6). */
export const MIN_COVERS = 20;
export const MIN_DECADES = 4;

export interface DecadeGroup {
  /** 1970 for the 1970s. */
  decade: number;
  covers: Cover[];
  /** Distinct publishers seen on the editions behind these covers, most first. */
  publishers: string[];
  /** How many of the editions behind them say paperback, hardcover, and so on. */
  formats: Partial<Record<NonNullable<Edition['format']>, number>>;
  /** Distinct languages, for the line under the row. */
  languages: string[];
  editionCount: number;
}

export interface Decades {
  groups: DecadeGroup[];
  /** Covers whose editions carry no year at all; shown last, never hidden. */
  undated: Cover[];
  coverCount: number;
  /** First and last decade with a cover, for the page's own sentence. */
  from?: number;
  to?: number;
}

/** The year of a cover: the earliest year among the editions carrying it. */
function yearOf(cover: Cover, byId: Map<string, Edition>): number | undefined {
  let best: number | undefined;
  for (const id of cover.editionIds) {
    const y = byId.get(id)?.year;
    if (y && (best === undefined || y < best)) best = y;
  }
  return best;
}

function countBy<T extends string>(values: Array<T | undefined>): Partial<Record<T, number>> {
  const out: Partial<Record<T, number>> = {};
  for (const v of values) if (v) out[v] = (out[v] ?? 0) + 1;
  return out;
}

/**
 * Groups a work's covers into decades.
 *
 * A cover sits in the decade of the **earliest** edition that carries it,
 * because a design belongs to the year it appeared, not to the year of its
 * latest reprint — and after folding (SPEC §2.3) one cover often carries
 * printings decades apart.
 */
export function groupByDecade(covers: readonly Cover[], editions: readonly Edition[]): Decades {
  const byId = new Map(editions.map(e => [e.id, e]));
  const buckets = new Map<number, Cover[]>();
  const undated: Cover[] = [];

  for (const cover of covers) {
    const year = yearOf(cover, byId);
    if (!year) { undated.push(cover); continue; }
    const decade = Math.floor(year / 10) * 10;
    const list = buckets.get(decade);
    if (list) list.push(cover);
    else buckets.set(decade, [cover]);
  }

  const groups: DecadeGroup[] = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, list]) => {
      const eds = list.flatMap(c => c.editionIds.map(id => byId.get(id)).filter((e): e is Edition => !!e));
      const publishers = Object.entries(countBy(eds.map(e => e.publisher)))
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        .map(([name]) => name);
      return {
        decade,
        covers: list,
        publishers,
        formats: countBy(eds.map(e => e.format)),
        languages: [...new Set(eds.map(e => e.language).filter((l): l is string => !!l))],
        editionCount: eds.length,
      };
    });

  return {
    groups,
    undated,
    coverCount: covers.length,
    from: groups[0]?.decade,
    to: groups[groups.length - 1]?.decade,
  };
}

/** Whether the data carries a page at all (R6: thin data makes no page). */
export function worthAPage(d: Decades): boolean {
  return d.coverCount >= MIN_COVERS && d.groups.length >= MIN_DECADES;
}

/**
 * The line under a decade's row.
 *
 * Every clause is counted, never characterised: "six of eight are
 * paperbacks" is allowed, "the paperback era" is not (R4, no adjective
 * without a number behind it). When a decade has nothing to say beyond how
 * many covers it holds, the line says only that — a sentence that adds
 * nothing is dropped rather than padded (R3).
 */
export function decadeLine(g: DecadeGroup): string {
  const n = g.covers.length;
  const parts: string[] = [`${n} cover${n === 1 ? '' : 's'}`];

  const formats = Object.entries(g.formats).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  const [topFormat, topCount] = formats[0] ?? [];
  if (topFormat && topCount && topCount >= 2 && g.editionCount >= 2) {
    parts.push(`${topCount} of ${g.editionCount} printings say ${topFormat}`);
  }

  if (g.publishers.length === 1) {
    // Not "all from Signet": the records we hold are not the decade (R7).
    parts.push(`1 publisher, ${g.publishers[0]}`);
  } else if (g.publishers.length > 1) {
    parts.push(`${g.publishers.length} publishers, ${g.publishers.slice(0, 2).join(' and ')} among them`);
  }

  if (g.languages.length > 1) parts.push(`${g.languages.length} languages`);
  return parts.join(' · ');
}
