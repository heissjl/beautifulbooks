/**
 * A very small PDF writer (ROADMAP 5.15): pages of lines, rectangles and text
 * in the standard Helvetica fonts, nothing embedded. Enough for the frame plan
 * a workshop gets, without a dependency. Pure; coordinates in points from the
 * top left (the writer flips them to PDF's bottom-left origin).
 */

export type Rgb = readonly [number, number, number];

interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: Rgb;
  align?: 'left' | 'center' | 'right';
}

/** Windows-1252, which the standard fonts use: ASCII, Latin-1 and a few more. */
const CP1252_EXTRA: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89,
  'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
  '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

/** Whether every character of `text` can be written in the standard fonts. */
export function encodable(text: string): boolean {
  return [...text.normalize('NFC')].every((c) => c.charCodeAt(0) < 0x100 || c in CP1252_EXTRA);
}

/** The text as a PDF string in Windows-1252; a character outside it becomes "?". */
function pdfString(text: string): string {
  let out = '';
  for (const c of text.normalize('NFC')) {
    const code = c.charCodeAt(0) < 0x100 ? c.charCodeAt(0) : (CP1252_EXTRA[c] ?? 0x3f);
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${c}`;
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += c;
  }
  return `(${out})`;
}

/** Rough Helvetica advance, in ems: good enough to centre a label or cut a long title. */
export function textWidth(text: string, size: number, bold = false): number {
  let em = 0;
  for (const c of text) em += /[il.,:;'|!]/.test(c) ? 0.25 : /[mwMW]/.test(c) ? 0.85 : /[A-Z0-9]/.test(c) ? 0.66 : c === ' ' ? 0.28 : 0.53;
  return em * size * (bold ? 1.06 : 1);
}

/** Cuts `text` with an ellipsis so it fits `width` points. */
export function fit(text: string, width: number, size: number, bold = false): string {
  if (textWidth(text, size, bold) <= width) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}…`, size, bold) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

export class PdfDoc {
  private pages: string[][] = [];
  constructor(readonly width: number, readonly height: number) {}

  page(): this {
    this.pages.push([]);
    return this;
  }
  private get ops(): string[] {
    if (this.pages.length === 0) this.page();
    return this.pages[this.pages.length - 1];
  }
  private y(v: number) {
    return n(this.height - v);
  }

  line(x1: number, y1: number, x2: number, y2: number, width = 0.5, color: Rgb = [0, 0, 0], dash?: number): this {
    this.ops.push(`q ${color.map(n).join(' ')} RG ${n(width)} w ${dash ? `[${n(dash)} ${n(dash)}] 0 d ` : ''}${n(x1)} ${this.y(y1)} m ${n(x2)} ${this.y(y2)} l S Q`);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, opts: { stroke?: Rgb; fill?: Rgb; width?: number } = {}): this {
    const { stroke, fill, width = 0.5 } = opts;
    const paint = fill && stroke ? 'B' : fill ? 'f' : 'S';
    this.ops.push(
      `q ${fill ? `${fill.map(n).join(' ')} rg ` : ''}${stroke ? `${stroke.map(n).join(' ')} RG ` : ''}${n(width)} w ${n(x)} ${this.y(y + h)} ${n(w)} ${n(h)} re ${paint} Q`,
    );
    return this;
  }

  /** Text with its baseline at `y`. */
  text(x: number, y: number, text: string, opts: TextOptions = {}): this {
    const { size = 9, bold = false, color = [0, 0, 0], align = 'left' } = opts;
    const w = textWidth(text, size, bold);
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    this.ops.push(`BT ${color.map(n).join(' ')} rg /${bold ? 'F2' : 'F1'} ${n(size)} Tf ${n(left)} ${this.y(y)} Td ${pdfString(text)} Tj ET`);
    return this;
  }

  /** The finished file. */
  bytes(): Uint8Array {
    if (this.pages.length === 0) this.page();
    const objects: string[] = [];
    const add = (body: string) => objects.push(body);
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add(''); // pages, filled in below
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids: number[] = [];
    for (const ops of this.pages) {
      const stream = ops.join('\n');
      add(`<< /Length ${latin1Length(stream)} >>\nstream\n${stream}\nendstream`);
      const contents = objects.length;
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(this.width)} ${n(this.height)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contents} 0 R >>`);
      kids.push(objects.length);
    }
    objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(latin1Length(out));
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = latin1Length(out);
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}

/** Every character written is one byte (strings are escaped to ASCII above). */
function latin1Length(s: string): number {
  return s.length;
}

/** "#d9c7a7" → [0.85, 0.78, 0.65]. */
export function hexRgb(hex: string): Rgb {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return [v[0], v[1], v[2]];
}
