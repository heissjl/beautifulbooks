'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PublicWall } from '@/lib/walls/model';
import type { AccountState } from '@/lib/walls/signin';

export interface MyWalls {
  visitor: string | null;
  walls: PublicWall[];
  /** The optional sign-in (5.13h): which provider this browser is signed in with, or null. */
  account: AccountState | null;
  /** False until the first answer, so a page does not flash "no walls". */
  loaded: boolean;
}

const EMPTY: MyWalls = { visitor: null, walls: [], account: null, loaded: false };

export async function fetchMe(): Promise<MyWalls> {
  const res = await fetch('/api/walls/me', { cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as { visitor: string | null; walls: PublicWall[]; account?: AccountState | null };
  return { ...data, account: data.account ?? null, loaded: true };
}

/**
 * This browser's visitor id and walls (ROADMAP 5.13a, E22). A browser
 * without the cookie asks nothing: a reader who never made a wall costs no
 * request and is told nothing about walls.
 */
export function useMyWalls() {
  const [me, setMe] = useState<MyWalls>(EMPTY);

  const refresh = useCallback(() => {
    fetchMe().then(setMe, () => setMe((m) => ({ ...m, loaded: true })));
  }, []);

  useEffect(() => {
    if (document.cookie.split(/;\s*/).some((c) => c.startsWith('bb_visitor='))) {
      fetchMe().then(setMe, () => setMe((m) => ({ ...m, loaded: true })));
    } else {
      Promise.resolve().then(() => setMe((m) => ({ ...m, loaded: true })));
    }
  }, []);

  return { me, setMe, refresh };
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `The request failed (${res.status}).`);
  return data;
}
