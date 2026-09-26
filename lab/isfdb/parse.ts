/**
 * Reading ISFDB's publication records (ROADMAP 6.52, step 1 and 2).
 *
 * `https://www.isfdb.org/cgi-bin/rest/getpub.cgi?<ISBN>` answers XML with
 * one `<Publication>` per printing under that ISBN. Pure functions, so the
 * rule for when a cover credit may be shown is tested without the network;
 * if it holds up in the measurement, it moves to `lib/` with 6.52.
 */

export interface IsfdbPublication {
  record: string;
  title: string;
  year: string;
  publisher: string;
  series: string;
  seriesNumber: string;
  artists: string[];
  image: string;
}

/** What one ISBN yields for the line „Cover art: …". */
export type CoverCredit =
  | { kind: 'artist'; artists: string[]; record: string }
  | { kind: 'ambiguous'; artists: string[] }
  | { kind: 'no-artist' }
  | { kind: 'no-record' };

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : '';
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

export function parsePublications(xml: string): IsfdbPublication[] {
  const blocks = xml.match(/<Publication>[\s\S]*?<\/Publication>/g) ?? [];
  return blocks.map(b => {
    const artistBlock = b.match(/<CoverArtists>([\s\S]*?)<\/CoverArtists>/)?.[1] ?? '';
    const artists = [...artistBlock.matchAll(/<Artist>([\s\S]*?)<\/Artist>/g)].map(m => decode(m[1].trim())).filter(Boolean);
    return {
      record: tag(b, 'Record'),
      title: tag(b, 'Title'),
      year: tag(b, 'Year'),
      publisher: tag(b, 'Publisher'),
      series: tag(b, 'PubSeries'),
      seriesNumber: tag(b, 'PubSeriesNum'),
      artists,
      image: tag(b, 'Image'),
    };
  });
}

/**
 * Picture agencies are named where a person made the image; they are not a
 * cover artist to credit (measured: „Shutterstock", 9781473227569).
 */
const AGENCIES = /^(shutterstock|getty images?|istock(photo)?|alamy|arcangel( images)?|trevillion( images)?|depositphotos|adobe stock|stock photo|uncredited|unknown)$/i;

/**
 * The credit a page may show for this ISBN.
 *
 * Only when every printing under the ISBN that names an artist names the same
 * ones: the artist can change between printings of one ISBN (9780575079144:
 * Jon Sullivan, then Vincent Chong), and a credit must never be carried to a
 * cover it does not belong to. Agencies are dropped first; a record left with
 * no artist is `no-artist`, never a guess.
 */
export function coverCredit(publications: IsfdbPublication[]): CoverCredit {
  if (publications.length === 0) return { kind: 'no-record' };
  const sets = publications
    .map(p => p.artists.filter(a => !AGENCIES.test(a)))
    .filter(a => a.length > 0)
    .map(a => [...new Set(a)].sort());
  if (sets.length === 0) return { kind: 'no-artist' };
  const keys = new Set(sets.map(a => a.join(' | ')));
  if (keys.size > 1) return { kind: 'ambiguous', artists: [...new Set(sets.flat())] };
  const record = publications.find(p => p.artists.length > 0)?.record ?? publications[0].record;
  return { kind: 'artist', artists: sets[0], record };
}
