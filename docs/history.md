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

**E18 aufgenommen (2026-09-07).** Julian hat die Präzisierung abgenickt: gebaute, nur lesbare Daten im Repo sind kein Speicher im Sinne von E6, ein Speicher, in den die laufende Seite schreibt, bleibt zurückgestellt. Dazu die Abgrenzung, die sonst ein Widerspruch geworden wäre: ein solcher Index hält **abgeleitete Werte** — Signaturen, Farbmaße — und Kennungen, keine Katalogdatensätze; die „eigene Buchdatenbank“, die §1 ausschließt, bleibt ausgeschlossen. §1 sagt das jetzt selbst, damit der nächste Leser den Index nicht für einen Regelbruch hält.

Auf Julians Anstoß steht die dahinterliegende Frage als ROADMAP 0.10 daneben: ob der Zuschnitt des Projekts insgesamt zu überdenken ist. E6 und der Ausschluss der eigenen Datenbank stammen vom 2026-09-06, als das Produkt eine Suchmaske über zwei fremde Kataloge war; seitdem sind ein Cover-Index, Autoren- und Verlagsregister, 500 kuratierte Werke, redaktionelle Seiten, Zähler und ein Bild-Cache dazugekommen. Der Punkt trägt die Argumente beider Seiten und die Bedingung, unter der er zu entscheiden ist — nach 6.6 und nach Phase 3, an drei Zahlen: Ausfallquote der Quellen über eine Woche, tatsächlicher Kontingentverbrauch, und wie viele Leser gehen, bevor die Wand steht.

---

## 2026-09-08 · Einnahmen: die Entscheidung, und ein Durchgang durch Pläne, Spec und Code

**Einnahmen jenseits der Affiliate-Links.** Die Analyse vom Vortag ([plans/PLAN-4-einnahmen.md](plans/PLAN-4-einnahmen.md)) hatte einen von Hand belegten Platz empfohlen — erst unbezahlt für Open Library, später an Direktsponsoren verkauft. Julian: „ein einziger stiller Platz ist zu viel Arbeit, wenn ich selbst auswählen muss. Wenn es einen Marktplatz dafür gibt, wo das automatisch passiert, ist das ok.“ Damit ist Direktvermarktung gestrichen und die guten Zwecke auf einen möglichen Fußzeilen-Satz geschrumpft; was bleibt, ist ein Platz, den ein Netzwerk ohne Kennung des Lesers füllt (Carbon Ads, EthicalAds, BuySellAds — Passung mittel, 0,50–1,10 USD CPM laut Netzwerk, also erst bei fünfstelligen Aufrufen mehr als Taschengeld). Als **E19** in der Spec; ROADMAP 4.6 erledigt, 4.7 und 4.8 neu gefasst. Die Rechnung dahinter bleibt: Affiliate bringt pro Aufruf mindestens so viel wie jede Werbung, die mit N11 vereinbar ist, und die Seite trägt sich ab etwa 30–50 EUR im Monat, also grob 5.000–15.000 Detailseiten-Aufrufen. Annahmen, keine Messungen; Phase 3 ersetzt sie.

**Der Durchgang.** Julian: „gehe nochmal das Projekt durch, vergleiche Pläne mit Umgesetztem und dem Spec, räume auf.“ Geprüft: acht Pläne gegen Roadmap, Spec, Historie und Code; Tests (204, grün) und Typprüfung auf dem Arbeitsstand.

| Fund | Was daraus wurde |
|---|---|
| PLAN-A, PLAN-B, PLAN-11 stimmen mit Historie und Code überein; ihr Kopf sagt, dass sie Geschichte sind | nichts, außer einem Index in [plans/README.md](plans/README.md), der Stand und Roadmap-Punkt jedes Plans nennt |
| PLAN-5 zählte die Seitengattungen anders als die Roadmap (dort a Jahrzehnte, b Reihen; im Plan umgekehrt), und 6.6 sowie 6.9 zitieren „5.4b“ nach der Roadmap | PLAN-5 auf die Buchstaben der Roadmap umgestellt, Reihenfolge nach Hebel beibehalten |
| 6.9 und 6.10 sprachen noch von einer offenen Entscheidung 0.9 und einem „Speicher aus Phase 3“; beides ist mit E18 entschieden | Sätze angepasst; PLAN-speicher trägt einen Kopf mit dem Stand |
| PLAN-speicher §2/§5 hatten die Ursache der sinkenden Cover-Zahl beim zweiten Besuch gefunden (Signatur-Memo je Instanz, ohne Obergrenze) samt billigem Ausweg — aber kein Roadmap-Punkt trug das | **6.12** neu; SPEC §7 verweist statt „hingenommen“ darauf |
| README: „1,000 requests per day by default, more on request“ — der Erhöhungsweg ist seit B7 tot | Satz ersetzt, Verweis auf 0.3 |
| `public/` enthielt fünf Next-Boilerplate-SVGs, nirgends benutzt | gelöscht |
| Zwei `scratch-*.ts` im Root, dazu `data/`, `scripts/build-cover-index.ts`, `scripts/pick-index-works.ts`, `lib/coverindex.ts`, `app/api/similar/` und Änderungen an `imagehash`/`imagesig` — nicht committet, aus einer parallel laufenden Sitzung zu 6.10 | nicht angefasst; in der Roadmap als „in Arbeit“ vermerkt |

**Ordnerstruktur.** Julians Frage, ob das Projekt neu geordnet werden muss, damit ein automatisierter TikTok-Clip im selben Projekt entstehen kann, ohne mit der Website vermischt zu werden: Vorschlag in [plans/PLAN-struktur.md](plans/PLAN-struktur.md), Entscheidung ROADMAP 0.11. Kern: `lib/` importiert nichts aus `next` (geprüft), also kann ein `lab/<name>/` es per `npx tsx` benutzen; eine Lint-Regel verbietet die Gegenrichtung. Ein Monorepo mit Workspaces kostete einen Tag und 273 Pfadangaben für eine Trennung, die die Lint-Regel auch leistet. Der Clip zerfällt in ein reines, getestetes Storyboard und einen ffmpeg-Render; ffmpeg ist auf dem Rechner nicht installiert.

**Umgesetzt am selben Tag** (Julian: „setze den Plan um, aber beginne noch nicht mit dem Video“): Option A. `lab/README.md` trägt die sieben Regeln und eine Tabelle der Experimente; `eslint.config.mjs` verbietet `app/`, `components/`, `lib/` und `scripts/` jeden Import aus `lab/` (geprüft: eine Probedatei in `lib/` mit einem Import aus `lab/` löst genau einen `no-restricted-imports`-Fehler aus, die Website selbst lintet sauber); `/scratch-*` steht in `.gitignore`, was die beiden Arbeitsdateien im Root aus dem Status nimmt; die Regeln stehen in CLAUDE.md. `lab/video/` ist nicht angelegt — der Clip wartet auf Julians Startzeichen, seine Zeile steht bei 5.5. Dazu am selben Tag ein zweites Experiment auf Julians Wunsch: **`lab/mosaic/`**, ein Photomosaik aus den Covern eines Buchs, das aus der Ferne ein Motiv zeigt; angelegt ist die README mit Ansatz (Zuordnung rein, Render mit pngjs, keine neue Abhängigkeit), Messlatte (Erkennbarkeit bei höchstens 25 % Überblendung, Streuung der Kacheln, unter 30 s je Render, null Google-Anfragen) und der Rechtefrage vor dem Posten.


---

## 2026-09-08 · Der gebaute Cover-Index, und was er über „sieht aus wie" gelehrt hat (Roadmap 6.10)

Umgesetzt nach [PLAN-speicher](plans/PLAN-speicher.md), Variante A, auf Julians Vorgabe „starte mit einem Index von 50 Büchern".

### Was entstanden ist

| | |
|---|---|
| `data/index-works.json` | 50 Werke, aus einer Setzliste über die eigene Suche aufgelöst; die zwölf der Startseite immer dabei, höchstens zwei je Autor, mindestens 25 Ausgaben |
| `data/cover-index.json` | **50 Werke, 5.621 Cover, 410 KB** |
| `scripts/build-cover-index.ts` | baut ihn, ohne Google (E10), fortsetzbar, ein Werk nach dem anderen |
| `lib/coverindex.ts` | liest ihn einmal in typisierte Arrays; Suche = linearer Durchlauf |
| `/api/similar/[coverId]` | bis zu sechs Nachbarn, kein externer Aufruf, eigener Rate-Limit-Eimer |
| Seitenleiste | Abschnitt „Looks like this" am Fuß, je Buch ein Cover |

Die Signatur trägt dafür neu **Sättigung und ein 16-Eimer-Farbhistogramm**, berechnet im selben Durchlauf wie der dHash und nur, wo sie gebraucht wird — die Seitenantworten wachsen nicht.

### Der Farbton ist ein Kreis, das Histogramm war es nicht

Erster Fehler, beim Testen mit reinen Farben gefunden: Rot bei 0° und Karmin bei 355° sind Nachbarn für das Auge, landeten aber an entgegengesetzten Enden des Arrays und maßen 0,77 Abstand — weiter auseinander als Rot und Türkis. Behoben durch beides: jeder Farbton verteilt sich beim Bauen auf seine Nachbareimer, und beim Vergleichen werden drei Ausrichtungen probiert (unverschoben und je einen Eimer nach links und rechts). Danach 0,019 statt 0,77.

### Die Schwelle musste erlaufen werden

Der Entwurf mischte Struktur und Farbe zu einer Zahl und ließ alles unter 0,45 durch. **Gemessen an 58.000 zufälligen Coverpaaren aus verschiedenen Büchern:**

| Perzentil | Farbabstand | Strukturabstand |
|---|---|---|
| 0,1 % | 0,03 | 0,20 |
| 1 % | 0,09 | 0,28 |
| 5 % | 0,17 | 0,36 |
| 50 % | 0,51 | 0,48 |

Damit ließ die Schwelle **100 % aller Cover** einen Nachbarn finden. Beim Ansehen von sechs Stichproben war in vier nur Rauschen — ein schwarzweißes *1984* neben einem cremefarbenen *L'étranger*. Auch die Ein-Prozent-Marke reichte nicht: die Hälfte aller Cover behielt einen Nachbarn, und die Paare überzeugten weiterhin nicht.

Jetzt sind es **zwei Tore statt einer Mischung**: Farbe ≤ 0,055 **und** Struktur ≤ 0,28. Damit haben **11 % der Cover überhaupt einen Nachbarn**, und diese Paare halten stand: das cremefarbene Gallimard-*1984* findet den cremefarbenen Gallimard-*Camus*, der braune Leineneinband findet *Brave New World* und *Ulysses* im selben Ton, das dunkelblaue Voyager-*Neuromancer* findet drei dunkelblaue Bände. **Die meisten Cover zeigen gar keine Reihe** — für eine Fundsache ist das richtig.

Die Lehre, die über diesen Fall hinausgeht: eine Schwelle für ein Wahrnehmungsmaß lässt sich nicht ausrechnen. Sie muss an Bildern geprüft werden, und die erste Zahl, die plausibel klingt, ist um ein Vielfaches zu weit.

### Zwei Nebenbefunde aus dem Lauf

**Open Library ließ im ersten Durchgang neun von fünfzig Werken an je einem Timeout scheitern** — dieselbe Flakigkeit, die 1.4 bei der Suche behoben hat. Mit drei Versuchen je Seite und dem Behalten dessen, was vor einem Abbruch da war, fiel im zweiten Durchgang **kein einziges** Werk aus. Gesamtdauer 16 plus 6 Minuten.

**Die Größenrechnung aus dem Plan stimmt je Cover, nicht je Werk.** 73 Byte je Cover wie veranschlagt, aber 112 Cover je Werk statt der angenommenen 50. 500 Werke ergäben damit rund **4 MB** statt 1,8 — nah an der Grenze aus PLAN-speicher §3.6, ab der SQLite der nächste Schritt wäre. Wer die Liste auf 500 erweitert, prüft das vorher.

### Was daran hängt

6.9 („mehr von diesem Autor") und 5.1 (die Sitemap-Liste) lesen denselben Index nur anders; `data/index-works.json` ist der erste Zuschnitt der 5.1-Liste.

---

## 2026-09-08 · Das Riesenmosaik: ein Buch, das sein eigenes Bild ergibt

Julians zweites Experiment (`lab/mosaic/`, ROADMAP 5.5): ob sich aus den Covern **eines** Buchs ein schemenhaftes Motiv zusammensetzen lässt, das als Bild für Instagram oder Pinterest taugt. Gebaut wie im Plan: `mosaic.ts` rein und mit 15 Tests auf synthetischen Bildern, `render.ts` für Laden, Falten und Zeichnen. Ausführlich in [lab/mosaic/README.md](../lab/mosaic/README.md).

**Es funktioniert, und zwar ohne den üblichen Trick.** Gemessen an *Nineteen Eighty-Four* (OL1168083W): 278 Cover im Katalog, **224 Motive nach dem Falten, 222 Kacheln** nach dem Aussortieren gescannter Innenseiten.

| Messlatte | Gefordert | Erreicht |
|---|---|---|
| Erkennbarkeit | Motiv bei höchstens 25 % Überblendung | ein Gesicht bei **0 %**, auch auf 150 px Breite noch lesbar |
| Streuung | meistbenutztes Cover unter 5 % der Zellen | **0,8 %**; 175 von 222 Covern benutzt; **keine** Zelle musste einen Nachbarn wiederholen |
| Kosten | unter 30 s für 1.000 Zellen | **12 s** für 2.064 Zellen bei warmem Bildcache, 40 s kalt; 6 Open-Library-Anfragen, **null Google** |

**Zwei Dinge standen im Plan falsch und sind im Code behoben.** Das Zielbild nach Ausgabenzahl zu wählen ergab bei *1984* eine fast einfarbige Jacke (Helligkeit 57,5 bis 90,2 von 255) — der erste Render war eine hübsche Coverwand ohne jedes Motiv; `--target auto` nimmt jetzt die kontrastreichste Jacke. Und ein quadratisches Raster aus 2:3-Kacheln über ein 3:4-Porträt zog den Kopf um die Hälfte in die Länge; die Zeilenzahl folgt jetzt der Form des Ziels.

**Der Befund, der die Auswahl künftig steuert: ein Foto ergibt ein Gesicht, ein Buchumschlag ein Plakat.** Mit dem gemeinfreien Orwell-Pressefoto kommen Augen, Schnurrbart und Kragen durch. Mit der kontrastreichsten Jacke des Buchs entstehen Blöcke aus Orange und Schwarz — schön, vielleicht sogar das bessere Pinterest-Bild, aber ohne Gegenstand, weil ein Umschlag schon Grafik ist und kein Bild von etwas.

**Nebenbei belegt, wozu das relative Vergleichen gut ist:** gegen das Foto lagen nur 2,6 % der Zellen außerhalb dessen, was die Cover an Helligkeit hergeben; gegen die Jacke mit echtem Schwarz und Weiß waren es 54,8 % — und nach dem Strecken der Palette null. Gestreckt wird dabei nur die *Auswahl*, nie ein Pixel: die Cover erscheinen, wie sie sind.

**Was 6.10 dazu beiträgt: nichts, und das ist in Ordnung.** Das Mosaik misst mittleres RGB je Unterzelle, ein anderes und für diesen Zweck besseres Maß als das Farbhistogramm des Index. Ein grauer Zielbild braucht `--colour-weight 0.15` statt der voreingestellten 0,6, sonst werden gesättigte Cover teuer und das Motiv wird matschig.

**Nachtrag am selben Tag: ein Autorengesicht aus mehreren Werken.** Julians Vorschlag, gegen die Wiederholung von Covern. `--author` fragt Open Library nach dem Namen, behält nur die Werke, deren **Erstautor** diese Person ist, wirft Sekundärliteratur über dieselbe Regel wie das Ranking heraus und nimmt die acht ausgabenstärksten — für Orwell *Animal Farm*, *1984*, *Homage to Catalonia*, *The Road to Wigan Pier*, *Burmese Days*, *Down and Out in Paris and London*, *Keep the Aspidistra Flying*, *Coming Up for Air*. Gegen dasselbe Porträt im selben Raster aus 2.064 Zellen:

| | ein Buch | acht Bücher |
|---|---|---|
| Kacheln | 222 | **509** |
| Zellen je benutztem Cover | 11,8 | **5,9** |
| Mittlerer Abstand zum Bild | 866 | **653** |
| Schlechteste Zelle | 2.963 | **2.208** |
| Meistbenutztes Cover | 0,8 % der Zellen | **0,4 %** |
| Unerreichbare Zellen | 2,6 % | **0 %** |

Ein Viertel näher am Bild und halb so viel Wiederholung, für eine zusätzliche Suchanfrage und sieben weitere Werke an Ausgabenseiten; 57 s, weiterhin keine Google-Anfrage.

**Dabei ist Open Library mitten im Lauf ausgestiegen** (*The Road to Wigan Pier*), was das Skript zuerst ganz abbrach. Jetzt wird jede Seite einmal wiederholt, ein Werk, das trotzdem nicht antwortet, wird übersprungen oder unvollständig verwendet — und in beiden Fällen **gesagt**. Eine unvollständige Ladung wandert nicht in den Plattencache, sonst würde die Lücke beim nächsten Lauf zur Tatsache. Dieselbe Regel wie überall: ein Ausfall ist kein Befund.

Offen: eine Silhouette statt eines Fotos, mehr als acht Werke, die Untergrenze der Palette (*Beloved* hat 72 Cover gegen 222), und die Rechtefrage vor dem Posten — dieselbe wie beim Clip.


---

## 2026-09-08 · Hundert Bücher im Index, und die Reihe an eine sichtbare Stelle (Branch `cover-index`)

Fortsetzung von 6.10 auf Julians Wunsch: „füge weitere 50 Werke hinzu und baue die Funktion ‚Cover wie dieses' in die Website ein."

### Der Index verdoppelt

| | erste Runde | jetzt |
|---|---|---|
| Werke | 50 | **100** |
| Cover | 5.621 | **10.362** |
| Datei | 410 KB | **757 KB** |
| Cover mit mindestens einem Nachbarn | 11 % | **17 %** |

Die zweite Setzliste geht bewusst weiter weg vom englischen Roman: Homer, Dante, Goethe, Fontane, Remarque, Ende, Proust, Saint-Exupéry, Dostojewski, Murasaki Shikibu, Kawabata, Rushdie, Roy, Satrapi, dazu Kinderbücher und einige Sachbücher. Fünf Titel fielen an der Schwelle von 25 Ausgaben, darunter *Infinite Jest* mit 24 und ein *War and Peace*, das die Suche auf einen Datensatz mit zwei Ausgaben legte — dieselbe Ranking-Schwäche, die 6.1 beschreibt.

`scripts/pick-index-works.ts` ist jetzt **additiv**: es liest die vorhandene Liste, behält sie und füllt bis `--target` auf. Damit bleibt der schon gebaute Index gültig, und der Bauer holt nur die neuen Werke.

**Der Lauf über die 50 neuen Werke verlor kein einziges** (26 Minuten). In der ersten Runde waren es noch neun Ausfälle; die drei Versuche je Seite tragen.

### Die Schwellen halten bei doppeltem Umfang

Mit doppelt so vielen Kandidaten steigt der Anteil der Cover mit Nachbarn von 11 auf 17 Prozent — die Tore mussten also nicht nachgezogen werden, und die Qualität steigt sogar sichtbar. Der schönste Fund der zweiten Runde: der schwarze Band mit goldenem Kranz von *Also sprach Zarathustra* findet drei weitere schwarze Bände mit goldenem Kranz (*Jane Eyre*, *Alice*, *La Divina Commedia*) — **eine ganze Verlagsreihe, allein am Bild erkannt**, ohne dass irgendwo ein Reihenname steht. Genau das ist der Fall, für den 5.4b sonst eine Verlagsfacette bräuchte.

### Die Reihe steht jetzt, wo man sie sieht

Vorher am **Fuß der Seitenleiste**, hinter Metadaten, Kauf-Links und Suchwegen — also dort, wo sie niemand findet. Jetzt **direkt unter dem gewählten Cover und seiner Bildunterschrift**: ein seitlicher Sprung ergibt nur neben dem Sinn, wovon gesprungen wird.

Der Preis dafür ist ehrlich zu nennen: die Reihe schiebt die Kauf-Links nach unten, die ohnehin zu weit unten stehen (1.2). Deshalb **drei Kacheln statt sechs und kein erklärender Absatz** — und weil sie nur bei etwa jedem sechsten Cover erscheint, ändert sich in fünf von sechs Fällen gar nichts.

Die Erklärung steht stattdessen auf der **About-Seite**, wie PLAN-speicher §3.5 es verlangt: was gemessen wird, dass **kein Bild gespeichert wird, nur Zahlen**, dass die Prüfung absichtlich schwer zu bestehen ist, und **wann der Index gebaut wurde**. Die Zahlen dort kommen aus dem Index selbst, nicht aus dem Text, und veralten damit nicht.

---

## 2026-09-08 · Warum ein Cover auf der Karte steht, aber nicht auf der Wand (Testfall Böll)

Julian: „Ansichten eines Clowns ist ein Testcase, wo Cover im Vorschau-Mosaik auftauchen, aber dann nicht in der Anzeige." Nachgemessen an OL279833W.

**Die Karte** zeigt vier Kacheln: dtv 1984, dtv 1967, Kiepenheuer & Witsch 2002, Reclam 1998. **Die Wand** zeigt fünf Cover, und die zweite Kachel ist keines davon: `ol:12587579` (dtv 1967) wird beim Falten in `ol:10527677` (dtv 1984) hineingezogen, Hamming-Distanz **6**. Sie ist nicht verloren — sie steckt im „+1" der ersten Kachel — aber wer die Karte gesehen hat, sucht ein Bild, das auf der Wand keine eigene Kachel mehr hat.

**Die Ursache ist nicht ein Fehler, sondern zwei Regeln für dieselbe Frage.** Die Karte fasst nach *Verlag und Jahr* zusammen (`coverImages`), die Wand nach *Bild* (`foldDuplicateCovers`). Zwei Scans derselben dtv-Gestaltung, siebzehn Jahre auseinander neu aufgelegt, sind für die Metadaten zwei Drucke und für das Auge einer.

**Die Wand hat recht.** Und die Grenze ist enger, als SPEC F4 sie bisher beschrieb: dort stand, zwei *Verlage* mit einer lizenzierten Gestaltung blieben nebeneinander. Es reicht schon **ein** Verlag mit zwei Jahreszahlen.

Aufgenommen als ROADMAP 6.13 mit drei Wegen: nur bei gleichem Verlag zusätzlich hashen (billig, behebt den Fall), den gebauten Index fragen (umsonst, aber nur für die 100 indizierten Werke — Böll gehört nicht dazu), oder es auf der Karte benennen. Der Spiegelfall zu 6.7, wo die Wand zu wenig faltet.

**Nachtrag am selben Tag, auf Julians Rückfrage („aber es war eine Karte im Mosaik zu sehen, die dann gar nicht mehr in der Wand aufgetaucht ist?").** Er hat recht, und meine erste Erklärung war zu großzügig. „Es steckt im +1" stimmt nur für die **Zahl**, nicht für das **Bild**. Im Code nachgesehen: das Abzeichen in `CoverGallery` ist `pointer-events-none`, die Seitenleiste nennt die Faltung nur als Text, und `selectCoverFrom` löst einen Link auf ein gefaltetes Cover auf dessen Vertreter auf. **Es gibt keinen Weg, ein gefaltetes Cover anzusehen.** Bei Böll sind die beiden dtv-Fassungen dieselbe Zeichnung, aber sichtbar verschieden gedruckt — cremefarbener gegen weißen Grund, anderer Anschnitt.

Damit ist der eigentliche Fehler nicht die Ungleichheit der beiden Regeln, sondern dass das Falten eine Einbahnstraße ist. Das widerspricht E16, wo genau festgehalten ist, dass ein Fehlurteil eine Position kosten soll und kein Cover. In SPEC §2.3 steht die Anforderung jetzt, in ROADMAP 6.13 der Weg.

**Zweiter Nachtrag, nach Julians Widerspruch („das Bild unten rechts im Mosaik ist nicht in der Wand, das ist ein anderer Fall als zwei Scans").** Er hatte wieder recht, und diesmal lag ich an der falschen Stelle: es ist nicht die Faltung.

Open Library führt *Ansichten eines Clowns* als **sechs getrennte Werk-Datensätze**. Unsere Suche fasst sie nach Identitätsregel 2 korrekt zu **einer** Karte zusammen, und die Karte trägt die Cover aller sechs:

| Werk | Ausgaben | Cover | wo |
|---|---|---|---|
| OL279833W | 8 | K&W, blass, Junge mit Leiter | Karte und Wand |
| OL8114847W | 3 | KiWi, Foto zweier Menschen | nur Karte |
| OL9063200W | 1 | dtv, weiß mit dunklem Foto | nur Karte |
| OL24570496W | 2 | SAGA, graublau mit rotem Kreis | nur Karte |
| OL34685576W, OL37792362W | 3 + 1 | ohne Cover | — |

Die Detailseite öffnet `/book/OL279833W` und lädt nur dessen Ausgaben. Die anderen fünf Datensätze werden nie geholt. Die Zahlen bestätigen es: die Karte meldet **14 Ausgaben**, die Wand **8**, und 8 + 3 + 1 + 2 = 14.

**Eine Asymmetrie im Entwurf, nicht ein Zufall dieses Buchs:** zusammengefasst wird bei der Suche, geladen wird auf der Detailseite je Werk-ID. Jedes Buch, das Open Library mehrfach führt, zeigt auf der Karte mehr, als seine Seite einlösen kann. Aufgenommen als ROADMAP 6.13 mit drei Wegen; der unsichtbare gefaltete Scan ist davon abgetrennt und steht jetzt als 6.14.

**Für mich die Lehre dieses Durchgangs:** ich hatte zweimal zu früh eine Erklärung, die zu den Daten passte, die ich gerade angesehen hatte. Die erste Messung verglich Mosaik und Seite 0 desselben Werks — dort stimmte alles, also musste die Faltung schuld sein. Erst Julians Widerspruch führte zu der Frage, woher die Kacheln der Karte überhaupt stammen, und die Antwort lag eine Ebene höher.

---

## 2026-09-08 · Fünf von sechs Karten sind ein Roman (Testfall „ansichten böll")

Julian, nachdem 6.13 stand: „von 5 Ergebnissen sind 4 das richtige Buch, nur in einer anderen Sprache, das sollte so auch nicht passieren."

Er hat recht, und es widerspricht der Spec ausdrücklich: §2.1 sagt seit dem 2026-09-06, Sprache sei kein Teil der Werk-Identität und Übersetzungen seien Ausgaben desselben Werks. Der Code löst das nicht ein, weil Identitätsregel 2 den **Titel** vergleicht — und eine Übersetzung hat einen anderen.

Sechs Karten für „ansichten böll", 22 Ausgaben, davon **21 zu einem einzigen Roman**: das zusammengefasste deutsche Werk (14), die englische *The clown* (2), die italienische *Opinioni di un clown* (1), die spanische *Opiniones de un payaso* (2) und eine kommentierte Schulausgabe (2). Nur die Studie von Bernd Balzer ist zu Recht getrennt.

**Was es an Verbindungen gibt, geprüft statt vermutet:**

| Signal | Befund |
|---|---|
| Autoren-Key | bei allen fünf gleich (`OL2633288A`) — notwendig, längst nicht hinreichend |
| `id_wikidata` | auf keinem Datensatz |
| Erstjahr | 1963, 1963, 1972, 1990 — Übersetzungen tragen das Jahr ihrer eigenen Ausgabe |
| ISBN | keine Überschneidung |
| `id_librarything` | nur auf einem von fünf |
| LCC | Original `PT-2603.00000000.O394 A7`, englische Ausgabe `… A513` — gleiche Autoren-Cutter-Basis; die italienische hat gar keine LCC |

**Das Ergebnis ist unbequem und gehört so festgehalten: eine verlässliche maschinelle Verbindung zwischen diesen Datensätzen gibt es nicht.** Jede Regel, die stark genug wäre, *The clown* an *Ansichten eines Clowns* zu binden, bindet auch zwei verschiedene Bücher desselben Autors aneinander — und eine falsche Verschmelzung ist schlimmer als eine verpasste.

Aufgenommen als ROADMAP 6.15 mit drei Schritten: Klammerzusätze normalisieren (fängt die Schulausgabe, risikoarm), nach Autoren-Key statt Namen zusammenfassen, und für Übersetzungen erst über dreißig Werke messen, ob LCC-Cutter oder LibraryThing-ID tragen. Tut es keines, bleiben Übersetzungen eigene Karten — **dann muss aber §2.1 umgeschrieben werden**, statt eine Regel zu behaupten, die der Code nicht einlöst. In SPEC §2.1 steht dieser Vorbehalt jetzt.

---

## 2026-09-08 · Die Suche wiederholt sich einmal, und der Cache hält einen Tag (ROADMAP 1.10)

Julian, nach der Einschätzung zur Suche vor dem MVP: „Ja, Cache auf 24h, fang mit 1.10."

**Gebaut.** `searchWorks` fragt Open Library ein zweites Mal, wenn der erste Versuch geschwiegen hat. `isSilence` in `lib/sources/http.ts` entscheidet, was Schweigen ist: Timeout, Netzfehler, ein Rumpf, der sich nicht lesen ließ, und **5xx**. Ein **4xx nie** — es ist eine Antwort über genau diese Anfrage, und ein zweiter Versuch wiederholte den Fehler. Das ist keine Feinheit: 422 ist Open Librarys Absage an eine Anfrage unter drei Zeichen und 429 kommt aus einem Rate-Limit; beides zu wiederholen fügte nur Last hinzu. Ein 200 mit einem Rumpf ohne `docs` zählt weiterhin als Schweigen und wird deshalb wiederholt.

`SEARCH_RETRY` deckelt beide Versuche zusammen auf **20 s** und kürzt den Deckel des zweiten Versuchs auf den Rest; bleiben weniger als 5 s, unterbleibt er. Zwei volle Timeouts wären 24 s vor einem Skelett, und unterhalb von fünf Sekunden kauft ein zweiter Versuch meist nur einen weiteren Timeout. Der Cache der Suche steht jetzt bei 24 h statt 1 h, im Datencache wie im `s-maxage` der Route.

**Gemessen, und die Messung sagt etwas anderes als erwartet.** 80 Suchen am Abend des 2026-09-08 aus Deutschland, außerhalb von Next, also ohne Datencache: 40 verschiedene Titel je einmal, dazu die vier Titel der Mittagsmessung je zehnmal.

| Satz | Suchen | im ersten Versuch gescheitert | nach der Wiederholung gescheitert | Median | langsamste |
|---|---|---|---|---|---|
| 40 verschiedene Titel, kalt | 40 | 0 | 0 | 894 ms | 5.045 ms |
| 4 Titel, zehn Runden | 40 | 0 | 0 | 567 ms | 4.430 ms |

**Kein einziger Ausfall.** Am selben Tag, mittags, waren drei von vier Suchen gescheitert; am Vortag vier von rund vierzehn. Derselbe Code-Pfad, derselbe Ort, dieselbe Quelle.

**Was das heißt, und was es nicht heißt.** Es heißt nicht, dass die Wiederholung das Problem gelöst hat — sie hat in diesen 80 Suchen kein einziges Mal ausgelöst, es gibt also keinen Vorher-Nachher-Vergleich. Belegt ist sie nur durch die Unit-Tests in `lib/__tests__/sources.test.ts`, die den Netzfehler, den Timeout, den Rumpf ohne `docs`, den nicht wiederholten 4xx und den Abbruch nach dem zweiten Versuch abdecken.

Es heißt: **die Ausfallquote von Open Library ist keine Quote, sondern eine Folge von Episoden.** Eine Messung an einem Nachmittag beschreibt den Nachmittag. Die 20-Sekunden-Obergrenze ist damit auch keine übliche Wartezeit, sondern der schlechteste Fall einer schlechten Episode; üblich ist knapp eine Sekunde.

Für **ROADMAP 0.10** — die Frage nach einem eigenen Datenbestand — ist das die wichtigere Erkenntnis: „Ausfallquote der Quellen" ist dort eine der drei Zahlen, nach denen entschieden werden soll, und sie lässt sich in einer Sitzung nicht ermitteln. Sie braucht die Woche echter Besucher aus Phase 3. Die drei Messungen zusammen — 4/14, 3/4, 0/80 — sind das Argument dafür, in Phase 3 pro Tag zu messen und nicht pro Sitzung.

Nebenbefund fürs Deployment: der schlechteste Fall der Suche liegt jetzt bei 20 s. Ob die Serverless-Funktion so lange laufen darf, ist bei Phase 2 zu prüfen und steht dort als Zeile in 2.1.

---

## 2026-09-08 · Vier Regeln gegen gleichnamige Ableitungen (ROADMAP 6.1)

Julian: „mache mit 6.1 weiter."

**Gemessen zuerst, gebaut danach.** Fünfzehn Suchen — die vier aus dem Durchklick, die falsch lagen, die zehn, die richtig lagen, und *norwegian wood* als Gegenprobe — mit allen Signalen, die eine Regel benutzen könnte: Ausgabenzahl, Leserzahl, Position bei Open Library, Titelverhältnis zur Anfrage. Das Ergebnis widerlegte gleich zwei Annahmen aus dem Roadmap-Punkt.

**Erstens: die Leserzahl trennt nicht.** *Alice in Wonderland in Five Acts* hat **eine** Ausgabe gegen Carrolls 3.547, aber 1.010 Leser gegen 2.307 — nur Faktor zwei. Wer nach Popularität sortiert, findet die Bühnenfassung nicht. Nur die Ausgabenzahl zeigt den Unterschied, und zwar mit Faktor 3.547.

**Zweitens: der Autorenschlüssel schützt bei Dostojewski genau den falschen Datensatz.** Die Vermutung war, Open Librarys `author_key` sei die verlässlichere Identität als der Name. Gemessen bei `crime and punishment`:

| Platz | Ausgaben | Autorenschlüssel | Was es ist |
|---|---|---|---|
| 1 | 1.179 | `OL22242A` | Der Roman, unter «Преступление и наказание» |
| 2 | 18 | `OL1350915A`, **`OL22242A`** | Der Übersetzer-Datensatz von Michael R. Katz |
| 7 | 19 | `OL16224933A` | Dostojewskis eigener englischer Datensatz |

Derselbe Mensch trägt zwei Schlüssel, und der Datensatz, der weg sollte, teilt seinen Schlüssel mit dem Roman, während der, der bleiben sollte, es nicht tut. Als *Schutz* ist der Schlüssel damit unbrauchbar. Als *Fund* ist er genau richtig: die bestehende Regel „ein Zweitautor ist Erstautor eines viel größeren Werks" scheiterte hier nur an der Transkription — „Fyodor Dostoevsky" auf dem einen, „Fiódor Dostoievski" auf dem anderen. Sie vergleicht jetzt Namen **und** Schlüssel, und damit fällt Katz und Dostojewskis englischer Datensatz steigt von Platz 7 auf Platz 5.

**Die Schwelle wurde abgelesen, nicht gewählt.** Ausgabenverhältnis zum gleichnamigen größeren Werk:

| Muss fallen | | Muss bleiben | |
|---|---|---|---|
| Katz, *Crime and Punishment* | 65x | Randall Kennedy, *Sellout* | 16x |
| Kemp, Bühnenfassung *Master and Margarita* | 117x | Lars Mytting, *Norwegian Wood* | 12x |
| Bloom über *The Bell Jar* | 177x | | |
| Matterson, Penguin-Studie *Great Gatsby* | 400x | | |

Fenster 17 bis 65, gewählt 30, Abstand besser als Faktor zwei nach beiden Seiten. Der Roadmap-Punkt hatte 25 bis 50 geschätzt; die Messung bestätigt die Größenordnung und engt sie ein.

**Das Ergebnis über alle fünfzehn Suchen: sieben verbessert, acht unverändert, keine verschlechtert.** Verbessert: `alice in wonderland` (Carroll von Platz 2 auf 1, die Bühnenfassung von 1 auf 7), `the great gatsby` (Matterson 2 → 5, Lehan 4 → 6, Parkinson aus den ersten acht), `crime and punishment` (Katz und die Cliffs Notes aus den ersten acht), `die blechtrommel` (vier Bände über den Roman von den Plätzen 2–5 auf 5–8), `the bell jar`, `a confederacy of dunces`, `things fall apart`. Unverändert und damit als Regressionsschutz bestanden: `wolf hall`, `the sellout`, `half of a yellow sun`, `if on a winter's night a traveler`, `ursula k le guin`, `norwegian wood`, `the hunger games`, `klara and the sun`. **Nur ein erster Treffer änderte sich überhaupt, und es war der falsche.**

**Ein Fund nebenbei, gemessen und behoben.** Das bestehende Muster `notes on` hielt Zoë Hellers Roman *Notes on a Scandal* für einen Studienführer. Bei der Suche nach seinem eigenen Titel stand er auf **Platz 4**, hinter Sheridan und den *Brüdern Karamasow*. `notes on` zählt jetzt nur noch, wenn etwas davor steht — „Barron's Notes on Macbeth" ja, „Notes on a Scandal" nein. Danach steht der Roman auf Platz 1. Aufgegeben wird damit ein Studienführer, der genau „Notes on <Titel>" heißt; CliffsNotes und SparkNotes fangen ihre eigenen Namen ohnehin.

**Was offen bleibt, und warum es nicht ins Ranking gehört.** Bei `crime and punishment` steht Harold Blooms Band jetzt auf Platz 2. Er trägt den Titel des Romans, aber der Roman ist bei Open Library als «Преступление и наказание» geführt und sein englischer Datensatz hat nur 19 Ausgaben — es gibt kein gleichnamiges großes Werk, gegen das Bloom gemessen werden könnte. **Das ist dieselbe Wurzel wie 6.13 und 6.15:** ein Buch, das Open Library auf mehrere Werk-Datensätze verteilt. Im Ranking ist es nicht zu reparieren, ohne die Schutzregel aufzugeben, die Kafkas deutsches Original trägt. Ebenso unverändert: `klara and the sun` hat auf Platz 2 *Alice's Adventures in Wonderland*, ein Werk ohne jede Titel- oder Autorenbeziehung zur Anfrage, das allein von seiner Leserzahl lebt. Eine Regel dagegen wurde geprüft und **verworfen**: sie hätte bei `crime and punishment` und `die verwandlung` den richtigen Treffer auf Platz 1 gelöscht, weil dessen Titel ebenfalls nicht zur Anfrage passt.

## 2026-09-08 · Der Hobby-Modus: ein Schalter statt zweier Branches (ROADMAP 2.0, dazu 1.7 und 6.15 Schritt 1–2)

Branch `mvp-hobby`. Julian wollte „schnell zu einem deployten MVP", als Hobby-Seite ohne Affiliate-Links, und die Shop-Variante daneben weiterbauen. Der Plan ([PLAN-2-mvp-hobby](plans/PLAN-2-mvp-hobby.md)) hat aus den zwei Branches einen Schalter gemacht und aus „ohne Händler" nach Julians Entscheidung „ohne Provision": die Händler-Links bleiben, solange sie neutral sind.

**Gebaut.** `NEXT_PUBLIC_SITE_MODE` (`lib/sitemode.ts`): nicht gesetzt heißt `hobby`, jeder Wert außer `hobby` und `shop` bricht den Build statt still zurückzufallen. Im Hobby-Modus ignoriert `buyLinksFor` die `AFFILIATE_*`-Variablen auch dann, wenn sie gesetzt sind — ein Test prüft alle drei Märkte mit gesetzten Variablen gegen `tag=` und `/a/` —, `/api/availability` antwortet 404 und der Button existiert nicht, die Fußzeile und About tragen keinen Provisionssatz, die Links kein `rel="sponsored"`. Neu: `/contact` (Impressum) und `/privacy`, deren Angaben aus `IMPRINT_*` in der Umgebung kommen und deren Fehlen den Build abbricht (`lib/imprint.ts`); Vercel Web Analytics als Plattform-Skript mit einem `beforeSend`, das `q` aus der URL nimmt; `maxDuration = 30` auf Suche und Werk-Route; `/go/` in der robots.txt; `.env.example` als Vorlage.

**Zwei Dinge, die nicht wie geplant gingen.** Erstens ließ sich `@vercel/analytics` nicht installieren: sein optionaler SvelteKit-Peer zieht Vite 8, vitest 4 verlangt Vite 7, und `--legacy-peer-deps` hätte ein Lockfile hinterlassen, das `npm ci` auf Vercel nicht mehr prüfen kann. Das Skript, das das Paket injiziert, ist `/_vercel/insights/script.js`, also wird es direkt eingebunden (`components/Analytics.tsx`). Zweitens **darf der Autoren-Key nicht trennen** (6.15 Schritt 2): die erste Fassung ließ zwei Namensgleiche mit verschiedenen Keys auseinander — und hätte damit *Mumbo Jumbo* gespalten, denn Open Library führt Reed unter `OL27626A` und `OL11412010A` (CLAUDE.md). Der Key führt jetzt nur zusammen („Heinrich Böll" und „H. T. Boll" unter `OL2633288A`), die Namensregel bleibt, wie sie war. Namensgleiche mit demselben Titel auseinanderzuhalten braucht ein Signal, das die Datensätze nicht tragen.

**1.7.** Eine wohlgeformte, unbekannte Work-ID ist ein 404 (`notFound()` in `app/book/[id]/page.tsx`, dazu `app/not-found.tsx`) — aber nur bei einem sicheren „gibt es nicht"; schweigt der Katalog, rendert die Seite und der Client meldet den Ausfall. `?offset=1500` liefert eine leere Seite, die 1500 meldet, mit dem Gesamtstand der Quelle aus einem Ein-Datensatz-Abruf; vorher meldete sie 1400 und lieferte die Seite, die der Aufrufer schon hatte.

**6.15 Schritt 1.** `normalizeTitle` streicht Klammerzusätze am Ende („Ansichten eines Clowns (Methuen's Twentieth Century German Texts)" → „ansichten eines clowns"), nur am Ende und nur, wenn etwas davor stehen bleibt. Die Methuen-Ausgabe fällt damit in die Karte des Romans. Schritt 3 (Übersetzungen) bleibt offen und braucht die Stichprobe.

**Gemessen.** 252 Tests grün (21 Dateien), `tsc`, Lint und `next build` sauber; der Build erzeugt 23 statische Seiten einschließlich der zwei Rechtsseiten. Live geprüft mit dem Dev-Server: Impressum und Privacy rendern die Umgebungswerte, die Fußzeile trägt „About · Impressum · Privacy" ohne Provisionssatz, `/api/availability` → 404, `/api/works/OL468431W?offset=1500` → `{editions: [], page: {offset: 1500, total: 1180}}`, robots.txt sperrt `/api/` und `/go/`. **Nicht live prüfbar:** der 404 für `/book/OL99999999W`, weil Open Library während der Prüfung in einer Ausfall-Episode war — das Werkdokument brauchte **11,2 s** für sein 404, die Suche nach dem Key antwortete nach **75 s** gar nicht, `getWork` lief nach 10 s in den Timeout, und die Seite antwortete darum absichtlich mit 200. Die Detailseite lud erst im zweiten Anlauf, nach der Episode: *Gatsby* mit 293 Covern aus 1.180 Datensätzen, Seitenleiste mit sechs DE-Händlern über `/go/`, alle mit `rel="noopener noreferrer"` ohne `sponsored`, kein „Check the shops“-Knopf, und das Verdikt lief („No current publisher image is on record for this ISBN“ für die indische 100-MustReads-Ausgabe aus 1.1). Der 404 gehört in die Abnahme nach dem Deploy (2.6). Eine Episode mehr für die Liste aus 1.10. Enter im Suchfeld (0.8): der synthetische Tastendruck des Panels löst weiterhin nichts aus, `form.requestSubmit()` dagegen führt zur Trefferliste — die Struktur stimmt, der Handgriff am Gerät bleibt Julian.

**Recherche zum Recht** ([docs/recht-hobbyseite.md](recht-hobbyseite.md)): Name und ladungsfähige Anschrift sind nach § 18 Abs. 1 MStV Pflicht für jede öffentliche Seite; § 5 DDG verlangt für eine Privatperson nur die E-Mail dazu; Vercel Hobby hält Logs eine Stunde und hat **keinen** Auftragsverarbeitungsvertrag (der DPA gilt für Pro und Enterprise) — Julian trägt das Restrisiko, ROADMAP 0.12.

**Nachgelesen für die Einrichtung (2026-09-08 abends):** Vercel Hobby erlaubt Funktionen 300 s (Default und Maximum, Fluid compute), Pro 800 s; die 20 s der Suche sind kein Thema. Die drei Commits (1.7, 6.15, 2.0) sind per Fast-Forward auf `main` und bei GitHub; Vercel gibt es noch nicht, Julian legt das Konto an.

## 2026-09-08 · Der erste Deploy, und die fremde Seite, auf die wir gezeigt haben (ROADMAP 2.1, 2.6)

Julian hat das Vercel-Projekt am Abend zusammen mit Claude im Browser eingerichtet. Was dabei gemessen und gelernt wurde, gehört hierher, weil es beim zweiten Mal Zeit spart.

**Die Seite ist online:** https://beautifulcovers.vercel.app, Build 1 min 49 s, Funktions-Region nachträglich von Washington (`iad1`, Vercels Voreinstellung) auf **Frankfurt (`fra1`)** gestellt.

**Der schwerste Fund war ein geratener Name.** `NEXT_PUBLIC_SITE_URL` wurde beim Import auf `https://beautifulbooks.vercel.app` gesetzt, weil der Projektname das nahelegt. Vercel vergab aber `beautifulcovers.vercel.app` — denn **`beautifulbooks.vercel.app` gehört jemand anderem**, einer fremden Vite-Anwendung, die sich ebenfalls „Beautiful Books" nennt. Die Folge stand eine Viertelstunde lang live: `<link rel="canonical">`, das OG-Bild, die Sitemap und der `Host` in der robots.txt zeigten alle auf **die fremde Seite**. Für einen Crawler heißt das, unsere Seiten seien Kopien von deren Seite. Behoben durch Korrektur der Variablen; die Lehre ist, **die Produktionsadresse nach dem ersten Deploy abzulesen und nicht aus dem Projektnamen zu schließen** — und sie ist ein Argument, die eigene Domain (0.5) bald zu kaufen.

**Die Abnahme lief sonst sauber** (Tabelle in ROADMAP 2.6). Zwei Ergebnisse sind mehr als Häkchen:

- **`/book/OL99999999W` antwortet mit 404**, gemessen in 5,1 s. Lokal war dieser Nachweis am selben Tag an einer Open-Library-Ausfall-Episode gescheitert; in Produktion, mit warmem Cache und schneller Quelle, ist er erbracht. ROADMAP 1.7 ist damit belegt und nicht nur behauptet.
- **78 Kauf-Links auf Seite 0 von *Gatsby*, kein einziger mit Provisionsparameter**, und `/go/thalia/<isbn>` leitet ohne Parameter weiter. Der Hobby-Modus (E20) tut in Produktion, was er verspricht.

Antwortzeiten der statischen Seiten 0,33–0,72 s; die Suche nach *1984* kam vollständig und mit *Nineteen Eighty-Four* auf Platz 1.

**Web Analytics: der `<script>`-Tag genügt nicht.** `/_vercel/insights/script.js` antwortet mit **404**, solange die Funktion im Dashboard nicht eingeschaltet ist — der Tag steht im HTML, gezählt wird nichts. Nach dem Einschalten gilt der Hobby-Umfang: 50.000 Ereignisse im Monat, 30 Tage Verlauf, **keine Custom Events**. Damit beantwortet Vercels Zählung keine der sechs Fragen aus 3.1; sie zählt Aufrufe. Der eigene Endpunkt bleibt also nötig.

**Die Region ließ sich nicht im ersten Anlauf umstellen, und das Dashboard sagte nicht, warum.** Frankfurt anzuhaken genügt nicht: Vercel hält die alte Region (`iad1`) angehakt, der Hobby-Plan erlaubt aber **eine**, und der Speichern-Knopf bleibt deshalb stumm ausgegraut — ohne Fehlermeldung, nur mit dem allgemeinen Hinweis „limited to 1" weiter unten. Erst das Abwählen von Washington machte ihn klickbar. Der erste Versuch sah aus wie ein Erfolg (der Knopf war ausgegraut, was hier „nichts zu speichern" hieß und nicht „gespeichert"), und die Kontrolle, die es aufdeckte, war der Antwort-Header der laufenden Seite: `x-vercel-id: fra1::iad1::…` — der erste Teil ist der Eingangsknoten, der zweite die Region, in der die Funktion wirklich lief. **Diese Zeile ist die Prüfung, nicht das Häkchen im Dashboard.**

**Beim Einrichten hat sich noch dies gezeigt:** Vercel liest `.env.example` und legt alle zwölf Schlüssel als leere Variablen an — die fünf `AFFILIATE_*` wurden entfernt statt leer gelassen, damit im Hobby-Modus gar nichts danebenliegen kann. Die Laufzeitgrenze ist unkritisch (Hobby 300 s je Funktion gegen 20 s im schlechtesten Fall der Suche). Und der Import zeigt nur Repositories, für die die GitHub-App freigegeben ist; `beautifulbooks` musste erst in den App-Rechten ergänzt werden.

**Nach der Umstellung auf Frankfurt gemessen** (2026-09-08, spät):

| | |
|---|---|
| Statische Seiten | 0,24–0,49 s |
| Suche, kalt | *ansichten böll* 1,2 s, *beloved* 1,1 s, *wolf hall* 13,4 s (dort griff die Wiederholung aus 1.10) |
| Unbekannte Work-ID | **fünf von fünf mit 404**, 1,6 bis 9,3 s |

**Ein sechster Versuch antwortete allerdings mit 200 nach 20,6 s**, und das ist kein Fehler, sondern die Regel aus 1.7 bei der Arbeit: schweigt der Katalog, wird die Seite gerendert, weil ein Ausfall keine Abwesenheit ist. In diesem Moment brauchte Open Library für dasselbe Werkdokument direkt gemessen 13,3 s. **Der Preis ist ein Soft-404 während einer Ausfall-Episode** — Google sieht dann eine 200 für eine Seite, die es nicht gibt. Kein Anlass, die Regel umzudrehen (die Alternative wäre, jede langsame Antwort zu einem 404 zu erklären, und das wäre die schlimmere Lüge), aber es gehört gemessen und nicht angenommen.

**Böll in Produktion, der Testfall aus 6.15:** die Suche „ansichten boell" liefert **4 Karten statt 6**, und *Ansichten eines Clowns* trägt jetzt **16 Ausgaben statt 14** — die Methuen-Schulausgabe ist in die Karte des Romans gefallen, wie Schritt 1 es vorsah. Übrig bleiben die drei Übersetzungen als eigene Karten; das ist Schritt 3 und ausdrücklich offen.

**Am selben Abend noch einmal umbenannt:** Julian hat die Produktionsadresse auf **beautifulcovers.vercel.app** geändert — der bessere Name, und er war frei. Damit war dieselbe Falle wie beim ersten Deploy wieder offen: `beautifulbooks-kappa.vercel.app` antwortet seit der Umbenennung mit **404**, während robots.txt, Sitemap und Canonical noch darauf zeigten. `NEXT_PUBLIC_SITE_URL` nachgezogen. **Merksatz für die eigene Domain (0.5): der Name ist eine Variable zur Bauzeit, keine Einstellung zur Laufzeit** — jede Umbenennung braucht einen Deploy hinterher.

## 2026-09-08 · Kuratieren, und was daraus für die Startseite folgt (ROADMAP 6.17, 6.18)

**Das Werkzeug wurde am selben Abend benutzt**, während es noch entstand: 35 Werke angesehen, **30 Cover gewählt**, fünf übersprungen. Das ist die erste Zahl über das Werkzeug selbst — rund zwanzig Sekunden je Buch, ohne dass jemand darauf gewartet hätte, dass etwas lädt.

**Der Fortschritt hält, und das ist geprüft, nicht behauptet:** jede Wahl geht sofort als eigene Anfrage an den Server, der `data/curated.json` **atomar** schreibt (erst `.tmp`, dann umbenennen), damit ein Abbruch mitten im Schreiben keine halbe Datei hinterlässt. Nach einem harten Neustart des Servers lagen alle 32 Einträge da, und die App sprang zum ersten offenen Werk (Nr. 37, *Мастер и Маргарита*). Zumachen und später weitermachen kostet nichts.

**Ein Fehler dabei, und er gehört aufgeschrieben:** die zwei Wahlen, mit denen dieser Test gemacht wurde, landeten als echte Einträge in Julians Datei — *Neuromancer* und *Dune*, mit Cover-IDs, die niemand angesehen hatte. Sie wurden wieder entfernt; beide Werke sind jetzt wieder offen. **Ein Test, der in die Daten des Nutzers schreibt, braucht eine eigene Datei**, und die nächste Fassung des Werkzeugs sollte `CURATE_FILE` als Umgebungsvariable kennen.

**Die Startseite zeigt seitdem 18 Kacheln statt zwölf** (Julian: „ich will trotzdem eine volle Startseite"), drei volle Reihen zu sechs, und sie nimmt sie aus `data/curated.json`, aufgefüllt aus der alten Handliste. Live geprüft: die ersten Kacheln sind *Lolita*, *Gravity's Rainbow*, *Pride and Prejudice*, *Frankenstein*, *Jane Eyre*, *Анна Каренина* — Julians eigene Wahlen, nicht mehr die Vorauswahl.

**Was dabei nicht ging, und warum es eine Entscheidung ist:** eine Rotation je Aufruf lässt sich in diesem Bauteil nicht machen. Die Startseite wird vorgerendert; eine hier gewürfelte Reihenfolge stünde im ausgelieferten HTML anders als im Browser, und React verwirft dann den ganzen Teilbaum. Die drei Auswege und ihr Preis stehen in 6.17 — der billigste ist eine stündliche Neuerzeugung, der teuerste eine dynamische Startseite, und genau die hatte Julian mit „vorgeladen, damit es schnell geht" ausgeschlossen.

## 2026-09-09 · Beide Ladebildschirme, und was das Telefon dabei zeigte (ROADMAP 6.19)

Julian wollte beide Wartezeiten angehen, für Rechner und Telefon. Das Messen vorher hat zwei Fehler gefunden, die niemand vermutet hatte, und einen dritten bestätigt.

**Der Cover-Fächer passte nicht auf ein Telefon.** Vier Kacheln zu 16,5 rem mit 92 px Abstand ergaben in einem 459 px breiten Fenster eine Spanne von **−96 px bis 471 px**: die erste Kachel angeschnitten, die letzte über dem Rand, und die Seite ließ sich seitwärts schieben. Breite und Abstand rechnen jetzt in Bildschirmbreiten (54 vw und 12 vw, gedeckelt auf die alten Werte), womit ab 320 px auf jeder Seite Luft bleibt — 16 px bei 320, 19 px bei 375, 22 px bei 430. Dazu `overflow-x: clip`, damit ein künftiger Rechenfehler nicht wieder die ganze Seite verschiebt.

**Die Werkseite war über einen Link von außen sekundenlang leer.** Die Ladeszene lebt von Covern, die entweder schon geladen sind oder von der Suchkarte mitgegeben werden; kommt jemand aus einer Suchmaschine, gibt es beides nicht, und übrig blieb eine leere Fläche mit den Worten „Collecting covers". Das ist der Weg, den Phase 5 gerade erst attraktiv machen soll.

**Gebaut wurde eine Antwort für beide Wartezeiten und die Suche dazu:** eine kleine Wand aus Covern, die Kachel für Kachel erscheint, drei je Reihe auf dem Telefon und sechs am Rechner — im Rhythmus der Wand, die dabei entsteht. Die Kacheln sind die Cover der Startseite, die der Browser ohnehin hat: **kein neues Bild im Bündel, keine zusätzliche Anfrage, nichts, was mit der Kuratierung auseinanderlaufen kann**, weil es dieselbe Liste ist. Alles Bewegte ist CSS.

**Warum die Kacheln klein, gedimmt und ohne Titel sind:** was während einer Suche auf dem Schirm steht, darf nicht wie deren Ergebnis aussehen. Das ist dieselbe Regel, nach der ein Ausfall nicht „nichts gefunden" heißen darf (N12), einen Schritt früher.

**Das Riesenmosaik, Julians ursprünglicher Vorschlag, ist bewusst nicht gebaut.** Es bräuchte ein vorgerechnetes Bild im Bündel und wirft die Rechtefrage aus 5.5 auf: ein Mosaik ist ein abgeleitetes Werk aus fremden Covern, ihre Anzeige ist es nicht. Es bleibt als 6.19a offen und würde die Kacheln in genau einer Komponente ersetzen.

## 2026-09-09 · Zwanzig Vorschläge, die keine waren (ROADMAP 6.18)

Der zweite Lauf des Vorschlagsskripts lieferte zwanzig Bücher, von denen fast keines eines war: *Anne of Avonlea* statt *Anne of Green Gables*, *The Marvelous Land of Oz* statt *Oz*, „Gesammelte Werke in zeitlicher Folge", ein Kasten „The Hobbit & The Lord of the Rings [collection/set]" — und ein **Study Guide zu Zimbardos Luzifer-Effekt**, ausgerechnet auf einer Seite, deren Ranking Sekundärliteratur eigens nach hinten sortiert.

**Die Ursache stand in einer Zeile:** das Skript nahm den besten *unbekannten* Treffer statt des gesuchten Buchs. Solange das Buch neu war, stimmte das. War es längst in der Liste, stieg die Suche zum Nächstbesten ab — und das ist bei einem bekannten Titel per Definition sein Beiwerk. **Ein Filter, der „schon bekannt" mit „nimm etwas anderes" beantwortet, erzeugt genau den Müll, den das Ranking mühsam nach unten sortiert.**

Behoben, indem der Treffer jetzt *dasselbe Buch* sein muss: normalisierter Titel und Autorenschlüssel müssen zum Startpunkt passen, Sammelbände (`/` im Titel, „collected", „gesammelte", eckige Klammern) und Sekundärliteratur fallen weg, und ein Startpunkt, dessen Buch die Liste schon kennt, wird **übersprungen** statt ersetzt. Der Lauf danach lieferte zwanzig echte Bücher: *A Wizard of Earthsea*, *Solaris*, *The Woman in White*, *Candide*, *Robinson Crusoe*, *Emma*, *The Sound and the Fury*.

**Ein zweiter Fehler kam dabei heraus:** das Skript schrieb seine Funde, statt sie anzuhängen. Weil die schon bekannten Ids ausgeschlossen werden, fand der zweite Lauf nur die neuen — und überschrieb damit die fünfzig des ersten. Aufgefallen ist es nur, weil die Datei committet war und sich aus der Historie zurückholen ließ. Sie wird jetzt ergänzt, nie ersetzt.

## 2026-09-09 · Die erste erzeugte Seitengattung (ROADMAP 5.4a)

`/book/<id>/decades` zeigt dieselben Cover wie die Wand, aber nach dem Jahrzehnt ihres frühesten Drucks gruppiert, mit einer gezählten Zeile je Jahrzehnt. Sie ist die erste der Gattungen aus PLAN-5, und sie war es aus einem Grund: **sie braucht kein Modell und keine Google-Anfrage.** Alles auf ihr ist aus Ausgaben-Datensätzen gezählt, die die Seite ohnehin lädt.

**Was die Zeile darf und was nicht.** „8 von 50 Drucken sagen ebook · 21 Verlage, Scribner und Charles Scribner's Sons darunter · 2 Sprachen" — jede Angabe gezählt, keine charakterisiert. Ein Jahrzehnt, über das sich nichts zählen lässt, bekommt nur seine Coverzahl; ein Satz, der nichts hinzufügt, entfällt, statt gefüllt zu werden. Ein Fund beim Schreiben der Tests: die Formulierung „alle von Signet" wäre eine Vollständigkeitsbehauptung über ein Jahrzehnt gewesen, obwohl sie nur über unsere Datensätze gilt — sie heißt jetzt „1 Verlag, Signet".

**Die Schwelle entscheidet, nicht die Lust zu veröffentlichen** (R6): unter 20 Covern oder vier Jahrzehnten gibt es keine Seite, sondern einen 404. `scripts/find-decade-pages.ts` hat die 105 kuratierten Werke durchgezählt — **90 tragen eine Seite, 15 nicht**, und der Katalog schwieg bei keinem einzigen. Zu dünn sind die jüngeren Bücher: *The Road* hat 89 Cover, aber nur drei Jahrzehnte; *海辺のカフカ* 44 über drei. Genau dafür ist die Schwelle da.

Nur die 90 stehen in der Sitemap und nur bei ihnen erscheint der Link auf der Werkseite — eine Adresse, die einen Crawler auf einen 404 schickt, ist schlimmer als keine. **Die Sitemap ist damit von 22 auf 199 Adressen gewachsen**, an einem Tag, an dem sie morgens noch 22 hatte.

## 2026-09-09 · Ein Prototyp für das Duell (ROADMAP 5.8)

`lab/duel/` spielt die zweite Spielart: zwei Menschen, ein Link, dieselbe Runde. Der Startwert im Link bestimmt die zehn Bücher, ihre Reihenfolge und die sechs Cover je Buch, **ohne dass etwas gespeichert werden muss** — der Generator ist rein und mit drei festgenagelten Zahlen getestet, damit eine Änderung daran als roter Test auffällt und nicht als zwei Freunde, die verschiedene Runden sehen.

**Die Frage des Experiments ist nicht, ob es sich bauen lässt**, sondern ob genug Uneinigkeit entsteht. Bei sechs Covern trifft der Zufall 17 %; die App rechnet das jedes Mal mit und zeigt es neben dem Ergebnis, damit „30 %" nicht nach viel aussieht, wenn es wenig ist. Unter 25 % ist die Spielart tot, über 70 % langweilig. Die Zahl steht noch aus: erspielen kann sie nur ein Mensch mit einem anderen.

## 2026-09-09 · Warum die Jahrzehnte-Seite in Produktion 404 antwortete (ROADMAP 5.4a)

Lokal 200, in Produktion 404 — dieselbe Adresse, dieselbe Version. `/book/OL468431W/decades` brauchte lokal 6,9 s und antwortete, in Produktion 10,5 s und antwortete mit „nicht gefunden“. Das ist der schlechteste Fehler, den diese Seite haben kann: der 404 ist ihre **Schwellenregel** (unter 20 Covern über vier Jahrzehnte keine Seite), und hier log er.

**Drei Ursachen, alle im Ladepfad, keine in der Seite selbst:**

1. `getWorkDetail` warf, sobald **irgendeine** spätere Ausgabenseite nicht antwortete. Ein Werk mit sechs Seiten war komplett verloren, wenn die dritte in den Timeout lief — und in Produktion, mit einer Funktion in Frankfurt und einem Katalog, der von dort 3–10 s braucht, passiert das. Jetzt endet der Lauf mit dem, was angekommen ist. Dasselbe Prinzip wie der Wiederholungsversuch in 1.10, eine Ebene höher.
2. Die Seite lud mit `dedupeCovers: true`. Das Falten **lädt und hasht jedes Cover** — im Browser richtig, in einem Server-Render eine Rechnung, die keine Seite bezahlen kann.
3. Sie fragte Google Books, entgegen dem Kommentar, der im selben Block „ohne Google-Aufruf“ behauptete. `getWorkDetail` gab die Voreinstellung von `getWorkPage` durch, und die ist *an*. Ein kaltes Render hätte eine Anfrage des Tageskontingents für Daten ausgegeben, die die Seite nie liest (E10). `WorkDetailOptions.googleBooks` macht das jetzt zur Angabe des Aufrufers; das Kandidaten-Skript sagt dasselbe.

Zwei Tests halten das fest: eine mittlere Seite, die wirft, kostet die Seiten danach und keine davor, und ein Aufruf mit `googleBooks: false` erreicht `googleapis.com` nicht. Nach der Reparatur rendert eine kalte Jahrzehnte-Seite lokal in **4,5 s** (*Der Proceß*, 135 Cover aus 128 Datensätzen), eine warme in 0,9 s.

**In Produktion nachgemessen** (einmal, nach dem Deploy): dieselbe Adresse antwortet jetzt **200 in 18,0 s** statt 404 in 10,5 s. Der erste Aufruf ist teuer, weil er sechs Ausgabenseiten aus Frankfurt holt; `revalidate = 86400` sorgt dafür, dass ihn nur der erste Besucher eines Tages bezahlt. Weit unter der 300-Sekunden-Grenze der Funktion, aber die Zahl gehört im Blick behalten, wenn die Gattung wächst.

**Die Lehre, die über diese Seite hinausgeht:** ein Fehlschlag darf nicht als Befund erscheinen (N12) — und ein 404 ist ein Befund. Wo eine Schwelle über Veröffentlichen entscheidet, muss der Unterschied zwischen „zu dünn“ und „nicht geladen“ im Code stehen, nicht im Zufall der Antwortzeit.

## 2026-09-09 · Beim Öffnen ist nichts mehr ausgewählt (ROADMAP 1.1)

Eine Zeile hielt das Problem: `selectCoverFrom` fiel auf `groups[0].covers[0]` zurück. Die Wand ist nach Datensatzalter sortiert, also war das nicht das schönste und nicht das bekannteste Cover, sondern die **jüngste Erfassung** — bei *The Great Gatsby* eine Print-on-Demand-Ausgabe von 2026, auf die dann auch die Kauf-Links zeigten. Der Leser landete auf einer Entscheidung, die niemand getroffen hatte, und bezahlte sie mit einer Google-Anfrage.

**Gemessen am 2026-09-09** im Headless-Browser gegen den Dev-Server, gezählt aus Chromes eigenem Netzwerkprotokoll (`--log-net-log`), damit nicht das Server-Log einer fremden Sitzung mitzählt:

| Aufruf | Anfragen an `/api/isbn` |
|---|---|
| `/book/OL468431W` kalt geöffnet, nichts angeklickt | **0** (vorher mindestens 1, gemessen bis 5) |
| `/book/OL468431W?cover=ol:14369845` (geteilter Link) | **1**, für die eine ISBN des Covers |

Eine kalte Detailseite kostet damit **1 statt 2** Google-Anfragen, solange niemand auswählt: rund 1.000 statt 500 Seiten am Tag. Kein einziges Cover geht dafür verloren — das ist der Unterschied zu dem Hebel, den 0.7 abwägt, dessen Preis Cover wären.

**Die zweite Spalte wäre dadurch leer geworden, und das war die eigentliche Arbeit.** Sie zeigt jetzt bis zur ersten Auswahl das *Werk* statt einer *Ausgabe* — einen Ort, den die Seite vorher nicht hatte. Vier Dinge, alle aus geladenen Ausgaben gezählt, keine einzige Anfrage:

- **Jahresspanne und Zahl der Verlage** („Editions here run from 1925 to 2026, from 238 publishers.“). Die Zeile erscheint erst ab der zweiten geladenen Seite: Open Library liefert die jüngsten Datensätze zuerst, nach Seite 0 allein behauptete *Wolf Hall* eine Spanne von 2009 bis 2020 und korrigierte sich danach. „here“ ist wörtlich — beide Zahlen beschreiben die geladenen Ausgaben, nicht alles je Gedruckte (N12).
- **Der Klappentext mit seiner Ausgabe.** `blurbFor` wählt Sprache vor Länge, weil der längste sonst der falsche ist: bei *Wolf Hall* tragen 3 von 26 Ausgaben eine Beschreibung, und die längste (927 Zeichen) gehört Editorial Presença — sie ist portugiesisch. Weicht die Sprache trotzdem ab, wird sie genannt. Ein Klappentext ist Verlagswerbung für **eine** Ausgabe, nie eine Beschreibung des Werks; wer das weiß, liest ihn richtig, deshalb steht die Ausgabe daneben.
- **Die Einladung**, zuletzt und leise: vor einer Wand aus Covern muss niemandem erklärt werden, dass man Cover anklicken kann — beantwortet wird nur, was danach passiert.
- **Der Link auf den Open-Library-Datensatz** mit dem Satz, dass er dort korrigiert werden kann. Open Library ist ein Wiki, und die Seite zeigt sichtbar falsche Angaben (Gatsby, dort auf 1920 datiert). Die Adresse stand bisher nur im JSON-LD und war für Leser unsichtbar.

Nebenbei erledigt: auf dem Telefon stand die Peek-Leiste bisher **sofort beim Laden** am unteren Rand und verdeckte eine Kachelreihe. Ohne Auswahl gibt es sie nicht mehr, und der Platz dafür (`pb-20`) wird erst mit einer Auswahl reserviert, sonst bliebe ein toter Streifen unter der letzten Reihe.

**Was nicht zurückkommen darf:** der Rückfall. Wer später findet, die Spalte wirke leer, und sie mit einem automatisch gewählten Cover füllt, holt sich beides zurück — die fremde Entscheidung und die Anfrage. Der Kommentar an `coverForId` und der Test „picks nothing when the reader has picked nothing“ sind die Bremse.

**Julians Vorschlag, ein farbenfrohes Cover automatisch zu wählen**, ist beim Planen geprüft und als Vorauswahl verworfen worden, hat aber einen Platz behalten: ein Farbmaß gibt es gar nicht, weil `decodeToGray` in der ersten Schleife auf Graustufen rechnet; nachrüstbar wäre es billig. Für eine Vorauswahl war es falsch, für das Cover, das in 1.9 oben rechts auf der Startseite ins Auge fallen soll, ist es das richtige Kriterium — dort ist es notiert.

## 2026-09-09 · Die Schwelle war nicht das Problem (ROADMAP 5.4a, 6.10)

Julian, auf die Jahrzehnte-Seite: „für decades-seite sollte die faltung-schwelle hochgesetzt werden. hier fallen ähnliche cover schneller auf. oft sind es gleiche cover nur mit einer anderen grundfarbe des scans. das ist auch ein problem für die generelle faltung."

**Die Beobachtung stimmt, die Diagnose lag daneben — und zwar zu unseren Ungunsten: die Seite faltete überhaupt nicht.** `dedupeCovers: false` stand seit der Reparatur vom selben Tag drin, weil serverseitiges Falten jedes Cover herunterlädt und hasht und die Seite damit in Produktion umbrachte. Was Julian sah, waren also nicht zu eng gefaltete Cover, sondern ungefaltete.

**Die Reparatur kostet keine einzige Anfrage.** Die Signaturen liegen längst auf der Platte: der gebaute Cover-Index (E18) kennt für die kuratierten Werke jedes Cover mit dHash, Kontrast und Farbe. `indexSignatures` in `lib/coverindex.ts` reicht sie heraus, die Seite faltet damit nach derselben Regel wie die Wand — ohne Bild, ohne Decoder, ohne Netz. Gemessen: *Brave New World* 148 → 114 Kacheln, *Lolita* 121 → 94, *Der Proceß* 135 → 123, *Gravity's Rainbow* 27 → 22. Die Signaturabdeckung ist praktisch vollständig (135/135, 148/148, 121/121), weil der Index mehr Cover kennt, als die Seite lädt.

Ein Cover, das der Index nicht kennt, behält seine Kachel. Das ist eine Lücke und wird nicht als Einzigartigkeit ausgegeben (N12).

### Und die Schwelle selbst? Gemessen, und sie bleibt

Die eigentliche Frage — lässt sich die 8 anheben oder der Hash gegen den Scan-Grundton unempfindlich machen — hat ein eigenes Experiment bekommen ([lab/fold](../lab/fold/README.md)), weil sie die ganze Seite betrifft und nicht nur diese eine.

**Erst die Verteilung:** über 846.779 Paare innerhalb eines Werks liegen 0,7 % unter Abstand 8, 0,4 % bei 9–12, 1,1 % bei 13–16.

**Dann der Blick,** zwanzig Paare aus den beiden interessanten Bändern, von Hand einsortiert: sieben gleiche Gestaltung, zehn verschiedene, drei nicht beurteilbar. Julians Fall steht im Material — *The Outsider* bei Abstand 11 mit Scan-Helligkeit 53 gegen 29, *Catch-22* bei 12 mit 52 gegen 42, *The Catcher in the Rye* bei 16 als dieselbe Illustration einmal rot und einmal orange. **Aber in denselben Bändern liegen echte Unterschiede:** *Herr der Ringe* gegen *Lord of the Rings* bei 11, zwei verschiedene *Lord of the Flies* bei 12, zwei verschiedene *Siddhartha*-Umschläge bei 14.

**Kein Maß trennt die sieben von den zehn:**

| Maß | gleiche, schlechtestes | verschiedene, bestes | trennt? |
|---|---|---|---|
| dHash wie bisher | 21 | 10 | nein |
| nach Autokontrast | 23 | 13 | nein |
| nach Histogrammausgleich | 18 | 11 | nein |
| Rauschmaske über den Bits | 64 | 0 | nein, schlechter |
| 16×16 statt 8×8 | 0,422 | 0,152 | nein |
| 32×32 | 0,435 | 0,227 | nein |
| Farbschranke 4×4 RGB | 0,303 | 0,055 | nein |

Die Rauschmaske — nur Bits zählen, bei denen beide Bilder einen deutlichen Helligkeitssprung hatten — schadet sogar: auf flächigen Umschlägen bleibt kein sicheres Bit übrig, bei drei Paaren null, und dann meldet das Maß 0 oder 64 statt einer Aussage.

**Also bleibt die 8, und oberhalb entscheidet weiter die Metadatenlage** (ISBN, Verlag, Jahr) statt des Abstands. Das war schon der Befund vom 2026-09-07; neu ist, dass jetzt auch die naheliegenden Auswege durchgemessen und ausgeschlossen sind. Wer es besser machen will, braucht einen anderen Deskriptor — und zuerst mehr als siebzehn beurteilte Paare.

**Die Lehre:** eine Beobachtung am Bildschirm ist ein verlässlicher Hinweis darauf, *dass* etwas nicht stimmt, und ein unzuverlässiger darauf, *warum*. Hier wäre das Anheben der Schwelle nicht nur wirkungslos gewesen — es hätte echte Unterschiede zusammengefaltet, während die eigentliche Ursache stehen bleibt.

## 2026-09-09 · Was das Falten die Jahrzehnte-Seiten kostet (ROADMAP 5.4a)

Nachdem die Seite faltet, entscheidet die Schwelle über die **gefalteten** Zahlen — über die, die der Leser sieht, nicht über die Zahl der Datensätze. Der Kandidatenlauf wurde deshalb wiederholt: **84 der 105 kuratierten Werke tragen eine Seite, 21 nicht.** Sechs Werke sind unter die Schwelle gerutscht; sie hätten vorher eine Seite bekommen, auf der ein Teil der zwanzig Kacheln dasselbe Cover zweimal gewesen wäre. Die Sitemap steht damit bei **193** Adressen statt 199.

**Ein Fund im Lauf, der wichtiger ist als die Zahl.** Bei *White Noise* antwortete Open Library dreimal hintereinander nicht — und das Werk fiel damit aus der Liste, aus einem Grund, der nichts mit seinen Daten zu tun hat. Es wäre still aus der Sitemap verschwunden, und niemand hätte gesehen, warum. Das ist genau der Fehler, den CLAUDE.md verbietet: **ein Ausfall darf nicht als Befund erscheinen.**

`scripts/find-decade-pages.ts` liest jetzt die vorherige Liste ein, bevor er sie überschreibt: ein Werk, dessen Katalog schweigt, **behält seinen alten Eintrag**, und nur ein Werk, das geantwortet hat, kann seine Seite verlieren. Der Lauf sagt am Ende, wie viele Einträge so übernommen wurden. *White Noise* selbst steht mit den Zahlen drin, die sich vor dem Ausfall messen ließen (23 Cover gefaltet auf 22, weiterhin 4 Jahrzehnte).

Geprüft, dass Liste, Sitemap und Seite dieselbe Rechnung machen: kein Eintrag unter der Schwelle, keiner außerhalb der Kuration, keiner ohne Signaturen im Index, keine Dublette.

## 2026-09-09 · Ein Drittel des Buchs, einen Tag lang festgehalten (ROADMAP 5.4a)

Die Prüfung nach dem Deploy: 404 für die sechs abgefallenen Werke wie vorgesehen, Sitemap mit 193 Adressen und 84 Jahrzehnte-Seiten, keine der abgefallenen mehr darin. Aber *Brave New World* rendert in Produktion **36 Cover aus 41 Ausgaben-Datensätzen**, wo lokal 114 aus 130 stehen.

**Das ist mein eigener Fix von heute früh, eine Ebene weiter.** Damals warf der Ladepfad das ganze Werk weg, sobald eine spätere Ausgabenseite nicht antwortete — das ergab den 404. Seitdem endet der Lauf mit dem, was angekommen ist. Eine Ausgabenseite umfasst 100 Datensätze, 41 Ausgaben heißt also: **Seite 0 kam an, die zweite nicht**, und der Lauf gab auf. `revalidate = 86400` hat dieses Drittel dann für einen Tag eingefroren.

Der Fehler war nicht, mit Teildaten weiterzumachen — das ist richtig. Der Fehler war, **beim ersten Nein aufzugeben**: der Client versucht es seit 1.10 ein zweites Mal, der Server nicht. Open Library antwortet aus Frankfurt oft genug jenseits der 12 s, dass ein einziger Versuch nichts misst. `fetchPageWithRetry` holt eine gescheiterte Seite nach 2 s noch einmal, bevor der Lauf endet; ein Test hält fest, dass ein einzelner Fehlschlag den Lauf nicht mehr verkürzt.

**Was daran offen bleibt:** die Liste in `data/decade-pages.json` sagt für dieses Werk 114 Cover, die Seite zeigte 36. Die Schwelle wurde also über Daten entschieden, die der Leser nicht sah. Solange das nur die angezeigte Menge betrifft, ist es eine dünne Seite und keine Unwahrheit — die Kopfzeile zählt, was sie hat. Fällt ein Lauf aber so weit zurück, dass die Seite unter die Schwelle rutscht, antwortet sie 404, obwohl die Sitemap sie führt. **Der Wiederholungsversuch macht das unwahrscheinlicher, nicht unmöglich.** Der saubere Weg wäre, dass `getWorkDetail` sagt, ob der Lauf vollständig war, und ein unvollständiger Lauf nicht für 24 Stunden gecacht wird.

## 2026-09-09 · Nach dem Deploy: was die Reparaturen in Produktion tun (ROADMAP 5.4a)

Zwei Dinge waren lokal nicht beweisbar und wurden nach dem Deploy je **einmal** geprüft.

**Der abgebrochene Ausgabenlauf ist geheilt.** *Brave New World* rendert jetzt **114 Cover aus 130 Ausgaben-Datensätzen** — genau die lokale Zahl. Vor dem Deploy waren es 36 aus 41, weil der Lauf bei der ersten stummen Seite aufgab und ISR das für einen Tag festhielt. Der zweite Versuch je Seite (`fetchPageWithRetry`) trägt also in genau der Lage, für die er gebaut wurde. Die Seite antwortet in 6,9 s.

Im selben Abruf mitbestätigt: die Jahrzehnte laufen **„2020s back to 1930s"**, und im ausgelieferten HTML steht „Sorting these covers by decade" — die Ladeseite wird vor dem Seiteninhalt ausgeliefert, wie vorgesehen.

**Das Vorladen bei Absicht greift.** Vor dem Hover kein einziger Request auf `/book/<id>/decades`; sobald der Mauszeiger auf dem Link liegt: `GET /book/OL64365W/decades?_rsc=… → 200`. Damit ist beides belegt — Nexts automatisches Vorladen ist aus, und der Hover ersetzt es. Auf einem Telefon meldet `matchMedia('(hover: hover) and (pointer: fine)')` false (unter Emulation geprüft, 5 Berührungspunkte), der Handler steigt vor der Anfrage aus.

**Ein Fehler von mir beim Messen, der hierher gehört:** der erste Produktionsaufruf lief acht Minuten ohne Antwort, und ich hielt das kurz für ein Problem der Seite. Es war mein `curl` ohne `--max-time`, gestartet bevor der Deploy fertig war. Mit Zeitgrenze antwortete dieselbe Adresse in 6,9 s. Ein Messwerkzeug ohne Timeout misst nicht die Seite, sondern sich selbst.

## 2026-09-09 · Die Liste, auf die die Seite zeigt, wächst jetzt aus dem Betrieb (ROADMAP 5.1, 5.4a)

Julians Frage, aus der das hier entstand: für welche Werke wird eine Jahrzehnte-Seite gebaut — nur für die kuratierten, oder auch für ein Buch, bei dem sich nach einer Suche herausstellt, dass genug Cover da sind?

**Die Antwort war überraschend: für alle, aber sichtbar nur für wenige.** Die Route rechnet die Schwelle beim Laden aus und liefert die Seite jedem Werk, das sie trägt. *Nineteen Eighty-Four* hatte damit längst eine Seite mit 224 Covern über neun Jahrzehnte — und *Pride and Prejudice* eine mit 114 über zehn —, nur zeigte nichts darauf. Kein Link, kein Sitemap-Eintrag. Die vorab gemessene Liste entschied nicht, **ob** es die Seite gibt, sondern nur, **wo wir darauf zeigen.**

**Der Link folgt jetzt den Daten statt der Liste** (Julian: „der link soll natürlich immer gezeigt werden, wenn eine decade wall möglich ist"). Der Browser hat ohnehin jede Seite des Werks geladen und jedes Cover gefaltet, also wendet er dieselbe Schwellenfunktion an wie die Seite selbst — `lib/decades.ts` ist rein und ohne I/O, es gibt also keine zweite Regel, die auseinanderlaufen könnte. Kosten: keine Anfrage. Zwei Bedingungen halten ihn ehrlich: die vorab gemessene Liste bleibt als Schnellweg, damit ein bekanntes Werk den Link sofort zeigt statt nach dem vollen Durchlauf, und der gerechnete Fall greift **erst wenn der Durchlauf fertig ist** — eine halb geladene Wand kann die Schwelle vorübergehend reißen und auf einen 404 zeigen. Geprüft: *1984* bekommt den Link nach 3 s, *Mumbo Jumbo* mit 12 Covern bekommt keinen.

**Beförderung ist jetzt ein Befehl.** `scripts/promote.ts` nimmt Work-IDs und macht die drei Schritte, die nötig sind, damit eine Adresse etwas taugt: das Werk kommt in `data/index-works.json`, seine Cover-Signaturen werden gebaut, und die Schwelle wird gemessen. Schritt 2 ist der, den man vergisst — **ein Werk ohne Signaturen faltet nichts** und zeigt auf seiner Jahrzehnte-Seite genau die Dubletten, die am selben Tag abgestellt wurden. Deshalb sind Indexliste und Publikationsliste seit heute **dieselbe Datei** (`lib/published.ts`), und ein Test hält fest, dass kein veröffentlichtes Werk ohne Signaturen ist.

**Was der erste Lauf brachte:** die Sitemap wächst von 193 auf **253 Adressen** — 139 Werkseiten statt 105, **110 Jahrzehnte-Seiten statt 84**. Von 139 Werken tragen 110 eine Seite, 29 sind zu dünn, und der Katalog schwieg bei keinem. *White Noise*, das im Lauf davor an einem Timeout ausfiel und von Hand mit abgeleiteten Zahlen wieder eingesetzt wurde, ist diesmal echt gemessen worden — 22 Cover über 4 Jahrzehnte, exakt die abgeleiteten Werte.

**Kosten, gemessen:** 6,4 KB je Werk im Cover-Index (890 KB bei 139 Werken, also rund 3 MB bei fünfhundert), 156 Byte je Jahrzehnte-Eintrag, eine Open-Library-Anfrage je neuem Werk für den Titel, **keine Google-Anfrage** (E10). Der Index geht nie an den Browser; er wird serverseitig einmal in typisierte Arrays entpackt. Ab etwa tausend Werken (6 MB) wäre das neu zu bewerten.

**Was noch fehlt, damit die Schleife sich schließt:** die Quelle. Vercel Web Analytics zählt Pfade, also `/book/<id>`, 30 Tage weit — daraus ließe sich lesen, welche Bücher tatsächlich gesucht werden. Nur gibt es dafür heute keinen Verkehr. Bis dahin bleibt der Weg aus 5.1 der tragende: Werke nach Katalogpopularität wählen, was keinen Besucher braucht.

## 2026-09-09 · Ein Durchgang durch die Roadmap nach Funktionsverbesserungen

Julian: „geh die Roadmap durch und suche Funktionsverbesserungen, die wir angehen können." Kein Bau, eine Sichtung — mit der Regel, dass jede genannte Ursache im Code nachgesehen wird, statt die Roadmap nachzuerzählen. Das Ergebnis, die gefilterte Reihenfolge, steht in [ROADMAP.md](../ROADMAP.md) unter „Dieselbe Liste, gefiltert auf Funktionsverbesserungen". Hier steht nur, was beim Nachsehen dazukam.

**Vier Ursachen im Code verortet**, alle vorher nur als Beobachtung notiert:

| Punkt | Was der Code sagt |
|---|---|
| 6.15 (Titelanzeige) | Die Bereinigung existiert, aber nur für den Vergleich: `stripTrailingBrackets` ist modulprivat in `lib/normalize.ts` und wird allein von `normalizeTitle` benutzt. Der Anzeigeweg reicht den Rohtitel durch |
| 6.14 (gefaltete Cover) | Das „+N" ist `components/CoverGallery.tsx:103`, ein `pointer-events-none`-Span mit einem `title`-Attribut als einziger Auskunft — auf dem Telefon also gar keiner |
| 6.5 (Mosaik-Ausfall) | `components/useCardCovers.ts` fängt jeden Fehler in ein leeres `catch` mit dem Kommentar „never surface it" und kennt keinen zweiten Versuch. Die Wiederholung aus 1.10 sitzt allein in `searchWorks` |
| 6.12 (Signaturen) | `lib/coverhash.ts:26` ist eine nackte Modul-`Map`, ohne Obergrenze und ohne Anbindung an den Next-Datencache — wie in PLAN-speicher beschrieben, jetzt an der Zeile belegt |

**Der Gatsby-Titel ist live bestätigt.** `openlibrary.org/works/OL468431W.json` trägt als Titel wörtlich `The Great Gatsby(Published In 1925)`, samt fehlendem Leerzeichen. Das ist der erste Satz, den ein Besucher auf dem meistbenutzten Testwerk der Spec liest.

**Und der Abruf dazu ist selbst eine Messung:** der erste Versuch antwortete **503**, der zweite unmittelbar danach **200**. Zwei Abrufe sind keine Quote, aber es ist dasselbe Muster wie am 2026-09-08 bei 1.10 — Open Library fällt in Episoden aus, nicht mit einer Rate, und ein zweiter Versuch trägt darüber hinweg. Für 0.10 zählt das als weiterer Beleg, dass die Ausfallquote nur über Wochen zu haben ist und nicht in einer Sitzung.

**Was die Sichtung nicht ergeben hat:** keinen neuen Punkt. Alles, was der Durchgang fand, stand bereits irgendwo in der Roadmap — was für den Zustand der Liste spricht und dagegen, sie weiter zu verlängern, bevor die vorderen Punkte gebaut sind.

## 2026-09-09 · Die Spalte, die einer türkischen ISBN fünf amerikanische Läden anbot (ROADMAP 1.11 und 1.2)

Zwei Punkte, eine Sitzung, weil der eine den anderen zur Hälfte erledigt: 1.11 wollte die Kauf-Links irgendwohin führen lassen, 1.2 wollte sie überhaupt sichtbar machen. Gebaut nach [PLAN-1.11](plans/PLAN-1.11-kauflinks-ux.md), mit einer Abweichung und einem Fund.

### Was die ISBN vorher weiß

`registrationArea` (lib/normalize.ts) liest die Registrierungsgruppe aus der Nummer — 978-3 deutschsprachig, 978-975 und 978-9944 Türkei, 979-8 Amazons eigener Bereich. Eine Tabelle, offline, keine Anfrage. Sie beantwortet genau eine Frage: gehört diese Nummer in den Markt des Lesers? Alles Weitere entscheidet `linkPlan` (lib/linkplan.ts) in vier Fällen statt der drei des Plans:

| Fall | Vorn | Warum |
|---|---|---|
| `home` | Bookshop.org, Amazon (DE: Thalia, Amazon) | Die Nummer gehört hierher, die Läden haben eine Chance |
| `foreign` | AbeBooks, eBay (DE: Booklooker), als **Titel**-Suche mit Verlag und Jahr | Marktplätze führen Angebote von überall, und antiquarische Angebote tragen oft gar keine ISBN — dann ist Titel + Verlag + Jahr die bessere Frage |
| `kdp` | Amazon | **Neu gegenüber dem Plan.** 182 der 526 gemessenen ISBNs sind 979-8, Amazons eigener Print-on-Demand-Bereich. Als `foreign` behandelt hätten sie AbeBooks und eBay bekommen — also die zwei Läden, die solche Titel gerade nicht führen |
| `no-isbn` | Titelsuchen | 7 % der Cover-Ausgaben |

Der Satz, der die Reihenfolge begründet, nennt eine Tatsache über die Nummer und **nie** etwas über einen Laden: „This printing's ISBN was registered in India. Marketplaces that list copies from anywhere come first; no shop was asked." Das ist dieselbe Grenze, die `lib/verdicts.ts` eine Ebene höher zieht.

### Julians Entscheidung, und was sie am Entwurf änderte

Auf die Frage, ob es die Zone „Or read it in another edition" geben soll: *„wenn es aber die Möglichkeit gibt, einen Affiliate-Link zu setzen zu genau dieser Edition, sollte das Vorrang haben. ansonsten füge aber die Option unter der Trennlinie hinzu wie vorgeschlagen."*

Das ist schärfer als der Plan und hat ihn vereinfacht. Die Zone erscheint **nur** bei `foreign` und `no-isbn` — genau dann, wenn kein provisionsfähiger Link auf diese Ausgabe möglich ist. Und weil die Läden des Marktes dann dort stehen, verschwindet ihr ISBN-Link aus der Klappe, statt daneben ein zweites Mal mit demselben Etikett zu erscheinen. Damit löst sich die Regel „ein Label steht genau einmal" ohne Ausnahme auf; ein Test prüft sie über zwölf Kombinationen aus ISBN und Markt.

Was dabei **nicht** verlorengeht, prüft ein zweiter Test: jeder Händler, den die Tabelle für einen Markt kennt, ist in jedem Fall irgendwo erreichbar. Verschoben wird, nicht versteckt.

### Der Fund, der die Zone beinahe wertlos gemacht hätte

Beim ersten Blick auf die fertige Spalte stand dort: *These search for „The Great Gatsby(Published In 1925)" by title.* Der Werktitel von OL468431W lautet bei Open Library wörtlich so, samt fehlendem Leerzeichen — und wäre als Suchabfrage bei Bookshop.org gelandet, wo er null Treffer ergibt. Die Bereinigung existierte längst, aber modulprivat und nur für den **Vergleich**: `stripTrailingBrackets` wurde allein von `normalizeTitle` benutzt. Jetzt gibt es `displayTitle`, und die Suchabfrage benutzt sie. Der Seitenkopf zeigt den Rohtitel weiterhin — das ist 6.15 und bekommt einen eigenen Commit.

### Die Messung, die 1.2 abschließt

Bei 1440 × 900, gegen `npm run dev`:

| | Inhalt der Spalte | erster Kauf-Knopf, Seite oben | angeheftete Leiste |
|---|---|---|---|
| *Beloved*, vorher | 2.351 px | 437 px **unter** der Fensterkante | — |
| *Beloved*, jetzt | **851 px** | y = 870 von 900 | 828 |
| *Wolf Hall*, vorher | 1.256 px | 151 px **unter** der Kante | — |
| *Wolf Hall*, jetzt | **766 px** | y = 847 von 900 | 586 |
| *Gatsby*, indische ISBN, Verdikt `differs` | 959 px | y = 945, also 45 px darunter | 692 |

Sichtbare Bedienelemente in der Spalte: **5 statt 14** (Marktumschalter, zwei bis drei Läden, die Klappe). Auf dem Telefon steht der erste Knopf in der Schublade bei y = 565 von 812, also **ohne zu scrollen** — der Teil von 1.2, den die Peek-Leiste nicht löste.

**Zwei Eingriffe waren nötig, nicht einer.** Die Kürzung des Blocks allein brachte den Knopf bei *Beloved* von 437 px unter der Kante auf 105 px darunter; erst die Deckelung des Covers auf 31vh Breite (46vh Höhe) holte ihn ins Fenster. In einer 400 px breiten Spalte war das Bild 600 px hoch und damit für sich genommen größer als der ganze übrige Block. Der schlechteste Fall bleibt eine Seite mit zweizeiliger Sprachleiste, langem Titel und `differs`-Verdikt: dort fehlen bei ganz oben stehender Seite noch 45 px. Sobald der Leser in die Wand gescrollt hat — und ohne das klickt er kein Cover an — ist die Leiste angeheftet und alles steht.

### Was offen bleibt

Die Zuordnung im Fall `foreign` ruht auf einer begründeten, nicht belegten Annahme: dass Bookshop.org und ThriftBooks fremdsprachige ISBNs nicht führen und Amazons `/dp/` bei einer nie geführten ISBN ins Leere geht. Das ist Julians Stichprobe von Hand aus Plan §7, zehn Minuten, zusammen mit 1.8. Fällt sie anders aus, ändert sich `CATALOGUE_SHOPS` in `lib/linkplan.ts` und sonst nichts — der Aufbau hängt nicht daran.

Ebenfalls notiert: die Links der Zone B laufen **nicht** über `/go/`, weil dort keine ISBN steht, gegen die gezählt werden könnte. Für 3.1 heißt das, dass diese Klicks heute unsichtbar sind. Und für Bookshop.org ist kein Affiliate-Format für eine Suchseite bekannt — nur `/a/<id>/<isbn>`, das eine ISBN braucht; die Zeile trägt dort bis auf Weiteres keinen Parameter (gehört zu 4.1).

### Nachtrag am selben Tag: was Julian an der fertigen Spalte sah

Zwei Korrekturen, beide aus einem Blick auf den gebauten Zustand, und eine davon repariert etwas, das der Umbau selbst kaputt gemacht hatte.

**1. Bei `differs` führen wieder die Suchen — und zwar ganz.** Julian: *„dann müssen suchen mit autor und jahr leichter vorgeschlagen werden als nur zig buttons wo immer ein anderes cover dahinter liegt."* Der Hinweis stand daneben und sagte „To get the one on screen, look for Vintage 1999 second-hand", und darunter standen Bookshop.org und Amazon — Links, die genau das andere Cover liefern. Vor dem Umbau hatte `EditionBlock` bei `differs` die Such-Links über die Kauf-Links geschoben (`buyFirst`); in `linkPlan` war davon nur noch Google Lens in der ersten Reihe übrig. **Das war eine Regression gegen SPEC F2.9**, eingeführt am selben Tag und nach einer Stunde wieder heraus.

Jetzt ersetzt `differs` die erste Reihe vollständig: AbeBooks und eBay mit Titel, Autor, Verlag und Jahr, dazu Google Lens. Die Händler stehen hinter der Klappe, die Überschrift heißt „Find the cover you picked", und der Verdikt-Hinweis steht **über** der Reihe statt darunter — er ist ihr Grund, nicht ihre Fußnote. Sein letzter Satz zeigt dorthin: „The searches below look for Vintage 1999 second-hand instead."

Mitgeliefert: **Hebel 4 aus ROADMAP 1.11, den der erste Umbau übersehen hatte.** Bei `unknown` — Google führt zu dieser Nummer gar kein Bild — hängt sich die antiquarische Suche hinten an die Reihe. Nur die Reihenfolge, kein Satz; „unknown" heißt weiterhin nicht „nicht zu kaufen".

**2. Die Ausgabe mit dem passenden Cover steht vorn, nicht die neueste.** Julian: *„die version die das gleiche aktuelle cover hat wie die isbn sollte zuerst vorgeschlagen werden, nicht nach jahr sortiert."* Der Fall aus seinem Screenshot: ein gefaltetes Cover von *Beloved* trägt Vintage International 2025 und 2004; die Sortierung nach Jahr stellte 2025 voran, und es ist die **2004er** ISBN, zu der der Verlag dieses Bild führt.

`orderEditionsForMarket` sortiert deshalb zuerst nach dem Verdikt (`verified` vor allem, `differs` zuletzt), dann nach Markt und Jahr. **Das Verdikt schlägt den Markt**, und das ist die eigentliche Entscheidung dahinter: der Leser hat ein Bild angeklickt, nicht eine Kaufgelegenheit, also ist der Druck, der dieses Bild trägt, die ehrliche Voreinstellung — auch wenn seine ISBN aus einem anderen Sprachraum kommt und die Händlerreihenfolge sich daraufhin umstellt. Der Preis ist, dass die Chip-Reihe sich einmal umsortiert, wenn die Verdikte eintreffen; `pending` und `unavailable` bewegen deshalb nichts.

**Live geprüft** an *Beloved* über die ersten fünf Cover: `verified` führt mit Bookshop.org und Amazon, `differs` mit AbeBooks, eBay und Google Lens. Die Chip-Reihenfolge ließ sich am Dev-Server **nicht** live nachstellen — auf einer kalten Instanz trägt kein Cover mehr als eine Ausgabe, weil die Faltung Signaturen braucht, die erst beim zweiten Besuch da sind (SPEC §7). Sie ist durch Unit-Tests mit genau dem Vintage-Fall belegt.

## 2026-09-09 · Ein Cover, das man nicht sehen konnte, und eines, das man zu groß sah (ROADMAP 6.14 und 6.10a)

Zwei kleine Punkte aus einem Screenshot, und der kleinere von beiden hat die Sortierfrage vom Vormittag erst wirklich beantwortet.

### 6.10a — die unscharfe Riesenkachel

„Looks like this" gibt jeder Kachel `min-w-0 flex-1`. Bei drei Treffern ist das ein Drittel der Spalte, bei **einem** die ganze — rund 370 px bei 1440 —, und das Bild dahinter ist Open Librarys `-S`-Miniatur mit etwa 45 px. `CoverImage` läuft mit `unoptimized`, `sizes="80px"` ist also nur eine Angabe an den Browser und ändert die geladene Datei nicht. Auf einer Seite, die vom Aussehen der Cover handelt, ist das kein Schönheitsfehler.

Jetzt drei feste Spalten und `-M` (180 px) als Quelle. **Gemessen bei 1440 × 900:** die Kachel eines einzelnen Treffers ist **118 px** breit in einer 373 px breiten Spalte. Der Titel unter der Kachel war entgegen der ersten Vermutung immer da — live gesehen „Cien años de soledad", genau der Treffer aus dem Screenshot; er ging im unscharfen Bild unter.

**Der zweite Befund aus demselben Screenshot ließ sich nicht reproduzieren, und die naheliegende Vermutung ist widerlegt.** Die Spalte zeigte dort gar keinen Ausgaben-Block. Vermutet hatte ich Cover, deren `editionIds` ins Leere zeigen — namentlich die, die die ISBN-Nachschau nachträglich in die Wand setzt. Gemessen: über alle fünf Seiten von *Beloved* **0 von 66** Covern ohne auflösbare Ausgabe; und `useIsbnCovers` überspringt ohnehin jedes Cover, dem keine Ausgabe zugeordnet ist. 14 Cover im Browser durchgeklickt, der Block erschien jedes Mal. Der Punkt bleibt in 6.10a offen, mit dem, was ausgeschlossen ist — das ist mehr wert als eine plausible Ursache, die nicht stimmt.

### 6.14 — ein gefaltetes Cover war nirgends zu sehen

Das Falten ist auf der Wand richtig; ohne es besteht *The Great Gatsby* aus 293 fast gleichen Kacheln. Aber es war einseitig: das „+N" auf der Kachel ist `pointer-events-none`, die Seitenleiste erwähnte nur eine Zahl im Vorbeigehen, und `coverForId` löst die ID eines gefalteten Covers auf den Vertreter auf — auch ein von Hand geschriebenes `?cover=` kam nicht hin. Das ist genau, was E16 eine Ursache weiter verbietet.

Der Weg ist **nicht** das Abzeichen geworden, sondern die Seitenleiste: unter dem großen Cover steht „The same cover, N scans" mit allen Scans als kleinen Kacheln, der Vertreter zuerst, die gewählte mit Ring. Ein Klick tauscht das große Bild. Die Bild-URLs werden aus den Cover-IDs neu gebaut (`coverUrlFor`, rein), es musste nichts durchs Modell getragen werden. Und die Zeile „Image from …" nennt jetzt die Quelle **des gezeigten Scans**: an *Gatsby* live gesehen, wo ein Google-Cover in ein Open-Library-Cover gefaltet ist und die Zeile beim Umschalten mitwechselt.

### Dabei kam heraus, dass die Sortierung vom Vormittag den gemeldeten Fall gar nicht traf

Julians Fall war *Beloved*: eine gefaltete Kachel mit Vintage International 2025 und 2004, 2025 vorn. Am Vormittag hatte ich das Verdikt vor das Jahr gestellt — „die Ausgabe, deren registriertes Bild dieses Cover ist, zuerst". Beim Nachmessen am Dev-Server stellte sich heraus: **beide Datensätze führen dieselbe ISBN, 9781400033416.** Also dasselbe Verdikt, und das Jahr entschied weiter. Die Regel war richtig gemeint und für diesen Fall wirkungslos.

Was die beiden trennt, ist etwas anderes: **wer den gezeigten Scan vor dem Falten getragen hat.** `foldDuplicateCovers` hängt die Ausgaben der Mitglieder an den Vertreter, danach nennt eine Kachel Drucke, die dieses Bild nie hatten. `buildWall` merkt sich das jetzt vor dem Falten, und `orderEditionsForMarket` sortiert danach — vor dem Verdikt, vor dem Markt, vor dem Jahr.

Damit folgt der führende Druck dem Bild. Live gemessen an derselben Kachel:

| | Chips | gezeigte Ausgabe |
|---|---|---|
| Scan 1 (Vertreter) | Vintage International · 2025 ←, · 2004 | 2025 |
| Scan 2 angeklickt | Vintage International · 2004 ←, · 2025 | 2004, mit eigener ISBN und eigenen Links |

Die drei Vintage-Datensätze, die das erklären (aus der API geholt): 2025 unter 9781400033416 trägt `ol:15248310` und `ol:15169554`; 2004 unter 9780307388629 trägt `ol:14342620` und `gb:sfmp6gjZGP8C`; ein zweiter 2004er unter derselben ISBN wie 2025 trägt `ol:10653442`. Ein Katalog, in dem dasselbe Buch dreimal steht, zweimal mit derselben Nummer und verschiedenen Jahren — das ist der Normalfall, nicht die Ausnahme, und jede Sortierregel muss damit rechnen.

**Nebenbei gelernt, für die nächste Sitzung:** die Faltung ist am Dev-Server nicht verlässlich zu sehen. Beim ersten Laden eines Werks faltet sie nichts, weil die Signaturen das 4-Sekunden-Budget nicht schaffen; erst nach mehreren Besuchen desselben Werks erscheinen die „+N"-Abzeichen. Wer 6.14 oder 6.7 prüft, lädt die Seite ein paarmal, bevor er misst.

## 2026-09-09 · Ein Bild in sechzehn Sekunden (ROADMAP 1.3)

Der Punkt verlangte eine Messung vorab — „wie viele verschiedene Bilder lädt eine Detailseite, damit das Kontingent der Optimierung nicht die nächste Grenze wird". Die Antwort hat die Entscheidung allein getroffen.

**Gemessen aus Deutschland, 2026-09-09**, an einer kalten Detailseite von *The Great Gatsby*:

| | |
|---|---|
| Verschiedene Bilder, die die Seite anfordert | **151** — 146 von `covers.openlibrary.org`, 5 von Google |
| Größe je Bild (`-M.jpg`) | 12–29 KB |
| **Zeit für ein einzelnes Bild** | **5,9 / 6,0 / 9,5 / 10,8 / 13,7 / 16,0 s** (sechs Abrufe) |
| `-L.jpg`, zum Vergleich | 24–79 KB, 2,5–2,9 s |

Damit war die zweite Option des Punkts erledigt, ohne dass ein Preisblatt nötig war: 151 Quellbilder je Detailseite verbrauchen das Transformationskontingent des Hobby-Plans in wenigen Aufrufen — und die Cover werden ohnehin in der Größe geholt, in der sie stehen, es gäbe also nichts zu transformieren.

**Gebaut wurde die andere Option:** `/img/<S|M|L>/<ol-123|gb-abc>`, davor der CDN, 30 Tage `s-maxage`.

**Der Pfad trägt eine Cover-ID, keine URL**, und das ist die eigentliche Entwurfsentscheidung. Die Zieladresse baut `coverUrlFor` neu — dieselbe Regel, aus der `/go/[provider]/[isbn]` den Händler-Link aus der Tabelle statt aus der Anfrage baut. Ein Bild-Proxy, der eine URL aus der Anfrage nimmt, ist ein offener Proxy und lässt sich auf jedes Ziel im Netz richten.

Auf dem Rückweg schreibt `proxiedCoverSrc` nur Adressen um, die dieser Code selbst gebaut hat; alles andere läuft direkt weiter. **Ein Test hat dabei eine Unsauberkeit gefangen**, die ohne ihn lange unentdeckt geblieben wäre: die Breitenzuordnung für Google stand als `width >= 800 ? 'L'` da, hätte also eine `w999`-Adresse auf die Route abgebildet, die w800 ausliefert — ein anderes Bild unter derselben Adresse. Jetzt sind es exakt die drei Breiten, die dieser Code anfragt (128, 300, 800).

**Geprüft am Dev-Server:** alle 66 Bilder einer Gatsby-Seite kommen von der eigenen Herkunft, kein einziges mehr von einem fremden Host; die Antwort trägt `image/jpeg` und `public, max-age=3600, s-maxage=2592000, stale-while-revalidate=86400`. `/img/M/http-evil.example` antwortet 400, `/img/XL/ol-…` 400, eine unbekannte Cover-ID 502 — und Fehlschläge tragen `no-store`, weil ein schweigendes archive.org eine Episode ist und keine Tatsache über das Cover (dieselbe Regel wie F1.7).

**Was hier nicht zu messen war, und das ist der Punkt.** Lokal steht kein CDN vor der Route, ein zweiter Abruf dauert deshalb weiter rund 7 s. Der gesamte Gewinn liegt in Produktion, und dort ist er nach dem nächsten Deploy zu messen: der zweite Abruf desselben Covers muss `x-vercel-cache: HIT` tragen und zweistellige Millisekunden brauchen. **Bis dahin ist der Punkt gebaut, aber nicht belegt.** Die Kehrseite gehört mitgemessen: bei kaltem CDN sind 151 Bilder 151 Funktionsaufrufe — allerdings einmal für alle Leser, nicht je Leser.

## 2026-09-09 · Vier Färbungen derselben Wand, und ein Kontrast, der schon durchfällt (ROADMAP 6.22)

Julian: „mache screenshot mockups für 6.22." Gebaut als [`lab/palette/`](plans/../../lab/palette/README.md) — kein Vergleich von Farbfeldern, sondern **dieselbe Wand und dieselben Bedienelemente in jeder Färbung**, hell und dunkel nebeneinander, weil `prefers-color-scheme` beides ausliefert und ein Schema, das nur in einem Modus trägt, keins ist. Unter jeder Wand die Kontrasttabelle der Paare, die in der Oberfläche wirklich vorkommen.

Vier Kandidaten: **Heute** (Terrakotta, als Referenz), **Tinte** (gar keine Akzentfarbe — alle Farbe kommt von den Covern), **Indigo** (kühler Akzent auf demselben Papier), **Olive** (gedämpfter Akzent und kühleres Papier, der einzige, der die Grundfarbe anfasst). Drei lassen das Papier in Ruhe, weil der Hintergrund hinter hunderten Covern steht und Papierweiß genau dafür gewählt war. Entschieden ist nichts; die Wahl trifft Julian.

**Der Befund, der die Farbfrage überholt.** Beim ersten Lauf der Kontrasttabelle fiel eine Zeile für *alle* Kandidaten durch — auch für den heutigen Stand:

| | ink-3 auf bg | AA verlangt |
|---|---|---|
| hell (`#8c8377` auf `#f4f0e8`) | **3,28** | 4,5 |
| dunkel (`#7d7569` auf `#131110`) | **4,14** | 4,5 |

`ink-3` trägt die Metadatenzeilen und die Verdikt-Hinweise bei 11–12 px, die WCAG-Ausnahme für großen Text greift also nicht. Die nächstliegenden bestehenden Werte sind `#746c62` (4,55) und `#837b6f` (4,51) — kaum ein Schattenunterschied, weshalb es nie jemandem aufgefallen ist. **Das gehört korrigiert, unabhängig davon, welcher Akzent gewinnt.** Die drei Vorschläge tragen es bereits; „Heute" behält absichtlich den durchfallenden Wert, sonst zeigte die Tabelle nicht, was ausgeliefert wird.

Nebenbei hat die Tabelle mich selbst korrigiert: die erste Fassung prüfte auch `line auf bg` gegen eine erfundene Schwelle von 1,5 und meldete sie als Durchfaller. Eine 1-px-Trennlinie ist kein Text und keine bedeutungstragende Bedienelementgrenze; WCAG verlangt dafür nichts. Sie steht jetzt zur Anschauung da, nicht als Prüfung — sonst hätte ein erfundener Fehler den echten überdeckt.

**Was das Werkzeug kostet: nichts.** Die Cover kommen aus `data/cover-index.json`, es wird nichts gesucht und Google gar nicht gefragt (E10). Mit `--base http://localhost:3000/img` laufen die Bilder über die eigene Bildroute aus 1.3 und die Seite steht sofort; ohne sie lädt der Browser direkt von Open Library, was 6 bis 16 Sekunden je Bild dauern kann — das ist der Preis dafür, dass die committete Fassung ohne laufenden Server funktioniert. `--embed` legt die Bilder als Data-URIs hinein und macht die Datei verschickbar (2,6 MB).

### Nachtrag: ein sanfteres Terrakotta, und warum es dunkler sein muss

Julian am selben Tag: „baue ein sanfteres terrakotta." Der Ton ist `#945138` hell und `#dbac94` dunkel — Farbwinkel unverändert bei 16, Sättigung von 61 auf 45, Helligkeit von 43 auf 40. Erkennbar dasselbe Terrakotta, nur ohne die Schärfe.

**Dass es dabei dunkler wird, ist kein Geschmacksurteil, sondern Zwang.** Das heutige `#b1502b` hält mit **4,56** nur knapp WCAG AA auf Papier. Jedes reine Entsättigen fällt darunter, gemessen an vier Zwischenschritten:

| | Sättigung | Kontrast auf Papier |
|---|---|---|
| `#b1502b` (heute) | 61 | 4,56 |
| `#a85c40` | 45 | **4,33** |
| `#a1614a` | 37 | **4,27** |
| `#9d6552` | 31 | **4,18** |
| `#945138` (Vorschlag) | 45 | **5,29** |

Der Unterschied zwischen Zeile 2 und Zeile 5 ist allein die Helligkeit. Weicher geht also nur über sie — und der Umweg bringt dem Akzent zum ersten Mal Reserve statt der knappen 0,06 über der Schwelle. Wer den Ton später weiter beruhigen will, muss ihn weiter abdunkeln.

Nebenbei zeigt die Suche, warum „sanft" allein kein Ziel ist: die entsättigtsten Töne, die AA mit Reserve halten, liegen bei Sättigung 22 und Helligkeit 30 (`#5d413c` und Nachbarn) — die lesen sich nicht mehr als Terrakotta, sondern als Braun.

### Entschieden: das sanftere Terrakotta, und ink-3 dazu

Julian, 2026-09-09: „nimm das sanftere terrakotta und korrigiere ink-3." Ausgeliefert in `app/globals.css`:

| Token | vorher | jetzt | Kontrast vorher → jetzt |
|---|---|---|---|
| `--accent` hell | `#b1502b` | `#945138` | 4,56 → **5,29** |
| `--accent` dunkel | `#e6a677` | `#dbac94` | 9,04 → 9,27 |
| `--ink-3` hell | `#8c8377` | `#746c62` | **3,28** → 4,55 |
| `--ink-3` dunkel | `#7d7569` | `#837b6f` | **4,14** → 4,51 |

Grundfarbe, Flächen, Linien und Schriften bleiben, wie sie waren: die Frage war der Akzent, und die Wand bleibt die Bühne. Beide Modi im Browser nachgesehen — hell trägt `#945138` / `#746c62`, dunkel `#dbac94` / `#837b6f`.

**Der eigentliche Ertrag dieser Sitzung ist aber nicht die Farbe, sondern dass sie ab jetzt geprüft wird.** Die Rechnung ist von `lab/` nach `lib/contrast.ts` gewandert, und `lib/__tests__/contrast.test.ts` liest `app/globals.css` selbst — nicht eine Kopie der Werte, denn das Auseinanderlaufen von Kopie und Wirklichkeit war genau der Fehler bei `ink-3`. Geprüft werden sechs Paare in beiden Modi: `ink`, `ink-2` und `ink-3` auf dem Grund, der Akzent auf dem Grund, `on-accent` auf dem Akzent, und Text auf einer Kachel.

**Gegenprobe, damit der Test nicht hohl ist:** mit dem alten `#8c8377` wieder eingesetzt fällt er (`ink-3 on bg`, hell), mit dem neuen Wert steht er. Ein Test, der nie fehlschlagen kann, hätte hier gar nichts bewiesen.

Die Kandidaten in `lab/palette/` bleiben liegen; „Vorher" heißt jetzt, was es ist, und zeigt weiter seine rote Zeile — als Beleg dafür, wie lange so etwas unbemerkt bleibt, wenn niemand nachrechnet.

## 2026-09-09 · Zusammengeführt, und die Liste nachgezogen

Der Tagesstand (1.11, 1.2, 1.3, 6.10a, 6.14, 6.22) ist mit `main` zusammengeführt. Der Branch lag **7 Commits voraus und 12 zurück** — parallel war auf `main` die Jahrzehnte-Seite, der gedeckelte Cover-Index und `lab/fold` gelandet. Drei Konflikte, alle harmlos: `useWorkPages.ts` (dort war `progress` in `known` umbenannt worden, meine Zeile `anyEditionLinks` zieht mit), sowie `ROADMAP.md` und `docs/history.md`, wo beide Seiten angehängt hatten. `main` danach im Schnellvorlauf auf `b53818b`; **nicht gepusht**, weil ein Push in Produktion deployt und danach nicht gefragt war.

Nach dem Merge im Browser gegengeprüft, dass die beiden Stränge zusammenspielen: Seitenleiste mit neuem Akzent `#945138`, die Scan-Reihe aus 6.14, der Fremd-ISBN-Satz aus 1.11, alle 66 Bilder über die eigene Route aus 1.3 — und der Jahrzehnte-Link von `main`. 372 Tests grün.

**Beim Nachziehen der Empfehlungsliste sind zwei Punkte aufgefallen, die heute an Wert verloren haben, ohne dass jemand sie angefasst hat.** Das ist der Grund, eine solche Liste überhaupt nachzuziehen, statt sie stehen zu lassen:

- **6.12** („Signaturen überleben eine Serverinstanz nicht") war in der Vormittagsliste noch ein halber Tag Gewinn. Seit `5385ddd` liest `getWorkPage` die Signaturen aus dem gebauten Index — kostenlos, ohne ein Bild zu holen. Für kuratierte Werke, und das sind die in der Sitemap, ist der Punkt damit erledigt; offen bleibt er nur für Werke, die im Index fehlen. Ein Randfall, kein Hebel.
- **6.5, Teil `priority`**: die LCP-Warnungen zeigten auf `covers.openlibrary.org`. Seit 1.3 kommen die Bilder von der eigenen Herkunft mit CDN davor. Der Punkt ist damit **verschoben, nicht gelöst** — und vor dem Anfassen neu zu messen, sonst wird ein Problem behoben, das es so nicht mehr gibt.

**Was die Liste jetzt sagt:** Phase 1 ist bis auf 1.8 (Julian) und 1.9 leer, also ist 1.9 nach der eigenen Regel dieser Datei der nächste Punkt. Direkt danach steht kein Bau, sondern ein Deploy: **1.3 ist in Produktion überhaupt erst wirksam**, und die Zahl, die den Punkt belegt, kann nur dort entstehen.

## 2026-09-09 · Drei Ladebilder aus einem Bild (ROADMAP 6.19a)

Julians Vorschlag, die Suche mit dem Riesenmosaik warten zu lassen — „wie sich langsam das Bild von Orwell aus seinen Editionen aufbaut" — plus die Bitte, für **einen zweiten Autor** drei Animationen vorzuschlagen. Gebaut als `lab/loading/`, ausführlich in [lab/loading/README.md](../lab/loading/README.md); der Kontaktbogen mit allen drei Vorschlägen in je fünf Momenten liegt als `lab/loading/out/mark-twain-filmstrip.png`.

**Der zweite Autor ist Mark Twain**, und die Wahl ist kein Geschmack. Mit demselben Raster und denselben Einstellungen sitzt Twain bei einem mittleren Abstand von 470, Virginia Woolf bei 861 — 897 Kacheln aus acht Büchern gegen 335, und A. F. Bradleys Foto von 1907 hat echtes Schwarz und echtes Weiß, wo Beresfords Porträt von 1902 durchweg weich ist. Woolfs Gesicht ist in Ladebildgröße kaum zu lesen. **Ein Ladebild braucht mehr Kontrast als ein Plakat**, weil es klein ist und nach Sekunden vorbei.

**Der Weg ist nicht der Sprite-Streifen, den 6.19a empfahl, sondern ein JPEG plus Manifest.** Ein Bild, aus dem sich jede Animation zeichnen lässt: 105 KB bei 480 px (als PNG wären es 750 KB, als WebP 81 KB — ein Mosaik ist Rauschen, da hilft kein Format viel), 19 ms bis es dekodiert ist, **0,16 ms JavaScript je Bild** bei 1.480 Zellen, drei DOM-Knoten für alle drei Felder. Damit ist die Größenfrage beantwortet, die vor dem Punkt stand.

**Die drei Vorschläge und was sie unterscheidet, ist nicht ihr Ende, sondern ihr Abbruch.** *Rückzug* fährt die Kamera zurück, bis die Wand in ein Gesicht kippt (läuft ganz auf dem Compositor, kostet je Bild nichts). *Schwerste Zelle zuerst* spielt die Reihenfolge nach, in der das Mosaik gerechnet wurde — Extremwerte vor Mitteltönen —, sodass das Gesicht bei 30 % als Schatten dasteht, während die halbe Fläche leer ist. *Umsortieren* stellt die Wand sofort hin, aber falsch sortiert und gedimmt, und lässt eine Diagonale sie sortieren. Weil eine Suche im häufigsten Fall nach ein bis zwei Sekunden zurückkommt, entscheidet nicht das fertige Bild, sondern wie es mittendrin aussieht — und da ist nur die dritte zu jedem Zeitpunkt ein volles Bild. **Empfehlung: Nummer 3.**

**Drei Dinge, die beim Bauen falsch waren.** Bei 24 Spalten ist die Kachel ein erkennbares Buch und das Gesicht verschwunden; 40 sind das Minimum, bei dem beides geht. Bei Nummer 2 entscheidet der **Untergrund**, welche Hälfte man zuerst sieht — auf hellem Grund die dunklen Zellen (Haar, Augen, Schultern), im Dunkelmodus die hellen; dieselbe Animation, zwei Bilder. Und Nummer 3 war in der ersten Fassung schlicht unsichtbar: eine falsch sortierte Cover-Wand sieht aus wie eine richtig sortierte, bis das Bild fast vollständig ist. Erst das Dimmen des Unsortierten gibt der Welle eine Front.

**Zwei Nebenbefunde.** Die Reihenfolgen vorzurechnen kostet mehr, als es spart: 3,9 KB je Reihenfolge auf der Leitung gegen 0,92 ms einmaliges Sortieren im Browser — die Seite sollte die Helligkeitskarte schicken und selbst sortieren. Und das Browser-Pane führt **keine Animationsbilder aus, solange es verborgen ist**; alle drei Animationen sahen kaputt aus, ohne es zu sein. Die Vorschauseite hat deshalb einen Regler, der jeden Zeitpunkt deterministisch zeichnet — was die Vorschläge überhaupt erst vergleichbar macht.

**Nicht gebaut, mit Absicht:** nichts davon berührt die Website. Vor einer Umsetzung stehen die Rechtefrage aus 5.5 (ein abgeleitetes Werk aus fremden Covern als Seitenelement) und ein Einwand aus N12 — ein großes Porträt von Mark Twain, während jemand *East of Eden* sucht, ist ein Bild mit einem Gegenstand, und genau deshalb ist die heutige `AssemblingWall` klein, gedimmt und unbeschriftet.

## 2026-09-09 · Ein vierter Ladebildvorschlag, ohne Kante (ROADMAP 6.19a)

Julian zur dritten Animation: „kannst du Nummer 3 mal versuchen mit einem zufälligen Umsortieren? Weniger Kante im Effekt, sondern ein langsames Klären des Rauschens." Gebaut als **3b** neben die anderen drei, damit beide Fassungen von 3 nebeneinander stehen.

Dieselbe falsch sortierte Wand, aber die Kacheln rasten in **zufälliger** Reihenfolge ein, und die Dämpfung hebt sich mit dem Fortschritt. Damit läuft nichts mehr quer über das Bild; es wird nur klarer. **Zwei Dinge waren dafür nötig.** Die Kacheln rasten mit `1 − (1 − p)²` ein statt gleichmäßig — bei gleichmäßiger Rate sieht das erste Drittel aus wie der Anfang, und das erste Drittel ist genau der Bereich, in dem die meisten Suchen zurückkommen. Und ein **Zweitcanvas** hält den wahren Stand der Wand, während das sichtbare daraus plus Dämpfung gezeichnet wird; sonst hieße „die Dämpfung hebt sich" 1.480 Kacheln je Bild statt eines Bildes. Kosten: **0,29 ms JavaScript je Bild**, das teuerste der vier Verfahren und weiterhin unter 2 % dessen, was ein Bild bei 60 Hz hat.

**3b ersetzt 3 in der Empfehlung.** Beide halten die Fläche zu jedem Zeitpunkt voll, aber wenn die Suche mittendrin zurückkommt, bleibt bei 3 eine Diagonale stehen, die sichtbar unfertig ist; bei 3b bleibt ein leicht verrauschtes Bild, das niemand als Abbruch liest.

**Nebenbei, und der Grund für einen Umweg:** `openlibrary.org` war während des Umbaus eine Viertelstunde lang nicht erreichbar, während `covers.openlibrary.org` normal antwortete. Die Ausgabenseiten lagen im Cache, die Autorensuche nicht — sie ist der einzige Live-Aufruf eines Neubaus. Die fehlende Reihenfolge ließ sich aus dem Manifest nachrechnen, weil sie eine reine Funktion der Helligkeitskarte ist; danach wurde regulär neu gebaut. Wert zu wissen für später: **eine gecachte Autorensuche würde einen Neubau ganz vom Netz lösen.**

## 2026-09-09 · Zwanzig Ladebilder, und was ein Ladebild kosten darf (ROADMAP 6.19a)

Nachdem 3b gewählt war, Julians nächster Schritt: „baue damit 20 Vorlagen, die als Ladebildschirm verwendet werden können, nimm Rücksicht auf die anderen Bedingungen bei mobile und desktop und darauf dass es schnell und flüssig bleiben muss und wenig Traffic produzieren sollte." Ausführlich in [lab/loading/README.md](../lab/loading/README.md).

**Eingecheckt ist das Rezept, nicht das Ergebnis.** `lab/loading/templates.json` nennt zwanzig Autoren, das Wikidata-Objekt ihres Porträts, dessen Lizenz und den Ausschnitt, aus dem gebaut wird; die Bilder selbst entstehen mit einem Befehl neu. Fünf Megabyte abgeleiteter Cover-Bilder gehören nicht in ein Repository, solange die Rechtefrage aus 5.5 offen ist.

**Porträts lassen sich nicht raten.** Von 26 plausiblen Commons-Dateinamen, von Hand geschrieben, existierten **zwei**. Der Weg ist Wikidata: das Objekt des Autors, sein `P18`, und das Lizenzfeld von Commons dazu. Wer dort nicht als gemeinfrei steht, kommt nicht in die Rotation — beim Zielbild ist die Rechtelage unsere Sache, und eine zweite offene Frage neben den Covern wäre nachlässig. Vier bekannte Gesichter fielen heraus, weil ihr Porträt auf Commons nur als Daumennagel liegt: Kafka (330×440), Dickinson, Brontë, Tschechow.

**Der eine Schritt, der sich nicht automatisieren ließ, war der wichtigste.** Ein Mosaik aus 1.480 Zellen zeigt einen Kopf oder einen Garten, und was von beidem, entscheidet der Bildausschnitt. Tolstois Farbfoto von 1908 zeigt ihn sitzend zwischen Bäumen, sein Kopf ist ein Zwanzigstel des Bildes; auf 3:4 geschnitten bleibt der Kopf drin und 1.400 Zellen malen einen Garten. `portrait-sheet.ts` legt deshalb alle zwanzig Porträts auf einen Bogen und zeichnet den Rahmen ein, aus dem gebaut würde — **neun der zwanzig** sind sitzende Halbfiguren und haben von Hand einen Ausschnitt bekommen. Einmal hinsehen war billiger als jede Klugheit.

**„Wenig Traffic" ist keine Frage der Kompression, sondern der Auswahl.** Ein Mosaik ist Rauschen: als PNG das Siebenfache, als WebP nur 12 % weniger, zwischen Qualität 50 und 65 liegt an dieser Größe nichts Sichtbares. Die Bytes fallen woanders: **eine** Datei je Suche statt zwanzig (die Vorlage wird einmal je Sitzung gewürfelt und im `sessionStorage` gemerkt — sonst zieht neunzehn von zwanzig Suchen eine Datei, die der Browser noch nie gesehen hat); **höchstens zwei Gerätepixel**, nie drei; und eine **Toleranz von 20 % bei der Größenwahl**, weil in einer Wand aus Cover-Daumennägeln keine Linie gerade bleiben muss — ohne sie verlangt ein 260-px-Rahmen 520 px und bekommt die 640er Datei, 60 % mehr Bytes für Pixel, auf die niemand zeigen kann.

**Und ein Ladebild darf die Seite nicht ruckeln lassen, bevor es da ist.** Alle zwanzig Bilder haben dasselbe Seitenverhältnis, und weil eine Zelle ein Cover ist, steht die Form schon im Manifest: das Feld bekommt seine Höhe, bevor die Datei ankommt. Sonst springt die Seite unter jemandem, der ohnehin schon wartet.

**Was dabei herauskam.** Zwanzig Bilder auf demselben Raster (40 × 36 = 1.440 Zellen), zusammen **10.532 Cover aus 160 Werken**, **4,56 MB** für alle vierzig Dateien auf der Platte — von denen ein Leser **eine** holt: 83 bis 102 KB auf dem Telefon. Ein Bau kostet 17 Minuten kalt und **null Google-Anfragen**. Die Palette reicht von 146 Covern bis 1.368 und hört früh auf, eine Rolle zu spielen; Mary Shelleys 146 tragen ein Gesicht.

**Der teuerste Irrtum war, der Zahl zu glauben.** Tolstois erstes Porträt saß bei einem mittleren Abstand von 285 — dem zweitbesten der zwanzig — und zeigte kein Gesicht: ein weiches Farbfoto eines grauen Mannes vor grauen Bäumen, und das Mosaik traf jedes Grau davon perfekt. Der Abstand misst die Passung, nicht die Lesbarkeit. Der Kontrast des **Zielbildes** misst sie besser und steht jetzt in der Tabelle, aber auch er entscheidet nicht: Whitman hat den niedrigsten Kontrast aller zwanzig und liest sich einwandfrei, weil sein Hell und Dunkel im Bart sitzt und Tolstois in einem Baum. Von vier markierten Bildern waren drei in Ordnung. **Dieselbe Lehre wie bei den Ähnlichkeitsschwellen (SPEC §2.5): die Zahl sagt, wo man hinsehen soll, und mehr nicht.**

**Nebenbei zwei Dinge über Open Library gelernt.** Die Ausgabenseiten eines Werks müssen **nacheinander** geholt werden — jede Antwort sagt, wo die nächste beginnt — und dauern aus Deutschland 3 bis 10 s; acht Werke zu je einem Dutzend Seiten sind fünf Minuten Wartezeit am Stück, und ein Bau von zwanzig Bildern lief auf zweieinhalb Stunden hinaus. Drei Werke gleichzeitig zu holen halbiert das, ohne ein Ergebnis zu ändern: die Reihenfolge der Kacheln bleibt die der Werkliste, weil sie in `assign` Gleichstände entscheidet. Und die **Autorensuche wird jetzt auf Platte gemerkt** — sie ist der einzige Live-Aufruf eines Neubaus, und am selben Tag war `openlibrary.org` eine Viertelstunde lang nicht erreichbar, während seine Cover-CDN normal antwortete.

## 2026-09-09 · Das Mosaik erreicht die Suche (ROADMAP 6.19a)

Julian, nachdem die zwanzig Vorlagen standen: „die beiden Einwände können wir nach hinten schieben. baue, committe, merge und deploye dann einen mvp und halte in der roadmap fest was er kann und was nicht." Die beiden Einwände sind die Rechtefrage aus 5.5 und N12; sie sind damit **vertagt, nicht beantwortet**, und stehen als solche in 6.19a.

**Was hinüberging und was nicht.** `lab/` erreicht die Website nie durch einen Import — die Lint-Regel aus 0.11 verbietet es —, also wurde befördert: die reinen Funktionen (Reihenfolgen, Mischung, Größenwahl, Rahmenhöhe) liegen jetzt in `lib/loading.ts` mit ihren Tests, und `lab/loading/orders.ts` holt sie von dort statt umgekehrt. Die Animation ist `components/mosaicClearing.ts`, die Komponente `components/MosaicLoader.tsx`, und `scripts/build-loading-assets.ts` kopiert die Bilder aus `lab/loading/out` nach `public/loading`. Die Bilder selbst entstehen weiterhin offline im Labor; die Website braucht `lab/` zum Bauen nicht.

**Beim Befördern fiel der eine Befund an, der Bytes spart.** Das Labor liefert die Füllreihenfolgen vorgerechnet mit, weil seine Seiten keinen Bundler haben — zwei Byte je Zelle, dreimal. Im Browser kostet dasselbe aus der Helligkeitskarte etwa eine Millisekunde. Das Manifest je Vorlage fiel damit von **18 KB auf 2,3**.

**Zwei Stellen, die sonst still falsch geworden wären.** Die Datenschutzseite zählt auf, was im Browser liegt — jetzt vier Dinge statt drei, weil die gewählte Vorlage im sessionStorage gemerkt wird (und genau deshalb gemerkt wird: bei zwanzig Vorlagen und einem Wurf je Suche zöge neunzehn von zwanzig Suchen eine Datei, die der Browser noch nie gesehen hat). Und N11 in der Spec sagt dasselbe.

**Gemessen im Dev-Server**, Telefonbreite 375 px: Rahmen 260 px, geholt wird die 480er Datei mit **83 KB**, Canvas 520×702 bei doppelter Pixeldichte, kein seitliches Scrollen. Am Rechner 420 px Rahmen und die 640er Datei. Drei Anfragen zusammen: `index.json`, ein Manifest, ein Bild.

**Und eine Zurückhaltung, die geblieben ist:** kommt das Bild nicht oder noch nicht, steht dort die Cover-Wand von vorher. Ein fehlendes Bild ist kein leeres Feld, und ein Ladebildschirm, der selbst lädt, wäre ein schlechter Witz.

## 2026-09-09 · Zehn Autorinnen, Kerouac, und ein Ausfall, der wie ein Befund aussah (ROADMAP 6.19a)

Julian nach dem ersten Deploy: die Suchzeile gehört auf das Bild, und „nimm Jack Kerouac mit auf. Wir brauchen noch ein paar Heartthrobs in unserer Rotation. Und es sollten 50% Autorinnen sein."

**Die Zeile steht jetzt auf dem Mosaik**, mittig und eine Stufe größer, auf einem Grund in `--surface` bei 90 % — derselben Farbe, zu der hin die Wand am Anfang gedimmt ist, weshalb sie über die ganze Animation lesbar bleibt.

**Die Rotation ist zehn zu zehn.** Acht Männer gingen in die Reserve, zehn Autorinnen kamen dazu, ausgewählt nach Ausgabenzahl: Austen (12.483 Ausgaben), Montgomery, Alcott, Shelley, Cather, Woolf, Emily Brontë, George Eliot, Wharton, Burnett.

**Kerouac hat genau ein gemeinfreies Porträt.** Alles auf Commons steht unter CC BY-SA — bis auf seine **Musterungsaufnahme der US-Marine von 1943**, gemeinfrei als Werk der US-Regierung. Sie ist obendrein das beste Bild dafür: ein junges Gesicht mit hartem Kontrast vor einer Messlatte, aus der ein Mosaik von 144 Kacheln ein erkennbares Porträt macht. Eine CC-BY-SA-Vorlage wäre hier nicht bloß eine Namensnennung gewesen, sondern eine Share-alike-Pflicht auf einem abgeleiteten Werk.

**Der Fehler des Abends war der, den CLAUDE.md ausdrücklich verbietet.** *George Eliots* Mosaik entstand aus **zwei** Covern. Unter einer Ratenbegrenzung lieferte `covers.openlibrary.org` die meisten Bilder nicht; `fetchAll` verschluckte jeden Fehlschlag einzeln („ein fehlendes Cover kostet eine Kachel"), und der Lauf meldete für *The Mill on the Floss* „101 covers, 1 designs" — was sich liest wie ein Buch mit einem einzigen Umschlag und ein Ausfall war. **Ein Ausfall darf nicht als Befund erscheinen.** Fehlende Bilder werden jetzt gezählt, stehen in der Zeile je Werk, und ein Bau bricht ab, sobald weniger als die Hälfte ankommt: „only 276 of 564 cover images arrived — that is an outage, not a palette." Edith Wharton scheiterte daran und wurde eine Viertelstunde später sauber gebaut, mit 431 statt 82 Kacheln.

**Zwei Schwellen waren falsch gesetzt.** Die Mindestgröße eines Porträts lag bei 500 px, obwohl das Raster 40 × 36 Zellen hat — 300 px sind acht Pixel je Zelle, und die alte Schranke hatte Kafka, Katherine Mansfield, Willa Cather und Christina Rossetti aussortiert, ohne dass ein Leser den Unterschied je gesehen hätte. Und die Werkzahl war fest auf acht: für Dickens reichlich, für Frances Hodgson Burnett zu wenig, weil ihre Bücher oft gedruckt wurden, aber unter wenigen Umschlägen. Eine Palette unter etwa 250 Covern sieht man dem Gesicht an; `maxWorks` je Vorlage ist das billigste Gegenmittel. Burnett 161 → 281, Cather 226 → 406.

## 2026-09-09 · Eine Sprachregelung für Erklärtexte (SPEC N13)

Julian, an der Fußzeile der Jahrzehnte-Seite: „wir brauchen eine neue sprachregelung für solche stellen. Die beschreibung ist zu wissenschaftlich. die nutzer interessieren sich nicht für die schwellen. maximal darf dort stehen, was zu sehen ist und woher es kommt und der rückverweis auf die wand."

Der Satz, um den es ging, hatte fünf Teile: Herkunft, Einordnungsregel, „counted, not estimated", Sortierrichtung, Behandlung von Datensätzen ohne Jahr, die Vollständigkeits-Einschränkung, die Schwelle „mindestens 20 Cover über 4 Jahrzehnte" — und zuletzt den Rückverweis. Jeder einzelne Teil war wahr und belegt. Zusammen war es ein Methodenkapitel unter einer Bilderwand.

**N13 sagt jetzt, was in einen Erklärtext gehört:** was auf dem Schirm ist, woher es kommt, der Weg zurück — und, wo nötig, der Satz, der eine Vollständigkeit verneint. Der ist keine Erklärung, sondern eine Einschränkung, und bleibt.

**Der Unterschied zu N12 ist der Grund, die Regel überhaupt aufzuschreiben:** N12 verbietet, mehr zu behaupten, als geprüft wurde, und hat über Monate dazu geführt, dass jede Einschränkung ausformuliert im Text landete. N13 verbietet, das Geprüfte auszubreiten. Die beiden ziehen in verschiedene Richtungen, und ohne die zweite Regel gewinnt immer die erste. Ausgenommen ist die About-Seite — dort gehört die Arbeitsweise hin, und was aus der Oberfläche verschwindet, muss dort auffindbar bleiben.

Umgeschrieben wurden am selben Tag zwei Stellen:

| | vorher | jetzt |
|---|---|---|
| Fußzeile der Jahrzehnte-Seite | fünf Sätze mit Schwelle, Sortierrichtung und „counted, not estimated" | „Covers from Open Library, each in the decade of the earliest printing that carries it. What the catalogues never scanned is missing here too. **See the whole wall.**" |
| Satz unter der Scan-Reihe (6.14a) | „The wall shows one tile for these, because the images are the same design. They are different scans, and sometimes different printings of it." | „Different scans of the same design, sometimes of different printings." |

Die Schwellen `MIN_COVERS` und `MIN_DECADES` werden auf der Seite dadurch nicht mehr gebraucht; sie stehen weiter in `lib/decades.ts` und in der Spec, wo sie hingehören. Der Rest ist als **6.27** notiert, mit einer Tabelle, welche Stelle wie stark verstößt — der Verfügbarkeits-Absatz zuerst, aber erst nach 0.1, weil der Punkt ihn womöglich ganz entfernt.

### Der Ladetext steht jetzt über dem Bild

Julian: „beim lademosaik sollte der ladetext grafisch über dem mosaik stehen, nicht als overlay." Betroffen waren beide Wartebilder, auf zwei verschiedene Weisen: im **Fächer** (`LoadingStage`) hing die Zeile `absolute bottom-0` über der Bühne und kreuzte auf schmalen Schirmen die Cover; in der **sich bauenden Wand** (`AssemblingWall`) stand sie zwar im Fluss, aber darunter. Jetzt beide oberhalb und im Fluss.

Der Grund ist nicht nur Anordnung: eine Zeile Text über einem Bild liest sich als **Bildunterschrift dazu** — und genau das darf dieser Satz nicht sein. Er sagt, worauf gewartet wird, nicht, was zu sehen ist. Die Kacheln der Wartewand sind bewusst klein, gedimmt und unbeschriftet, damit niemand sie für eine Antwort hält (N12); ein Satz, der wie ihre Unterschrift aussieht, hebelte das aus.

Gemessen am Dev-Server: Suche nach „stoner williams" — Ladetext `position: static`, Unterkante 289 px, Raster beginnt bei 313 px. Werkseite *Neuromancer* — „1 of 40 covers here", `static`, Unterkante 299 px, Fächer beginnt bei 319 px. Das `relative` am Bühnen-Container konnte weg, weil die Kacheln selbst am inneren Kasten hängen, nicht an ihm.

## 2026-09-10 · Enter sendet ab

Julian: „enter scheint im suchfeld problemlos zu klappen." Damit ist ROADMAP 0.8 erledigt — ein Punkt, der seit dem 2026-09-07 offenstand und zweimal an einer automatisierten Prüfung gescheitert war.

**Warum das zwei Sitzungen gedauert hat, und was daraus zu lernen ist.** Das Browser-Panel schickt Tastendrücke ohne Tastenwert; weder Enter noch ein Zeilenumbruch löste je ein Absenden aus. Am 2026-09-08 kam die Prüfung so weit, `form.requestSubmit()` aufzurufen — das führte zur Trefferliste und belegte, dass das Formular absendbar *ist*. Es belegte nicht, dass **Enter** es auslöst, und genau das war die Frage. Die Lücke zwischen „das Formular lässt sich absenden" und „die Taste sendet es ab" ist klein und war nicht zu schließen: es brauchte einen Menschen an einer echten Tastatur.

Das ist kein Werkzeugmangel, den man umgehen sollte, sondern eine Kategorie von Fragen, für die eine Automatisierung die falsche Antwort liefert — und für die ein „sollte laut Spezifikation gehen" keine Messung ist. In der Spec steht der Befund jetzt bei F1.5, mit dem Hinweis, dass ein Umbau des Formulars ihn wieder von Hand fällig macht.

**Was der Satz nicht beantwortet hat**, und das ist bewusst getrennt: 0.8 trug drei weitere Prüfungen als „gleich mitprüfen" — Tab-Reihenfolge, Enter auf einer Cover-Kachel, Sichtbarkeit der Fokus-Ringe. Julian hat nur Enter im Suchfeld gemeldet. Der Rest steht als **0.8a**, statt still mit abgehakt zu werden; er braucht dieselbe Sorte Prüfung und ist dieselbe Sorte Frage, aber eben nicht dieselbe.

**Freigeworden ist damit 6.28** (Suchfeld in der Kopfzeile): der Punkt hatte als Bedingung „erst 0.8 klären, sonst vervielfacht ein Feld auf jeder Seite, was dabei herauskommt". Es kommt nichts Kaputtes heraus.

## 2026-09-10 · Ein Suchfeld in der Kopfzeile (ROADMAP 6.28)

Gebaut, sobald 0.8 beantwortet war. Es steht auf Detailseite, Jahrzehnte-Seite, About, Kontakt, Datenschutz und 404 — **nicht** auf Startseite und Trefferliste, die ihr eigenes Feld haben. Im ausgelieferten HTML nachgezählt: dort null Felder in der Kopfzeile, überall sonst genau eines.

**Ein einziges `<input>`, und das war die Entwurfsfrage.** Auf breiten Schirmen zeigt CSS es, ohne dass JavaScript gelaufen sein muss — es kann also nicht aufblitzen. Auf dem Telefon ist dasselbe Element ausgeblendet, und die Lupe legt es über die Kopfzeile, mit „Cancel" daneben. Zwei Felder mit derselben Beschriftung, von denen CSS eines versteckt, wären billiger zu schreiben und für einen Screenreader zwei Suchfelder gewesen.

**Der Zurück-Link musste umbenannt werden**, und das war der vorhergesagte Teil: er hieß „Search" und führt zur Trefferliste zurück, aus der man kam. Neben einem Suchfeld trügen zwei Bedienelemente dasselbe Wort und täten Verschiedenes. Er heißt jetzt „Results", wenn eine Query vorliegt, sonst „Home".

**Drei Dinge kamen erst in der Messung heraus:**

| | Was passierte | Warum |
|---|---|---|
| Der Build brach an `/about` ab | `useSearchParams()` in einer Client-Komponente nimmt **jede Seite, die sie trägt, aus dem statischen Rendern** — Next sagt es wörtlich („should be wrapped in a suspense boundary") | Der Sprachfilter wird jetzt beim Absenden aus `window.location` gelesen. Im Ereignishandler ist das sicher, und die Frage stellt sich beim Rendern gar nicht. About, Datenschutz, Kontakt und die Jahrzehnte-Seiten bleiben statisch |
| „Results" stand auch da, wo es keine gab | Die Bedingung hing an der Adresse (`href !== '/'`), und `?lang=de` allein ergibt ebenfalls eine Adresse ungleich `/` | Jetzt entscheidet die **Query**. Am Dev-Server gesehen: `/book/OL50548W?lang=de` zeigte „Results" und führte zur Startseite mit Filter |
| Der Cursor landete nicht im Feld | Ein `requestAnimationFrame` nach dem Tippen auf die Lupe feuert, solange das Feld noch `display: none` ist — **ein nicht dargestelltes Element nimmt keinen Fokus** | Ein Effekt auf `open` läuft, nachdem die Klasse gewechselt hat |

Der mittlere Punkt ist der, den ich am ehesten übersehen hätte: die Bedingung sah richtig aus und war es für den häufigen Fall auch. Sie fiel nur auf, weil die Prüfung eine Adresse mit `lang` und ohne `q` mitgenommen hat — ein Zustand, den man beim Klicken kaum erzeugt, aber jeder geteilte Link mit Sprachfilter.

## 2026-09-10 · Das Mosaik wartet jetzt auch vor der Jahrzehnte-Seite (ROADMAP 6.19a)

Julian: „baue den Ladebildschirm auch ein für das Laden beim Wechsel von Coverwall zu Decade Wall." Eine Zeile Arbeit — `app/book/[id]/decades/loading.tsx` zeigt statt `AssemblingWall` den `MosaicLoader` —, aber die interessantere Hälfte ist, **warum das die passendere Stelle ist als die Suche**, für die das Bild gebaut wurde.

Eine Suche kommt weit öfter nach ein oder zwei Sekunden zurück als nach zehn; die Animation wird dort fast immer abgeschnitten, und genau deshalb war die Wahl auf 3b gefallen — die einzige der vier, die zu jedem Zeitpunkt ein volles Bild zeigt. Die Jahrzehnte-Seite rendert auf dem Server und braucht kalt **4,5 s lokal und 12,9 s in Produktion** (gemessen 2026-09-09). Dort läuft die Animation zum ersten Mal ganz durch und hält danach das fertige Gesicht, bis die Seite da ist.

Zwei Dinge fielen dabei von selbst richtig aus: Die Vorlage gilt je Sitzung, wer also gesucht und dann eine Jahrzehnte-Seite geöffnet hat, sieht denselben Autor — und die Datei liegt bereits im Browser-Cache. Und weil `MosaicLoader` bis zum Eintreffen des Bildes ohnehin die alte Cover-Wand zeigt, ist der bisherige Zustand nicht verschwunden, sondern nur der erste Bruchteil einer Sekunde.

Geprüft mit einer künstlichen Verzögerung von acht Sekunden im Seiten-Render, weil die Seite lokal aus dem Cache sofort da ist: Überschrift, Mosaik und Zeile darunter stehen unter dem Titel-Platzhalter, den die Ladeseite schon vorher hatte.

## 2026-09-10 · Der Zufall war keiner, und was das Telefon zeigte (ROADMAP 6.19a)

Vier Punkte von Julian nach einem Tag mit dem Ladebild: schneller, die Übergänge prüfen, den Zufall prüfen, und „mobile wurde bei mir die Animation nicht gezeigt sondern nur ein fertiges Mosaik (in Produktion)".

**Der Zufall war keiner, und zwar mit Absicht.** Die Vorlage wurde einmal je Sitzung gewürfelt und im `sessionStorage` gemerkt — die Begründung stand hier am Vortag: zwanzig Vorlagen und ein frischer Wurf je Suche heißen, dass neunzehn von zwanzig Suchen für eine Datei zahlen, die der Browser noch nie gesehen hat. Julian erwartete etwas anderes, und das ist die bessere Entscheidung für ein Bild, das man mehrmals am Tag sieht: **bei jedem Anzeigen wird neu gewürfelt**, die zuletzt gezeigte Vorlage ausgeschlossen, weil zwei Würfe aus zwanzig oft genug dasselbe Gesicht treffen, dass es wie ein Fehler aussieht. Fünf Suchen hintereinander holten vier verschiedene Bilder, keines doppelt.

**Die Messung dazu ging zweimal schief, und das ist die Lehre.** Der erste Versuch las nach jeder Suche den Namen unter dem Bild und sah viermal denselben — woraus ich fast geschlossen hätte, die Änderung wirke nicht. Sie wirkte: im Netzwerk-Protokoll standen neun verschiedene Manifeste. Die Suchen im Dev-Server kamen nur so schnell zurück, dass das Bild meist gar nicht erst erschien und der Name, den ich las, von der einen langsamen Suche stammte. **Was auf dem Schirm steht, ist bei kurzen Wartezeiten eine schlechte Auskunft darüber, was der Code tut** — die Anfragen sind die bessere.

**Zum Telefon: vermutlich eine Einstellung, keine Störung.** `prefers-reduced-motion: reduce` bekommt das fertige Bild ohne Bewegung, so ist es in F1.6a festgehalten — und **iOS meldet `reduce` nicht nur bei „Bewegung reduzieren", sondern auch im Stromsparmodus**. Das ist genau das beschriebene Verhalten.

**Eine zweite Ursache war trotzdem möglich und ist repariert.** Die Uhr der Animation startete, bevor die verwürfelte Wand gezeichnet war — 1.440 Kacheln — und bevor die Seite ihr Layout hatte. Auf einem Telefon, das nebenher eine Suche laufen hat, sind das leicht ein paar hundert Millisekunden, die als Animation zählten, die niemand gesehen hat; ein langer Hänger hätte genau ein fertiges Mosaik ergeben und sonst nichts. `paint()` und `begin()` sind jetzt getrennt: gezeichnet wird sofort, gezählt ab dem ersten Bild.

**Und die Bestandsaufnahme der Übergänge**, weil bisher niemand sie an einer Stelle stehen hatte: Suche und Jahrzehnte-Seite zeigen das Mosaik; die Werkseite zeigt den Cover-Fächer, wenn die Karte eine Vorschau mitgegeben hat, und sonst die kleine Cover-Wand; und die Cover-Wand ist außerdem das, was im Mosaik-Feld steht, solange die Datei unterwegs ist. Die Tabelle steht in ROADMAP 6.19a.

## 2026-09-10 · Drei von vier Wartezeiten, und ein Bild, das atmet (ROADMAP 6.19a)

Julian nach der Übergangs-Tabelle: „Werkseite von außen sollte ein Mosaik bekommen und Jahrzehnte-Seite → zurück auch", und „für reduced motion kann man vllt ein Pulsieren eines fertigen Mosaiks machen? Statt des Aufbaus".

**Beide Fälle sind derselbe Zweig.** `LoadingStage` zeigte die kleine Cover-Wand genau dann, wenn weder ein Cover angekommen ist noch eine Karte eine Vorschau mitgegeben hat — das ist der Aufruf von außen *und* der Rückweg von der Jahrzehnte-Seite. Dort steht jetzt das Mosaik. Der Cover-Fächer bleibt, wo eine Karte ein Cover mitgegeben hat: dann kann die Seite etwas über das gesuchte Buch zeigen statt über sich selbst, und das ist die bessere Auskunft. Damit wartet die Seite an drei von vier Stellen vor dem Mosaik.

**Unter `prefers-reduced-motion` atmet das fertige Bild.** Der Aufbau läuft dort nicht, und ein stehendes Bild sagt „fertig", während die Seite noch arbeitet — Julians Vorschlag trifft genau die Lücke. Die Deckkraft geht in zweieinhalb Sekunden zwischen 0,7 und 1 hin und her, auf dem Compositor. Das ist eine **bewusste Ausnahme** von der Regel in `globals.css`, die dort sonst jede Animation abschaltet, und sie ist zu begründen: eine langsame Blende ist nicht die Bewegung, vor der die Einstellung schützen soll — nichts wandert, nichts skaliert, nichts parallaxt —, und weil iOS `reduce` auch im Stromsparmodus meldet, ist ein guter Teil der Leser auf diesem Weg schlicht knapp bei Batterie.

**Und ein Fund über den Build, der einen halbe Stunde kosten kann.** Eine von Hand geschriebene Regel für eine eigene Klasse in `app/globals.css` **kam nicht im ausgelieferten CSS an** — die Regel unmittelbar darunter schon, dieselbe Datei, dieselbe Ebene, Klammern ausgezählt, Server zweimal neu gestartet. Der Weg, der funktioniert, ist Tailwinds eigener: die Animation im `@theme` deklarieren und über `motion-reduce:animate-breathe` benutzen; dann steht sie im CSS, mitsamt `@keyframes`. Wer hier eine eigene Klasse anlegt, prüfe im Browser, ob sie ankommt, statt sich auf die Datei zu verlassen.

## 2026-09-10 · Die Roadmap umgebaut: Steuerung vorn, Phasen nach Abhängigkeit, Langtexte ins Archiv

Julian: „Gehe nochmal alle Pläne, Roadmaps und das Dorf File durch. Überprüfe die Abhängigkeiten voneinander, sortiere die Phasen neu und sinnvoll. Fasse an manchen Stellen den Text kürzer (besonders bei angehakten Punkten, vielleicht braucht es auch ein History-file oder eine Sammlung an Funktionen, die es jetzt gibt). Dann baue eine Steuerungsübersicht am Anfang der Roadmap mit Verlinkungen zu den wichtigsten Dokumenten und Abschnitten. Und schaue ob du eine visuelle High-Level Übersicht der branches bzw worktrees machen kannst, die immer aktuell bleibt sodass ich weiß, welche Session an welchen Themen arbeitet." („Dorf File“ gelesen als die Dateien unter `docs/`.)

**Der Befund, der nicht in der Aufgabe stand, kam zuerst.** `origin/main` — Produktion — lag fünfzehn Commits vor dem lokalen `main` und sechs dahinter: die Ladebild-Session hatte 6.19a direkt nach GitHub geschoben, während diese Session 6.28 auf das lokale `main` gelegt hatte, und nichts im Repository zeigte das. Der Merge hatte drei Konflikte, alle in Dokumenten oder der Ladeseite der Jahrzehnte-Seite (SPEC: N11-Wortlaut, und N12 stand hinter N13; `decades/loading.tsx`: Mosaik *und* Suchfeld; Historie: beide Eintragsreihen, jetzt nach Datum). **Während der Umbau lief, kam es noch einmal:** um 18:22 committete eine dritte Session 6.29 auf das lokale `main`, um 18:26 wuchs `origin/main` um einen weiteren 6.19a-Commit. Beides ist nachgezogen. Die Roadmap wurde deshalb aus dem *zusammengeführten* Stand neu gebaut, nicht aus dem eigenen — und die fünf Einzeiler ohne Nummer am Ende von Phase 6, die Nummern 6.29–6.33 bekommen sollten, bekamen keine: 6.29 war in derselben Stunde anderswo vergeben worden. Sie stehen jetzt unter „Zurückgestellt“, wo sie ohne Plan und Auslöser ohnehin hingehören.

**Was daraus geworden ist:**

| | vorher | jetzt |
|---|---|---|
| `ROADMAP.md` | 204 KB, drei Kopfabschnitte, die dreimal dasselbe erzählten, Phasen 0–6 in Nummernfolge, erledigte Punkte in voller Länge zwischen den offenen | 129 KB; vorn **„Steuerung“** (Dokumentenkarte mit Abschnitts-Links, Stand, nächste Schritte, ein Mermaid-Graph der Abhängigkeiten zwischen offenen Punkten, Phasentabelle mit Zählern), dann die Phasen in **Abhängigkeitsfolge 0, 2, 1, 6, 3, 5, 4**, Phase 6 in vier Gruppen (Fehler, Daten, Oberfläche, Startseite), erledigte Punkte je Phase gesammelt und auf wenige Zeilen gekürzt — Ergebnis, Datum, Links auf Historie, Plan und Archiv |
| Langtexte der 28 abgehakten Punkte | in der Roadmap | **`docs/roadmap-archive.md`**, 91 KB, wortgleich verschoben, je Punkt unter seiner Nummer |
| Was die Seite kann | nur aus Spec und abgehakten Punkten zu erschließen | **`docs/features.md`**: je Funktion seit wann, Spec-Stelle, Roadmap-Punkt, Code; dazu, was es ausdrücklich nicht gibt |
| Wer woran arbeitet | nirgends | **`npm run worktrees`** (`scripts/worktrees.ts`) schreibt `docs/worktrees.md`: jeder Worktree und Branch mit Abstand zu Produktion, ungespeicherten Dateien und den Roadmap-Nummern aus seinen Betreffzeilen, als Tabelle und Mermaid-Diagramm. Die Datei ist **git-ignoriert** — sie ist aktuell, wenn man sie ansieht, und kann in keinem Commit veralten |

Offene Punkte sind **wortgleich** übernommen, keine Nummer hat sich geändert, die Phasen-Überschriften 1 und 2 sind umbenannt („Vor echtem Verkehr“, „Betrieb“), weil „vor dem Deployment“ seit dem 2026-09-08 falsch war. Alle 57 offenen und 28 erledigten Punkte sind gezählt, jeder relative Link in Roadmap, Archiv, Features, Spec, Plänen und READMEs ist maschinell geprüft — dabei fiel ein Link `../SPEC.md` auf, der von der Roadmap aus nie funktioniert hatte.

**Die Abhängigkeitsprüfung** änderte keinen Punkt, aber sie steht jetzt an einer Stelle: 6.6 (Julians ISBNdb-Monat) blockiert 6.7, 6.4 und 6.23; 6.18 (Kuratierung) blockiert 6.17 und 6.16; ein Deploy blockiert 2.6 und die Antwort auf 6.25; 6.13 und 6.15 teilen sich die ersten Schritte; 6.9 und 5.4b denselben Index; Phase 4 hängt an Besuchern, die Phase 5 bringen soll, und Phase 3 an denselben Besuchern — deshalb steht 4 jetzt zuletzt. Zwei Punkte hatten schon vorher an Wert verloren (6.12 nach dem Index, der `priority`-Teil von 6.5 nach 1.3); das steht weiter im Kopf.

Mitgezogen: `CLAUDE.md` (Steuerung, Archiv, Features, die Regel zu parallelen Sessions und `origin/main`), der Kopf und §8 der Spec, `docs/plans/README.md`, `README.md` (dort stand noch „not deployed yet“).

## 2026-09-10 · Der Rückweg spielte vier Sekunden Einzug, die niemand brauchte (ROADMAP 6.19a, F2.12)

Julian: „wenn ich von der decade wall zur cover wall zurückgehe, bekomme ich immer noch den Cover-Fächer." Meine Übergangs-Tabelle vom selben Tag behauptete dort das Mosaik — sie war falsch, und zwar zweifach.

**Erstens kam der Fächer nicht daher, wo ich ihn vermutete.** Ich nahm an, die Vorschau aus der Ergebniskarte liege im `sessionStorage` und liefere das Hero-Cover. Sie tut das, aber sie war nicht die Ursache: der Fächer stand da, weil die **Cover schon vollständig vorlagen**. `useWorkPages` merkt sich die letzten fünf Bücher dieses Tabs und gibt ein zurückbesuchtes Werk beim ersten Rendern ganz heraus — der Kommentar dort sagt sogar ausdrücklich „statt die Ladeszene noch einmal zu spielen".

**Zweitens war das nicht die Frage nach dem richtigen Bild, sondern ein Fehler.** Gemessen: der Fächer erschien nach 1 s und stand bis **5 s**, über Covern, die zum Zeichnen bereit waren. `useLoadingScene` verlangte zwei Cover im Takt von 520 ms mit 650 ms Einlaufzeit, ehe es aufhören durfte, und fragte dabei nie, ob überhaupt noch gewartet wird. **SPEC F2.12 versprach seit jeher „bei warmem Cache endet die Szene sofort".** Jetzt hält es: sind die Cover bekannt *und* ist Seite 0 schon gehasht, wenn die Szene beginnt, endet sie im selben Augenblick. Auf einer kalten Seite kann das nicht greifen, weil die Cover dort lange vor dem Hash bekannt sind.

Nach der Reparatur landet der Rückweg direkt auf der Wand, ohne Ladebild — gemessen über anderthalb Sekunden hinweg kein einziger Zwischenzustand. **Das ist besser als jedes Ladebild an dieser Stelle**, und es ist die Antwort auf Julians Beobachtung: nicht ein anderes Bild, sondern gar keines.

**Eine Änderung unterwegs wurde wieder zurückgenommen.** Erst hatte ich die Cover-Vorschau nach dem ersten Gebrauch geleert, damit ein zweiter Besuch das Mosaik bekommt. Sie löste den Fall nicht — der Fächer kam nicht von dort — und hätte einen Reload verschlechtert, der bis dahin das Cover des gesuchten Buchs zeigte. Zurückgenommen.

## 2026-09-10 · Nach dem Deploy: der CDN-Treffer, ein Protokoll für leere Kacheln, der ISBN-Link bei lebender ISBN, und die Scan-Reihe in einer Zeile

Julian: „ich glaube dein stand wurde schon gepusht, gehe also die punkte an." Er war gepusht — `origin/main` stand auf `b43904b`, zwei Commits weiter als das lokale `main`, weil die Ladebild-Session den Umbau in ihren Branch gemergt und alles zusammen geschoben hatte. Danach die Punkte, in der Reihenfolge des Roadmap-Kopfs.

**2.6, einmal gegen Produktion, nicht in der Schleife.** Die Bildroute liefert dasselbe Cover beim zweiten Abruf aus dem CDN: `/img/M/ol-13498737` — **`x-vercel-cache: MISS` in 2,12 s, dann `HIT` in 0,24 s**, 24 KB, `age: 1`. Damit ist 1.3 belegt; lokal war das nicht zu haben, weil dort kein CDN steht. Der Rest stimmt auch: Canonical und OG-Bild der Werkseite auf `beautifulcovers.vercel.app`, Sitemap 253 Adressen, das Analytics-Skript antwortet 200, About kommt als `PRERENDER` mit genau einem Suchfeld in der Kopfzeile — 6.28 ist also live. Ein Nebenbefund: die Kante gibt `cache-control: public, max-age=3600` zurück, das `s-maxage` hat Vercel verbraucht, wie es soll. Offen bleiben die zwei Dinge, die nur Julian sehen kann: das OG-Bild in einem Messenger und der Google-Verbrauch in der Cloud-Konsole.

**6.25, die erste Kleinigkeit.** Seit 1.3 holt ein Server alle Cover, und ob Open Library das drosselt, war aus den Logs nicht zu beantworten, weil die Route jede Antwort der Gegenseite in eine nackte 502 verwandelte. Jetzt schreibt jeder Fehlschlag eine Zeile `bb.img` (`lib/coverlog.ts`, nach dem Muster von `lib/clicks.ts`: ungeschützt, nur im Fehlerfall, nichts über den Leser) mit Status oder Grund und Dauer, und die 502 trägt denselben Wert als `X-Cover-Upstream`. Der Eimer `img` ist von 400/300 auf 800/400 gehoben — eine Wand von 300 Covern passte, eine Wand plus die Mosaike einer Trefferliste nicht. Beantwortet ist damit nichts; **beantwortbar** ist es, nach einem Tag Produktion.

**1.11a, im Browser an Julians Fall geprüft.** Markt DE, *Fahrenheit 451*, das Cover der Simon-&-Schuster-Ausgabe: unter der gefalteten Kachel führt die Ausgabe mit ISBN `9781451673319`, deren Verlagsbild Google bestätigt (`verified`), und die erste Reihe lautet jetzt AbeBooks und Booklooker **über `/go/<shop>/9781451673319`** — nicht mehr „Simon & Schuster 2012" als Titelsuche. Die Gegenprobe im selben Buch: Del Rey 1987 mit ISBN `9780345342003` hat kein Verlagsbild (`unknown`), und dort sucht AbeBooks weiter nach Titel, Verlag und Jahr. Zwei Tests in `lib/__tests__/linkplan.test.ts` halten beides fest, einschließlich `pending` und `unavailable`, die nichts bewegen dürfen.

**6.14a, gemessen an zehn Scans.** *Fahrenheit 451* trägt an einer Kachel zehn Scans (Julian hatte acht gesehen). Die Reihe ist jetzt 504 px Inhalt in einem 369 px breiten Kasten, **eine Zeile von 64 px** statt zwei, mit Scroll-Snap; die Verlaufskante rechts steht, solange es weitergeht, und ist weg, sobald der Kasten am Ende ist (geprüft durch Scrollen auf 134,5 px, das Maximum, und zurück). Der Abschnitt ist 139 px hoch — Überschrift, Reihe, ein Satz.

**Was der Bau gelehrt hat.** Der erste Entwurf des Hooks gab zwei `useRef`-Objekte zurück, und `react-hooks/refs` wies alle sieben Stellen zurück, an denen die Komponente sie in `ref={…}` weiterreichte — zu Recht, denn ein Objekt aus einem Hook in Render zu lesen ist genau das, was die Regel verbietet, auch wenn nur `.current` gefährlich wäre. **Callback-Refs** lösen es sauber: der `ResizeObserver` hängt sich beim Einhängen des Elements an, seine erste Zustellung setzt den Anfangszustand, und kein Effekt setzt einen State. Zwei Elemente werden beobachtet, nicht eines, weil ein `ResizeObserver` Kastengrößen meldet — der Kasten ändert sich, wenn die Spalte schmaler wird, der Inhalt, wenn eine Kachel dazukommt.

**6.24 hat die andere Session gelöst, ohne es zu wissen.** Ihr Commit „F2.12: coming back to a wall no longer replays four seconds of entrance" ist genau Julians Beobachtung vom 2026-09-09 (Zurück von der Jahrzehnte-Seite, der Fächer spielt noch einmal); der Punkt ist mit Verweis auf ihren Eintrag abgehakt.

**Zweimal gesehen, nicht untersucht:** beim Auswählen eines Covers stellte der Dev-Server dieselbe ISBN-Nachschau (`/api/isbn/9780345342966`) fünfmal, drei davon abgebrochen. Im Dev-Modus rendert React Effekte doppelt, und der Server-Cache fängt die Wiederholungen ab, also kostet es dort kein Google-Kontingent — ob Produktion dasselbe Muster zeigt, wäre mit 3.1 zu sehen. Und zwei Anfragen einer Werkseite antworteten 503, ohne dass eine Kachel leer blieb; welche, hat das Protokoll nicht mehr hergegeben.

