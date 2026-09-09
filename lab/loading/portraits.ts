/**
 * Finds a public-domain portrait for each author of the rotation
 * (lab/loading/README.md, ROADMAP 6.19a).
 *
 *   npx tsx lab/loading/portraits.ts            # fills in what templates.json is missing
 *   npx tsx lab/loading/portraits.ts --force    # looks all of them up again
 *
 * **Guessing a file name on Commons does not work** — of 26 plausible names
 * tried by hand on 2026-09-09, two existed. The portrait therefore comes from
 * Wikidata: the author's item, its `P18` (image), and Commons' own licence
 * field for that file. An author whose picture is not marked public domain is
 * left out with a reason rather than used, because the target picture is the
 * one part of a mosaic whose rights are ours to get right (the covers are the
 * open question in 5.5, and adding a second one would be careless).
 *
 * The result is `templates.json`, which is committed. The pictures it points
 * at are not: they are rebuilt by `build-all.ts`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchJson } from '../../lib/sources/http';

const TEMPLATES = path.join('lab', 'loading', 'templates.json');
const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

/** Wikidata occupation ids that make an item plausibly the writer we mean. */
const WRITING_OCCUPATIONS = new Set([
  'Q36180',    // writer
  'Q6625963',  // novelist
  'Q49757',    // poet
  'Q214917',   // playwright
  'Q482980',   // author
  'Q1930187',  // journalist
  'Q4853732',  // children's writer
  'Q11774202', // essayist
  'Q12144794', // short story writer
]);

/** A licence we are willing to put on the site without further thought. */
function isPublicDomain(licence: string): boolean {
  const l = licence.toLowerCase();
  return l.includes('public domain') || l.includes('pd-') || l === 'cc0';
}

export interface Template {
  id: string;
  /** The name as it goes to Open Library's search. */
  author: string;
  /** Wikidata item, so the lookup can be repeated or checked by hand. */
  item: string;
  /** A `Special:FilePath` address, which is stable where a thumbnail URL is not. */
  target: string;
  credit: string;
  /** Why an author is not in the rotation, when they are not. */
  skipped?: string;
  /** In the twenty that are built, or held in reserve behind them. */
  rotation?: boolean;
  /**
   * The part of the portrait the mosaic is built from, as fractions of the
   * source: `[x, y, width, height]`.
   *
   * Set by hand for the portraits that are not head-and-shoulders. Tolstoy's
   * colour photograph of 1908 has him seated among trees, and his head is a
   * twentieth of the picture: cutting it to 3:4 keeps the head and spends
   * 1,400 cells on a garden. Nothing here detects a face — twenty pictures
   * were looked at, and the handful that needed a frame got one.
   */
  crop?: [number, number, number, number];

  /**
   * What to ask Open Library, when it files the author under another name.
   *
   * Tolstoy's works are under „Лев Толстой"; searching „Leo Tolstoy" finds
   * fourteen results, of which the ones by him are outnumbered by books
   * *about* him. The caption still says the name in `author`.
   */
  openLibrary?: string;
}

interface SearchResponse { search: { id: string; label: string; description?: string }[] }
interface EntitiesResponse {
  entities: Record<string, {
    labels?: Record<string, { value: string }>;
    claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]>;
  }>;
}
interface CommonsResponse {
  query?: { pages: Record<string, { title: string; imageinfo?: { width: number; height: number; extmetadata?: Record<string, { value: string }> }[] }> };
}

const ask = <T>(url: string) => fetchJson<T>(url, { timeoutMs: 20_000, revalidate: 0 });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function claimIds(claims: EntitiesResponse['entities'][string]['claims'], property: string): string[] {
  return (claims?.[property] ?? [])
    .map(c => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((id): id is string => typeof id === 'string');
}

function claimStrings(claims: EntitiesResponse['entities'][string]['claims'], property: string): string[] {
  return (claims?.[property] ?? [])
    .map(c => c.mainsnak.datavalue?.value)
    .filter((v): v is string => typeof v === 'string');
}

/** The author's item on Wikidata, and the file name of its picture. */
async function portraitOf(author: string): Promise<{ item: string; file: string } | { skipped: string }> {
  const found = await ask<SearchResponse>(
    `${WIKIDATA}?action=wbsearchentities&format=json&language=en&type=item&limit=5&search=${encodeURIComponent(author)}`,
  );
  if (found.search.length === 0) return { skipped: 'no Wikidata item under that name' };
  const ids = found.search.map(s => s.id);
  const entities = await ask<EntitiesResponse>(
    `${WIKIDATA}?action=wbgetentities&format=json&props=claims&ids=${ids.join('|')}`,
  );
  for (const id of ids) {
    const claims = entities.entities[id]?.claims;
    const writes = claimIds(claims, 'P106').some(o => WRITING_OCCUPATIONS.has(o));
    const file = claimStrings(claims, 'P18')[0];
    if (writes && file) return { item: id, file };
  }
  return { skipped: 'no item that both writes and has a picture' };
}

/**
 * Commons metadata is HTML with Wikidata's own qualifier syntax glued to the
 * end of a date ("1867date QS:P,+1867-00-00…"). A credit line under a
 * picture may not contain that, so everything from `date QS:` on is cut.
 */
function plain(value: string | undefined): string {
  const once = (text: string) => {
    // Commons sometimes carries the artist twice ("Unknown author Unknown author").
    const half = Math.floor(text.length / 2);
    return text.slice(0, half).trim() === text.slice(half).trim() ? text.slice(0, half).trim() : text;
  };
  return once((value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/date QS:[\s\S]*$/, '')
    .replace(/\s*(circa|between)?\s*$/, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/[,;]\s*$/, '')
    .trim())
    .slice(0, 90);
}

/** What Commons says about that file: how big it is and under what licence. */
async function licenceOf(file: string): Promise<{ credit: string } | { skipped: string }> {
  const answer = await ask<CommonsResponse>(
    `${COMMONS}?action=query&format=json&prop=imageinfo&iiprop=size|extmetadata&titles=${encodeURIComponent(`File:${file}`)}`,
  );
  const page = Object.values(answer.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return { skipped: 'Commons does not have that file' };
  const meta = info.extmetadata ?? {};
  const licence = meta.LicenseShortName?.value ?? '';
  if (!isPublicDomain(licence)) return { skipped: `not public domain (${licence || 'no licence field'})` };
  // A portrait smaller than the mosaic's own grid has nothing to give it.
  if (info.width < 500 || info.height < 500) return { skipped: `too small (${info.width}x${info.height})` };
  return { credit: [plain(meta.Artist?.value), plain(meta.DateTimeOriginal?.value), 'gemeinfrei (Wikimedia Commons)'].filter(Boolean).join(', ') };
}

async function main() {
  const force = process.argv.includes('--force');
  const templates = JSON.parse(await readFile(TEMPLATES, 'utf8')) as Template[];
  let looked = 0;
  for (const template of templates) {
    if (template.target && !force) continue;
    looked++;
    const portrait = await portraitOf(template.author);
    if ('skipped' in portrait) {
      template.skipped = portrait.skipped;
      console.log(`  ${template.author}: ${portrait.skipped}`);
      await wait(400);
      continue;
    }
    const licence = await licenceOf(portrait.file);
    if ('skipped' in licence) {
      template.skipped = licence.skipped;
      console.log(`  ${template.author}: ${licence.skipped}`);
      await wait(400);
      continue;
    }
    template.item = portrait.item;
    template.target = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(portrait.file)}?width=1200`;
    template.credit = licence.credit;
    delete template.skipped;
    console.log(`  ${template.author}: ${portrait.file} — ${licence.credit}`);
    // Wikimedia answers 429 to a burst; a lookup of twenty authors is not a
    // reason to be rude about it.
    await wait(400);
  }
  await writeFile(TEMPLATES, `${JSON.stringify(templates, null, 1)}\n`);
  const ready = templates.filter(t => t.target && !t.skipped).length;
  console.log(`${looked} looked up, ${ready} of ${templates.length} templates have a public-domain portrait`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
