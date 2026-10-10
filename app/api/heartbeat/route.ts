import { NextRequest } from 'next/server';
import { commandsFromEnv } from '@/lib/redis';
import { googlePausedFor } from '@/lib/googlequota';
import { fieldSearchKnownBroken } from '@/lib/googlefields';
import { sendAlert } from '@/lib/alerts';
import { heartbeatMail } from '@/lib/heartbeat';
import { lastDays, summarizeClicks } from '@/lib/insights/model';
import { readDays } from '@/lib/insights/store';
import { summarizeBooks } from '@/lib/insights/visits';

/**
 * GET /api/heartbeat — called once a morning by Vercel Cron (`vercel.json`),
 * which sends `Authorization: Bearer $CRON_SECRET`. Without the variable the
 * route does nothing, so nobody else can make it mail Julian (ROADMAP 2.18g).
 * One mail per day at most, through `sendAlert`'s key `heartbeat:<day>`.
 */
export const dynamic = 'force-dynamic';

const PROBE_MS = 2000;

async function timed<T>(work: Promise<T>): Promise<{ value: T | null; ms: number | null }> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('late')), PROBE_MS); })]);
    return { value, ms: Date.now() - start };
  } catch {
    return { value: null, ms: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Not here.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const commands = commandsFromEnv();
  const [day] = lastDays(new Date(Date.now() - 86_400_000), 1);
  const probe = commands ? await timed(commands.get('health:probe')) : { value: null, ms: null };
  const [books, clicks] = await Promise.all([readDays([day], 'book', commands), readDays([day], 'clicks', commands)]);
  const mail = heartbeatMail({
    day,
    bookVisits: books.ok ? summarizeBooks(books.hashes).visits : null,
    shopClicks: clicks.ok ? summarizeClicks([day], clicks.hashes).total : null,
    redisMs: probe.ms,
    googlePausedS: googlePausedFor(),
    googleFieldsBroken: fieldSearchKnownBroken(),
  });
  const result = await sendAlert(`heartbeat:${day}`, mail);
  return new Response(`heartbeat ${day}: ${result}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
