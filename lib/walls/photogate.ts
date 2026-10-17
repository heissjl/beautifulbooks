/**
 * How many photos one function instance reads at once (ROADMAP 2.18h, red
 * team B4). Pure; the shared gate lives on `globalThis` like the stores.
 *
 * A photo holds its function for up to two minutes — the model, then up to
 * two hundred catalogue searches — and nothing stopped a burst of them from
 * running side by side on one instance: the day's budget binds only after a
 * read has answered, and Open Library refuses an address that asks too much
 * (CLAUDE.md). So an instance reads at most `PHOTOS_AT_ONCE` photos at a
 * time; the next reader is told the server is busy and may try again in a
 * moment — a refusal with a sentence, never a slow failure.
 */
export const PHOTOS_AT_ONCE = 3;

export class InFlight {
  private count = 0;

  constructor(readonly limit: number = PHOTOS_AT_ONCE) {}

  /** Takes a place when one is free; the caller must `leave` once, however the read ends. */
  enter(): boolean {
    if (this.count >= this.limit) return false;
    this.count += 1;
    return true;
  }

  leave(): void {
    this.count = Math.max(0, this.count - 1);
  }

  get inFlight(): number {
    return this.count;
  }
}

const shared = globalThis as typeof globalThis & { __bbPhotoGate?: InFlight };

/** This instance's gate, shared by every request the instance serves. */
export function photoGate(): InFlight {
  return (shared.__bbPhotoGate ??= new InFlight());
}
