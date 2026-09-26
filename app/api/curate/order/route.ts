import { NextRequest } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { readBody } from '@/app/api/versus/guard';
import { liveRecords, publishStoreFromEnv } from '@/lib/collections-live';
import { missingStoreMessage } from '@/lib/hotornot/store';
import { ADMIN_COOKIE, adminMatches, adminSessionValid, suggestEnabled } from '@/lib/suggest/auth';
import { json } from '../../suggest/guard';

/**
 * The order of the collections on the site, set by Julian (5.10h): the home
 * page shows the first four published ones in this order. Admin only.
 */
export async function POST(request: NextRequest) {
  if (!suggestEnabled()) return json({ error: 'Not found' }, 404);
  const admin =
    adminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value) ||
    adminMatches((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
  const limited = rateLimited(request, admin ? 'suggest' : 'login');
  if (limited) return limited;
  if (!admin) return json({ error: 'Only Julian can arrange the collections.' }, 403);
  const body = await readBody(request);
  if (!Array.isArray(body.slugs)) return json({ error: 'slugs needed' }, 400);
  const known = new Set((await liveRecords()).map(r => r.slug));
  const order = [...new Set(body.slugs.filter((s): s is string => typeof s === 'string' && known.has(s)))];
  const store = publishStoreFromEnv();
  if (!store) return json({ error: missingStoreMessage() }, 503);
  try {
    await store.setOrder(order);
    return json({ ok: true, order });
  } catch {
    return json({ error: 'The store did not answer. Try again in a moment.' }, 503);
  }
}
