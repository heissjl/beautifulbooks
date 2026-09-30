/**
 * The shopping list of a collection's piece (ROADMAP 5.14, stage 1 of the
 * purchase concept; Julian, 2026-09-28: „ja, bau die einkaufsliste mit
 * häkchen“): as text to copy, and as a structured file a reader's own browser
 * agent can work through in the reader's own accounts. Pure. Nothing here
 * contacts a shop; the reader, or their agent, buys.
 */
import { coverUrlFor } from '@/lib/coverurl';
import { tileCoverId, type PublicWall, type Tile } from './model';

const isbnsOf = (t: Tile) => t.printings.map((p) => p.isbn13 ?? p.isbn10).filter((x): x is string => !!x);

/** One line per book: title, author, printing, ISBNs, and the cover to match. */
export function shoppingText(wall: PublicWall, bought: ReadonlySet<string>, pageUrl: string): string {
  const lines = wall.tiles.map((t, i) => {
    const p = t.printings[0];
    const printing = [p?.publisher, p?.year].filter(Boolean).join(' ');
    const isbns = isbnsOf(t);
    return [
      `${bought.has(t.coverId) ? '[x]' : '[ ]'} ${i + 1}. ${t.title}${t.author ? ` — ${t.author}` : ''}`,
      printing ? `   ${printing}` : '',
      isbns.length ? `   ISBN ${isbns.join(', ')}` : '   no ISBN on record',
      `   cover: ${coverUrlFor(tileCoverId(t), 'L')}`,
    ].filter(Boolean).join('\n');
  });
  const left = wall.tiles.filter((t) => !bought.has(t.coverId)).length;
  return [
    `${wall.title} — ${wall.tiles.length} books, ${left} still to get`,
    'An ISBN names a printing, not its picture: check the photo of a copy against the cover.',
    pageUrl,
    '',
    ...lines,
  ].join('\n');
}

export interface AgentList {
  about: string;
  instructions: string[];
  collection: { title: string; url: string };
  books: Array<{
    position: number;
    title: string;
    author?: string;
    printing?: { publisher?: string; year?: number };
    isbns: string[];
    coverImage: string;
    alreadyBought: boolean;
  }>;
}

/**
 * The list for a reader's own agent (Claude in Chrome and the like). It says
 * what to look for and how to judge a copy; it carries no account, address or
 * payment detail — those stay with the reader and their agent.
 */
export function agentList(wall: PublicWall, bought: ReadonlySet<string>, pageUrl: string): AgentList {
  return {
    about: 'A shopping list from Beautiful Books: printed books whose particular cover the reader wants, to stand together in one frame.',
    instructions: [
      'Buy one printed copy of each book that is not already bought, in the reader\'s own accounts and only after the reader confirms the basket and the total.',
      'The cover matters more than the ISBN: the same ISBN has been printed with other covers. Prefer listings whose photo shows the coverImage; treat a stock photo as unconfirmed and say so.',
      'Search by the ISBNs first, then by title, author, publisher and year.',
      'Prefer fewer sellers when prices are close, because shipping is charged per seller.',
      'Never buy e-books or audiobooks.',
    ],
    collection: { title: wall.title, url: pageUrl },
    books: wall.tiles.map((t, i) => ({
      position: i + 1,
      title: t.title,
      ...(t.author ? { author: t.author } : {}),
      ...(t.printings[0] ? { printing: { ...(t.printings[0].publisher ? { publisher: t.printings[0].publisher } : {}), ...(t.printings[0].year ? { year: t.printings[0].year } : {}) } } : {}),
      isbns: isbnsOf(t),
      coverImage: coverUrlFor(tileCoverId(t), 'L') ?? '',
      alreadyBought: bought.has(t.coverId),
    })),
  };
}
