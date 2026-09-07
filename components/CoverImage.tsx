'use client';

import { useState } from 'react';
import Image from 'next/image';

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

/**
 * Cover image that fades in when loaded and degrades to a quiet placeholder
 * on error. Open Library covers redirect to archive.org, which is slow under
 * load; a failed image must never show alt text in a grey box (SPEC §3 F4).
 */
export default function CoverImage({ src, alt, sizes, priority, fit = 'cover' }: CoverImageProps) {
  const [status, setStatus] = useState<{ src: string; state: 'loaded' | 'failed' } | null>(null);
  const loaded = status?.src === src && status.state === 'loaded';
  const failed = status?.src === src && status.state === 'failed';

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-2" role="img" aria-label={alt}>
        <svg className="h-7 w-7 text-ink-3/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={`cover-img ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${loaded ? 'is-loaded' : ''}`}
      unoptimized
      priority={priority}
      onLoad={() => setStatus({ src, state: 'loaded' })}
      onError={() => setStatus({ src, state: 'failed' })}
    />
  );
}
