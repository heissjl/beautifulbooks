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
import { pickCompareCovers } from '../lib/comparepin';
import { collectionPin, comparePin, decadePin, PIN_DESCRIPTION_MAX, PIN_TITLE_MAX, type Pin } from '../lib/pins';
import { authorLine } from '../lib/seo';
import { getWorkDetail, MAX_EDITIONS_SCANNED } from '../lib/work';
import { foldDuplicateCovers } from '../lib/works';

const LIVE = 'https://buyitscovers.com';
/** The board for the comparison pins, one of the two Julian is setting up (2026-10-31); the decades board already carries one pin per work. */
const COMPARE_BOARD = 'Beautiful Books with Pretty Covers';
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

/**
 * Comparison pins whose three covers were chosen by eye, by work: these ids
 * go into the picture's address in place of the decade rule's pick. Empty
 * until someone looks — the rule's oldest records are often the least
 * reliable (below).
 */
const COMPARE_COVERS: Record<string, readonly string[]> = {};

/**
 * What was seen on the left cover of each comparison pin, the oldest the
 * rule picked (2026-10-31, each image fetched once from covers.openlibrary.org
 * and looked at): printed under the table so that nobody uploads a year the
 * picture contradicts. A work without a line was not looked at.
 */
const COMPARE_SEEN: Record<string, string> = {
  OL82563W: 'links der Bloomsbury-Entwurf von 1997, aber mit „Triple Smarties Gold Award Winner“ — ein späterer Druck dieses Entwurfs; in der Mitte steht unter „Bloomsbury Pub Ltd, 2000“ die brasilianische Rocco-Ausgabe („a Pedra Filosofal“) — **Verlag falsch für das Bild**',
  OL1168007W: 'links Secker & Warburg, der grün-weiße Umschlag — passt zu 1945',
  OL1168083W: 'links ein Bibliothekseinband mit Strichcode, kein Umschlag — als Pin schwach, andere Cover wählen',
  OL257943W: 'links der heutige Umschlag von Plaza & Janés („Juego de tronos“), nicht 1996 — **Jahr falsch für das Bild**',
  OL27482W: 'links ein Taschenbuch „The enchanting prelude to The Lord of the Rings“, Jahrzehnte nach 1937, Random House stimmt nicht — **Jahr falsch für das Bild**',
  OL64365W: 'links blaues Leinen ohne Umschlag; „HarperCollins 1932“ stimmt als Verlag nicht (die Erstausgabe ist Chatto & Windus) — andere Cover wählen',
  OL893414W: 'links nicht Schoenherrs Umschlag der Chilton-Ausgabe von 1965 — vermutlich eine andere Ausgabe unter dem Datum der ersten; **Jahr fraglich**',
  OL103123W: 'links ein Flammengesicht mit Bibliotheksaufkleber, nicht Mugnainis Umschlag der Ballantine-Erstausgabe von 1953 — vermutlich ein späterer Druck; **Jahr fraglich**',
  OL81613W: 'links unter „Simon and Schuster, 1986“ das Filmcover von 2017 („Now a major motion picture“, Pennywise) — **Jahr falsch für das Bild**; die Mitte (1991, ohne Verlag) ist eine japanische Ausgabe',
  OL27513W: 'links eine Titelseite mit „Second Edition“, kein Cover und nicht 1954 — **Jahr falsch für das Bild**',
};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
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

async function decadeRow(id: string, origin: string): Promise<{ decade: Pin; compare: Pin | null } | null> {
  // The decade page's own reading (app/book/[id]/decades/page.tsx): the same cap, no Google, folded from the index.
  const detail = await getWorkDetail(id, { maxEntries: MAX_EDITIONS_SCANNED, dedupeCovers: false, googleBooks: false });
  if (!detail) return null;
  if (!detail.complete) throw new Error(`${id}: Open Library stopped answering part of the way — run again later`);
  const covers = foldDuplicateCovers(detail.covers, indexSignatures(detail.covers.map(c => c.id)), detail.editions);
  const decades = groupByDecade(covers, detail.editions);
  if (!worthAPage(decades)) return null;
  const three = pickCompareCovers(covers, detail.editions, COMPARE_COVERS[id] ?? [], 3, 0);
  const compare = three.length === 3
    ? comparePin({
      id,
      board: COMPARE_BOARD,
      title: detail.work.title,
      author: authorLine(detail.work.authors),
      // Left to right as the picture sets them: by year (the route's `compareOrder`), or as chosen by eye.
      editions: (COMPARE_COVERS[id] ? [...three] : [...three].sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity))).map(c => ({ coverId: c.cover.id, year: c.year, publisher: c.publisher })),
      covers: covers.length,
    }, origin)
    : null;
  const decade = decadePin({
    id,
    title: detail.work.title,
    author: authorLine(detail.work.authors),
    covers: decades.coverCount,
    records: detail.editions.filter(e => e.year).length,
    from: decades.from ?? 0,
    to: decades.to ?? 0,
  }, origin);
  return { decade, compare };
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

async function main(): Promise<void> {
  const date = arg('--date', new Date().toISOString().slice(0, 10));
  const origin = arg('--origin', LIVE);
  const out = path.join(process.cwd(), 'docs', `pins-${date}.md`);

  const rows: Pin[] = [];
  const compares: Pin[] = [];
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
    // A whole work is several catalogue pages; ten of them back to back, beside a dev server, got this
    // address refused on 2026-10-31 (umgang.md §1). Ten seconds between works.
    await new Promise(resolve => setTimeout(resolve, 10_000));
    if (row) {
      rows.push(row.decade);
      if (row.compare) compares.push(row.compare);
    }
  }

  for (const r of [...rows, ...compares]) {
    if (r.title.length > PIN_TITLE_MAX || r.description.length > PIN_DESCRIPTION_MAX) throw new Error(`${r.link}: title ${r.title.length} / description ${r.description.length} characters — past Pinterest's limit`);
  }

  const lines = [
    `# Pins für Pinterest, Stand ${date}`,
    '',
    `Erzeugt von \`scripts/pin-list.ts\` (ROADMAP 5.5a, [Plan §7](plans/PLAN-5.5-5.6-kanaele.md#7-wie-auf-pinterest-posten-julian-2026-10-04-wie-sollte-ich-auf-pinterest-posten)). Hochladen von Hand, etwa zwei Pins am Tag über Pinterests eigene Planung; nie dasselbe Bild zweimal auf dieselbe Pinnwand. Die Bild-Adressen antworten, sobald 5.5a auf der Produktion liegt (\`/book/<id>/pin.jpg\`, \`/collections/<slug>/pin.jpg\`, die Vergleichs-Pins \`/book/<id>/compare.jpg?covers=…\`, alle 1000 × 1500); bis dahin das Bild vom Dev-Server speichern. Die Zahlen in den Beschreibungen sind die Zählung der jeweiligen Seite am ${date} (Jahrzehnte: Cover mit bekanntem Jahr, aus dem Index gefaltet; keine Google-Anfrage). Jeder Link trägt \`?via=pinterest\`, die Klasse, die \`/admin/insights\` als Eingang zählt (K14).`,
    '',
    '| # | Pinnwand | Bild | Titel | Beschreibung | Link |',
    '|---|---|---|---|---|---|',
    ...rows.map((r, i) => `| ${i + 1} | ${cell(r.board)} | ${r.picture} | ${cell(r.title)} | ${cell(r.description)} | ${r.link} |`),
    '',
  ];
  if (compares.length > 0) {
    lines.push(
      '## Vergleichs-Pins',
      '',
      'Je Werk der Jahrzehnte-Liste ein Bild mit drei Ausgaben nebeneinander, Jahr und Verlag darunter: das älteste Cover mit bekanntem Jahr und die ältesten zweier weiterer Jahrzehnte (`lib/comparepin.ts`), die Cover-Ids stehen in der Bild-Adresse. Der Link öffnet das erste der drei auf der Buchseite. Die Sammlungen haben keinen Vergleichs-Pin — sie sind viele Bücher, nicht eines. Pinnwand ist ein Vorschlag; Julian legt die Pinnwände an. **Vor dem Hochladen jedes Bild ansehen:** Jahr und Verlag sind die des frühesten datierten Katalogeintrags, der dieses Bild trägt — ein Eintrag mit dem Jahr der Erstausgabe kann das Foto eines späteren Nachdrucks halten (umgang.md §8, ein ISBN ist kein Druck); ein Pin mit falscher Jahreszahl bekommt andere Cover über `?covers=`.',
      '',
      '| # | Pinnwand | Bild | Titel | Beschreibung | Link |',
      '|---|---|---|---|---|---|',
      ...compares.map((r, i) => `| V${i + 1} | ${cell(r.board)} | ${r.picture} | ${cell(r.title)} | ${cell(r.description)} | ${r.link} |`),
      '',
    );
    const seen = compares.map((r, i) => {
      const id = /\/book\/(OL\d+W)\//.exec(r.picture)?.[1] ?? '';
      if (COMPARE_COVERS[id]) return `- V${i + 1}: drei Cover von Hand gewählt`;
      return COMPARE_SEEN[id] ? `- V${i + 1}: ${COMPARE_SEEN[id]}` : `- V${i + 1}: nicht angesehen`;
    });
    lines.push('**Angesehen am 2026-10-31 (das linke Cover, das älteste nach der Regel; bei Harry Potter und It das ganze Bild):**', '', ...seen, '');
  }
  if (skipped.length > 0) {
    lines.push('**Ausgelassen:**', '', ...skipped.map(s => `- ${s}`), '');
  }
  lines.push(`${rows.length + compares.length} Pins: ${COLLECTIONS.length} Sammlungen, ${rows.length - COLLECTIONS.length} Jahrzehnte-Seiten, ${compares.length} Vergleichs-Pins. Reihenfolge der Jahrzehnte-Seiten nach \`data/popular-works.json\` (Open Librarys Meistgelesene vom ${popular.builtAt}), nur Werke mit Jahrzehnte-Seite (\`data/decade-pages.json\` vom ${decadePages.builtAt}).`, '');
  writeFileSync(out, lines.join('\n'));
  console.log(`${rows.length + compares.length} pins → ${path.relative(process.cwd(), out)}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
