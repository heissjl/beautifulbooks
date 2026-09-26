/**
 * The other documents the Cockpit reads (ROADMAP 6.54): history headings,
 * the features tables, the plans index, the lab table. Pure — text in,
 * values out — so the tests run on small fixtures.
 */

export interface HistoryEntry { date: string; title: string; items: string[]; line: number }

/** `## 2026-09-25 · Title (ROADMAP 5.10c–f, 6.52)` → date, title, item numbers. */
export function parseHistory(text: string): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  text.split('\n').forEach((line, i) => {
    const m = /^## (\d{4}-\d{2}-\d{2}) · (.+)$/.exec(line);
    if (!m) return;
    const ref = /\(ROADMAP ([^)]+)\)\s*$/.exec(m[2]);
    const title = ref ? m[2].slice(0, ref.index).trim() : m[2].trim();
    out.push({ date: m[1], title, items: ref ? expandRefs(ref[1]) : [], line: i + 1 });
  });
  return out;
}

/** "5.10c–f, 6.52" → 5.10c, 5.10d, 5.10e, 5.10f, 6.52. */
export function expandRefs(refs: string): string[] {
  const out: string[] = [];
  for (const part of refs.split(/,\s*/)) {
    const range = /^(\d+\.\d+)([a-z])[–-]([a-z])$/.exec(part.trim());
    if (range) {
      for (let c = range[2].charCodeAt(0); c <= range[3].charCodeAt(0); c++) out.push(range[1] + String.fromCharCode(c));
      continue;
    }
    for (const m of part.matchAll(/(\d+\.\d+[a-z]?)/g)) out.push(m[1]);
  }
  return [...new Set(out)];
}

export interface FeatureRow { feature: string; since: string; spec: string; roadmap: string; code: string[] }
export interface FeatureSection { title: string; rows: FeatureRow[] }

export function parseFeatures(text: string): { stand: string | null; sections: FeatureSection[] } {
  const sections: FeatureSection[] = [];
  let cur: FeatureSection | null = null;
  const stand = /Stand:\s*(\d{4}-\d{2}-\d{2})/.exec(text)?.[1] ?? null;
  for (const line of text.split('\n')) {
    const h = /^## (.+)$/.exec(line);
    if (h) { cur = { title: h[1].trim(), rows: [] }; sections.push(cur); continue; }
    if (!cur || !line.startsWith('|') || /^\|\s*:?-{2,}/.test(line)) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (cells[0] === 'Funktion' || cells.length < 5) continue;
    cur.rows.push({
      feature: cells[0], since: cells[1], spec: cells[2], roadmap: cells[3],
      code: [...cells[4].matchAll(/`([^`]+)`/g)].map(m => m[1]),
    });
  }
  return { stand, sections: sections.filter(s => s.rows.length) };
}

/** The latest date a features row names in its "seit" cell ("2026-09-06 / 09-11" counts as 09-11). */
export function latestFeatureDate(sections: FeatureSection[]): string | null {
  let best: string | null = null;
  for (const s of sections) for (const r of s.rows) {
    const full = [...r.since.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)];
    if (!full.length) continue;
    const year = full[0][1];
    const dates = full.map(m => m[0]);
    for (const m of r.since.matchAll(/(?<!\d{4}-)\b(\d{2})-(\d{2})\b/g)) dates.push(`${year}-${m[1]}-${m[2]}`);
    for (const d of dates) if (!best || d > best) best = d;
  }
  return best;
}

export interface PlanRow { file: string; roadmap: string; state: string; open: boolean }

export function parsePlansIndex(text: string): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const line of text.split('\n')) {
    const m = /^\|\s*\[([^\]]+)\]\([^)]+\)\s*\|\s*([^|]*)\|\s*([^|]*)\|/.exec(line);
    if (!m) continue;
    const state = m[3].trim();
    rows.push({ file: m[1], roadmap: m[2].trim(), state, open: !/\*\*(erledigt|entschieden)\*\*/i.test(state) && !/^\*\*online/i.test(state) });
  }
  return rows;
}

export interface LabRow { folder: string; question: string; roadmap: string[]; status: string }

/** The experiments table of lab/README.md. */
export function parseLabTable(text: string): LabRow[] {
  const rows: LabRow[] = [];
  for (const line of text.split('\n')) {
    const m = /^\|\s*`([\w-]+)\/`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    rows.push({ folder: m[1], question: m[2], roadmap: [...m[3].matchAll(/(\d+\.\d+[a-z]?)/g)].map(x => x[1]), status: m[4] });
  }
  return rows;
}

/** The question an experiment's README states: the first paragraph after the heading. */
export function readmeGist(text: string): string {
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p && !p.startsWith('#'));
  return (paras[0] ?? '').replace(/\s+/g, ' ');
}
