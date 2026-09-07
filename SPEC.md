# Beautiful Books – Spezifikation

Stand: 2026-09-06. Erstellt aus dem vorhandenen Code. **Entscheidung: Option A**, Datenschicht neu nach dieser Spec, UI behalten (siehe Abschnitt 7).

Abschnitte 1–4 beschreiben das Produkt so, wie es gemeint ist (Soll). Abschnitt 5 ist der Befund des vorhandenen Codes (Ist). Abschnitt 6 hält die getroffenen Entscheidungen fest, Abschnitt 7 den Umsetzungsplan, Abschnitt 8 die Roadmap für die Zeit danach.

---

## 1. Produktidee

Eine visuelle Buchsuche: Man gibt einen Titel (oder Titel + Autor) ein und bekommt pro **Buch** eine Karte mit einem Mosaik seiner Cover. Ein Klick öffnet die Detailseite mit **allen Ausgaben** dieses Buchs, nach Sprache gruppiert, mit Metadaten und Kauf-Links pro Ausgabe.

Kernwert: *Alle Cover eines Buchs an einem Ort sehen und die schönste Ausgabe finden.*

Nicht Teil des Produkts (bewusst): Nutzerkonten, Bewertungen, Buchrücken-Bilder (siehe `SPINE_RESEARCH.md`), eigene Buchdatenbank.

---

## 2. Domänenmodell

### 2.1 Work (Buch)

Ein Work ist das abstrakte Buch, unabhängig von Ausgabe, Sprache und Format.

| Feld | Typ | Pflicht | Herkunft |
|---|---|---|---|
| `id` | string | ja | Open-Library-Work-ID (`OL30751W`), sonst synthetisch `t:<titel>::a:<autor>` |
| `title` | string | ja | Titel der Primärquelle |
| `authors` | string[] | ja (≥1) | Autorennamen. Übersetzer werden auf der Detailseite über die Ausgaben erkannt (§7 Schritt 7); Open Library führt sie ohne Rolle unter den Autoren |
| `authorKeys` | string[] | nein | Open-Library-Autoren-Keys, zu `authors` ausgerichtet; Grundlage der Übersetzer-Erkennung |
| `firstPublishYear` | number | nein | Open Library |
| `editionCount` | number | nein | Gesamtzahl bei der Quelle, nicht nur die geladenen |

**Identitätsregel:** Zwei Ausgaben gehören zum selben Work, wenn
1. beide dieselbe Open-Library-Work-ID haben, **oder**
2. normalisierter Titel **und** normalisierter Erstautor übereinstimmen.

Sprache ist **kein** Teil der Work-Identität. Übersetzungen sind Ausgaben desselben Works.

Normalisierung: lowercase, Diakritika entfernen, Satzzeichen entfernen, Whitespace zusammenfassen, führende Artikel (`the`, `a`, `der`, `die`, `das`, `le`, `la`) entfernen, Untertitel nach `:` abschneiden.

### 2.2 Edition (Ausgabe)

Eine konkret veröffentlichte Ausgabe mit eigenem Cover.

| Feld | Typ | Pflicht | Bemerkung |
|---|---|---|---|
| `id` | string | ja | `ol:OL123M` oder `gb:abc123` |
| `workId` | string | ja | Referenz auf Work |
| `source` | `'openlibrary' \| 'googlebooks'` | ja | |
| `title` | string | ja | Titel dieser Ausgabe (kann vom Work-Titel abweichen, z. B. Übersetzung) |
| `coverUrl` | string | **ja** | Ausgaben ohne Cover werden nie angezeigt |
| `coverUrlSmall` | string | nein | Für Mosaik / Grid |
| `language` | string (ISO 639-1) | nein | `en`, `de`, … Unbekannt = `undefined`, nicht `'unknown'` |
| `publisher` | string | nein | |
| `publishedDate` | string | nein | Rohformat der Quelle; `year` separat |
| `year` | number | nein | Geparst aus `publishedDate` |
| `isbn13` | string | nein | Bevorzugt |
| `isbn10` | string | nein | |
| `pageCount` | number | nein | |
| `format` | `'hardcover' \| 'paperback' \| 'ebook' \| 'other'` | nein | Falls erkennbar |
| `description` | string | nein | HTML entfernt |
| `previewUrl` | string | nein | Google Books |

**Dedupe-Regel für Editions:** gleiche ISBN-13 (ISBN-10 wird konvertiert) = dieselbe Ausgabe, quellenübergreifend. Ohne ISBN bleibt jede Quell-Ausgabe eigenständig. Bei Duplikaten werden die Metadaten zusammengeführt (Description > Seitenzahl > Verlag), **die Cover beider Quellen bleiben erhalten** (siehe 2.3).

### 2.3 Cover (Entscheidung E8)

Ein Cover ist ein Bild, das eine oder mehrere Ausgaben tragen. Es ist die zentrale Entität des Produkts und **nicht** durch die ISBN bestimmt: Verlage drucken Backlist-Titel mit neuem Cover unter alter ISBN nach, und ein Cover-Design erscheint unter mehreren ISBNs (Hardcover, Paperback, Länderausgaben). Beispiel: ISBN 9780684824772 (Scribner 1996) trägt bei Open Library das gemalte Cover von 1996 und im Handel das rote 50th-Anniversary-Cover von 2022.

| Feld | Typ | Bemerkung |
|---|---|---|
| `id` | string | `ol:<cover_i>` oder `gb:<volumeId>` |
| `url`, `urlSmall` | string | Bild in groß und klein |
| `source` | Source | |
| `editionIds` | string[] | Ausgaben, die dieses Cover tragen, ≥1 |

Regeln:
- **Dedupe nach Bild, nicht nach ISBN.** Zwei Cover-IDs sind zwei Cover, auch bei gleicher ISBN. Zwei Ausgaben mit gleicher ISBN werden zu einer Ausgabe, behalten aber alle ihre Cover.
- Open Library liefert pro Ausgabe ein `covers`-Array; **alle** gültigen IDs werden übernommen (Gatsby und Austen haben Ausgaben mit mehreren).
- Cover derselben Ausgabe aus zwei Quellen können dasselbe Bild sein oder nicht. Phase 1: beide zeigen, unter der ISBN gruppiert. Phase 2 (8.5/8.6): perzeptueller Hash serverseitig, gecacht pro Cover, um echte Duplikate zu falten.
- Detailseite zeigt Cover (F2); die Ausgaben mit Kauf-Links hängen am Cover. Mosaik (F4) nimmt Cover.

### 2.4 Kauf-Links

Werden **nicht gespeichert**, sondern zur Anzeige aus der ISBN generiert. Anbieter-Liste ist eine Konfiguration (Name, URL-Template, optional Affiliate-Parameter).

Startliste: Bookshop.org, Amazon, AbeBooks. **Book Depository entfällt** (seit 2023 geschlossen).

**Markt (E9).** Ein Nutzer hat einen Markt: `us` (Default), `uk`, `de`; weitere später (`fr`, `ca`, `au`). Der Markt bestimmt Händlerliste, Reihenfolge, Amazon-Domain und Affiliate-Tag. Erkennung: Vercel-Geo-Header, sonst `Accept-Language`; Nutzer kann im Footer umschalten, Wahl in Cookie/localStorage. Händler pro Markt:

| Markt | Händler (Reihenfolge) | Amazon |
|---|---|---|
| `us` | Bookshop.org, Amazon, AbeBooks, ThriftBooks, eBay | amazon.com |
| `uk` | Bookshop.org UK, Amazon, Blackwell's, Waterstones, AbeBooks, World of Books | amazon.co.uk |
| `de` | Thalia, genialokal, Amazon, Hugendubel, AbeBooks, Booklooker (antiquarisch) | amazon.de |

Links sind ISBN-basiert (Amazon `/dp/<ISBN-10>`, sonst Händler-ISBN-Suche); Suchwege ohne ISBN nach 8.5. Die Konfiguration lebt in `lib/buylinks.ts` als Tabelle Markt → Händler, ohne Logik in den Komponenten.

Ein Kauf-Link führt zur **ISBN**, nicht zum Cover (2.3). Der Link-Text sagt das: „Copies of ISBN … (cover may differ)“, mit Verlag und Jahr der gezeigten Ausgabe als Orientierung. Bei AbeBooks und eBay gehen Jahr und Verlag zusätzlich als Suchparameter mit, damit Sammler den richtigen Druck finden.

---

## 3. Funktionale Anforderungen

### F1 – Suche

- **F1.1** Eingabe: Freitext. Der Text wird an beide Quellen geschickt; Autorennamen im Query werden nicht speziell geparst (siehe Entscheidung E3).
- **F1.2** Sprachfilter: `all | en | de | fr | es | it | …`. Default: **`all`** (entschieden, E2). Der Filter wirkt auf die Ausgaben, nicht auf die Works: ein Work erscheint, wenn es mindestens eine Ausgabe in der Sprache hat.
- **F1.3** Ergebnis: Liste von Works, sortiert nach Relevanz. Pro Work: Titel, Autor(en), Erstveröffentlichung, Anzahl Ausgaben, bis zu 4 Cover-URLs für das Mosaik. Erstes Cover aus Open Library (`cover_i`), weitere aus Google-Books-Treffern, die per Titel+Autor demselben Work zugeordnet werden (E4/E5).
- **F1.4** Relevanz: exakter Titeltreffer > Titel beginnt mit Query > Query im Titel enthalten. Zusatzpunkte für Anzahl Ausgaben (gedeckelt). Sekundärliteratur („A Study Guide for …") rangiert unter dem Werk selbst.
- **F1.5** URL-Zustand: `/?q=…&lang=…`. Back-Button und Teilen funktionieren.
- **F1.6** Kürzlich gesucht (localStorage, max. 5) und kuratierte Vorschläge.
- **F1.7** Zustände: leer, lädt, Fehler, keine Treffer.

**Akzeptanzkriterien (Testfälle, gegen echte APIs, als Snapshot einzufrieren):**

| Query | Erwartung |
|---|---|
| `mumbo jumbo` | Erster Treffer: *Mumbo Jumbo* von Ishmael Reed, ≥20 Ausgaben laut Quelle, davon ≥5 mit Cover (Stand 2026-09: 8 von 23). Kathryn Lasky, Francis Wheen usw. als **eigene** Works, nicht gemischt. |
| `1984` | *Nineteen Eighty-Four* (OL1168083W, >500 Ausgaben) an erster Stelle, nicht die Übersetzungs- oder Adaptions-Works mit Orwell als Autor (Stand 2026-09-06 steht das 8-Ausgaben-Work „1984“ vorn, siehe §9.1). Deutsche/französische Ausgaben in derselben Karte, nicht als eigenes Work. |
| `gravity's rainbow` | Pynchons Roman vor allen Study Guides. |
| `the great gatsby` | Ein Work, kein Duplikat durch Google Books vs. Open Library. |
| `pride and prejudice` | Ein Work Austen; Adaptionen/Zombies etc. getrennt. |

### F2 – Detailseite `/book/[workId]`

- **F2.1** Route nimmt eine **Work-ID**, nicht eine Editions-ID (heute: Editions-ID, siehe 5.3).
- **F2.2** Lädt alle Ausgaben des Works aus beiden Quellen, führt gleiche ISBNs zusammen und behält alle Cover (2.3). Zusätzlich pro bekannter ISBN das aktuelle Cover bei Google Books nachschlagen (`isbn:`-Suche), damit Neudrucke mit neuem Cover unter alter ISBN sichtbar werden.
- **F2.3** **Cover** gruppiert nach Sprache als Tabs (Sprache = Sprache der Ausgaben, die das Cover tragen). Reihenfolge: Sprache des Suchfilters (falls gesetzt) zuerst, dann nach Anzahl absteigend. Ausgaben ohne Sprache in Tab „Unbekannt" am Ende.
- **F2.4** Innerhalb eines Tabs sortiert nach Jahr absteigend.
- **F2.5** Klick auf ein Cover zeigt es groß und darunter die Ausgabe(n), die es tragen: Verlag, Jahr, Seiten, ISBN, Beschreibung, Kauf-Links, Vorschau-Link. Trägt eine ISBN mehrere Cover, wird das an der Ausgabe gezeigt („also printed with 1 other cover“).
- **F2.6** Ausgewähltes Cover in der URL (`?cover=…`), damit verlinkbar.
- **F2.7** Zurück-Link führt zur Suche mit erhaltenem Query.

### F3 – Datenquellen

- **F3.1 Open Library** (primär): Suche `/search.json`, Ausgaben `/works/{id}/editions.json`, Cover `covers.openlibrary.org/b/id/{id}-{S|M|L}.jpg`.
  - Der Editions-Endpoint liefert Autoren **nur als Keys** (`/authors/OL242325A`), keine Namen. Autorennamen für Ausgaben werden vom Work übernommen, nicht pro Ausgabe geprüft.
  - `author_name` im Suchergebnis enthält Duplikate und Übersetzer; nur der erste Eintrag ist der Erstautor.
- **Google-Bild-URLs:** Nur `zoom=1` (und 5) kommen aus Googles Cover-Datenbank. `zoom=2` und höher liefern eine Seite aus dem Buch-Scan, die eine Schmutztitelseite statt des Covers sein kann (beobachtet bei 9780684824772). Größere Cover per `zoom=1&fife=w800`; `fife` deckelt auf die native Größe.
- **F3.2 Google Books** (sekundär, nur ergänzend): Suche `volumes?q=intitle:…`. Liefert keine Work-Gruppierung und **erzeugt deshalb nie eigene Works**. Google-Treffer werden per Titel+Erstautor einem Open-Library-Work zugeordnet; Treffer ohne passendes Work werden verworfen. Rolle: (a) bei der Suche zusätzliche Cover fürs Mosaik, (b) auf der Detailseite zusätzliche Ausgaben, Beschreibungen und Vorschau-Links.
  - **Quota:** Ohne API-Key teilt sich die App das anonyme Tageskontingent mit allen anderen anonymen Nutzern und bekommt regelmäßig `429 Quota exceeded` (beobachtet 2026-09-06 für jede Anfrage). Ein eigener Key (kostenlos, Google-Cloud-Projekt, 1.000 Anfragen/Tag) ist Voraussetzung, sobald Google Books in Produktion genutzt wird. Environment-Variable `GOOGLE_BOOKS_API_KEY`; ohne Key läuft die App mit Open Library allein.
- **F3.3** Jede Quelle ist unabhängig ausfallsicher: Fehler oder Timeout einer Quelle bei der **Suche** führen zu Teilergebnissen, nicht zu einem Fehler. Timeouts: Suche 8 s, Work 5 s, Editions 12 s. Open Library braucht aus Deutschland regelmäßig 2–7 s für eine Suche und 3–10 s für eine Editions-Seite; mit 5 s liefen im Test Suchen ins Leere. Der Next-Cache (N4) macht Wiederholungen schnell. Auf der Detailseite unterscheidet der Client „nicht gefunden“ (404, ergibt null bzw. leer) von „nicht erreichbar“ (Fehler wird geworfen), damit die Seite den richtigen Zustand zeigt.
- **F3.4** Hörbücher, Zeitschriften, Proceedings werden herausgefiltert.

### F4 – Cover-Mosaik

- 1 Cover: voll. 2: nebeneinander. 3: eines groß links, zwei rechts. ≥4: 2×2.
- Bevorzugt werden Cover **verschiedener** Ausgaben mit unterschiedlichen Cover-IDs (kein viermal dasselbe Bild).
- Fallback ohne Cover: Platzhalter. (Sollte durch F2/F3 nie eintreten.)

---

## 4. Nicht-funktionale Anforderungen

- **N1 Server-seitig fetchen.** Externe APIs werden ausschließlich vom Server aufgerufen (Route Handler oder Server Components). Heute ruft der Browser die APIs direkt auf.
- **N2 Kein Fan-out bei der Suche.** Die Suche macht **zwei** externe Calls (OL + GB), nicht 2 + 2×Anzahl Works. Cover fürs Mosaik kommen aus den Suchergebnissen selbst: OL liefert ein Cover pro Work, Google Books liefert weitere (E4). Ein Work mit nur einem bekannten Cover zeigt ein einzelnes Cover, kein Mosaik.
- **N3 Antwortzeit.** Suche < 3 s im Normalfall. Open Library kann > 30 s brauchen; deshalb Timeouts und Caching.
- **N4 Caching.** Suchergebnisse 1 h, Work-Details 24 h. Mechanismus: Next.js `fetch` mit `revalidate`, später optional KV.
- **N5 Kein Logging im Produktpfad.** Debug-Ausgaben nur über `DEBUG`-Flag.
- **N6 Typen.** `tsc --noEmit` ohne Fehler, keine `any` in `lib/`.
- **N7 Tests.** Unit-Tests für Normalisierung, Work-Identität, Dedupe, Relevanz (mit fixtures). Ein Integrationstest pro Akzeptanz-Query aus F1 mit aufgezeichneten API-Antworten.
- **N8 Bilder.** Cover über `next/image` mit erlaubten Remote-Hosts, kleine Größe im Grid, große nur auf der Detailseite. **Wichtig:** `covers.openlibrary.org` antwortet nur mit einer Weiterleitung auf archive.org, und dort werden Bilder unter Last langsam oder gar nicht ausgeliefert (beobachtet 2026-09-06: bei 18 gleichzeitigen Cover-Anfragen der Austen-Suche kamen nach 15 s nur die Google-Bilder; einzeln dauert ein Cover 0,5–1,2 s). Dazu dokumentiert Open Library Rate-Limits für Cover-Lookups per ISBN. Deshalb (a) Bild-Fehler-Fallback in der UI (erledigt, `CoverImage`), (b) vor dem Launch Cover durch einen eigenen Cache liefern: Next-Image-Optimizer mit Remote-Pattern oder ein Bild-Proxy mit CDN-Cache, damit wiederholte Anfragen nicht mehr bei Open Library landen (8.2).

---

## 5. Befund: der vorhandene Code

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

## 6. Entscheidungen

Getroffen am 2026-09-06.

| # | Frage | Entscheidung | Konsequenz |
|---|---|---|---|
| E1 | Umfang | **Option A**: Datenschicht neu, UI behalten | Abschnitt 7 |
| E2 | Sprachfilter-Default | **`all`** | F1.2; API-Route und UI bekommen denselben Default |
| E3 | Query in Titel + Autor zerlegen | **Nein**, vorerst | Relevanz-Ranking (F1.4) muss allein tragen. Vorgemerkt als F1.8 in 8.5 |
| E4 | Mosaik-Cover ohne Fan-out | **(b)** Google-Books-Cover als 2.–4. Bild | F1.3, N2 |
| E5 | Google Books in der Suche | **Nur ergänzend**: liefert Cover für OL-Works, erzeugt keine eigenen Works. Volle Rolle nur auf der Detailseite | F3.2. Löst den scheinbaren Konflikt mit E4 |
| E6 | Caching-Backend | Next-`fetch`-Cache, kein KV | N4 |
| E7 | Sprache der Doku | Spec Deutsch, Code und Kommentare Englisch | |
| E9 | Märkte (2026-09-06) | **Die Site bedient mehrere Märkte, der englischsprachige zuerst.** Kauf-Links, Händler und Affiliate-Konten sind pro Markt konfiguriert; der Markt wird aus Sprache/Region erkannt und ist vom Nutzer umschaltbar. Die Oberfläche bleibt Englisch. | §2.4, 8.3, 8.5 |
| E8 | Cover-Identität (2026-09-06) | **Cover ist eigene Entität, Dedupe nach Bild statt ISBN.** ISBN identifiziert ein Verlagsprodukt, nicht ein Cover; Neudrucke wechseln das Cover bei gleicher ISBN. | §2.3, F2, §7 Schritt 6, §8.3 Bild-Quellen |

---

## 7. Umsetzungsplan (Option A)

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

## 8. Roadmap nach Option A

Reihenfolge ist Vorschlag: erst 8.1 und 8.2 (sichtbar und online), dann 8.3 (Geld), dann 8.4 (Reichweite). Ohne Traffic bringen Kauf-Links nichts, ohne Online-Version kein Traffic.

### 8.1 Moderneres Design

*Erster Durchgang erledigt 2026-09-06 (Commit „Design pass“). Leitidee umgesetzt: Galerie statt Shop.*

**Designsystem** (`app/globals.css`, Tailwind-4-Tokens über `@theme inline`):
- Farben: warmes Papier (`#f4f0e8`) mit Off-Black-Tinte, Dark Mode als warmes Schwarz (`#131110`) mit heller Tinte, beides über `prefers-color-scheme`. Eine Akzentfarbe, Terrakotta (`#b1502b` hell, `#e6a677` dunkel). Kein Verlauf im Hintergrund.
- Typografie: Fraunces (Variable Font, optische Größe) für Titel und Wortmarke, Geist Sans für UI, Geist Mono für ISBNs. Basis 15 px.
- Bausteine: `.chip` (Sprach- und Tab-Chips), `.btn` / `.btn-accent`, `.kicker` (Kapitälchen-Label), `.cover-shadow` (Kontaktlinie plus weicher Schlagschatten), `.cover-img` (Einblenden nach Laden). Fokus-Ringe in Akzentfarbe, `prefers-reduced-motion` respektiert.

**Erledigt:**
- [x] Farbpalette, Typografie, Dark Mode, 8-px-Raster
- [x] Startseite: Hero mit einem Satz Wertversprechen, großes Suchfeld, Sprache als Chips unter dem Feld (kein Dropdown mehr), kuratierte Cover-Wand mit zwölf Klassikern statt leerem Zustand (`lib/curated.ts`)
- [x] Ergebnisraster: Karten ohne Rahmen, nur Cover mit Buchschatten und zwei Zeilen Text; Hover hebt die Karte und zeigt Ausgaben- und Sprachanzahl
- [x] Detailseite: Cover-Wand links (zwei Drittel), gewähltes Cover mit Ausgabe als sticky Seitenleiste rechts; Sprach-Tabs als Chips; Metadaten als Definitionsliste; Kauf-Links als ruhige Buttons mit Hinweistext; Teilen-Button kopiert die URL
- [x] Ladezustände: Skeletons in Cover-Proportion, Cover blenden nach dem Laden ein, Fehler-Fallback ohne Alt-Text-Kasten
- [x] Mobil: Raster zweispaltig, Detailseite einspaltig mit Seitenleiste unter der Wand
- [x] Zugänglichkeit: Alt-Texte mit Verlag und Jahr, `role=tablist`/`tab`, `aria-pressed` auf Chips und Covern, Fokus-Ringe

**Offen für einen zweiten Durchgang:**
- [x] **Ladeszene statt Skeleton (Idee Julian, 2026-09-06).** *Umgesetzt 2026-09-06:* Karten geben Titel, Autor und Cover per sessionStorage an die Detailseite (`useWorkPreview`), die sofort Titel und Hero-Cover zeigt. Die Work-Route hat eine Stufe `stage=fast` ohne Hashing; die Seite lädt erst diese, zeigt die ersten eintreffenden Cover als Fächer auf der Bühne (`LoadingStage`, bis zu vier, `stage-in`-Animation) und schaltet in die Galerie, sobald mindestens zwei Cover vollständig eingeblendet sind und die gefaltete Antwort da ist, sonst nach dem vierten Cover (`useLoadingScene`: Takt 520 ms pro Cover, 650 ms Einblendung, Kacheln 1,5-fach, Positionen als CSS-Variablen, damit die Animation den Fächer nicht überschreibt; Nachjustierung Julian 2026-09-06), wobei die Bühnen-Cover per FLIP auf ihre Kacheln fliegen (`flyCovers`, Web Animations API, respektiert `prefers-reduced-motion`). Parallel läuft `stage=full` mit Faltung; die Galerie tauscht die Daten aus, die Meta-Zeile sagt solange „tidying duplicates“. Bei warmem Cache endet die Szene sofort. Offen: der Austausch fast → full kann Kacheln umsortieren; ein sanfter Übergang dafür gehört in den zweiten Durchgang. Die Detailseite lädt 2–6 s. Statt einer leeren Seite, die sich langsam füllt: die ersten eintreffenden Cover groß in Szene setzen oder animiert auf ihre Plätze fliegen lassen, bis vier Ergebnisse da sind, dann in den klickbaren Modus umschalten. Nebeneffekt: mehr Zeit für das Hashing, das dann vor dem ersten Klick fertig ist. Technisch: die Work-Route als Stream (Ausgaben zuerst, Cover in Chargen, gefaltete Cover zuletzt) oder zwei Aufrufe (schnell ohne Hash, dann mit); Client mit View Transitions oder Framer Motion für den Flug auf die Slots.
- [ ] Cover-Vergleich: zwei Ausgaben nebeneinander
- [ ] View Transitions zwischen Karte und Detailseite (Cover „fliegt“ mit)
- [ ] Detailseite mobil: horizontal scrollbare Cover-Wand, Seitenleiste als Drawer
- [ ] Sticky-Suchfeld auf Mobil
- [ ] About-Seite, Footer-Links (Impressum, Datenschutz, Affiliate-Hinweis, siehe 8.2)
- [ ] Feinjustierung nach Nutzung: Größe der Cover-Kacheln auf der Detailseite, Kontrast der Chips im Dark Mode

### 8.2 Hosting und Deployment

**Empfehlung:** Vercel, Domain bei einem neutralen Registrar, DNS über Cloudflare.

**Achtung Plan-Wahl:** Der kostenlose Vercel-Hobby-Plan ist laut Nutzungsbedingungen nur für nicht-kommerzielle Nutzung. Sobald Affiliate-Links live sind, braucht es Vercel Pro (20 USD/Monat) oder eine andere Plattform. Alternativen: Cloudflare Pages (kostenlos, kommerziell erlaubt, Next.js über OpenNext-Adapter) oder Hetzner-VPS (~4 EUR/Monat) mit Coolify. Vorschlag: Hobby bis zum ersten Affiliate-Link, dann entscheiden.

**Serverstandort und Recht:** Impressum und Datenschutzerklärung hängen am Betreiber (Sitz in Deutschland, EU-Nutzer), nicht am Server. Ein Server außerhalb der EU vermeidet nichts, sondern fügt einen Drittlandtransfer hinzu, der in der Datenschutzerklärung begründet werden muss. Frankfurt hält diesen Absatz nur kürzer.

- [ ] **Domain**
  - [ ] Namen prüfen und kaufen (Kandidaten: beautifulbooks.*, everyedition.*, coverwall.*; `.com` bevorzugt, `.app` oder `.io` als Ausweichlösung). Registrar: Cloudflare Registrar (Einkaufspreis, kein Aufschlag) oder INWX (Deutschland).
  - [ ] DNS bei Cloudflare, Proxy **aus** für Vercel-Records (sonst doppelte Caching-Schicht mit Problemen).
- [ ] **Vercel-Projekt**
  - [ ] GitHub-Repo verbinden, `main` = Production, jeder Branch = Preview-URL.
  - [ ] Environment-Variablen: Affiliate-IDs (8.3), optional Google-Books-API-Key (höheres Rate-Limit), `DEBUG`.
  - [ ] Region: `fra1` (Frankfurt), da Open Library aus Europa ohnehin langsam ist und die Nutzer vermutlich hier sind.
  - [ ] Vercel Analytics (kostenlos, cookie-frei) und Speed Insights aktivieren.
- [ ] **Caching in Produktion**
  - [ ] `fetch` mit `next: { revalidate: 3600 }` für Suchen, 86400 für Works. Läuft im Vercel Data Cache ohne Zusatz-Infrastruktur.
  - [ ] Erst bei spürbarem Traffic: Upstash Redis (Free Tier) für geteilten Cache und für „beliebte Suchen".
- [ ] **Betrieb**
  - [ ] Fehler-Tracking: Sentry Free Tier oder erst mal nur Vercel Logs.
  - [ ] Uptime: UptimeRobot (kostenlos) auf `/api/search?q=1984`.
  - [ ] `robots.txt`, `sitemap.xml` (dynamisch aus kuratierten Works, siehe 8.4).
  - [ ] Rate-Limit auf den API-Routen (Vercel Firewall oder einfacher In-Memory-Limiter), sonst zahlst du für Bots.
- [ ] **Rechtliches (Deutschland, nötig ab dem ersten Affiliate-Link)**
  - [ ] Impressum (§ 5 DDG). Pflicht für jede nicht rein private Website, mit Affiliate-Links ohnehin. Privatadresse vermeidbar über Impressum-Service mit c/o-Adresse (~5–10 EUR/Monat).
  - [ ] Datenschutzerklärung (DSGVO, auch ohne Affiliate-Links nötig): Hosting/IP-Adressen, Vercel Analytics, Cover-Bilder von Drittservern (Open Library, Google), localStorage, ggf. Drittlandtransfer bei US-Hosting (Vercel ist im EU-US Data Privacy Framework). Generator: e-recht24 oder IHK.
  - [ ] Affiliate-Hinweis auf jeder Seite mit Links (Amazon verlangt einen konkreten Wortlaut).
  - [ ] Kein Cookie-Banner nötig, solange nur Vercel Analytics und keine Tracking-Cookies.

### 8.3 Kauf-Links mit Provision

**Prinzip:** Links werden aus der ISBN generiert (`lib/buylinks.ts`), Affiliate-Parameter kommen aus Environment-Variablen, **pro Markt** (E9): `AFFILIATE_AMAZON_TAG_US`, `_UK`, `_DE`, `AFFILIATE_BOOKSHOP_ID_US`, `_UK` usw. Ohne gesetzte Variable wird der neutrale Link erzeugt, damit die Seite auch vor der Freischaltung funktioniert. Reihenfolge der Beantragung: erst US (Amazon Associates, Bookshop.org US, AbeBooks), dann UK (Amazon UK, Bookshop.org UK, Awin für Blackwell's/Waterstones), dann DE (Amazon PartnerNet, Awin/Adcell für Thalia und Hugendubel, genialokal).

- [ ] **Anbieter-Konfiguration bauen** (Teil von Option A, Schritt 7)
  - [ ] Struktur: `{ id, label, region, urlFromIsbn(isbn, affiliateId), affiliateEnv }`.
  - [ ] Reihenfolge der Links nach Region des Nutzers (`Accept-Language` bzw. Vercel-Geo-Header): DE-Nutzer sehen Thalia/genialokal/Amazon.de zuerst, EN-Nutzer Bookshop.org/Amazon.com.
  - [ ] Klick-Tracking: `/go/[provider]/[isbn]` als eigene Route, die zählt und weiterleitet. Ohne Zahlen keine Optimierung.
- [ ] **Programme beantragen** (Freischaltung dauert Tage bis Wochen, früh starten)
  - [ ] **Amazon PartnerNet (DE) / Associates (US)**: höchste Abdeckung, ~1–4,5 % auf Bücher. Zweiter Grund für das Konto: die **Product Advertising API** liefert zur ISBN das aktuelle Produktbild, also genau das Cover, das der Handel gerade ausliefert (E8). Ohne Associates-Konto gibt es keinen legalen Zugang zu Amazon-Bildern. Voraussetzung: öffentlich erreichbare Seite mit Inhalt, drei qualifizierte Verkäufe in den ersten 180 Tagen, sonst Kontosperrung. Also erst beantragen, wenn 8.2 steht und etwas Traffic da ist. Pro Marktplatz ein eigenes Konto (`.de`, `.com`, `.co.uk`).
  - [ ] **Bookshop.org** (US/UK, auch DE seit 2024 im Aufbau): ~10 % Provision, unterstützt unabhängige Buchhandlungen. Passt zur Zielgruppe „Menschen, die schöne Bücher mögen" besser als Amazon.
  - [ ] **AbeBooks**: eigenes Partnerprogramm (über Impact-Netzwerk), wichtig für vergriffene und antiquarische Ausgaben, also genau die mit den interessanten Covern.
  - [ ] **Thalia / Hugendubel / genialokal** (Deutschland): über Affiliate-Netzwerke (Awin, Adcell). Für deutsche Nutzer die naheliegende Wahl.
  - [ ] **eBay Partner Network**: für seltene Ausgaben und Erstausgaben.
- [ ] **Pflichten**
  - [ ] Affiliate-Disclosure auf Seite und in Nähe der Links (8.2).
  - [ ] Amazon: keine Preise cachen/anzeigen ohne deren API, keine Links in E-Mails, Hinweis-Wortlaut einhalten.
  - [ ] Steuerlich: Affiliate-Einnahmen sind Einkünfte aus Gewerbebetrieb, ab Absicht Gewerbeanmeldung. Kleinunternehmerregelung prüfen.
- [ ] **Messen**
  - [ ] Klicks pro Anbieter und Work aus `/go/`-Route.
  - [ ] Conversion aus den Partner-Dashboards manuell monatlich in eine Tabelle.
  - [ ] Nach drei Monaten: Anbieter ohne Conversion nach hinten sortieren.

### 8.4 Traffic

**Realistische Einschätzung:** Eine Suchseite ohne eigene Inhalte bekommt keinen organischen Traffic, weil Google nichts zu indexieren hat. Die Strategie muss aus der Suche **Seiten** machen, die Suchbegriffe bedienen, und das Visuelle auf Plattformen ausspielen, die visuell sind.

- [ ] **SEO über statische Work-Seiten** (größter Hebel, ergibt sich fast von selbst aus Option A)
  - [ ] Route `/book/[workId]/[slug]` mit ISR: jede einmal besuchte Detailseite wird statisch und indexierbar.
  - [ ] Seitentitel nach Muster „Alle Cover von *1984* (George Orwell) – 47 Ausgaben in 6 Sprachen". Das ist der Suchbegriff, den Leute tatsächlich eingeben („1984 book covers", „1984 editions").
  - [ ] Schema.org `Book` + `hasPart` für Editions, `ImageObject` für Cover.
  - [ ] Open-Graph-Bild: das Cover-Mosaik als generiertes Bild (`next/og`). Das ist der Grund, warum Links geteilt werden.
  - [ ] Sitemap aus einer kuratierten Liste von ~500 Works (Klassiker, Bestseller, Bücher mit vielen Ausgaben), beim Build vorgerendert.
  - [ ] Interne Verlinkung: „Weitere Bücher von …", „Andere Ausgaben dieses Verlags".
- [ ] **Redaktionelle Seiten** (wenig Aufwand, hoher SEO-Wert)
  - [ ] Listen: „Die schönsten Ausgaben von Pride and Prejudice", „Penguin Clothbound Classics: alle Cover", „Alle Ausgaben von Gravity's Rainbow im Vergleich".
  - [ ] Eine Seite pro Reihe (Penguin Clothbound, Everyman's Library, Folio Society, Suhrkamp Bibliothek, Manesse). Reihen haben Sammler, Sammler suchen.
  - [ ] Frequenz: eine Seite pro Woche reicht. Mit Claude als Rechercheassistent ist das eine Stunde.
- [ ] **Visuelle Plattformen** (zur Zielgruppe passend)
  - [ ] **Pinterest**: Cover-Mosaike als Pins, jeder Pin verlinkt auf die Work-Seite. Pinterest ist für „book cover design" eine der größten Traffic-Quellen überhaupt und Pins leben Monate.
  - [ ] **Instagram / TikTok**: kurze Clips „Alle 30 Cover von Dune in 15 Sekunden". Automatisierbar aus den Daten.
  - [ ] **Reddit**: r/bookcovers, r/books, r/Bookshelf, r/coverdesign. Nicht spammen, sondern bei „welche Ausgabe soll ich kaufen?"-Fragen die Vergleichsseite verlinken.
- [ ] **Launch-Momente** (einmalig, aber messbar)
  - [ ] Hacker News „Show HN“ (Programmierer-Publikum mag Open-Library-Projekte), Product Hunt, r/InternetIsBeautiful.
  - [ ] Book-Blogger und BookTok-Accounts direkt anschreiben, mit vorbereitetem Vergleichslink zu „ihrem“ Buch.
- [ ] **Bindung**
  - [ ] Newsletter „Cover der Woche" (Buttondown oder Resend, kostenlos bis 1.000 Abonnenten).
  - [ ] „Benachrichtige mich bei neuer Ausgabe" pro Work: sammelt E-Mails mit klarem Nutzen.
- [ ] **Messen**
  - [ ] Google Search Console ab Tag 1, Bing Webmaster Tools.
  - [ ] Vercel Analytics: Referrer pro Kanal. Nach 8 Wochen entscheiden, welche zwei Kanäle bleiben.

### 8.5 Aus der Nutzung (2026-09-06, Julian)

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
- [ ] **Dedupe der Cover ist noch zu schwach.** *Wieder geöffnet 2026-09-06 (Julian): faltet zu wenig, Ursachen und Plan in §9.3.* *Erster Schritt erledigt 2026-09-06 mit dem Bild-Hash (unten „Richtig“): `lib/imagehash.ts` (dHash 64 Bit, Kontrastmaß), `lib/coverhash.ts` (Bilder klein laden, 8 parallel, 4 s Budget, Next-Cache 30 Tage), `foldDuplicateCovers` in `lib/works.ts` (Hamming ≤ 8 = dasselbe Bild; OL-Scan vor Google-Bild als Repräsentant; leere Scans fallen, außer sie sind das einzige Cover einer Ausgabe). Kacheln zeigen „+N“. Was im Budget nicht gehasht wird, faltet beim nächsten Aufruf, weil die Bilder dann im Cache sind.* Bei *1984* stehen mehrere identische Cover nebeneinander, mit derselben Beschriftung im Hover (z. B. dreimal derselbe Verlag und Jahr). Ursachen: Open Library hat pro Ausgabe mehrere hochgeladene Scans desselben Covers (verschiedene `cover_i`), und derselbe Druck existiert als mehrere OL-Ausgaben ohne ISBN, die wir nicht zusammenführen können.
  - Kurzfristig, ohne Bildvergleich: Cover, deren Ausgaben in Titel + Verlag + Jahr + Sprache übereinstimmen, zu **einer Kachel mit „+2 ähnliche“** zusammenfassen; die Kachel zeigt das erste Bild, die Details listen alle. Falsch-positiv möglich (echte Neugestaltung im selben Jahr beim selben Verlag), deshalb aufklappbar statt verworfen.
  - Richtig: perzeptueller Hash (dHash/pHash) serverseitig pro Cover-ID, gecacht; Hamming-Distanz ≤ Schwelle = dasselbe Bild. Schließt auch den Fall „Scan bei OL, Verlagsbild bei Google“ ab. Damit zieht Phase 2 aus E8 nach vorn.
  - Nebeneffekt: mit dem Hash lassen sich auch leere Scans erkennen (geringe Varianz) und ausblenden.

### 8.6 Funktionale Erweiterungen (aus Entscheidungen zurückgestellt)

- [ ] **F1.8** Query-Parsing in Titel + Autor (E3). Auslöser: wenn Akzeptanz-Query „gravity's rainbow" mit reinem Ranking nicht stabil ist.
- [ ] **E4 (a)** Editions-Call für die ersten 8 Treffer mit Cache, falls Google-Books-Cover zu selten zu einem 4er-Mosaik führen.
- [ ] **Cover-Duplikate über Quellen falten (E8 Phase 2).** Perzeptueller Hash (dHash/pHash) der Cover-Bilder serverseitig berechnen, pro Cover-ID cachen, Cover mit Hamming-Distanz ≤ Schwelle zusammenlegen. Auslöser: sichtbar doppelte Cover auf Detailseiten nach Aktivierung von Google Books.
- [ ] **Weitere Cover-Quellen:** ISBNdb (kostenpflichtig), Amazon PA-API (8.3), Community-Upload mit Moderation.
- [ ] **Alternativtitel desselben Works.** Identitätsregel 2 ist strikt: Google-Books-Ausgaben mit anderem Titel (*1984* vs. *Nineteen Eighty-Four*) werden dem Work nicht zugeordnet. Lösung wäre eine Titel-Alias-Liste aus den OL-Editions-Titeln des Works (die kennt man auf der Detailseite bereits). Auslöser: wenn auf Detailseiten sichtbar Google-Cover fehlen.
- [ ] Filter auf der Detailseite: Format (Hardcover/Paperback), Jahrzehnt, Verlag.
- [ ] Goodreads-CSV-Import als „Meine Bibliothek in allen Covern" (aus altem TODO).
- [ ] Redis/KV-Cache (E6), wenn Traffic da ist.

---

## 9. Analyse: eine Suche, der man vertrauen kann (2026-09-06)

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

**Schritt 10 – Ranking mit Popularität und Ableitungs-Erkennung (C).** Klein, sofort.
- OL-Suche zusätzlich mit `readinglog_count`, `want_to_read_count`, `ratings_count` abfragen (`SEARCH_FIELDS`), Felder in `WorkSummary` als `popularity`.
- Neue Relevanz: Ausgangspunkt ist die OL-Position (Platz 1 = 100, dann abfallend), plus `min(40, 8·log2(readinglog+1))`, plus Titeltreffer nur noch als Bonus von 20/10/5. Exakter Titel darf ein Work mit 100-facher Popularität nicht überholen.
- Ableitungen erkennen und um 60 abwerten: Titel mit „adaptation“, „graphic novel“, „stage“, „play“, „illustrated“ in Klammern; `SECONDARY_LITERATURE` um „sparknotes for“, „book analysis“, „for fans“, „trivia“, „quiz“, „summary of“, „festschrift“ erweitern; ein Work, dessen **Nicht-Erstautor** der Erstautor eines Works mit ≥ 10-facher Ausgabenzahl im selben Ergebnis ist, gilt als Ableitung (Dean/Orwell, Nesti/Orwell, Audiberti-Übersetzung).
- Akzeptanz: alle fünf Queries aus F1 mit den verschärften Erwartungen, dazu `beloved` → OL50548W und `harry potter` → Band 1 vor dem Pop-up-Buch.

**Schritt 11 – Vollständige Cover-Wand durch fortlaufendes Nachladen (A, F).** Der wichtigste Schritt. Umsetzungsplan in [PLAN-11.md](PLAN-11.md).
- Work-Route wird seitenweise: `GET /api/works/[id]?offset=0` liefert Work, Ausgaben und Cover der ersten OL-Seite plus Google-Kandidaten, dazu `total` (OL-Größe), `nextOffset` und pro Cover seinen Hash (`hash`, `contrast`), soweit berechnet. `?offset=100` usw. liefern nur die Ausgaben und Cover dieser Seite. Jede Seite ist einzeln im Next-Cache (24 h), ein Nutzer wärmt sie für alle.
- Die Detailseite lädt Seite 0 wie heute (Ladeszene), zeigt die Wand und lädt im Hintergrund weiter, eine Seite nach der anderen, bis `nextOffset` fehlt oder 1500 Einträge erreicht sind. Neue Cover werden angehängt, die Sprachgruppen neu berechnet; der Zähler sagt „N covers · M of K editions checked“ und am Ende „N covers from K editions“. Falten über alle Seiten passiert im Client mit `foldDuplicateCovers` (rein, läuft dort genauso) über die mitgelieferten Hashes; Cover ohne Hash bleiben ungefaltet, bis ein späterer Aufruf sie liefert.
- Sortierung innerhalb der Sprachgruppen bleibt Jahr absteigend; neu eintreffende alte Ausgaben rutschen also nach hinten, nicht nach vorn, die Wand springt nicht. Unbekanntes Jahr ganz hinten.
- `stage=fast/full` entfällt zugunsten des Seitenmodells: Seite 0 rechnet Hashes mit kleinem Budget (2 s), jede Folgeseite mit ihrem eigenen Budget; damit ist beim letzten Nachladen praktisch alles gehasht.
- Grenze: Werke mit mehr als 1500 Ausgaben (Bibel, Shakespeare-Sammlungen) werden gekappt, der Zähler sagt das.
- Persistenz: der Next-Cache reicht für den Start (8.2). Wenn Hosting steht, wandern Hashes und Seiten in KV (8.6), damit ein Deploy den Vorrat nicht löscht.

**Schritt 12 – Dedupe in drei Stufen und ohne Zeitdruck (B).** Baut auf 11 auf.
- Stufe 1, immer: Distanz ≤ 8 (wie heute).
- Stufe 2, gleiche ISBN-13 an beiden Covern: Distanz ≤ 20. Deckt OL-Scan gegen Google-Bild und Scan mit/ohne Banderole.
- Stufe 3, gleicher Verlag (normalisiert: Kleinschreibung, ohne „Verlag/Books/Press/Inc.“, Ortsangaben ab Komma) und Jahr ±1 und gleiche oder unbekannte Sprache: Distanz ≤ 16. Deckt Knopf 1987 dreimal.
- Nie über Verlagsgrenzen bei Distanz > 8 (Scribner/Lulu, türkische Layout-Familien bleiben getrennt). Nie bei verschiedenen Sprachen.
- Leere und Text-Scans (Kontrast unter Schwelle **oder** Hash aus ≤ 2 gesetzten Bytes) verschwinden aus der Wand, auch ohne Alternative; die Ausgabe bleibt in einer Liste „Editions without a usable cover“ mit ihren Links.
- Tests: die Beloved- und Gatsby-Paare oben als Fixture (Hash + Metadaten, keine Bilder), pro Stufe ein Positiv- und ein Negativfall.

**Schritt 13 – Kauf-Links mit Verifikationsgrad (E).**
- Beim Auswählen eines Covers prüft der Client `GET /api/isbn/<isbn13>`: Server holt Googles ISBN-Bild (gecacht 24 h) und OLs `/isbn/<isbn>.json`, hasht und vergleicht mit dem gezeigten Cover. Antwort: `verified` (Distanz ≤ 16), `differs` (mit URL des Handelsbildes), `unknown` (kein Bild). Ein Google-Call pro ISBN und Tag, nur auf Auswahl, das passt ins Kontingent.
- Anzeige über den Links: „Sellers list this ISBN with this cover“ / „Sellers currently show a different cover for this ISBN“ mit dem anderen Bild daneben, dann kommen die Suchwege (AbeBooks/eBay nach Titel, Verlag, Jahr) **vor** den ISBN-Links / „We can't tell which cover ships with this ISBN“.
- Amazon bleibt `/dp/<ISBN-10>`; die Übergabe zusätzlicher Metadaten an Händler-URLs bringt nichts, die Händler suchen ohnehin nach ISBN. Metadaten gehören in die Suchwege, die haben sie schon.
- ISBN-13 aus einem OL-Datensatz mit mehreren ISBNs: alle behalten (`isbns: string[]`), Links für die erste, die anderen als „also as ISBN …“ mit eigenen Links. Selten, aber dann richtig.

**Schritt 14 – Mosaik durch nachgeladene Cover je Karte (D).**
- Karte fordert nach dem Rendern `GET /api/works/[id]?offset=0&summary=1` an (dieselbe gecachte Seite 0 aus Schritt 11, verkürzt auf bis zu 4 unterschiedliche Cover-URLs), nur für sichtbare Karten, maximal 8 parallel. Das wärmt zugleich die Detailseite, der Klick wird schneller.
- Mit Sprachfilter: OL-Suche mit `language=<ISO-3>` aufrufen, das `editions`-Unterdokument liefert dann ein Cover in dieser Sprache; es wird das erste Cover der Karte.
- N2 wird angepasst: zwei synchrone Calls für die Antwort, dazu gedeckelte, gecachte Nachlade-Calls für sichtbare Karten. E4 (a) in 8.6 ist damit entschieden.

**Schritt 15 – Ehrliche Sprache (F).**
- Hero: „The covers a book has had.“ Unterzeile: „Search a book, see the covers two open catalogues know, and find the edition you actually want.“ Header-Zeile: „Book covers, side by side.“ Meta-Description entsprechend. Nirgends „every“ oder „all“.
- Zähler auf der Detailseite aus Schritt 11 („42 covers · 300 of 1180 editions checked“), Fußnote unter der Wand: „Cover images come from Open Library and Google Books. Editions without a scan are listed below.“
- About-Seite (8.1) erklärt Quellen, Lücken und die Verifikationsgrade aus Schritt 13 in drei Absätzen.

Reihenfolge: 10 (halber Tag), 15 (eine Stunde), 11 (zwei Tage), 12 (ein Tag), 13 (ein Tag), 14 (halber Tag). 10 und 15 zuerst, weil sie ohne Umbau sofort Vertrauen zurückholen; 11 vor 12, weil die Dedupe ohne vollständige Daten und Hashes nicht messbar ist.
