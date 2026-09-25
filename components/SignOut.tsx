'use client';

import { useRouter } from 'next/navigation';

/** Clears the suggestion cookie; the page then shows the password field again (ROADMAP 5.10b). */
export default function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/suggest/logout', { method: 'POST' }).catch(() => undefined);
        router.refresh();
      }}
      className="text-sm text-ink-3 underline underline-offset-4 hover:text-accent"
    >
      Sign out
    </button>
  );
}
