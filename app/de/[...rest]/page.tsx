import { notFound } from 'next/navigation';

/**
 * An address the German tree has no page for. Without this file Next answered
 * such a rewrite with the root `not-found.tsx`, in English (measured in the
 * browser, 2026-10-02); a `notFound()` thrown inside the segment renders
 * `app/de/not-found.tsx` instead.
 */
export default function GermanCatchAll() {
  notFound();
}
