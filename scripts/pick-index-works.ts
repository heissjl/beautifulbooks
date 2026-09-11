/**
 * Picks the works the cover index is built over (ROADMAP 5.1, 6.10).
 *
 * A first cut at the ~500 list of 5.1, at fifty. Not scraped from a "most
 * popular" endpoint, because for a site about covers the useful measure is
 * not how many people read a book but **how often it has been dressed
 * again** — and because Open Library has no such endpoint anyway.
 *
 * So: a seed list of titles, resolved through our own search, which already
 * ranks the work above its study guides (F1.4). Each hit must clear a
 * threshold of edition records, and no author may take more than two slots,
 * or half the list would be Tolkien and Kafka. The twelve works of the home
 * page are always in, so the wall and the index agree.
 *
 * Run: npx tsx scripts/pick-index-works.ts
 * Writes data/index-works.json; commit the result.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CURATED_WORKS } from '../lib/curated';
import { search } from '../lib/search';
import { authorMatchKey } from '../lib/normalize';

/** Enough printings that the wall shows a range of designs. */
const MIN_EDITIONS = 25;
const MAX_PER_AUTHOR = 2;
const TARGET = Number(process.argv.find(a => a.startsWith('--target='))?.split('=')[1] ?? 100);

/**
 * Chosen by hand for spread: five centuries, a dozen languages of origin,
 * novels, a treatise and a few children's books, all of them printed often
 * enough that their jackets have really changed. The list grows at the end;
 * works already in `data/index-works.json` keep their place, so the index
 * built over them stays valid and the builder only has to fetch the new ones.
 */
const SEEDS: Array<[title: string, author: string]> = [
  ['Pride and Prejudice', 'Jane Austen'],
  ['Frankenstein', 'Mary Shelley'],
  ['Dracula', 'Bram Stoker'],
  ['Jane Eyre', 'Charlotte Brontë'],
  ['Wuthering Heights', 'Emily Brontë'],
  ['Crime and Punishment', 'Fyodor Dostoevsky'],
  ['Anna Karenina', 'Leo Tolstoy'],
  ['Madame Bovary', 'Gustave Flaubert'],
  ['Don Quixote', 'Miguel de Cervantes'],
  ['The Trial', 'Franz Kafka'],
  ['Die Verwandlung', 'Franz Kafka'],
  ['Der Zauberberg', 'Thomas Mann'],
  ['Der Steppenwolf', 'Hermann Hesse'],
  ['Siddhartha', 'Hermann Hesse'],
  ['The Stranger', 'Albert Camus'],
  ['One Hundred Years of Solitude', 'Gabriel García Márquez'],
  ['Things Fall Apart', 'Chinua Achebe'],
  ['Invisible Man', 'Ralph Ellison'],
  ['To Kill a Mockingbird', 'Harper Lee'],
  ['Catch-22', 'Joseph Heller'],
  ['Slaughterhouse-Five', 'Kurt Vonnegut'],
  ['Brave New World', 'Aldous Huxley'],
  ['Fahrenheit 451', 'Ray Bradbury'],
  ['The Left Hand of Darkness', 'Ursula K. Le Guin'],
  ['Foundation', 'Isaac Asimov'],
  ['Do Androids Dream of Electric Sheep', 'Philip K. Dick'],
  ['The Hobbit', 'J. R. R. Tolkien'],
  ['The Lord of the Rings', 'J. R. R. Tolkien'],
  ['Heart of Darkness', 'Joseph Conrad'],
  ['The Old Man and the Sea', 'Ernest Hemingway'],
  ['On the Road', 'Jack Kerouac'],
  ['Naked Lunch', 'William S. Burroughs'],
  ['The Bell Jar', 'Sylvia Plath'],
  ['Mrs Dalloway', 'Virginia Woolf'],
  ['Also sprach Zarathustra', 'Friedrich Nietzsche'],
  ['Die Blechtrommel', 'Günter Grass'],
  ['The Unbearable Lightness of Being', 'Milan Kundera'],
  ['The Remains of the Day', 'Kazuo Ishiguro'],
  ['Norwegian Wood', 'Haruki Murakami'],
  ['Wolf Hall', 'Hilary Mantel'],
  ['The Master and Margarita', 'Mikhail Bulgakov'],
  ['The Handmaid’s Tale', 'Margaret Atwood'],
  ['A Confederacy of Dunces', 'John Kennedy Toole'],
  ['If on a Winter’s Night a Traveler', 'Italo Calvino'],
  ['Half of a Yellow Sun', 'Chimamanda Ngozi Adichie'],
  ['The Sellout', 'Paul Beatty'],
  ['Der Prozess', 'Franz Kafka'],
  ['Lord of the Flies', 'William Golding'],
  ['The Catcher in the Rye', 'J. D. Salinger'],
  ['Mumbo Jumbo', 'Ishmael Reed'],

  // Zweite Runde, 2026-09-08: noch einmal fünfzig, mit mehr Nicht-Englischem,
  // mehr Nicht-Fiktion und ein paar Büchern, die als Reihe gestaltet wurden.
  ['The Odyssey', 'Homer'],
  ['The Iliad', 'Homer'],
  ['The Divine Comedy', 'Dante Alighieri'],
  ['Hamlet', 'William Shakespeare'],
  ['Macbeth', 'William Shakespeare'],
  ['Faust', 'Johann Wolfgang von Goethe'],
  ['Die Leiden des jungen Werther', 'Johann Wolfgang von Goethe'],
  ['Effi Briest', 'Theodor Fontane'],
  ['Der Prozeß', 'Franz Kafka'],
  ['Buddenbrooks', 'Thomas Mann'],
  ['Im Westen nichts Neues', 'Erich Maria Remarque'],
  ['Das Parfum', 'Patrick Süskind'],
  ['Der Vorleser', 'Bernhard Schlink'],
  ['Momo', 'Michael Ende'],
  ['Die unendliche Geschichte', 'Michael Ende'],
  ['Les Misérables', 'Victor Hugo'],
  ['Le Petit Prince', 'Antoine de Saint-Exupéry'],
  ['À la recherche du temps perdu', 'Marcel Proust'],
  ['Bonjour tristesse', 'Françoise Sagan'],
  ['The Count of Monte Cristo', 'Alexandre Dumas'],
  ['War and Peace', 'Leo Tolstoy'],
  ['The Brothers Karamazov', 'Fyodor Dostoevsky'],

  // Dritte Runde, 2026-09-11 (ROADMAP 5.8a): hundert Bücher mehr für das
  // Cover-Spiel. Zuerst, was auf BookTok gelesen und gezeigt wird — ein Spiel,
  // das dort geteilt werden soll, braucht Cover, die man dort kennt —, dann
  // Genre-Klassiker, Weltliteratur und Sachbuch. Autoren, die schon zweimal
  // im Index stehen, fehlen hier: das Skript überspränge sie ohnehin. Die
  // Vorschläge aus lab/curate/suggestions.json, die nicht schon kuratiert
  // sind, stehen am Anfang.
  ['The Golden Notebook', 'Doris Lessing'],
  ['To the Lighthouse', 'Virginia Woolf'],
  ['Le Deuxième Sexe', 'Simone de Beauvoir'],
  ['Persepolis', 'Marjane Satrapi'],
  ['Maus', 'Art Spiegelman'],
  ['Watchmen', 'Alan Moore'],
  ['Oryx and Crake', 'Margaret Atwood'],
  ['Under the Volcano', 'Malcolm Lowry'],
  ['A Room with a View', 'E. M. Forster'],
  ['Howards End', 'E. M. Forster'],
  ['Lord Jim', 'Joseph Conrad'],
  ['The Age of Innocence', 'Edith Wharton'],
  ['The House of Mirth', 'Edith Wharton'],
  ['My Ántonia', 'Willa Cather'],
  ['The Jungle', 'Upton Sinclair'],
  ['The Secret History', 'Donna Tartt'],
  ['The Goldfinch', 'Donna Tartt'],
  ['The Song of Achilles', 'Madeline Miller'],
  ['Circe', 'Madeline Miller'],
  ['A Little Life', 'Hanya Yanagihara'],
  ['Normal People', 'Sally Rooney'],
  ['The Seven Husbands of Evelyn Hugo', 'Taylor Jenkins Reid'],
  ['Twilight', 'Stephenie Meyer'],
  ['The Hunger Games', 'Suzanne Collins'],
  ['Harry Potter and the Philosopher’s Stone', 'J. K. Rowling'],
  ['The Fault in Our Stars', 'John Green'],
  ['Gone Girl', 'Gillian Flynn'],
  ['The Perks of Being a Wallflower', 'Stephen Chbosky'],
  ['The Night Circus', 'Erin Morgenstern'],
  ['The Book Thief', 'Markus Zusak'],
  ['No Longer Human', 'Osamu Dazai'],
  ['The Alchemist', 'Paulo Coelho'],
  ['Life of Pi', 'Yann Martel'],
  ['Little Women', 'Louisa May Alcott'],
  ['Animal Farm', 'George Orwell'],
  ['The Lion, the Witch and the Wardrobe', 'C. S. Lewis'],
  ['A Game of Thrones', 'George R. R. Martin'],
  ['The Name of the Wind', 'Patrick Rothfuss'],
  ['The Shining', 'Stephen King'],
  ['It', 'Stephen King'],
  ['Matilda', 'Roald Dahl'],
  ['Charlie and the Chocolate Factory', 'Roald Dahl'],
  ['The Giver', 'Lois Lowry'],
  ['The Outsiders', 'S. E. Hinton'],
  ['Gone with the Wind', 'Margaret Mitchell'],
  ['The Diary of a Young Girl', 'Anne Frank'],
  ['Interview with the Vampire', 'Anne Rice'],
  ['The Godfather', 'Mario Puzo'],
  ['The Silence of the Lambs', 'Thomas Harris'],
  ['The Hound of the Baskervilles', 'Arthur Conan Doyle'],
  ['Murder on the Orient Express', 'Agatha Christie'],
  ['And Then There Were None', 'Agatha Christie'],
  ['The Big Sleep', 'Raymond Chandler'],
  ['The Maltese Falcon', 'Dashiell Hammett'],
  ['Twenty Thousand Leagues Under the Sea', 'Jules Verne'],
  ['Around the World in Eighty Days', 'Jules Verne'],
  ['The Martian Chronicles', 'Ray Bradbury'],
  ['2001: A Space Odyssey', 'Arthur C. Clarke'],
  ['Stranger in a Strange Land', 'Robert A. Heinlein'],
  ["Ender's Game", 'Orson Scott Card'],
  ['Cloud Atlas', 'David Mitchell'],
  ['Trainspotting', 'Irvine Welsh'],
  ['Watership Down', 'Richard Adams'],
  ['Tess of the d’Urbervilles', 'Thomas Hardy'],
  ['Far from the Madding Crowd', 'Thomas Hardy'],
  ['North and South', 'Elizabeth Gaskell'],
  ['Vanity Fair', 'William Makepeace Thackeray'],
  ['Tristram Shandy', 'Laurence Sterne'],
  ['The Call of the Wild', 'Jack London'],
  ['The Adventures of Tom Sawyer', 'Mark Twain'],
  ['Uncle Tom’s Cabin', 'Harriet Beecher Stowe'],
  ['Infinite Jest', 'David Foster Wallace'],
  ['The Corrections', 'Jonathan Franzen'],
  ['The Idiot', 'Fyodor Dostoevsky'],
  ['The Death of Ivan Ilyich', 'Leo Tolstoy'],
  ['Eugene Onegin', 'Alexander Pushkin'],
  ['Dead Souls', 'Nikolai Gogol'],
  ['Fathers and Sons', 'Ivan Turgenev'],
  ['Le Rouge et le Noir', 'Stendhal'],
  ['Germinal', 'Émile Zola'],
  ['Les Liaisons dangereuses', 'Choderlos de Laclos'],
  ['Il Gattopardo', 'Giuseppe Tomasi di Lampedusa'],
  ['Le avventure di Pinocchio', 'Carlo Collodi'],
  ['Pedro Páramo', 'Juan Rulfo'],
  ['Rayuela', 'Julio Cortázar'],
  ['Ficciones', 'Jorge Luis Borges'],
  ['La casa de los espíritus', 'Isabel Allende'],
  ['Ensaio sobre a cegueira', 'José Saramago'],
  ['Kokoro', 'Natsume Sōseki'],
  ['Zorba the Greek', 'Nikos Kazantzakis'],
  ['Osudy dobrého vojáka Švejka', 'Jaroslav Hašek'],
  ['Sofies verden', 'Jostein Gaarder'],
  ['Heidi', 'Johanna Spyri'],
  ['Emil und die Detektive', 'Erich Kästner'],
  ['Der Schimmelreiter', 'Theodor Storm'],
  ['The Prince', 'Niccolò Machiavelli'],
  ['The Art of War', 'Sun Tzu'],
  ['Walden', 'Henry David Thoreau'],
  ['On the Origin of Species', 'Charles Darwin'],
  ['A Brief History of Time', 'Stephen Hawking'],
  ['Silent Spring', 'Rachel Carson'],
  ['Sapiens', 'Yuval Noah Harari'],
  ['Lolita', 'Vladimir Nabokov'],
  ['Doctor Zhivago', 'Boris Pasternak'],
  ['The Gulag Archipelago', 'Aleksandr Solzhenitsyn'],
  ['Anna Karenina', 'Leo Tolstoy'],
  ['The Tale of Genji', 'Murasaki Shikibu'],
  ['Kafka on the Shore', 'Haruki Murakami'],
  ['Snow Country', 'Yasunari Kawabata'],
  ['Things I Learned', 'Anne Frank'],
  ['The Diary of a Young Girl', 'Anne Frank'],
  ['Beloved Country', 'Alan Paton'],
  ['Midnight’s Children', 'Salman Rushdie'],
  ['The God of Small Things', 'Arundhati Roy'],
  ['A Fine Balance', 'Rohinton Mistry'],
  ['The Kite Runner', 'Khaled Hosseini'],
  ['Persepolis', 'Marjane Satrapi'],
  ['Never Let Me Go', 'Kazuo Ishiguro'],
  ['Atonement', 'Ian McEwan'],
  ['White Teeth', 'Zadie Smith'],
  ['The Road', 'Cormac McCarthy'],
  ['Blood Meridian', 'Cormac McCarthy'],
  ['Infinite Jest', 'David Foster Wallace'],
  ['American Psycho', 'Bret Easton Ellis'],
  ['Fight Club', 'Chuck Palahniuk'],
  ['The Handmaid’s Tale', 'Margaret Atwood'],
  ['A Clockwork Orange', 'Anthony Burgess'],
  ['The Picture of Dorian Gray', 'Oscar Wilde'],
  ['Alice’s Adventures in Wonderland', 'Lewis Carroll'],
  ['The Wind in the Willows', 'Kenneth Grahame'],
  ['Winnie-the-Pooh', 'A. A. Milne'],
  ['Charlotte’s Web', 'E. B. White'],
  ['Where the Wild Things Are', 'Maurice Sendak'],
  ['The Art of War', 'Sun Tzu'],
  ['The Prince', 'Niccolò Machiavelli'],
  ['Meditations', 'Marcus Aurelius'],
  ['Walden', 'Henry David Thoreau'],
  ['The Origin of Species', 'Charles Darwin'],
  ['A Brief History of Time', 'Stephen Hawking'],
  ['Silent Spring', 'Rachel Carson'],
];

const OUT_FILE = path.join(process.cwd(), 'data', 'index-works.json');

export interface IndexWork {
  id: string;
  title: string;
  author: string;
  editionCount: number;
  /** Why it is in the list, so a later reader can judge the selection. */
  source: 'curated' | 'seed';
}

async function main() {
  const picked = new Map<string, IndexWork>();
  const perAuthor = new Map<string, number>();

  // Keep whatever a previous run committed: the index is built over these ids
  // and the builder skips works it already knows, so a second round only has
  // to fetch what is new.
  if (existsSync(OUT_FILE)) {
    const before = JSON.parse(readFileSync(OUT_FILE, 'utf8')) as { works: IndexWork[] };
    for (const w of before.works) {
      picked.set(w.id, w);
      const key = authorMatchKey(w.author);
      perAuthor.set(key, (perAuthor.get(key) ?? 0) + 1);
    }
    console.log(`${picked.size} Werke aus dem vorigen Lauf übernommen.`);
  }

  const take = (w: IndexWork) => {
    if (picked.has(w.id)) return false;
    const key = authorMatchKey(w.author);
    const used = perAuthor.get(key) ?? 0;
    if (w.source === 'seed' && used >= MAX_PER_AUTHOR) {
      console.log(`  übersprungen (${MAX_PER_AUTHOR} je Autor): ${w.title} — ${w.author}`);
      return false;
    }
    picked.set(w.id, w);
    perAuthor.set(key, used + 1);
    return true;
  };

  // The home page wall first, unconditionally: the two lists must not diverge.
  for (const w of CURATED_WORKS) {
    take({ id: w.id, title: w.title, author: w.author, editionCount: 0, source: 'curated' });
  }
  // Julian's picks from the curation tool (data/curated.json, ROADMAP 6.18),
  // unconditionally as well: each one was looked at, which says more than an
  // edition count. Added 2026-09-11 — until then only the eleven above went
  // in, and 38 works picked after the index was built were missing from it.
  const picks = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'curated.json'), 'utf8')) as {
    works: Array<{ id: string; title: string; author: string }>;
  };
  for (const w of picks.works) {
    take({ id: w.id, title: w.title, author: w.author, editionCount: 0, source: 'curated' });
  }
  console.log(`${picked.size} kuratierte Werke übernommen.\n`);

  for (const [title, author] of SEEDS) {
    if (picked.size >= TARGET) break;
    let result;
    try {
      result = await search(`${title} ${author}`);
    } catch (err) {
      console.log(`  Quelle schwieg bei "${title}": ${(err as Error).message}`);
      continue;
    }
    const hit = result.works.find(w => authorMatchKey(w.authors[0] ?? '') === authorMatchKey(author)) ?? result.works[0];
    if (!hit) {
      console.log(`  kein Treffer: ${title}`);
      continue;
    }
    const editions = hit.editionCount ?? 0;
    if (editions < MIN_EDITIONS) {
      console.log(`  zu wenige Ausgaben (${editions} < ${MIN_EDITIONS}): ${hit.title} — ${hit.authors[0]}`);
      continue;
    }
    if (take({ id: hit.id, title: hit.title, author: hit.authors[0] ?? author, editionCount: editions, source: 'seed' })) {
      console.log(`  ${String(picked.size).padStart(2)}. ${hit.title.slice(0, 40).padEnd(42)} ${(hit.authors[0] ?? '').slice(0, 22).padEnd(24)} ${editions} Ausgaben`);
    }
  }

  const works = [...picked.values()];
  writeFileSync(OUT_FILE, JSON.stringify({ pickedAt: new Date().toISOString().slice(0, 10), works }, null, 2) + '\n');
  console.log(`\n${works.length} Werke in data/index-works.json.`);
}

main();
