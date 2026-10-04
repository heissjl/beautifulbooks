import { describe, expect, it } from 'vitest';
import { markSketches, parseDecisions, parseTokens } from '../identity';

describe('parseDecisions', () => {
  const doc = `# Title

## 0. Entscheidungen

| Datum | Thema | Entscheidung | Verworfen / vorher | Roadmap |
|---|---|---|---|---|
| 2026-09-28 | Schrift | Xanh Mono | Courier Prime | 6.61 |
| 2026-09-29 | Bildmarke | Richtung A | B, C, D | 6.61, 6.62 |

## 1. Schrift

| 2026-01-01 | not | in | the | table |
`;
  it('reads the rows of §0 only', () => {
    const rows = parseDecisions(doc);
    expect(rows.map(r => r.decision)).toEqual(['Xanh Mono', 'Richtung A']);
    expect(rows[1].items).toEqual(['6.61', '6.62']);
    expect(rows[0].rejected).toBe('Courier Prime');
  });
  it('is empty without the section', () => {
    expect(parseDecisions('# nothing')).toEqual([]);
  });
});

describe('parseTokens', () => {
  it('pairs the light and the dark value of each colour', () => {
    const css = `:root {\n  --bg: #f4f0e8;\n  --accent: #945138;\n  --shadow-color: 20 16 12;\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n    --bg: #131110;\n  }\n}\n@theme inline {\n  --color-bg: var(--bg);\n}`;
    expect(parseTokens(css)).toEqual([
      { name: 'bg', light: '#f4f0e8', dark: '#131110' },
      { name: 'accent', light: '#945138', dark: null },
    ]);
  });
});

describe('markSketches', () => {
  it('marks exactly one direction as chosen', () => {
    const s = markSketches();
    expect(s.filter(k => k.chosen).map(k => k.id)).toEqual(['AC3']);
    expect(s.every(k => k.svg.startsWith('<svg'))).toBe(true);
  });
});
