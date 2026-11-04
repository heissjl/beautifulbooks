import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyEdit, kindOf, parseQueue, pictureFile, pictureUrl, problems, serializeQueue, withKinds, type PinQueue, type QueuedPin } from '../pins';

const pin = (over: Partial<QueuedPin> = {}): QueuedPin => ({
  id: 'decades-OL49488W',
  board: 'Covers through the decades',
  picture: 'https://buyitscovers.com/book/OL49488W/pin.jpg',
  title: "Ender's Game by Orson Scott Card – book covers by decade, 1980s to 2020s",
  description: '49 book covers of Ender’s Game, one group per decade.',
  link: 'https://buyitscovers.com/book/OL49488W/decades?via=pinterest',
  status: 'entwurf',
  ...over,
});
const queue = (...pins: QueuedPin[]): PinQueue => ({ updated: '2026-10-31', pins });

describe('problems', () => {
  it('passes a pin that keeps the rules', () => {
    expect(problems(pin())).toEqual([]);
  });
  it('counts Pinterest’s limits', () => {
    expect(problems(pin({ title: 'x'.repeat(101) })).map(p => p.field)).toEqual(['title']);
    expect(problems(pin({ description: 'x'.repeat(501) })).map(p => p.field)).toEqual(['description']);
  });
  it('refuses a word that claims completeness, in either field', () => {
    expect(problems(pin({ title: 'Every cover of Dune' }))[0].message).toContain('Every');
    expect(problems(pin({ description: 'All the editions.' }))[0].field).toBe('description');
    expect(problems(pin({ description: 'A smaller wall of covers.' }))).toEqual([]);
  });
  it('wants the link marked for the analytics and the picture from the pin route', () => {
    expect(problems(pin({ link: 'https://buyitscovers.com/book/OL49488W/decades' }))[0].field).toBe('link');
    expect(problems(pin({ link: 'https://example.com/?via=pinterest' }))[0].field).toBe('link');
    expect(problems(pin({ picture: 'https://buyitscovers.com/book/OL49488W/opengraph-image' }))[0].field).toBe('picture');
  });
  it('accepts the comparison picture and one cover from the image route, and checks the alt text (the cover pins, 2026-11-04)', () => {
    expect(problems(pin({ picture: 'https://buyitscovers.com/book/OL49488W/compare.jpg?covers=ol:1,ol:2,ol:3' }))).toEqual([]);
    expect(problems(pin({ picture: 'https://buyitscovers.com/img/L/ol-15244952', alt: 'Book cover: Dune, Chilton edition, 1965.' }))).toEqual([]);
    expect(problems(pin({ picture: 'https://buyitscovers.com/img/M/ol-15244952' }))[0].field).toBe('picture');
    expect(problems(pin({ picture: 'https://covers.openlibrary.org/b/id/15244952.jpg' }))).toEqual([]);
    expect(problems(pin({ picture: 'https://covers.openlibrary.org/b/id/15244952-L.jpg' }))[0].field).toBe('picture');
    expect(problems(pin({ alt: 'x'.repeat(501) })).map(p => p.field)).toEqual(['alt']);
    expect(problems(pin({ alt: 'Every cover.' }))[0].field).toBe('alt');
  });
});

describe('applyEdit', () => {
  it('edits text, keeps it on one line and dates a decision', () => {
    const r = applyEdit(queue(pin()), { id: 'decades-OL49488W', title: '  A  new\ntitle ', status: 'ja' }, '2026-11-01');
    expect('queue' in r && r.queue.pins[0]).toMatchObject({ title: 'A new title', status: 'ja', decided: '2026-11-01' });
    expect('queue' in r && r.queue.updated).toBe('2026-11-01');
  });
  it('keeps the date when only the text changes', () => {
    const r = applyEdit(queue(pin({ status: 'nein', decided: '2026-10-31' })), { id: 'decades-OL49488W', remark: 'zu dunkel' }, '2026-11-01');
    expect('queue' in r && r.queue.pins[0]).toMatchObject({ status: 'nein', decided: '2026-10-31', remark: 'zu dunkel' });
  });
  it('drops an emptied remark', () => {
    const r = applyEdit(queue(pin({ remark: 'alt' })), { id: 'decades-OL49488W', remark: '  ' }, '2026-11-01');
    expect('queue' in r && 'remark' in r.queue.pins[0]).toBe(false);
  });
  it('says no to yes while a rule is broken', () => {
    const r = applyEdit(queue(pin()), { id: 'decades-OL49488W', description: 'Every edition.', status: 'ja' }, '2026-11-01');
    expect(r).toEqual({ error: expect.stringContaining('Every') });
  });
  it('leaves a booked pin alone and sets only Julian’s three states', () => {
    expect(applyEdit(queue(pin({ status: 'geplant' })), { id: 'decades-OL49488W', title: 'x' }, '2026-11-01')).toEqual({ error: expect.stringContaining('geplant') });
    expect(applyEdit(queue(pin()), { id: 'decades-OL49488W', status: 'geplant' }, '2026-11-01')).toEqual({ error: 'nur entwurf, ja oder nein' });
    expect(applyEdit(queue(pin()), { id: 'nope' }, '2026-11-01')).toEqual({ error: 'kein Pin nope' });
  });
  it('edits the alt text and drops it when emptied', () => {
    const r = applyEdit(queue(pin()), { id: 'decades-OL49488W', alt: ' Book cover:  Dune. ' }, '2026-11-04');
    expect('queue' in r && r.queue.pins[0].alt).toBe('Book cover: Dune.');
    const gone = applyEdit(queue(pin({ alt: 'x' })), { id: 'decades-OL49488W', alt: '' }, '2026-11-04');
    expect('queue' in gone && 'alt' in gone.queue.pins[0]).toBe(false);
  });
  it('does not change the queue it was given', () => {
    const q = queue(pin());
    applyEdit(q, { id: 'decades-OL49488W', status: 'nein' }, '2026-11-01');
    expect(q.pins[0].status).toBe('entwurf');
  });
});

describe('file', () => {
  it('round-trips and refuses a double id', () => {
    const q = queue(pin(), pin({ id: 'decades-OL66554W', remark: 'r' }));
    expect(parseQueue(serializeQueue(q))).toEqual(q);
    expect(() => parseQueue(serializeQueue(queue(pin(), pin())))).toThrow(/doppelt/);
  });
  it('the queue in the repository is valid, and every pin said yes to keeps the rules', () => {
    const q = parseQueue(readFileSync(path.join(process.cwd(), 'docs', 'pins', 'queue.json'), 'utf8'));
    expect(q.pins.length).toBeGreaterThan(0);
    for (const p of q.pins) if (p.status !== 'nein') expect([p.id, problems(p)]).toEqual([p.id, []]);
  });
});

describe('kinds', () => {
  it('reads the kind from the file or the id, and writes it out for every pin, before the status', () => {
    expect(kindOf(pin())).toBe('decades');
    expect(kindOf({ id: 'collection-sf-masterworks' })).toBe('wall');
    expect(kindOf({ id: 'general-hugo-award-novel' })).toBe('wall');
    expect(kindOf({ id: 'compare-OL1W' })).toBe('compare');
    expect(kindOf({ id: 'cover-OL1W-ol1', kind: 'cover' })).toBe('cover');
    const q = withKinds(queue(pin(), pin({ id: 'cover-OL1W-ol1', kind: 'cover' })));
    expect(q.pins.map(p => p.kind)).toEqual(['decades', 'cover']);
    const text = serializeQueue(q);
    expect(text.indexOf('"kind"')).toBeLessThan(text.indexOf('"status"'));
  });
});

describe('pictures', () => {
  it('names the cached file from the id only', () => {
    expect(pictureFile('decades-OL49488W', 'dev')).toBe('decades-OL49488W-dev.jpg');
    expect(pictureFile('../etc', 'prod')).toBeNull();
  });
  it('fetches production as listed or the same path from the dev server', () => {
    expect(pictureUrl(pin(), 'prod')).toBe('https://buyitscovers.com/book/OL49488W/pin.jpg');
    expect(pictureUrl(pin(), 'dev')).toBe('http://localhost:3000/book/OL49488W/pin.jpg');
    expect(pictureUrl(pin({ picture: 'https://evil.example/pin.jpg' }), 'prod')).toBeNull();
    expect(pictureUrl(pin({ picture: 'https://covers.openlibrary.org/b/id/1.jpg' }), 'prod')).toBe('https://covers.openlibrary.org/b/id/1.jpg');
    expect(pictureUrl(pin({ picture: 'https://covers.openlibrary.org/b/id/1.jpg' }), 'dev')).toBeNull();
  });
});
