import { describe, expect, it } from 'vitest';
import { expandRefs, latestFeatureDate, parseFeatures, parseHistory, parseLabTable, parsePlansIndex } from '../docs';
import { isRoadmapOnly, itemsInSubject, parseLog, parseWorktrees, workByItem } from '../git';

describe('git log parsing', () => {
  const out = '\x1eaaa1111\t2026-09-25\t6.53: roadmap line for other works\nROADMAP.md\n\x1ebbb2222\t2026-09-25\t5.10b, 6.52: drafts viewable\nlib/curate/drafts.ts\nROADMAP.md\n';

  it('reads hash, date, subject and files per commit', () => {
    const commits = parseLog(out);
    expect(commits).toHaveLength(2);
    expect(commits[1]).toMatchObject({ hash: 'bbb2222', date: '2026-09-25', files: ['lib/curate/drafts.ts', 'ROADMAP.md'] });
  });

  it('reads the item numbers a subject starts with', () => {
    expect(itemsInSubject('5.10b, 6.52: drafts viewable')).toEqual(['5.10b', '6.52']);
    expect(itemsInSubject('Merge branch main')).toEqual([]);
    expect(itemsInSubject('fix 6.5 later: no')).toEqual([]);
  });

  it('does not count a commit that only changes ROADMAP.md as work on the item', () => {
    const [roadmapOnly, real] = parseLog(out);
    expect(isRoadmapOnly(roadmapOnly)).toBe(true);
    expect(isRoadmapOnly(real)).toBe(false);
    const work = workByItem([{ name: 'claude/x', commits: parseLog(out) }]);
    expect(work.get('6.53')![0].commits).toHaveLength(0);
    expect(work.get('6.53')![0].roadmapOnly).toHaveLength(1);
    expect(work.get('6.52')![0].commits).toHaveLength(1);
  });

  it('reads worktrees with and without a branch', () => {
    const list = parseWorktrees('worktree /a\nHEAD 1\nbranch refs/heads/main\n\nworktree /b\nHEAD 2\ndetached\n');
    expect(list).toEqual([{ path: '/a', branch: 'main' }, { path: '/b', branch: null }]);
  });
});

describe('docs', () => {
  it('reads history headings with their items, ranges expanded', () => {
    const h = parseHistory('x\n## 2026-09-25 · Neue Entwürfe geprüft (ROADMAP 5.10c–f, 6.52)\ntext\n## 2026-09-24 · Ohne Punkt\n');
    expect(h[0]).toMatchObject({ date: '2026-09-25', title: 'Neue Entwürfe geprüft', line: 2 });
    expect(h[0].items).toEqual(['5.10c', '5.10d', '5.10e', '5.10f', '6.52']);
    expect(h[1].items).toEqual([]);
    expect(expandRefs('6.28, 1.11a')).toEqual(['6.28', '1.11a']);
  });

  it('reads the features tables and finds a stale Stand line', () => {
    const f = parseFeatures('# Was\n\nStand: 2026-09-10.\n\n## Suche\n\n| Funktion | seit | Spec | Roadmap | Code |\n|---|---|---|---|---|\n| Suche | 2026-09-06 / 09-25 | F1 | 6.5 | `lib/search.ts`, `x.ts` |\n');
    expect(f.stand).toBe('2026-09-10');
    expect(f.sections[0].rows[0].code).toEqual(['lib/search.ts', 'x.ts']);
    expect(latestFeatureDate(f.sections)).toBe('2026-09-25');
  });

  it('reads the lab table and the plans index', () => {
    const lab = parseLabTable('| Folder | Question | Roadmap | Status |\n|---|---|---|---|\n| `isfdb/` | Wer? | 6.50, 6.52 | measured |\n');
    expect(lab).toEqual([{ folder: 'isfdb', question: 'Wer?', roadmap: ['6.50', '6.52'], status: 'measured' }]);
    const plans = parsePlansIndex('| [PLAN-A.md](PLAN-A.md) | alt | **erledigt** 2026-09-07 |\n| [PLAN-5.md](PLAN-5.md) | Phase 5 | offen |\n');
    expect(plans.map(p => p.open)).toEqual([false, true]);
  });
});
