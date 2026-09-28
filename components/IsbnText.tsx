import { isbnRuns } from '@/lib/isbnformat';

/**
 * The ISBN as the reader sees it: hyphenated, in the text face, with the
 * zeros and hyphens from the mono face (ROADMAP 6.61). Display only — every
 * link is built from the bare number. Shared by the book page and the list
 * of books a collection needs (5.13f).
 */
export default function IsbnText({ isbn }: { isbn: string }) {
  return (
    <>
      {isbnRuns(isbn).map((run, i) =>
        run.mono ? <span key={i} className="font-mono">{run.text}</span> : run.text,
      )}
    </>
  );
}
