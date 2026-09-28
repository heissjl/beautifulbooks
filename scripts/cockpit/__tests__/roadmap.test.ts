import { describe, expect, it } from 'vitest';
import { openWaits, parseRoadmap, statusOf, themeOf } from '../roadmap';

const ROADMAP = `# Roadmap

### Stand

- **Online seit 2026-09-08.**
- Der Engpass ist, dass niemand die Seite kennt.

### Nächste Schritte

| | Was | Wer | Aufwand | Warum jetzt |
|---|---|---|---|---|
| 1 | **2.5 Search Console**, dazu **0.2** | Julian | 45 Minuten | Jeder Tag zählt |

### Bewertung der offenen Punkte (2026-09-12)

| Punkt | Urteil | Aufwand | Warum |
|---|---|---|---|
| 6.4 | zurückstellen | 2 h | Wartet auf 6.36 |
| 6.5 | tun, kleiner | je 1 h | Kleinigkeiten |
| 0.2 | tun | 3 min | Kontingent |

### Abhängigkeiten

\`\`\`mermaid
flowchart LR
  R636["6.36 Faltung"] --> R64["6.4 Jahre"]
  V(["Besucher"]) -.-> R41["4.1 Partner"]
\`\`\`

## Phase 0 — Entscheidungen

- [ ] **0.2 Zweiter Google-Schlüssel.** Einer für Entwicklung, einer für Betrieb.

## Phase 6 — Qualität

### 6.B Daten

- [ ] **6.4 Erstausgaben-Jahre.** Mehr Text über \`lib/works.ts\` und \`data/cover-index.json\`.
- [ ] **6.5 Kleinigkeiten.** Tippfehler. Thema: Suche.
- [x] **6.36 Gleicher Entwurf bei zwei Verlagen.** Erledigt 2026-09-24.

### 6.E Arbeitsweise und Werkzeug

- [ ] **6.54 Ein Projekt-Dashboard.** Mock zuerst.

### Erledigt in Phase 4

- [ ] **4.1 Partnerprogramme.** Wartet auf Besucher.

### Ideen vom 2026-09-12, unbewertet

| Idee | Was sie nutzt | Warum |
|---|---|---|
| **Farbsuche** | die Farbmaße | Cover werden nach Farbe erinnert |
`;

describe('parseRoadmap', () => {
  const r = parseRoadmap(ROADMAP);
  const by = new Map(r.items.map(i => [i.num, i]));

  it('reads every item line with its number, title, state and line', () => {
    expect(r.items.map(i => i.num)).toEqual(['0.2', '6.4', '6.5', '6.36', '6.54', '4.1']);
    expect(by.get('6.36')!.done).toBe(true);
    expect(by.get('6.4')!.title).toBe('Erstausgaben-Jahre');
    expect(ROADMAP.split('\n')[by.get('0.2')!.line - 1]).toContain('**0.2 ');
  });

  it('takes the phase from the number, not from the heading it stands under', () => {
    expect(by.get('4.1')!.phase).toBe('4');
  });

  it('joins the assessment, the dependencies and the files named in backticks', () => {
    expect(by.get('6.5')!.assessment).toMatchObject({ verdict: 'tun', verdictRaw: 'tun, kleiner', effort: 'je 1 h' });
    expect(by.get('6.4')!.waitsOn).toEqual(['6.36']);
    expect(by.get('4.1')!.waitsOn).toEqual(['Besucher']);
    expect(by.get('6.4')!.files).toEqual(['lib/works.ts', 'data/cover-index.json']);
  });

  it('reads next steps, the state bullets and the ideas', () => {
    expect(r.nextSteps[0]).toMatchObject({ rank: '1', who: 'Julian', items: ['2.5', '0.2'] });
    expect(r.stand).toHaveLength(2);
    expect(r.ideas[0].idea).toBe('**Farbsuche**');
  });
});

describe('themeOf', () => {
  const r = parseRoadmap(ROADMAP);
  const by = new Map(r.items.map(i => [i.num, i]));

  it('lets a „Thema:" in the item overrule every rule', () => {
    expect(by.get('6.5')!.theme).toBe('suche');
    expect(by.get('6.5')!.themeSource).toContain('Thema: Suche');
  });

  it('then the title, then the subsection, then the paths, then the phase', () => {
    expect(by.get('6.54')!.theme).toBe('werk');
    expect(themeOf({ num: '6.99', title: 'Etwas', group: '6.D Startseite', body: ['x'], files: [] }).theme).toBe('start');
    expect(themeOf({ num: '6.99', title: 'Etwas', group: null, body: ['x'], files: ['lib/hotornot/store.ts'] }).theme).toBe('spiel');
    expect(themeOf({ num: '4.9', title: 'Etwas', group: null, body: ['x'], files: [] })).toEqual({ theme: 'geld', source: 'Phase 4' });
  });
});

describe('statusOf', () => {
  const base = { done: false, assessment: null, owner: 'Claude' as const, ownerSource: 'Phase 6' };

  it('puts work on a branch above everything the assessment says', () => {
    expect(statusOf({ ...base, assessment: { verdict: 'zurückstellen', verdictRaw: '', effort: '', why: '' } }, ['claude/x'])).toBe('wip');
  });

  it('has no blocked column: a waiting Claude item stays open and carries the label', () => {
    expect(statusOf(base, [], ['6.6'])).toBe('open');
  });

  it('does not tell Julian that phase 4 is his to do while it waits on visitors', () => {
    expect(statusOf({ ...base, owner: 'Julian', ownerSource: 'Phase 4' }, [], ['Besucher'])).toBe('deferred');
    expect(statusOf({ ...base, owner: 'Julian', ownerSource: '„Julian entscheidet“' }, [], ['Besucher'])).toBe('julian');
  });

  it('keeps only the waits that still hold', () => {
    const done = new Map([['6.36', { done: true }]]);
    expect(openWaits({ waitsOn: ['6.36', 'Besucher'] }, done)).toEqual(['Besucher']);
  });
});
