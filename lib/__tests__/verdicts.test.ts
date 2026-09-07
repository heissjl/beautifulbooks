/**
 * The verdict wording (SPEC §3 F2.9, F6, lib/verdicts.ts).
 *
 * These sentences appear in two places — the sidebar and the About page — and
 * that is exactly how they drifted apart before: About went on explaining
 * "Shops show this cover" months after the sidebar had stopped saying it,
 * because it claimed to have read a shop's page when no shop is ever asked.
 * Both now read the same constants, and these tests guard what they may say.
 */
import { describe, expect, it } from 'vitest';
import { VERDICT_LEAD, VERDICT_MEANING, VERDICT_ORDER, type VerdictStatus } from '../verdicts';

const STATUSES: VerdictStatus[] = ['verified', 'differs', 'unknown', 'pending', 'unavailable'];

describe('verdict wording', () => {
  it('gives every state words, and lists every state', () => {
    for (const status of STATUSES) {
      expect(VERDICT_LEAD[status]).toBeTruthy();
      expect(VERDICT_MEANING[status]).toBeTruthy();
    }
    expect([...VERDICT_ORDER].sort()).toEqual([...STATUSES].sort());
  });

  it('never says a shop was asked, because none is', () => {
    // The retired phrasing, and anything like it. The only lookup is Google
    // Books; the retailer links are URL templates that nothing here reads.
    for (const text of [...Object.values(VERDICT_LEAD), ...Object.values(VERDICT_MEANING)]) {
      expect(text).not.toMatch(/shops? (show|list|stock|have)/i);
      expect(text).not.toMatch(/in stock|out of stock|available at/i);
    }
  });

  it('names the publisher image as the evidence wherever it claims one', () => {
    expect(VERDICT_LEAD.verified).toMatch(/publisher/i);
    expect(VERDICT_LEAD.differs).toMatch(/publisher/i);
    expect(VERDICT_LEAD.unknown).toMatch(/publisher/i);
  });

  it('keeps "asked and got nothing" apart from "not asked yet" and "no answer"', () => {
    const { unknown, pending, unavailable } = VERDICT_LEAD;
    expect(new Set([unknown, pending, unavailable]).size).toBe(3);
    // The bug this prevents: `pending` fell through to the `unknown` sentence,
    // so for a second the page stated something it had not checked — and on a
    // day with the Google quota spent it would have said it all day.
    expect(pending).toMatch(/checking/i);
    expect(unavailable).toMatch(/did not answer/i);
  });

  it('claims nothing about completeness', () => {
    for (const text of [...Object.values(VERDICT_LEAD), ...Object.values(VERDICT_MEANING)]) {
      expect(text).not.toMatch(/\b(every|all|complete)\b/i);
    }
  });
});
