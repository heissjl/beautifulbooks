/**
 * Covers chosen and not written yet (lab/calibre, ROADMAP 5.16a).
 *
 * Julian, 2026-10-05, of the two buttons „Write to Calibre" and „Write to the
 * PocketBook": „aber ich will die möglichkeit auch für den ganzen batch".
 * So a cover can be chosen without being written: book number -> the cover,
 * kept in a file beside the backups. The overview shows the batch first and
 * writes all of it to Calibre or to the reader's shelves on one push each.
 *
 * A choice leaves the batch when the book's cover is written to Calibre —
 * from then on the book is one of those „changed here" — or when Julian
 * removes it. Written to the reader alone, it stays: Calibre has not got it.
 * Pure; the file is a `FileMap`, whose values are strings.
 */
export interface Choice {
  coverId: string;
  /** Julian saw that this cover has fewer pixels than the one in Calibre, and chose it all the same. */
  smaller?: true;
}

const COVER_ID = /^(ol:\d{1,12}|gb:[A-Za-z0-9_-]{1,40})$/;

export const writeChoice = (choice: Choice): string => JSON.stringify({ coverId: choice.coverId, ...(choice.smaller ? { smaller: true } : {}) });

/** The choice a file entry holds, or null for anything that is not one — a file edited by hand must not send a made-up id to the image host. */
export function readChoice(entry: string | undefined): Choice | null {
  if (!entry) return null;
  try {
    const value = JSON.parse(entry) as { coverId?: unknown; smaller?: unknown };
    if (typeof value.coverId !== 'string' || !COVER_ID.test(value.coverId)) return null;
    return { coverId: value.coverId, ...(value.smaller === true ? { smaller: true as const } : {}) };
  } catch {
    return null;
  }
}
