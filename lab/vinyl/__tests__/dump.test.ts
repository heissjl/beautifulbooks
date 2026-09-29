import { describe, expect, it } from 'vitest';
import { SLEEVE_ROLE_RE, parseDumpRelease, specialVinyl, vinylColour } from '../dump';

// Shape of a record in discogs_20260901_releases.xml.gz; fields trimmed, values invented.
const xml = `<release id="42" status="Accepted"><artists><artist><id>1</id><name>Fleetwood Mac</name></artist></artists>` +
  `<title>Rumours</title><labels><label name="Warner Bros. Records" catno="BSK 3010" id="1"/><label name="X" catno="none" id="2"/></labels>` +
  `<extraartists><artist><id>9</id><name>Herbert Worthington</name><role>Photography By [Cover]</role></artist>` +
  `<artist><id>8</id><name>Desmond Strobel</name><role>Design</role></artist><artist><id>7</id><name>Ken Caillat</name><role>Producer</role></artist></extraartists>` +
  `<formats><format name="Vinyl" qty="1" text="Red Translucent, 180g"><descriptions><description>LP</description>` +
  `<description>Album</description><description>Picture Disc</description></descriptions></format>` +
  `<format name="CD" qty="1" text=""/></formats><country>US</country><released>2021-11-00</released><notes>Cover differs from the UK issue.
Gatefold.</notes>` +
  `<master_id is_main_release="false">38722</master_id>` +
  `<identifiers><identifier type="Barcode" value="0 7599-27313-1 4"/><identifier type="Matrix / Runout" value="BSK-1-3010"/></identifiers>` +
  `<images><image type="primary" uri="" width="600" height="600"/><image type="secondary" uri="" width="600" height="600"/></images></release>`;

describe('parseDumpRelease', () => {
  it('reads the fields the measurement needs', () => {
    const r = parseDumpRelease(xml)!;
    expect(r).toMatchObject({ id: 42, masterId: 38722, title: 'Rumours', country: 'US', released: '2021-11-00', catnos: ['BSK 3010'], barcodes: ['0 7599-27313-1 4'], images: 2 });
    expect(r.formats).toEqual([
      { name: 'Vinyl', qty: '1', text: 'Red Translucent, 180g', descriptions: ['LP', 'Album', 'Picture Disc'] },
      { name: 'CD', qty: '1', text: '', descriptions: [] },
    ]);
    expect(specialVinyl(r.formats[0])).toEqual(['Picture Disc']);
    expect(r.credits.filter(c => SLEEVE_ROLE_RE.test(c.role))).toEqual([
      { role: 'Photography By [Cover]', name: 'Herbert Worthington' },
      { role: 'Design', name: 'Desmond Strobel' },
    ]);
    expect(r.notes).toBe('Cover differs from the UK issue.\nGatefold.');
  });

  it('says null for images when the dump has no images element, 0 when it is empty', () => {
    expect(parseDumpRelease(xml.replace(/<images>.*<\/images>/, ''))!.images).toBeNull();
    expect(parseDumpRelease(xml.replace(/<images>.*<\/images>/, '<images/>'))!.images).toBe(0);
  });

  it('decodes entities and ignores a release without an id', () => {
    expect(parseDumpRelease(xml.replace('Rumours', 'Rumours &amp; More'))!.title).toBe('Rumours & More');
    expect(parseDumpRelease('<release><title>x</title></release>')).toBeNull();
  });
});

describe('vinylColour', () => {
  it('finds the colour of the record', () => {
    expect(vinylColour('Red Translucent, 180g')).toBe('Red Translucent');
    expect(vinylColour('180 Gram, Clear With Black Splatter')).toBe('Clear With Black Splatter');
    expect(vinylColour('Coke Bottle Green')).toBe('Coke Bottle Green');
    expect(vinylColour('Blue Marbled; Gatefold')).toBe('Blue Marbled');
  });

  it('ignores colours of labels, sleeves and obis (measured on the Discogs sample 2026-09-29)', () => {
    expect(vinylColour('Green WB Labels')).toBeNull();
    expect(vinylColour('Yellow Cover')).toBeNull();
    expect(vinylColour('Green Obi')).toBeNull();
    expect(vinylColour('Gold Stamped Sleeve, Red')).toBe('Red');
  });

  it('is not fooled by white-label promos or plain edition notes', () => {
    expect(vinylColour('White Label, Promo')).toBeNull();
    expect(vinylColour('180g, Gatefold, Remastered')).toBeNull();
    expect(vinylColour('')).toBeNull();
  });
});
