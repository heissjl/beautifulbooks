import { NextRequest, NextResponse } from 'next/server';
import { isWallId, toPublic, type Wall } from '@/lib/walls/model';
import { planPdf } from '@/lib/walls/planpdf';
import type { WallStore } from '@/lib/walls/store';
import { json, openWalls, storeDown } from '../../guard';

type Params = { params: Promise<{ id: string }> };

async function load(store: WallStore, id: string): Promise<Wall | null | 'down'> {
  try {
    return await store.get(id);
  } catch {
    return 'down';
  }
}

/**
 * GET /api/walls/<id>/plan?units=metric|imperial — the frame plan as a PDF
 * (ROADMAP 5.15): what a workshop needs to build the piece. Anyone who can
 * open the collection can have its plan; it says nothing the page does not.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const { id } = await params;
  if (!isWallId(id)) return json({ error: 'No such collection.' }, 404);
  const wall = await load(open.store, id);
  if (wall === 'down') return storeDown();
  if (!wall) return json({ error: 'No such collection.' }, 404);
  const units = request.nextUrl.searchParams.get('units') === 'imperial' ? 'imperial' : 'metric';
  const date = new Date().toISOString().slice(0, 10);
  const bytes = planPdf({ wall: toPublic(wall), units, date, url: `${request.nextUrl.origin}/c/${id}` });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="frame-plan-${id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
