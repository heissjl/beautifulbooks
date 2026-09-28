# Wie groß ist das Buch? Recherche zu Buchmaßen

Stand: 2026-09-28

Frage: Kann die Seite für eine bestimmte Ausgabe (ISBN oder Open-Library-Edition) Höhe × Breite (und Dicke) herausfinden, verlässlich und legal, und wie oft? Anlass: `artworkPlan` in `lib/walls/model.ts` rechnet jedes Buch als 13 × 20 cm (`ARTWORK_CM`).

## Kurzfassung

- **Volle Maße (H × B × T) sind selten.** Open Library hat `physical_dimensions` bei **16 von 567** Editionen (2,8 %) der fünf Test-Werke, bei Editionen mit Cover **12 von 268** (4,5 %); fast alle stammen aus alten Amazon-Importen. Achsenreihenfolge und Einheit sind nicht verlässlich (ein Datensatz „198 x 129 x centimeters“ meint Millimeter).
- **Google Books** liefert in den Suchantworten der Fixtures **0 von 100** Bänden mit `dimensions`; das Feld gibt es laut Doku nur beim Abruf eines einzelnen Bandes. Das wäre ein zusätzlicher Google-Aufruf pro Buch aus dem gemeinsamen Kontingent, also keine Option.
- **Die Höhe liefern die Nationalbibliotheken fast immer**, und zwar kostenlos, ohne Schlüssel und unter offener Lizenz (MARC 300 $c / UNIMARC 215 $d, „18 cm“): DNB 3 von 4 ISBNs, BnF 2 von 2, LoC 1 von 3. Die Breite liefern sie nicht.
- **Die Breite lässt sich aus Höhe × Seitenverhältnis des Coverscans gut schätzen.** An 9 Büchern mit bekannten Maßen lag der Fehler bei 0,0 bis 1,0 cm (Median 0,3 cm). Scans, die kein einzelnes Cover zeigen (Doppelseite, Querformat), muss die Seite erkennen und verwerfen (4,5 % der 7.616 vermessenen Scans haben h/b < 1,25).
- **Empfehlung:** OL-`physical_dimensions` prüfen (kostet keine zusätzliche Anfrage, weil `lib/walls/printings.ts` die Edition schon lädt), dann Höhe aus DNB/BnF/LoC nach ISBN-Sprachraum, Breite aus dem Scan, dann Richtwert nach Format. Jedes Buch trägt, woher sein Maß stammt. Die Seite nennt die Größe des Werks als Spanne, solange ein Maß geschätzt ist.
- Kostenpflichtig oder gesperrt: ISBNdb (hat Maße, ab etwa 150 USD/Jahr, Preise nicht verifiziert), Amazon (PA-API im Mai 2026 abgeschaltet, Nachfolger nur für Associates), ONIX (nur mit Verlagsvertrag), Händlerseiten (nicht scrapen).

## Wie gemessen wurde

- **Fixtures:** `lib/__fixtures__/*/openlibrary-editions*.json` enthalten die Felder `physical_dimensions`, `pagination` und `weight` **nicht**. `scripts/record-fixtures.ts` kürzt Editionen auf `EDITION_FIELDS`. Die Abdeckung lässt sich deshalb nicht offline aus den Fixtures messen. Für Tests eines Maß-Parsers müssen die Fixtures mit diesen Feldern neu aufgenommen werden. Die Google-Fixtures (`googlebooks-search.json`) enthalten `volumeInfo` ungekürzt und waren messbar.
- **Live-Anfragen an Open Library: 26** (≤ 30, nacheinander, je 2 s Pause), am 2026-09-28:
  - 7 × `/works/<id>/editions.json?limit=100`: Gatsby OL468431W (offset 0, 100, 200), Nineteen Eighty-Four OL1168083W, Pride and Prejudice OL66554W, Gravity's Rainbow OL2636675W, Mumbo Jumbo OL30751W; zusammen 567 Editionen.
  - 11 × `covers.openlibrary.org/b/id/<id>.json` für die Editionen mit Maß und Cover (Scanbreite/-höhe).
  - 8 × `/isbn/<isbn>.json` für eine Zufallsstichprobe (seed 7) von 8 Werken aus `data/collections.json` über deren `coverIsbn`; 7 beantwortet, 1 nicht gefunden.
- **Andere Kataloge:** DNB SRU 4, BnF SRU 2, LoC SRU 3 Anfragen. **Google Books live: 0.**
- **Offline:** `data/cover-measures.json` (Pixelmaße von 7.616 OL-Coverscans, gemessen 2026-09-27 für den Versus-Pool) und die ISBN-Verteilung der 2.371 Werke in `data/collections.json`.

## 1. Open Library

**Felder:** `physical_dimensions` (Freitext), `physical_format`, `number_of_pages`, `weight`, `pagination` (bei MARC-Importen manchmal mit Höhe, z. B. „184 p. ; 19 cm“).

**Abdeckung, 567 Editionen aus 7 Live-Seiten:**

| Werk (Seite) | Editionen | mit `physical_dimensions` |
|---|---:|---:|
| Nineteen Eighty-Four | 100 | 1 |
| Gravity's Rainbow | 44 | 5 |
| Mumbo Jumbo | 23 | 3 |
| Gatsby, offset 0 | 100 | 0 |
| Gatsby, offset 100 | 100 | 1 |
| Gatsby, offset 200 | 100 | 6 |
| Pride and Prejudice | 100 | 0 |
| **Summe** | **567** | **16 (2,8 %)** |

- Editionen mit Cover: 268, davon mit Maß **12 (4,5 %)**. Das ist die Menge, aus der Leser wählen.
- Zusätzlich 3 Editionen mit Höhe in `pagination` („18 cm“, „19 cm“, „19 cm“). Größenangabe irgendeiner Art: 18 von 567 (3,2 %).
- `number_of_pages` 209 (37 %), `physical_format` 215 (38 %), `weight` 216 (38 %, fast nur aus `bwb`-Importen, die keine Maße mitbringen).
- **Herkunft:** 15 der 16 Maße kommen aus `amazon:`-Quelldatensätzen, einer aus `bwb`. Die Amazon-Importe liefen über die PA-API, die Amazon im Mai 2026 abgeschaltet hat (OL-Issue #12255). Ob OL künftig noch Maße importiert, ist offen (nicht verifiziert).
- **Formate:** 13 × „N x N x N inches“, 3 × „… centimeters“ (einer davon ohne dritten Wert: „N x N x  centimeters“). Alle 15 lesbaren Angaben haben drei Werte.
- **Stichprobe aus den Sammlungen** (8 ISBNs, 7 beantwortet): 2 mit Maß, nämlich „6.9 x 4.2 x 0.6 inches“ (Poésie/Gallimard) und „198 x 129 x  centimeters“ (Harry Potter, Bloomsbury). Das zweite sind offensichtlich Millimeter. Kein Datensatz hatte eine Höhe in `pagination`. Die Stichprobe ist zu klein für eine Quote, zeigt aber den Einheitenfehler.

**Qualitätsprobleme (gemessen):**
- **Achsenreihenfolge:** 14 Angaben beginnen mit der Höhe, eine spanische (OL52231685M, Quelle `bwb`) ist H × T × B („19.74 x 2.31 x 13.23“). Regel: größter Wert = Höhe, zweitgrößter = Breite, kleinster = Dicke. Querformate klärt das Seitenverhältnis des Scans.
- **Einheit:** „198 x 129 … centimeters“. Plausibilitätsgrenze nötig: Höhe 9–45 cm, sonst verwerfen.
- **Nicht-Bücher:** zwei Audio-CDs, eine Kassette. Die filtert `printingFromEdition`/`parseFormat` ohnehin.
- **Dicke:** Amazon-Werte schwanken stark gegen die Seitenzahl, z. B. 768 Seiten einmal 2,5 cm und einmal 5,8 cm. Mit 0,33 bis 0,97 mm pro Seite (9 Paperbacks/Hardcover) ist die Dicke höchstens ein grober Hinweis.

**Recht:** Die Daten sind offen (OL-Datendumps). Die Seite fragt OL ohnehin schon, die Regeln aus CLAUDE.md zu Timeout und Cache gelten weiter.

## 2. Google Books

- `volumeInfo.dimensions` = `{height, width, thickness}` als Strings in cm (Doku `volumes`-Referenz). Die LITE-Projektion enthält das Feld nicht. Nach Doku kommt es nur beim Einzelabruf `volumes/<id>`.
- **Gemessen in den Fixtures** (`lib/__fixtures__/*/googlebooks-search.json`, 5 × 20 Bände, ungekürzte `volumeInfo`): **0 von 100** Bänden mit `dimensions`. `pageCount` ist bei 91 von 100 vorhanden.
- Wie oft der Einzelabruf Maße liefert, wurde **nicht gemessen** (Regel: Google nicht live). Es wäre ohnehin ein zusätzlicher Google-Aufruf pro Buch aus den 1.000 pro Tag, ohne Messung ausgeschlossen (CLAUDE.md, E10). **Nicht empfohlen.**

## 3. Andere Kataloge

### Deutsche Nationalbibliothek (SRU, MARC21-xml, Feld 300 $c)

- `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=num%3D<ISBN>&recordSchema=MARC21-xml`
- Ergebnis, 4 ISBNs:
  - 3518110063 (edition suhrkamp): „150 S.“, **18 cm**
  - 3518369776 (suhrkamp taschenbuch): „258 S.“, **18 cm**
  - 9783499135149 (Rowohlt Tb, Die Enden der Parabel): „1193 S.“, **19 cm**. OL hat für dieselbe Ausgabe 7,6 in = 19,3 cm.
  - 9783866471986: kein Treffer
- **Nur die Höhe**, in ganzen cm. Laut Katalogregeln wird auf den nächsten vollen cm aufgerundet (AACR2/RDA, aus dem Gedächtnis, hier nicht nachgelesen). Der Rowohlt-Fall (19,3 → 19) passt nicht zur Aufrundung. Die Rundung ist also als ±1 cm zu behandeln.
- Zugang laut DNB-SRU-Seite kostenfrei und ohne Registrierung. Die Titeldaten stehen seit 2015 unter CC0 1.0.
- Sprachraum: 760 der 2.371 Sammlungs-Werke haben eine `coverIsbn` der Gruppe 3 (deutschsprachig).

### Bibliothèque nationale de France (SRU, UNIMARC 215 $d)

- `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=bib.isbn%20adj%20%22<ISBN>%22&recordSchema=unimarcxchange`
- Ergebnis, 2 ISBNs, beide gefunden:
  - 2070302822 (Poésie/Gallimard): **18 cm**. OL: 6,9 in = 17,5 cm, das passt zur Aufrundung.
  - 2277115339 (J'ai lu): **17 cm**
- Frei zugänglich ohne Authentifizierung, Licence Ouverte (Etalab) mit Quellenangabe. 492 Sammlungs-Werke sind aus der Gruppe 2.

### Library of Congress (SRU, MARC 300 $c)

- `http://lx2.loc.gov:210/lcdb?version=1.1&operation=searchRetrieve&query=bath.isbn=<ISBN>&recordSchema=marcxml`
- 3 Anfragen: 0743273567 (Gatsby, Scribner) „xvii, 184 pages“, **21 cm**. 0684824779 (Gatsby, Scribner 1996) und 9780575108233 (SF Masterworks, britisch): kein Treffer.
- Britische Ausgaben und Massenmarkt-Nachdrucke fehlen erwartbar. Für die Gruppe 0/1 (782 Werke) wird die Trefferquote deutlich unter der der DNB liegen (nur 3 Anfragen, **keine belastbare Quote**). Die British Library wäre der naheliegende Ergänzungskatalog für UK-ISBNs (nicht geprüft).
- LoC-Katalogdaten gelten als gemeinfrei (US-Bundesbehörde, nicht nachgelesen). Server nur per HTTP, langsam.

### WorldCat (OCLC)

- Hat MARC 300 $c für sehr viele Ausgaben. Die Such- und Metadaten-APIs setzen eine OCLC-Mitgliedschaft bzw. einen Schlüssel voraus (nicht verifiziert, kein Test). Für die Seite eher nicht erreichbar.

### ISBNdb (kommerziell)

- Führt Maße pro ISBN (`dimensions` bzw. `dimensions_structured`). Die API-Doku antwortete 403, **Feldnamen nicht verifiziert**.
- Preise laut Suchergebnissen, **nicht auf der Preisseite geprüft und widersprüchlich**: Basic 150 USD/Jahr, Premium 29,95 USD/Monat, Pro 74,95 USD/Monat; anderswo 14,99 bis 299,99 USD/Monat. Limits 1/3/5 Anfragen pro Sekunde.
- Abdeckung unbekannt. Die Quelle vieler dieser Maße ist vermutlich ebenfalls Handels- bzw. ONIX-Daten (Vermutung). Nur nach einem Probezugang und einer Messung sinnvoll.

### Verlags-ONIX (Measure-Composite, Codeliste 48: 01 Höhe, 02 Breite, 03 Dicke; mm/g)

- Die genaueste Quelle, aber nur über Verlagsverträge oder Datenaggregatoren (VLB/MVB in DE, Bowker, Nielsen) zu haben, jeweils kostenpflichtig. Das VLB ist für deutsche Titel die naheliegende Quelle (Preis und Bedingungen nicht geprüft). **Für die Seite derzeit nicht realistisch.**

### Amazon

- PA-API 5 wurde am 30.04.2026 abgekündigt und am 15.05.2026 abgeschaltet. Nachfolger ist die Creators API (OAuth), nur für Associates-Partner. `ItemInfo.ItemDimensions` lieferte Höhe, Länge, Breite und Gewicht.
- Die Associates-Bedingungen verbieten automatisierten Zugriff außerhalb der API (CLAUDE.md, §8.7), und die Daten dürfen nur im Rahmen der Partnerschaft genutzt werden (Details nicht geprüft). **Nicht empfohlen**, solange E-Affiliate-Fragen offen sind.

### Händlerseiten (Thalia, Hugendubel, Blackwell's …)

- Viele zeigen „Maße“. Scrapen scheidet aus: robots.txt, AGB und die Messungen in `lib/availability.ts` sprechen dagegen. **Nicht verwenden.**

## 4. Schätzungen

### Höhe aus dem Katalog × Seitenverhältnis des Coverscans

`covers.openlibrary.org/b/id/<id>.json` liefert `width`/`height` des Scans (und `olid`, das `printings.ts` schon liest). Test an den 11 Editionen mit OL-Maß und Cover: Breite = Höhe ÷ (Scan-h/b), verglichen mit der eingetragenen Breite:

| Edition | Maß | Scan h/b | Buch h/b | Breite geschätzt / eingetragen |
|---|---|---:|---:|---|
| OL52231685M | 19,74 × 13,23 cm | 1,619 | 1,492 | 12,2 / 13,2 |
| OL9048116M | 7,6 × 5 in | 1,557 | 1,520 | 12,4 / 12,7 |
| OL9047892M | 8,5 × 5 in | 1,673 | 1,700 | 12,9 / 12,7 |
| OL9274011M | 7,8 × 5,1 in | 1,538 | 1,529 | 12,9 / 13,0 |
| OL7721361M | 8 × 5,2 in | 1,547 | 1,538 | 13,1 / 13,2 |
| OL9005192M | 8,6 × 5,8 in | 1,513 | 1,483 | 14,4 / 14,7 |
| OL32218768M | 20,85 × 14,1 cm | 1,479 | 1,479 | 14,1 / 14,1 |
| OL12667383M | 7,5 × 4,5 in | 1,727 | 1,667 | 11,0 / 11,4 |
| OL9786099M | 7,4 × 4,9 in | 1,544 | 1,510 | 12,2 / 12,4 |
| OL9144156M | 8,8 × 6 in | **0,525** | 1,467 | Scan ist Doppelseite/quer, verwerfen |
| OL12033870M | Audio-CD | 1,295 | 1,031 | kein Buch |

- Bei 9 Büchern liegt der Fehler zwischen 0,0 und 1,0 cm, im Median 0,3 cm. Die Scans sind eher etwas schlanker als das Buch (beschnittener Rand, Scan ohne Überzug), die Schätzung also eher zu schmal.
- Verteilung über alle 7.616 OL-Scans in `data/cover-measures.json`: h/b Median 1,54, 10. Perzentil 1,40, 90. Perzentil 1,67. 4,5 % liegen unter 1,25 (Doppelseiten, Rücken mit Cover, Quer- und Quadratformate), 0,2 % über 1,9. Regel: Scan-Verhältnis nur zwischen etwa 1,25 und 1,9 verwenden, sonst Formatrichtwert.
- Zusammen mit der Katalog-Rundung (±1 cm Höhe) ergibt das für die Breite etwa ±1 cm. Für die Planung eines Rahmens reicht das. Für einen Zuschnitt reicht es nicht.

### Richtwerte nach `physical_format`

Branchenübliche Formate (aus dem Gedächtnis, **nicht an Quellen geprüft**; im Code als Annahme kennzeichnen):

| Format | Richtwert (B × H) |
|---|---|
| Mass market paperback (US) | 10,8 × 17,5 cm |
| Taschenbuch (DE; Suhrkamp/Rowohlt laut DNB 18–19 cm hoch) | ca. 11,5 × 18,5 cm |
| Trade paperback | 13–14 × 20–21,5 cm (heutiger Wert 13 × 20) |
| Hardcover | 14–16 × 21–24 cm |

`physical_format` ist bei 38 % der OL-Editionen gesetzt und oft unscharf („Paperback“ trennt Mass Market nicht von Trade). Das taugt nur als Spanne.

### Dicke aus der Seitenzahl

Gemessen an 9 Büchern: 0,33 bis 0,97 mm pro Seite (Umschlag inklusive). Das ist ein Faktor 3. Für das Werk ist die Dicke zweitrangig: Die Rahmentiefe (`depth: 7`) hängt am Keil, nicht an der Buchdicke, solange kein Buch über etwa 5 cm dick ist. Empfehlung: Dicke nur als Warnung nutzen („sehr dickes Buch, über 800 Seiten“), nicht in die Maße einrechnen.

## Empfehlung

**Reihenfolge pro Buch** (serverseitig, gecacht wie `printings.ts`, 30 Tage):

1. **OL-Edition** (ohnehin geladen in `lookUpPrinting`): `physical_dimensions` parsen. Größter Wert = Höhe, zweitgrößter = Breite, kleinster = Dicke. Einheiten inches/centimeters/mm. Plausibilitätsgrenzen Höhe 9–45 cm und Breite 7–35 cm, sonst verwerfen (nicht umdeuten). Sonst Höhe aus `pagination` („19 cm“). **Keine zusätzliche Anfrage.** Erwartung: etwa 3–5 % der Bücher.
2. **Nationalbibliothek nach ISBN-Gruppe**, nur Höhe: Gruppe 3 → DNB, Gruppe 2 → BnF, Gruppe 0/1 → LoC (später British Library für UK). Eine Anfrage pro Buch, frei und offen lizenziert. Erwartung nach der kleinen Stichprobe: hoch bei DNB/BnF (5 von 6), niedrig bei LoC (1 von 3). **Das muss vor dem Einbau an 50–100 Sammlungs-ISBNs gemessen werden.** Die hier gezählten 9 Anfragen reichen für keine Quote.
3. **Breite = Höhe ÷ Scan-Seitenverhältnis**, nur wenn das Verhältnis zwischen 1,25 und 1,9 liegt. Den Scan kennt die Seite (Cover-JSON, schon in `printings.ts` geladen).
4. **Fallback:** Richtwert nach `physical_format`, sonst 13 × 20 wie heute. Beides ausdrücklich als Annahme.

Grob geschätzt haben damit die deutsch- und französischsprachigen Sammlungs-Bücher (1.252 von 2.371) gute Aussichten auf eine gemessene Höhe. Bei englischsprachigen bleibt es oft beim Richtwert. Das ist eine Hochrechnung, keine Messung.

**Was `artworkPlan` braucht:**
- Statt `ARTWORK_CM.bookW/bookH` eine Liste pro Buch: `{ w: number; h: number; t?: number; source: 'catalogue' | 'height+scan' | 'format' | 'assumed'; checked: string }`.
- Raster: Spaltenbreite = breitestes Buch der Spalte, Zeilenhöhe = höchstes Buch der Zeile. Oder, gestalterisch vermutlich schöner, Bücher auf gemeinsamer Unterkante pro Zeile. Die Entscheidung liegt bei Julian.
- Rückgabe als **Spanne**, solange ein Buch nicht gemessen ist: `widthCm: { min, max }`. Die Spanne entsteht aus ±1 cm für Katalog und Scan und der Formatspanne für Richtwerte. Bei „assumed“ eine breite Spanne (z. B. 10,8–16 cm Breite).
- Fixtures neu aufnehmen mit `physical_dimensions`, `pagination`, `weight` in `EDITION_FIELDS`, dazu Tests für den Parser (Reihenfolge, Einheiten, der 198-mm-Fall, der fehlende dritte Wert).

**Formulierung auf der Seite (N12, nie mehr behaupten als geprüft):**
- Pro Buch eine kurze Herkunft: „19 cm hoch laut Deutscher Nationalbibliothek; Breite aus dem Coverbild geschätzt“ / „Maße laut Open Library“ / „Format nicht verzeichnet – als Taschenbuch angenommen“.
- Für das Werk: „etwa 62–66 × 48–51 cm; für 3 von 8 Büchern kennen wir das Format nicht“. Keine einzelne Zahl, solange ein Maß geschätzt ist.
- Eine nicht beantwortete Katalog-Anfrage heißt „nicht nachgesehen“, nie „kein Maß verzeichnet“ (wie `lookUpPrinting`, das bei Ausfall wirft).
- Kein „genaue Maße“ oder „passgenau“. Vor einer Bestellung misst jemand die echten Bücher; das sollte die Seite so sagen.

## Quellen

Abgerufen am 2026-09-28.

- Open Library Editions-API, z. B. https://openlibrary.org/works/OL468431W/editions.json?limit=100&offset=200 (7 Seiten, siehe oben)
- Open Library Covers-API, z. B. https://covers.openlibrary.org/b/id/425906.json
- Open Library ISBN-API, z. B. https://openlibrary.org/isbn/9781408834978.json
- Open Library Issue „Amazon Product Advertising API deprecated April 30, 2026“: https://github.com/internetarchive/openlibrary/issues/12255
- Google Books API, Referenz `volumes`: https://developers.google.com/books/docs/v1/reference/volumes
- DNB SRU: https://www.dnb.de/DE/Professionell/Metadatendienste/Datenbezug/SRU/sru_node.html ; Abfrage z. B. https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=num%3D3518110063&recordSchema=MARC21-xml
- DNB, Metadaten unter CC0: https://www.dnb.de/DE/Ueber-uns/Presse/ArchivPM2015/metadatenCC0.html
- BnF SRU: https://api.bnf.fr/fr/api-sru-catalogue-general ; Wiederverwendung: https://www.bnf.fr/fr/reutiliser-les-donnees-de-la-bnf ; Abfrage z. B. https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=bib.isbn%20adj%20%222070302822%22&recordSchema=unimarcxchange
- Library of Congress SRU, Abfrage z. B. http://lx2.loc.gov:210/lcdb?version=1.1&operation=searchRetrieve&query=bath.isbn=0743273567&recordSchema=marcxml
- ISBNdb: https://isbndb.com/isbndb-api-documentation-v2 (403 beim Abruf), https://isbndb.com/faq ; Preise nur aus Suchergebnissen, u. a. https://www.vinzius.com/post/free-and-paid-api-isbn/ und https://bookscouter.com/blog/book-databases/ (nicht verifiziert)
- Amazon PA-API 5, ItemInfo: https://webservices.amazon.com/paapi5/documentation/item-info.html ; Abkündigung: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation
- ONIX Codeliste 48 (Measure type): https://ns.editeur.org/onix/en/48 ; EDItEUR Application Note „Weights and dimensions in ONIX“: https://www.editeur.org/files/ONIX%203/APPNOTE%20Weights%20and%20dimensions%20in%20ONIX.pdf
- Repository: `data/cover-measures.json` (gemessen 2026-09-27), `data/collections.json`, `lib/__fixtures__/`, `scripts/record-fixtures.ts`, `lib/walls/printings.ts`, `lib/walls/model.ts`
