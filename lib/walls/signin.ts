/**
 * The optional sign-in for readers' collections (ROADMAP 5.13h, SPEC F9.11,
 * E23): what a page may know about it. Pure and client-safe; hashing, the
 * session cookie and the providers' credentials are in lib/walls/account.ts
 * and lib/walls/oauth.ts (server only).
 */
export type ProviderId = 'google' | 'apple' | 'facebook';

/** In the order the buttons stand: Google first (Julian, 2026-09-28). */
export const PROVIDER_ORDER: readonly ProviderId[] = ['google', 'apple', 'facebook'];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
};

export const isProviderId = (s: unknown): s is ProviderId => typeof s === 'string' && (PROVIDER_ORDER as readonly string[]).includes(s);

/** A button a page may show: sign-in is switched on and the provider has credentials. */
export interface SigninOption {
  id: ProviderId;
  label: string;
}

/** What a browser learns about its sign-in: which provider, nothing else. */
export interface AccountState {
  provider: ProviderId;
}

/** A readable cookie, one minute long, that tells the page a sign-in did not complete. */
export const SIGNIN_NOTE_COOKIE = 'bb_signin';
export type SigninNote = 'cancelled' | 'failed';

/** A failure is said as one (SPEC N12): never silently back to the buttons. */
export function signinNoteText(note: string | undefined): string {
  if (note === 'cancelled') return 'Sign-in was cancelled. Nothing changed.';
  if (note === 'failed') return 'Sign-in did not work this time. Nothing changed; your collections are still kept in this browser.';
  return '';
}

/**
 * Where to send the reader after signing in: a path on this site only, never
 * a full URL, so the sign-in cannot be used as an open redirect.
 */
export function safeBack(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 300) return '/create';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/create';
  for (const ch of raw) if (ch.charCodeAt(0) < 0x20 || ch === '\\') return '/create';
  return raw;
}
