/**
 * The password gate in front of the suggestion tool (ROADMAP 5.10a, SPEC F8.4).
 * Server only.
 *
 * One shared password for friends (`SUGGEST_PASSWORD`) and a second one for
 * Julian's local tool to read and decide the suggestions
 * (`SUGGEST_ADMIN_PASSWORD`). Without `SUGGEST_PASSWORD` the whole feature
 * does not exist: pages and routes answer 404.
 *
 * A correct password buys a cookie holding an expiry and an HMAC over it,
 * keyed by the password itself — so changing the password signs everybody
 * out, and the cookie says nothing about who holds it.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

type Env = Record<string, string | undefined>;

export const SESSION_COOKIE = 'bb_suggest';
export const SESSION_DAYS = 30;

export function suggestEnabled(env: Env = process.env): boolean {
  return Boolean(env.SUGGEST_PASSWORD?.trim());
}

/** Compared as hashes, so neither the length nor the content leaks through timing. */
function same(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function passwordMatches(given: unknown, env: Env = process.env): boolean {
  const expected = env.SUGGEST_PASSWORD?.trim();
  return Boolean(expected) && typeof given === 'string' && same(given.trim(), expected as string);
}

/** Julian's key for reading and deciding. Never the friends' password: it must be set on its own. */
export function adminMatches(given: string | null | undefined, env: Env = process.env): boolean {
  const expected = env.SUGGEST_ADMIN_PASSWORD?.trim();
  return Boolean(expected) && typeof given === 'string' && same(given.trim(), expected as string);
}

function mac(expires: number, env: Env): string {
  return createHmac('sha256', `suggest-session:${env.SUGGEST_PASSWORD ?? ''}`).update(String(expires)).digest('base64url');
}

export function sessionToken(now = Date.now(), env: Env = process.env): string {
  const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return `${expires}.${mac(expires, env)}`;
}

export function sessionValid(token: string | undefined, now = Date.now(), env: Env = process.env): boolean {
  if (!token || !suggestEnabled(env)) return false;
  const [raw, signature] = token.split('.');
  const expires = Number(raw);
  if (!Number.isInteger(expires) || expires < now || !signature) return false;
  const expected = mac(expires, env);
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Julian signed in as admin on /curate (ROADMAP 5.10g; Julian, 2026-09-25:
 * „add an option in the online version to publish a draft"). A second
 * cookie, signed with the admin password, so that changing either password
 * signs out only its own holders, and a friend's cookie can never pass for
 * Julian's. Admin days are fewer: this cookie can change the public site.
 */
export const ADMIN_COOKIE = 'bb_admin';
export const ADMIN_DAYS = 7;

function adminMac(expires: number, env: Env): string {
  return createHmac('sha256', `admin-session:${env.SUGGEST_ADMIN_PASSWORD ?? ''}`).update(String(expires)).digest('base64url');
}

export function adminSessionToken(now = Date.now(), env: Env = process.env): string {
  const expires = now + ADMIN_DAYS * 24 * 60 * 60 * 1000;
  return `${expires}.${adminMac(expires, env)}`;
}

export function adminSessionValid(token: string | undefined, now = Date.now(), env: Env = process.env): boolean {
  if (!token || !suggestEnabled(env) || !env.SUGGEST_ADMIN_PASSWORD?.trim()) return false;
  const [raw, signature] = token.split('.');
  const expires = Number(raw);
  if (!Number.isInteger(expires) || expires < now || !signature) return false;
  const expected = adminMac(expires, env);
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

