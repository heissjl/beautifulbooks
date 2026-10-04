/**
 * What both local servers of lab/calibre share: answers, a small JSON body,
 * and the door (ROADMAP 5.16). The door is the Cockpit's (scripts/cockpit/guard.ts):
 * 127.0.0.1 only, a random token per run, writes only as JSON from the own page.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostAllowed, originAllowed, tokenMatches } from '../../scripts/cockpit/guard';

export function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  const payload = Buffer.isBuffer(body) ? body : type === 'application/json' ? JSON.stringify(body) : String(body);
  // Pictures do not change within a run (the page versions the address after a write); everything else is never cached.
  const image = type.startsWith('image/');
  res.writeHead(status, { 'content-type': image ? type : `${type}; charset=utf-8`, 'cache-control': image ? 'private, max-age=3600' : 'no-store' });
  res.end(payload);
}

export async function jsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new SyntaxError('Too large.');
  }
  const parsed: unknown = raw ? JSON.parse(raw) : {};
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

/** Why a request may not pass, already answered — or null when it may. The page itself (`/`) needs no token: it holds no data. */
export function refused(req: IncomingMessage, res: ServerResponse, url: URL, port: number, token: string): boolean {
  if (!hostAllowed(req.headers.host, port)) {
    send(res, 403, { error: 'Wrong host.' });
    return true;
  }
  if (req.method === 'GET' && url.pathname === '/') return false;
  const given = req.headers['x-token'] ?? url.searchParams.get('t');
  if (!tokenMatches(typeof given === 'string' ? given : null, token)) {
    send(res, 403, { error: 'Open the address the terminal printed — it carries the token.' });
    return true;
  }
  if (req.method === 'POST') {
    if (!originAllowed(req.headers.origin, port)) {
      send(res, 403, { error: 'Wrong origin.' });
      return true;
    }
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) {
      send(res, 415, { error: 'Send JSON.' });
      return true;
    }
  }
  return false;
}
