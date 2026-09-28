'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** The password field in front of the suggestion tool (ROADMAP 5.10a). */
export default function SuggestLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/suggest/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) return router.refresh();
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(res.status === 429 ? 'Too many tries. Wait a minute.' : (body.error ?? 'That did not work.'));
    } catch {
      setError('The site did not answer. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm">
      <label htmlFor="suggest-password" className="block text-sm text-ink-2">Password</label>
      <div className="mt-2 flex gap-2">
        <input
          id="suggest-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-accent focus:outline-none"
        />
        <button type="submit" disabled={busy || !password} className="rounded-md border border-line px-4 py-2 text-sm text-ink hover:border-accent hover:text-accent disabled:opacity-50">
          Enter
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-accent" role="alert">{error}</p>}
      <p className="mt-4 text-xs text-ink-3">
        Signing in sets one cookie that keeps you signed in for 30 days. It holds an expiry date and a signature, nothing about you.
      </p>
    </form>
  );
}
