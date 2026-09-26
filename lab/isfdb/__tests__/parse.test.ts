import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coverCredit, parsePublications, repairCredit, repairName, type IsfdbPublication } from '../parse';

const xml = readFileSync(join(import.meta.dirname, '..', '__fixtures__', 'getpub-1857988116.xml'), 'utf8');

const pub = (artists: string[], record = '1'): IsfdbPublication => ({
  record, title: 'T', year: '1999', publisher: 'P', series: '', seriesNumber: '', artists, image: '',
});

describe('parsePublications', () => {
  it('reads every printing of Cities in Flight with its series and artist', () => {
    const pubs = parsePublications(xml);
    expect(pubs).toHaveLength(4);
    expect(pubs[0]).toMatchObject({ record: '7127', series: 'Millennium / Gollancz SF Masterworks', seriesNumber: '3', artists: ['John Harris'] });
    expect(pubs[0].image).toMatch(/CTSNLGHT1999\.jpg$/);
  });

  it('decodes entities in names (Eamon O&apos;Donoghue, measured 2026-09-25)', () => {
    const one = parsePublications('<Publication><Record>1</Record><CoverArtists><Artist>Eamon O&apos;Donoghue</Artist></CoverArtists></Publication>');
    expect(one[0].artists).toEqual(["Eamon O'Donoghue"]);
  });

  it('reads nothing from an answer without publications', () => {
    expect(parsePublications('<?xml version="1.0"?><ISFDB><Records>0</Records></ISFDB>')).toEqual([]);
  });
});

describe('coverCredit', () => {
  it('credits the artist when every printing agrees', () => {
    expect(coverCredit(parsePublications(xml))).toEqual({ kind: 'artist', artists: ['John Harris'], record: '7127' });
  });

  it('credits nobody when printings under one ISBN name different artists', () => {
    expect(coverCredit([pub(['Jon Sullivan']), pub(['Vincent Chong'])]).kind).toBe('ambiguous');
  });

  it('does not credit a picture agency', () => {
    expect(coverCredit([pub(['Shutterstock'])])).toEqual({ kind: 'no-artist' });
    expect(coverCredit([pub(['Shutterstock', 'Chris Moore'])])).toMatchObject({ kind: 'artist', artists: ['Chris Moore'] });
  });

  it('tells a known ISBN without artist from an unknown one', () => {
    expect(coverCredit([pub([])])).toEqual({ kind: 'no-artist' });
    expect(coverCredit([])).toEqual({ kind: 'no-record' });
  });
});

describe('repairName (ISFDB sends lost letters as U+FFFD)', () => {
  it('puts a known name right, whether read as UTF-8 or as ISO-8859-1', () => {
    expect(repairName('J\uFFFDrgen F. Rogner')).toBe('Jürgen F. Rogner');
    expect(repairName('J\u00EF\u00BF\u00BDrgen F. Rogner')).toBe('Jürgen F. Rogner');
  });
  it('leaves a clean name alone and refuses an unknown garbled one', () => {
    expect(repairName('Chris Moore')).toBe('Chris Moore');
    expect(repairName('Andr\uFFFD Unknown')).toBeNull();
  });
  it('withholds a credit with a name it cannot repair', () => {
    expect(repairCredit({ kind: 'artist', artists: ['Andr\uFFFD Unknown'], record: '1' }).kind).toBe('garbled');
    expect(repairCredit({ kind: 'artist', artists: ['S\uFFFDbastien Hue'], record: '1' })).toEqual({ kind: 'artist', artists: ['Sébastien Hue'], record: '1' });
  });
});

