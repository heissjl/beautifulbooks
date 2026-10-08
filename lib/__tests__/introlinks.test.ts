import { describe, expect, it } from 'vitest';
import { introParts, introText } from '@/lib/introlinks';

describe('introParts', () => {
  it('makes an https address a link and keeps the sentence’s full stop outside it', () => {
    expect(introParts('The press: https://feministpress.org/.')).toEqual([
      { text: 'The press: ' },
      { href: 'https://feministpress.org/', label: 'feministpress.org' },
      { text: '.' },
    ]);
  });
  it('leaves text without an address alone and takes no other scheme', () => {
    expect(introParts('No link here.')).toEqual([{ text: 'No link here.' }]);
    expect(introParts('javascript:alert(1) http://x.test')).toEqual([{ text: 'javascript:alert(1) http://x.test' }]);
  });
  it('drops www. from the label', () => {
    expect(introText('See https://www.example.org/path/')).toBe('See example.org/path');
  });
});
