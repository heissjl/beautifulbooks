'use client';

import { useState } from 'react';
import Image from 'next/image';

interface CoverImageProps {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}

/**
 * Cover image with a quiet fallback. Open Library's cover server rate-limits
 * and times out under load; a failed image must not show alt text in a grey
 * box (SPEC §3 F4). On error the slot renders as a soft placeholder.
 */
export default function CoverImage({ src, alt, sizes, priority }: CoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200" role="img" aria-label={alt}>
        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
      className="object-cover"
      unoptimized
      priority={priority}
      onError={() => setFailedSrc(src)}
    />
  );
}
