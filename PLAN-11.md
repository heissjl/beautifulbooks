# Plan für Schritt 11: vollständige Cover-Wand durch fortlaufendes Nachladen

Umsetzungsplan zu SPEC.md §9.3 Schritt 11, geschrieben 2026-09-07 für eine Sitzung, die den Code nicht kennt. Lies vorher CLAUDE.md und SPEC.md §2.3, §3 F2, §9.1 A/B. Code, Kommentare und Commits auf Englisch (E7), dieser Plan auf Deutsch.

## 1. Ziel und Nicht-Ziel

**Ziel.** Die Detailseite zeigt am Ende alle Cover, die Open Library und Google Books zu einem Work kennen, statt der ersten 100 Ausgaben-Datensätze. Sie zeigt sofort etwas (Ladeszene wie heute), lädt dann im Hintergrund Seite für Seite nach und sagt jederzeit, wie weit sie ist: „42 covers · 300 of 1180 editions checked“. Duplikate werden im Client gefaltet, über alle Seiten hinweg, mit Hashes, die der Server pro Seite mitliefert.

**Messlatte (SPEC §9.1 A).** *The Great Gatsby* (OL468431W): heute 43 Cover, Open Library kennt 379 Ausgaben mit Cover. Nach diesem Schritt müssen es nach dem Nachladen mindestens 300 sichtbare Cover sein (379 plus Google minus Faltungen). *Nineteen Eighty-Four* (OL1168083W): heute 68, Ziel ≥ 220. *Beloved* (OL50548W, 110 Ausgaben, eine Seite plus Rest) muss nach einer zweiten Seite fertig sein und darf sich nicht verschlechtern.

**Nicht-Ziel.** Keine neuen Dedupe-Stufen (Schritt 12), keine ISBN-Verifikation (13), kein Mosaik (14), keine neuen Texte außer dem Zähler (15). Keine neue Infrastruktur: der Next-Fetch-Cache reicht, KV kommt mit 8.2.

## 2. Zahlen, die den Entwurf bestimmen

- `editions.json` liefert 100 Einträge pro Aufruf, sortiert nach Anlagedatum absteigend; 25–40 % der Einträge haben Cover. Aus Deutschland 3–5 s pro Seite, gelegentlich 10 s. Gatsby hat 12 Seiten, ein voller Durchlauf ≈ 54 s, sequenziell.
- Der Next-Cache hält jede Seite 24 h (`OL_REVALIDATE.editions`). Der zweite Besucher bekommt alle Seiten in Millisekunden.
- Hashing: 8 Bilder parallel, ein Bild ≈ 100–300 ms nach dem archive.org-Redirect. 40 Cover einer Seite brauchen 2–4 s, wenn sie nicht im Cache sind (`IMAGE_REVALIDATE` 30 Tage).
- Kappung bei 1500 Einträgen (15 Seiten). Werke darüber sind Sammelbände und Bibeln.

## 3. Entwurf

### 3.1 Route: eine Seite pro Aufruf

`GET /api/works/[id]?offset=<0|100|200…>&signatures=<0|1>&lang=&market=`

- `offset=0` (Default) liefert wie heute `work`, `editions` (mit `buyLinks`), `covers`, `market`, dazu neu `page`. Google-Kandidaten (Titelsuche) und die ISBN-Nachschau (`lookupByIsbns`) laufen **nur** auf Seite 0, damit das Google-Kontingent nicht mit der Seitenzahl wächst.
- `offset>0` liefert `editions`, `covers`, `page`, kein `work`, kein `market` nötig (Buy-Links brauchen den Markt trotzdem, also `market` mitgeben).
- `signatures=1` hängt `signatures: Record<coverId, { hash, contrast }>` für die Cover **dieser Seite** an, berechnet mit Budget (`hashDeadlineMs`, siehe 3.3). Ohne den Parameter kein Hashing, das ist der schnelle Pfad für die Ladeszene (ersetzt `stage=fast`).
- `page: { offset, limit: 100, total, nextOffset? }`. `total` ist `size` aus Open Library. `nextOffset` fehlt, wenn die Seite kürzer als 100 war oder `offset + 100 >= total` oder `offset + 100 >= MAX_EDITIONS_SCANNED`.
- `groups` entfällt in der Antwort: Sprachgruppen entstehen im Client über alle Seiten. Die Serverfunktion `groupCoversByLanguage` bleibt in `lib/works.ts`, weil sie rein ist und der Client sie importiert.
- Fehlercodes wie heute: 400 falsche ID, 404 unbekanntes Work, 503 Quelle nicht erreichbar. Für `offset>0` gilt 503 ebenfalls; der Client behandelt es als „Nachladen abgebrochen“, nicht als Seitenfehler.
- Cache-Header unverändert (`s-maxage=86400`, `Vary: Cookie, X-Vercel-IP-Country, Accept-Language`). Jede Kombination aus `offset` und `signatures` ist eine eigene URL und damit ein eigener Cache-Eintrag; das ist gewollt.

### 3.2 Datenschicht (`lib/work.ts`)

Neue Funktion, ersetzt `getWorkDetail` als Arbeitspferd der Route:

```ts
export interface WorkPage {
  work: Work;                 // always loaded (cached 24 h), needed for parseEditions
  editions: Edition[];
  covers: Cover[];
  signatures?: Record<string, ImageSignature>;
  page: { offset: number; limit: number; total: number; nextOffset?: number };
}
export interface WorkPageOptions {
  offset?: number;            // multiple of OL_EDITIONS_PAGE, default 0
  signatures?: boolean;       // hash this page's covers within hashDeadlineMs
  hashDeadlineMs?: number;    // default 4000
}
export async function getWorkPage(workId: string, options?: WorkPageOptions): Promise<WorkPage | null>;
```

Ablauf für `offset = 0`: `getWork` → parallel `getEditionsPage(workId, 0)` und `searchEditionCandidates(title, author)` → `withoutTranslators(work, olEditions)` → `lookupByIsbns` für die neuesten ISBNs der Seite (max. 10, wie heute) → `assembleEditions([...ol, ...gbCandidates, ...isbnCandidates])`. Für `offset > 0`: `getWork` → `getEditionsPage(workId, offset)` → `parseEditions` → `assembleEditions`. Danach optional `hashCovers` mit dem Budget.

`getWorkDetail` bleibt als dünne Hülle für Tests und einen späteren Server-Render: läuft die Seiten bis `MAX_EDITIONS_SCANNED` durch, vereinigt sie mit `mergeWorkPages` (3.4), faltet mit `foldDuplicateCovers` und gruppiert. Die vorhandenen Integrationstests laufen damit weiter, bekommen aber mehr Ausgaben, sobald ein zweiter Fixture-Seitensatz existiert (5.1).

`MAX_EDITIONS_SCANNED = 1500` und `OL_EDITIONS_PAGE = 100` exportieren; der Client importiert beide.

`getEditions` in `lib/sources/openlibrary.ts` (die alte Schleife mit `minWithCovers`) wird nur noch von `getWorkDetail` gebraucht oder gar nicht mehr; wenn ungenutzt, samt Tests entfernen.

### 3.3 Hashing ohne Zeitdruck

- Seite 0 wird zweimal angefragt: erst ohne, dann mit `signatures=1`. Das zweite Mal kostet nur das Hashing, die OL-Daten liegen im Cache. Budget 4 s wie heute.
- Alle weiteren Seiten direkt mit `signatures=1`, Budget 4 s pro Seite. Da der Client sie nacheinander lädt, ist das Hashing praktisch nie der Engpass.
- Was im Budget fehlt, fehlt in `signatures` und bleibt ungefaltet; beim nächsten Besuch sind die Bilder im Cache. Kein Retry im Client.

### 3.4 Reine Merge-Logik (`lib/pages.ts`, neu, ohne I/O)

```ts
export interface MergedWork {
  editions: Edition[];                       // unique by id, first occurrence wins
  covers: Cover[];                           // unique by id, editionIds unioned
  signatures: Map<string, ImageSignature>;   // union
  checked: number;                           // entries scanned so far (sum of page sizes actually returned)
  total: number;
  done: boolean;                             // no nextOffset left, or cap reached, or aborted
  truncated: 'cap' | 'error' | null;
}
export function mergeWorkPages(pages: readonly WorkPage[], status: { done: boolean; truncated: MergedWork['truncated'] }): MergedWork;
export function stableGroupOrder(previous: readonly (string | undefined)[], next: readonly LanguageGroup[]): LanguageGroup[];
```

- Ausgaben gleicher ISBN auf verschiedenen Seiten werden in diesem Schritt **nicht** zusammengeführt (das täte `assembleEditions` nur innerhalb einer Seite). Das ist selten und wird in Schritt 12 über die ISBN-Stufe der Dedupe abgedeckt. Im Code kommentieren.
- `stableGroupOrder`: Die Reihenfolge der Sprach-Tabs wird nach Seite 0 einmal nach Größe bestimmt und danach eingefroren; neue Sprachen werden hinten angehängt, „Unbekannt“ bleibt immer letzter. Sonst wechseln die Tabs während des Nachladens die Plätze.
- Sortierung innerhalb einer Gruppe bleibt Jahr absteigend, unbekanntes Jahr zuletzt (`groupCoversByLanguage` tut das schon). Nachgeladene alte Ausgaben landen dadurch hinten, die Wand springt nicht.

### 3.5 Client-Bundle: `lib/imagehash.ts` aufteilen

`foldDuplicateCovers` importiert `hamming` und `BLANK_CONTRAST` aus `lib/imagehash.ts`, das jpeg-js und pngjs zieht. Das darf nicht in den Browser. Neue Datei `lib/imagesig.ts` mit `ImageSignature`, `hamming`, `BLANK_CONTRAST`, `HASH_BITS`; `imagehash.ts` re-exportiert sie und behält die Decoder. `works.ts` importiert nur noch `imagesig`. Danach mit `npm run build` prüfen, dass die Seite `/book/[id]` kein jpeg-js enthält (Build-Ausgabe der First-Load-JS-Größe vergleichen, vorher/nachher).

### 3.6 Client: `components/useWorkPages.ts` (neu)

Ersetzt den `useEffect` mit `load('fast')` / `load('full')` in `app/book/[id]/page.tsx`.

```ts
export interface WorkPagesState {
  status: 'loading' | 'notfound' | 'error' | 'ready';
  message?: string;
  work?: Work;
  market?: Market;
  pages: WorkPage[];              // page 0 first; page 0 replaced by its signatures=1 twin when that arrives
  page0Hashed: boolean;           // drives the loading scene's dataDone
  merged: MergedWork | null;      // useMemo over pages
}
export function useWorkPages(workId: string, lang: string, market: Market | undefined): WorkPagesState;
```

Ablauf pro `requestKey` (`${id} ${lang} ${market}`), mit `AbortController`, Zustand nur in Callbacks gesetzt (Lint-Regel `react-hooks/set-state-in-effect` ist ein Fehler):

1. `?offset=0` → `status: 'ready'`, `pages: [p0]`. 404/400 → `notfound`, sonst Fehler → `error`.
2. `?offset=0&signatures=1` → `pages[0]` ersetzen, `page0Hashed = true`. Bei Fehler trotzdem `page0Hashed = true` (die Szene darf nicht hängen).
3. Solange `nextOffset` existiert und `< MAX_EDITIONS_SCANNED`: `?offset=<next>&signatures=1`, anhängen. Ein Fehler wird einmal nach 2 s wiederholt, dann `truncated: 'error'`, `done: true`. Sequenziell, nicht parallel: Open Library antwortet auf parallele Editions-Aufrufe nicht schneller, und der Cache wird so sauber Seite für Seite gefüllt.
4. `done: true`, wenn kein `nextOffset` mehr, oder `truncated: 'cap'`, wenn die Kappung greift.

Der Hook liefert zusätzlich `progress: { checked, total, done, truncated }` für den Zähler.

### 3.7 Detailseite (`app/book/[id]/page.tsx`)

- `view` entsteht aus `merged`: `foldDuplicateCovers(merged.covers, merged.signatures)` → `groupCoversByLanguage(folded, merged.editions, preferred)` → `stableGroupOrder(prevOrder, groups)`. Die vorherige Tab-Reihenfolge lebt in einem `useRef`, der nur in `useMemo`-freiem Code (Effekt nach Render) fortgeschrieben wird; **nicht** während des Renders schreiben.
- Ladeszene: `useLoadingScene(requestKey, pages[0]?.covers ?? null, page0Hashed)` – unveränderte Semantik, `dataDone` ist jetzt „Seite 0 gehasht“. Danach `flyCovers` wie heute.
- Meta-Zeile: während des Nachladens `${covers} covers · ${checked.toLocaleString('en')} of ${total.toLocaleString('en')} editions checked`; fertig: `${covers} covers from ${total} editions`; gekappt: `${covers} covers · first ${MAX_EDITIONS_SCANNED} of ${total} editions checked`; abgebrochen: `${covers} covers · ${checked} of ${total} editions checked, source stopped answering`. Der Text „tidying duplicates“ entfällt.
- Ein kleiner, ruhiger Fortschrittsbalken unter der Meta-Zeile (1 px, Akzentfarbe, Breite `checked/total`), verschwindet bei `done`. Kein Spinner.
- `?cover=` zeigt auf ein Cover, das erst auf einer späteren Seite kommt: bis dahin ist das erste Cover gewählt (heutiges Verhalten), beim Eintreffen wechselt die Auswahl auf die URL-ID. Das ist ein bewusster Sprung, einmalig, akzeptabel.
- `CoverGallery`: 350 Kacheln sind kein Problem, aber die `.tile-in`-Staffelung darf nicht 350 × Verzögerung werden: `animationDelay` aus `index % 24` bilden. Bilder außerhalb des Viewports bleiben `loading="lazy"` (next/image-Default, prüfen, dass `priority` nur an den ersten acht steht).
- Sidebar (`CoverDetails`, `EditionBlock`) unverändert.

### 3.8 SPEC- und Doku-Pflege (Teil des Commits)

- SPEC §3 F2.2: Absatz zum seitenweisen Laden und zum Zähler; `stage=fast/full` aus 8.1 durch das Seitenmodell ersetzen (kurz, mit Datum).
- SPEC §9.3 Schritt 11: als erledigt markieren mit den gemessenen Zahlen (Cover vorher/nachher für Gatsby, 1984, Beloved; Dauer kalt und warm).
- CLAUDE.md „Current state“: den Satz zu `stage=fast` ersetzen durch das Seitenmodell (`getWorkPage`, `useWorkPages`, `lib/pages.ts`, `lib/imagesig.ts`).

## 4. Reihenfolge der Arbeit

1. `lib/imagesig.ts` abspalten, `works.ts` umhängen, Tests grün (`npm run test:run`).
2. `lib/pages.ts` mit `mergeWorkPages` und `stableGroupOrder` plus Unit-Tests (5.2).
3. `lib/work.ts`: `getWorkPage`, `MAX_EDITIONS_SCANNED`, `getWorkDetail` als Hülle. Tests aus 5.1.
4. Route umbauen. Mit `curl` prüfen: `?offset=0`, `?offset=0&signatures=1`, `?offset=100&signatures=1`, `?offset=100000` (leere Seite, kein `nextOffset`), falsche ID, unbekannte ID.
5. `useWorkPages` schreiben, Detailseite umstellen, Ladeszene anschließen.
6. Zähler, Fortschrittsbalken, Tab-Stabilität, Stagger-Deckel.
7. Verifikation im Browser (6), Doku (3.8), Commit.

Zwischendurch nach jedem Punkt `npx tsc --noEmit` und `npm run lint`.

## 5. Tests

### 5.1 Fixtures

`scripts/record-fixtures.ts` erweitern: für Gatsby zusätzlich `openlibrary-editions-100.json` und `openlibrary-editions-200.json` aufnehmen (`offset=100`, `offset=200`), Dateiformat wie die bestehende `openlibrary-editions.json` (`workId`, `size`, `entries`). Aufnahme mit `set -a; source .env.local; set +a; npx tsx scripts/record-fixtures.ts`. Keine Keys in den Fixtures, wie gehabt.

In `lib/__tests__/integration.test.ts` die Editions-Route des Mock-Fetch so ändern, dass `offset` auf die passende Datei zeigt und unbekannte Offsets `{ size, entries: [] }` liefern.

### 5.2 Neue und angepasste Tests

- `lib/__tests__/pages.test.ts`: `mergeWorkPages` vereinigt Cover-IDs und `editionIds`, hält Ausgaben pro ID eindeutig, zählt `checked` aus den tatsächlich gelieferten Seitengrößen; `stableGroupOrder` friert die Reihenfolge ein, hängt neue Sprachen an, hält „Unbekannt“ hinten.
- `lib/__tests__/work.test.ts` (neu oder in `integration.test.ts`): `getWorkPage(gatsby, {offset: 0})` liefert `page.total = 1180`, `nextOffset = 100`, Google-Kandidaten enthalten; `{offset: 100}` enthält keine Google-Ausgaben und andere OL-IDs als Seite 0; `{offset: 1100}` ohne `nextOffset`; `{offset: 1400}` → `nextOffset` fehlt wegen Kappung, auch wenn `total` größer ist; `signatures: true` mit gemocktem Fetch für Bilder (JSON statt Bild → keine Signaturen, kein Fehler).
- `getWorkDetail` liefert für Gatsby mehr Ausgaben als nur Seite 0 (Zahl aus den Fixtures ableiten, nicht raten).
- `lib/__tests__/imagehash.test.ts`: `hamming` weiterhin importierbar aus beiden Modulen.
- Bestehende Tests, die `stage`, `minWithCovers` oder `getEditions` benutzen, entsprechend anpassen oder entfernen.

## 6. Verifikation im Browser

Dev-Server über `preview_start` (nie über Bash). **Das Browser-Panel muss sichtbar sein** (`tabs_select`, `resize_window desktop`): in einem versteckten Panel verzögert React das Einblenden gestreamter Inhalte, die Seite wirkt leer, Klicks scheinen nichts zu tun. Das ist kein Fehler der App.

Wenn Turbopack alte CSS ausliefert: Server stoppen, `.next/dev` löschen (braucht Sandbox aus), neu starten.

Ablauf, jeweils kalt (Cache leer, d. h. Server frisch gestartet oder ein Work, das heute noch niemand geladen hat) und warm:

| Work | Erwartung |
|---|---|
| `/book/OL468431W` Gatsby | Ladeszene wie heute; Wand nach ≤ 8 s; Zähler steigt in Hundertern bis 1180; am Ende ≥ 300 Cover; Tab-Reihenfolge ändert sich nicht; englischer Tab beginnt mit den neuesten Jahren, alte Ausgaben stehen hinten; Dauer kalt notieren (erwartet 45–70 s), warm ≤ 5 s. |
| `/book/OL1168083W` 1984 | ≥ 220 Cover; Kaltstart darf nicht mehr mit „Book data source unavailable“ enden (Seite 0 ist ein einziger OL-Aufruf). |
| `/book/OL50548W` Beloved | Zwei Seiten; Zähler „110 of 110“, Cover ≥ 44. |
| `/book/OL30751W` Mumbo Jumbo | Eine Seite, sofort fertig, keine Regression gegenüber heute (10 Ausgaben, 12 Cover vor Faltung). |
| `/book/OL468431W?cover=ol:<ID von Seite 5>` | Auswahl wechselt beim Eintreffen der Seite auf dieses Cover, Sidebar zeigt die Ausgabe. |
| Marktwechsel während des Nachladens | Neustart der Sequenz mit neuem `requestKey`, keine Reste der alten Seiten. |
| Zurück zur Suche während des Nachladens | Keine Konsolenfehler (Abort wird sauber behandelt). |

Konsole und Netzwerk prüfen (`read_console_messages`, `read_network_requests`): keine Fehler, pro Seite genau ein Request, keine parallelen Editions-Aufrufe. Abschließend Screenshot der fertigen Gatsby-Wand mit Zähler.

## 7. Fallstricke

- `react-hooks/set-state-in-effect` ist ein Fehler: State nur in `then`/Callbacks/Timern setzen, abgeleiteten Zustand per `useMemo`, Refs nicht im Render beschreiben.
- `lib/` ohne `any`, ohne `console.log` außerhalb von `debug()`.
- `Cover.similarIds` entsteht jetzt im Client; der Server liefert ungefaltete Cover. Die URL-Auflösung „gefaltetes Duplikat in `?cover=`“ in `selected` bleibt und funktioniert weiter.
- Google-Kandidaten haben `workId`; die ISBN-Nachschau nutzt die neuesten ISBNs **von Seite 0**. Das ist eine bewusste Beschränkung (Kontingent), im Code kommentieren.
- Open Library antwortet auf spätere Seiten gelegentlich mit 503 oder braucht > 12 s (`OL_TIMEOUTS.editions`). Eine gescheiterte Seite darf die Wand nicht leeren.
- Der Next-Cache ist im Dev-Server dateibasiert (`.next/cache`); „kalt“ heißt also: Cache-Ordner leeren oder ein noch nie geladenes Work nehmen.
- Fixtures enthalten keine Cover-Bilder; Tests mit `signatures: true` müssen den Bild-Fetch mocken und dürfen nicht ins Netz.

## 8. Abschluss

Ein Commit, Nachricht beginnt mit `Step 11:`, endet mit der Co-Authored-By-Zeile aus CLAUDE.md. Vorher `npm run test:run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` grün. Push auf `origin main:rewrite-data-layer` (PR #1). Im Abschlussbericht: die Tabelle aus §6 mit gemessenen Zahlen, was nicht erreicht wurde, und was in Schritt 12 offen bleibt.
