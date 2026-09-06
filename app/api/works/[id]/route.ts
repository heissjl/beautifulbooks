import { NextRequest, NextResponse } from 'next/server';
import { buyLinksFor } from '@/lib/buylinks';
import type { EditionView, LanguageGroup, Work } from '@/lib/model';
import { normalizeLanguageOption } from '@/lib/search';
import { getWorkDetail, isWorkId } from '@/lib/work';

/** Response shape of GET /api/works/[id]. */
export interface WorkDetailResponse {
  work: Work;
  editions: EditionView[];
  groups: Array<Omit<LanguageGroup, 'editions'> & { editionIds: string[] }>;
}

/**
 * GET /api/works/<OL work id>?lang=<iso|all>
 * 400 malformed id, 404 unknown work, 503 Open Library unreachable.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isWorkId(id)) {
    return NextResponse.json({ error: 'Malformed work id' }, { status: 400 });
  }
  const lang = normalizeLanguageOption(request.nextUrl.searchParams.get('lang'));
  try {
    const detail = await getWorkDetail(id, { preferredLanguage: lang === 'all' ? undefined : lang });
    if (!detail) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }
    const body: WorkDetailResponse = {
      work: detail.work,
      editions: detail.editions.map(e => ({ ...e, buyLinks: buyLinksFor(e) })),
      groups: detail.groups.map(g => ({ language: g.language, editionIds: g.editions.map(e => e.id) })),
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    });
  } catch {
    return NextResponse.json({ error: 'Book data source unavailable, try again shortly' }, { status: 503 });
  }
}
