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
const OUT = path.join(IN, 'badscificovers-matches.json');

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

async function findWork(title: string, author: string) {
  const key = `${title}|${author}`;
  if (key in cache.works) return cache.works[key];
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
  for (const [rank, title, author] of POSTS) {
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
