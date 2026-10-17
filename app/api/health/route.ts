import { NextRequest } from 'next/server';
import { later } from '@/app/api/count';
import { rateLimited } from '@/app/api/rate';
import { sendAlert } from '@/lib/alerts';
import { fillMail, fillWarnings } from '@/lib/fill';
import { commandsFromEnv, type RedisCommands } from '@/lib/redis';
import { googlePausedFor } from '@/lib/googlequota';
import { fieldSearchKnownBroken } from '@/lib/googlefields';
import { healthReport } from '@/lib/health';
import { dayOf } from '@/lib/insights/model';
import { readFill } from '@/lib/operations';

/**
 * GET /api/health — for the uptime monitor (ROADMAP 2.18g). `no-store`, plain
 * text, 200 with "status: ok" or 503 with "status: degraded". One GET on the
 * store, bounded at two seconds; the Google breakers read from memory; no
 * request to Open Library. See lib/health.ts for why.
 */
export const dynamic = 'force-dynamic';

const PROBE_MS = 2000;

async function probe(commands: RedisCommands | null): Promise<{ configured: boolean; ms: number | null }> {
  if (!commands) return { configured: false, ms: null };
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      commands.get('health:probe'),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('late')), PROBE_MS); }),
    ]);
    return { configured: true, ms: Date.now() - start };
  } catch {
    return { configured: true, ms: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const limited = rateLimited(request, 'health');
  if (limited) return limited;
  const commands = commandsFromEnv();
  const redis = await probe(commands);
  // The fill level only from a store that just answered: seven small commands, every five minutes (2.18g).
  const fill = commands && redis.ms !== null ? await readFill(commands) : null;
  const { ok, text } = healthReport({
    redisConfigured: redis.configured,
    redisMs: redis.ms,
    googlePausedS: googlePausedFor(),
    googleFieldsBroken: fieldSearchKnownBroken(),
    fill,
  });
  // A list over its line: one mail a day, after the answer has left; the status above stays what the store made it.
  if (fill) for (const w of fillWarnings(fill)) later(() => sendAlert(`fill:${w.list}:${dayOf(new Date())}`, fillMail(w, fill)));
  return new Response(text, {
    status: ok ? 200 : 503,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
