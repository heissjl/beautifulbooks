import { describe, expect, it } from 'vitest';
import { idFromHash, idLink } from '../walls/idlink';

const ID = '07813db0-516a-4ffe-a425-b807452865f4';

describe('a link that carries the ID (5.13l)', () => {
  it('puts the ID in the fragment of a /create link and reads it back', () => {
    const link = idLink('https://beautifulcovers.vercel.app', ID);
    expect(link).toBe(`https://beautifulcovers.vercel.app/create#id=${ID}`);
    expect(idFromHash(new URL(link).hash)).toBe(ID);
  });

  it('reads an ID typed in capitals, and nothing that is not one', () => {
    expect(idFromHash(`#id=${ID.toUpperCase()}`)).toBe(ID);
    expect(idFromHash('#id=nonsense')).toBeNull();
    expect(idFromHash('')).toBeNull();
    expect(idFromHash('#other=1')).toBeNull();
  });
});
