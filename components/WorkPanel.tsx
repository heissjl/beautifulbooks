'use client';

/**
 * The second column before the reader has picked a cover (ROADMAP 1.1).
 *
 * Until 2026-09-09 the column showed an edition nobody had chosen. Now it has
 * two jobs, and the split is what makes the change work: nothing picked yet
 * shows *the work*, a cover picked shows *that edition*. So the column is
 * never empty, the layout never jumps, and no Google request is spent on a
 * reader who only looks at the wall.
 *
 * Everything here is counted from editions already loaded — no source is
 * asked anything for this panel.
 */
import type { Edition, Work } from '@/lib/model';
import { blurbFor, editionSpan } from '@/lib/works';
import { languageName } from '@/lib/normalize';

interface WorkPanelProps {
  work: Work;
  editions: readonly Edition[];
  /** The language the reader searched in, if any. */
  language?: string;
  /**
   * Are enough pages in to state a span? Editions arrive newest-record first,
   * so after one page Wolf Hall would claim "2009 to 2020" and correct itself
   * a moment later. The caller says when the numbers have stopped moving.
   */
  settled: boolean;
}

export default function WorkPanel({ work, editions, language, settled }: WorkPanelProps) {
  const blurb = blurbFor(editions, language);
  const span = settled ? editionSpan(editions) : null;

  return (
    <div>
      <p className="kicker">This book</p>

      {span && (
        /*
          Two numbers the page states nowhere else: the meta line above counts
          covers and records checked, not the stretch of time or the spread
          over publishers — which is what a wall of covers is actually about.
          "here" is literal: both numbers describe the editions loaded, not
          everything ever printed (SPEC §4 N12).
        */
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{span}</p>
      )}

      {blurb && (
        <div className="mt-5">
          <p className="line-clamp-[10] text-sm leading-relaxed text-ink-2">{blurb.text}</p>
          {/*
            A blurb is publisher copy for one edition, not a description of the
            work, so it is attributed. When it is not in the language the
            reader asked for, the language is named rather than left to puzzle
            over (the Wolf Hall case: the longest blurb is Portuguese).
          */}
          <p className="mt-2 text-xs text-ink-3">
            Description from the {[blurb.edition.publisher, blurb.edition.year].filter(Boolean).join(' ') || 'unnamed'} edition
            {language && blurb.edition.language && blurb.edition.language !== language
              ? `, in ${languageName(blurb.edition.language)}`
              : ''}
            , via {blurb.edition.source === 'openlibrary' ? 'Open Library' : 'Google Books'}.
          </p>
        </div>
      )}

      {/*
        Last and quiet: nobody standing in front of a wall of covers needs to
        be told that covers can be clicked. The line answers what happens
        after the click, which is the part that is not visible.
      */}
      <p className="mt-6 text-sm leading-relaxed text-ink-3">
        Pick a cover to see the edition it belongs to, its ISBN and where to find a copy.
      </p>

      {/*
        Open Library is a wiki, and some of what this page shows is wrong there
        — Gatsby is dated 1920. This is the only place a reader is told where
        the record lives and that it can be corrected; until now the address
        existed only inside the JSON-LD.
      */}
      <p className="mt-6 border-t border-line pt-4 text-xs text-ink-3">
        <a
          href={`https://openlibrary.org/works/${work.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          This book at Open Library
        </a>
        {' — where these records come from, and where they can be corrected.'}
      </p>
    </div>
  );
}
