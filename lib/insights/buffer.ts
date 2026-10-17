/**
 * The analytics' write buffer (ROADMAP 2.18d). Pure; the clock is passed in.
 *
 * Measured 2026-10-05 (2.18b): one page signal cost four Redis commands (two
 * `HINCRBY`, two `EXPIRE`), one click through `/go/` two — at ten page views a
 * second forty commands for the analytics alone, before any reader writes
 * anything. So an instance adds signals and clicks up here and writes the
 * sums at most every `FLUSH_EVERY_MS`, as one command per day-hash
 * (`hIncrByMany`: every field and the expiry in one `EVAL`), after a response
 * has left. What an instance has gathered when it is stopped is lost — at
 * most ten seconds of counting, which the view says.
 *
 * Only sums, as before: a field and a number. Nothing here is about a reader.
 */
export const FLUSH_EVERY_MS = 10_000;
/** Fields waiting at most; beyond that the oldest hash goes whole — a dead store must not grow the buffer. */
export const FIELDS_BUFFERED = 2000;

export interface PendingHash {
  key: string;
  /** Seconds the day's hash lives, renewed with every write. */
  retention: number;
  increments: Array<[field: string, by: number]>;
}

interface Entry {
  retention: number;
  fields: Map<string, number>;
}

export class InsightsBuffer {
  private readonly keys = new Map<string, Entry>();
  private flushedAt = 0;
  private size = 0;

  add(key: string, field: string, by: number, retention: number): void {
    if (!(by > 0)) return;
    let entry = this.keys.get(key);
    if (!entry) {
      entry = { retention, fields: new Map() };
      this.keys.set(key, entry);
    }
    if (!entry.fields.has(field)) this.size += 1;
    entry.fields.set(field, (entry.fields.get(field) ?? 0) + by);
    while (this.size > FIELDS_BUFFERED) {
      const oldest = this.keys.entries().next();
      if (oldest.done) break;
      this.size -= oldest.value[1].fields.size;
      this.keys.delete(oldest.value[0]);
    }
  }

  /** Whether the first call after `FLUSH_EVERY_MS` has come, and there is something to write. */
  due(now: number): boolean {
    return this.keys.size > 0 && now - this.flushedAt >= FLUSH_EVERY_MS;
  }

  /** Everything waiting, as one entry per day-hash; the buffer starts again from nothing. */
  take(now: number): PendingHash[] {
    const out: PendingHash[] = [];
    for (const [key, entry] of this.keys) {
      out.push({ key, retention: entry.retention, increments: [...entry.fields.entries()] });
    }
    this.keys.clear();
    this.size = 0;
    this.flushedAt = now;
    return out;
  }

  /** Sums back into the buffer after a failed write: nothing is lost while the instance lives. */
  putBack(pending: readonly PendingHash[]): void {
    for (const p of pending) for (const [field, by] of p.increments) this.add(p.key, field, by, p.retention);
  }

  /** Fields counted on this instance and not yet written. */
  get pending(): number {
    return this.size;
  }
}
