/**
 * The local server's checks, pure so they are tested (ROADMAP 6.54).
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';

export function makeToken(): string {
  return randomBytes(24).toString('base64url');
}

export function tokenMatches(given: string | null | undefined, token: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only 127.0.0.1 or localhost on our port: a page that rebinds its own name to 127.0.0.1 is refused. */
export function hostAllowed(host: string | undefined, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

/** A POST may come from our own page or from no page at all (curl), never from another origin. */
export function originAllowed(origin: string | undefined, port: number): boolean {
  return origin === undefined || origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

export function shotFileName(route: string, width: number): string {
  const slug = route.replace(/^\/+|\/+$/g, '').replace(/[^\w]+/g, '-') || 'start';
  return `${slug}-${width}.png`;
}
