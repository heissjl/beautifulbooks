/**
 * Signed pairs for the cover game (ROADMAP 5.8a). Server only.
 *
 * The server hands out each pair with a token, and a vote is only taken for a
 * pair it handed out, once. Without that, one request in a loop could vote
 * the same cover to the bottom a thousand times, and the board — which is the
 * whole point of the game — would measure a script instead of people.
 *
 * The token carries the pool, the two covers in the order shown, the second
 * it was issued and a random nonce: nothing about who asked (N11). The nonce
 * is what makes every hand-out its own token. Without it, two players shown
 * the same pair in the same order within the same second got the same token,
 * and the second vote was turned away as a double click — the first version
 * did exactly that, and a six-cover test game lost most of its votes to it.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** A pair left on screen for an hour is stale; long enough for a slow player, short enough to keep the claims small. */
export const PAIR_TTL_SECONDS = 60 * 60;
/** Clock skew tolerated between instances. */
const SKEW_SECONDS = 60;

function mac(secret: Buffer, pool: string, a: string, b: string, issued: number, nonce: string): string {
  return createHmac('sha256', secret).update(`${pool}|${a}|${b}|${issued}|${nonce}`).digest('base64url');
}

/** `<issued>.<nonce>.<mac>`; base64url never contains a dot. */
export function signPair(
  secret: Buffer, pool: string, a: string, b: string, now = Date.now(), nonce = randomBytes(9).toString('base64url'),
): string {
  const issued = Math.floor(now / 1000);
  return `${issued}.${nonce}.${mac(secret, pool, a, b, issued, nonce)}`;
}

export function verifyPair(secret: Buffer, pool: string, a: string, b: string, token: string, now = Date.now()): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [issuedRaw, nonce, given] = parts;
  const issued = Number(issuedRaw);
  if (!issuedRaw || !Number.isInteger(issued) || !nonce || !given) return false;
  const age = now / 1000 - issued;
  if (age < -SKEW_SECONDS || age > PAIR_TTL_SECONDS) return false;
  const x = Buffer.from(given);
  const y = Buffer.from(mac(secret, pool, a, b, issued, nonce));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** On `globalThis` for the reason given in store.ts: `next dev` keeps a copy of this module per bundle. */
const shared = globalThis as typeof globalThis & { __versusPairSecret?: Buffer };

/**
 * The signing key. Derived from the store's own token when there is one, so
 * every instance of a deployment signs alike without a variable of its own —
 * one secret fewer for Julian to set, and it rotates when the store's does.
 * Without a store (memory, `next dev`) a random key for this process, which
 * is as long-lived as the votes it protects.
 */
export function pairSecret(storeToken: string | undefined): Buffer {
  if (storeToken) return createHash('sha256').update(`versus-pair|${storeToken}`).digest();
  shared.__versusPairSecret ??= randomBytes(32);
  return shared.__versusPairSecret;
}
