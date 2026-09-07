import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BookDetailPage from '@/components/BookDetail';
import { CURATED_WORKS } from '@/lib/curated';
import type { Cover, Edition, Work } from '@/lib/model';
import { bookJsonLd, workDescription, workPageTitle, workUrl } from '@/lib/seo';
import { getWorkPage, isWorkId } from '@/lib/work';

/**
 * The work page (SPEC §3 F2, §10 D10).
 *
 * A server component for one reason: metadata. The interactive part is
 * `components/BookDetail.tsx` and is unchanged — the wall still loads its
 * edition pages in the browser. What the server adds is the part a crawler
 * or a chat window reads before any JavaScript runs: a title naming the
 * book, a description quoting the source's own edition count, a cover mosaic
 * as the Open Graph image, and schema.org data.
 *
 * Cost: the work record and page 0, both from Open Library and both cached.
 * `googleBooks: false` keeps the Google quota out of it entirely (§8.7).
 */
export const revalidate = 86400;

/** Prerender the works the home page already links to. */
export function generateStaticParams() {
  return CURATED_WORKS.map(w => ({ id: w.id }));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

async function loadWork(id: string): Promise<{ work: Work; covers: Cover[]; editions: Edition[] } | null> {
  if (!isWorkId(id)) return null;
  try {
    const page = await getWorkPage(id, { offset: 0, googleBooks: false });
    return page ? { work: page.work, covers: page.covers, editions: page.editions } : null;
  } catch {
    // Open Library is having a moment. The page still works, it just goes out
    // with the site's default metadata rather than none at all.
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const loaded = await loadWork(id);
  if (!loaded) return {};
  const { work } = loaded;

  const title = workPageTitle(work);
  const description = workDescription(work);
  return {
    title,
    description,
    alternates: { canonical: workUrl(work.id) },
    // og:image comes from opengraph-image.tsx, which draws the mosaic.
    openGraph: { type: 'book', title, description, url: workUrl(work.id) },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * Streamed separately so the page shell does not wait on Open Library, which
 * takes 2-7 s from Germany often enough to matter (SPEC §4 N3).
 */
async function WorkJsonLd({ id }: { id: string }) {
  const loaded = await loadWork(id);
  if (!loaded) return null;
  return (
    <script
      type="application/ld+json"
      // Built from our own types, never from anything a visitor typed.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd(loaded.work, loaded.covers, loaded.editions)) }}
    />
  );
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  if (!isWorkId(id)) notFound();

  return (
    <>
      <Suspense fallback={null}>
        <WorkJsonLd id={id} />
      </Suspense>
      <BookDetailPage />
    </>
  );
}
