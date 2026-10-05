import { NextRequest } from 'next/server';
import { afterReport, isWallId } from '@/lib/walls/model';
import { sendReportMail } from '@/lib/walls/notify';
import { json, openWalls, storeDown } from '../../guard';
import { measure } from '@/app/api/measure';

/**
 * POST /api/walls/<id>/report — anyone may flag a shown collection (ROADMAP
 * 5.13d). The first report mails Julian; the fifth takes the collection down
 * until he looks (Julian, 2026-09-28: „ab 1 meldung eine mail an mich, ab 5
 * vorerst runternehmen und in review so vermerken“). A count per collection;
 * nothing about who pressed it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  measure('walls', request);
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const { id } = await params;
  if (!isWallId(id)) return json({ error: 'No such collection.' }, 404);
  try {
    const wall = await open.store.get(id);
    if (!wall || wall.showcase !== 'shown') return json({ error: 'No such collection among readers’ collections.' }, 404);
    const reports = await open.store.report(id);
    const next = afterReport(wall, reports, new Date().toISOString());
    if (next !== wall) await open.store.put(next);
    const mail =
      reports === 1 || next !== wall
        ? await sendReportMail({ id, title: wall.title, reports, hidden: next !== wall, origin: request.nextUrl.origin })
        : 'not-due';
    // One unguarded line per report, like bb.google: the collection, the count, whether it went down and
    // whether a mail went out — nothing about who reported it. Without Resend this is the only trace.
    console.log(JSON.stringify({ bb: 'walls.report', id, reports, hidden: next !== wall, mail }));
    return json({ reported: true });
  } catch {
    return storeDown();
  }
}
