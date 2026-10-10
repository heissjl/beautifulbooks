import { NextRequest } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { commandsFromEnv } from '@/lib/redis';
import { googlePausedFor } from '@/lib/googlequota';
import { fieldSearchKnownBroken } from '@/lib/googlefields';
import { healthReport } from '@/lib/health';

/**
 * GET /api/health — for the uptime monitor (ROADMAP 2.18g). `no-store`, plain
 * text, 200 with "status: ok" or 503 with "status: degraded". One GET on the
 * store, bounded at two seconds; the Google breakers read from memory; no
 * request to Open Library. See lib/health.ts for why.
 */
export const dynamic = 'force-dynamic';

const PROBE_MS = 2000;

async function probe(): Promise<{ configured: boolean; ms: number | null }> {
  const commands = commandsFromEnv();
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
  const redis = await probe();
  const { ok, text } = healthReport({
    redisConfigured: redis.configured,
    redisMs: redis.ms,
    googlePausedS: googlePausedFor(),
    googleFieldsBroken: fieldSearchKnownBroken(),
  });
  return new Response(text, {
    status: ok ? 200 : 503,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
