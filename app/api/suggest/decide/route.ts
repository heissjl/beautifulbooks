import { NextRequest } from 'next/server';
import { readBody } from '@/app/api/versus/guard';
import { adminGate, json, storeDown } from '../guard';

/** Julian's local tool marks a suggestion taken over or declined; the first answer stays. */
export async function POST(request: NextRequest) {
  const gate = adminGate(request);
  if ('response' in gate) return gate.response;
  const body = await readBody(request);
  const id = typeof body.id === 'string' ? body.id : '';
  const decision = body.decision === 'taken' || body.decision === 'declined' ? body.decision : null;
  if (!/^[\w-]{4,16}$/.test(id) || !decision) return json({ error: 'id and decision (taken|declined) needed' }, 400);
  try {
    await gate.store.decide(id, decision);
  } catch {
    return storeDown();
  }
  return json({ ok: true });
}
