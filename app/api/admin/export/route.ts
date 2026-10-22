import { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { exportLines } from '@/lib/backup';
import { commandsFromEnv, missingStoreMessage } from '@/lib/redis';
import { SITE_URL } from '@/lib/seo';
import { ADMIN_COOKIE, adminMatches, adminTokenValid } from '@/lib/suggest/auth';
import { measure } from '@/app/api/measure';

/**
 * GET /api/admin/export[?all=1] — the store as a file (ROADMAP 2.11,
 * lib/backup.ts), streamed as JSON Lines. Julian only, like the analytics:
 * the admin cookie from /curate or the admin password as a bearer token;
 * anyone else gets 404 and pays from the login bucket. Not tied to the
 * friends' switch (`suggestEnabled`): a backup must not depend on a tool
 * being on.
 *
 * Streamed, because the store had 3.7 MB on 2026-10-05 and a function's
 * answer in one piece is capped at 4.5 MB on Vercel; a stream is not. The
 * file holds what readers typed and the hashes of their ids — it belongs on
 * Julian's disk, never in the repository and never in a chat.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NO_STORE = { 'Cache-Control': 'no-store' };

function isAdmin(request: NextRequest): boolean {
  return (
    adminTokenValid(request.cookies.get(ADMIN_COOKIE)?.value) ||
    adminMatches((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''))
  );
}

export async function GET(request: NextRequest) {
  measure('curate', request);
  if (!isAdmin(request)) {
    return rateLimited(request, 'login') ?? NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }
  const commands = commandsFromEnv();
  if (!commands) return NextResponse.json({ error: missingStoreMessage() }, { status: 503, headers: NO_STORE });
  const all = request.nextUrl.searchParams.get('all') === '1';
  const started = Date.now();
  const now = new Date();
  // Thirty seconds before the function's limit the walk stops with its cursor, rather than dying without a footer.
  const stop = () => Date.now() - started > (maxDuration - 30) * 1000;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const line of exportLines(commands, { now, origin: new URL(SITE_URL).host, all, stop })) {
          controller.enqueue(encoder.encode(line));
        }
      } catch (err) {
        // A footer that says so, never a file that looks whole (N12).
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'footer', keys: -1, complete: false, skipped: 0, other: [], error: message.slice(0, 200) })}\n`));
      }
      controller.close();
    },
  });
  const stamp = now.toISOString().replace(/[:T]/g, '-').slice(0, 16);
  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'content-disposition': `attachment; filename="bb-redis-${stamp}.jsonl"`,
      ...NO_STORE,
    },
  });
}
