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
  | { kind: 'no-record' }
  /** ISFDB named someone, but sent the name with a letter already destroyed and it is not in NAME_FIXES. */
  | { kind: 'garbled'; artists: string[] };

/*
  ISFDB's REST interface sends every letter outside ASCII as U+FFFD, the
  replacement character, already in its answer (bytes EF BF BD, measured
  2026-09-26 on 9783442233601: „J\uFFFDrgen F. Rogner"). The letter is gone at
  the source; decoded as ISO-8859-1 it showed on the wall as „Jï¿½rgen"
  (Julian: „fehler mit umlaut"). The names below were put right by hand; any
  other name with a lost letter is not shown at all, because a garbled name
  on a credit is worse than none (N12).
*/
const NAME_FIXES: Record<string, string> = {
  'J\uFFFDrgen F. Rogner': 'Jürgen F. Rogner',
  'J\uFFFDrgen Rogner': 'Jürgen Rogner',
  'S\uFFFDbastien Hue': 'Sébastien Hue',
  'Tom\uFFFDs Almeida': 'Tomás Almeida',
  's.BENe\uFFFD': 's.BENeš',
  'St\uFFFDphane Barry': 'Stéphane Barry',
  'Gr\uFFFDgoire H\uFFFDnon': 'Grégoire Hénon',
  '\uFFFDric Seigaud': 'Éric Seigaud',
  'Sevin\uFFFD Altan': 'Sevinç Altan',
};

/** A name as ISFDB sent it, with a lost letter put right, or null when it cannot be. */
export function repairName(name: string): string | null {
  // The same loss read as ISO-8859-1 instead of UTF-8: three characters for one.
  const n = name.replace(/\u00EF\u00BF\u00BD/g, '\uFFFD').normalize('NFC');
  if (!n.includes('\uFFFD')) return n;
  return NAME_FIXES[n] ?? null;
}

/** The credit with every name repaired; one name that cannot be repaired withholds the credit. */
export function repairCredit(credit: CoverCredit): CoverCredit {
  if (credit.kind !== 'artist' && credit.kind !== 'ambiguous') return credit;
  const fixed = credit.artists.map(repairName);
  if (fixed.some(a => a === null)) return { kind: 'garbled', artists: credit.artists };
  return { ...credit, artists: fixed as string[] };
}

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
    .replace(/&apos;/g, "'")
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
  if (keys.size > 1) return repairCredit({ kind: 'ambiguous', artists: [...new Set(sets.flat())] });
  const record = publications.find(p => p.artists.length > 0)?.record ?? publications[0].record;
  return repairCredit({ kind: 'artist', artists: sets[0], record });
}
