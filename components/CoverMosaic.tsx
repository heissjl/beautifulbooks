'use client';

import CoverImage from './CoverImage';

interface CoverMosaicProps {
  /** Distinct cover URLs, at most four are shown (SPEC §3 F4). */
  coverUrls: string[];
  title: string;
}

const SIZES_FULL = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw';
const SIZES_HALF = '(max-width: 640px) 25vw, (max-width: 1024px) 16.5vw, 10vw';

function Cover({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  return (
    <div className="relative w-full h-full">
      <CoverImage src={src} alt={alt} sizes={sizes} />
    </div>
  );
}

export default function CoverMosaic({ coverUrls, title }: CoverMosaicProps) {
  const covers = coverUrls.slice(0, 4);

  if (covers.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-2">
        <svg className="h-10 w-10 text-ink-3/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
    );
  }

  if (covers.length === 1) {
    return <Cover src={covers[0]} alt={`${title} cover`} sizes={SIZES_FULL} />;
  }

  if (covers.length === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-0.5 bg-bg">
        {covers.map((src, i) => <Cover key={src} src={src} alt={`${title} edition ${i + 1}`} sizes={SIZES_HALF} />)}
      </div>
    );
  }

  if (covers.length === 3) {
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 bg-bg">
        <div className="relative row-span-2">
          <Cover src={covers[0]} alt={`${title} edition 1`} sizes={SIZES_HALF} />
        </div>
        {covers.slice(1).map((src, i) => <Cover key={src} src={src} alt={`${title} edition ${i + 2}`} sizes={SIZES_HALF} />)}
      </div>
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 bg-bg">
      {covers.map((src, i) => <Cover key={src} src={src} alt={`${title} edition ${i + 1}`} sizes={SIZES_HALF} />)}
    </div>
  );
}
