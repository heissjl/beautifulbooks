import { NextRequest } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { readBody } from '@/app/api/versus/guard';
import { collectionRecords, nextOverrides } from '@/lib/collections';
import { publishStoreFromEnv } from '@/lib/collections-live';
import { applyContent } from '@/lib/collections';
import { missingStoreMessage } from '@/lib/hotornot/store';
import { ADMIN_COOKIE, adminMatches, adminSessionValid, suggestEnabled } from '@/lib/suggest/auth';
import { json } from '../../suggest/guard';

/**
 * What the running site lays over the file: the publish switches and the
 * drafts published from /curate, and the order of the collections (5.10h)
 * (ROADMAP 6.54, the Cockpit's view of the
 * collection layers). Read-only and Julian only, like POST; the Cockpit asks
 * it once per generation with the admin password as a bearer token.
 */
export async function GET(request: NextRequest) {
  if (!suggestEnabled()) return json({ error: 'Not found' }, 404);
  const admin =
    adminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value) ||
    adminMatches((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
  const limited = rateLimited(request, admin ? 'suggest' : 'login');
  if (limited) return limited;
  if (!admin) return json({ error: 'Only Julian can read this.' }, 403);
  const store = publishStoreFromEnv();
  if (!store) return json({ error: missingStoreMessage() }, 503);
  try {
    const [switches, content, order] = await Promise.all([store.get(), store.getContent(), store.getOrder()]);
    return json({ switches, content, order });
  } catch {
    return json({ error: 'The store did not answer. Try again in a moment.' }, 503);
  }
}

/**
 * Publish or unpublish a collection of the file on the running site
 * (ROADMAP 5.10g; Julian, 2026-09-25: „add an option in the online version
 * to publish a draft"). Julian only: the admin cookie from /curate, or the
 * admin password as a bearer token from his local tool. A friend's cookie is
 * refused — publishing is the OK that SPEC F8.2 reserves for him.
 */
export async function POST(request: NextRequest) {
  if (!suggestEnabled()) return json({ error: 'Not found' }, 404);
  const admin =
    adminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value) ||
    adminMatches((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
  const limited = rateLimited(request, admin ? 'suggest' : 'login');
  if (limited) return limited;
  if (!admin) return json({ error: 'Only Julian can publish.' }, 403);
  const body = await readBody(request);
  // Julian's local tool, after taking a draft into the file: the file is the
  // source again, so the published draft for that address is dropped (5.10g).
  if (body.clearDraft === true && typeof body.slug === 'string') {
    const pub = publishStoreFromEnv();
    if (!pub) return json({ error: missingStoreMessage() }, 503);
    try {
      const content = await pub.getContent();
      if (body.slug in content) { delete content[body.slug]; await pub.setContent(content); }
      return json({ ok: true, cleared: body.slug });
    } catch {
      return json({ error: 'The store did not answer. Try again in a moment.' }, 503);
    }
  }
  const store0 = publishStoreFromEnv();
  const content = store0 ? await store0.getContent().catch(() => ({})) : {};
  // A published draft is the base the switch compares with, not the file (5.10g).
  const record = applyContent(collectionRecords(), content).find(r => r.slug === body.slug);
  if (!record || typeof body.published !== 'boolean') return json({ error: 'slug and published (true|false) needed' }, 400);
  const store = publishStoreFromEnv();
  if (!store) return json({ error: missingStoreMessage() }, 503);
  try {
    const next = nextOverrides(await store.get(), record, body.published);
    await store.set(next);
    return json({ ok: true, slug: record.slug, published: body.published, file: record.published, overrides: next });
  } catch {
    return json({ error: 'The store did not answer. Try again in a moment.' }, 503);
  }
}
