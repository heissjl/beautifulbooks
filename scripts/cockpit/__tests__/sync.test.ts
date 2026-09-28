import { describe, expect, it } from 'vitest';
import type { CollectionPick, CollectionRecord } from '../../../lib/collections';
import type { Draft } from '../../../lib/curate/drafts';
import { compareCollections, describeDiff, diffRecords, documentedRebuilds, listSlug, type SyncInput } from '../sync';

const pick = (n: number, cover = n): CollectionPick => ({ id: `OL${n}W`, title: `Book ${n}`, author: 'A', coverId: `ol:${cover}`, from: `isbn:978${n}` });
const record = (slug: string, works: CollectionPick[], extra: Partial<CollectionRecord> = {}): CollectionRecord =>
  ({ slug, title: slug, kind: 'series', intro: '', published: false, publishers: ['P'], works, ...extra });
const draft = (slug: string, works: CollectionPick[], extra: Partial<Draft> = {}): Draft =>
  ({ ...record(slug, works), id: `d-${slug}`, basedOn: slug, createdOn: '2026-09-25', updatedAt: '2026-09-25T10:00:00.000Z', ...extra });

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => pick(a + i));

function input(over: Partial<SyncInput>): SyncInput {
  return { production: [], local: null, drafts: [], content: {}, switches: {}, lists: [], ...over };
}

describe('diffRecords', () => {
  it('counts added, removed and changed covers, and notices a new order', () => {
    const base = record('s', [pick(1), pick(2), pick(3)]);
    const other = record('s', [pick(3), pick(2, 99), pick(4)]);
    expect(diffRecords(base, other)).toEqual({ added: 1, removed: 1, coverChanged: 1, reordered: true, meta: false });
    expect(describeDiff(diffRecords(base, other))).toBe('1 Coveränderung, 1 Buch neu, 1 Buch entfernt, andere Reihenfolge');
    expect(describeDiff(diffRecords(base, base))).toBe('gleich');
  });
});

describe('compareCollections', () => {
  it('says what an online draft holds that the file does not (the Otherwise Award case: ten covers)', () => {
    const file = record('tiptree-award', range(1, 40));
    const changed = range(1, 40).map((w, i) => (i < 10 ? { ...w, coverId: `ol:${1000 + i}` } : w));
    const [row] = compareCollections(input({ production: [file], local: { label: 'Hauptordner', records: [file] }, drafts: [draft('tiptree-award', changed)] }));
    expect(row.drafts[0].vsFile).toMatchObject({ coverChanged: 10, added: 0, removed: 0 });
    const act = row.verdicts.filter(v => v.level === 'act');
    expect(act).toHaveLength(1);
    expect(act[0].text).toContain('10 Coveränderungen');
    expect(act[0].text).toContain('übernehmen (Sammlungs-App) oder veröffentlichen (/curate)');
  });

  it('counts a shorter draft as books removed (the Suhrkamp case: 197 against 200)', () => {
    const file = record('edition-suhrkamp', range(1, 200));
    const [row] = compareCollections(input({ production: [file], local: { label: 'x', records: [file] }, drafts: [draft('edition-suhrkamp', range(1, 197))] }));
    expect(row.drafts[0].count).toBe(197);
    expect(row.verdicts[0].text).toContain('3 Bücher entfernt');
  });

  it('calls an unread production unknown, never empty, and does not guess what the site shows', () => {
    const file = record('women-writers', range(1, 5));
    const [row] = compareCollections(input({ production: [file], local: { label: 'x', records: [file] }, drafts: null, content: null, switches: null }));
    expect(row.content).toBe('unknown');
    expect(row.switchValue).toBe('unknown');
    expect(row.live).toBeNull();
    expect(row.verdicts.some(v => /leer|keine Entwürfe/.test(v.text))).toBe(false);
  });

  it('says a published draft wins over the file, and when it is only waiting to be cleared', () => {
    const file = record('s', range(1, 3), { published: true });
    const content = { s: record('s', range(1, 4), { published: true }) };
    const [row] = compareCollections(input({ production: [file], local: { label: 'x', records: [file] }, content }));
    expect(row.live).toEqual({ published: true, count: 4, from: 'veröffentlichter Entwurf' });
    expect(row.verdicts.find(v => v.level === 'act')!.text).toContain('Auf der Seite gilt der veröffentlichte Entwurf');

    const [same] = compareCollections(input({ production: [file], local: { label: 'x', records: [file] }, content: { s: file } }));
    expect(same.verdicts.find(v => v.text.includes('kann geräumt werden'))).toBeTruthy();
  });

  it('reports a publish switch that disagrees with the file', () => {
    const file = record('s', range(1, 3), { published: false });
    const [row] = compareCollections(input({ production: [file], local: { label: 'x', records: [file] }, switches: { s: true } }));
    expect(row.live?.published).toBe(true);
    expect(row.verdicts.find(v => v.level === 'act')!.text).toMatch(/Schalter in Produktion: veröffentlicht/);
  });

  it('reports a working file that production does not have yet', () => {
    const prod = record('s', range(1, 3));
    const local = record('s', [...range(1, 3), pick(4)]);
    const rows = compareCollections(input({ production: [prod], local: { label: 'Hauptordner', records: [local, record('neu', range(1, 2))] } }));
    expect(rows.find(r => r.slug === 's')!.verdicts[0].text).toContain('Lokale Datei weicht von Produktion ab (1 Buch neu)');
    expect(rows.find(r => r.slug === 'neu')!.verdicts[0].text).toContain('Nur in der lokalen Datei');
  });

  it('knows a draft taken over and then edited again', () => {
    const file = record('s', range(1, 3));
    const d = draft('s', range(1, 2), { importedOn: '2026-09-24', updatedAt: '2026-09-25T09:00:00.000Z' });
    const [row] = compareCollections(input({ production: [file], local: { label: 'x', records: [file] }, drafts: [d] }));
    expect(row.verdicts[0].text).toContain('nach der Übernahme am 2026-09-24 weiter bearbeitet');
  });

  it('warns what a rebuild from a series list would lose, without asking for action', () => {
    const works = [pick(1), { ...pick(2), from: undefined }, { ...pick(3), coverIsbn: '9783' }];
    const file = record('s', works);
    const lists = [{ file: 'lab/collections/lists/s.json', slug: 's', slugSource: 'gleicher Name', entries: 3, skipped: 1, skippedIsbns: ['9783'] }];
    const [row] = compareCollections(input({ production: [file], local: { label: 'x', records: [file] }, lists }));
    const v = row.verdicts.find(x => x.text.startsWith('Liste'))!;
    expect(v.level).toBe('info');
    expect(v.text).toContain('1 übersprungene ISBNs stehen noch in der Datei');
    expect(v.text).toContain('1 Bücher der Datei tragen eine Auswahl von Hand');
  });
});

describe('series lists', () => {
  it('finds the collection a list feeds: documented call, same name, then prefix', () => {
    const slugs = ['sf-masterworks', 'edition-suhrkamp'];
    const doc = documentedRebuilds('npx tsx lab/collections/from-isbns.ts lab/collections/lists/sf-masterworks-numbered.json sf-masterworks "SF"');
    expect(listSlug('lab/collections/lists/sf-masterworks-numbered.json', slugs, doc)).toEqual({ slug: 'sf-masterworks', source: 'dokumentierter Aufruf' });
    expect(listSlug('lab/collections/lists/edition-suhrkamp.json', slugs, doc).source).toBe('gleicher Name');
    expect(listSlug('lab/collections/lists/edition-suhrkamp-2000.json', slugs, doc).source).toBe('vermutet über den Namen');
    expect(listSlug('lab/collections/lists/other.json', slugs, doc).slug).toBeNull();
  });
});
