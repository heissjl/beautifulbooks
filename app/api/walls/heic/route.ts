import { NextRequest, NextResponse } from 'next/server';
import { heicToJpeg } from '@/lib/walls/heicjpeg';
import { MAX_HEIC_BYTES, PHOTO_EDGE, looksLikeHeif } from '@/lib/walls/photofile';
import { json, openWalls } from '../guard';

/**
 * POST /api/walls/heic — an iPhone photo (HEIC) → the same photo as a JPEG,
 * already shrunk to the size the photo route reads (ROADMAP 6.74). Only for
 * browsers that cannot decode HEIC themselves (Chrome); Safari never calls
 * it. The photo is decoded in memory for this request and never written or
 * logged; the answer is the only copy.
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const open = openWalls(request, 'wallsHeic');
  if ('response' in open) return open.response;

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return json({ error: 'The photo was empty.' }, 400);
  if (bytes.length > MAX_HEIC_BYTES) return json({ error: 'The photo is too large.' }, 413);
  // By its first bytes, not its type: Chrome sends a .HEIC file without one.
  if (!looksLikeHeif(bytes.subarray(0, 12))) return json({ error: 'This is not a HEIC photo.' }, 415);
  let out;
  try {
    out = await heicToJpeg(bytes, PHOTO_EDGE);
  } catch {
    return json({ error: 'This HEIC photo could not be converted.' }, 422);
  }
  return new NextResponse(new Uint8Array(out.jpeg), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' } });
}
