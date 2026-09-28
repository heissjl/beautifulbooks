/**
 * Hints: contradictions between the sources, found by checks, not opinions
 * (ROADMAP 6.54). Shown only — Julian's answer 7 (2026-09-25): no commit is
 * stopped by them. Pure.
 */
import type { HistoryEntry, LabRow } from './docs';
import type { Item } from './roadmap';
import type { SlugSync } from './sync';

export interface Hint {
  level: 'act' | 'info';
  title: string;
  text: string;
  /** Opens the item's card. */
  item?: string;
  /** Opens a view: 'sync', 'lab', 'tools', 'services'. */
  view?: string;
}

export interface HintInput {
  items: Array<Pick<Item, 'num' | 'title' | 'done' | 'assessment' | 'waitsOn'> & { workBranches: string[]; roadmapOnlyBranches: string[] }>;
  features: { stand: string | null; latest: string | null };
  lab: { table: LabRow[]; folders: Array<{ name: string; hasReadme: boolean }> };
  portConflicts: Array<{ port: number; tools: string[] }>;
  branches: Array<{ name: string; ahead: number; behind: number; worktree: string | null }>;
  sync: SlugSync[];
  envChecks: Array<{ level: string; text: string }>;
  history: HistoryEntry[];
}

export function deriveHints(input: HintInput): Hint[] {
  const hints: Hint[] = [];
  const byNum = new Map(input.items.map(i => [i.num, i]));

  // Collections first: they are the layer that loses work when nobody looks.
  for (const row of input.sync) {
    const act = row.verdicts.filter(v => v.level === 'act');
    if (!act.length) continue;
    hints.push({ level: 'act', title: `Sammlung /${row.slug}`, text: act.map(v => v.text).join(' '), view: 'sync' });
  }

  for (const i of input.items) {
    if (i.done) continue;
    if (i.assessment?.verdict === 'zurückstellen' && i.workBranches.length) {
      hints.push({ level: 'info', title: 'Bewertung widerspricht Branch', text: `${i.num} steht in der Bewertung auf „zurückstellen“, auf ${i.workBranches.join(', ')} laufen Commits dazu.`, item: i.num });
    }
    if (!i.workBranches.length && i.roadmapOnlyBranches.length) {
      hints.push({ level: 'info', title: 'Nur ein Roadmap-Eintrag', text: `${i.num} steht auf ${i.roadmapOnlyBranches.join(', ')} nur in einem Commit, der ROADMAP.md ändert — das zählt nicht als Arbeit.`, item: i.num });
    }
    // A trigger that has come: every item the assessment or the graph waits on is done.
    if (i.assessment?.verdict === 'zurückstellen') {
      const fromWhy = [...i.assessment.why.matchAll(/(?<![\w.])(\d\.\d{1,2}[a-z]?)(?![\w.])/g)].map(m => m[1]);
      const named = [...new Set([...fromWhy, ...i.waitsOn])]
        .filter(n => n !== i.num && byNum.has(n));
      if (named.length && named.every(n => byNum.get(n)!.done)) {
        hints.push({ level: 'info', title: 'Auslöser eingetreten?', text: `${i.num} ist zurückgestellt und nennt ${named.join(', ')} — ${named.length === 1 ? 'das ist' : 'die sind'} erledigt. Bewertung erneuern?`, item: i.num });
      }
    }
  }

  const unrated = input.items.filter(i => !i.done && !i.assessment).map(i => i.num);
  if (unrated.length) {
    hints.push({ level: 'info', title: 'Ohne Bewertung', text: `${unrated.length} offene Punkte haben keine Zeile in der Bewertungstabelle: ${unrated.join(', ')}.`, item: unrated[0] });
  }

  const { stand, latest } = input.features;
  if (stand && latest && latest > stand) {
    hints.push({ level: 'info', title: 'Stand-Zeile veraltet', text: `docs/features.md sagt „Stand: ${stand}“, die jüngste Zeile ist vom ${latest}.` });
  }

  const folders = new Set(input.lab.folders.map(f => f.name));
  for (const f of input.lab.folders) {
    if (!f.hasReadme) hints.push({ level: 'info', title: 'Lab-Ordner ohne README', text: `lab/${f.name} hat kein README.md (lab-Regel 1).`, view: 'lab' });
    if (!input.lab.table.some(r => r.folder === f.name)) hints.push({ level: 'info', title: 'Lab-Ordner nicht gelistet', text: `lab/${f.name} fehlt in der Tabelle von lab/README.md.`, view: 'lab' });
  }
  for (const r of input.lab.table) {
    if (!folders.has(r.folder) && !/not created|nicht angelegt|not started/i.test(r.status)) {
      hints.push({ level: 'info', title: 'Gelistet, aber nicht da', text: `lab/README.md nennt lab/${r.folder}/, den Ordner gibt es nicht.`, view: 'lab' });
    }
  }

  for (const c of input.portConflicts) {
    hints.push({ level: 'act', title: 'Port doppelt', text: `${c.tools.join(' und ')} starten beide auf :${c.port} — „läuft?“ ist dort nicht eindeutig.`, view: 'tools' });
  }

  const idle = input.branches.filter(b => b.name !== 'main' && b.ahead === 0 && !b.worktree).map(b => b.name);
  if (idle.length) {
    hints.push({ level: 'info', title: 'Branches ohne Vorsprung', text: `${idle.length} Branch${idle.length === 1 ? '' : 'es'} ohne Commit vor Produktion und ohne Worktree (zusammengeführt oder verwaist): ${idle.slice(0, 6).join(', ')}${idle.length > 6 ? ' …' : ''}. Löschen ist gefahrlos (git branch -d).` });
  }
  const main = input.branches.find(b => b.name === 'main');
  if (main && (main.ahead || main.behind)) {
    hints.push({ level: 'act', title: 'Lokales main ≠ Produktion', text: `main steht +${main.ahead} / −${main.behind} gegen origin/main. Vor einem Merge: npm run worktrees -- --fetch.` });
  }

  for (const c of input.envChecks) if (c.level === 'act') hints.push({ level: 'act', title: 'Einstellung', text: c.text, view: 'services' });

  const cited = new Set(input.history.flatMap(h => h.items));
  const doneWithout = input.items.filter(i => i.done && /^[56]\./.test(i.num) && !cited.has(i.num)).map(i => i.num);
  if (doneWithout.length > 0 && doneWithout.length < 15) {
    hints.push({ level: 'info', title: 'Erledigt ohne Historie', text: `Abgehakt, aber keine Überschrift in docs/history.md nennt sie: ${doneWithout.join(', ')}.`, item: doneWithout[0] });
  }
  return hints;
}
