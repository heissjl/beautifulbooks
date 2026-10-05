'use client';

import { useState, useSyncExternalStore } from 'react';

/**
 * The two things on a shared board that need the browser (ROADMAP 5.18b):
 * handing the picture itself to an app where the browser can (phones:
 * Instagram, WhatsApp and Messages take a picture, not a link), and copying
 * the link. The rest of the shared page is rendered on the server.
 */
export function SharePicture({ storyHref, link, text }: { storyHref: string; link: string; text: string }) {
  // Only where the browser offers it; false on the server and at first paint.
  const canShare = useSyncExternalStore(() => () => {}, () => typeof navigator.canShare === 'function', () => false);
  if (!canShare) return null;

  async function share() {
    try {
      const blob = await (await fetch(storyHref)).blob();
      const file = new File([blob], 'books-that-inspired-me.jpg', { type: 'image/jpeg' });
      await navigator.share(navigator.canShare({ files: [file] }) ? { files: [file], text } : { text: `${text} ${link}` });
    } catch {
      // Closing the share sheet is not an error worth a sentence.
    }
  }
  return <button type="button" onClick={share} className="btn">Share the picture…</button>;
}

/** A link as a line can hold it: a board without a short link is some 190 characters of address. */
function shown(link: string): string {
  const bare = link.replace(/^https?:\/\//, '');
  return bare.length > 56 ? `${bare.slice(0, 48)}…` : bare;
}

export function CopyLink({ link }: { link: string }) {
  const [note, setNote] = useState('');
  return (
    <>
      <button
        type="button"
        // Say "copied" only when it was: a browser may refuse the clipboard, and then the whole link is shown to select.
        onClick={() => navigator.clipboard.writeText(link).then(() => setNote('copied'), () => setNote('refused'))}
        className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink hover:border-accent hover:text-accent"
      >
        Copy link
      </button>
      <span className="min-w-0 text-sm text-ink-3" role="status">
        {note === 'copied' && <span className="mr-1 text-ink">Copied.</span>}
        {note === 'refused' ? <span className="break-all"><span className="mr-1 text-ink">Not copied — select it here:</span>{link}</span> : shown(link)}
      </span>
    </>
  );
}
