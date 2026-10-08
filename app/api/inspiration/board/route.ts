import { NextRequest } from 'next/server';
import { measure } from '@/app/api/measure';
import { closed, DAY, json } from '@/app/api/inspiration/guard';
import { filledCount, parseBoard } from '@/lib/inspiration/board';
import { describeBoard } from '@/lib/inspiration/describe';

/**
 * GET /api/inspiration/board?b=… — the titles of a board that came with the
 * address (a reload, a pasted link). The address carries ids only; without
 * this the editor named a book "OL15297W". Up to nine Open Library requests
 * for works no list knows, each cached a day.
 */
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  measure('portrait', request);
  const refused = closed(request, 'inspiration');
  if (refused) return refused;
  const board = parseBoard(request.nextUrl.searchParams);
  if (filledCount(board) === 0) return json({ books: [], by: board.by, sub: board.sub });
  return json(await describeBoard(board), 200, DAY);
}
