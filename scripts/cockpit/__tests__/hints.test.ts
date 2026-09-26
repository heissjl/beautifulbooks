import { describe, expect, it } from 'vitest';
import { deriveHints, type HintInput } from '../hints';

const item = (num: string, extra: Partial<HintInput['items'][number]> = {}): HintInput['items'][number] =>
  ({ num, title: num, done: false, assessment: { verdict: 'tun', verdictRaw: 'tun', effort: '', why: '' }, waitsOn: [], workBranches: [], roadmapOnlyBranches: [], ...extra });

function input(over: Partial<HintInput>): HintInput {
  return { items: [], features: { stand: null, latest: null }, lab: { table: [], folders: [] }, portConflicts: [], branches: [], sync: [], envChecks: [], history: [], ...over };
}

describe('deriveHints', () => {
  it('finds the contradictions the mock listed', () => {
    const hints = deriveHints(input({
      items: [
        item('6.23', { assessment: { verdict: 'zurückstellen', verdictRaw: 'zurückstellen', effort: '', why: 'nach 6.6' }, workBranches: ['claude/jev'] }),
        item('6.53', { roadmapOnlyBranches: ['claude/x'] }),
        item('6.4', { assessment: { verdict: 'zurückstellen', verdictRaw: 'zurückstellen', effort: '', why: 'Wartet auf 6.36' } }),
        item('6.36', { done: true }),
        item('6.6'),
        item('6.54', { assessment: null }),
      ],
      features: { stand: '2026-09-10', latest: '2026-09-25' },
      lab: { table: [{ folder: 'wear', question: '', roadmap: [], status: 'idea' }], folders: [{ name: 'isfdb', hasReadme: false }] },
      portConflicts: [{ port: 4322, tools: ['a', 'b'] }],
      branches: [{ name: 'claude/firewall-2.4', ahead: 0, behind: 3, worktree: null }, { name: 'main', ahead: 4, behind: 35, worktree: '/m' }],
    }));
    const titles = hints.map(h => h.title);
    expect(titles).toEqual(expect.arrayContaining([
      'Bewertung widerspricht Branch', 'Nur ein Roadmap-Eintrag', 'Auslöser eingetreten?', 'Ohne Bewertung',
      'Stand-Zeile veraltet', 'Lab-Ordner ohne README', 'Lab-Ordner nicht gelistet', 'Gelistet, aber nicht da',
      'Port doppelt', 'Branches ohne Vorsprung', 'Lokales main ≠ Produktion',
    ]));
    expect(hints.find(h => h.title === 'Auslöser eingetreten?')!.item).toBe('6.4');
    expect(hints.find(h => h.title === 'Ohne Bewertung')!.text).toContain('6.54');
  });

  it('puts a collection that needs action first, as one hint per address', () => {
    const hints = deriveHints(input({
      items: [item('6.5', { assessment: null })],
      sync: [{
        slug: 'tiptree-award', title: 'T', production: null, local: null, drafts: [], content: null, switchValue: null, live: null, lists: [],
        verdicts: [{ level: 'act', text: 'Online-Entwurf hat 10 Coveränderungen.' }, { level: 'info', text: 'x' }],
      }],
    }));
    expect(hints[0]).toMatchObject({ level: 'act', title: 'Sammlung /tiptree-award', text: 'Online-Entwurf hat 10 Coveränderungen.', view: 'sync' });
  });
});
