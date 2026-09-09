import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CoverImage from '@/components/CoverImage';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { decadeLine, groupByDecade, worthAPage, MIN_COVERS, MIN_DECADES } from '@/lib/decades';
import { authorLine, SITE_URL } from '@/lib/seo';
import { getWorkDetail, isWorkId } from '@/lib/work';

/**
 * One book through the decades (ROADMAP 5.4a, PLAN-5 §3).
 *
 * The first of the generated page genres, and the reason it is first: it
 * needs **no model and no Google request**. Every line on it is counted from
 * edition records the site already loads for the wall, so there is nothing
 * here a script could not prove — which is the strictest possible reading of
 * PLAN-5's rule R1.
 *
 * **What it says that the work page does not** (R8): the wall groups covers
 * by language and hides the year in a caption; this groups them by the
 * decade of their earliest printing and counts what changed — how many
 * publishers, which format, how many languages. That is the product's
 * promise as a picture: one book, eight decades of faces.
 *
 * **Thin data makes no page** (R6): under 20 covers or 4 decades this is a
 * 404, not a thin page. And the footer says the page was generated and from
 * what (R10).
 *
 * The path is English, not the plan's `/jahrzehnte`: the interface is
 * English (E9) and the searches this is meant to meet are "gatsby book
 * covers over time".
 */
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function load(id: string) {
  if (!isWorkId(id)) return null;
  try {
    /*
      Three deliberate limits, all measured on 2026-09-09:
      - `googleBooks: false`, or a cold render spends a request of the daily
        thousand for data this page does not use (E10);
      - `dedupeCovers: false`, because folding downloads and hashes every
        cover server-side, which is seconds a page render cannot afford — the
        wall folds in the browser instead (SPEC §9.3 step 11);
      - 600 records, the same cap the candidate scan used, so a work cannot
        qualify there and come up short here.
    */
    const detail = await getWorkDetail(id, { maxEntries: 600, dedupeCovers: false, googleBooks: false });
    if (!detail) return null;
    const decades = groupByDecade(detail.covers, detail.editions);
    return { work: detail.work, editions: detail.editions, decades };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded || !worthAPage(loaded.decades)) return {};
  const { work, decades } = loaded;
  const author = authorLine(work.authors);
  const title = `${work.title} covers by decade`;
  const description =
    `${decades.coverCount} covers of ${work.title}${author ? ` by ${author}` : ''}, grouped by the decade of the printing they belong to` +
    `${decades.from && decades.to ? `, from the ${decades.from}s to the ${decades.to}s` : ''}. Counted from Open Library edition records.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/book/${id}/decades` },
    openGraph: { type: 'article', title, description, url: `${SITE_URL}/book/${id}/decades` },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded || !worthAPage(loaded.decades)) notFound();
  const { work, editions, decades } = loaded;
  const author = authorLine(work.authors);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        left={
          <Link href={`/book/${id}`} className="rounded-md py-1 pr-2 text-sm text-ink-2 transition-colors hover:text-ink">
            ← The wall
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">
          {work.title} <em className="text-accent">by decade</em>
        </h1>
        <p className="mt-2 text-ink-2">{author}</p>
        <p className="mt-1 text-sm text-ink-3">
          {decades.coverCount} covers from {editions.length.toLocaleString('en')} edition records
          {decades.from && decades.to ? `, ${decades.from}s to ${decades.to}s` : ''}
        </p>

        <div className="mt-10 space-y-12">
          {decades.groups.map(group => (
            <section key={group.decade}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line pb-2">
                <h2 className="font-display text-2xl text-ink">{group.decade}s</h2>
                <p className="text-sm text-ink-3">{decadeLine(group)}</p>
              </div>
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
                {group.covers.map(cover => (
                  <li key={cover.id}>
                    <Link href={`/book/${id}?cover=${encodeURIComponent(cover.id)}`} className="group block">
                      <div className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 group-hover:-translate-y-1">
                        <CoverImage src={cover.urlSmall ?? cover.url} alt="" sizes="(max-width: 640px) 30vw, 15vw" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {decades.undated.length > 0 && (
            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line pb-2">
                <h2 className="font-display text-2xl text-ink">No year on record</h2>
                <p className="text-sm text-ink-3">{decades.undated.length} covers</p>
              </div>
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
                {decades.undated.map(cover => (
                  <li key={cover.id}>
                    <Link href={`/book/${id}?cover=${encodeURIComponent(cover.id)}`} className="group block">
                      <div className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 group-hover:-translate-y-1">
                        <CoverImage src={cover.urlSmall ?? cover.url} alt="" sizes="(max-width: 640px) 30vw, 15vw" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/*
          R10: the page says what it is and what it is made of. It also says
          what it is not — a decade here is the decade of the records that
          exist, and plenty of printings never reached a catalogue.
        */}
        <p className="mt-16 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">
          This page is assembled from Open Library edition records: a cover sits in the decade of the
          earliest printing that carries it, and every count above is counted, not estimated. Records
          without a year are shown at the end rather than left out. What is missing from the
          catalogues is missing here too, so this is a view of what was scanned, not of what was
          printed. Pages like this exist only where there are at least {MIN_COVERS} covers across{' '}
          {MIN_DECADES} decades. <Link href={`/book/${id}`} className="underline underline-offset-2 hover:text-accent">See the whole wall</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
