'use client';

import { useState, useSyncExternalStore } from 'react';

/**
 * The two things on a shared board that need the browser (ROADMAP 5.18b):
 * copying the link, and handing the picture itself to an app where the
 * browser can (phones: Instagram, WhatsApp, Messages take a picture, not a
 * link). The rest of the shared page is rendered on the server.
 */
export default function InspirationShareTools({ link, storyHref, text }: { link: string; storyHref: string; text: string }) {
  const [note, setNote] = useState('');
  // Only where the browser offers it; false on the server and at first paint.
  const canShare = useSyncExternalStore(() => () => {}, () => typeof navigator.canShare === 'function', () => false);

  async function sharePicture() {
    try {
      const blob = await (await fetch(storyHref)).blob();
      const file = new File([blob], 'books-that-inspired-me.jpg', { type: 'image/jpeg' });
      await navigator.share(navigator.canShare({ files: [file] }) ? { files: [file], text } : { text: `${text} ${link}` });
    } catch {
      // Closing the share sheet is not an error worth a sentence.
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {canShare && (
        <button type="button" onClick={sharePicture} className="btn">Share the picture…</button>
      )}
      <button
        type="button"
        // Say "copied" only when it was: a browser may refuse the clipboard, and the link stays readable either way.
        onClick={() => navigator.clipboard.writeText(link).then(() => setNote('Copied.'), () => setNote('Not copied — select it here:'))}
        className="btn"
      >
        Copy link
      </button>
      <span className="min-w-0 break-all text-sm text-ink-2" role="status">
        {note && <span className="mr-1 text-ink">{note}</span>}
        {link}
      </span>
    </div>
  );
}
