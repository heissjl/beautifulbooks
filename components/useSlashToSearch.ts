'use client';

import { useEffect } from 'react';

/**
 * Pressing `/` anywhere on a page puts the cursor in the search field
 * (ROADMAP 6.68, from the review from outside: on a book or game page the
 * search is one magnifier away, on a desktop it is a field at the far right).
 *
 * Not while typing: a `/` in an input, a textarea, a select or an editable
 * element is a character. Not with a modifier either, so the browser's own
 * shortcuts keep working. The handler takes the key, so the slash does not
 * also land in the field it just focused.
 */
export function useSlashToSearch(focus: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focus]);
}

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
