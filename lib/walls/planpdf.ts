/**
 * The frame plan a workshop builds from (ROADMAP 5.15; Julian, 2026-09-29:
 * „ja, bau den Maßplan als PDF“). Page one: the piece to scale with its
 * measurements and everything the framer has to know; then the books, each
 * with its ISBN, size, where the size comes from, and where it stands.
 *
 * The plan must not claim more than is known (SPEC N12): an estimated size is
 * marked, and the plan says that the books are to be measured on arrival and
 * laid out by the rules it states — the positions follow from those rules.
 */
import { hyphenateIsbn } from '../isbnformat';
import { ASSUMED_THICKNESS_CM, FORMAT_CM, formatLength, isEstimate, layoutPiece, ledges, measurements, PIECE_CM, unitLabel, type BookSize, type Units } from './dimensions';
import { DEFAULT_ARTWORK, FRAMES, TONES, type PublicWall } from './model';
import { encodable, fit, hexRgb, PdfDoc, type Rgb } from './pdf';

const A4_LANDSCAPE = { w: 842, h: 595 };
const MARGIN = 36;
const INK: Rgb = [0.1, 0.09, 0.08];
const GREY: Rgb = [0.45, 0.43, 0.4];
const RULE: Rgb = [0.8, 0.78, 0.75];
const MEASURE: Rgb = [0.76, 0.25, 0.05];

/**
 * Rough weight, **not measured**: books as paper at 0.7 g/cm³ (2.5 cm thick
 * when the thickness is unknown), 2 mm glass, a 5 mm MDF back panel, a
 * wooden moulding 3 × 7 cm at 0.6 g/cm³ and 3 mm acrylic ledges at 1.19 g/cm³.
 * Enough to choose a hanging system.
 */
export function roughWeightKg(
  sizes: ReadonlyArray<{ w: number; h: number; t?: number }>,
  panel: { w: number; h: number },
  outer: { w: number; h: number },
  shelves: ReadonlyArray<{ length: number; depth: number }> = [],
): number {
  const books = sizes.reduce((g, s) => g + s.w * s.h * (s.t ?? ASSUMED_THICKNESS_CM) * 0.7, 0);
  const glass = panel.w * panel.h * 0.2 * 2.5;
  const back = panel.w * panel.h * 0.5 * 0.75;
  const moulding = 2 * (outer.w + outer.h) * PIECE_CM.moulding * PIECE_CM.depth * 0.6;
  const acrylic = shelves.reduce((g, l) => g + l.length * (PIECE_CM.ledge + l.depth) * 0.3 * 1.19, 0);
  return Math.round(((books + glass + back + moulding + acrylic) / 1000) * 2) / 2;
}

/**
 * The glazing a plan asks for (research-book-wall-artists.md): UV-filtering,
 * at least 99 %, because covers fade behind plain glass; acrylic once a side
 * passes 70 cm, where glass gets heavy and breaks in the post.
 */
export function glazingFor(outer: { w: number; h: number }): string {
  return Math.max(outer.w, outer.h) > 70 ? 'acrylic, UV filter 99 %' : 'glass or acrylic, UV filter 99 %';
}

const SOURCE: Record<BookSize['source'], string> = {
  openlibrary: 'catalogue',
  library: 'library',
  format: 'format, estimated',
  assumed: 'assumed',
};

export interface PlanInput {
  wall: PublicWall;
  units: Units;
  /** ISO date of the plan, for the order number. */
  date: string;
  /** The collection's page, printed on the plan. */
  url: string;
}

export function planPdf({ wall, units, date, url }: PlanInput): Uint8Array {
  const doc = new PdfDoc(A4_LANDSCAPE.w, A4_LANDSCAPE.h);
  const U = unitLabel(units);
  // Positions need finer steps than the page's whole centimetres.
  const L = (cm: number) => (units === 'metric' ? (Math.round(cm * 10) / 10).toFixed(1) : formatLength(cm, 'imperial'));
  const sizes = wall.tiles.map((t) => t.size ?? FORMAT_CM.trade);
  const estimated = wall.tiles.filter((t) => isEstimate(t.size)).length;
  const plan = layoutPiece(sizes, wall.columns);
  const shelves = ledges(plan, sizes);
  const tone = TONES[wall.artwork?.tone ?? DEFAULT_ARTWORK.tone];
  const frame = FRAMES[wall.artwork?.frame ?? DEFAULT_ARTWORK.frame];
  const order = `${wall.id}-${date.replaceAll('-', '')}`;
  const m = PIECE_CM.moulding;
  const title = wall.title.trim() || 'A collection of covers';

  const header = (sub: string) => {
    doc.text(MARGIN, MARGIN + 12, 'Frame plan', { size: 16, bold: true, color: INK });
    doc.text(MARGIN + 100, MARGIN + 12, fit(encodable(title) ? title : wall.id, 420, 11), { size: 11, color: INK });
    doc.text(A4_LANDSCAPE.w - MARGIN, MARGIN + 4, `Order ${order}`, { size: 9, bold: true, align: 'right' });
    doc.text(A4_LANDSCAPE.w - MARGIN, MARGIN + 15, `${date} · ${sub}`, { size: 8, color: GREY, align: 'right' });
    doc.line(MARGIN, MARGIN + 22, A4_LANDSCAPE.w - MARGIN, MARGIN + 22, 0.5, RULE);
  };
  const footer = (page: number, pages: number) => {
    doc.text(MARGIN, A4_LANDSCAPE.h - 20, fit(`Beautiful Books · ${url}`, 600, 7), { size: 7, color: GREY });
    doc.text(A4_LANDSCAPE.w - MARGIN, A4_LANDSCAPE.h - 20, `Page ${page} of ${pages}`, { size: 7, color: GREY, align: 'right' });
  };
  const rowsPerPage = 26;
  const pages = 1 + Math.max(1, Math.ceil(wall.tiles.length / rowsPerPage));

  // Page one: the drawing and the specification.
  doc.page();
  header(`${wall.tiles.length} ${wall.tiles.length === 1 ? 'book' : 'books'}, ${plan.columns} per row`);
  const box = { x: MARGIN + 34, y: MARGIN + 60, w: 470, h: 440 };
  const s = Math.min(box.w / plan.outerWidthCm, box.h / plan.outerHeightCm);
  const ox = box.x + (box.w - plan.outerWidthCm * s) / 2;
  const oy = box.y;
  const X = (cm: number) => ox + cm * s;
  const Y = (cm: number) => oy + cm * s;
  const toneRgb = hexRgb(tone.hex).map((c) => c + (1 - c) * 0.55) as unknown as Rgb;
  doc.rect(X(0), Y(0), plan.outerWidthCm * s, plan.outerHeightCm * s, { fill: [0.82, 0.8, 0.77], stroke: INK, width: 0.8 });
  doc.rect(X(m), Y(m), plan.widthCm * s, plan.heightCm * s, { fill: toneRgb, stroke: INK, width: 0.5 });
  // The mitres.
  doc.line(X(0), Y(0), X(m), Y(m), 0.4, INK).line(X(plan.outerWidthCm), Y(0), X(plan.outerWidthCm - m), Y(m), 0.4, INK);
  doc.line(X(0), Y(plan.outerHeightCm), X(m), Y(plan.outerHeightCm - m), 0.4, INK);
  doc.line(X(plan.outerWidthCm), Y(plan.outerHeightCm), X(plan.outerWidthCm - m), Y(plan.outerHeightCm - m), 0.4, INK);
  const label = Math.max(5, Math.min(9, s * 2.2));
  // The ledges: clear acrylic, drawn light with a firm top edge where the books stand.
  for (const l of shelves) {
    doc.rect(X(m + l.x), Y(m + l.y), l.length * s, PIECE_CM.ledge * s, { fill: [0.86, 0.9, 0.93], stroke: [0.45, 0.55, 0.62], width: 0.4 });
    doc.line(X(m + l.x), Y(m + l.y), X(m + l.x + l.length), Y(m + l.y), 0.9, [0.3, 0.4, 0.48]);
  }
  plan.books.forEach((b, i) => {
    doc.rect(X(m + b.x), Y(m + b.y), b.w * s, b.h * s, { fill: [1, 1, 1], stroke: INK, width: 0.6 });
    doc.text(X(m + b.x + b.w / 2), Y(m + b.y + b.h / 2) + label / 3, String(i + 1), { size: label, bold: true, align: 'center' });
  });
  for (const d of measurements(plan)) {
    doc.line(X(d.x1), Y(d.y1), X(d.x2), Y(d.y2), 0.7, MEASURE);
    const mx = X((d.x1 + d.x2) / 2);
    const my = Y((d.y1 + d.y2) / 2);
    const t = L(d.cm);
    const horizontal = d.y1 === d.y2;
    doc.text(horizontal ? mx : mx + 3, horizontal ? my - 2.5 : my + 2.5, t, { size: 6.5, color: MEASURE, align: horizontal ? 'center' : 'left' });
  }
  // Outside dimensions, above and to the left.
  doc.line(X(0), oy - 10, X(plan.outerWidthCm), oy - 10, 0.6, MEASURE);
  doc.line(X(0), oy - 14, X(0), oy - 6, 0.6, MEASURE).line(X(plan.outerWidthCm), oy - 14, X(plan.outerWidthCm), oy - 6, 0.6, MEASURE);
  doc.text(X(plan.outerWidthCm / 2), oy - 13, `${L(plan.outerWidthCm)} ${U}`, { size: 8, bold: true, color: MEASURE, align: 'center' });
  doc.line(ox - 12, Y(0), ox - 12, Y(plan.outerHeightCm), 0.6, MEASURE);
  doc.line(ox - 16, Y(0), ox - 8, Y(0), 0.6, MEASURE).line(ox - 16, Y(plan.outerHeightCm), ox - 8, Y(plan.outerHeightCm), 0.6, MEASURE);
  doc.text(ox - 15, Y(plan.outerHeightCm / 2), `${L(plan.outerHeightCm)}`, { size: 8, bold: true, color: MEASURE, align: 'right' });

  const col = MARGIN + 540;
  let y = MARGIN + 60;
  const spec = (k: string, v: string) => {
    doc.text(col, y, k, { size: 8, color: GREY });
    doc.text(col + 78, y, fit(v, 150, 8.5), { size: 8.5, color: INK });
    y += 13;
  };
  const note = (text: string, size = 8) => {
    // A crude wrap at the column width.
    let lineText = '';
    for (const word of text.split(' ')) {
      const next = lineText ? `${lineText} ${word}` : word;
      if (next.length * size * 0.5 > 226) {
        doc.text(col, y, lineText, { size, color: INK });
        y += size + 3;
        lineText = word;
      } else lineText = next;
    }
    if (lineText) doc.text(col, y, lineText, { size, color: INK });
    y += size + 7;
  };
  doc.text(col, y - 14, `All measures in ${units === 'metric' ? 'centimetres' : 'inches'}`, { size: 8, bold: true });
  spec('Outside', `${L(plan.outerWidthCm)} × ${L(plan.outerHeightCm)} ${U}`);
  spec('Back panel', `${L(plan.widthCm)} × ${L(plan.heightCm)} ${U}`);
  spec('Depth', `${L(PIECE_CM.depth)} ${U} inside, books + ledge + air`);
  spec('Moulding', `${L(m)} ${U} face, ${frame.label.toLowerCase()}`);
  spec('Background', `${tone.label} (${tone.hex}), linen or paper`);
  spec('Margin', `${L(PIECE_CM.margin)} ${U} on every side`);
  spec('Between books', `at least ${L(PIECE_CM.gap)} ${U}`);
  spec('Between rows', `${L(PIECE_CM.rowGap)} ${U} above the tallest book`);
  if (shelves.length > 0) {
    spec('Ledges', `${shelves.length} × ${L(shelves[0].length)} ${U}, clear acrylic L-profile`);
    spec('', `${L(PIECE_CM.ledge)} ${U} high × ${L(Math.max(...shelves.map((l) => l.depth)))} ${U} deep`);
  }
  spec('Weight', `about ${roughWeightKg(sizes, { w: plan.widthCm, h: plan.heightCm }, { w: plan.outerWidthCm, h: plan.outerHeightCm }, shelves)} kg, estimated`);
  spec('Glazing', glazingFor({ w: plan.outerWidthCm, h: plan.outerHeightCm }));
  y += 6;
  note('How the books are laid out: each row stands on one bottom line and is as tall as its tallest book. Each column is as wide as its widest book, and each book is centred in its column.');
  note('The books stand upright on the ledges, their backs against the panel. Nothing is glued or fixed to a book: they must come out again to be read, so make the front removable.');
  note(`Positions (page 2) are the top-left corner of each book, measured from the inside top-left corner of the back panel.`);
  if (estimated > 0) {
    note(`${estimated} of ${wall.tiles.length} book sizes are estimated. Measure the books when they arrive and lay them out by the rules above; the positions follow from these rules and will move with the real sizes.`);
  } else {
    note('Sizes come from library and catalogue records. Check them against the books before cutting.');
  }
  footer(1, pages);

  // The books.
  const cols = { n: MARGIN, book: MARGIN + 22, isbn: MARGIN + 330, printing: MARGIN + 430, size: MARGIN + 560, pos: MARGIN + 625, source: MARGIN + 700 };
  for (let p = 0; p * rowsPerPage < Math.max(1, wall.tiles.length); p++) {
    doc.page();
    header('the books');
    let ry = MARGIN + 48;
    const head = (x: number, t: string) => doc.text(x, ry, t, { size: 7.5, bold: true, color: GREY });
    head(cols.n, '#');
    head(cols.book, 'Book');
    head(cols.isbn, 'ISBN');
    head(cols.printing, 'Printing');
    head(cols.size, `Size w × h (${U})`);
    head(cols.pos, `Position x, y (${U})`);
    head(cols.source, 'Size from');
    ry += 6;
    doc.line(MARGIN, ry, A4_LANDSCAPE.w - MARGIN, ry, 0.5, RULE);
    wall.tiles.slice(p * rowsPerPage, (p + 1) * rowsPerPage).forEach((t, k) => {
      const i = p * rowsPerPage + k;
      const b = plan.books[i];
      ry += 16;
      const pr = t.printings[0];
      const name = `${t.title} — ${t.author ?? ''}`.replace(/ — $/, '');
      const shown = encodable(name) ? name : `${name} (${t.workId})`;
      const size = t.size ?? FORMAT_CM.trade;
      doc.text(cols.n, ry, String(i + 1), { size: 8.5, bold: true });
      doc.text(cols.book, ry, fit(shown, 300, 8.5), { size: 8.5 });
      doc.text(cols.isbn, ry, pr?.isbn13 ? hyphenateIsbn(pr.isbn13) : pr?.isbn10 ?? '—', { size: 8.5 });
      doc.text(cols.printing, ry, fit([pr?.publisher, pr?.year].filter(Boolean).join(', ') || '—', 124, 8.5), { size: 8.5 });
      doc.text(cols.size, ry, `${isEstimate(t.size) ? '~ ' : ''}${L(size.w)} × ${L(size.h)}`, { size: 8.5 });
      doc.text(cols.pos, ry, `${L(b.x)}, ${L(b.y)}`, { size: 8.5 });
      doc.text(cols.source, ry, t.size ? SOURCE[t.size.source] : 'not looked up', { size: 8, color: isEstimate(t.size) ? MEASURE : GREY });
      doc.line(MARGIN, ry + 5, A4_LANDSCAPE.w - MARGIN, ry + 5, 0.3, RULE);
    });
    ry += 22;
    if ((p + 1) * rowsPerPage >= wall.tiles.length) {
      doc.text(MARGIN, ry, 'An ISBN names a printing, not its picture: the same number has carried other covers. Buy by the cover shown on the collection page.', { size: 7.5, color: GREY });
    }
    footer(p + 2, pages);
  }
  return doc.bytes();
}
