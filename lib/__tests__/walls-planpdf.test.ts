import { describe, expect, it } from 'vitest';
import { PdfDoc, encodable, fit } from '../walls/pdf';
import { glazingFor, planPdf, roughWeightKg } from '../walls/planpdf';
import type { PublicWall } from '../walls/model';

const text = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

/** Every object the cross-reference table points at must start where it says. */
function xrefHolds(pdf: string): boolean {
  const start = Number(pdf.match(/startxref\n(\d+)/)![1]);
  const rows = pdf.slice(start).split('\n').slice(3).filter((r) => / n $/.test(r));
  return rows.every((r, i) => pdf.startsWith(`${i + 1} 0 obj`, Number(r.slice(0, 10))));
}

const wall: PublicWall = {
  id: 'abcdefghij',
  title: 'Shelf by the window',
  columns: 2,
  createdOn: '2026-09-29',
  artwork: { tone: 'sage', frame: 'walnut' },
  tiles: [
    { workId: 'OL1W', coverId: '1', title: 'Die Verwandlung', author: 'Franz Kafka', printings: [{ isbn13: '9783518188132', publisher: 'Suhrkamp', year: 1999 }], size: { h: 19, w: 12, source: 'library' } },
    { workId: 'OL2W', coverId: '2', title: 'Dune', author: 'Frank Herbert', printings: [], size: { h: 17.5, w: 10.8, source: 'format' } },
    { workId: 'OL3W', coverId: '3', title: '三体', author: '刘慈欣', printings: [] },
  ],
} as unknown as PublicWall;

describe('pdf writer (5.15)', () => {
  it('writes a file whose cross-references hold', () => {
    const pdf = text(new PdfDoc(200, 100).text(10, 20, 'Größe (cm) — ok').line(0, 0, 10, 10).page().rect(1, 1, 5, 5, { fill: [1, 0, 0] }).bytes());
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('/Count 2');
    expect(xrefHolds(pdf)).toBe(true);
    // Umlauts in Windows-1252, parentheses escaped.
    expect(pdf).toContain('(Gr\\366\\337e \\(cm\\) \\227 ok)');
  });

  it('knows what the standard fonts can write, and cuts long text', () => {
    expect(encodable('Döblin — „Berlin“')).toBe(true);
    expect(encodable('三体')).toBe(false);
    expect(fit('A very long title that will not fit', 60, 9)).toMatch(/…$/);
  });
});

describe('frame plan (5.15)', () => {
  const pdf = text(planPdf({ wall, units: 'metric', date: '2026-09-29', url: 'https://example.test/c/abcdefghij' }));

  it('is a valid file with the drawing page and a page of books', () => {
    expect(xrefHolds(pdf)).toBe(true);
    expect(pdf).toContain('/Count 2');
    expect(pdf).not.toContain('NaN');
  });

  it('names the order, the finishes and every book with its ISBN', () => {
    expect(pdf).toContain('(Order abcdefghij-20260929)');
    expect(pdf).toContain('dark wood');
    expect(pdf).toContain('Sage \\(#aab39b\\)');
    expect(pdf).toContain('978-3-518-18813-2');
    // A title the fonts cannot write keeps its Open Library id beside it.
    expect(pdf).toContain('OL3W');
  });

  it('says which sizes are estimated instead of passing them off as measured', () => {
    expect(pdf).toContain('2 of 3 book sizes are estimated');
    expect(pdf).toContain('(~ 10.8 \\327 17.5)');
    expect(pdf).toContain('(library)');
  });

  it('asks for one acrylic ledge per row, UV-filtering glazing, and no fixing on the books', () => {
    expect(pdf).toContain('(Ledges)');
    expect(pdf).toMatch(/\(2 \\327 [0-9.]+ cm, clear acrylic L-profile\)/);
    expect(pdf).toContain('UV filter 99 %');
    expect(pdf).toContain('Nothing is glued or fixed to a book');
    expect(pdf).not.toContain('Wedges');
    expect(pdf).toContain('(at least 5.0 cm clear inside)');
    expect(pdf).toContain('thicknesses are not known');
  });

  it('asks for acrylic rather than glass once a side passes 70 cm', () => {
    expect(glazingFor({ w: 60, h: 50 })).toContain('glass or acrylic');
    expect(glazingFor({ w: 90, h: 50 })).toMatch(/^acrylic/);
  });

  it('writes inches when asked', () => {
    const inch = text(planPdf({ wall, units: 'imperial', date: '2026-09-29', url: 'x' }));
    expect(inch).toContain('All measures in inches');
  });

  it('estimates a weight that grows with the books', () => {
    const panel = { w: 60, h: 50 };
    const outer = { w: 66, h: 56 };
    expect(roughWeightKg([{ w: 13, h: 20 }], panel, outer)).toBeLessThan(roughWeightKg(Array(8).fill({ w: 13, h: 20 }), panel, outer));
  });
});
