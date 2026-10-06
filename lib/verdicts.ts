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
 * arrive and no evidence at all about any particular shop's page. When
 * Google cannot be asked, Open Library's record for the ISBN stands in
 * (ROADMAP 1.12) — a scan, not the publisher's word — and the four
 * `catalogue…` states say so in every sentence.
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
  uncompared: 'The publisher has an image for this ISBN, but it could not be compared with this cover.',
  unknown: 'No current publisher image is on record for this ISBN.',
  pending: 'Checking which cover the publisher has registered for this ISBN…',
  unavailable: 'The catalogue that holds publishers’ current images did not answer.',
  /*
    The fallback (ROADMAP 1.12): Google could not be asked, so Open Library's
    own record for the ISBN was. Every sentence opens with what was *not*
    checked, because a reader who skims to "this cover" must not take a
    catalogue scan for the publisher's word.
  */
  catalogueVerified: 'The publisher’s image could not be checked; Open Library’s record for this ISBN carries this cover.',
  catalogueDiffers: 'The publisher’s image could not be checked; Open Library’s record for this ISBN carries a different cover.',
  catalogueUncompared: 'The publisher’s image could not be checked; Open Library has a cover for this ISBN, but it could not be compared with this one.',
  catalogueUnknown: 'The publisher’s image could not be checked, and Open Library has no cover on record for this ISBN.',
};

/** What each state means, for the About page's list. */
export const VERDICT_MEANING: Record<VerdictStatus, string> = {
  verified: 'A new copy should look like the cover you picked.',
  differs: 'A new copy probably looks different. The publisher’s image is shown, and searches for your cover move to the front.',
  uncompared: 'One of the two pictures could not be loaded, so the site shows the publisher’s image and lets you compare.',
  unknown: 'Common for older printings. It says nothing about whether a shop has the book.',
  pending: 'The lookup is still running; it takes a second.',
  unavailable: 'Google Books did not answer. Trying again later usually works.',
  catalogueVerified: 'Weaker evidence than the publisher’s image: the catalogue’s scan may be older than what ships today.',
  catalogueDiffers: 'The catalogue’s scan is shown beside the note. The shops stay, because a scan says less about a new copy than the publisher’s image does.',
  catalogueUncompared: 'One of the two pictures could not be loaded; the catalogue’s scan is shown for you to compare.',
  catalogueUnknown: 'Google Books was out of reach or its daily quota spent, so the site asked Open Library instead. It says nothing about whether a shop has the book.',
};

/** Every state, in the order the About page lists them. */
export const VERDICT_ORDER: readonly VerdictStatus[] = [
  'verified', 'differs', 'uncompared', 'unknown', 'pending', 'unavailable',
  'catalogueVerified', 'catalogueDiffers', 'catalogueUncompared', 'catalogueUnknown',
];
