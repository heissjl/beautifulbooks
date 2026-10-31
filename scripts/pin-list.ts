/**
 * The list of pins for Julian to upload by hand (ROADMAP 5.5a, PLAN-5.5-5.6
 * §7: two a day through Pinterest's own scheduling, never the same picture
 * twice on one board).
 *
 *   npx tsx scripts/pin-list.ts [--date 2026-10-31] [--origin https://buyitscovers.com]
 *
 * Writes `docs/pins-<date>.md`: one row per pin — picture, board, title,
 * description, link with `?via=pinterest` — for the published collections
 * named below and the decade pages of the most-read works that carry one.
 * The numbers in a description are what the page counts that day: the
 * script runs the decade page's own counting (`lib/decades.ts`, folded from
 * the built index) against Open Library, one work at a time, **never Google
 * Books** (`googleBooks: false`, E10). The collections come from the file
 * and the published switches, not from a signed-in view.
 *
 * "Most visited" is read from `data/popular-works.json` (Open Library's
 * most-read, 2026-10-05) crossed with `data/decade-pages.json`: the works
 * table in /admin/insights needs Julian's cookie and the store, which a
 * script on this Mac has neither of. A work whose catalogue title is not the
 * one people search for is skipped and named at the foot of the file.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import decadePages from '../data/decade-pages.json';
import popular from '../data/popular-works.json';
import { liveCollectionBySlug } from '../lib/collections-live';
import { indexSignatures } from '../lib/coverindex';
import { groupByDecade, worthAPage } from '../lib/decades';
import { collectionPin, decadePin, PIN_DESCRIPTION_MAX, PIN_TITLE_MAX, type Pin } from '../lib/pins';
import { authorLine } from '../lib/seo';
import { getWorkDetail, MAX_EDITIONS_SCANNED } from '../lib/work';
import { foldDuplicateCovers } from '../lib/works';

const LIVE = 'https://buyitscovers.com';
const DECADE_PINS = 10;

/** The published collections, each with what its covers are called in the title (after the count). */
const COLLECTIONS: Array<{ slug: string; what: string }> = [
  { slug: 'sf-masterworks', what: 'science fiction book covers' },
  { slug: 'feminist-press', what: 'book covers from its list' },
  { slug: 'tiptree-award', what: 'book covers of the award’s winners' },
];

/** Works left out of the decade list, with the reason, named at the foot of the file. */
const SKIPPED: Record<string, string> = {
  OL796465W: 'the catalogue title is „O Alquimista“ — the pin would carry the Portuguese title, not „The Alchemist“ that people search for; Julian decides',
};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/**
 * The publishers most often on record, at most three. Spellings of one house
 * are counted together — "Ace" and "Ace Books", "Penguin" and "Penguin Books
 * Ltd" — by dropping the words that only say it is a company; shown is the
 * shortest spelling, and a record in capitals is set in title case.
 */
function topPublishers(editions: ReadonlyArray<{ publisher?: string }>, limit = 3): string[] {
  const counts = new Map<string, { name: string; n: number }>();
  for (const e of editions) {
    const raw = e.publisher?.trim();
    if (!raw) continue;
    const name = raw === raw.toUpperCase() && /[A-Z]{3,}/.test(raw) ? raw.toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase()) : raw;
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(books?|publishers?|publishing|press|inc|ltd|limited|co|company|gmbh|verlag|editions?|editorial)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (!key) continue;
    const entry = counts.get(key) ?? { name, n: 0 };
    entry.n++;
    if (name.length < entry.name.length) entry.name = name;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, limit).map(p => p.name);
}

/** The first books on the wall, each title once and short enough to read in a description: a printing shown twice names its book once. */
function firstTitles(works: ReadonlyArray<{ title: string }>, limit = 3, maxLength = 36): string[] {
  const out: string[] = [];
  for (const w of works) {
    if (out.length >= limit) break;
    if (w.title.length <= maxLength && !out.includes(w.title)) out.push(w.title);
  }
  return out;
}

async function collectionRow(slug: string, what: string, origin: string): Promise<Pin> {
  const c = await liveCollectionBySlug(slug, { includeDrafts: false });
  if (!c) throw new Error(`${slug}: not a published collection`);
  const artists: string[] = [];
  for (const w of c.works) for (const a of w.coverArtists ?? []) if (!artists.includes(a) && artists.length < 3) artists.push(a);
  return collectionPin({
    slug,
    title: c.title,
    what,
    count: c.works.length,
    firstTitles: firstTitles(c.works),
    artists,
    creditSource: c.coverCredits === 'isfdb' ? 'ISFDB' : undefined,
  }, origin);
}

async function decadeRow(id: string, origin: string): Promise<Pin | null> {
  // The decade page's own reading (app/book/[id]/decades/page.tsx): the same cap, no Google, folded from the index.
  const detail = await getWorkDetail(id, { maxEntries: MAX_EDITIONS_SCANNED, dedupeCovers: false, googleBooks: false });
  if (!detail) return null;
  if (!detail.complete) throw new Error(`${id}: Open Library stopped answering part of the way — run again later`);
  const covers = foldDuplicateCovers(detail.covers, indexSignatures(detail.covers.map(c => c.id)), detail.editions);
  const decades = groupByDecade(covers, detail.editions);
  if (!worthAPage(decades)) return null;
  return decadePin({
    id,
    title: detail.work.title,
    author: authorLine(detail.work.authors),
    covers: decades.coverCount,
    records: detail.editions.filter(e => e.year).length,
    from: decades.from ?? 0,
    to: decades.to ?? 0,
    publishers: topPublishers(detail.editions),
  }, origin);
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

async function main(): Promise<void> {
  const date = arg('--date', new Date().toISOString().slice(0, 10));
  const origin = arg('--origin', LIVE);
  const out = path.join(process.cwd(), 'docs', `pins-${date}.md`);

  const rows: Pin[] = [];
  for (const { slug, what } of COLLECTIONS) rows.push(await collectionRow(slug, what, origin));

  const withPage = new Set(decadePages.pages.map(p => p.id));
  const skipped: string[] = [];
  const candidates = popular.works.filter(w => withPage.has(w.id));
  for (const w of candidates) {
    if (rows.length - COLLECTIONS.length >= DECADE_PINS) break;
    if (SKIPPED[w.id]) {
      skipped.push(`${w.title} (${w.id}): ${SKIPPED[w.id]}`);
      continue;
    }
    process.stderr.write(`${w.id} ${w.title} … `);
    const row = await decadeRow(w.id, origin);
    process.stderr.write(row ? 'ok\n' : 'no page\n');
    if (row) rows.push(row);
  }

  for (const r of rows) {
    if (r.title.length > PIN_TITLE_MAX || r.description.length > PIN_DESCRIPTION_MAX) throw new Error(`${r.link}: title ${r.title.length} / description ${r.description.length} characters — past Pinterest's limit`);
  }

  const lines = [
    `# Pins für Pinterest, Stand ${date}`,
    '',
    `Erzeugt von \`scripts/pin-list.ts\` (ROADMAP 5.5a, [Plan §7](plans/PLAN-5.5-5.6-kanaele.md#7-wie-auf-pinterest-posten-julian-2026-10-04-wie-sollte-ich-auf-pinterest-posten)). Hochladen von Hand, etwa zwei Pins am Tag über Pinterests eigene Planung; nie dasselbe Bild zweimal auf dieselbe Pinnwand. Die Bild-Adressen antworten, sobald 5.5a auf der Produktion liegt (\`/book/<id>/pin.jpg\`, \`/collections/<slug>/pin.jpg\`, 1000 × 1500); bis dahin das Bild vom Dev-Server speichern. Die Zahlen in den Beschreibungen sind die Zählung der jeweiligen Seite am ${date} (Jahrzehnte: Cover mit bekanntem Jahr, aus dem Index gefaltet; keine Google-Anfrage). Jeder Link trägt \`?via=pinterest\`, die Klasse, die \`/admin/insights\` als Eingang zählt (K14).`,
    '',
    '| # | Pinnwand | Bild | Titel | Beschreibung | Link |',
    '|---|---|---|---|---|---|',
    ...rows.map((r, i) => `| ${i + 1} | ${cell(r.board)} | ${r.picture} | ${cell(r.title)} | ${cell(r.description)} | ${r.link} |`),
    '',
  ];
  if (skipped.length > 0) {
    lines.push('**Ausgelassen:**', '', ...skipped.map(s => `- ${s}`), '');
  }
  lines.push(`${rows.length} Pins: ${COLLECTIONS.length} Sammlungen, ${rows.length - COLLECTIONS.length} Jahrzehnte-Seiten. Reihenfolge der Jahrzehnte-Seiten nach \`data/popular-works.json\` (Open Librarys Meistgelesene vom ${popular.builtAt}), nur Werke mit Jahrzehnte-Seite (\`data/decade-pages.json\` vom ${decadePages.builtAt}).`, '');
  writeFileSync(out, lines.join('\n'));
  console.log(`${rows.length} pins → ${path.relative(process.cwd(), out)}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
