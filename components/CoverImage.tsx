'use client';

import { useState } from 'react';
import Image from 'next/image';
import { proxiedCoverSrc, retryCoverSrc } from '@/lib/coverurl';

interface CoverImageProps {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  /**
   * `cover` fills the tile and crops what does not fit; `contain` fits the
   * whole cover inside it. Use `contain` wherever the tile is not roughly
   * 2:3, or the crop eats the book (SPEC §3 F4).
   */
  fit?: 'cover' | 'contain';
}

/** How long a failed cover waits before it is asked for once more. */
const RETRY_MS = 1500;

interface Status {
  src: string;
  /** 0 on the first request, 1 on the one retry. */
  attempt: 0 | 1;
  state: 'loading' | 'loaded' | 'failed';
}

/**
 * Cover image that fades in when loaded and degrades to a quiet placeholder
 * on error. Open Library covers redirect to archive.org, which is slow under
 * load; a failed image must never show alt text in a grey box (SPEC §3 F4).
 *
 * Every source goes through our own image route (`proxiedCoverSrc`, ROADMAP
 * 1.3), so the CDN answers the second reader and archive.org never sees this
 * one's IP. A URL the route cannot rebuild from an id is left alone and loads
 * directly, which is the safe direction to fail in.
 *
 * **A failure is asked about twice** (ROADMAP 6.31). On Julian's phone on
 * 2026-09-10 most of a wall stood as book symbols after twelve seconds, yet
 * tapping one opened the same cover at once in the sheet: one bad answer from
 * archive.org had emptied the tile for the whole visit. So the first error
 * waits a moment and asks again, under an address the browser has not seen
 * fail; only the second error shows the placeholder.
 */
export default function CoverImage({ src, alt, sizes, priority, fit = 'cover' }: CoverImageProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const href = proxiedCoverSrc(src);
  // Keyed by the address, so a new `src` starts over without an effect.
  const current: Status = status?.src === href ? status : { src: href, attempt: 0, state: 'loading' };

  if (current.state === 'failed') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-2" role="img" aria-label={alt}>
        <svg className="h-7 w-7 text-ink-3/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
    );
  }

  const onError = () => {
    if (current.attempt === 1) {
      setStatus({ ...current, state: 'failed' });
      return;
    }
    window.setTimeout(() => {
      // Only if the tile still shows this cover; a new `src` has moved on.
      setStatus(prev => (prev && prev.src !== href ? prev : { src: href, attempt: 1, state: 'loading' }));
    }, RETRY_MS);
  };

  return (
    <Image
      // A new element for the retry, so the browser really asks again.
      key={current.attempt}
      src={current.attempt === 0 ? href : retryCoverSrc(href)}
      alt={alt}
      fill
      sizes={sizes}
      className={`cover-img ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${current.state === 'loaded' ? 'is-loaded' : ''}`}
      unoptimized
      priority={priority}
      onLoad={() => setStatus({ ...current, state: 'loaded' })}
      onError={onError}
    />
  );
}
