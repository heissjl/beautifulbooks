'use client';

import { useEffect, useRef, useState } from 'react';
import { coverPathSegment, coverUrlFor } from '@/lib/coverurl';

/**
 * Sharing a wall, or one cover of it (ROADMAP 6.20, 6.21).
 *
 * **Every entry is a plain link.** The embedded buttons the networks hand out
 * load their scripts and set their cookies on our page; that would end N11
 * and start a consent banner, for a service a URL performs just as well.
 * Nothing here is loaded from anywhere, nothing is set, and no network learns
 * of a reader who does not click.
 *
 * The address shared is `/book/<work>/cover/<cover>` once a cover is picked,
 * which is the route whose preview shows that cover instead of the general
 * mosaic. Without a selection it is the plain work page. The reader's own
 * search terms are left out of it on purpose.
 */
interface ShareMenuProps {
  workId: string;
  coverId?: string | null;
  title: string;
  author?: string;
  /** 'up' when the button sits at the bottom of the screen (the phone bar). */
  placement?: 'down' | 'up';
  compact?: boolean;
  /** Which edge the panel lines up with; 'left' for a button near the left of a phone screen. */
  align?: 'left' | 'right';
  /** The sentence that travels with the link, where the default does not fit (the cover game). */
  text?: string;
}

function shareUrlFor(workId: string, coverId: string | null | undefined): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return coverId
    ? `${origin}/book/${workId}/cover/${coverPathSegment(coverId)}`
    : `${origin}/book/${workId}`;
}

export default function ShareMenu({
  workId, coverId, title, author, placement = 'down', compact = false, align = 'right', text: ownText,
}: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const url = shareUrlFor(workId, coverId);
  const line = author ? `${title} by ${author}` : title;
  const text = ownText ?? (coverId ? `${line} — one of its covers` : line);
  const q = encodeURIComponent;
  const image = coverId ? coverUrlFor(coverId, 'L') : null;

  const links: Array<{ label: string; href: string }> = [
    // Pinterest first: a board of covers is what this site is, in someone
    // else's house. It is the only one that wants the image itself.
    {
      label: 'Pinterest',
      href: `https://pinterest.com/pin/create/button/?url=${q(url)}${image ? `&media=${q(image)}` : ''}&description=${q(text)}`,
    },
    { label: 'WhatsApp', href: `https://wa.me/?text=${q(`${text} ${url}`)}` },
    { label: 'Bluesky', href: `https://bsky.app/intent/compose?text=${q(`${text} ${url}`)}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${q(text)}&url=${q(url)}` },
    { label: 'E-mail', href: `mailto:?subject=${q(line)}&body=${q(`${text}\n\n${url}`)}` },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // No clipboard: the panel still shows the links, which is the point.
    }
  };

  const native = async () => {
    try {
      await navigator.share({ title: line, text, url });
      setOpen(false);
    } catch {
      // Cancelled or unsupported; the list below stays open.
    }
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        className={`btn ${compact ? 'py-1.5 text-xs' : 'py-1.5'}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(o => !o)}
      >
        {copied ? 'Link copied' : 'Share'}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} z-50 w-56 rounded-card border border-line bg-surface p-1.5 shadow-lg ${
            placement === 'up' ? 'bottom-full mb-2' : 'mt-2'
          }`}
        >
          <p className="px-2.5 pb-1.5 pt-1 text-xs text-ink-3">
            {coverId ? 'Shares this cover' : 'Shares this book'}
          </p>
          <button type="button" role="menuitem" className="share-item" onClick={copy}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button type="button" role="menuitem" className="share-item" onClick={native}>
              Share…
            </button>
          )}
          {links.map(l => (
            <a
              key={l.label}
              role="menuitem"
              className="share-item"
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
