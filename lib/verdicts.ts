/**
 * The one place the buy-link verdicts are worded (SPEC §3 F2.9, §3 F6).
 *
 * The About page explains these sentences and the sidebar shows them. They
 * used to be written out twice, and they drifted: the page went on teaching
 * "Shops show this cover" months after that phrasing had been retired for
 * claiming more than is checked — while the paragraph below it said no shop
 * is contacted (found in the click-through of 2026-09-07).
 *
 * So both read from here. Changing a sentence changes it in both places, and
 * a new verdict state cannot be added without giving it words.
 *
 * What the verdicts rest on: no shop is ever asked. The retailer links are
 * URL templates built from the ISBN, and the only lookup is Google Books,
 * which carries the image out of the publisher's own metadata feed. Shops
 * usually draw on that same feed, which makes it good evidence for what will
 * arrive and no evidence at all about any particular shop's page.
 */
// Type-only, so nothing of works.ts reaches a bundle through this file.
import type { IsbnVerdict } from './works';

export type VerdictStatus = IsbnVerdict['status'];

/**
 * The sentence the reader sees for each state. Each is a full sentence and
 * names the publisher's image as the source, because that is as far as the
 * check reaches.
 */
export const VERDICT_LEAD: Record<VerdictStatus, string> = {
  verified: 'The publisher’s current image for this ISBN is this cover.',
  differs: 'The publisher’s current image for this ISBN is a different cover.',
  unknown: 'No current publisher image is on record for this ISBN.',
  pending: 'Checking which cover the publisher has registered for this ISBN…',
  unavailable: 'The catalogue that holds publishers’ current images did not answer.',
};

/** What each state means, for the About page's list. */
export const VERDICT_MEANING: Record<VerdictStatus, string> = {
  verified: 'The registered image matches the cover you picked, so a new copy should look like it.',
  differs:
    'The ISBN is right, but the printing you would receive probably looks like something else. The image is shown beside the note, and the search links move to the front so you can hunt the cover you actually chose.',
  unknown:
    'Common for older printings. It says nothing about whether a shop has the book, only that no image is filed under that number.',
  pending: 'The lookup is still running. It takes a second, and until it answers the page says nothing else.',
  unavailable:
    'Google Books was asked and stayed silent, which it does often enough to matter. Trying again later usually works, and the page says so rather than reporting the silence as "nothing known".',
};

/** Every state, in the order the About page lists them. */
export const VERDICT_ORDER: readonly VerdictStatus[] = ['verified', 'differs', 'unknown', 'pending', 'unavailable'];
