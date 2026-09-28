import { NextRequest } from 'next/server';
import { clearAccount, json, openWalls, readJson } from '../guard';

/**
 * POST /api/walls/signout — deletes the sign-in cookie (5.13h). The visitor
 * cookie stays, so this browser keeps the collections its own visitor id made;
 * those made on other devices are no longer this browser's to change. There is
 * no session table, so there is nothing else to delete.
 */
export async function POST(request: NextRequest) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  if (!(await readJson(request))) return json({ error: 'Send JSON.' }, 415);
  return clearAccount(json({ account: null }));
}
