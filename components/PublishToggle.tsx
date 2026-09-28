'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Publish or unpublish a collection from /curate, for Julian signed in as
 * admin (ROADMAP 5.10g). Takes effect on the site at once, without a deploy.
 */
export default function PublishToggle({ slug, title, published }: { slug: string; title: string; published: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    const next = !published;
    if (!window.confirm(next ? `Publish „${title}" on the site now?` : `Take „${title}" off the site?`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/curate/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, published: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Not changed.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not changed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="rounded-md border border-line px-2 py-0.5 text-xs text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {busy ? '…' : published ? 'Unpublish' : 'Publish'}
      </button>
      {error && <span className="text-xs text-accent" role="alert">{error}</span>}
    </span>
  );
}
