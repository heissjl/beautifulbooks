import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BookDetailPage from '@/components/BookDetail';
import { coverIdFromSegment } from '@/lib/coverurl';
import { workDescription, workPageTitle, workUrl } from '@/lib/seo';
import { getWorkPage, isWorkId } from '@/lib/work';

/**
 * The address a shared cover gets: `/book/<work>/cover/<cover>` (ROADMAP 6.20).
 *
 * **Why a route and not a query parameter.** The page already carries the
 * selection in `?cover=`, and the link a reader copies has always been right;
 * what was wrong is the *picture* a messenger shows beside it — the Open
 * Graph image is generated per route and never sees a query string. Reading
 * `searchParams` in `generateMetadata` would fix that and make every detail
 * page dynamic, giving up the 24-hour prerender for a preview. A second route
 * costs one file and keeps the page static.
 *
 * The body is the same client component; it takes the cover from the path
 * when there is one. The canonical points back at the plain work page, so two
 * addresses for the same wall do not compete in an index.
 */
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ id: string; coverId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, coverId } = await params;
  if (!isWorkId(id) || !coverIdFromSegment(coverId)) return {};
  let work;
  try {
    const page = await getWorkPage(id, { offset: 0, googleBooks: false });
    work = page?.work;
  } catch {
    return {};
  }
  if (!work) return {};

  const title = workPageTitle(work);
  const description = workDescription(work);
  return {
    title,
    description,
    // One wall, one address in an index: the share link is not a second page.
    alternates: { canonical: workUrl(work.id) },
    openGraph: { type: 'book', title, description, url: workUrl(work.id) },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function Page({ params }: PageProps) {
  const { id, coverId } = await params;
  if (!isWorkId(id) || !coverIdFromSegment(coverId)) notFound();
  return (
    <Suspense fallback={null}>
      <BookDetailPage />
    </Suspense>
  );
}
