/**
 * Fifty more books for the curated list (ROADMAP 6.17, 6.18).
 *
 *   npx tsx lab/curate/suggest.ts            # writes lab/curate/suggestions.json
 *   npx tsx lab/curate/suggest.ts --target=30
 *
 * Julian, 2026-09-09: „50 neue angereicherte Vorschläge von Büchern für die
 * Liste". Enriched means each suggestion arrives with the numbers that argue
 * for it — how many edition records Open Library holds, how many readers have
 * it on a list, what year it dates the work to — so a choice can be made
 * without opening anything.
 *
 * **Not a popularity endpoint**, because Open Library has none and because
 * for a site about covers the useful measure is how often a book has been
 * dressed again. So: a seed list chosen by hand for spread, resolved through
 * our own search (which already ranks a novel above its study guides, F1.4),
 * filtered by edition count, capped at two per author, and stripped of
 * everything the list already knows — including the books struck off, which
 * must never come back.
 *
 * No Google Books (lab rule 6): `search` asks Open Library only.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { search } from '../../lib/search';
import { authorMatchKey, looksLikeSecondaryLiterature, normalizeTitle } from '../../lib/normalize';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(import.meta.dirname, 'suggestions.json');
const TARGET = Number(process.argv.find(a => a.startsWith('--target='))?.split('=')[1] ?? 50);
/** Enough printings that a wall shows a range of designs, not one jacket. */
const MIN_EDITIONS = 15;
const MAX_PER_AUTHOR = 2;

const SEEDS: Array<[title: string, author: string]> = [
  ['Middlemarch', 'George Eliot'],
  ['Great Expectations', 'Charles Dickens'],
  ['A Tale of Two Cities', 'Charles Dickens'],
  ['The Adventures of Huckleberry Finn', 'Mark Twain'],
  ['The Scarlet Letter', 'Nathaniel Hawthorne'],
  ['The Awakening', 'Kate Chopin'],
  ['Their Eyes Were Watching God', 'Zora Neale Hurston'],
  ['Native Son', 'Richard Wright'],
  ['Go Tell It on the Mountain', 'James Baldwin'],
  ['The Color Purple', 'Alice Walker'],
  ['Song of Solomon', 'Toni Morrison'],
  ['Brideshead Revisited', 'Evelyn Waugh'],
  ['The Grapes of Wrath', 'John Steinbeck'],
  ['Tender Is the Night', 'F. Scott Fitzgerald'],
  ['Rebecca', 'Daphne du Maurier'],
  ['The Talented Mr. Ripley', 'Patricia Highsmith'],
  ['In Cold Blood', 'Truman Capote'],
  ["Breakfast at Tiffany's", 'Truman Capote'],
  ['On the Road', 'Jack Kerouac'],
  ["One Flew Over the Cuckoo's Nest", 'Ken Kesey'],
  ['A Confederacy of Dunces', 'John Kennedy Toole'],
  ['The Crying of Lot 49', 'Thomas Pynchon'],
  ['White Noise', 'Don DeLillo'],
  ['Underworld', 'Don DeLillo'],
  ['Rabbit, Run', 'John Updike'],
  ["Portnoy's Complaint", 'Philip Roth'],
  ['American Pastoral', 'Philip Roth'],
  ['The Virgin Suicides', 'Jeffrey Eugenides'],
  ['Middlesex', 'Jeffrey Eugenides'],
  ['Never Let Me Go', 'Kazuo Ishiguro'],
  ['Atonement', 'Ian McEwan'],
  ['The God of Small Things', 'Arundhati Roy'],
  ["Midnight's Children", 'Salman Rushdie'],
  ['The Satanic Verses', 'Salman Rushdie'],
  ['Half of a Yellow Sun', 'Chimamanda Ngozi Adichie'],
  ['Americanah', 'Chimamanda Ngozi Adichie'],
  ['Season of Migration to the North', 'Tayeb Salih'],
  ['Palace Walk', 'Naguib Mahfouz'],
  ['Snow', 'Orhan Pamuk'],
  ['My Name Is Red', 'Orhan Pamuk'],
  ['Doctor Zhivago', 'Boris Pasternak'],
  ['One Day in the Life of Ivan Denisovich', 'Aleksandr Solzhenitsyn'],
  ['Pale Fire', 'Vladimir Nabokov'],
  ["If on a Winter's Night a Traveler", 'Italo Calvino'],
  ['Invisible Cities', 'Italo Calvino'],
  ['The Name of the Rose', 'Umberto Eco'],
  ["Foucault's Pendulum", 'Umberto Eco'],
  ['Die unendliche Geschichte', 'Michael Ende'],
  ['Momo', 'Michael Ende'],
  ['Homo Faber', 'Max Frisch'],
  ['Stiller', 'Max Frisch'],
  ['Der Besuch der alten Dame', 'Friedrich Dürrenmatt'],
  ['Faust', 'Johann Wolfgang von Goethe'],
  ['Der Sandmann', 'E. T. A. Hoffmann'],
  ['The Wonderful Wizard of Oz', 'L. Frank Baum'],
  ['Peter Pan', 'J. M. Barrie'],
  ['The Secret Garden', 'Frances Hodgson Burnett'],
  ['Anne of Green Gables', 'L. M. Montgomery'],
  ['Le Petit Prince', 'Antoine de Saint-Exupéry'],
  ['Pippi Långstrump', 'Astrid Lindgren'],
  ['The Hobbit', 'J.R.R. Tolkien'],
  ['A Wizard of Earthsea', 'Ursula K. Le Guin'],
  ["The Hitchhiker's Guide to the Galaxy", 'Douglas Adams'],
  ['Foundation', 'Isaac Asimov'],
  ['I, Robot', 'Isaac Asimov'],
  ['Solaris', 'Stanisław Lem'],
  ['Snow Crash', 'Neal Stephenson'],
  ['Kindred', 'Octavia E. Butler'],
  ['Parable of the Sower', 'Octavia E. Butler'],
  ['Jonathan Strange & Mr Norrell', 'Susanna Clarke'],
  ['The Woman in White', 'Wilkie Collins'],
  ['The Moonstone', 'Wilkie Collins'],
  ['Strange Case of Dr Jekyll and Mr Hyde', 'Robert Louis Stevenson'],
  ['Treasure Island', 'Robert Louis Stevenson'],
  ['The War of the Worlds', 'H. G. Wells'],
  ['The Time Machine', 'H. G. Wells'],
  ['Twenty Thousand Leagues Under the Sea', 'Jules Verne'],
  ['The Count of Monte Cristo', 'Alexandre Dumas'],
  ['Les Misérables', 'Victor Hugo'],
  ['Notre-Dame de Paris', 'Victor Hugo'],
  // Zweite Runde, 2026-09-09: Klassiker, die noch fehlten, dazu Bildromane,
  // deren Umschläge selbst Gestaltung sind.
  ['Candide', 'Voltaire'],
  ['Robinson Crusoe', 'Daniel Defoe'],
  ["Gulliver's Travels", 'Jonathan Swift'],
  ['Emma', 'Jane Austen'],
  ['The Sound and the Fury', 'William Faulkner'],
  ['As I Lay Dying', 'William Faulkner'],
  ['Cry, the Beloved Country', 'Alan Paton'],
  ['Voyage au bout de la nuit', 'Louis-Ferdinand Céline'],
  ['La sombra del viento', 'Carlos Ruiz Zafón'],
  ['Kafka on the Shore', 'Haruki Murakami'],
  ['The Wind-Up Bird Chronicle', 'Haruki Murakami'],
  ['Wide Sargasso Sea', 'Jean Rhys'],
  ['The Golden Notebook', 'Doris Lessing'],
  ['To the Lighthouse', 'Virginia Woolf'],
  ['Le Deuxième Sexe', 'Simone de Beauvoir'],
  ['Persepolis', 'Marjane Satrapi'],
  ['Maus', 'Art Spiegelman'],
  ['Watchmen', 'Alan Moore'],
  ['The Handmaid’s Tale', 'Margaret Atwood'],
  ['Oryx and Crake', 'Margaret Atwood'],
];

export interface Suggestion {
  id: string;
  title: string;
  author: string;
  editionCount?: number;
  readers?: number;
  firstPublished?: number;
  /** One line of why, for the tool to show beside the title. */
  note: string;
}

function known(): Set<string> {
  const ids = new Set<string>();
  const add = (file: string, pick: (o: unknown) => string[]) => {
    const p = join(ROOT, 'data', file);
    if (!existsSync(p)) return;
    for (const id of pick(JSON.parse(readFileSync(p, 'utf8')))) ids.add(id);
  };
  add('index-works.json', (o) => ((o as { works: Array<{ id: string }> }).works ?? []).map(w => w.id));
  add('curated.json', (o) => ((o as { works: Array<{ id: string }> }).works ?? []).map(w => w.id));
  if (existsSync(OUT)) for (const s of JSON.parse(readFileSync(OUT, 'utf8')) as Suggestion[]) ids.add(s.id);
  return ids;
}

async function main() {
  const skip = known();
  const perAuthor = new Map<string, number>();
  const out: Suggestion[] = [];
  console.log(`suggest: ${skip.size} works already known, looking for ${TARGET} more`);

  for (const [title, author] of SEEDS) {
    if (out.length >= TARGET) break;
    const key = authorMatchKey(author);
    if ((perAuthor.get(key) ?? 0) >= MAX_PER_AUTHOR) continue;

    let works;
    try {
      works = (await search(`${title} ${author}`)).works;
    } catch (err) {
      console.log(`  ? ${title}: ${(err as Error).message}`);
      continue;
    }
    /*
      The hit must be *this* book, not merely the best thing the search had
      left. The first version took the top unknown result, so a seed whose
      book the list already knew descended to its leftovers: sequels, boxed
      sets, collected works, and once a study guide (measured 2026-09-09).
      A seed whose book is already in the list is now simply skipped.
    */
    const seedKey = normalizeTitle(title);
    const authorKey = authorMatchKey(author);
    const sameBook = (w: (typeof works)[number]) => {
      const t = normalizeTitle(w.title);
      const sameTitle = t === seedKey || t.startsWith(`${seedKey} `) || seedKey.startsWith(`${t} `);
      const sameAuthor = authorMatchKey(w.authors[0] ?? '') === authorKey;
      const collection = w.title.includes('/') || /\[|collected|gesammelte|works \(/i.test(w.title);
      return sameTitle && sameAuthor && !collection && !looksLikeSecondaryLiterature(w.title);
    };

    const match = works.find(sameBook);
    if (!match) {
      console.log(`  - ${title}: no confident match`);
      continue;
    }
    if (skip.has(match.id)) {
      console.log(`  = ${title}: already in the list`);
      continue;
    }
    if ((match.editionCount ?? 0) < MIN_EDITIONS) {
      console.log(`  - ${title}: only ${match.editionCount} editions`);
      continue;
    }
    const hit = match;

    skip.add(hit.id);
    perAuthor.set(key, (perAuthor.get(key) ?? 0) + 1);
    const readers = hit.popularity?.readinglog;
    out.push({
      id: hit.id,
      title: hit.title,
      author: hit.authors[0] ?? author,
      editionCount: hit.editionCount,
      readers,
      firstPublished: hit.firstPublishYear,
      note: [
        hit.editionCount ? `${hit.editionCount.toLocaleString('de')} Ausgaben` : null,
        readers ? `${readers.toLocaleString('de')} Leser` : null,
        hit.firstPublishYear ? `ab ${hit.firstPublishYear}` : null,
      ].filter(Boolean).join(' · '),
    });
    console.log(`  + ${hit.title} — ${hit.authors[0]} (${hit.editionCount} Ausgaben)`);
  }

  /*
    Appended, never replaced. The first version wrote only the run's own
    finds, so a second run with --target=20 quietly threw away the fifty
    before it — the ids were in `known()` and therefore not found again
    (2026-09-09). New suggestions go to the end, which is also where the tool
    shows them.
  */
  const before: Suggestion[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  const seen = new Set(before.map(s => s.id));
  const all = [...before, ...out.filter(s => !seen.has(s.id))];
  writeFileSync(OUT, `${JSON.stringify(all, null, 2)}\n`);
  console.log(`suggest: ${out.length} new, ${all.length} in ${OUT}`);
}

void main();
