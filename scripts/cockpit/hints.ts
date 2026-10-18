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
  /** The „Nächste Schritte“ table; a step that names only finished items is stale. */
  nextSteps?: Array<{ what: string }>;
  /** The backup folder (2.11): the newest complete copy and how old it is. */
  backup?: { dir: string; exists: boolean; latest: { name: string } | null; ageDays: number | null; tmp: number; newestIncomplete: boolean };
}

/** A copy older than this many days is a hint to act: the store changes every day readers come. */
export const BACKUP_MAX_AGE_DAYS = 7;

export function deriveHints(input: HintInput): Hint[] {
  const hints: Hint[] = [];
  const byNum = new Map(input.items.map(i => [i.num, i]));

  // The same number twice: two sessions each took „the next free one“ on consecutive days (6.82, 2026-10-01/02).
  const seen = new Map<string, number>();
  for (const i of input.items) seen.set(i.num, (seen.get(i.num) ?? 0) + 1);
  const twice = [...seen].filter(([, n]) => n > 1).map(([num]) => num);
  if (twice.length) {
    hints.push({ level: 'act', title: 'Dieselbe Nummer zweimal', text: `${twice.join(', ')} steht mehrfach in ROADMAP.md. Nummern ändern sich nie — der jüngere Punkt bekommt die nächste freie.`, item: twice[0] });
  }

  // A next step whose numbers are all ticked is a step nobody removed.
  for (const step of input.nextSteps ?? []) {
    const nums = [...new Set([...step.what.matchAll(/(?<![\w.])(\d\.\d{1,2}[a-z]?)(?![\w.])/g)].map(m => m[1]))].filter(n => byNum.has(n));
    if (nums.length && nums.every(n => byNum.get(n)!.done)) {
      hints.push({ level: 'info', title: 'Nächster Schritt ist erledigt', text: `Der Schritt „${step.what.replace(/\*\*/g, '').slice(0, 80)}…“ nennt nur abgehakte Punkte (${nums.join(', ')}).`, item: nums[0] });
    }
  }

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

  // The copy of the store outside the provider (2.11): none, too old, or the last one broke off.
  const b = input.backup;
  if (b) {
    if (!b.latest) {
      hints.push({ level: 'act', title: 'Keine Sicherung', text: `In ${b.dir} liegt keine vollständige Kopie der Redis. npm run backup (mit dem Admin-Passwort aus .env.local) schreibt eine.`, view: 'tools' });
    } else if (b.ageDays !== null && b.ageDays > BACKUP_MAX_AGE_DAYS) {
      hints.push({ level: 'act', title: 'Sicherung ist alt', text: `Die jüngste vollständige Kopie der Redis (${b.latest.name}) ist ${Math.floor(b.ageDays)} Tage alt. npm run backup.`, view: 'tools' });
    }
    if (b.newestIncomplete && b.latest) {
      hints.push({ level: 'info', title: 'Letzte Sicherung brach ab', text: `Die neueste Datei in ${b.dir} hat keinen vollständigen Fuß; gezählt wird die davor (${b.latest.name}).`, view: 'tools' });
    }
    if (b.tmp) {
      hints.push({ level: 'info', title: 'Abgebrochene Sicherungen', text: `${b.tmp} .tmp-Datei${b.tmp === 1 ? '' : 'en'} in ${b.dir}: Exporte, die nicht zu Ende kamen. Ansehen, dann löschen — zurückspielen darf man sie nicht.`, view: 'tools' });
    }
  }

  const cited = new Set(input.history.flatMap(h => h.items));
  const doneWithout = input.items.filter(i => i.done && /^[56]\./.test(i.num) && !cited.has(i.num)).map(i => i.num);
  if (doneWithout.length > 0 && doneWithout.length < 15) {
    hints.push({ level: 'info', title: 'Erledigt ohne Historie', text: `Abgehakt, aber keine Überschrift in docs/history.md nennt sie: ${doneWithout.join(', ')}.`, item: doneWithout[0] });
  }
  return hints;
}
