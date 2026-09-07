/**
 * A shared slot queue for the cards' cover requests (SPEC §9.3 step 14).
 *
 * A result page holds up to twenty cards, and each wants a mosaic. Firing
 * twenty requests at once would queue behind the browser's own connection
 * limit anyway and would push twenty edition lookups at Open Library in one
 * breath. Eight at a time keeps the grid filling steadily.
 */
const MAX_PARALLEL = 8;

let active = 0;
const waiting: Array<() => void> = [];

function release(): void {
  active -= 1;
  const next = waiting.shift();
  if (next) next();
}

/** Runs `task` once a slot is free. Rejections propagate; the slot is freed either way. */
export async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) {
    await new Promise<void>(resolve => waiting.push(resolve));
  }
  active += 1;
  try {
    return await task();
  } finally {
    release();
  }
}

/** For tests: how many tasks are running and waiting right now. */
export function queueState(): { active: number; waiting: number } {
  return { active, waiting: waiting.length };
}
