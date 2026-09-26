/**
 * Production's collection layers, read once per Cockpit generation
 * (ROADMAP 6.54): the online drafts and — where production has the read
 * route — the publish switches and published drafts.
 *
 * Two requests, both GET, both with the admin password from the main
 * folder's `.env.local` as a bearer token, the way lab/collections/serve.ts
 * already asks. **Never in a loop**: repeated automated requests trip
 * Vercel's bot mitigation, which answers 403 and looks like an outage
 * (CLAUDE.md, ROADMAP 2.4). The server keeps the snapshot and re-reads only
 * when Julian presses the button, at most once a minute.
 */
import type { ContentOverrides, PublishOverrides } from '../../lib/collections';
import type { Draft } from '../../lib/curate/drafts';

export interface ProductionSnapshot {
  at: string;
  origin: string;
  drafts: Draft[] | null;
  content: ContentOverrides | null;
  switches: PublishOverrides | null;
  /** 'missing': production answers 404/405 — the read route is not deployed yet. */
  publishRoute: 'ok' | 'missing' | 'error' | 'skipped';
  /** Sentences, never a value. */
  notes: string[];
}

export function skippedSnapshot(origin: string, why: string): ProductionSnapshot {
  return { at: new Date().toISOString(), origin, drafts: null, content: null, switches: null, publishRoute: 'skipped', notes: [why] };
}

type Fetch = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;

export async function readProduction(origin: string, adminPassword: string | undefined, fetcher: Fetch = fetch): Promise<ProductionSnapshot> {
  if (!adminPassword) return skippedSnapshot(origin, 'SUGGEST_ADMIN_PASSWORD fehlt in der .env.local des Hauptordners — Produktion nicht gefragt.');
  const snap: ProductionSnapshot = { at: new Date().toISOString(), origin, drafts: null, content: null, switches: null, publishRoute: 'error', notes: [] };
  const headers = { authorization: `Bearer ${adminPassword}`, 'user-agent': 'beautifulbooks-cockpit' };
  try {
    const res = await fetcher(`${origin}/api/curate/drafts`, { headers, signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const body = (await res.json()) as { drafts?: Draft[] };
      snap.drafts = Array.isArray(body.drafts) ? body.drafts : null;
      if (!snap.drafts) snap.notes.push('Die Entwürfe kamen in unerwarteter Form.');
    } else {
      snap.notes.push(`Entwürfe: Produktion antwortete ${res.status}${res.status === 403 ? ' (Bot-Schutz oder falsches Passwort?)' : ''}.`);
    }
  } catch (e) {
    snap.notes.push(`Entwürfe: keine Antwort (${e instanceof Error ? e.name : 'Fehler'}).`);
  }
  try {
    const res = await fetcher(`${origin}/api/curate/publish`, { headers, signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const body = (await res.json()) as { switches?: PublishOverrides; content?: ContentOverrides };
      snap.switches = body.switches ?? {};
      snap.content = body.content ?? {};
      snap.publishRoute = 'ok';
    } else if (res.status === 405 || res.status === 404) {
      snap.publishRoute = 'missing';
      snap.notes.push('Produktion hat die Lese-Route GET /api/curate/publish noch nicht (sie liegt auf dem Cockpit-Branch, nicht deployt) — Schalter und veröffentlichte Entwürfe sind unbekannt.');
    } else {
      snap.notes.push(`Schalter: Produktion antwortete ${res.status}.`);
    }
  } catch (e) {
    snap.notes.push(`Schalter: keine Antwort (${e instanceof Error ? e.name : 'Fehler'}).`);
  }
  return snap;
}
