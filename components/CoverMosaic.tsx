'use client';

import Image from 'next/image';
import type { BookEdition } from '@/types/book';

interface CoverMosaicProps {
  editions: BookEdition[];
  title: string;
}

export default function CoverMosaic({ editions, title }: CoverMosaicProps) {
  const coversToShow = editions.slice(0, 4).filter(e => e.coverImage);

  if (coversToShow.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
        <svg
          className="w-12 h-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </div>
    );
  }

  if (coversToShow.length === 1) {
    return (
      <div className="relative w-full h-full">
        <Image
          src={coversToShow[0].coverImage!}
          alt={`${title} cover`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }

  if (coversToShow.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 w-full h-full bg-white">
        {coversToShow.map((edition, idx) => (
          <div key={idx} className="relative w-full h-full">
            <Image
              src={edition.coverImage!}
              alt={`${title} edition ${idx + 1}`}
              fill
              sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16.5vw, 10vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ))}
      </div>
    );
  }

  if (coversToShow.length === 3) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full bg-white">
        <div className="relative row-span-2">
          <Image
            src={coversToShow[0].coverImage!}
            alt={`${title} edition 1`}
            fill
            sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16.5vw, 10vw"
            className="object-cover"
            unoptimized
          />
        </div>
        {coversToShow.slice(1, 3).map((edition, idx) => (
          <div key={idx} className="relative">
            <Image
              src={edition.coverImage!}
              alt={`${title} edition ${idx + 2}`}
              fill
              sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16.5vw, 10vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full bg-white">
      {coversToShow.map((edition, idx) => (
        <div key={idx} className="relative">
          <Image
            src={edition.coverImage!}
            alt={`${title} edition ${idx + 1}`}
            fill
            sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16.5vw, 10vw"
            className="object-cover"
            unoptimized
          />
        </div>
      ))}
    </div>
  );
}
