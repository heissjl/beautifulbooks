import { describe, expect, it } from 'vitest';
import { ARTWORK_HEADING_RE, sectionText, sleeveSentences } from '../wiki';

describe('ARTWORK_HEADING_RE', () => {
  it('takes the artwork headings of the eight albums and leaves cover versions out', () => {
    for (const h of ['Artwork', 'Packaging', 'Artwork packaging', 'Art direction', 'Cover artwork', 'Design']) expect(ARTWORK_HEADING_RE.test(h)).toBe(true);
    for (const h of ['Covers, tributes and samples', 'Charts', 'Title']) expect(ARTWORK_HEADING_RE.test(h)).toBe(false);
  });
});

describe('sectionText', () => {
  it('drops headings, references and tables', () => {
    expect(sectionText('<h3>Artwork</h3><p>The cover shows a prism.<sup class="reference">[12]</sup></p><table><tr><td>x</td></tr></table>'))
      .toBe('The cover shows a prism.');
  });

  it("drops what is left of a quote box, its attribution line (Dark Side: '— Richard Wright')", () => {
    expect(sectionText('<div class="quotebox"><p>— Richard Wright</p></div><p>The album was released in a gatefold sleeve.</p>'))
      .toBe('The album was released in a gatefold sleeve.');
  });
});

describe('sleeveSentences', () => {
  it('keeps sentences about the sleeve, not about cover versions', () => {
    const text = 'In the UK, the album was released with a blue-and-white motorway logo rather than the painted cover. The band toured. ' +
      'The song was covered by Joy Division. Several artists recorded a cover version of the title track.';
    expect(sleeveSentences(text)).toEqual(['In the UK, the album was released with a blue-and-white motorway logo rather than the painted cover.']);
  });

  it('does not run a sentence into the personnel list and headings after it (Autobahn, measured 2026-09-29)', () => {
    const text = 'The UK cover became the default sleeve on later reissues.\nFlorian Schneider – voice, vocoder\nRalf Hütter – voice, electronics, cover concept. Produced it too.\nJohann Zambryski – artwork reconstruction\n== Charts ==';
    expect(sleeveSentences(text)).toEqual(['The UK cover became the default sleeve on later reissues.']);
  });
});
