# Beautiful Books – Arbeitsprotokoll

Was gebaut, gemessen und entschieden wurde, chronologisch. Die Texte sind aus der alten SPEC.md (Stand `1b92cf5`) hierher verschoben, **mit ihren alten Abschnittsnummern als Überschriften**, weil die Kommentare im Code sie zitieren („SPEC §9.3 step 11“, „§8.7“, „§10 C9“). Was die Seite heute sein soll, steht in [SPEC.md](../SPEC.md); was offen ist, in [ROADMAP.md](../ROADMAP.md). Die alte Fassung in einem Stück: `git show 1b92cf5:SPEC.md`.

| Datum | Was | Hier |
|---|---|---|
| 2026-09-06 | Befund des alten Codes, Entscheidung Option A | alte §5 |
| 2026-09-06 | Datenschicht neu, Schritte 1–9 | alte §7 |
| 2026-09-06 | Design-Durchgang, Ladeszene | alte §8.1 |
| 2026-09-06 | Aus der Nutzung: Amazon-Links, Suchwege ohne ISBN, Dedupe | alte §8.5 |
| 2026-09-06 | Analyse „eine Suche, der man vertrauen kann“, Schritte 10–16 | alte §9 |
| 2026-09-07 | Sprache schlägt durch, Mosaik sprachneutral | alte §8.5.1 |
| 2026-09-07 | Google-Kontingent: Messung, Ablesung, Sicherungsautomat, Rate-Limit | alte §8.7 |
| 2026-09-07 | SEO-Grundlage, Detailseite mobil, Klick-Tracking, About | alte §10 |
| 2026-09-07 | Die Suche fragt Google nicht mehr | PLAN-B B8 |

Die Umsetzungspläne dieser Zeit liegen unter [plans/](plans/): [PLAN-11](plans/PLAN-11.md) (Schritt 11), [PLAN-A](plans/PLAN-A.md) (Merge, ehrliche Sprache, drei Entscheidungen), [PLAN-B](plans/PLAN-B.md) (B0–B8, mit dem vorläufigen Plan für die Analyse-Seite).

---

## 2026-09-06 · Befund des vorhandenen Codes (alte §5)

Umfang: ~3.000 Zeilen in `app/`, `components/`, `lib/`, `types/`. Next.js 16.1, React 19.2, Tailwind 4, Vitest 4. Vier Commits.

### 5.1 Was funktioniert und behalten werden kann

- **UI-Komponenten** (`SearchBar`, `BookGrid`, `BookWorkCard`, `CoverMosaic`, `EditionsByLanguage`): sauber, Tailwind, alle vier Zustände abgedeckt, URL-Sync, localStorage. Rund 1.200 Zeilen, die weitgehend 1:1 wiederverwendbar sind.
- **Seitenstruktur** (`app/page.tsx`, `app/book/[id]/page.tsx`): Layout und Interaktion sind richtig, nur die Datenbeschaffung ist falsch platziert.
- **Quellen-Clients** (`lib/sources/*`): Grundgerüst und Feld-Mapping sind brauchbar, brauchen aber Korrekturen (5.2).
- **Toolchain**: Next 16, Tailwind 4, Vitest sind eingerichtet und aktuell.

### 5.2 Wurzelursache der bisherigen Probleme

Der OL-Editions-Endpoint liefert `authors: [{key: '/authors/OL…'}]`. Der Code in `lib/sources/openLibrary.ts` liest `a.name` → **jede OL-Ausgabe hat eine leere Autorenliste**. Commit `09e9a7f` („Strict author filtering") verwirft Ausgaben ohne Autor → **alle OL-Ausgaben verschwinden**. Die ungespeicherte Neufassung von `lib/aggregator.ts` umgeht das, indem sie OL-Ausgaben nicht mehr filtert, benennt die Ursache aber nicht.

Die frühere Session hat also gegen ein Symptom gekämpft, dessen Ursache eine falsche Annahme über das API-Format war. Das ist der Grund, warum drei Versionen der Aggregationslogik nebeneinander liegen.

### 5.3 Strukturelle Fehler (unabhängig von 5.2)

1. **Client-seitiges Fetchen.** `BookGrid` und die Detailseite importieren `bookAggregator` und rufen Open Library / Google Books **aus dem Browser** auf. Die Route `app/api/search/route.ts` existiert, wird aber von keiner Seite benutzt. Kein Caching möglich, CORS-abhängig, API-Schlüssel wären exponiert.
2. **N+1 Fan-out.** Die Suche lädt für **jedes** gefundene Work sofort alle Ausgaben aus beiden Quellen (bis zu 100 pro Work), nur um 4 Cover fürs Mosaik zu zeigen. Bei 20 Works sind das 40+ externe Calls pro Suche. Open Library brauchte im Test über 60 s.
3. **Works werden nicht quellenübergreifend zusammengeführt.** OL-Treffer werden nach Work-ID gruppiert, Google-Treffer nach Titel+Autor. Dasselbe Buch erscheint deshalb als zwei Karten.
4. **Detailseite bekommt Editions-IDs.** `/book/ol-edition-OL123M` wird per `split('-', 2)` zu `['ol', 'edition']` zerlegt → Lookup schlägt fehl. Für `gb-…`-IDs wird per Titel gesucht, was falsche Ausgaben einsammelt.
5. **Drei Generationen derselben Logik** liegen im Repo: `lib/api.ts` (v1, hat TypeScript-Fehler, wird nirgends importiert), `lib/aggregator-old.ts` (v2, untracked), `lib/aggregator.ts` (v3, ungespeicherte Änderung). Dazu `components/BookCard.tsx` (unbenutzt) und `scripts/test-v2.ts` (importiert eine nicht existierende Datei).
6. **Tests sind kaputt und testen das alte Design.** Die Suite lädt nicht (Mock ist keine Klasse). Inhaltlich prüfen die Tests `getWorkKey` mit Sprache im Schlüssel, was in Commit `77cbc37` ausdrücklich entfernt wurde.
7. **Dokumentation beschreibt drei verschiedene Codebasen.** `README.md` beschreibt v1 (`lib/api.ts`, `BookCard`), `CLAUDE.md` beschreibt Dateien, die nie existiert haben (`lib/normalize.ts`, `SearchResults.tsx`, Next 15). Eine Session, die sich daran orientiert, geht von falschen Voraussetzungen aus.
8. **Kleinere Punkte:** ~40 `console.log` im Produktionspfad; Book-Depository-Links auf einen geschlossenen Shop; `unoptimized` auf allen Bildern mit Cover in Größe L im Grid; Sprachfilter-Default `en` in der API-Route, aber leer (= alle) in der UI.

### 5.4 Einordnung

Die UI-Schicht ist in Ordnung. Die Datenschicht (~600 Zeilen) ist in drei Anläufen um eine falsche API-Annahme herum gebaut worden und hat keine belastbare Spezifikation gehabt. Die Dokumentation hat den Zustand verschleiert, statt ihn zu beschreiben.

---

## 2026-09-06 · Umsetzungsplan Option A, Schritte 1–9 (alte §7)

Entscheidung E1: Datenschicht neu nach der Spec, UI behalten.

Ziel-Struktur von `lib/`:

```
lib/
  model.ts            Work, Edition, WorkSummary, LanguageGroup (SPEC §2)
  normalize.ts        Titel/Autor-Normalisierung, ISBN-10→13, Sprachcodes
  works.ts            Work-Identität, Edition-Dedupe, Relevanz-Ranking (rein, ohne I/O)
  sources/
    openlibrary-parse.ts  reine Parser für Such- und Editions-Antworten
    googlebooks-parse.ts  reiner Parser für volumes-Antworten
    http.ts           fetchJson mit Timeout + Next-Cache, HttpError
    openlibrary.ts    searchWorks(), getWork(), getEditionsPage(), getEditions() mit Paging
    googlebooks.ts    searchVolumes(), searchEditionCandidates(); Key aus GOOGLE_BOOKS_API_KEY
    legacy-*.ts       alte Clients, nur noch von lib/aggregator.ts benutzt, fallen in Schritt 5
  debug.ts            debug(scope, msg), still ohne DEBUG
  __fixtures__/       aufgezeichnete API-Antworten (scripts/record-fixtures.ts)
  search.ts           Orchestrierung: beide Quellen mit Timeout, Zuordnung GB→OL, Ranking, Cache
  work.ts             Detailseite: OL-Editionen + GB-Ergänzung, Dedupe, Sprach-Gruppierung
  buylinks.ts         Anbieter-Konfiguration, Links aus ISBN, Affiliate-IDs aus AFFILIATE_*-Env-Variablen
```

Schritte, jeder einzeln commit-fähig:

1. **Aufräumen.** *Erledigt 2026-09-06.* Löschen: `lib/api.ts`, `lib/aggregator-old.ts`, `components/BookCard.tsx`, `scripts/test-v2.ts`, `scripts/test-relevance.js`, `scripts/debug-search.js` (JS-Duplikate). `README.md` auf Kurzform kürzen, `CLAUDE.md` neu schreiben und auf diese Spec verweisen. Aktuelle `aggregator.ts`-Änderung als Zwischenstand committen, damit nichts verloren geht.
2. **`normalize.ts` + `works.ts`** mit Unit-Tests (Fixtures aus echten API-Antworten für die fünf Akzeptanz-Queries in F1, per Skript aufgezeichnet unter `lib/__fixtures__/`). *Erledigt 2026-09-06, nur Open-Library-Fixtures; Google-Books-Fixtures folgen, sobald ein API-Key vorliegt.*
3. **Quellen-Clients** neu: Autoren-Bug (5.2) beheben, Timeouts (N3), Logging raus, Cover-URLs in S/M/L. *Erledigt 2026-09-06.* Editions-Paging (siehe Schritt 4) ist bereits im Client (`getEditions` mit `minWithCovers`/`maxEntries`).
4. **`search.ts` + `work.ts`** mit Integrationstests gegen die Fixtures. Akzeptanzkriterien aus F1 müssen grün sein. *Erledigt 2026-09-06.* Beachten: der Editions-Endpoint liefert max. 100 Einträge pro Aufruf, nur ~25 % davon haben ein Cover; bei Works mit >100 Ausgaben (1984: 537, Gatsby: 1180, Austen: 4041) muss `work.ts` per `offset` nachladen, bis genug Cover da sind oder ein Limit (z. B. 500 Einträge) erreicht ist.
5. **API-Routen** `app/api/search` (bestehend, umstellen) und neu `app/api/works/[id]`. Server-seitiges Fetching mit `revalidate`. Alle Seiten und `BookGrid` gehen ausschließlich über diese Routen. *Erledigt 2026-09-06.* Mit erledigt: Detailseite liest bereits `/api/works/[id]` (Work-ID statt Editions-ID, F2.1), Kauf-Links aus `lib/buylinks.ts`, Startseite ist URL-getrieben (F1.5), alter Aggregator und Legacy-Clients gelöscht. Offen aus Schritt 6: `?edition=` in der URL (F2.6), Übersetzer aus der Autorenzeile, Rest-Feinschliff.
6. **Cover-Modell (E8).** `lib/model.ts` bekommt `Cover`; Parser übernehmen alle Cover-IDs; `works.ts` baut aus Quell-Ausgaben `{ editions, covers }` (ISBN-Merge mit Cover-Erhalt); Detail-Route und -Seite zeigen Cover mit ihren Ausgaben; Kauf-Link-Text nach 2.4. Google-`isbn:`-Nachschlag pro ISBN (F2.2), aktiv sobald ein Key da ist. *Erledigt und mit Key live verifiziert 2026-09-06: Mumbo Jumbo zeigt unter ISBN 9780684824772 beide Cover (Scribner 1996 gemalt, 50th Anniversary 2022 rot), die Ausgabe trägt „Also printed with 1 other cover“.*
7. **Detailseite** Feinschliff: gewähltes Cover in `?cover=`, Zurück-Link mit Query, Übersetzer aus der Autorenzeile. *Erledigt 2026-09-06.* Übersetzer werden aus den Daten erkannt: Ein Autor (nie der erste), dessen Open-Library-Key auf keiner Ausgabe in der Hauptsprache des Werks steht, wird entfernt; Ausgaben ohne Sprachangabe zählen nicht als Beleg. Auf Suchkarten (ohne Ausgabendaten) zeigt die Karte bei drei und mehr Namen nur den Erstautor.
8. **Kauf-Links** Markt-Modell nach E9 (Erkennung, Umschalter, Händlertabelle pro Markt), Amazon-Direktlink per ISBN-10, Suchwege ohne ISBN (8.5), Affiliate-Parameter pro Markt. *Erledigt 2026-09-06:* `lib/market.ts` (Erkennung: `?market=` oder Cookie, dann `x-vercel-ip-country`, dann `Accept-Language`, sonst US), `lib/buylinks.ts` (Händlertabelle US/UK/DE, `buyLinksFor` mit ISBN, `searchLinksFor` ohne ISBN), `MarketSwitcher` in der Seitenleiste mit Cookie + localStorage, `Vary` auf der Work-Route. Nicht verifizierte Händler-URL-Muster: Hugendubel, genialokal, World of Books (weggelassen); vor dem Launch anklicken.
9. **Verifikation** im Browser mit den fünf Akzeptanz-Queries, Screenshots in den PR. *Erledigt 2026-09-06, 11 von 11 Prüfungen bestanden (Skript gegen die laufende App, Screenshots per Chrome headless):*

   | Query | Ergebnis |
   |---|---|
   | `mumbo jumbo` | Reed zuerst (23 Ausgaben, 3 Mosaik-Cover), 7 gleichnamige Works getrennt. Detail: „by Ishmael Reed“ ohne Übersetzer, 13 Cover, ISBN 9780684824772 trägt 2 Cover (OL 1996 + Google 2022). Suche 0,3 s. |
   | `1984` | Orwell zuerst, Study Guides auf Platz 8 und 16. Detail: 67 Ausgaben, 84 Cover in 9 Sprachen plus „Unbekannt“ am Ende. Suche 5,4 s (Open Library langsam, danach Cache). |
   | `gravity's rainbow` | Pynchon zuerst, alle Companions und Guides dahinter (Positionen 3, 4, 11, 12). Suche 0,9 s. |
   | `the great gatsby` | Genau ein Fitzgerald-Work (OL468431W, 1199 Ausgaben, 4 Mosaik-Cover), an erster Stelle. Suche 1,0 s. |
   | `pride and prejudice` | Genau ein Austen-Work, zuerst; Zombies und Adaptionen getrennt. Detail mit `lang=de`: Deutsch vorn. Suche 1,4 s. |

   Beobachtungen für die Roadmap: (a) Einzelne Open-Library-Cover laden langsam oder gar nicht; ein Bild-Fehler-Fallback (Cover ausblenden statt Alt-Text zeigen) fehlt (8.1). (b) Manche OL-Cover sind fast leere Scans; Filter nach Bildinhalt wäre Teil des Bild-Hashings (8.5). (c) Bei Austen und Orwell landet die Hälfte der Cover im Tab „Unbekannt“, weil OL-Ausgaben keine Sprache haben (8.5).

Geschätzt: drei Sessions. Session 1 = Schritte 1–4 (reine Logik, testbar ohne Browser). Session 2 = Schritt 5. Session 3 = Schritte 6–9.

---

## 2026-09-06 · Design-Durchgang und Ladeszene (alte §8.1)

*Leitidee: Galerie statt Shop. Die Design-Tokens stehen heute in SPEC.md §5.*

**Erledigt:**
- [x] Farbpalette, Typografie, Dark Mode, 8-px-Raster
- [x] Startseite: Hero mit einem Satz Wertversprechen, großes Suchfeld, Sprache als Chips unter dem Feld (kein Dropdown mehr), kuratierte Cover-Wand mit zwölf Klassikern statt leerem Zustand (`lib/curated.ts`)
- [x] Ergebnisraster: Karten ohne Rahmen, nur Cover mit Buchschatten und zwei Zeilen Text; Hover hebt die Karte und zeigt Ausgaben- und Sprachanzahl
- [x] Detailseite: Cover-Wand links (zwei Drittel), gewähltes Cover mit Ausgabe als sticky Seitenleiste rechts; Sprach-Tabs als Chips; Metadaten als Definitionsliste; Kauf-Links als ruhige Buttons mit Hinweistext; Teilen-Button kopiert die URL
- [x] Ladezustände: Skeletons in Cover-Proportion, Cover blenden nach dem Laden ein, Fehler-Fallback ohne Alt-Text-Kasten
- [x] Mobil: Raster zweispaltig, Detailseite einspaltig mit Seitenleiste unter der Wand
- [x] Zugänglichkeit: Alt-Texte mit Verlag und Jahr, `role=tablist`/`tab`, `aria-pressed` auf Chips und Covern, Fokus-Ringe


**Zweiter Durchgang, erledigt:**

- [x] **Ladeszene statt Skeleton (Idee Julian, 2026-09-06).** *Umgesetzt 2026-09-06:* Karten geben Titel, Autor und Cover per sessionStorage an die Detailseite (`useWorkPreview`), die sofort Titel und Hero-Cover zeigt. Die Work-Route liefert Seite 0 wahlweise ohne Hashing (seit Schritt 11: `?signatures=1` statt der früheren Stufen `stage=fast|full`); die Seite lädt erst die ungehashte Seite 0, zeigt die ersten eintreffenden Cover als Fächer auf der Bühne (`LoadingStage`, bis zu vier, `stage-in`-Animation) und schaltet in die Galerie, sobald mindestens zwei Cover vollständig eingeblendet sind und die gefaltete Antwort da ist, sonst nach dem vierten Cover (`useLoadingScene`: Takt 520 ms pro Cover, 650 ms Einblendung, Kacheln 1,5-fach, Positionen als CSS-Variablen, damit die Animation den Fächer nicht überschreibt; Nachjustierung Julian 2026-09-06), wobei die Bühnen-Cover per FLIP auf ihre Kacheln fliegen (`flyCovers`, Web Animations API, respektiert `prefers-reduced-motion`). Parallel läuft die gehashte Seite 0; die Galerie faltet, sobald die Signaturen da sind. Die frühere Meldung „tidying duplicates“ ist durch den Fortschrittszähler aus F2.2 ersetzt. Bei warmem Cache endet die Szene sofort. Offen: das Falten kann Kacheln umsortieren, sobald Signaturen eintreffen; ein sanfter Übergang dafür gehört in den zweiten Durchgang. Die Detailseite lädt 2–6 s. Statt einer leeren Seite, die sich langsam füllt: die ersten eintreffenden Cover groß in Szene setzen oder animiert auf ihre Plätze fliegen lassen, bis vier Ergebnisse da sind, dann in den klickbaren Modus umschalten. Nebeneffekt: mehr Zeit für das Hashing, das dann vor dem ersten Klick fertig ist. Technisch: die Work-Route als Stream (Ausgaben zuerst, Cover in Chargen, gefaltete Cover zuletzt) oder zwei Aufrufe (schnell ohne Hash, dann mit); Client mit View Transitions oder Framer Motion für den Flug auf die Slots.

---

## 2026-09-06 · Aus der Nutzung (alte §8.5)

Drei Beobachtungen nach dem ersten Durchgang mit der neuen Oberfläche. Reihenfolge nach Nutzen pro Aufwand.

- [x] **Amazon-Links treffen nicht.** *Direktlink, Buch-Fallback und Markt-Domains erledigt 2026-09-06.* Vorher `amazon.com/s?k=<ISBN-13>`: eine Volltextsuche, die Kindle, Audible und Fremdtreffer mischt.
  - Direktlink statt Suche: Bei gedruckten Büchern ist Amazons ASIN gleich der **ISBN-10**. `https://www.amazon.<tld>/dp/<ISBN-10>` führt direkt auf die Produktseite. ISBN-10 aus der ISBN-13 zurückrechnen (Präfix 978; bei 979 gibt es keine ISBN-10, dann Suche).
  - Suche als Fallback nur in der Buchabteilung: `s?k=<ISBN>&i=stripbooks` (schließt Audible und Kindle aus). Deutschland: `i=stripbooks` gilt auch auf amazon.de.
  - Marktplatz nach Markt (E9, §2.4): `.com` als Default, `.co.uk` und `.de` nach Erkennung oder Nutzerwahl. Affiliate-Tag pro Marktplatz (8.3). Amazon leitet ISBN-10-Direktlinks zwischen Marktplätzen nicht um, deshalb muss die Domain zum Markt passen.
  - Gleiche Prüfung für Bookshop.org (`/book/<ISBN>`?) und AbeBooks (`isbn=` ist dort bereits exakt).
- [x] **Jede Variante braucht einen Suchweg, auch ohne ISBN.** *Erledigt 2026-09-06 als zweite Link-Ebene „Find this exact cover“: AbeBooks und eBay nach Titel/Autor/Verlag/Jahr auf der Markt-Domain, Google Lens und TinEye mit dem Cover-Bild, WorldCat, Open-Library-Ausgabenseite.* Ausgaben vor 1970 und viele OL-Datensätze haben keine ISBN, dann gibt es heute gar keinen Link. Kandidaten, in dieser Reihenfolge anbieten:
  - AbeBooks nach Titel + Verlag + Jahr: `SearchResults?tn=<Titel>&pn=<Verlag>&yrl=<Jahr>&yrh=<Jahr>` (dort haben Antiquare oft eigene Fotos, also das tatsächliche Cover).
  - eBay nach Titel + Verlag + Jahr (Sammlerausgaben, Erstauflagen).
  - **Reverse Image Search mit dem Cover-Bild:** Google Lens per URL (`https://lens.google.com/uploadbyurl?url=<Cover-URL>`), TinEye (`https://tineye.com/search?url=<Cover-URL>`), Bing Visual Search. Findet Händlerangebote und Blogposts zum exakten Cover; kein API-Key nötig, nur Links.
  - Bibliotheken: WorldCat (`worldcat.org/search?q=<Titel Verlag Jahr>`), Open-Library-Ausgabenseite (`openlibrary.org/books/<OL-ID>`) als Nachweis.
  - Umsetzung: `lib/buylinks.ts` bekommt zwei Ebenen, „Kaufen (ISBN)“ und „Suchen (Titel/Verlag/Jahr/Bild)“; die zweite ist immer da.
- [x] **Dedupe der Cover ist noch zu schwach.** *Erledigt 2026-09-07 mit den drei Stufen aus §9.3 Schritt 12; die Zeitnot fiel schon mit Schritt 11 weg.* *Erster Schritt erledigt 2026-09-06 mit dem Bild-Hash (unten „Richtig“): `lib/imagehash.ts` (dHash 64 Bit, Kontrastmaß), `lib/coverhash.ts` (Bilder klein laden, 8 parallel, 4 s Budget, Next-Cache 30 Tage), `foldDuplicateCovers` in `lib/works.ts` (Hamming ≤ 8 = dasselbe Bild; OL-Scan vor Google-Bild als Repräsentant; leere Scans fallen, außer sie sind das einzige Cover einer Ausgabe). Kacheln zeigen „+N“. Was im Budget nicht gehasht wird, faltet beim nächsten Aufruf, weil die Bilder dann im Cache sind.* Bei *1984* stehen mehrere identische Cover nebeneinander, mit derselben Beschriftung im Hover (z. B. dreimal derselbe Verlag und Jahr). Ursachen: Open Library hat pro Ausgabe mehrere hochgeladene Scans desselben Covers (verschiedene `cover_i`), und derselbe Druck existiert als mehrere OL-Ausgaben ohne ISBN, die wir nicht zusammenführen können.
  - Kurzfristig, ohne Bildvergleich: Cover, deren Ausgaben in Titel + Verlag + Jahr + Sprache übereinstimmen, zu **einer Kachel mit „+2 ähnliche“** zusammenfassen; die Kachel zeigt das erste Bild, die Details listen alle. Falsch-positiv möglich (echte Neugestaltung im selben Jahr beim selben Verlag), deshalb aufklappbar statt verworfen.
  - Richtig: perzeptueller Hash (dHash/pHash) serverseitig pro Cover-ID, gecacht; Hamming-Distanz ≤ Schwelle = dasselbe Bild. Schließt auch den Fall „Scan bei OL, Verlagsbild bei Google“ ab. Damit zieht Phase 2 aus E8 nach vorn.
  - Nebeneffekt: mit dem Hash lassen sich auch leere Scans erkennen (geringe Varianz) und ausblenden.

---

## 2026-09-06 · Analyse: eine Suche, der man vertrauen kann, Schritte 10–16 (alte §9)

Anlass (Julian): „Ich wundere mich manchmal, wie wenig Cover angezeigt werden. Das Deduping funktioniert noch nicht gut. Die Kauf-Links finden vielleicht nicht die richtige Ausgabe. Das Herzstück der Website ist eine Suche und Suchlogik, der man vertrauen kann. Der Hero-Claim ist zu selbstbewusst, wir werden nie *alle* Cover finden.“

Gemessen gegen die Live-APIs am 2026-09-06 mit den Werken *The Great Gatsby* (OL468431W), *Nineteen Eighty-Four* (OL1168083W), *Beloved* (OL50548W) und *Mumbo Jumbo* (OL30751W). Skripte lagen im Scratchpad, die Zahlen stehen hier.

### 9.1 Befund

**A. Die Detailseite zeigt einen Bruchteil der Cover, und zwar den falschen.**

| Work | Ausgaben bei OL | davon mit Cover | von uns gezeigt | Anteil |
|---|---|---|---|---|
| The Great Gatsby | 1180 | 379 | 43 | 11 % |
| Nineteen Eighty-Four | 537 | 272 | 68 | 25 % |
| Beloved | 110 | ~44 | 44 | ~100 % |

Ursache: `getEditions` liest 100 Einträge pro Aufruf und hört bei `minWithCovers = 24` auf, also nach der ersten Seite. Open Library sortiert `editions.json` nach Anlagedatum des Datensatzes absteigend: Seite 1 enthält die zuletzt angelegten Ausgaben (bei Gatsby ausschließlich 2011–2022, viele türkische Lizenzausgaben), die Cover der Erstausgaben und der 1950er–1990er kommen nie. Ein kompletter Durchlauf kostet 3–5 s pro Seite, bei Gatsby 12 Seiten ≈ 54 s. Der Kaltstart der 1984-Seite scheiterte einmal mit „Book data source unavailable“ nach 10 s. Das ist der Kern von „so wenig Cover“: nicht die Quellen sind dünn, wir lesen sie nicht aus.

**B. Die Dedupe scheitert vor allem am Zeitbudget, dann an der Schwelle.**

- Gatsby kalt: 55 Cover, 1 gefaltet. Dieselbe Seite warm (Bilder im Cache): 9 gefaltet. Das 4-s-Budget in `hashCovers` reicht beim ersten Aufruf für einen Bruchteil der Bilder; identische Scans (Distanz 0: Chiltern 2021 zweimal, Porto Editora 2020 dreimal) bleiben beim ersten Besucher nebeneinander stehen. Der Nutzer sieht die kalte Seite.
- Echte Duplikate liegen oberhalb der Schwelle 8, wenn sie Metadaten teilen. Beloved: Knopf 1987 dreimal dasselbe Design mit Distanzen 5, 9, 12; Rowohlt 1994 gleiche ISBN, Distanz 16 (ein Scan mit, einer ohne rororo-Banderole); Debolsillo 2011 gleiche ISBN, Distanz 12–14 (OL-Scan gegen Google-Bild). Gatsby: Herder 2021 gleiche ISBN, Foto des Buchs gegen Verlagsbild, Distanz > 22.
- Falsch-positiv-Risiko ohne Metadaten: dasselbe Public-Domain-Artwork („Celestial Eyes“) bei Scribner 2003 und Lulu 2021 hat Distanz 19; verschiedene türkische Verlage teilen Layouts mit Distanz 17–22. Eine reine Schwellenanhebung auf 16–20 würde das falten. Die Distanz allein taugt also nur bis 8; darüber entscheidet die Metadaten-Nähe.
- Leere Scans: zwei Plume-1998-Ausgaben bei Beloved tragen als einziges „Cover“ eine gescannte Textseite (Hash `e0c0c0c0c0000000`). Sie bleiben stehen, weil die Regel nur Leerscans mit Alternative fallen lässt.

**C. Die Suche rankt das falsche Work nach vorn.**

- `1984`: Open Library selbst liefert *Nineteen Eighty-Four* (537 Ausgaben, `readinglog_count` 8491) auf Platz 1. Unser Ranking setzt das Work „1984“ (8 Ausgaben, `readinglog_count` 73, Orwell plus französische Übersetzerin als Autorin) davor, dahinter die Bühnenfassung von Icke/Macmillan und die Adaption von Michael Dean. Grund: exakter Titeltreffer gibt 100 Punkte, Popularität maximal 40. Die Akzeptanzprüfung „Orwell an erster Stelle“ war zu lasch und ist oben verschärft.
- Open Library liefert im Suchergebnis Popularitätsfelder (`readinglog_count`, `want_to_read_count`, `ratings_count`), die wir nicht abfragen, und bereits eine gute Reihenfolge. Wir werfen beides weg.
- Ableitungen sind nicht erkannt: „(adaptation)“, Graphic Novel (Orwell + Fido Nesti), Bühnenfassung, „SparkNotes for …“, „(Book Analysis)“, „For Fans“, „Trivia“. Die Regex `SECONDARY_LITERATURE` deckt nur Study-Guide-Vokabular.

**D. Die Karten im Suchergebnis haben fast immer nur ein Cover.**

OL-Suche liefert genau ein `cover_i` pro Work; Google-Treffer hängen nur bei exakt gleichem Titel an (Gatsby: 3 von 17 Kandidaten, die übrigen sind Sekundärliteratur oder Titel mit Zusatz). Ergebnis: 15 Works, 18 Cover vorher, 22 nachher. Das Mosaik (F4) tritt praktisch nie ein. N2 (kein Fan-out) war richtig für die synchrone Antwort, blockiert aber die Karten.

**E. Kauf-Links: der Link ist präzise, die Zuordnung Cover → ISBN ist es nicht.**

- Technisch stimmt der Link: Amazon `/dp/<ISBN-10>`, die anderen suchen per ISBN-13. Mehrere ISBN-13 pro OL-Datensatz sind selten (1 von 300 Gatsby-Einträgen), die „andere ISBN-Art“ ist nicht das Problem.
- Das Problem ist, was der Händler unter der ISBN liefert. Abgleich OL-Cover gegen Googles ISBN-Bild bei Beloved: 9780307388629 Distanz 0 (gleiches Cover), 9783499130656 Distanz 14 (gleiches Design, anderer Scan), 9781400033416 Distanz 27 und 9780394535975 Distanz 25 (der Handel zeigt ein **anderes** Cover als unser Scan). Für die Hälfte der geprüften ISBNs mit Google-Bild würde der Käufer also ein anderes Cover bekommen, und wir sagen es ihm nur pauschal („cover may differ“).
- Für viele ISBNs hat Google gar kein Bild (9 von 14), dort ist keine Aussage möglich.

**F. Der Claim verspricht, was A widerlegt.**

„Every cover of every edition, in one place“ (Hero, Header-Zeile, Meta-Description) neben einer Seite, die 11 % der bekannten Gatsby-Cover zeigt. Ehrlich wäre: wir zeigen, was zwei offene Kataloge kennen, und sagen, wie viel das ist.

### 9.2 Grundsatz

Vertrauen entsteht aus drei Dingen, in dieser Reihenfolge: das richtige Work ganz oben (C), sichtbar vollständige Cover-Wand mit ehrlichem Zähler (A, F), und Kauf-Links, die sagen, wie sicher die Zuordnung ist (E). Dedupe (B) und Mosaik (D) sind Qualität obendrauf. Jede Aussage im UI muss aus Daten folgen, die wir gemessen haben; wo wir es nicht wissen, steht das da.

### 9.3 Plan (Schritte 10–15, Fortsetzung von §7)

**Schritt 10 – Ranking mit Popularität und Ableitungs-Erkennung (C).** *Erledigt 2026-09-07.*
- OL-Suche fragt zusätzlich `readinglog_count`, `want_to_read_count`, `ratings_count` ab; sie stehen als `popularity` an `WorkSummary`, dazu `sourceRank`, die Position in Open Librarys eigener Reihung.
- **Neue Relevanz** (`relevance` mit `RankContext` in `lib/works.ts`): Ausgangspunkt ist `100 − 5 · sourceRank`, denn Open Library liegt bei allen sieben geprüften Queries mit Platz 1 richtig. Dazu bis zu 40 Punkte Popularität, **relativ zum meistgelesenen Werk desselben Ergebnisses** (`40 · log2(Leser+1) / log2(max+1)`); eine feste Deckelung hätte 8.491 und 73 Leser beide auf denselben Wert gebracht. Titeltreffer nur noch 20/10/5. Ohne Leserzahlen fällt die Formel auf die Ausgabenzahl zurück.
- **Ableitungen** (`derivativeIds`) verlieren 60 Punkte: Titel mit „(adaptation)“, „[adaptation]“, „graphic novel“, „stage“, „retold by“ usw. (`MARKED_DERIVATIVE` in `lib/normalize.ts`), und Werke, deren **Nicht-Erstautor** Erstautor eines Werks mit ≥ 10-facher Ausgabenzahl im selben Ergebnis ist (Dean/Orwell). `SECONDARY_LITERATURE` wurde um „book analysis“, „for fans“, „trivia“, „quiz“, „festschrift“ und weitere erweitert.
- **Gemessen live am 2026-09-07:** alle sieben Queries liefern das richtige Werk auf Platz 1. `1984` → *Nineteen Eighty-Four* (vorher das 15-Ausgaben-Work „1984“), `harry potter` → Band 1 (vorher das Pop-up-Buch von Wilson/Reinhart), `beloved` → Morrison, `the great gatsby` → Fitzgerald, `mumbo jumbo` → Reed, `gravity's rainbow` → Pynchon, `pride and prejudice` → Austen.
- Akzeptanztest für `1984` prüft jetzt die Work-ID, nicht mehr nur den Autor, plus dass Adaptionen unter dem Roman stehen. Fixtures neu aufgenommen, weil sie die Popularitätsfelder noch nicht enthielten.

**Schritt 11 – Vollständige Cover-Wand durch fortlaufendes Nachladen (A, F).** *Erledigt 2026-09-07.* Umsetzungsplan in [plans/PLAN-11.md](plans/PLAN-11.md). Gemessen im Browser:

| Work | Cover vorher | Cover nachher | Ausgaben geprüft |
|---|---|---|---|
| The Great Gatsby | 43 | 331 (301 nach vollständigem Hashing) | 1.180 von 1.180 |
| Nineteen Eighty-Four | 68 | 232 | 537 von 537 |
| Beloved | 44 | 59 | 110 von 110 |
| Mumbo Jumbo | 12 | 12 | 23 von 23 |
| Pride and Prejudice | – | 192 | erste 1.500 von 4.041 (Kappung) |

Gatsby kalt: erste Wand nach 8 s, vollständig nach etwa 38 s; warm unter 5 s. Die Cover-Zahl sinkt bei wiederholtem Aufruf (331 → 301), weil dann mehr Bilder gehasht im Cache liegen und mehr Duplikate falten — die Konvergenz aus §2.3 Phase 2, jetzt sichtbar. Kaltstart von 1984 endet nicht mehr im Fehler, weil Seite 0 nur ein einziger Editions-Aufruf ist.
- Work-Route wird seitenweise: `GET /api/works/[id]?offset=0` liefert Work, Ausgaben und Cover der ersten OL-Seite plus Google-Kandidaten, dazu `total` (OL-Größe), `nextOffset` und pro Cover seinen Hash (`hash`, `contrast`), soweit berechnet. `?offset=100` usw. liefern nur die Ausgaben und Cover dieser Seite. Jede Seite ist einzeln im Next-Cache (24 h), ein Nutzer wärmt sie für alle.
- Die Detailseite lädt Seite 0 wie heute (Ladeszene), zeigt die Wand und lädt im Hintergrund weiter, eine Seite nach der anderen, bis `nextOffset` fehlt oder 1500 Einträge erreicht sind. Neue Cover werden angehängt, die Sprachgruppen neu berechnet; der Zähler sagt „N covers · M of K editions checked“ und am Ende „N covers from K editions“. Falten über alle Seiten passiert im Client mit `foldDuplicateCovers` (rein, läuft dort genauso) über die mitgelieferten Hashes; Cover ohne Hash bleiben ungefaltet, bis ein späterer Aufruf sie liefert.
- Sortierung innerhalb der Sprachgruppen bleibt Jahr absteigend; neu eintreffende alte Ausgaben rutschen also nach hinten, nicht nach vorn, die Wand springt nicht. Unbekanntes Jahr ganz hinten.
- `stage=fast/full` entfällt zugunsten des Seitenmodells: Seite 0 rechnet Hashes mit kleinem Budget (2 s), jede Folgeseite mit ihrem eigenen Budget; damit ist beim letzten Nachladen praktisch alles gehasht.
- Grenze: Werke mit mehr als 1500 Ausgaben (Bibel, Shakespeare-Sammlungen) werden gekappt, der Zähler sagt das.
- Persistenz: der Next-Cache reicht für den Start (8.2). Wenn Hosting steht, wandern Hashes und Seiten in KV (8.6), damit ein Deploy den Vorrat nicht löscht.

**Schritt 12 – Dedupe in drei Stufen (B).** *Erledigt 2026-09-07.* `foldDuplicateCovers` bekommt jetzt die Ausgaben mit und entscheidet gestuft (`sameCover` in `lib/works.ts`):

- **Stufe 1, immer:** Distanz ≤ 8. Wie bisher.
- **Stufe 2, gleiche ISBN-13 an beiden Covern:** Distanz ≤ 20. Deckt Katalog-Scan gegen Verlagsbild.
- **Stufe 3, gleicher Verlag und Jahr ±1 und gleiche oder unbekannte Sprache:** Distanz ≤ 16. Deckt die drei Knopf-Scans von 1987.
- Über Verlagsgrenzen wird oberhalb von 8 nie gefaltet, über Sprachgrenzen nie. Verlagsnamen vergleicht `samePublisher` über Wortmengen: „Knopf“ passt zu „Alfred A. Knopf“ und „Knopf, New York“, „Scribner“ nicht zu „Lulu.com“.

**Gemessen im Browser (Cover nach dem Falten):**

| Werk | vor Schritt 12 | nach Schritt 12 |
|---|---|---|
| The Great Gatsby | 301 | 293 |
| Nineteen Eighty-Four | 232 | 226 |
| Beloved | 57 | 51 |
| Mumbo Jumbo | 12 | 12 |

**Abweichung vom Plan: leere Scans werden nicht mehr entfernt, sondern nach hinten sortiert.** Der Plan wollte sie ausblenden und die Ausgaben in einer Liste „Editions without a usable cover“ führen. Beim Prüfen der acht Bilder, die die Regel bei *1984* traf, waren vier davon echte Cover: die Leineneinbände der Harcourt-Erstausgabe von 1949 (dunkel, kontrastarm), ein blauer Knopf-Einband von 1992 und ein schlichtes weißes Kaktos-Cover von 1999. Die alte Regel „Kontrast < 6“ war dabei der schlimmere Übeltäter, sie traf jeden dunklen Einband.

Die neue Regel `looksLikeScannedPage` verlangt alle drei Bedingungen zugleich: nahezu weiß (Mittelwert ≥ 245), flach (Kontrast < 20) und ohne Struktur (≤ 12 gesetzte Bits im Hash). Jede Bedingung allein trifft echte Cover: das blasseste echte Cover der Stichprobe liegt bei 234, ein echtes Arcturus-Cover bei Kontrast 10,5, und Knopfs weißer *Beloved*-Schutzumschlag hat 23 Bits bei Mittelwert 251. Selbst zusammen bleibt eine Überschneidung: das weiße griechische *1984* ist von einer Klappentext-Seite an diesen Zahlen nicht zu unterscheiden. **Deshalb wird nichts gelöscht, sondern nur ans Ende der Sprachgruppe sortiert** (`groupCoversByLanguage` mit Signaturen). Ein Fehlurteil kostet dann eine Position statt eines Covers.

**Nebenbefund und Korrektur:** Ein einzelner langsamer Editions-Aufruf (Open Library brauchte 13,4 s bei 12 s Timeout) ließ die ganze Detailseite als „Book data source unavailable“ enden, beobachtet bei *Mumbo Jumbo*. Seite 0 wird jetzt einmal wiederholt; der zweite Versuch trifft den Cache, den der erste gefüllt hat.

**Sprach-Pillen (Julian, 2026-09-07):** Englisch steht fest an erster, Deutsch an zweiter Stelle, der Rest folgt nach Häufigkeit, Unbekannt zuletzt; eine explizit gesuchte Sprache steht vor allen. Die Ladeszene wartet, bis eine englische Ausgabe da ist (`leadLanguagesSettled`), längstens bis 300 Ausgaben geprüft sind, damit die vorderen Reiter nicht unter dem Mauszeiger nachrücken. Der Rest der Reihe darf sich beim Nachladen weiter nach Häufigkeit umsortieren.

**Schritt 13a – ISBN-Nachschau erst bei Auswahl (Kontingent, §8.7).** *Erledigt 2026-09-07.* `lookupByIsbns` ist aus `getWorkPage` verschwunden; die neue Route `GET /api/isbn/<isbn13>?signatures=1` (`lib/isbn.ts`) liefert das Handelsbild einer ISBN, und die Detailseite fragt danach, sobald ein Cover ausgewählt ist (`useIsbnCovers`). Die Bilder kommen vor dem Falten in die Wand, damit ein Handelsbild, das dem Katalog-Scan gleicht, in ihn hineinfaltet statt doppelt zu erscheinen. Welche ISBN gefragt wird, entscheidet eine Auswahl allein auf den Katalogdaten (`buildWall` ohne Zusatz-Cover), sonst hinge die Frage von ihrer eigenen Antwort ab.

- **Verbrauch pro Detailseite: 7–11 → 2** Google-Anfragen (eine Titelsuche beim Laden, eine Nachschau je ausgewähltem Cover), im Integrationstest festgehalten.
- **Gemessen im Browser (Beloved):** 59 Cover beim Laden vorher, 57 nachher; ein Klick auf eine andere Ausgabe holt deren Handelsbild nach und die Wand wächst auf 58. Trägt ein gefaltetes Cover zwei Ausgaben mit verschiedenen ISBNs, werden beide gefragt.
- Offen für Schritt 13: das geholte Bild wird bisher nur angezeigt, noch nicht mit dem gewählten Cover verglichen und als „verified / differs / unknown“ ausgewiesen.

**Schritt 13 – Kauf-Links mit Verifikationsgrad (E).** *Erledigt 2026-09-07.*

Beim Auswählen eines Covers holt die Seite über die Route aus 13a das Bild, das der Handel zu dieser ISBN führt, und vergleicht es mit dem gezeigten Cover. Der Vergleich benutzt **nicht** eine zweite Schwelle, sondern die Faltung der Wand selbst (`verifyIsbnCover` in `lib/works.ts`): Ist das Handelsbild in das gewählte Cover hineingefaltet, zeigt der Handel dieses Design; blieb es eine eigene Kachel, zeigt er ein anderes, und genau diese Kachel bekommt der Käufer. Das hält Urteil und Wand konsistent und nutzt die Metadaten-Stufen aus Schritt 12 mit.

| Urteil | Text über den Links | Verhalten |
|---|---|---|
| `verified` | „The publisher's current image for this ISBN is this cover.“ | Kauf-Links zuerst |
| `differs` | „The publisher's current image for this ISBN is a different cover.“ mit diesem Bild daneben, verlinkt auf dessen Kachel | **Suchwege zuerst**, dann die Kauf-Links |
| `unknown` | „No current publisher image is on record for this ISBN.“ | Kauf-Links zuerst |

**Der Text nennt die Quelle, weil die Prüfung nur so weit reicht (Julian, 2026-09-07).** Es wird **kein Händler abgefragt**: Thalia, Amazon, Bookshop und die übrigen Links sind reine URL-Vorlagen aus der Tabelle in `lib/buylinks.ts`, die erst beim Klick des Nutzers benutzt werden. Der Server kontaktiert überhaupt nur drei Hosts: Open Library, dessen Cover-Server und Google Books. Googles Bild stammt aus dem Metadaten-Feed des Verlags, aus dem sich die Händler in der Regel ebenfalls bedienen — gutes Indiz, aber keine Messung an einer Händlerseite. Eine frühere Fassung sagte „Shops list this ISBN with this cover“ und behauptete damit mehr, als geprüft wird.

**Gemessen an 20 ISBNs von *Beloved* (2026-09-07):** 4 `verified`, 4 `differs`, 12 `unknown`. Wo Google überhaupt ein Bild hat, zeigt der Handel also in der Hälfte der Fälle ein anderes Cover — der Befund aus §9.1 E, jetzt an der Oberfläche.

**Nebenbefund, behoben:** Google Books antwortete während der Messung auf etwa jede dritte Anfrage mit einem transienten 503. Das machte aus einem Ausfall stillschweigend die Aussage „kein Cover bekannt“ — eine falsche Auskunft im Gewand eines Befundes. `getIsbnCovers` wiederholt jetzt einmal und meldet sonst `unavailable`; der Client merkt sich diese Antwort nicht, fragt also später erneut. Vorher und nachher an denselben 20 ISBNs: 3/3/14 mit zwei stillen Ausfällen, danach 4/4/12 ohne.

**Nicht umgesetzt:** mehrere ISBN-13 an einem Datensatz („also as ISBN …“). Das betrifft 1 von 300 geprüften Gatsby-Einträgen; der Aufwand (Modell, Merge, Links, UI) steht nicht dafür. Amazon bleibt wie geplant beim Direktlink `/dp/<ISBN-10>`; zusätzliche Metadaten in Händler-URLs bringen nichts, weil die Händler ohnehin nach ISBN suchen.

**Schritt 16 – Verfügbarkeitsprüfung, Scrollen, Link-Art (Julian, 2026-09-07).** *Erledigt.*

- **Seitenleiste scrollt selbst.** Sie ist höher als der Bildschirm; ein einfaches `sticky` heftet nur ihren Kopf fest, sodass man erst an der ganzen Cover-Wand vorbeiscrollen musste, um an die Kauf-Links zu kommen. Sie hat jetzt `max-h-[calc(100vh-6rem)]` und `overflow-y-auto`, das Rad scrollt erst die Leiste, dann die Seite.
- **Kauf-Links öffnen in neuem Tab.** War bereits so; im DOM geprüft, alle 26 Links der Leiste tragen `target="_blank"`. Einzige Ausnahme ist das Vorschaubild im `differs`-Hinweis, das absichtlich in der Seite bleibt, weil es nur die Auswahl wechselt.
- **Link-Art ist ausgezeichnet.** `BuyLink.kind` sagt ohne jede Anfrage, ob ein Link auf eine Buchseite führt (Amazon `/dp/`, Blackwell's, Bookshop mit Affiliate-ID) oder auf eine Trefferliste; Suchen tragen ein kleines „search“.
- **Button „Check availability“** (`lib/availability.ts`, `GET /api/availability`). Er fragt jeden Händler des Marktes nach dieser ISBN **und** nach einer Kontroll-ISBN, die es nicht geben kann, und vergleicht die Antworten.

**Was dabei herauskam, und warum der Button weniger sagt, als man hoffen würde.** Gemessen am 2026-09-07 gegen die echten Shops, je eine reale und eine unmögliche ISBN:

| Händler | Antwort auf eine Server-Anfrage |
|---|---|
| Amazon .com | jedes Mal Bot-Prüfung |
| Amazon .de / .co.uk | meist echte Produktseite, unterscheidbar |
| AbeBooks (alle Märkte) | echte Trefferliste, unterscheidbar |
| Bookshop.org US | unterscheidbar; UK 403 |
| Thalia | mal 403, mal unterscheidbar |
| Hugendubel, genialokal | HTTP 200, aber **byte-identisch** für reale und unmögliche ISBN: Treffer werden im Browser gerendert |
| eBay, ThriftBooks, Blackwell's, Booklooker, Waterstones | 403, 406, 429 oder Bot-Prüfung |

Ein serverseitiger Test kann also für etwa zwei von sechs Händlern eine positive Aussage treffen und sonst nichts. Deshalb heißen die Zustände **„found it“, „can't tell“, „won't answer“, „no answer“** — `can't tell` darf ausdrücklich **nicht** als „hat es nicht“ gelesen werden, denn Hugendubel und genialokal führen das Buch sehr wohl. Und keiner der Zustände ist eine Bestandsprüfung. Der Button läuft nur auf Klick, das Ergebnis wird sechs Stunden gecacht, die Kontrollantwort 24 Stunden.

- **Prüfskript `scripts/check-buylinks.ts`** macht dieselbe Messung über alle Märkte und ISBNs auf der Kommandozeile. Damit ist der offene Punkt „Händler-URLs geprüft“ aus §8.7 bedienbar; vor dem Start und nach jeder Händler-Änderung laufen lassen.

**Schritt 14 – Mosaik durch nachgeladene Cover je Karte (D).** *Erledigt 2026-09-07.*

Jede Karte fragt `GET /api/works/[id]?summary=1` an, dieselbe gecachte Seite 0, die auch die Detailseite zuerst lädt. Die Antwort ist auf bis zu vier Cover **verschiedener Ausgaben** verkürzt, damit ein Mosaik vier Bücher zeigt und nicht vier Scans desselben. `components/coverQueue.ts` lässt acht Anfragen gleichzeitig zu, `useCardCovers` hängt sie hinter das Cover, das die Suche selbst geliefert hat, damit das Raster nicht springt.

**Gemessen im Browser (Karten mit mehr als einem Cover):**

| Suche | vorher | nachher |
|---|---|---|
| dune | 3 von 20 | 20 von 20 |
| beloved | 2 von 20 | 17 von 20 |
| the great gatsby | 1 von 13 | 10 von 13 |

Über die drei Suchen zusammen 47 von 53 Karten statt 6. Der Befund D aus §9.1 ist damit erledigt.

**Abweichung vom Plan: kein IntersectionObserver.** Geplant war, nur sichtbare Karten zu laden. Verworfen, weil der Gewinn klein und der Preis eine zusätzliche Fehlerquelle ist: Ein Ergebnis hat höchstens zwanzig Karten, die Warteschlange deckelt ohnehin auf acht gleichzeitige Anfragen, und jede Antwort liegt einen Tag im Server-Cache. Beim Prüfen zeigte sich zudem, dass der Observer in eingebetteten Browsern gar nicht auslöst — dann bleiben fast alle Karten einbildrig, ohne erkennbaren Grund. Ein Nebeneffekt der einfacheren Fassung: das Mosaik steht schon da, bevor der Leser scrollt, und der Klick auf die Detailseite ist vorgewärmt.

**Bekannte Schwäche:** Die Kurzantwort hasht nicht, weil das Hashing für ein ganzes Ergebnisraster teurer wäre als das Mosaik wert ist. Vereinzelt landet deshalb ein gescannter Textseiten-Vorsatz in einer Kachel (bei *Dune* zwei von achtzig Bildern). Auf der Detailseite sortiert `looksLikeScannedPage` solche Bilder nach hinten; im Mosaik fehlt diese Information.

**N2 angepasst:** Die Suche macht seit dem 2026-09-07 **einen** synchronen externen Call; dazu kommen gedeckelte, gecachte Nachlade-Calls pro Karte. Damit ist E4 (a) in §8.6 entschieden, und der frühere Google-Aufruf der Suche ist ersatzlos entfallen.

**Schritt 15 – Ehrliche Sprache (F).** *Erledigt 2026-09-07.*

Die Seite behauptete an vier Stellen, alle Cover aller Ausgaben zu zeigen, während der Zähler auf der Detailseite seit Schritt 11 die Wahrheit sagt. Das ist beseitigt; nirgends steht mehr „every“ oder „all“.

| Stelle | Neu |
|---|---|
| Hero-Überschrift | „Judge a book *by its covers.*“ |
| Hero-Unterzeile | „Compare the editions of a book side by side, by language and year, and find the one you’d actually want on your shelf.“ |
| Wortmarke im Header | „Covers, side by side.“ |
| Meta-Description | „Compare the covers and editions a book has been printed with, side by side. Data from Open Library and Google Books.“ |
| README | „the editions those catalogues have a cover for“ statt „every edition“; die veraltete Status-Zeile ersetzt |
| `CoverGallery` | `aria-label` von „All covers“ auf „Covers“ |

Die Überschrift dreht das Sprichwort um: hier ist das Urteil nach dem Äußeren der Zweck, und es gibt viele Umschläge. Sie verspricht keine Vollständigkeit, nennt „book“ und „covers“ für die Suche und ist kurz genug zum Weitersagen, was für §8.4 zählt. Fußzeile und Fußnote unter der Wand waren bereits korrekt und blieben unverändert.

Die About-Seite, die in der ursprünglichen Fassung dieses Schrittes stand, gehört zu §10 B: sie entsteht zusammen mit Impressum und Datenschutz, weil sie dieselben Fußzeilen-Links braucht.

Reihenfolge: alle Schritte 10 bis 16 sind erledigt (11, 13a, 10, 12, 13, 16, 15, 14, in dieser Folge). 10 und 15 zuerst, weil sie ohne Umbau sofort Vertrauen zurückholen; 12 nach 11, weil die Dedupe ohne vollständige Daten und Hashes nicht messbar war; 13a vor 13 und notfalls sofort, weil es das Google-Kontingent um den Faktor fünf entlastet (§8.7).

---

## 2026-09-07 · Die gewählte Sprache schlägt durch; das Mosaik bleibt sprachneutral (alte §8.5.1)

- [x] **Die im Suchfeld gewählte Sprache schlug nicht auf die Detailseite durch.** *Behoben 2026-09-07.* Gemessen an `/book/OL1168083W?q=1984&lang=de`: die URL trug die Sprache, die Wand zeigte trotzdem den englischen Tab mit einem englischen Cover. Drei Ursachen in derselben Kette:
  1. `orderGroups` in `lib/pages.ts` setzte die gewünschte Sprache nur dann nach vorn, wenn sie *nicht* zu den festgesetzten Lead-Sprachen `en`/`de` gehörte — also gerade bei den beiden Sprachen nicht, die im Filter am häufigsten gewählt werden. Ein Test hielt das ausdrücklich fest. Die Absicht war, eine Position nicht doppelt zu vergeben; die Wirkung war, den Wunsch des Lesers zu verwerfen. Jetzt führt die gewünschte Sprache immer, die restlichen Lead-Sprachen folgen.
  2. `leadLanguagesSettled` wartete auf Englisch statt auf die gewünschte Sprache. Open Library sortiert Ausgaben nach Datensatzalter, deutsche Ausgaben liegen deshalb oft erst auf Seite 2 oder 3; die Ladeszene endete vorher, und der deutsche Tab schob sich später unter dem Cursor des Lesers dazwischen. Die Obergrenze der Wartezeit bleibt (`done` oder 300 geprüfte Ausgaben), damit eine Sprache, die das Werk nicht hat, die Szene nicht anhält.
  3. Das ausgewählte Cover ist das erste der ersten Gruppe und folgte damit automatisch mit.

  **Bewusst nicht geändert: das Mosaik auf den Suchkarten bleibt sprachneutral.** Gemessen am 2026-09-07 auf Seite 0 dreier Werke (die Karten haben nur diese eine Seite):

  | Werk | Cover auf Seite 0 | Sprachen der ersten acht |
  |---|---|---|
  | Nineteen Eighty-Four | 24 | es, –, –, ca, –, –, –, – |
  | Frankenstein | 22 | –, pt, pt, fr, nl, –, es, pt |
  | The Lord of the Rings | 62 | it, pt, –, es, –, –, de, – |

  Seite 0 ist ein Sprachengemisch, meist ohne Sprachangabe und fast nie in der gesuchten Sprache: bei *1984* liegt dort keine einzige deutsche Ausgabe. Eine Sortierung nach Wunschsprache hätte also nichts zu sortieren, und weitere Seiten pro Karte zu laden ist um Größenordnungen zu teuer. Die Karte zeigt das Buch, nicht die Ausgabe; die Sprache entscheidet sich auf der Detailseite.

---

## 2026-09-07 · Google-Kontingent: Messung, Ablesung, Sicherungsautomat, Rate-Limit (alte §8.7)

**Google-Books-Kontingent: reicht es, kann man es kaufen?** (Anlass: Schritt 11 machte die Kosten pro Seitenaufruf sichtbar. Antwort: 1.000 pro Tag, ohne Selbstbedienungsweg nach oben; die offenen Folgeentscheidungen stehen in ROADMAP.md.)

  **Gemessen 2026-09-07, Aufrufe pro Vorgang bei kaltem Cache:**

  | Vorgang | Google-Aufrufe |
  |---|---|
  | Eine Suche | 1 |
  | Detailseite, Seite 0 | 7 (Gatsby) bis 11 (Obergrenze: 1 Titelsuche + 10 ISBN-Nachschauen) |
  | Detailseite, jede weitere Seite | 0 |

  Bei einem Tageskontingent von 1.000 Anfragen sind das etwa **90 kalt aufgerufene Detailseiten pro Tag**. Der Next-Cache fängt Wiederholungen ab (Titelsuche 1 h, ISBN-Nachschau 24 h), ein Deploy löscht ihn aber. Suchen fallen kaum ins Gewicht.

  **Was Google nach Schritt 11 überhaupt noch beiträgt** (gemessen, ganzes Werk, vor der Faltung):

  | Werk | Cover gesamt | davon Google | Ausgaben gesamt | davon Google | mit Beschreibung | mit Vorschau-Link |
  |---|---|---|---|---|---|---|
  | Beloved | 72 | 12 | 51 | 3 | 9 | 11 |
  | Mumbo Jumbo | 13 | 3 | 10 | 2 | 2 | 3 |
  | 1984 | 282 | 4 | 246 | 2 | 4 | 4 |

  Für die **Menge** an Covern ist Google seit Schritt 11 zweitrangig: 1 bis 23 Prozent, bei 1984 vier Bilder von 282. Unverzichtbar ist es für etwas anderes: die ISBN-Nachschau liefert das Bild, das der **Handel heute** zu einer ISBN zeigt. Nur damit lässt sich Schritt 13 bauen („Sellers show a different cover for this ISBN“), und genau das ist das Vertrauensversprechen aus §9.2. Beschreibungen und Vorschau-Links sind angenehm, aber ersetzbar.


  1. ~~Wie hoch ist das Kontingent 2026 tatsächlich?~~ **Abgelesen am 2026-09-07 in der Google-Cloud-Konsole, Projekt `beautifulbooks`:**

     | | |
     |---|---|
     | **Queries per day** | **1.000**, als anpassbar markiert |
     | Queries per minute per user | 100, anpassbar |
     | Verbrauch am 2026-09-07 | 298 (29,8 %) |
     | Sieben-Tage-Spitze über 90 % | keine |
     | Antwortverteilung, 30 Tage | 200 bei 0,0075/s, **503 bei 0,001/s** |

     Damit gilt die untere der beiden kursierenden Zahlen. Die offizielle Dokumentation nennt weiterhin keine; die Konsole des eigenen Projekts ist die einzige verlässliche Quelle, und für andere Projekte kann der Wert abweichen.

     **Was das bedeutet, nach dem Mosaik-Fix vom selben Tag:** eine Suche kostet 1 Anfrage, eine kalte Detailseite 2. Das sind rund **500 kalte Detailseiten pro Tag** oder etwa **200 Besuche** aus einer Suche und zwei geöffneten Büchern. Ohne den Fix wären es 47 Trefferlisten gewesen.

     Zwei Nebenbefunde. Erstens bestätigt die 503-Kurve, dass Google regelmäßig grundlos ablehnt — der Retry aus Schritt 13 war nötig, nicht vorsichtig; am 2026-09-07 antwortete dieselbe ISBN-Anfrage im Abstand von Sekunden einmal mit 503 und einmal mit 200. Zweitens stammen die 298 Anfragen des Tages **allein aus der Entwicklung**: derselbe Schlüssel bedient Arbeit und Betrieb. **Offen: ein zweiter API-Schlüssel (oder ein zweites Projekt) für die Entwicklung**, sonst konkurriert jede Testsitzung mit den Besuchern um dieselben 1.000.
  2. ~~Lässt sich das Kontingent erhöhen, und kostet das etwas?~~ **Geprüft am 2026-09-07: es gibt keinen Selbstbedienungsweg.** Die Konsole führt „Queries per day" zwar als *anpassbar*, aber der Weg dahinter endet in der Hilfe für die **Google-Suche** (`support.google.com/websearch`, Thema 3378866) — eine Seite, die mit dem Books API nichts zu tun hat. Die Books API wird zudem, anders als Maps, **nicht** pro Anfrage verkauft; es gibt keinen Preis, den man einfach bezahlen kann.

     Zwei Dinge bleiben unbelegt und sind Julians Entscheidung, nicht meine: das [Formular für eine Kontingenterhöhung](https://discuss.google.dev/t/requesting-higher-quota-for-google-books-api-bookquest-app/286093) (Entwicklerberichte sprechen von langer Bearbeitung und häufigen Ablehnungen), und ob [aktivierte Abrechnung](https://support.google.com/googleapi/answer/7035610?hl=en) die Grenze anhebt — im Projekt ist heute **keine Abrechnung aktiviert**, die Konsole wirbt noch mit dem Startguthaben. Bei manchen Google-APIs hängt ein höheres Kontingent daran; für die Books API ist es unbelegt, und ein Versuch verlangt eine hinterlegte Zahlungsmethode.

     **Was stattdessen getan wurde, weil die Erhöhung ausfällt (2026-09-07):**
     - **Titelsuche im Cache von 1 Stunde auf 7 Tage.** Eine Stunde ist für Buchmetadaten absurd kurz; ein Werk, das an einem Tag zwölfmal geöffnet wurde, kostete bis zu zwölf Anfragen statt einer. Die **ISBN-Nachschau bleibt bei 24 Stunden**: sie beantwortet „welches Cover liefert der Handel *heute*", und das ist die eine Google-Antwort, die frisch sein muss. Belegt durch einen Test, nicht durch einen Live-Aufruf — jeder Live-Aufruf ginge von denselben 1.000 ab, und der Datencache verhält sich im Dev-Modus ohnehin anders als im Betrieb.

  3. Ersatzquellen, falls das Kontingent nicht trägt: offen, siehe ROADMAP.md.
  4. **Die billigste Maßnahme zuerst, unabhängig vom Ausgang der Punkte 1–3: ISBN-Nachschau erst beim Auswählen eines Covers.** Heute läuft `lookupByIsbns` beim Laden von Seite 0 für die zehn neuesten ISBNs, also 6 bis 10 Anfragen für Ausgaben, die niemand angeklickt hat. Damit sinkt der Verbrauch pro Detailseite **von 7–11 auf 2** (Titelsuche plus die eine Nachschau zum gewählten Cover), und die Kontingentfrage entschärft sich um den Faktor fünf. Siehe Schritt 13a in §9.3.

     **Der Preis dafür, gemessen 2026-09-07 auf Seite 0:**

     | Werk | Cover, die nur aus der ISBN-Nachschau stammen | Anfragen dafür |
     |---|---|---|
     | Beloved | 5 | 10 |
     | The Great Gatsby | 3 | 6 |
     | 1984 | 2 | 10 |

     Diese 2 bis 5 Bilder verschwinden zunächst aus der Wand und tauchen erst beim Anklicken der jeweiligen Ausgabe auf. Verschmerzbar, denn die Auswahl ist ohnehin willkürlich: nachgeschlagen werden nur die zehn neuesten ISBNs von Seite 0, bei Beloved zehn von 37 ISBN-tragenden Ausgaben allein auf dieser Seite und von weit über hundert im ganzen Werk. Eine vollständige Abdeckung war das nie, sondern eine Stichprobe zum Preis von zehn Anfragen pro Seitenaufruf.
  5. ~~**Tageszähler mit sauberem Abschalten.**~~ *Erledigt 2026-09-07 als `lib/googlequota.ts`, allerdings anders gebaut als geplant.*

     **Ein Zähler wäre unehrlich gewesen.** Der Next-Datencache bedient die Titelsuche eine Stunde und die ISBN-Nachschau einen Tag lang; unser Code weiß nicht, welche seiner Aufrufe das Haus überhaupt verlassen haben. Ein Zähler hätte Cache-Treffer mitgezählt und die Seite lange vor dem echten Limit gedrosselt — bei einem Kontingent von 1.000 ein teurer Irrtum in die falsche Richtung.

     **Stattdessen ein Sicherungsautomat auf Googles eigener Antwort.** Google sagt selbst, wann Schluss ist:
     - `403`/`429` mit `dailyLimitExceeded` oder `quotaExceeded` → Google wird bis zur nächsten Zurücksetzung nicht mehr gefragt. Die liegt bei **Mitternacht pazifischer Zeit**, nicht bei unserer.
     - `403`/`429` mit `rateLimitExceeded` → 90 Sekunden Pause, kein ganzer Tag.
     - `403` aus einem anderen Grund (falscher Schlüssel, gesperrter Referrer) → **kein** Automat, sonst legt eine Fehlkonfiguration Google für einen Tag still und niemand fände heraus, warum.

     Dafür führt `HttpError` jetzt den Anfang des Antworttextes mit; aus dem Status allein ist das nicht zu unterscheiden. Bei offenem Automaten liefert die Titelsuche eine leere Liste (F3.3, die Seite läuft auf Open Library weiter) und die ISBN-Nachschau meldet `unavailable`.

     **Dabei gefunden und mitbehoben: eine falsche Aussage an den Leser.** `VerdictNote` behandelte alles, was nicht `verified` oder `differs` war, gleich — auch `pending`. Wer ein Cover auswählte, las also ein bis zwei Sekunden lang „No current publisher image is on record for this ISBN", obwohl noch gar nicht gefragt worden war; bei leerem Kontingent hätte dieser Satz den ganzen Tag dort gestanden und wäre den ganzen Tag falsch gewesen. `IsbnVerdict` hat jetzt den Status `unavailable`, und es gibt eigene Sätze für „wird gerade geprüft" und „die Quelle hat nicht geantwortet". Gegen §9.2 verstieß das an genau der Stelle, an der es weh tut.

- [x] **Rate-Limit auf den API-Routen** (erledigt 2026-09-07, `lib/ratelimit.ts`). Token-Bucket pro IP und Route, ohne Abhängigkeit: `search` 30/20 pro Minute, `works` 120/60, `isbn` 40/20, `availability` 6/3, dazu ein gemeinsamer Eimer `google` 20/5 für alle Anfragen, die ein Kontingent kosten können. Antwort bei Erschöpfung: 429 mit `Retry-After`.

  **Zwei Einschränkungen, die hier stehen müssen, damit niemand sich in Sicherheit wiegt:**
  1. Der Zähler liegt im Speicher *einer* Instanz. Vercel startet mehrere, die tatsächliche Grenze ist also ein Vielfaches. Gegen einen einzelnen Crawler hilft das, gegen einen verteilten nicht. Ein geteilter Zähler braucht Redis, das §8.6 bis zu einem Auslöser zurückstellt.
  2. **Das Limit begrenzt den Tagesverbrauch nicht.** 5 Google-Anfragen pro Minute sind 7.200 pro Tag, also weit über einem Kontingent von 1.000. Es bremst den Stoß, nicht den Tag. Dafür braucht es Punkt 5 unten, den Tageszähler — und der braucht die Zahl aus Punkt 1.

- [x] **Ein Suchergebnis kostete 21 Google-Anfragen statt einer** (gefunden und behoben 2026-09-07 beim Planen des Limits). Das Kartenmosaik aus §9.3 Schritt 14 ruft `getWorkPage(offset 0)` auf, und Seite 0 startete immer die Google-Titelsuche — bei zwanzig Karten also zwanzig zusätzliche Anfragen pro kalter Trefferliste. Damit wäre die Rechnung oben („eine Suche = 1") um den Faktor 20 falsch gewesen: statt hunderten nur 47 Trefferlisten pro Tag bei einem Kontingent von 1.000.

  Google trägt zum Mosaik nichts bei, was Open Library nicht hat (gemessen 2026-09-07, Seite 0, vier Kacheln):

  | Werk | Cover auf Seite 0 | davon Google | gefüllte Kacheln | ohne Google |
  |---|---|---|---|---|
  | Nineteen Eighty-Four | 24 | 2 | 4 | 4 |
  | Frankenstein | 22 | 6 | 4 | 4 |
  | The Lord of the Rings | 62 | 5 | 4 | 4 |
  | The Great Gatsby | 12 | 5 | 4 | 4 |
  | Wuthering Heights | 48 | 1 | 4 | 4 |

  `WorkPageOptions.googleBooks` (Vorgabe `true`) schaltet die Titelsuche ab; der Zweig `summary=1` setzt sie auf `false`. Ein Test hält fest, dass ein Mosaik keine Google-Anfrage auslöst.
- [x] **Händler-URLs geprüft** (2026-09-07, §9.3 Schritt 16): `npx tsx scripts/check-buylinks.ts`. Hugendubel und genialokal antworten mit HTTP 200, rendern ihre Treffer aber im Browser; ihre URL-Muster sind damit weder bestätigt noch widerlegt. Vor dem Start einmal von Hand im Browser nachsehen.

---

## 2026-09-07 · SEO-Grundlage, Detailseite mobil, Klick-Tracking, About (alte §10)

Umsetzungsplan und Messungen in [plans/PLAN-B.md](plans/PLAN-B.md), B2 bis B5.

**About-Seite (alte §10 B4).**
**Die About-Seite ist erledigt (2026-09-07, `/about`).** Fünf Abschnitte: was die Seite tut; woher die Bilder kommen (beide Kataloge, mit den gemessenen Anteilen, und der Satz, dass sie zusammen nur einen Teil des je Gedruckten kennen); was fehlt und warum (Ausgaben ohne Scan, ohne ISBN, doppelte Scans, die Grenze von 1.500 Datensätzen); was die drei Urteile aus Schritt 13 bedeuten, samt der Klarstellung, dass **kein Händler gefragt wird**; und Kauf-Links, Provision und die Klickzählung ohne jede Kennung des Lesers. Dazu `components/SiteFooter.tsx`, dieselbe Fußzeile jetzt auch auf der Detailseite, die vorher gar keine hatte, mit dem Link auf About.

**Klick-Tracking (alte §10 C9).**

~~Klick-Tracking `/go/[provider]/[isbn]`~~ *erledigt 2026-09-07.* Die Route baut das Ziel serverseitig aus `lib/buylinks.ts` neu und übernimmt es nie aus der Anfrage — sie kann damit nur auf Adressen zeigen, die in unserer eigenen Tabelle stehen, und ist kein offener Redirect; ein unbekannter Anbieter oder eine kaputte ISBN führt auf die Startseite. Nur die Kauf-Links laufen darüber, die Suchlinks bleiben direkt.

**Aufgezeichnet wird** Anbieter, Markt, ISBN, Linkart und Zeit; **nicht** IP, Cookie, User-Agent, Referrer oder irgendeine Kennung des Lesers. Es entsteht nichts Personenbezogenes, das ist auch der Satz für die Datenschutzerklärung. Geschrieben wird vorerst eine strukturierte Zeile (`bb.click {…}`) in die Plattform-Logs; `lib/clicks.ts` ist die einzige Stelle in `lib/`, die absichtlich ohne `DEBUG`-Schranke schreibt.

**Statische Work-Seiten, Sitemap (alte §10 D10, D11).**

~~Statische Work-Seiten mit ISR~~ *erledigt 2026-09-07.* `app/book/[id]/page.tsx` ist jetzt eine Server-Komponente (die Interaktion liegt unverändert in `components/BookDetail.tsx`), mit `revalidate = 86400` und `generateStaticParams` über die kuratierten Werke. Dazu:
- **Titelmuster** „The covers of *Nineteen Eighty-Four* by George Orwell“, Beschreibung mit der Ausgabenzahl der Quelle („Open Library lists 537 edition records … See the ones that carry a cover“). Kein „all“, kein „every“ — die Regel aus CLAUDE.md gilt in den Meta-Tags besonders, weil ein falscher Anspruch dort am längsten unbemerkt überlebt.
- **Schema.org `Book`** mit `name`, `author`, `datePublished`, bis zu vier `image` und `sameAs` auf den Open-Library-Datensatz. Bewusst **ohne** `aggregateRating` und `offers`: wir haben weder eigene Bewertungen noch eigene Preise, und beides zu erfinden verstößt gegen Googles Richtlinien wie gegen §9.2.
- **Open-Graph-Bild** `opengraph-image.tsx`, 1200×630, vier Cover nebeneinander plus Titel und Autor. Kostet keine Google-Anfrage (`googleBooks: false`), damit ein Crawler die Sitemap nicht in Kontingent umrechnet.
- Kosten pro kalter Seite: zwei Open-Library-Anfragen, beide gecacht, null Google.
- **Grenze, die hier stehen muss:** der sichtbare Text bleibt clientseitig, die Wand lädt ihre Seiten weiter im Browser. Google rendert JavaScript, und Titel, JSON-LD und OG-Bild stehen im HTML. Bleibt die Indexierung trotzdem schwach, ist der nächste Schritt, Seite 0 serverseitig mitzurendern — ein eigener Schritt, kein Nebenbei.
11. **Sitemap** *(teilweise erledigt 2026-09-07)*: `app/sitemap.ts` und `app/robots.ts` stehen, `/api/` ist für Crawler gesperrt, weil jeder Aufruf dort eine externe Anfrage kostet. Enthalten sind die zwölf kuratierten Werke — die ~500 aus der ursprünglichen Planung brauchen eine Liste, die es noch nicht gibt, und erfundene IDs wären schlechter als eine kurze Sitemap. **Search Console ab Tag 1** bleibt offen und braucht die Domain (Punkt 6).

**Detailseite mobil (alte §10 E13).**

**Detailseite mobil.** Gemessen bei 375×812 auf *The Great Gatsby*: siebzehn Sprach-Pillen brachen in sechs Zeilen um, und die Seitenleiste lag unter der Wand — bei 329 Covern in drei Spalten rund 110 Zeilen Bildlauf bis zu den Kauf-Links. Ein Cover auszuwählen blieb auf dem Telefon damit folgenlos. Neu:
- **Peek-Leiste** am unteren Rand, sobald ein Cover gewählt ist (Miniatur, Verlag und Jahr, „Details"), und darüber eine **Schublade** mit `CoverDetails`. Escape und Hintergrundklick schließen, der Hintergrund scrollt nicht mit. Gemessen: „Buy this ISBN" steht danach bei y = 647 in einem 812 hohen Fenster, also ohne Bildlauf sichtbar.
- Seitenleiste und Schublade sind **exklusiv** (`useIsDesktop`, `matchMedia`), damit das Coverbild nicht auf der Verbindung doppelt geladen wird, die es am wenigsten verträgt.
- **Sprach-Pillen** unterhalb von `sm` in einer seitlich scrollbaren Zeile; `sm:contents` löst den Scroller auf, die breite Ansicht ist unverändert.
- **Abweichung von der ursprünglichen Planung:** die Cover-Wand bleibt vertikal. Horizontal zeigt sie auf 375 px zwei Cover, das dreispaltige Raster neun bis zwölf; auf einer Seite, deren Zweck der Vergleich vieler Cover ist, wäre das ein Rückschritt. Der Grund für die horizontale Idee war die unerreichbare Seitenleiste, und den löst die Schublade direkter.

---

## 2026-09-07 · Die Suche fragt Google nicht mehr (PLAN-B B8)

Gemessen über fünf Suchen und 82 Werke: Google steuerte Cover zu sechs Karten bei, und für jede dieser Karten füllte Open Library allein bereits alle vier Mosaik-Kacheln, seit jede Karte ihr Mosaik aus Seite 0 nachlädt (Schritt 14). Übrig blieb eine gewonnene Sprache pro fünf Suchen (bei *Dune* Schwedisch). Dafür kostete der Aufruf eine von 1.000 Tagesanfragen pro kalter Suche.

`lib/search.ts` macht seitdem genau einen externen Aufruf (Open Library); `searchVolumes` und das seit Schritt 13a tote `lookupByIsbns` wurden gelöscht, `attachCandidates` ebenso. Ein Integrationstest belegt, dass eine Suche keine Anfrage an `googleapis.com` stellt. Ein Besuch aus einer Suche und zwei geöffneten Büchern kostet seitdem 4 statt 5 Google-Anfragen; eine reine Suchsitzung kostet null. Die Titelsuche auf Seite 0 der Detailseite blieb: sie bringt bei *Beloved* jedes sechste Cover und überall die Klappentexte. Details in [plans/PLAN-B.md](plans/PLAN-B.md), B8.

---

## 2026-09-07 · Ein Durchklick als Nutzer (Testbericht)

Vollständiger Befund in [tests/2026-09-07-durchklick.md](tests/2026-09-07-durchklick.md), gefahren gegen den Dev-Server mit bewusst frischen Titeln statt der bekannten Klassiker, damit die Caches kalt sind. Was daraus als Anforderung folgt, steht in SPEC.md (F1.7, F2.1a, F2.2, F2.7, F2.8, F2.13, F3.3, F4, F6, N9, N12, §7); was daraus zu tun ist, in ROADMAP.md unter 1.4 bis 1.7 und 6.1 bis 6.5.

**Sechs Fehler**, in der Reihenfolge ihrer Schwere: ein Timeout bei Open Library erreicht den Leser als „No books found" (vier von rund vierzehn kalten Suchen); der Leerzustand nennt einen Sprachfilter, der nicht gesetzt ist; eine Cover-Auswahl kostet eine Google-Anfrage je ISBN des gefalteten Covers, gemessen zwei bis fünf statt der veranschlagten einen; eine unbekannte Work-ID antwortet mit 200 statt 404; die About-Seite zitiert die zurückgezogene Verdikt-Formulierung „Shops show this cover"; `?offset=1500` liefert die Seite 1400.

**Was hielt**, und damit als geprüft gilt: `/go` baut das Ziel neu und ignoriert ein untergeschobenes `url=` (kein offener Redirect); das Rate-Limit lässt 20 Anfragen durch und antwortet dann mit 429, `Retry-After` und `no-store`; leere Query 400, kaputte ISBN 400, unbekannte Sprache fällt auf `all`, die Query ist bei 200 Zeichen gedeckelt und Markup wird escaped; die Telefon-Schublade öffnet, setzt den Fokus auf „Close", schließt per Escape und gibt den Bildlauf wieder frei; der Marktwechsel setzt Cookie und Händlerliste; der Zurück-Knopf stellt Query, Suchfeld und Karten wieder her; Titel, Beschreibung, Canonical, JSON-LD, OG-Bild, robots.txt und Sitemap stimmen; die Seitenleiste scrollt eigenständig; die Verdikte `verified` und `unknown` nennen ihre Quelle.

**Nicht prüfbar:** Enter im Suchfeld und die Tastaturbedienung insgesamt — das Automatisierungs-Panel schickt Tastendrücke ohne Tastenwert. Steht als ROADMAP 0.8 zur Handprüfung.

---

## 2026-09-07 · Ein Ausfall der Suche heißt nicht mehr „nichts gefunden" (Roadmap 1.4)

Der schwerste Fund des [Durchklicks](tests/2026-09-07-durchklick.md). `searchWorks` fing jeden Fehler ab und gab eine leere Liste zurück, die Route antwortete 200 mit `works: []`, und die Oberfläche sagte dem Leser, es gebe das Buch nicht. Vier von rund vierzehn kalten Suchen taten das, darunter zweimal *Norwegian Wood*, das bei Open Library 124 Werke hat.

**Zwei Ursachen, beide behoben.**

*Erstens die Verwechslung von Schweigen und Leere.* `SourceUnavailableError` (`lib/sources/http.ts`) benennt jetzt „gefragt, keine Antwort bekommen". `searchWorks` wirft ihn bei Timeout, Netzfehler, Fehlerstatus und bei einer 200er-Antwort ohne `docs`-Array; eine leere Liste bedeutet ausschließlich, dass Open Library geantwortet hat und nichts hatte. `app/api/search/route.ts` macht daraus **503 mit `no-store`**, und nur die 200 trägt weiter `s-maxage=3600` — vorher hätte das CDN eine Ausfallantwort eine Stunde lang ausgeliefert und jedem Besucher dasselbe Falsche erzählt. Der Test, der das alte Verhalten festhielt („returns [] on HTTP error and on timeout"), ist durch seinen Gegensatz ersetzt.

*Zweitens der Deckel selbst.* Gemessen über zwölf kalte Suchen direkt bei Open Library, ohne Deckel: sieben antworteten unter 8 s, **drei zwischen 9 und 10 s**, eine nach 24 s, eine gar nicht. Der alte 8-Sekunden-Deckel machte damit aus einem Drittel der langsamen, aber gültigen Antworten einen Fehler. `OL_TIMEOUTS.search` steht deshalb auf **12 s**. Der Preis ist eine längere Wartezeit im schlechten Fall, und sie endet jetzt in einer Auskunft statt in einer falschen.

**Dabei mitgefunden: zu kurze Suchen.** Open Library lehnt eine Suche unter drei Zeichen mit HTTP 422 ab („Query too short"). Das erreichte den Leser bisher ebenfalls als „No books found" — für `it` etwa. `MIN_QUERY_LENGTH = 3` in `lib/search.ts` verhindert die Anfrage, die Route antwortet 400, und die Oberfläche sagt „Not enough to go on".

**In der Oberfläche** (`components/BookGrid.tsx`) unterscheidet `failureFor` jetzt 503, 429, 400 und den Rest und gibt jedem einen eigenen Satz; wo ein zweiter Versuch etwas bringen kann, steht ein Knopf **„Try again"**, der die Anfrage über einen Zähler im Anfrageschlüssel wirklich neu stellt. Der Leerzustand nennt den Sprachfilter nur noch, wenn einer gesetzt ist: ohne Filter „Open Library knows nothing under this title. Try another spelling, or add the author.", mit Filter der Zusatz über die gewählte Sprache.

**Verifiziert** im Browser mit erzwungenem 503 (Fehlerzustand samt Knopf), mit echtem Ausfall (`austerlitz sebald` → 503 nach 10,5 s, vorher „nichts gefunden"), mit wiederholtem Versuch nach dem Ausfall (8 Treffer, Ishiguro zuerst), mit beiden Leerzustands-Varianten und mit `q=it` → 400. Fünf neue Tests in `lib/__tests__/search-route.test.ts` halten die Zusagen der Route fest, darunter dass ein Timeout 503 ergibt und nicht 200 mit leerer Liste; die Suite steht bei 188.

---

## 2026-09-07 · Die falschen Sätze und die zwei kaputten Bilder (Roadmap 1.5 und 1.6)

### Die Verdikte stehen nur noch an einer Stelle

Die About-Seite erklärte die Urteile unter den Kauf-Links als „Shops show this cover" und „Shops show a different cover" — die Formulierung, die am 2026-09-07 zurückgezogen worden war, weil sie behauptet, eine Händlerseite gelesen zu haben. Zwei Absätze tiefer stand auf derselben Seite „No shop is contacted for this". Sie zählte außerdem drei Zustände, während die Oberfläche fünf kennt.

Ursache war nicht der Text, sondern dass es ihn zweimal gab. `lib/verdicts.ts` hält jetzt `VERDICT_LEAD` (der Satz, den der Leser sieht), `VERDICT_MEANING` (was er bedeutet, für die Liste auf der About-Seite) und `VERDICT_ORDER`; Seitenleiste und About-Seite lesen beide daraus, ein Auseinanderlaufen ist damit ausgeschlossen und ein neuer Zustand kann nicht mehr ohne Worte hinzukommen. Fünf Tests halten fest, was diese Sätze nicht sagen dürfen: nichts über Händler („shops show/list/stock/have", „in stock", „available at"), nichts über Vollständigkeit, und `unknown`, `pending` und `unavailable` müssen drei verschiedene Sätze bleiben.

### Das Erscheinungsjahr ist ein Zitat, keine Tatsache

Open Library datiert *The Great Gatsby* auf 1920; erschienen ist er 1925. Die Meta-Zeile sagte „first published 1920". Sie sagt jetzt **„Open Library dates it to 1920"**. Eine zweite Quelle zum Gegenprüfen gibt es hier nicht: die Wand lädt den jüngsten Datensatz zuerst, die älteste Ausgabe auf dem Schirm ist also nicht die älteste Ausgabe. Im JSON-LD bleibt der Wert stehen, wie jedes Feld dort aus Open Library stammt und über `sameAs` an seiner Quelle nachprüfbar ist.

### Zwei Cover nebeneinander sind keine zwei Streifen

Bei zwei Covern teilt die Karte ihren 2:3-Rahmen in zwei Kacheln von 1:3; `object-fit: cover` zeigte dann rund die halbe Breite jedes Bildes. Auf der Karte für *The Manningtree Witches* las man zweimal „ANNINGTRE WITCH" nebeneinander, was wie ein Rendering-Fehler aussah. Dasselbe traf die linke Spalte des Drei-Cover-Mosaiks, was im Testbericht noch nicht auffiel.

`CoverImage` nimmt jetzt ein `fit`, und die hohen Kacheln passen das ganze Cover ein, statt es zu beschneiden; der Kartengrund zeigt sich darüber und darunter. Zwei ganze Cover auf Papier ist die Sprache der übrigen Seite, ein halbes Cover nicht ([nachher](tests/2026-09-07-mosaik-behoben.png), [vorher](tests/2026-09-07-mosaik.png)). Das Vier-Cover-Raster bleibt unangetastet: seine Zellen sind bereits 2:3, dort nimmt ein Zuschnitt nichts weg.

### Eine Kachel je Druck, für Karte und Teilbild

Das Open-Graph-Bild von *Wolf Hall* zeigte vier Cover, davon zweimal dieselbe spanische Ausgabe: `coverImages` verwarf nur gleiche URLs, und ein Druck liegt im Katalog oft als mehrere Datensätze mit mehreren Scans. Die Karte hatte denselben Fehler eine Stufe schwächer, sie unterschied nur nach Ausgabe.

Beide benutzen jetzt dieselbe Auswahl: ein Cover je **Druck**, erkannt an Verlag und Jahr der tragenden Ausgabe, ersatzweise an der Ausgabe selbst. Aussortierte Cover rücken nach, wenn sonst eine Kachel leer bliebe — lieber eine Wiederholung als ein unfertiges Bild. Bewusst **nicht** über die Bilder selbst entschieden: das bräuchte Signaturen, die der Server erst holen und hashen müsste, mehrere Sekunden auf einer Route, auf die der Vorschau-Dienst eines Messengers nicht wartet.

Die Grenze davon ist gemessen und bleibt: *The Manningtree Witches* zeigt weiter zweimal dasselbe Motiv, weil Granta 2021 und Catapult 2021 zwei echte Ausgaben zweier Verlage sind, die dieselbe Gestaltung lizenziert haben. Das erkennt nur ein Bildvergleich, und den leistet die Wand, nicht die Karte.

**Verifiziert im Browser:** About-Seite mit allen fünf Urteilen im Wortlaut der Oberfläche und ohne „Shops show" (im Text geprüft); Meta-Zeile „Open Library dates it to 2009 · 22 covers from 43 editions"; Verdikt in der Seitenleiste unverändert; hohe Kacheln mit `object-fit: contain` und zwei ganzen Covern auf der Manningtree-Karte; [Teilbild von *Wolf Hall*](tests/2026-09-07-teilbild-behoben.png) mit vier verschiedenen Covern (niederländisch, spanisch, englisch, deutsch) statt zweimal demselben. Neun neue Tests, Suite bei 199, Build grün.

---

## 2026-09-07 · Dubletten gemessen: Mason & Dixon und die Pynchon-Mosaike

Julian hatte beide gesehen und gemeldet; hier stehen die Zahlen dazu. Was daraus folgt, steht als ROADMAP 6.7, und die Prüfung anderer Quellen davor als 6.6.

**Auf der Wand.** *Mason & Dixon* (OL2636672W), alle Seiten geladen und wie im Browser gefaltet: **16 Cover roh, 12 nach dem Falten, alle 16 mit Signatur** — es fehlten also keine Hashes, die Regeln selbst greifen nicht. Bei einer Distanzschwelle von 22 zerfallen die zwölf gezeigten Kacheln in **sechs Motive**, und das größte davon umfasst **sieben Kacheln**: Henry Holt 1997 (dreimal), Holt Paperbacks 1998 (zweimal), Vintage 1998 und Rowohlt 1999. Zehn Paare bleiben mit Distanz ≤ 22 nebeneinander stehen. Drei Ursachen:

| Paar | Distanz | Ursache |
|---|---|---|
| Henry Holt 1997 gegen Henry Holt 1997, **gleiche ISBN** 9780805037586 | 22 | Die ISBN-Stufe faltet bis 20; zwei Scans derselben Ausgabe stehen nebeneinander |
| Holt Paperbacks 1998 gegen Henry Holt 1997 | 10 | `samePublisher` vergleicht Wortmengen, und {holt, paperbacks} ist keine Teilmenge von {henry, holt}; dasselbe Haus wird nicht erkannt |
| Vintage 1998 (Sprache unbekannt) gegen Henry Holt 1997 | 11 | Verschiedene Verlage, also gilt nur die Stufe bis 8 |

Rowohlt 1999 gegen Henry Holt 1997 bei Distanz 16 ist **kein** Fehler: über Sprachgrenzen wird nie gefaltet, und das bleibt so.

**In den Mosaiken.** Suche `pynchon`, die vier Kacheln von sechs Karten nachträglich gehasht: *Inherent Vice* Kachel 1 und 2 bei Distanz 13, *V.* Kachel 1 und 4 bei 10 sowie zwei weitere Paare bei 20. Die übrigen vier Karten (*Gravity's Rainbow*, *The Crying of Lot 49*, *Vineland*, *Mason & Dixon*) haben kein Paar unter 21. **Zwei von sechs Karten** zeigen also sichtbar dasselbe Motiv zweimal — die in SPEC F4 benannte Grenze des Kurzpfads, der nicht hasht und nur Verlag und Jahr vergleichen kann.

---

## 2026-09-07 · Recherche: welche Buchdatenbanken sonst infrage kommen

Anlass war Julians Vermutung, andere Datenbanken könnten mehrere Probleme auf einmal lösen. Das Ergebnis der Recherche steht als Kandidatenliste und Messplan in ROADMAP 6.6; hier die Belege.

- **ISBNdb**: rund 110 Millionen Titel, ein kuratiertes Cover je ISBN, Bulk-Abfrage 100 bis 1.000 ISBNs pro Aufruf, Tarife ab 14,99 USD im Monat bis 299,99 ([Preise](https://isbndb.com/isbn-database), [API 2.0](https://isbndb.com/api-20-deployed-new-account-pricing-structures)).
- **Hardcover.app**: GraphQL unter `api.hardcover.app/v1/graphql`, Token aus den Kontoeinstellungen, Werke **und** Ausgaben mit Verlag, ISBN-13, Format und Cover; nur lesend, keine Textsuche-Operatoren ([Doku](https://docs.hardcover.app/api/getting-started/), am 2026-09-07 selbst nicht abrufbar, HTTP 403 — Lizenz und Rate-Limit sind damit ungeklärt).
- **LibraryThing Covers**: `covers.librarything.com/devkey/KEY/large/isbn/…`, **1.000 Cover am Tag**, höchstens eines je Sekunde bei automatischem Abruf, fehlendes Bild kommt als transparentes 1×1-GIF ([Free covers](https://wiki.librarything.com/index.php/Free_covers)).
- **K10plus / DNB**: SRU unter `sru.k10plus.de/opac-de-627`, rund 80 Millionen Titel aus über 1.000 Bibliotheken, DNB-Titeldaten unter CC0 ([K10plus SRU](https://wiki.k10plus.de/display/K10PLUS/SRU)). Keine Schutzumschläge, aber die sauberste kostenlose Quelle für Verlag, Imprint und Jahr — also für genau die Felder, an denen die Faltung scheitert.
- **Open-Library-Dumps**: monatlich, Editions-Datei 45 GB entpackt, rund 250 GB für den vollständigen Import, **für Cover gibt es keinen laufenden Dump** ([Data Dumps](https://openlibrary.org/developers/dumps)). Würde Paging, Latenz und Ratenbegrenzung erledigen, verlangt aber eine Datenbank und damit die Infrastruktur, die E6 bisher bewusst vermeidet.

---

## 2026-09-07 · Beim Planen von 1.1 gefunden: die Signaturen kennen keine Farbe

Der Plan für ROADMAP 1.1 steht in [plans/PLAN-1.1-keine-vorauswahl.md](plans/PLAN-1.1-keine-vorauswahl.md). Zwei Befunde daraus gehören hierher, weil sie unabhängig vom Punkt selbst gelten.

**`decodeToGray` verwirft die Farbe in der ersten Schleife.** `lib/imagehash.ts` rechnet jedes Bild sofort in Graustufen um; `signature()` liefert danach `hash`, `contrast` und `mean`, alle drei ohne Farbe. Ein Maß für „farbenfroh" — Julians Vorschlag vom selben Tag — ist daraus **nicht** ableitbar. Nachrüstbar ist es billig: ein zweiter Akkumulator für die Sättigung in derselben Schleife, und da die Signaturen bei jeder Anfrage aus den 30 Tage lang gecachten Bytes neu gerechnet werden (`lib/coverhash.ts` cacht die Bytes, nicht die Signatur), kostet es keine zusätzliche Ladung. Der Vorschlag ist deshalb nicht verworfen, sondern nach ROADMAP 1.9 gewandert, wo ein auffälliges Cover die Startseite illustrieren soll, statt für den Leser eine Ausgabe auszuwählen.

**Klappentexte sind dünn und oft in der falschen Sprache.** *Wolf Hall*, Seite 0: von 26 Ausgaben tragen **3** eine Beschreibung, und die längste davon (927 Zeichen) gehört zu Editorial Presença — sie ist portugiesisch. Ein Panel, das schlicht die längste Beschreibung zeigt, setzt also einen portugiesischen Text unter ein englisches Buch. Der Plan sieht deshalb `blurbFor(editions, language)` vor: erst die gewünschte Sprache, dann der Rest, und die Sprache wird genannt, wenn ausgewichen wurde.

**Was eine Werk-Ansicht zeigen könnte, gemessen.** Für dieselbe Planung über alle geladenen Seiten von vier Werken erhoben:

| Werk | Ausgaben | mit Klappentext | Verlage | Jahre |
|---|---|---|---|---|
| Wolf Hall | 26 | 3 (2 en, 1 ohne Sprache) | 18 | 2009–2020 |
| Beloved | 51 | 5 (4 en, 1 de) | 37 | 1987–2025 |
| Mason & Dixon | 11 | 2 (1 en, 1 de) | 10 | 1997–2015 |
| Mumbo Jumbo | 10 | 2 | 8 | 1972–2017 |

Jedes Werk hat mindestens einen Klappentext, aber nur 10 bis 18 Prozent der Ausgaben tragen einen. Jahresspanne und Verlagszahl sind dagegen immer vorhanden und stehen bisher nirgends auf der Seite. Seitenzahl (14 von 26 bei *Wolf Hall*, 40 von 51 bei *Beloved*) und Format sind zu dünn für eine Aussage über das Werk. Nebenbei bestätigt: der erste Abruf von *Mumbo Jumbo* kam leer zurück und beim zweiten mit 10 Ausgaben — dieselbe Unzuverlässigkeit von Open Library, die 1.4 auf der Suchseite behandelt.

---

## 2026-09-07 · Die kuratierte Wand wird eigensinniger (Julians Auswahl)

Julian wollte Neuromancer, Pynchon, Arno Schmidt, *Berlin Alexanderplatz* und Clausewitz' *Vom Kriege* auf der Startseite und „ein paar der anderen langweiligen" heraus. Pynchon stand mit *Gravity's Rainbow* schon drin.

**Geprüft, bevor geändert wurde**, denn die Wand verspricht Cover zum Vergleichen:

| Werk | Ausgaben | Cover auf Seite 0 |
|---|---|---|
| Neuromancer (OL27258W) | 65 | 50 |
| Berlin Alexanderplatz (OL1434640W) | 68 | 43 |
| Vom Kriege (OL62744W) | 194 | 30 |
| Aus julianischen Tagen (OL2298782W) | **1** | **2** |

**Arno Schmidts *Aus julianischen Tagen* konnte nicht auf die Wand.** Der Datensatz hat eine einzige Ausgabe, und beide verfügbaren Bilder sind gescannte Innenseiten: Open Library zeigt die Impressumsseite mit einem Bibliotheksstempel, Google Books den Schmutztitel. Kein Umschlag, den man vergleichen könnte. Eine Durchsicht aller Arno-Schmidt-Werke mit Cover ergab, dass keines mehr als drei Ausgaben hat; das beste echte Titelbild trägt **KAFF auch Mare Crisium** (OL3801690W, Fischer, Mondlandschaft), und das steht jetzt für Arno Schmidt auf der Wand — mit zwei Covern dahinter.

**Damit wurde die Zeile über der Wand falsch.** Sie versprach „Books with dozens of covers to compare"; sie sagt jetzt „Some have hundreds of covers, some only a few". Das ist dieselbe Regel wie überall (N12): lieber die ungleiche Wahrheit als ein Versprechen, das eine Kachel nicht hält.

**Heraus** flogen die vier vorhersehbarsten Einträge einer Klassikerliste: *Pride and Prejudice*, *The Hobbit*, *Dracula*, *Frankenstein*. **Herein** kamen Neuromancer, Berlin Alexanderplatz, Vom Kriege und KAFF. Geblieben sind 1984, Gatsby, Dune, Ulysses, Lolita, Moby Dick, Beloved und Gravity's Rainbow. Die Reihenfolge ist fürs Auge gesetzt, nicht nach Rang: hell neben dunkel, keine zwei roten Cover nebeneinander.

Nebenbei festgehalten, weil es sich schon einmal verwechselt hat: `lib/curated.ts` ist **nicht** die Liste aus ROADMAP 5.1. Diese zwölf sind nach Aussehen gewählt, jene 500 nach Ausgabenzahl für die Sitemap.

---

## 2026-09-07 · Recherche Goodreads, und was ein „ähnliche Cover" kosten würde

Zwei Ideen von Julian, beide geprüft statt geschätzt. Die Punkte daraus sind ROADMAP 6.10 und 6.11.

**Goodreads ist rechtlich zu.** Seit dem 8. Dezember 2020 gibt Goodreads keine neuen Entwicklerschlüssel mehr aus und hat die öffentliche API zurückgezogen ([Ankündigung im Entwicklerforum](https://www.goodreads.com/topic/show/21788520-api-deprecation), [Bericht](https://developers.slashdot.org/story/20/12/17/1522242/goodreads-is-retiring-its-current-api-and-book-loving-developers-arent-happy)). Die [Nutzungsbedingungen](https://www.goodreads.com/about/terms) untersagen ausdrücklich, Inhalte des Dienstes zu kopieren, zu vervielfältigen, öffentlich anzuzeigen, zu verbreiten oder Abgeleitetes daraus herzustellen; Rezensionen gehören ihren Verfassern, sind aber an Goodreads lizenziert, und der Weitergabe-Kanal für Dritte ist ein bezahltes Abonnement des Rezensions-Feeds. Übernahme von Editionsdaten, Rezensionen oder Bewertungen scheidet damit aus, auch über Scraper von Dritten. Dazu kommt: Goodreads gehört Amazon, und ein Verstoß gefährdet das Associates-Konto, das ROADMAP 4.2 braucht. **Erlaubt und nützlich bleibt das Verlinken.**

**Die Bewertungen, die wir schon haben.** Open Library liefert bei jeder Suche `ratings_count`, `readinglog_count` und `want_to_read_count` mit; sie stehen seit Schritt 10 an `WorkSummary` und tragen das Ranking, werden aber nirgends angezeigt. Für *Nineteen Eighty-Four* sind das 8.491 Leser. Frei nutzbar, schon bezahlt, keine zusätzliche Anfrage.

**„Ähnliche Cover" ist kleiner als gedacht und größer als es aussieht.** Klein: eine Signatur sind 8 Byte, ein Index über 500 kuratierte Werke à 50 Cover wären rund 25.000 Einträge und damit wenige hundert Kilobyte; ein linearer Vergleich über 25.000 XOR-Operationen dauert Mikrosekunden, ein ausgefeilter Index erübrigt sich. Größer: der dHash ist ein **Strukturhash auf Graustufen** — `decodeToGray` verwirft die Farbe in der ersten Schleife. Zwei Cover mit gleichem Aufbau, eines rot und eines blau, sind für ihn identisch. „Sieht aus wie" ohne Farbe wäre also ein falsches Versprechen (N12). Nötig wäre eine Erweiterung der Signatur um mittlere Sättigung und ein grobes RGB-Histogramm im selben Durchlauf — dasselbe Maß, das ROADMAP 1.9 für ein farbenfrohes Cover braucht.

---

## 2026-09-07 · Was die freien Quellen zu einem vergriffenen Taschenbuch wissen (Vorprobe zu 6.6)

Julian hat *Aus julianischen Tagen* von Arno Schmidt zum Testfall der Datenbank-Prüfung gemacht: „es hat ein wunderschönes cover und wir sollten eine seite bauen, die das auch findet." Fischer Taschenbuch 1979, ISBN 9783596219261, seit rund 45 Jahren vergriffen.

Abgefragt, was ohne Schlüssel und ohne Kosten zu erreichen war:

| Quelle | Datensatz | Bild |
|---|---|---|
| Open Library, über Werk **und** über ISBN | ja, eine einzige Ausgabe | derselbe Scan der **Impressumsseite**, mit Bibliotheksstempel (5.273 Bytes, 128 × 226) |
| Google Books | ja | Scan des **Schmutztitels** |
| DNB über SRU, ohne Schlüssel | ja, vollständig | **keines**, kein 856-Feld |

Die DNB liefert dafür die sauberste Beschreibung, die es umsonst gibt: Reihe „Fischer-Taschenbücher“ mit der Nummer **1926**, beide ISBNs, 256 Seiten, Ladenpreis DM 7,80. **Die Reihennummer ist ein Feld, das Open Library nicht führt** — genau das, was die Reihen-Seiten aus ROADMAP 5.4b bräuchten, die sich heute mit der unsauberen Verlagsfacette behelfen müssen.

Der Testfall ist damit als Trennschärfe angelegt: Handelsdatenbanken führen, was verkauft wird oder wurde, und ein 1979er Taschenbuch steht dort vermutlich nicht. Wer den Umschlag hat, sind eher Leser und Sammler. **Die naheliegende teure Antwort ISBNdb ist für diesen Fall vermutlich die falsche**, und das vor dem Abschluss eines Abos zu wissen, ist die halbe Miete der Prüfung.

Nebenbei bestätigt: die Google-Books-Anfrage **ohne** Schlüssel scheitert an einem erschöpften anonymen Tageskontingent (`429 Quota exceeded … consumer project_number:624717413613`). Das ist die Aussage aus dem README, jetzt belegt — und der Grund, warum `GOOGLE_BOOKS_API_KEY` in Produktion Pflicht ist und nicht Kür.

---

## 2026-09-07 · Ein Durchgang durch die kurzen Texte

Anlass war Julians Urteil über eine Zeile, die ich am selben Tag geschrieben hatte: „Some have hundreds of covers, some only a few" sei schlechtes Copywriting. Es stimmt, und der Fehler ist lehrreich. Die Zeile war als Ehrlichkeit gemeint, nachdem ein Werk mit zwei Covern auf die Wand kam — aber sie war ein **Vorbehalt in einem Slot, der einladen soll**. Sie beantwortete eine Frage, die niemand gestellt hatte, und gab dem Leser nichts zu tun.

Die Lehre daraus, für den nächsten Fall: **N12 verlangt, kein falsches Versprechen zu geben, nicht, ein Zugeständnis zu machen.** Der Ausweg aus einem Versprechen, das man nicht halten kann, ist eine andere Aussage — nicht dieselbe Aussage mit einem „aber". Die neue Zeile sagt, was die Auswahl *ist*, und erklärt nebenbei, warum Clausewitz neben Dune steht.

Fünf Stellen geändert:

| Wo | Vorher | Nachher | Warum |
|---|---|---|---|
| Kuratierte Wand | „Some have hundreds of covers, some only a few" | „Twelve books, picked by eye" | Vorbehalt raus, Aussage rein; erklärt die eigensinnige Mischung |
| Hero-Unterzeile | „Compare the editions of a book side by side, by language and year, …" | „Type a title and see the covers it has been printed with, by language and year. Then find the edition …" | „side by side" stand zweimal auf demselben Bildschirm (auch in der Kopfzeile); beginnt jetzt mit dem, was der Leser tun kann, statt mit einem abstrakten „Compare" |
| Suchfeld | „Search a book title" | „A title, or a title and author" | War grammatisch schief und lehrte nichts. Autorenzugaben verbessern das Ranking nachweislich (gemessen: `ursula k le guin` liefert 20 Le-Guin-Werke), also gehört das in den Platzhalter |
| Werk ohne Cover | „No cover images were found for this book." | „Neither catalogue has a cover for this book." | Passiv und ohne Grund; nennt jetzt wie überall sonst, wer nichts weiß |
| Peek-Leiste ohne Bildunterschrift | „Details, buy and search links" | „Publisher, ISBN and where to find it" | Eine Aufzählung von Substantiven wird zu dem, was tatsächlich dort steht |

Unangetastet blieben die Texte, die kurz zuvor mit Bedacht entstanden sind: die fünf Verdikt-Sätze aus `lib/verdicts.ts`, die Fehler- und Leerzustände der Suche, die Fußzeile und die Fußnote unter der Cover-Wand.

**Kein Copywriting-Skill vorhanden** (die verfügbaren decken Design, Code-Review, Workflows und Konfiguration ab), der Durchgang war Handarbeit.

---

## 2026-09-07 · Speichermodell durchdacht: es sind zwei Bedürfnisse, nicht eines

Vollständig in [plans/PLAN-speicher.md](plans/PLAN-speicher.md). Der Kern und die Befunde aus dem Code:

**E6 beantwortet eine Frage, die eigentlich zwei sind.** Ein **Index** (Cover-Signaturen, Werke, Autoren, Verlage) wird einmal von einem Skript geschrieben, bei jeder Anfrage gelesen und kommt mit dem Deploy — er ist eine Datei, keine Infrastruktur. **Zähler** (Klicks, Ereignisse, Kontingent) werden ständig geschrieben, selten gelesen und müssen einen Deploy überleben — das ist eine Datenbank. Nur das Zweite fällt unter E6, und nur das Zweite bleibt zurückgestellt. Sechs offene Punkte hängen ausschließlich am Ersten: 6.10, 6.9, 5.1, 5.4, 1.9 und das kalte Hashing.

**Größenrechnung.** Ein Cover-Eintrag wiegt als JSON rund 70 Byte; die zwölf kuratierten Werke mit etwa 600 Covern ergeben **42 KB**, 500 Werke mit 25.000 Covern **1,8 MB**. Entscheidend ist die Form im Speicher: dieselben Hashes als `BigUint64Array` sind **200 KB**, und eine Ähnlichkeitssuche wird damit zu einer Schleife über 25.000 XOR-Operationen — Mikrosekunden, ohne Index und ohne Datenbank. Als JS-Objekte belassen wären es fünf bis acht Megabyte Heap für dasselbe Ergebnis.

**Zwei Befunde im vorhandenen Code.** `lib/coverhash.ts` hält eine Modul-`Map` als Memo für Signaturen: sie lebt **pro Serverinstanz** und stirbt mit ihr, weshalb eine kalte Instanz neu dekodiert (billig, weil die Bytes 30 Tage gecacht sind, aber nicht umsonst) — das ist die Ursache der Beobachtung aus SPEC §7, dass die Cover-Zahl beim zweiten Besuch sinkt. Und die `Map` hat **keine Obergrenze**; bei den heutigen Zahlen harmlos, bei einer lange laufenden Instanz ein Leck.

**Der billigste Gewinn braucht gar keine Datei:** Signaturen in den Next-Datencache statt in die Modul-`Map`. Next 16 hat dafür die `use cache`-Direktive mit `cacheLife`, die ältere `unstable_cache` gibt es weiterhin; welche bei der aktuellen Konfiguration greift, ist vor dem Bauen zu prüfen, da `cacheComponents` in `next.config.ts` nicht gesetzt ist. Damit sähe der erste Besucher, was heute erst der zweite sieht.
