'use client';

import { useSyncExternalStore } from 'react';

/**
 * Which collection this tab is editing (ROADMAP 5.13m, step 4): the editor
 * sets it, a book page reads it to show "Editing · <title> · Back to the
 * editor", "Stop editing" clears it. It lives in `sessionStorage`, never in
 * the address, so a shared book link carries nobody's editing state, and it
 * ends with the tab.
 */
const KEY = 'bb.wall.editing';
const EVENT = 'bb-wall-editing';

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(id: string | null) {
  try {
    if (id) sessionStorage.setItem(KEY, id);
    else sessionStorage.removeItem(KEY);
  } catch {
    // A private window without storage: the band simply does not show.
  }
  window.dispatchEvent(new Event(EVENT));
}

export const startEditing = (id: string) => write(id);
export const stopEditing = () => write(null);

/** The id of the collection this tab is editing, or null; null on the server. */
export function useEditingId(): string | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(EVENT, onChange);
      return () => window.removeEventListener(EVENT, onChange);
    },
    read,
    () => null,
  );
}
