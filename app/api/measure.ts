import { after } from 'next/server';
import { agentClass, CpuMeter, type CpuRoute } from '@/lib/insights/cpu';
import { countCpu } from '@/lib/insights/store';

/**
 * Counts the CPU time of the request that calls it (ROADMAP 2.18l, K14;
 * lib/insights/cpu.ts): one line at the top of a route handler or a page.
 *
 * The request ends in `after`, when the response has left, so a streamed
 * body and a rendered page are inside the measure. The meter and the time of
 * its last flush live on `globalThis`, like the stores: under `next dev`
 * routes and pages get separate copies of a module.
 *
 * Written to the store every thirty seconds at most per instance, by the
 * request that happens to come then; what an instance gathered after its
 * last flush is lost when it is stopped, which the view says.
 */
const FLUSH_EVERY_MS = 30_000;

const shared = globalThis as typeof globalThis & { __bbCpu?: { meter: CpuMeter; flushed: number } };

function state() {
  return (shared.__bbCpu ??= {
    meter: new CpuMeter(() => {
      const { user, system } = process.cpuUsage();
      return user + system;
    }),
    flushed: 0,
  });
}

/** `request` gives the kind of caller; a page passes none, because an ISR page must not read its headers. */
export function measure(route: CpuRoute, request?: { headers: Headers }): void {
  const { meter } = state();
  const started = Date.now();
  const token = meter.start(route, request ? agentClass(request.headers.get('user-agent')) : 'page');
  try {
    after(async () => {
      meter.end(token, Date.now() - started);
      const current = state();
      if (Date.now() - current.flushed < FLUSH_EVERY_MS) return;
      current.flushed = Date.now();
      await countCpu(current.meter.take());
    });
  } catch {
    // No request scope (a test calling a handler directly): nothing to count against.
    meter.end(token, 0);
  }
}
