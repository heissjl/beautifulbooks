'use client';

import CoverWall from './CoverWall';
import { useT } from './i18n';
import type { CuratedWork } from '@/lib/curated';

/**
 * Empty-state cover wall on the home page (SPEC §8.1). The works are the
 * hour's window of the curated pool, chosen on the server (`wallForHour`,
 * ROADMAP 6.17) and handed down, so the browser never picks its own.
 */
export default function CuratedWall({ works }: { works: CuratedWork[] }) {
  const t = useT();
  return (
    <section aria-labelledby="curated-heading">
      <div className="mb-5">
        <h2 id="curated-heading" className="text-2xl text-ink">{t('Start with a classic')}</h2>
      </div>
      <CoverWall works={works} />
    </section>
  );
}
