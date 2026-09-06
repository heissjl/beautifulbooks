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
| `authors` | string[] | ja (≥1) | Autorennamen, Übersetzer entfernt wenn erkennbar |
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

**Dedupe-Regel für Editions** (in dieser Reihenfolge):
1. gleiche ISBN-13 (ISBN-10 wird nach ISBN-13 konvertiert)
2. gleiche Cover-ID (Open Library) bzw. gleiche Cover-URL
3. gleicher normalisierter Titel + Verlag + Jahr

Bei Duplikaten gewinnt die vollständigere Ausgabe (Description > ISBN > Seitenzahl > Verlag).

### 2.3 Kauf-Links

Werden **nicht gespeichert**, sondern zur Anzeige aus der ISBN generiert. Anbieter-Liste ist eine Konfiguration (Name, URL-Template, optional Affiliate-Parameter).

Startliste: Amazon, AbeBooks, Bookshop.org, Google Books (nur wenn `buyLink` vorhanden). **Book Depository entfällt** (seit 2023 geschlossen, aktuell noch im Code).

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
| `mumbo jumbo` | Erster Treffer: *Mumbo Jumbo* von Ishmael Reed, ≥10 Ausgaben. Kathryn Lasky, Francis Wheen usw. als **eigene** Works, nicht gemischt. |
| `1984` | Orwell an erster Stelle. Deutsche/französische Ausgaben in derselben Karte, nicht als eigenes Work. |
| `gravity's rainbow` | Pynchons Roman vor allen Study Guides. |
| `the great gatsby` | Ein Work, kein Duplikat durch Google Books vs. Open Library. |
| `pride and prejudice` | Ein Work Austen; Adaptionen/Zombies etc. getrennt. |

### F2 – Detailseite `/book/[workId]`

- **F2.1** Route nimmt eine **Work-ID**, nicht eine Editions-ID (heute: Editions-ID, siehe 5.3).
- **F2.2** Lädt alle Ausgaben des Works aus beiden Quellen, dedupliziert.
- **F2.3** Ausgaben gruppiert nach Sprache als Tabs. Reihenfolge: Sprache des Suchfilters (falls gesetzt) zuerst, dann nach Anzahl absteigend. Ausgaben ohne Sprache in Tab „Unbekannt" am Ende.
- **F2.4** Innerhalb eines Tabs sortiert nach Jahr absteigend.
- **F2.5** Klick auf eine Ausgabe zeigt deren Details: großes Cover, Verlag, Jahr, Seiten, ISBN, Beschreibung, Kauf-Links, Vorschau-Link.
- **F2.6** Ausgewählte Ausgabe in der URL (`?edition=…`), damit verlinkbar.
- **F2.7** Zurück-Link führt zur Suche mit erhaltenem Query.

### F3 – Datenquellen

- **F3.1 Open Library** (primär): Suche `/search.json`, Ausgaben `/works/{id}/editions.json`, Cover `covers.openlibrary.org/b/id/{id}-{S|M|L}.jpg`.
  - Der Editions-Endpoint liefert Autoren **nur als Keys** (`/authors/OL242325A`), keine Namen. Autorennamen für Ausgaben werden vom Work übernommen, nicht pro Ausgabe geprüft.
  - `author_name` im Suchergebnis enthält Duplikate und Übersetzer; nur der erste Eintrag ist der Erstautor.
- **F3.2 Google Books** (sekundär, nur ergänzend): Suche `volumes?q=intitle:…`. Liefert keine Work-Gruppierung und **erzeugt deshalb nie eigene Works**. Google-Treffer werden per Titel+Erstautor einem Open-Library-Work zugeordnet; Treffer ohne passendes Work werden verworfen. Rolle: (a) bei der Suche zusätzliche Cover fürs Mosaik, (b) auf der Detailseite zusätzliche Ausgaben, Beschreibungen und Vorschau-Links.
- **F3.3** Jede Quelle ist unabhängig ausfallsicher: Fehler oder Timeout (5 s) einer Quelle führen zu Teilergebnissen, nicht zu einem Fehler.
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
- **N8 Bilder.** Cover über `next/image` mit erlaubten Remote-Hosts, kleine Größe im Grid, große nur auf der Detailseite.

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

---

## 7. Umsetzungsplan (Option A)

Ziel-Struktur von `lib/`:

```
lib/
  normalize.ts        Titel/Autor-Normalisierung, ISBN-10→13, Sprachcodes
  works.ts            Work-Identität, Edition-Dedupe, Relevanz-Ranking (rein, ohne I/O)
  sources/
    openlibrary.ts    search(), getWork(), getEditions(); kein Logging
    googlebooks.ts    search(), getEditions(); kein Logging
  search.ts           Orchestrierung: beide Quellen mit Timeout, Zuordnung GB→OL, Ranking, Cache
  work.ts             Detailseite: OL-Editionen + GB-Ergänzung, Dedupe, Sprach-Gruppierung
  buylinks.ts         Anbieter-Konfiguration → Links aus ISBN
```

Schritte, jeder einzeln commit-fähig:

1. **Aufräumen.** Löschen: `lib/api.ts`, `lib/aggregator-old.ts`, `components/BookCard.tsx`, `scripts/test-v2.ts`, `scripts/test-relevance.js`, `scripts/debug-search.js` (JS-Duplikate). `README.md` auf Kurzform kürzen, `CLAUDE.md` neu schreiben und auf diese Spec verweisen. Aktuelle `aggregator.ts`-Änderung als Zwischenstand committen, damit nichts verloren geht.
2. **`normalize.ts` + `works.ts`** mit Unit-Tests (Fixtures aus echten API-Antworten für die fünf Akzeptanz-Queries in F1, per Skript aufgezeichnet unter `lib/__fixtures__/`).
3. **Quellen-Clients** neu: Autoren-Bug (5.2) beheben, Timeouts (N3), Logging raus, Cover-URLs in S/M/L.
4. **`search.ts` + `work.ts`** mit Integrationstests gegen die Fixtures. Akzeptanzkriterien aus F1 müssen grün sein.
5. **API-Routen** `app/api/search` (bestehend, umstellen) und neu `app/api/works/[id]`. Server-seitiges Fetching mit `revalidate`. Alle Seiten und `BookGrid` gehen ausschließlich über diese Routen.
6. **Detailseite** auf Work-ID umstellen, gewählte Ausgabe in `?edition=`, Zurück-Link mit Query.
7. **Kauf-Links** aus Konfiguration, Book Depository raus, Bookshop.org rein.
8. **Verifikation** im Browser mit den fünf Akzeptanz-Queries, Screenshots in den PR.

Geschätzt: zwei Sessions. Session 1 = Schritte 1–4 (reine Logik, testbar ohne Browser). Session 2 = Schritte 5–8.

---

## 8. Roadmap nach Option A

Reihenfolge ist Vorschlag: erst 8.1 und 8.2 (sichtbar und online), dann 8.3 (Geld), dann 8.4 (Reichweite). Ohne Traffic bringen Kauf-Links nichts, ohne Online-Version kein Traffic.

### 8.1 Moderneres Design

**Ist:** Amber-Orange-Verläufe, Geist-Font, weiße Karten mit Schatten. Funktional, aber austauschbar. Die Cover sind das Produkt und müssen dominieren, das Chrome drumherum muss zurücktreten.

**Leitidee:** Galerie statt Shop. Dunkler oder neutraler Hintergrund, Cover groß, wenig Text, Typografie mit Charakter.

- [ ] **Designsystem festlegen** (eine Session, mit dem `design`-Skill als Canvas zum Rumprobieren)
  - [ ] Farbpalette: neutrale Basis (Warmgrau oder Off-Black), eine Akzentfarbe. Kein Verlauf im Hintergrund.
  - [ ] Typografie: Serif für Titel (z. B. Fraunces, Newsreader, Instrument Serif), Sans für UI. Skala mit 4–5 Stufen.
  - [ ] Dark Mode als Erstklasse-Variante, nicht als Nachgedanke. Cover wirken auf dunklem Grund besser.
  - [ ] Abstände und Raster auf 8-px-Basis.
- [ ] **Startseite**
  - [ ] Hero: ein Satz Wertversprechen, Suchfeld, darunter sofort ein Mosaik kuratierter Cover (statt leerer Zustand mit Icon).
  - [ ] Suchfeld ohne separaten Sprach-Dropdown links, Sprache als kleiner Chip-Filter unter dem Feld.
  - [ ] Ergebnisraster: Karten ohne Rahmen und Schatten, nur Cover + zwei Zeilen Text. Hover zeigt Anzahl Ausgaben und Sprachen.
- [ ] **Detailseite**
  - [ ] Cover-Wand als Hauptelement (Masonry oder gleichmäßiges Grid, deutlich größer als heute).
  - [ ] Sprach-Tabs als Chips über der Wand, Anzahl in Klammern.
  - [ ] Ausgewählte Ausgabe als Seitenleiste oder Drawer, nicht unter der Wand (heute muss man scrollen).
  - [ ] Cover-Vergleich: zwei Ausgaben nebeneinander anzeigen.
  - [ ] Teilen-Button, der die URL mit `?edition=` kopiert.
- [ ] **Bewegung und Ladezustände**
  - [ ] Skeletons in Cover-Proportion, sanftes Einblenden der Bilder beim Laden.
  - [ ] View Transitions zwischen Karte und Detailseite (Cover „fliegt" mit).
- [ ] **Mobil**: Raster 2-spaltig, Detailseite mit horizontal scrollbarer Cover-Wand, Sticky-Suchfeld.
- [ ] **Zugänglichkeit**: Alt-Texte mit Verlag und Jahr, Fokus-Ringe, Kontrast AA.

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

**Prinzip:** Links werden aus der ISBN generiert (`lib/buylinks.ts`), Affiliate-Parameter kommen aus Environment-Variablen. Ohne gesetzte Variable wird der neutrale Link erzeugt, damit die Seite auch vor der Freischaltung funktioniert.

- [ ] **Anbieter-Konfiguration bauen** (Teil von Option A, Schritt 7)
  - [ ] Struktur: `{ id, label, region, urlFromIsbn(isbn, affiliateId), affiliateEnv }`.
  - [ ] Reihenfolge der Links nach Region des Nutzers (`Accept-Language` bzw. Vercel-Geo-Header): DE-Nutzer sehen Thalia/genialokal/Amazon.de zuerst, EN-Nutzer Bookshop.org/Amazon.com.
  - [ ] Klick-Tracking: `/go/[provider]/[isbn]` als eigene Route, die zählt und weiterleitet. Ohne Zahlen keine Optimierung.
- [ ] **Programme beantragen** (Freischaltung dauert Tage bis Wochen, früh starten)
  - [ ] **Amazon PartnerNet (DE) / Associates (US)**: höchste Abdeckung, ~1–4,5 % auf Bücher. Voraussetzung: öffentlich erreichbare Seite mit Inhalt, drei qualifizierte Verkäufe in den ersten 180 Tagen, sonst Kontosperrung. Also erst beantragen, wenn 8.2 steht und etwas Traffic da ist. Pro Marktplatz ein eigenes Konto (`.de`, `.com`, `.co.uk`).
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

### 8.5 Funktionale Erweiterungen (aus Entscheidungen zurückgestellt)

- [ ] **F1.8** Query-Parsing in Titel + Autor (E3). Auslöser: wenn Akzeptanz-Query „gravity's rainbow" mit reinem Ranking nicht stabil ist.
- [ ] **E4 (a)** Editions-Call für die ersten 8 Treffer mit Cache, falls Google-Books-Cover zu selten zu einem 4er-Mosaik führen.
- [ ] Filter auf der Detailseite: Format (Hardcover/Paperback), Jahrzehnt, Verlag.
- [ ] Goodreads-CSV-Import als „Meine Bibliothek in allen Covern" (aus altem TODO).
- [ ] Redis/KV-Cache (E6), wenn Traffic da ist.
