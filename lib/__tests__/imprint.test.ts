import { describe, expect, it } from 'vitest';
import { readImprint } from '../imprint';

describe('readImprint', () => {
  const full = { IMPRINT_NAME: 'A. Person', IMPRINT_STREET: 'Somestreet 1', IMPRINT_CITY: '12345 Town', IMPRINT_EMAIL: 'a@example.org' };
  it('reads all four values, trimmed', () => {
    expect(readImprint({ ...full, IMPRINT_NAME: '  A. Person ' })).toEqual({ name: 'A. Person', street: 'Somestreet 1', city: '12345 Town', email: 'a@example.org' });
  });
  it('refuses a notice with any value missing or blank, naming it', () => {
    expect(() => readImprint({ ...full, IMPRINT_STREET: '' })).toThrow(/IMPRINT_STREET/);
    expect(() => readImprint({})).toThrow(/IMPRINT_NAME, IMPRINT_STREET, IMPRINT_CITY, IMPRINT_EMAIL/);
  });
});
