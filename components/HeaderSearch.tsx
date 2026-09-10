'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRecentSearches } from './useRecentSearches';

/**
 * A search field in the header, on every page that is not the search itself
 * (ROADMAP 6.28).
 *
 * Julian asked for it so a new search does not need a trip back to the home
 * page. The larger gain is one he did not ask for: the header is `sticky`, so
 * this is reachable from the middle of a wall of 300 covers without scrolling
 * back a hundred rows, and it stays usable while a wall is still loading.
 *
 * **One input, not two.** On wide screens the form is shown by CSS alone, so
 * it is there before any JavaScript runs and cannot flash. On a phone it is
 * hidden and a magnifier opens it *over* the header row — the same element,
 * a different position, never a second copy with the same label for a screen
 * reader to read out twice.
 *
 * **No language pills.** They belong beside the big field on the home page;
 * in a header they would be a second row for a setting that does nothing on a
 * detail page. An existing `?lang=` is carried along all the same: the search
 * page shows the matching pill on arrival, so nothing is applied invisibly.
 *
 * The component takes no props and reads no search params during render, so a
 * static page keeps being static when it carries one.
 */
export default function HeaderSearch() {
  const router = useRouter();
  const [, saveRecentSearch] = useRecentSearches();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);

  /*
    The field is `display: none` until `open` flips, and an element that is not
    displayed cannot take focus — a `requestAnimationFrame` right after the
    click fired too early and left the cursor nowhere (measured 2026-09-10).
    An effect runs after the class has landed. It sets no state, so the repo's
    set-state-in-effect rule is not in play.
  */
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;
    saveRecentSearch(q);
    const next = new URLSearchParams({ q });
    /*
      Read from the address, not from `useSearchParams`. The hook would opt
      every page carrying this field out of static rendering — about, privacy,
      contact, the decade pages — and the build says so outright
      ("useSearchParams() should be wrapped in a suspense boundary"). The
      value is only ever needed inside this handler, which never runs on the
      server, so there is nothing to read during render.
    */
    const lang = new URLSearchParams(window.location.search).get('lang');
    if (lang) next.set('lang', lang);
    setOpen(false);
    setValue('');
    input.current?.blur();
    router.push(`/?${next}`);
  };

  return (
    <>
      {/* Only ever on a phone, and gone once the field is open. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-1.5 text-ink-2 transition-colors hover:text-ink sm:hidden"
          aria-label="Search for a book"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      )}

      <form
        onSubmit={submit}
        role="search"
        /*
          Open on a phone: laid over the header's own row, which is why
          SiteHeader is `relative`. From `sm` up the classes below take over
          and it is simply a field in the row, whatever `open` says.
        */
        className={`items-center gap-2 ${
          open
            ? 'absolute inset-x-0 top-0 z-10 flex h-14 bg-bg px-4 sm:static sm:h-auto sm:bg-transparent sm:px-0'
            : 'hidden sm:flex'
        }`}
      >
        <div className="relative flex-1 sm:flex-none">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={input}
            type="search"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); input.current?.blur(); } }}
            placeholder="Search a book"
            aria-label="Search a book title"
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 transition-colors focus:border-ink-3 focus:outline-none sm:w-44 lg:w-56"
          />
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); setValue(''); }}
          className="rounded-md px-1 py-1 text-sm text-ink-2 transition-colors hover:text-ink sm:hidden"
        >
          Cancel
        </button>
      </form>
    </>
  );
}
