/**
 * When the store stops answering, the pages stop asking for a while
 * (ROADMAP 2.18c). Server only.
 *
 * A Redis that is out of connections ("max clients") or gone answers every
 * request with the same silence, and each attempt costs the reader the
 * command timeout before the page falls back to the file — two seconds for
 * the collections, four for a wall. So the first silence trips a pause: for
 * `PAUSE_MS` this instance renders the home page and the collections from the
 * file and from what it last read, and answers a reader's wall from memory or
 * with "did not answer" at once, without asking. After the pause the next
 * request asks again; if the store is back, that is the end of it.
 *
 * Only the pages' reads are paused. A vote, a change to a wall, a draft, the
 * health check and the analytics still try: a write cannot be served from
 * memory, and the monitor must see the store as it is.
 *
 * One pause per function instance, on `globalThis` for the reason the stores
 * give: under `next dev` pages and routes get separate copies of a module.
 */
export const PAUSE_MS = 30_000;

export class Pause {
  private until = 0;
  private tripped = 0;

  constructor(private readonly ms: number = PAUSE_MS) {}

  /** Whether the instance is not asking the store right now. */
  active(now: number = Date.now()): boolean {
    return now < this.until;
  }

  /** The store was silent: no page read asks it for the next `ms`. */
  trip(now: number = Date.now()): void {
    this.until = now + this.ms;
    this.tripped += 1;
  }

  /** Milliseconds until the instance asks again; 0 when it would ask now. */
  remaining(now: number = Date.now()): number {
    return Math.max(0, this.until - now);
  }

  /** How often the store was found silent since the instance started (the operations block, 2.18g). */
  get trips(): number {
    return this.tripped;
  }

  reset(): void {
    this.until = 0;
  }
}

const shared = globalThis as typeof globalThis & { __bbStorePause?: Pause };

/** This instance's pause, shared by every page that reads the store. */
export function storePause(): Pause {
  return (shared.__bbStorePause ??= new Pause());
}
