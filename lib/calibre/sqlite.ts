/**
 * Reads whole tables out of an SQLite file, in the browser (ROADMAP 5.17a).
 *
 * Pure and client-safe. A Calibre library is one SQLite file, `metadata.db`,
 * and the reader's copy of it never leaves their device: the page reads the
 * four tables it needs here and sends on only titles, authors and ISBNs. A
 * full SQLite engine in WebAssembly (sql.js) would be some 600 KB for a page
 * that only ever scans four tables front to back; this is the part of the
 * file format a scan needs — the header, table b-trees, overflow pages and
 * the record format — from https://www.sqlite.org/fileformat2.html.
 *
 * Not handled, on purpose: indexes (a scan does not need them), `WITHOUT
 * ROWID` tables (left out of `tables`; Calibre 7 keeps four for its full-text
 * index of annotations, `annotations_fts_*`, and the import reads none of them), and the write-ahead log — a library saved
 * by a running Calibre may have changes only in `metadata.db-wal`, so the
 * page asks for the file of a closed Calibre.
 */

export class SqliteError extends Error {}

export type SqlValue = null | number | string | Uint8Array;
export type Row = Record<string, SqlValue>;

const MAGIC = 'SQLite format 3\u0000';
/** A damaged file must end in an error, never in a loop. */
const MAX_PAGES_VISITED = 1_000_000;

export interface SqliteFile {
  bytes: Uint8Array;
  view: DataView;
  pageSize: number;
  /** Page size less the bytes reserved at the end of every page. */
  usable: number;
  pageCount: number;
  decode: (b: Uint8Array) => string;
  /** The file says it was last written in WAL mode: newer rows may sit in a `-wal` file beside it. */
  wal: boolean;
}

export function openSqlite(input: ArrayBuffer | Uint8Array): SqliteFile {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 100 || String.fromCharCode(...bytes.subarray(0, 16)) !== MAGIC) throw new SqliteError('This is not an SQLite file.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const raw = view.getUint16(16);
  const pageSize = raw === 1 ? 65536 : raw;
  if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) !== 0) throw new SqliteError('The file has an impossible page size.');
  const usable = pageSize - bytes[20];
  if (usable < 480) throw new SqliteError('The file reserves too much of each page.');
  const encoding = view.getUint32(56);
  const label = encoding === 2 ? 'utf-16le' : encoding === 3 ? 'utf-16be' : 'utf-8';
  const decoder = new TextDecoder(label);
  return {
    bytes,
    view,
    pageSize,
    usable,
    pageCount: Math.floor(bytes.length / pageSize),
    decode: (b) => decoder.decode(b),
    wal: bytes[18] === 2 || bytes[19] === 2,
  };
}

/** A varint at `at`: its value and its length in bytes. */
export function varint(bytes: Uint8Array, at: number): [number, number] {
  let value = 0;
  for (let i = 0; i < 8; i++) {
    const b = bytes[at + i];
    if (b === undefined) throw new SqliteError('The file ends inside a number.');
    value = value * 128 + (b & 0x7f);
    if (b < 0x80) return [value, i + 1];
  }
  const last = bytes[at + 8];
  if (last === undefined) throw new SqliteError('The file ends inside a number.');
  return [value * 256 + last, 9];
}

function pageStart(f: SqliteFile, page: number): number {
  if (!Number.isInteger(page) || page < 1 || page > f.pageCount) throw new SqliteError(`The file points at page ${page}, which it does not have.`);
  return (page - 1) * f.pageSize;
}

/** The payload of a cell: the part on the page and, if it is longer, the overflow pages after it. */
function payload(f: SqliteFile, at: number, size: number): Uint8Array {
  const u = f.usable;
  const x = u - 35;
  let local = size;
  if (size > x) {
    const m = Math.floor(((u - 12) * 32) / 255) - 23;
    const k = m + ((size - m) % (u - 4));
    local = k <= x ? k : m;
  }
  if (local === size) return f.bytes.subarray(at, at + size);
  const out = new Uint8Array(size);
  out.set(f.bytes.subarray(at, at + local), 0);
  let filled = local;
  let next = f.view.getUint32(at + local);
  let hops = 0;
  while (filled < size) {
    if (next === 0 || ++hops > f.pageCount) throw new SqliteError('A long value runs off its overflow pages.');
    const start = pageStart(f, next);
    const take = Math.min(u - 4, size - filled);
    out.set(f.bytes.subarray(start + 4, start + 4 + take), filled);
    filled += take;
    next = f.view.getUint32(start);
  }
  return out;
}

/** Every row of the table b-tree rooted at `root`, in rowid order: `[rowid, record bytes]`. */
export function* tableCells(f: SqliteFile, root: number): Generator<[number, Uint8Array]> {
  const stack = [root];
  const seen = new Set<number>();
  while (stack.length > 0) {
    const page = stack.pop() as number;
    if (seen.has(page) || seen.size > MAX_PAGES_VISITED) throw new SqliteError('The file’s tables point in a circle.');
    seen.add(page);
    const base = pageStart(f, page);
    const h = base + (page === 1 ? 100 : 0);
    const type = f.bytes[h];
    const cells = f.view.getUint16(h + 3);
    if (type === 0x0d) {
      for (let i = 0; i < cells; i++) {
        let at = base + f.view.getUint16(h + 8 + i * 2);
        const [size, a] = varint(f.bytes, at);
        at += a;
        const [rowid, b] = varint(f.bytes, at);
        at += b;
        yield [rowid, payload(f, at, size)];
      }
    } else if (type === 0x05) {
      // Children are pushed right to left, so they come off the stack in rowid order.
      stack.push(f.view.getUint32(h + 8));
      for (let i = cells - 1; i >= 0; i--) stack.push(f.view.getUint32(base + f.view.getUint16(h + 12 + i * 2)));
    } else {
      throw new SqliteError(`Page ${page} is not part of a table (type ${type}).`);
    }
  }
}

/** A big-endian two's-complement integer of 1 to 6 bytes. */
function int(bytes: Uint8Array, at: number, n: number): number {
  if (at + n > bytes.length) throw new SqliteError('A value runs past the end of its row.');
  let u = 0;
  for (let i = 0; i < n; i++) u = u * 256 + bytes[at + i];
  return bytes[at] & 0x80 ? u - 2 ** (8 * n) : u;
}

/** One record: its values in column order. */
export function record(f: SqliteFile, bytes: Uint8Array): SqlValue[] {
  const [headerSize, first] = varint(bytes, 0);
  const types: number[] = [];
  for (let at = first; at < headerSize; ) {
    const [t, n] = varint(bytes, at);
    types.push(t);
    at += n;
  }
  const out: SqlValue[] = [];
  let at = headerSize;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const t of types) {
    if (t === 0) out.push(null);
    else if (t >= 1 && t <= 6) {
      const n = [0, 1, 2, 3, 4, 6, 8][t];
      out.push(t === 6 ? Number(view.getBigInt64(at)) : int(bytes, at, n));
      at += n;
    } else if (t === 7) {
      out.push(view.getFloat64(at));
      at += 8;
    } else if (t === 8 || t === 9) out.push(t - 8);
    else if (t >= 12) {
      const n = (t - (t % 2 === 0 ? 12 : 13)) / 2;
      if (at + n > bytes.length) throw new SqliteError('A value runs past the end of its row.');
      const slice = bytes.subarray(at, at + n);
      out.push(t % 2 === 0 ? slice : f.decode(slice));
      at += n;
    } else throw new SqliteError(`A row has a value of unknown kind (${t}).`);
  }
  return out;
}

export interface Column {
  name: string;
  /** `INTEGER PRIMARY KEY`: stored as NULL in the record, its value is the rowid. */
  rowid: boolean;
}

const WITHOUT_ROWID = /\)\s*without\s+rowid\s*;?\s*$/i;
const TABLE_CONSTRAINT = /^(constraint|primary|unique|check|foreign)\b/i;

/** The columns of a `CREATE TABLE` statement, in order. */
export function columnsOf(sql: string): Column[] {
  const open = sql.indexOf('(');
  const close = sql.lastIndexOf(')');
  if (open < 0 || close < open) throw new SqliteError('A table definition could not be read.');
  const body = sql.slice(open + 1, close);
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '[') quote = ']';
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts
    .map((p) => p.trim())
    .filter((p) => p && !TABLE_CONSTRAINT.test(p))
    .map((p) => {
      const m = /^("([^"]+)"|`([^`]+)`|\[([^\]]+)\]|'([^']+)'|(\S+))\s*([\s\S]*)$/.exec(p) as RegExpExecArray;
      const name = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6];
      const rest = m[7];
      return { name, rowid: /^integer\b/i.test(rest) && /\bprimary\s+key\b/i.test(rest) };
    });
}

export interface Table {
  name: string;
  root: number;
  columns: Column[];
}

/** The tables the file declares (`sqlite_master`, rooted at page 1), except those `WITHOUT ROWID`. */
export function tables(f: SqliteFile): Map<string, Table> {
  const out = new Map<string, Table>();
  for (const [, bytes] of tableCells(f, 1)) {
    const [type, name, , root, sql] = record(f, bytes);
    if (type !== 'table' || typeof name !== 'string' || typeof root !== 'number' || typeof sql !== 'string' || root === 0) continue;
    // Stored as an index b-tree, which a scan here does not read; Calibre's annotation index has four such tables.
    if (WITHOUT_ROWID.test(sql)) continue;
    out.set(name.toLowerCase(), { name, root, columns: columnsOf(sql) });
  }
  return out;
}

/**
 * Every row of a table, keyed by column name. A row written before a column
 * was added (`ALTER TABLE … ADD COLUMN`) is shorter than the table: the
 * missing values are `null`, not the column's default — none of the columns
 * read here has one that matters.
 */
export function readTable(f: SqliteFile, table: Table): Row[] {
  const rows: Row[] = [];
  for (const [rowid, bytes] of tableCells(f, table.root)) {
    const values = record(f, bytes);
    const row: Row = {};
    table.columns.forEach((c, i) => {
      row[c.name] = c.rowid ? rowid : (values[i] ?? null);
    });
    rows.push(row);
  }
  return rows;
}
