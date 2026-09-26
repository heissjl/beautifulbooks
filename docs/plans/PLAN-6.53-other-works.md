# Plan für Roadmap 6.53: „Other works by this author" unter der Wand

Geschrieben 2026-09-26 für eine Sitzung, die den Code nicht kennt (Julian: „starte einen plan für die funktion 'Other works by this author' unten auf der cover wall seite"). Vorher lesen: [CLAUDE.md](../../CLAUDE.md), [SPEC.md](../../SPEC.md) §3 F2 (bes. F2.12–F2.14), §4 N3, N4, N7, N9, N10, N12–N14, und den Roadmap-Punkt [6.53](../../ROADMAP.md). Code und Kommentare Englisch (E7), dieser Plan Deutsch. **Noch nichts gebaut.**

## 1. Ziel und Nicht-Ziel

**Ziel.** Unter der Wand eines Buchs steht eine Reihe weiterer Bücher der Erstautorin, je ein Cover, Titel darunter; jede Kachel führt auf die Wand dieses Werks. Darüber „More by Ursula K. Le Guin" als Link auf die Suche nach ihr.

**Messlatte.**
1. Die Reihe kostet **null** Google-Anfragen und **eine** Open-Library-Anfrage je Autor und Tag (Cache), nicht je Werk.
2. Schweigt Open Library, steht **nichts** da — kein „No other works", kein leerer Rahmen (N12).
3. Bei 390 × 844 und 1280 × 800 (N14) ist kein Titel auf eine Zeile abgeschnitten und die Peek-Leiste verdeckt keine Kachel.
4. Bei den Büchern aus §8 steht kein Sammelband, kein Studienführer, keine Adaption und nicht das Werk selbst in der Reihe.

**Nicht-Ziel.** Keine „All works"-Seite, keine Autorenseite, keine Zusammenführung mehrerer Autoren-Keys (erst nach eigener Messung, §4.3), keine Änderung an der Sitemap, keine Mosaike (§3.2, offene Frage), nichts auf der Jahrzehnte-Seite (offene Frage).

## 2. Befund im Code

- `app/book/[id]/page.tsx` ist Server (Metadaten, JSON-LD, ISR 24 h); der Körper ist `components/BookDetail.tsx`, **Client**. Alles, was die Reihe braucht, kommt also über eine API-Route; `lib/coverindex.ts`, `data/cover-index.json`, `lib/collections.ts` und `data/curated.json` dürfen nicht in den Client (CLAUDE.md, Working rules).
- Die Wand liegt in einem `grid lg:grid-cols-3`: links `CoverGallery` + der Satz „Covers come from …", rechts die klebende Seitenleiste (nur Desktop). Darunter nur noch `CoverSheet` (Telefon) und die `SiteFooter` in `Shell`. Die linke Spalte trägt `pb-20`, sobald ein Cover gewählt ist (Platz für die Peek-Leiste).
- Seite 0 (`WorkPageResponse`) liefert `work.authors` und `work.authorKeys` **nach** `withoutTranslators` sowie `siblings` (6.13). `authorKeys` fehlt, wenn `getWork` über das Werk-Dokument statt über die Suche lief (`getWorkViaDocument`) oder wenn ein Autor ohne Key dasteht.
- `lib/collectionedit.ts` `authorCandidates` hat die Regel schon: nur Werke, deren **erster** `author_key` der gesuchte ist.
- `lib/works.ts`: `mergeWorks` (gleicher normalisierter Titel + gleiche Erstautorin → ein Werk, Id des größten Datensatzes), `siblingsOf`, `derivativeIds`; `lib/normalize.ts`: `looksLikeSecondaryLiterature`, `MARKED_DERIVATIVE`, `normalizeTitle`, `tileTitle`.
- `components/CoverWall.tsx` ist genau die gewünschte Kachel (Cover 2:3, zwei Zeilen Titel, Autor, `storeWorkPreview` für die Ladeszene F2.12, Raster 3/4/6 Spalten). Nimmt `{ id, title, author, coverId: number }`.
- Karten-Mosaik: `useCardCovers` fragt `/api/works/<id>?summary=1` — **eine Editions-Seite je Karte** (kein Google, 6.34: bis zu acht Kandidaten, im Browser gehasht).
- `app/api/rate.ts` + `lib/ratelimit.ts`: Eimer je Route; `google` nur, wo Google möglich ist.
- Sitemap = `PUBLISHED_WORKS` (`lib/published.ts`, = `data/index-works.json`, 500 Werke). Werkseiten tragen **kein** `noindex`; robots.txt sperrt `/api/`.

## 3. Entwurf

### 3.1 Platz und Gestalt

- **Wo:** unter dem Grid, volle Breite (unter Wand *und* Seitenleiste), vor `CoverSheet`, mit `mt-16`. Auch dann, wenn die Wand leer ist — die Reihe hängt nicht an den Covern dieses Werks.
- **Überschrift:** `More by <Name>` als `<h2>`, der Name ist ein Link auf `/?q=<Name>`. Kein Satz darunter (N13); kein „all", kein Zähler (N12). Die Wortwahl liegt in einer reinen Funktion (`authorRowHeading`) in `lib/authorworks.ts` und wird wie `lib/seo.ts` gegen „all / every / complete" geprüft.
- **Kacheln:** `CoverWall` wiederverwendet, mit einem neuen optionalen Prop `hideAuthor` (sechsmal derselbe Name unter sechs Kacheln ist Lärm). Optional das Jahr aus Open Library unter dem Titel — nur wenn Julian es will (§9).
- **Wie viele:** sechs. Telefon: zwei Reihen à drei; Desktop: eine Reihe à sechs. Weniger gefunden → so viele wie gefunden, ab **einer**.
- **Wohin:** `/book/<id>` ohne `?cover=` (die Kachel ist das Werk, anders als bei Sammlungen, F8). `?q=&lang=` werden **nicht** mitgenommen.
- **Telefon mit gewähltem Cover:** das `pb-20` wandert an das letzte Element der Seite, damit die Peek-Leiste die letzte Kachelreihe nicht verdeckt.

### 3.2 Ein Cover je Karte, kein Mosaik (Kosten)

| Variante | Zusätzliche Anfragen je Seitenaufruf (kalt) | Google |
|---|---|---|
| **A: ein Cover** (`cover_i` aus der Suche; bei kuratierten Werken das gewählte aus `data/curated.json`, serverseitig eingesetzt) | 1 OL-Suche (je Autor 24 h gecacht) + 6 Bilder über `/img`, lazy | 0 |
| B: Mosaik wie die Suchkarte (`?summary=1`) | wie A **plus 6 Editions-Seiten** (je 3–10 s kalt) + bis zu 48 Bilder zum Hashen im Browser | 0 |
| C: Mosaik nur aus dem Index | wie A, 0 zusätzliche — aber nur für die 1–2 von sechs Werken im Index | 0 |

**Vorschlag A.** B versechsfacht die Open-Library-Last einer Wand, die selbst bis zu 16 Seiten lädt; C macht die Reihe uneinheitlich.

### 3.3 Datenquelle

`GET https://openlibrary.org/search.json?q=author_key:<key>&sort=editions&limit=30&fields=<SEARCH_FIELDS>` — **nicht** `/authors/<key>/works.json`: das liefert in Datensatz-Reihenfolge (Fitzgerald: „O curioso caso de Benjamin Button", „Christmas classics" vorn) ohne Ausgabenzahl. **Welcher Autor:** `work.authorKeys[0]` nach `withoutTranslators`. Fehlt der Key: keine Reihe (keine Namenssuche — Namensvettern). Mehrere Autoren: nur die erste (§9).

### 3.4 Der Filter (rein, `lib/authorworks.ts`, clientsicher)

1. **Erster Autoren-Key = der gesuchte** (Regel aus `authorCandidates`; gemessen fallen 1–9 von 50).
2. `looksLikeSecondaryLiterature(title)` oder `MARKED_DERIVATIVE` → raus.
3. **Bandteilungen** (`[1/2]`, `Vol. 2`) → raus (Mitchell: „Gone with the Wind [2/2]").
4. **Ohne Cover** → raus.
5. **Mindestgröße** `max(3, 1 % des größten Datensatzes)` Ausgaben (gegen einzelne Übersetzungs-Datensätze, §4.2).
6. `mergeWorks` über den Rest.
7. Nach Ausgaben absteigend, **12** Kandidaten an den Client.

Im Client (Cache gilt je Autor): das Werk selbst, seine Geschwister und jeder Kandidat mit gleichem `normalizeTitle` fallen heraus; die ersten sechs bleiben.

### 3.5 Server und Client

- `lib/sources/openlibrary.ts`: `searchAuthorWorks(authorKey)`, `OL_TIMEOUTS.authorWorks = 6_000`, `revalidate` 24 h, **wirft** `SourceUnavailableError` bei Schweigen.
- `lib/authorworks.ts` (rein): `otherWorksByAuthor`, `excludeCurrent`, `authorRowHeading`, `isAuthorKey` (`/^OL\d+A$/`).
- **Neue Route** `app/api/authors/[key]/works/route.ts` → `{ authorKey, works: AuthorWork[] }`. 200 (auch leer), 400, 503 (`no-store`), 429. Cache-Header nur auf 200 (`s-maxage=86400, stale-while-revalidate=604800`), kein `Vary`.
- **Warum nicht `/api/works/[id]` erweitern:** dort gilt der Cache je Werk und Markt, die Reihe je Autor; und Seite 0 dort belastet den `google`-Eimer (N10).
- **Rate-Limit:** neuer Eimer `author: { capacity: 60, refillPerMinute: 30 }`, **nie** `google`.
- **Client:** `components/useAuthorWorks.ts` + `components/AuthorWorks.tsx`. Auslöser: Seite 0 da **und** (IntersectionObserver-Callback-Ref mit `rootMargin: 600px` **oder** `merged.done`). Zustand über Anfrage-Schlüssel, kein `setState` im Effekt. Ein zweiter Versuch nach 1,5 s bei ≥ 500. Ein Modul-`Map` je Sitzung.

### 3.6 Zustände

| Zustand | Was steht da |
|---|---|
| Noch nicht im Blick / Seite 0 fehlt | nichts |
| Lädt | Überschrift + sechs graue 2:3-Flächen |
| Geantwortet, ≥ 1 Werk | Überschrift + Kacheln |
| Geantwortet, 0 Werke nach Ausschluss | **nichts** (N12) |
| Zweimal Schweigen / 503 / Netzfehler | **nichts**, nicht gecacht |
| Werk ohne `authorKeys[0]` | nichts, keine Anfrage |
| Mehrere Autoren | nur die erste |

### 3.7 SEO und Sitemap

Die Sitemap bleibt `PUBLISHED_WORKS`; die Reihe schafft keine Seiten. Sie entsteht aus `/api/`, das robots.txt sperrt — der Gewinn ist für Leser. Links gewöhnlich, kein `nofollow` (§9).

## 4. Messung (2026-09-26, aus Deutschland, direkt gegen Open Library)

### 4.1 Laufzeit und Ausbeute

| Autor (Key) | Suche, 3 Aufrufe (ms) | numFound | Erstautorin unter den ersten 50 | nach Filter | Reihe (ohne das Werk selbst) |
|---|---|---|---|---|---|
| F. Scott Fitzgerald OL27349A | erster 1.687, danach 334 / 439 / 466 | 1.264 | 49 | 22 | This Side of Paradise, The Beautiful and Damned, Tender is the Night, Benjamin Button, May Day, Flappers and Philosophers |
| Ursula K. Le Guin OL31353A | 530; 216 / 140 / 153 | 259 | 46 | 29 | sechs Romane |
| Franz Kafka OL33146A | 281; 167 / 275 / 160 | 1.863 | 43 | 14 | sechs, zum Teil unter deutschem Titel (Der Proceß, Das Schloß) |
| Margaret Atwood OL52922A | 216; 316 / 773 / 191 | 681 | 41 | 27 | sechs Romane |
| Harper Lee OL498120A | 265; 167 / 125 / 228 | 45 | 39 von 45 | 3 | **zwei**: Go Set a Watchman und „Tespih Agacinin Gölgesinde" (türkischer TKAM-Datensatz, **falsch**) |
| Ishmael Reed OL27626A | 365 / 198 / 142 | 114 | – | 16 | sechs |
| Ishmael Reed OL11412010A (zweiter Key) | 173 / 323 / 132 | 17 | – | 0 | – |
| Margaret Mitchell OL151749A | 145 / 154 / 139 | 23 | – | 4 | drei: Letters 1936–1949, Before Scarlett, Lost Laysen |

`/authors/<key>/works.json`: 266–791 ms, aber ungeordnet. Die Laufzeiten dieses Tages liegen weit unter N3 (2–7 s); der Timeout folgt N3. Doppelte Datensätze unter den ersten 50: Fitzgerald 49 → 41 Titel, Kafka 43 → 26, Harper Lee 39 → 27. Unter den ersten sieben jeder Autorin stehen 1–2 Werke, die schon im Index oder in `curated.json` sind.

### 4.2 Übersetzungen als eigene Datensätze

- `max(2, 2 %)`: Harper Lee sauber, aber Mitchell **leer**.
- `max(3, 1 %)` (**Vorschlag**): Mitchell drei echte Werke, Harper Lee ein falscher türkischer Datensatz.

**Verworfen:** ein Sprachfilter — er bestimmte bei Harper Lee `ger` als Hauptsprache und nahm Kafka zwei englische Datensätze.

### 4.3 Mehrere Keys derselben Person

Alle fünf geprüften Index-Werke tragen den Haupt-Key als `authorKeys[0]`. Der zweite Key ist Streugut: Reeds OL11412010A liefert nach dem Filter nichts, Mitchells OL6806079A Übersetzungen **und Namensvettern** („Cutco cook book"). Regel: nur der Key des Werks.

## 5. Kosten je Seitenaufruf

Google **0**; Open Library **+1** Suche, nur kalt, je Autor 24 h gecacht; Bilder +6 über `/img`, lazy. Obergrenze 6 Kacheln, 12 Kandidaten, kein Nachladen.

## 6. Schritte

| # | Schritt | Dateien | Schätzung |
|---|---|---|---|
| 1 | Fixtures für die acht Keys aus §4.1; Messung in docs/history.md | scripts/record-fixtures.ts, lib/__fixtures__/authors/ | 1,5 h |
| 2 | `searchAuthorWorks` + `OL_TIMEOUTS.authorWorks`, Tests | lib/sources/openlibrary.ts | 1,5 h |
| 3 | `lib/authorworks.ts` + Tests gegen die Fixtures | lib/authorworks.ts | 3 h |
| 4 | Route, Eimer `author`, kuratiertes Cover; Tests inkl. **null Google-Aufrufe** | app/api/authors/[key]/works/route.ts, lib/ratelimit.ts | 2 h |
| 5 | `useAuthorWorks` + `AuthorWorks`, Einbau unter dem Grid, `hideAuthor`, `pb-20` verlegen | components/ | 3 h |
| 6 | Im Browser gegen `npm run dev`: §8 bei 390 × 844 und 1280 × 800, Ausfall simulieren | – | 1,5 h |
| 7 | SPEC F2.15, N9, N10, N7; features.md, Historie; Roadmap erst nach Julians Blick auf drei Bücher | SPEC.md, docs/ | 1 h |

Zusammen etwa **13–14 Stunden**, zwei Sitzungen, ein Commit mit 6.53 im Betreff.

## 7. Tests (alle ohne Netz)

Filter (Erstautor, Sekundärliteratur, Bandteilung, ohne Cover, beide Schwellen als benannte Fälle, `mergeWorks`); Ausschluss (Werk, Geschwister, gleicher Titel, höchstens sechs, Reihenfolge); Route (0 Google, nur `author`, 503 mit `no-store`); Text (`authorRowHeading` ohne „all/every/complete").

## 8. Abnahme

Bücher: *The Great Gatsby*, *The Left Hand of Darkness*, *Metamorphosis*, *The Handmaid's Tale*, *To Kill a Mockingbird*, *Mumbo Jumbo*, *Gone With the Wind*.

1. Genau **eine** Anfrage an `/api/authors/…` je Seitenaufruf, erst beim Scrollen oder nach Ende der Wand; keine an `?summary=1`; keine Google-Anfrage.
2. Keine Kachel zeigt das Werk selbst, ein Geschwister, einen Studienführer, eine Adaption oder einen fremden Sammelband.
3. 390 × 844: zwei Reihen à drei, kein Titel einzeilig abgeschnitten, Peek-Leiste verdeckt nichts. 1280 × 800: eine Reihe à sechs.
4. Ausfall (Route auf 503 gezwungen) → nichts, Wand unberührt.
5. Klick auf eine Kachel öffnet die Wand mit Ladeszene.
6. Julian sieht die Reihe an drei Büchern, bevor sie live geht.

## 9. Offene Fragen an Julian

1. **Sechs** Werke — oder mehr?
2. **Ein Cover je Karte** (Vorschlag) oder Mosaik (+6 Open-Library-Anfragen je Seite)?
3. **Schwelle** `max(3, 1 %)` oder `max(2, 2 %)`?
4. **Originaltitel:** Kafka erscheint mit *Der Proceß* und *Das Schloß* — in Ordnung?
5. **Mehrere Autoren** (*Good Omens*): nur die Erste, oder je Autor eine Reihe?
6. **Leer oder Ausfall:** gar nichts (Vorschlag), oder nur „More by … →" als Link?
7. **Jahrzehnte-Seite:** auch dort?
8. **Kuratiertes Cover** statt Open Librarys Standardcover (Vorschlag ja)?
9. **Jahr** unter dem Titel?
10. Links auf nicht veröffentlichte Werke: gewöhnlich (Vorschlag) oder `nofollow`?
