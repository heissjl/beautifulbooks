import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coverCredit, parsePublications, type IsfdbPublication } from '../parse';

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
