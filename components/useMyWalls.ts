'use client';

import { useCallback, useEffect, useState } from 'react';
import { addRequests } from '@/lib/walls/edit';
import type { PublicWall, Tile } from '@/lib/walls/model';

export interface MyWalls {
  visitor: string | null;
  walls: PublicWall[];
  /** False until the first answer, so a page does not flash "no walls". */
  loaded: boolean;
}

const EMPTY: MyWalls = { visitor: null, walls: [], loaded: false };

async function fetchMe(): Promise<MyWalls> {
  const res = await fetch('/api/walls/me', { cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as { visitor: string | null; walls: PublicWall[] };
  return { ...data, loaded: true };
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

  // Another component on the page changed a collection: take its answer, so a band and a menu agree.
  useEffect(() => {
    const onWall = (e: Event) => {
      const wall = (e as CustomEvent<PublicWall>).detail;
      setMe((m) => ({ ...m, walls: m.walls.some((w) => w.id === wall.id) ? m.walls.map((w) => (w.id === wall.id ? wall : w)) : [wall, ...m.walls] }));
    };
    window.addEventListener(WALL_EVENT, onWall);
    return () => window.removeEventListener(WALL_EVENT, onWall);
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

const WALL_EVENT = 'bb-wall-changed';

/** Tells every `useMyWalls` on the page that a collection changed (5.13m). */
export function announceWall(wall: PublicWall) {
  window.dispatchEvent(new CustomEvent(WALL_EVENT, { detail: wall }));
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `The request failed (${res.status}).`);
  return data;
}

/** A new collection of this browser's, with these covers (the first one also sets the visitor cookie). */
export async function createWall(title: string, tiles: Tile[] = []): Promise<PublicWall> {
  return (await postJson<{ wall: PublicWall }>('/api/walls', { title, tiles })).wall;
}

/**
 * Puts covers into a collection, as many requests as the route needs
 * (5.13m); covers already in it are not sent. Returns the collection as the
 * last answer had it, or unchanged when nothing was new.
 */
export async function addTiles(wall: PublicWall, tiles: readonly Tile[]): Promise<PublicWall> {
  let current = wall;
  for (const ops of addRequests(tiles, wall)) current = (await postJson<{ wall: PublicWall }>(`/api/walls/${wall.id}`, { ops })).wall;
  return current;
}
