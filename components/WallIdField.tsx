'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PublicWall } from '@/lib/walls/model';
import { PROVIDER_LABELS, SIGNIN_NOTE_COOKIE, signinNoteText, type AccountState, type SigninOption } from '@/lib/walls/signin';
import { fetchMe, postJson, type MyWalls } from './useMyWalls';

/** The note a failed sign-in left for this page (one minute), read once and deleted. */
function takeSigninNote(): string {
  const prefix = `${SIGNIN_NOTE_COOKIE}=`;
  const raw = document.cookie.split(/;\s*/).find((c) => c.startsWith(prefix));
  if (!raw) return '';
  document.cookie = `${SIGNIN_NOTE_COOKIE}=; Max-Age=0; path=/`;
  return signinNoteText(raw.slice(prefix.length));
}

/**
 * The footer field from taketest.xyz (E22): your ID, and a Save button that
 * makes this browser the visitor whose ID was pasted. Below it the optional
 * sign-in (5.13h, SPEC F9.11): a button per configured provider, or which
 * provider this browser is signed in with and "Sign out".
 */
export default function WallIdField({ me, onChange, signin = [] }: { me: MyWalls; onChange: (me: MyWalls) => void; signin?: SigninOption[] }) {
  const pathname = usePathname();
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const value = draft ?? me.visitor ?? '';

  useEffect(() => {
    Promise.resolve().then(() => {
      const text = takeSigninNote();
      if (text) setNote(text);
    });
  }, []);

  async function save() {
    try {
      const data = await postJson<{ visitor: string; walls: PublicWall[]; account: AccountState | null }>('/api/walls/me', { visitor: value });
      onChange({ ...data, account: data.account ?? null, loaded: true });
      setDraft(null);
      const owner = data.account ? 'this ID and your account' : 'this ID';
      setNote(data.walls.length === 1 ? `1 collection belongs to ${owner}.` : `${data.walls.length} collections belong to ${owner}.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  async function signOut() {
    try {
      await postJson('/api/walls/signout', {});
      onChange(await fetchMe());
      setNote('Signed out. This browser keeps the collections its own ID made.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  const back = pathname || '/create';

  return (
    <section className="mt-16 border-t border-line pt-6" aria-labelledby="wall-id">
      <h2 id="wall-id" className="text-sm font-medium text-ink">Your ID</h2>
      <p className="mt-1 max-w-2xl text-xs text-ink-3">
        Your collections belong to this ID, kept in a cookie in this browser. To work on them on another device, paste it there and press Save.
        Anyone with it can change your collections, so keep it to yourself.
      </p>
      <div className="mt-3 flex max-w-xl gap-2">
        <input
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Comes with your first collection"
          spellCheck={false}
          autoComplete="off"
          aria-label="Your ID"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(value.trim()).then(
              () => setNote('Copied.'),
              () => setNote('Copying did not work here; select the ID and copy it by hand.'),
            )
          }
          disabled={!value.trim()}
          className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!value.trim()}
          className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent disabled:opacity-40"
        >
          Save
        </button>
      </div>

      {me.account ? (
        <p className="mt-4 text-xs text-ink-2">
          Signed in with {PROVIDER_LABELS[me.account.provider]} ·{' '}
          <button type="button" onClick={signOut} className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
            Sign out
          </button>
        </p>
      ) : (
        signin.length > 0 && (
          <div className="mt-5">
            <p className="text-sm text-ink">Or sign in to keep your collections across devices</p>
            <p className="mt-1 max-w-2xl text-xs text-ink-3">
              No password: an account you already have. Signing in on a device that already has collections moves them onto the account.
              We keep a one-way hash of the account’s number and nothing else — no email address, no name, no picture.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {signin.map((p) => (
                <a
                  key={p.id}
                  href={`/api/walls/signin/${p.id}?back=${encodeURIComponent(back)}`}
                  className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent"
                >
                  Continue with {p.label}
                </a>
              ))}
            </div>
          </div>
        )
      )}
      {note && <p className="mt-2 text-xs text-ink-2" role="status">{note}</p>}
    </section>
  );
}
