/**
 * Matches the pictures of r/badscificovers' top posts against Open Library
 * (PLAN-5.6b §6a; Julian, 2026-10-07: the exact cover from the post, crude
 * titles left out).
 *
 * For each post: find the work, walk its editions, fetch each cover's small
 * image and compare its dHash with the post's picture. Everything is cached in
 * lab/collections/in/ (git-ignored), so a run that is stopped picks up where it
 * was. One catalogue request at a time with a pause — Open Library shuts the
 * door on bursts (CLAUDE.md).
 *
 *   npx tsx lab/collections/badscificovers-match.ts
 *
 * Writes lab/collections/in/badscificovers-matches.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { signature } from '../../lib/imagehash';
import { hamming } from '../../lib/imagesig';
import { getEditionsPage, searchWorks } from '../../lib/sources/openlibrary';

const IN = path.join(__dirname, 'in');
// Small copies (300 px, made with Pillow): the decoder refuses pictures of several megapixels.
const PICS = path.join(IN, 'badscificovers-small');
const CACHE = path.join(IN, 'badscificovers-cache.json');
const OUT = path.join(IN, process.env.OUT_NAME ?? 'badscificovers-matches.json');

/** Rank in the listing, title and author as the post names them. Crude titles and non-books are left out. */
const POSTS: [number, string, string][] = [
  [0, 'The Hobbit', 'Tolkien'], [1, 'The Hobbit', 'Tolkien'], [2, 'Nineteen Eighty-Four', 'Orwell'], [3, 'The Hobbit', 'Tolkien'],
  [4, 'God Emperor of Dune', 'Frank Herbert'], [5, 'The Cat from Outer Space', 'Ted Key'], [6, 'Nineteen Eighty-Four', 'Orwell'],
  [8, 'The Hobbit', 'Tolkien'], [9, 'Alien', 'Alan Dean Foster'], [10, 'Empress Theresa', 'Norman Boutin'], [11, 'Space Wasters', 'David Garnett'],
  [12, 'The Boy with Dinosaur Hands', 'Al Carusone'], [13, 'Foundation', 'Isaac Asimov'], [14, 'To Keep the Ship', 'A. Bertram Chandler'],
  [15, 'God Emperor of Dune', 'Frank Herbert'], [16, 'Attack of the Rockoids', 'Gene Steinberg'], [17, 'Clash of Star-Kings', 'Avram Davidson'],
  [18, 'Moira: The Zorzen War', 'Lawrence Ambrose'], [19, 'On Wheels', 'John Jakes'], [20, 'Odd John', 'Olaf Stapledon'],
  [21, 'The Man with the Strange Head', 'Miles J. Breuer'], [22, 'The Computer That Ate My Brother', 'Dean Marney'],
  [23, 'I Sing the Body Electric', 'Ray Bradbury'], [24, 'C.O.W. Creatures of War', 'Thomax Green'], [26, 'Dune', 'Frank Herbert'],
  [27, 'The Gaean Enchantment', 'T. Jackson King'], [28, 'Planeten Drobos', 'Olof Möller'], [29, 'The Four Redheads', 'Julia Mandala'],
  [30, 'Surfing Samurai Robots', 'Mel Gilden'], [31, 'More Terrible Than Chains', 'Bernard Doove'],
  [32, 'Do Androids Dream of Electric Sheep', 'Philip K. Dick'], [33, 'Interstellar Pig', 'William Sleator'], [35, 'Red Dwarf', 'Grant Naylor'],
  [36, 'I Sing the Body Electric', 'Ray Bradbury'], [37, 'The Cave Girl', 'Edgar Rice Burroughs'],
  [38, 'The Restaurant at the End of the Universe', 'Douglas Adams'], [39, 'Spacepaw', 'Gordon R. Dickson'], [40, 'Cloning', 'David Shear'],
  [41, "Schrödinger's Cat: The Universe Next Door", 'Robert Anton Wilson'], [42, 'Starhammer', 'Christopher Rowley'], [43, 'On Wheels', 'John Jakes'],
  [44, 'The Spawn of Cthulhu', 'Lovecraft'], [45, 'Last and First Men', 'Olaf Stapledon'], [46, 'A Bride for the Alien King', 'Roxie Ray'],
  [47, 'The Texas-Israeli War: 1999', 'Howard Waldrop'], [48, 'The Little People', 'John Christopher'], [49, 'Chrome', 'George Nader'],
  [50, 'More Than Human', 'Theodore Sturgeon'], [51, 'Tik-Tok', 'John Sladek'], [52, 'Wandl the Invader', 'Ray Cummings'], [53, 'Dune', 'Frank Herbert'],
  [54, 'Who Censored Roger Rabbit', 'Gary K. Wolf'], [55, 'Destination: Saturn', 'Lin Carter'], [56, 'Skin of the Soul', 'Lisa Tuttle'],
  [57, 'A Million Years for Love', 'John Argo'], [58, 'Antinomy', 'Spider Robinson'], [59, 'C.O.W. Creatures of War', 'Thomax Green'],
  [60, 'You Are a Shark', 'Edward Packard'], [61, 'Mutants Amok', 'Mark Grant'], [62, 'The Metamorphosis', 'Franz Kafka'],
  [63, 'The Star Beast', 'Robert A. Heinlein'], [64, 'Strange Relations', 'Philip José Farmer'], [65, 'Bimbos of the Death Sun', 'Sharyn McCrumb'],
  [66, 'Alien Architect Needs a Nanny', 'Tasha Black'], [67, 'Alternate Warriors', 'Mike Resnick'], [68, 'The Thief of Chaos', 'J. L. Doty'],
  [70, 'Warchild', 'Richard Bowes'], [71, 'Masque of a Savage Mandarin', 'Philip Bedford Robinson'], [72, 'Watchers', 'Dean Koontz'],
  [73, 'Gender Genocide', 'Edmund Cooper'], [74, 'Shadow Path', 'P. L. Blair'], [75, 'Dorothy and the Wizard in Oz', 'L. Frank Baum'],
  [76, 'God Emperor of Dune', 'Frank Herbert'], [77, 'Sentinel of Ursa Major', 'Sergey Buzinin'], [79, 'Crash', 'J. G. Ballard'],
  [80, 'The Weed Men', 'Murray Roberts'], [81, 'The Land of Laughs', 'Jonathan Carroll'], [82, 'Doctor Who and the Loch Ness Monster', 'Terrance Dicks'],
  [83, 'The Best of All Possible Wars', 'Larry Niven'], [84, 'At the Mountains of Madness', 'Lovecraft'], [85, 'Yeast Lords', 'Benjamin Purvis'],
  [86, 'The Legend of Sleepy Hollow', 'Washington Irving'], [87, 'Frankenstein', 'Mary Shelley'], [88, 'Last and First Men', 'Olaf Stapledon'],
  [91, 'The Egg Man', 'Carlton Mellick'], [92, 'The Puppies of Terra', 'Thomas M. Disch'], [93, 'Inferno', 'Dante'], [94, 'Frankenstein', 'Mary Shelley'],
  [96, 'Star Biker', 'Vladimir Kulichenko'], [97, 'Nineteen Eighty-Four', 'Orwell'], [98, 'Island Kill', 'Robert Cain'],
  [99, 'The City of Gold and Lead', 'John Christopher'],
];

/**
 * Page 2 of the listing (`badscificovers-top200.json`, saved by Julian 2026-10-08), ranks 100–199.
 * Left out: a magazine (135), Chuck Tingle (142) and an erotica title (159), a joke credit (196 is
 * Philip José Farmer's *Venus on the Half-Shell*, kept under its real author), a reddit gallery (179)
 * and an ISFDB link instead of a picture (191).
 */
const POSTS_2: [number, string, string][] = [
  [100, 'The Man in the High Castle', 'Philip K. Dick'], [101, 'Red Padavan', 'Victor Dubchek'], [102, 'Foundation', 'Isaac Asimov'],
  [103, 'The Fellowship of the Ring', 'Tolkien'], [104, 'The Gods Hate Kansas', 'Joseph Millard'], [105, 'Gladiator-at-Law', 'Frederik Pohl'],
  [106, 'The Four Redheads: Apocalypse Now', 'Julia Mandala'], [107, 'No Doors, No Windows', 'Harlan Ellison'], [108, 'The Shining', 'Stephen King'],
  [109, 'The Little People', 'John Christopher'], [110, 'Manseed', 'Jack Williamson'], [111, 'Heaven Cent', 'Piers Anthony'],
  [112, 'The Human Bat v the Robot Gangster', 'Home-Gall'], [113, 'The Metamorphosis', 'Franz Kafka'],
  [114, 'Harry Potter and the Order of the Phoenix', 'Rowling'], [115, 'Stress Pattern', 'Neal Barrett'], [116, 'Animorphs', 'Applegate'],
  [117, 'Jurassic Park', 'Michael Crichton'], [118, 'Tainted Souls', 'Allan T. Price'], [119, 'Friday', 'Robert A. Heinlein'],
  [120, 'An Anthropomorphic Century', 'Fred Patten'], [121, 'Odd John', 'Olaf Stapledon'], [122, 'Dune', 'Frank Herbert'],
  [123, 'A Wrinkle in Time', "Madeleine L'Engle"], [124, 'Monsters & Mormons', 'William Morris'], [125, 'Chrome', 'George Nader'],
  [126, 'The Plant Killers', 'Robert Silverberg'], [127, 'The Zap Gun', 'Philip K. Dick'], [128, 'Gumshoe Gorilla', 'Keith Hartman'],
  [129, 'Roderick', 'John Sladek'], [130, 'Tik-Tok', 'John Sladek'], [131, 'The Heaven Makers', 'Frank Herbert'],
  [132, 'The Chessmen of Mars', 'Edgar Rice Burroughs'], [133, 'Chrome', 'George Nader'], [134, 'Winter World', 'C. J. Mills'],
  [136, 'Galaxy 666', 'Lionel Fanthorpe'], [137, 'Jurassic Park', 'Michael Crichton'], [138, 'The Shadow over Innsmouth', 'Lovecraft'],
  [139, 'The Rivals of Dracula', 'Michel Parry'], [140, 'Stellar Arkadia', 'David L. Gauthier'], [141, 'Out of the Silent Planet', 'C. S. Lewis'],
  [143, 'Crystal Line', 'Anne McCaffrey'], [144, 'Onio', 'Linell Jeppsen'], [145, 'The Running Man', 'Stephen King'],
  [146, 'Marauders of Gor', 'John Norman'], [147, 'The Martian Chronicles', 'Ray Bradbury'], [148, 'Nightchild', 'Scott Baker'],
  [149, 'Rats, Bats & Vats', 'Dave Freer'], [150, 'A Coven of Vampires', 'Brian Lumley'], [151, 'The Right to Arm Bears', 'Gordon R. Dickson'],
  [152, "Ender's Game", 'Orson Scott Card'], [153, 'Taurus Four', 'Rena Vale'], [154, 'The Fascinating Life of Animal Robots', 'T. K. Wade'],
  [155, "Dagger's Point", 'Anne Logston'], [156, 'Messiah Clears the Disk', 'Oldie'], [157, 'Pilgrimage', 'Drew Mendelson'],
  [158, 'Glitter Ponies', 'Lita Burke'], [160, 'Star Surgeon', 'James White'], [161, 'Hijack', 'Edward Wellen'],
  [162, 'Catalyst', 'Alan Dean Foster'], [163, 'The Hobbit', 'Tolkien'], [164, 'Flux', 'Ron Goulart'], [165, 'Satan Sublets', 'Jack Younger'],
  [166, 'Roderick', 'John Sladek'], [167, 'A Prisoner of Mars', 'Rob Dorsey'], [168, 'Bug Park', 'James P. Hogan'],
  [169, 'CLD: Collective Landing Detachment', 'Victor Milan'], [170, 'The Three-Legged Hootch Dancer', 'Mike Resnick'],
  [171, "The Cat's Eye", 'William W. Johnstone'], [172, 'Unter dem Galornenstern', 'Robert Feldhoff'], [173, 'Lady Killer', 'Chad Oliver'],
  [174, 'The Little People', 'John Christopher'], [175, 'Frankenstein', 'Mary Shelley'], [176, 'The First Tribe', 'Candace Smith'],
  [177, 'The E.S.P. Worm', 'Robert Margroff'], [178, 'The Eggchild', 'Lorna Baxter'], [180, "The Hitchhiker's Guide to the Galaxy", 'Douglas Adams'],
  [181, 'Safe Haven', 'Xander Jane'], [182, 'Mathematics', 'Margaret Ball'], [183, 'Swords in the Mist', 'Fritz Leiber'],
  [184, 'Pagan Passions', 'Randall Garrett'], [185, 'Trader to the Stars', 'Poul Anderson'], [186, 'Earth Abides', 'George R. Stewart'],
  [187, 'A Wrinkle in Time', "Madeleine L'Engle"], [188, 'The Word for World Is Forest', 'Ursula K. Le Guin'], [189, 'Myndset', 'Jake Simpson'],
  [190, 'The Ice Dragon', 'Jeffrey Lord'], [192, 'Program for Destruction', 'Franklin W. Dixon'], [193, 'Ring-a-Ding UFOs', 'Bob Tralins'],
  [194, 'The Ruins of Dantooine', 'Voronica Whitney-Robinson'], [195, 'The Stainless Steel Rat for President', 'Harry Harrison'],
  [196, 'Venus on the Half-Shell', 'Philip Jose Farmer'], [197, 'The Fellowship of the Ring', 'Tolkien'], [198, 'Bill, the Galactic Hero', 'Harry Harrison'],
  [199, "Baphomet's Meteor", 'Pierre Barbet'],
];

/** Editions walked per work at most; the classics have more than a thousand. */
const MAX_EDITIONS = 1200;
const CATALOGUE_PAUSE_MS = 3000;
const COVER_PAUSE_MS = 250;

interface Cache {
  works: Record<string, { id: string; title: string; author: string } | null>;
  editions: Record<string, { coverId: number; publisher?: string; year?: string; isbn?: string }[]>;
  hashes: Record<string, string | null>;
}

const cache: Cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : { works: {}, editions: {}, hashes: {} };
const save = () => fs.writeFileSync(CACHE, JSON.stringify(cache));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Through the live site instead of from this Mac (`VIA_SITE=1`, 2026-10-08): Open Library
 * refused this address twice in a week, and the site asks it from Vercel with its own cache.
 * Its search and its Shelf-Portrait cover list are what the site serves anyway; one request
 * every six seconds keeps inside their rate limits.
 */
const VIA_SITE = process.env.VIA_SITE === '1';
const SITE = 'https://buyitscovers.com';
const SITE_PAUSE_MS = 6000;
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;

async function siteJson<T>(url: string): Promise<T> {
  await sleep(SITE_PAUSE_MS);
  const res = await fetch(url, { headers: { 'user-agent': 'BuyItsCovers-curation/1.0' }, signal: AbortSignal.timeout(40000) });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return (await res.json()) as T;
}

async function findWork(title: string, author: string) {
  const key = `${title}|${author}`;
  if (key in cache.works && (cache.works[key] || !VIA_SITE)) return cache.works[key];
  if (VIA_SITE) {
    // Title and author first, then the title alone: the site's search finds nothing for some
    // pairs (hyphens, a pen name) and the author then sorts the title's results.
    const surname = norm(author).split(' ').pop() ?? '';
    const plain = title.replace(/[-:]/g, ' ');
    let hit: { id: string; title: string; authors: string[] } | undefined;
    for (const q of [`${plain} ${surname}`, plain]) {
      const { works } = await siteJson<{ works: { id: string; title: string; authors: string[] }[] }>(`${SITE}/api/search?q=${encodeURIComponent(q)}`);
      hit = works.find((w) => w.authors.some((a) => norm(a).includes(surname)));
      if (hit) break;
    }
    cache.works[key] = hit ? { id: hit.id, title: hit.title, author: hit.authors[0] ?? author } : null;
    save();
    return cache.works[key];
  }
  await sleep(CATALOGUE_PAUSE_MS);
  const docs = await searchWorks(`${title} ${author}`);
  const surname = norm(author).split(' ').pop() ?? '';
  const hit = docs.find((d) => d.authors.some((a) => norm(a).includes(surname)));
  cache.works[key] = hit ? { id: hit.id, title: hit.title, author: hit.authors[0] ?? author } : null;
  save();
  return cache.works[key];
}

async function editionsOf(workId: string) {
  if (cache.editions[workId]) return cache.editions[workId];
  const out: Cache['editions'][string] = [];
  if (VIA_SITE) {
    for (let from = 0; from < MAX_EDITIONS; from += 300) {
      const page = await siteJson<{ covers: { coverId: string; year?: number; publisher?: string }[]; checked: number; total: number }>(`${SITE}/api/inspiration/covers/${workId}${from ? `?from=${from}` : ''}`);
      for (const c of page.covers) out.push({ coverId: Number(c.coverId.replace('ol:', '')), publisher: c.publisher, year: c.year ? String(c.year) : undefined });
      if (page.checked >= page.total) break;
    }
    cache.editions[workId] = out.filter((e) => e.coverId > 0);
    save();
    return cache.editions[workId];
  }
  for (let offset = 0; offset < MAX_EDITIONS; offset += 100) {
    await sleep(CATALOGUE_PAUSE_MS);
    const page = await getEditionsPage(workId, offset, 100);
    for (const e of page.entries) {
      for (const c of e.covers ?? []) {
        if (c > 0) out.push({ coverId: c, publisher: e.publishers?.[0], year: e.publish_date, isbn: e.isbn_13?.[0] ?? e.isbn_10?.[0] });
      }
    }
    if (offset + 100 >= page.size || page.entries.length === 0) break;
  }
  cache.editions[workId] = out;
  save();
  return out;
}

async function coverHash(coverId: number): Promise<string | null> {
  const key = String(coverId);
  if (key in cache.hashes) return cache.hashes[key];
  await sleep(COVER_PAUSE_MS);
  try {
    const res = await fetch(`https://covers.openlibrary.org/b/id/${coverId}-S.jpg`, { signal: AbortSignal.timeout(15000) });
    const sig = res.ok ? signature(new Uint8Array(await res.arrayBuffer())) : null;
    cache.hashes[key] = sig?.hash ?? null;
  } catch {
    return null; // not cached: a timeout is not an answer
  }
  if (Object.keys(cache.hashes).length % 50 === 0) save();
  return cache.hashes[key];
}

function postHash(rank: number): string | null {
  const file = fs.readdirSync(PICS).find((f) => f.startsWith(String(rank).padStart(3, '0') + '.'));
  if (!file) return null;
  return signature(new Uint8Array(fs.readFileSync(path.join(PICS, file))))?.hash ?? null;
}

async function main() {
  const results: { rank: number; title: string; author: string; status: string; [k: string]: unknown }[] = [];
  for (const [rank, title, author] of [...POSTS, ...POSTS_2].filter(([r]) => !ONLY || ONLY.has(r))) {
    const mine = postHash(rank);
    const work = await findWork(title, author);
    if (!mine || !work) {
      results.push({ rank, title, author, status: !mine ? 'no picture' : 'no work' });
      console.log(rank, title, '—', !mine ? 'no picture' : 'no work');
      continue;
    }
    const editions = await editionsOf(work.id);
    let best: { coverId: number; distance: number; publisher?: string; year?: string; isbn?: string } | null = null;
    const seen = new Set<number>();
    const ranked: { coverId: number; distance: number; publisher?: string; year?: string; isbn?: string }[] = [];
    const unique = editions.filter((e) => !seen.has(e.coverId) && seen.add(e.coverId));
    // Three covers at a time: the cover host is not the catalogue, and one at a time took an hour per classic.
    for (let i = 0; i < unique.length; i += 3) {
      const batch = unique.slice(i, i + 3);
      const hashes = await Promise.all(batch.map((e) => coverHash(e.coverId)));
      for (let j = 0; j < batch.length; j++) {
        const h = hashes[j];
        if (!h) continue;
        const distance = hamming(mine, h);
        if (!best || distance < best.distance) best = { ...batch[j], distance };
        ranked.push({ ...batch[j], distance });
      }
      if (best && best.distance <= 4) break;
    }
    // Photos of a book on a table sit 18-26 bits from a clean scan of the same cover, so the
    // hash only orders the candidates; the decision is made by looking at a contact sheet.
    ranked.sort((a, b) => a.distance - b.distance);
    const status = !best ? 'no covers' : best.distance <= 10 ? 'match' : best.distance <= 16 ? 'unsure' : 'none';
    results.push({ rank, title, author, work, covers: seen.size, status, best, candidates: ranked.slice(0, 8) });
    console.log(rank, title, '→', work.id, status, best ? `d=${best.distance} cover ${best.coverId}` : '', `(${seen.size} covers)`);
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  }
  save();
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  const n = (s: string) => results.filter((r) => r.status === s).length;
  console.log(`\nmatch ${n('match')}, unsure ${n('unsure')}, none ${n('none')}, no work ${n('no work')}, no covers ${n('no covers')}`);
}

main();
