import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_MAX_AGE,
  hashAccount,
  ownerHashes,
  packPending,
  providerConfig,
  readSession,
  signinOptions,
  signinSecret,
  signSession,
  stateMatches,
  subjectFromIdToken,
  unpackPending,
} from '../walls/account';
import { pkcs8FromPem, redirectUri } from '../walls/oauth';
import { hashVisitor, isOwner, newVisitorId, newWall } from '../walls/owner';
import { safeBack, signinNoteText } from '../walls/signin';
import { memoryWallStore, wallsOfAll } from '../walls/store';
import { signinEnabled } from '../walls/switch';

const SECRET = 'x'.repeat(40);
const PHONE = newVisitorId(Buffer.alloc(16, 1));
const LAPTOP = newVisitorId(Buffer.alloc(16, 2));
const STRANGER = newVisitorId(Buffer.alloc(16, 3));
const GOOGLE = { GOOGLE_OAUTH_CLIENT_ID: 'id.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'shh' };

describe('sign-in switch (5.13h)', () => {
  it('follows the WALLS rule and needs walls on', () => {
    expect(signinEnabled({})).toBe(true);
    expect(signinEnabled({ VERCEL_ENV: 'production' })).toBe(false);
    expect(signinEnabled({ VERCEL_ENV: 'production', WALLS: 'on' })).toBe(false);
    expect(signinEnabled({ VERCEL_ENV: 'production', WALLS: 'on', WALLS_SIGNIN: 'on' })).toBe(true);
    expect(signinEnabled({ WALLS: 'off', WALLS_SIGNIN: 'on' })).toBe(false);
    expect(signinEnabled({ WALLS_SIGNIN: ' OFF ' })).toBe(false);
    expect(() => signinEnabled({ WALLS_SIGNIN: 'yes' })).toThrow(/WALLS_SIGNIN/);
  });

  it('shows a provider only with a secret and all of its credentials, Google first', () => {
    expect(signinOptions({ ...GOOGLE })).toEqual([]);
    expect(signinOptions({ ...GOOGLE, WALLS_SIGNIN_SECRET: 'short' })).toEqual([]);
    expect(signinOptions({ ...GOOGLE, WALLS_SIGNIN_SECRET: SECRET })).toEqual([{ id: 'google', label: 'Google' }]);
    expect(signinOptions({ ...GOOGLE, WALLS_SIGNIN_SECRET: SECRET, WALLS_SIGNIN: 'off' })).toEqual([]);
    const all = {
      ...GOOGLE,
      WALLS_SIGNIN_SECRET: SECRET,
      FACEBOOK_APP_ID: '1',
      FACEBOOK_APP_SECRET: '2',
      APPLE_SIGNIN_CLIENT_ID: 'app.beautifulcovers.signin',
      APPLE_SIGNIN_TEAM_ID: 'TEAM',
      APPLE_SIGNIN_KEY_ID: 'KEY',
    };
    expect(signinOptions(all).map((o) => o.id)).toEqual(['google', 'facebook']);
    expect(signinOptions({ ...all, APPLE_SIGNIN_PRIVATE_KEY: 'pem' }).map((o) => o.id)).toEqual(['google', 'apple', 'facebook']);
    expect(providerConfig('google', { GOOGLE_OAUTH_CLIENT_ID: 'id' })).toBeNull();
    expect(signinSecret({ WALLS_SIGNIN_SECRET: `  ${SECRET}  ` })).toBe(SECRET);
  });
});

describe('account hash', () => {
  it('depends on provider and subject and is not the subject', () => {
    const a = hashAccount('google', '1234');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('1234');
    expect(hashAccount('google', '1234')).toBe(a);
    expect(hashAccount('facebook', '1234')).not.toBe(a);
    expect(hashAccount('google', '12345')).not.toBe(a);
  });
});

describe('session cookie', () => {
  const session = { account: hashAccount('google', 'sub'), provider: 'google' as const, issuedAt: 1_800_000_000 };

  it('reads back what it signed, holds no raw id', () => {
    const token = signSession(session, SECRET);
    expect(readSession(token, SECRET, session.issuedAt + 10)).toEqual(session);
    expect(Buffer.from(token.split('.')[0], 'base64url').toString()).not.toContain('sub"');
  });

  it('refuses a forged, re-signed, expired or malformed cookie, and every cookie without a secret', () => {
    const token = signSession(session, SECRET);
    const other = signSession({ ...session, account: hashAccount('google', 'someone else') }, SECRET);
    expect(readSession(`${other.split('.')[0]}.${token.split('.')[1]}`, SECRET, session.issuedAt)).toBeNull();
    expect(readSession(signSession(session, 'y'.repeat(40)), SECRET, session.issuedAt)).toBeNull();
    expect(readSession(token, SECRET, session.issuedAt + ACCOUNT_MAX_AGE + 1)).toBeNull();
    expect(readSession(token, SECRET, session.issuedAt - 3600)).toBeNull();
    expect(readSession(token, null, session.issuedAt)).toBeNull();
    expect(readSession('nonsense', SECRET)).toBeNull();
    expect(readSession(`${token}.x`, SECRET)).toBeNull();
    expect(readSession(undefined, SECRET)).toBeNull();
  });
});

describe('the sign-in in flight', () => {
  it('matches only the state it started with, for the same provider', () => {
    const pending = unpackPending(packPending({ provider: 'google', state: 'a'.repeat(32), verifier: 'v', back: '/c/abc' }));
    expect(pending?.back).toBe('/c/abc');
    expect(stateMatches(pending, 'google', 'a'.repeat(32))).toBe(true);
    expect(stateMatches(pending, 'google', 'b'.repeat(32))).toBe(false);
    expect(stateMatches(pending, 'google', 'a'.repeat(31))).toBe(false);
    expect(stateMatches(pending, 'apple', 'a'.repeat(32))).toBe(false);
    expect(stateMatches(null, 'google', 'a'.repeat(32))).toBe(false);
    expect(unpackPending('%%%')).toBeNull();
    expect(unpackPending(packPending({ provider: 'google', state: 'short', verifier: '', back: '/' }))).toBeNull();
  });

  it('sends the reader back to a path on this site only', () => {
    expect(safeBack('/c/abcdefghij')).toBe('/c/abcdefghij');
    expect(safeBack('/create')).toBe('/create');
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'c/x', '', null, '/a\nb', '/a\\b']) expect(safeBack(bad)).toBe('/create');
  });

  it('builds the redirect URL Julian registers', () => {
    expect(redirectUri('https://beautifulcovers.vercel.app', 'google')).toBe('https://beautifulcovers.vercel.app/api/walls/signin/google/callback');
    expect(redirectUri('http://localhost:3000', 'facebook')).toBe('http://localhost:3000/api/walls/signin/facebook/callback');
  });

  it('reads an Apple key with escaped newlines', () => {
    const body = Buffer.from('key bytes').toString('base64');
    expect(Buffer.from(pkcs8FromPem(`-----BEGIN PRIVATE KEY-----\\n${body}\\n-----END PRIVATE KEY-----`)).toString()).toBe('key bytes');
  });

  it('says a failure as one', () => {
    expect(signinNoteText('failed')).toMatch(/did not work/);
    expect(signinNoteText('cancelled')).toMatch(/cancelled/);
    expect(signinNoteText('other')).toBe('');
  });
});

describe('ID token', () => {
  const token = (claims: Record<string, unknown>) => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
  const check = { issuers: ['https://accounts.google.com', 'accounts.google.com'], audience: 'me' };
  const now = 1_800_000_000;

  it('takes the subject from a token for this app', () => {
    expect(subjectFromIdToken(token({ iss: 'https://accounts.google.com', aud: 'me', exp: now + 60, sub: '42', email: 'x@y' }), check, now)).toBe('42');
    expect(subjectFromIdToken(token({ iss: 'accounts.google.com', aud: ['me', 'other'], exp: now + 60, sub: '42' }), check, now)).toBe('42');
  });

  it('refuses another app’s, another issuer’s, an expired or a subjectless token', () => {
    expect(subjectFromIdToken(token({ iss: 'https://accounts.google.com', aud: 'them', exp: now + 60, sub: '42' }), check, now)).toBeNull();
    expect(subjectFromIdToken(token({ iss: 'https://evil.example', aud: 'me', exp: now + 60, sub: '42' }), check, now)).toBeNull();
    expect(subjectFromIdToken(token({ iss: 'https://accounts.google.com', aud: 'me', exp: now - 3600, sub: '42' }), check, now)).toBeNull();
    expect(subjectFromIdToken(token({ iss: 'https://accounts.google.com', aud: 'me', exp: now + 60 }), check, now)).toBeNull();
    expect(subjectFromIdToken('not a token', check, now)).toBeNull();
    expect(subjectFromIdToken(null, check, now)).toBeNull();
  });
});

describe('linking and ownership (E23)', () => {
  const account = hashAccount('google', 'julian');

  it('a signed-in browser owns the walls of every linked visitor, and only those', async () => {
    const store = memoryWallStore();
    const onPhone = newWall('phonewall1', PHONE, 'Phone', '2026-09-01T00:00:00Z');
    const onLaptop = newWall('laptopwal1', LAPTOP, 'Laptop', '2026-09-02T00:00:00Z');
    const theirs = newWall('strangers1', STRANGER, 'Theirs', '2026-09-03T00:00:00Z');
    for (const w of [onPhone, onLaptop, theirs]) {
      await store.put(w);
      await store.register(w);
    }

    // Sign in on the phone, then on the laptop: both visitors join the account.
    await store.link(account, hashVisitor(PHONE));
    await store.link(account, hashVisitor(LAPTOP));
    await store.link(account, hashVisitor(PHONE));
    const linked = await store.linked(account);
    expect(linked).toEqual([hashVisitor(PHONE), hashVisitor(LAPTOP)]);

    // On the laptop the phone's wall is now its to change, a stranger's is not.
    expect(isOwner(onPhone, LAPTOP)).toBe(false);
    expect(isOwner(onPhone, LAPTOP, linked)).toBe(true);
    expect(isOwner(theirs, LAPTOP, linked)).toBe(false);
    // A cleared browser with only the account cookie still owns them.
    expect(isOwner(onLaptop, null, linked)).toBe(true);
    // Without sign-in nothing changes (E22).
    expect(isOwner(onLaptop, LAPTOP)).toBe(true);
    expect(isOwner(onLaptop, STRANGER, [])).toBe(false);
    expect(isOwner(onLaptop, 'not an id', ['zz'])).toBe(false);

    const mine = await wallsOfAll(store, ownerHashes(hashVisitor(LAPTOP), linked));
    expect(mine.map((w) => w.id)).toEqual(['laptopwal1', 'phonewall1']);
  });

  it('another account links nothing of this one', async () => {
    const store = memoryWallStore();
    await store.link(account, hashVisitor(PHONE));
    expect(await store.linked(hashAccount('google', 'someone'))).toEqual([]);
    expect(ownerHashes(null, [])).toEqual([]);
    expect(ownerHashes('a', ['a', 'b'])).toEqual(['a', 'b']);
  });
});
