'use client';

import { useSyncExternalStore } from 'react';

/**
 * What a result card already knows about a work, handed to the detail page
 * through sessionStorage so the loading scene has a title and a hero cover
 * before any request returns (SPEC 8.1 loading scene).
 */
export interface WorkPreview {
  title: string;
  authors: string[];
  coverUrls: string[];
}

const PREFIX = 'bb:work:';
const EVENT = 'work-preview-change';

export function storeWorkPreview(workId: string, preview: WorkPreview): void {
  try {
    sessionStorage.setItem(PREFIX + workId, JSON.stringify(preview));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage unavailable: the page simply starts without a preview
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useWorkPreview(workId: string): WorkPreview | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => { try { return sessionStorage.getItem(PREFIX + workId) ?? ''; } catch { return ''; } },
    () => '',
  );
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof (parsed as WorkPreview).title === 'string') return parsed as WorkPreview;
  } catch {
    // ignore malformed storage
  }
  return undefined;
}
