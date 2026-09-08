'use client';

import { useEffect, useState } from 'react';
import type { SimilarResponse } from '@/app/api/similar/[coverId]/route';

/**
 * Covers elsewhere that look like the selected one (ROADMAP 6.10).
 *
 * Asked only when a cover is selected, and answered from the built index, so
 * this costs no external request and no quota. An unknown cover comes back as
 * an empty list and the section simply does not appear — the index holds
 * fifty works, and silence is the honest form of "not indexed".
 */
export function useSimilarCovers(coverId: string | null): SimilarResponse['covers'] {
  const [state, setState] = useState<{ key: string; covers: SimilarResponse['covers'] } | null>(null);

  useEffect(() => {
    if (!coverId) return;
    const controller = new AbortController();
    fetch(`/api/similar/${encodeURIComponent(coverId)}`, { signal: controller.signal })
      .then(res => (res.ok ? res.json() : null))
      .then((body: SimilarResponse | null) => {
        if (body) setState({ key: coverId, covers: body.covers });
      })
      .catch(() => {
        // Nothing to say: the section stays away rather than showing an error
        // for a feature nobody asked for.
      });
    return () => controller.abort();
  }, [coverId]);

  return state?.key === coverId ? state.covers : [];
}
