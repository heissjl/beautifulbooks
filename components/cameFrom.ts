'use client';

import { useSyncExternalStore } from 'react';

/**
 * The wall a book page was opened from (Julian, 2026-10-03: „wenn man von
 * einer wand auf eine detailseite geschickt wird muss es eine möglichkeit
 * geben leichter zur wand zurückzukommen als nur über den browser
 * zurückbutton“). A tile on a wall notes its wall — where it is, what it is
 * called, which book it opens — and the book page's back link then names
 * that wall instead of "Home", and leads to the tile that was clicked.
 *
 * In `sessionStorage`, like the editing session beside it: a shared book
 * link carries nobody's way there, and it ends with the tab. It holds for
 * the one book the tile opened, so a book reached some other way later in
 * the same tab does not claim to have come from the wall.
 */
export interface CameFrom {
  /** The wall's address, with the anchor of the clicked tile. */
  href: string;
  /** What the back link says. */
  title: string;
  /** The book the tile opened (`/book/<workId>`). */
  workId: string;
}

const KEY = 'bb.from';

/** Called from a tile's click, before the navigation. */
export function rememberWall(from: CameFrom): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(from));
  } catch {
    // A private window without storage: the back link says "Home", as before.
  }
}

// The same string yields the same object, so the snapshot is stable between renders.
let lastRaw: string | null = null;
let lastValue: CameFrom | null = null;

function read(): CameFrom | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === lastRaw) return lastValue;
  lastRaw = raw;
  lastValue = null;
  if (raw) {
    try {
      const v = JSON.parse(raw) as Partial<CameFrom>;
      // Only an address on this site: the value is ours, but storage is not a place to trust blindly.
      if (typeof v.href === 'string' && v.href.startsWith('/') && !v.href.startsWith('//') && typeof v.title === 'string' && typeof v.workId === 'string') {
        lastValue = { href: v.href, title: v.title, workId: v.workId };
      }
    } catch {
      lastValue = null;
    }
  }
  return lastValue;
}

const subscribe = () => () => {};

/** The wall this book was opened from in this tab, or null; null on the server and for any other book. */
export function useCameFrom(workId: string | undefined): CameFrom | null {
  const from = useSyncExternalStore(subscribe, read, () => null);
  return from && workId && from.workId === workId ? from : null;
}

/** The anchor a tile carries so that the way back lands on it. */
export const tileAnchor = (workId: string, cover: string | number) => `t-${workId}-${String(cover).replace(/[^A-Za-z0-9_-]/g, '')}`;
