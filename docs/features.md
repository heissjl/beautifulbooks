# Was die Seite heute kann

Stand: 2026-09-10. Eine Bestandsliste der Funktionen, die **ausgeliefert oder auf `main` gebaut** sind — je Zeile, was der Leser bekommt, seit wann, wo es in der [Spec](../SPEC.md) steht, welcher [Roadmap](../ROADMAP.md)-Punkt es gebaut hat und wo der Code liegt. Die Spec sagt, was die Seite *sein soll*; diese Liste sagt, was sie *ist*. Wer einen Punkt abhakt, trägt hier eine Zeile nach.

Was hier fehlt, gibt es nicht — auch wenn ein Plan es beschreibt.

## Suche

| Funktion | seit | Spec | Roadmap | Code |
|---|---|---|---|---|
| Freitextsuche, ein Aufruf an Open Library, **nie** an Google | 2026-09-06 / 09-07 | F1.1, E10 | PLAN-B B8 | `lib/search.ts` |
| Sprachfilter als Pillen (`all`, `en`, `de`, …), wirkt auf Ausgaben, nicht Werke | 2026-09-06 | F1.2 | — | `components/SearchBar.tsx` |
| Ranking relational zum Ergebnis; Ableitungen, Bühnenfassungen, Sekundärliteratur nach hinten (vier Regeln) | 2026-09-07 / 09-08 | F1.4 | Schritt 10, 6.1 | `lib/works.ts` (`relevance`, `rankContext`, `derivativeIds`) |
| Karten mit Vier-Cover-Mosaik, je Druck eine Kachel, keine Wiederholung nach Bild (Hash im Browser, Abstand > 8), Viertelkacheln in Größe M, keine Google-Anfrage | 2026-09-06 / 09-11 | F1.3, F4 | Schritt 14, 1.6, 6.34 | `components/BookGrid.tsx`, `useCardCovers.ts`, `coverHash.ts`, `lib/dhash.ts`, `lib/seo.ts` (`coverImages`) |
| Ein Ausfall heißt „The catalogue did not answer“ mit *Try again*, nie „No books found“; 503 ohne Cache | 2026-09-07 | F1.7, F3.3 | 1.4 | `lib/search.ts` (`SourceUnavailableError`), `app/api/search/` |
| Eine schweigende Suche wird einmal wiederholt (nie bei 4xx), 20 s Gesamtdeckel; Such-Cache 24 h | 2026-09-08 | F3.3, N4 | 1.10 | `lib/sources/openlibrary.ts` (`SEARCH_RETRY`) |
| Ein Rondell aus sieben Covern von *Dune* rechts neben Überschrift und Suchfeld, ab `lg`, als Link auf die Wand; dreht sich selbst und folgt der Maus, vorne und hinten entgegengesetzt; die sieben aus dem Index nach Abstand gewählt, jedes Paar über der lockersten Hash-Schwelle der Seite, testgeprüft; unter `lg` gar nicht gerendert | 2026-09-10, Rondell 2026-09-11 | F6 | 1.9 | `components/HeroFan.tsx`, `components/HeroRondell.tsx`, `lib/herofan.ts` |
| Zuletzt gesucht (localStorage, 5) und kuratierte Wand als Leerzustand | 2026-09-06 / 09-08 | F1.6 | 6.17 (teilweise), 6.18 | `components/useRecentSearches.ts`, `lib/curated.ts`, `data/curated.json` |
| Startwand gleich lesbar auf Telefon und Desktop: Titel und Autor zweizeilig, Alternativtitel weg (`tileTitle`), Suchfeld-Platzhalter passt bei 390 px | 2026-09-11 | N14 | 6.30 | `components/CuratedWall.tsx`, `components/SearchBar.tsx`, `lib/normalize.ts` |
| Ladebild: ein Autorengesicht aus den Covern seiner Bücher, eine JPEG-Datei je Anzeige, zwanzig Vorlagen, bis zum Bild eine im selben Takt atmende Fläche seiner Größe (seit 6.33); vor der Suche, der Jahrzehnte-Seite und der von außen aufgerufenen Werkseite; atmet unter `prefers-reduced-motion` | 2026-09-09 / 09-10 | F1.6a | 6.19a | `components/MosaicLoader.tsx`, `mosaicClearing.ts`, `lib/loading.ts`, `public/loading/` |
| Eine ISBN oder eine Work-ID im Suchfeld führt zu ihrer Ausgabe: bei genau einem Treffer `?isbn=` auf der Karte und vorgewähltes Cover auf der Detailseite; mehr als ein Treffer heißt „nicht gefunden“ | 2026-09-10 | — | 6.29 | `lib/queryshape.ts`, `components/BookGrid.tsx`, `BookWorkCard.tsx`, `BookDetail.tsx` |
| Enter sendet ab (von Hand geprüft) | bestätigt 2026-09-10 | F1.5 | 0.8 | `components/SearchBar.tsx` |
| Suchfeld in der Kopfzeile auf jeder Seite außer der Suche; ein Eingabefeld, Lupe auf dem Telefon; Zurück-Link heißt „Results“ / „Home“ | 2026-09-10 | F1.4a | 6.28 | `components/HeaderSearch.tsx`, `SiteHeader.tsx` |

## Detailseite: die Cover-Wand

| Funktion | seit | Spec | Roadmap | Code |
|---|---|---|---|---|
| Seitenweises Laden der Ausgaben (100 je Seite, bis 1.500), Wand steht nach Seite 0, Zähler statt Versprechen | 2026-09-07 | F2.2, F2.3 | Schritt 11 (PLAN-11) | `lib/work.ts` (`getWorkPage`), `components/useWorkPages.ts`, `lib/pages.ts` |
| Andere Open-Library-Datensätze desselben Buchs (Identitätsregel 2) werden nach den eigenen Seiten mitgeladen, ohne Google, höchstens zwölf; der Zähler zählt über alle | 2026-09-11 | §2.1, F2.3 | 6.13 | `lib/works.ts` (`siblingsOf`), `lib/sources/openlibrary.ts` (`searchSiblingWorks`), `components/useWorkPages.ts` |
| Sprach-Reiter in fester Reihenfolge (gesucht, en, de, Häufigkeit, Unknown), eingefroren nach dem ersten Auftauchen | 2026-09-07 | F2.4, E17 | Schritt 11 | `lib/pages.ts` (`orderGroups`) |
| Sprachreiter brechen auf beiden Geräten um; „All languages" am Ende zeigt die ganze Wand, neuester Druck zuerst; höchstens 2 Zeilen am Telefon, 3 am Desktop, der Rest hinter „+n more"; „Unknown" und „All languages" nie weggeklappt | 2026-09-11 | F2.4, N14 | 6.8 | `components/CoverGallery.tsx`, `useRowFit.ts`, `lib/rowfit.ts`, `lib/works.ts` (`coversNewestFirst`) |
| Faltung gleicher Scans im Browser, drei Stufen (≤ 8; ≤ 20 bei gleicher ISBN; ≤ 16 bei gleichem Verlag ± 1 Jahr); nie über Sprachen | 2026-09-07 | §2.3, E8 | Schritt 12 | `lib/works.ts` (`foldDuplicateCovers`), `lib/imagesig.ts`, `lib/imagehash.ts` (Server) |
| Leer aussehende Scans werden ans Ende sortiert, nie gelöscht | 2026-09-07 | F2.5, E16 | Schritt 12 | `lib/imagehash.ts` (`looksLikeScannedPage`) |
| Ladeszene: Titel und Hero sofort aus der Karte (sessionStorage), Cover-Fächer, der mit genau diesem Cover beginnt, FLIP auf die Kacheln; Kacheln erst mit eigenem Bild, Übergabe erst, wenn die ersten sechs Wandcover da sind (höchstens 8 s); Ladetext über dem Bild; bei bekannten Covern (Rückweg von der Jahrzehnte-Seite) gar kein Ladebild | 2026-09-06 / 09-11 | F2.12 | alte §8.1, 6.19, 6.24, 6.25a | `components/LoadingStage.tsx`, `lib/scene.ts`, `flyCovers`, `useWorkPreview.ts` |
| Beim Öffnen ist nichts ausgewählt; die zweite Spalte zeigt das **Werk** (Jahresspanne, Verlage, Klappentext mit Zuschreibung, Link zum Datensatz) | 2026-09-09 | F2.6, F2.6a | 1.1 (PLAN-1.1) | `components/BookDetail.tsx` (`WorkPanel`), `lib/pages.ts` (`coverForId`), `lib/works.ts` (`blurbFor`) |
| Auswahl in der URL (`?cover=`), Suche und Sprache bleiben erhalten; gefaltete Duplikate lösen auf ihren Vertreter auf | 2026-09-06 | F2.7 | — | `components/BookDetail.tsx` |
| Telefon: Peek-Leiste und Schublade, exklusiv gerendert; Wand bleibt vertikal | 2026-09-07 | F2.11, E13 | PLAN-B B5 | `components/CoverSheet.tsx`, `useIsDesktop.ts` |
| Echter 404 für eine unbekannte Work-ID, Soft-Antwort nur bei schweigendem Katalog; `?offset=` jenseits der Kappung ist leer | 2026-09-08 | F2.1a, F2.2 | 1.7 | `app/book/[id]/page.tsx`, `app/not-found.tsx` |

## Detailseite: die gewählte Ausgabe

| Funktion | seit | Spec | Roadmap | Code |
|---|---|---|---|---|
| ISBN-Nachschau bei Google **nur** bei Auswahl; Verdikt `verified / differs / uncompared / unknown / pending / unavailable`, Wortlaut an einer Stelle; ohne Signatur nie „different" | 2026-09-07 / 09-11 | F2.8, F2.9 | Schritt 13, 13a, 1.5, 6.32 | `lib/isbn.ts`, `components/useIsbnCovers.ts`, `lib/works.ts` (`verifyIsbnCover`), `lib/verdicts.ts` |
| Nur gedruckte Bücher: eine E-Book-ISBN (Open Librarys Format, dieselbe Nummer auch bei Google) wird nie gezeigt, verlinkt oder geprüft, das Cover bleibt; Hörbücher fallen ganz weg; die Suche nach einer Ausgabe nennt Verlag und Jahr nur aus einem gedruckten Katalog-Datensatz | 2026-09-11 | E21 | 6.35 | `lib/works.ts` (`assembleEditions`), `lib/buylinks.ts` (`searchFacts`), `lib/sources/openlibrary-parse.ts` |
| Erste Reihe nach ISBN-Registrierungsgruppe: **home / foreign / kdp / no-isbn**; Marktplätze führen bei fremder ISBN, Katalog-Händler bekommen Titelsuchen; `differs` ersetzt die Reihe durch Suchen | 2026-09-09 | §2.4, F2.9 | 1.11 (PLAN-1.11) | `lib/linkplan.ts`, `lib/normalize.ts` (`registrationArea`), `lib/buylinks.ts` |
| „Or read it in another edition“ nur, wenn kein Link auf *diese* Ausgabe möglich ist | 2026-09-09 | §2.4 | 1.11 | `lib/linkplan.ts` |
| Jeder Laden wird **zuerst mit der ISBN** gefragt, sobald es eine gibt (außer bei `differs`); die Wortsuche folgt hinter der Klappe, und ein Laden mit zwei Fragen sagt im Label welche („AbeBooks · ISBN“ / „· title & year“); Verlagsnamen werden als Suchbegriff normalisiert (Rechtsform, Klammerzusatz, Selbstverlag weg) | 2026-09-10 | §2.4, F2.9 | 1.11, 1.11a | `lib/linkplan.ts` (`pick`), `lib/normalize.ts` (`searchablePublisher`) |
| Fünf sichtbare Bedienelemente statt vierzehn; alles Übrige hinter „Other ways to find it“; Cover an der Fensterhöhe gedeckelt | 2026-09-09 | F2.6 | 1.2 | `components/BookDetail.tsx` (`EditionBlock`) |
| Unter einem gefalteten Cover führt der Druck, der den gezeigten Scan trug, dann das Verdikt, dann Markt und Jahr | 2026-09-09 | §2.4 | 6.14, 1.11 | `lib/linkplan.ts` (`orderEditionsForMarket`) |
| „The same cover, N scans“: jeder gefaltete Scan ist anklickbar und tauscht das große Bild; Quelle des gezeigten Scans wird genannt; eine Reihe, die seitwärts scrollt, mit Verlaufskante nur solange es weitergeht | 2026-09-09 / 09-10 | §2.3 | 6.14, 6.14a | `components/BookDetail.tsx` (`CoverDetails`), `useOverflowsX.ts` |
| „Looks like this“: bis zu drei Cover **anderer** Bücher aus dem gebauten Index, drei feste Spalten | 2026-09-08 / 09-09 | F2.14, §2.5 | 6.10, 6.10a | `lib/coverindex.ts`, `data/cover-index.json`, `app/api/similar/`, `components/BookDetail.tsx` (`SimilarCovers`) |
| Markt US/UK/DE aus Wahl, Länder-Header oder Accept-Language; Händlertabelle je Markt | 2026-09-06 | §2.4, E9 | — | `lib/market.ts`, `lib/buylinks.ts` |
| Jeder Kauf-Link läuft über `/go/`, das Ziel wird aus der Tabelle neu gebaut; eine Logzeile ohne jede Kennung | 2026-09-07 | F5, E14 | PLAN-B B6 | `app/go/[provider]/[isbn]/`, `lib/clicks.ts` |
| Teilen: Menü mit Link kopieren, `navigator.share`, Pinterest, WhatsApp, Bluesky, X, E-Mail — nur Links, kein Skript; eigene Adresse `/book/<werk>/cover/<cover>` mit dem gewählten Cover als Vorschaubild | 2026-09-09 | F2.13 | 6.20, 6.21 | `components/ShareButton.tsx`, `app/book/[id]/cover/[cover]/` |
| Verfügbarkeits-Button — **nur im Shop-Modus**, nicht freigegeben | 2026-09-06 | F2.10, E12 | 0.1 | `lib/availability.ts`, `app/api/availability/` |

## Weitere Seiten

| Funktion | seit | Spec | Roadmap | Code |
|---|---|---|---|---|
| Jahrzehnte-Seite `/book/<id>/decades`: dieselben Cover nach dem Jahrzehnt ihres frühesten Drucks, gefaltet aus dem Index, Schwelle 20 Cover über 4 Jahrzehnte, sonst 404; Mosaik als Ladebild | 2026-09-09 / 09-10 | F6 | 5.4a, 6.19a | `app/book/[id]/decades/`, `lib/decades.ts`, `data/decade-pages.json` |
| About mit Verdikten im Wortlaut der Oberfläche, Quellen, Lücken, „Looks like this“ | 2026-09-07 / 09-08 | F6, N13 | PLAN-B B7, 1.5 | `app/about/page.tsx` |
| Impressum und Datenschutz aus `IMPRINT_*`; Build bricht ohne die Werte | 2026-09-08 | F6 | 2.3 | `app/contact/`, `app/privacy/`, `lib/imprint.ts` |
| Titel, Beschreibung, Schema.org `Book`, OG-Bild 1200×630 mit vier verschiedenen Covern, Sitemap, robots | 2026-09-07 | F2.13 | PLAN-B B3 | `lib/seo.ts`, `app/book/[id]/opengraph-image.tsx`, `app/sitemap.ts`, `app/robots.ts` |
| Sitemap mit allen veröffentlichten Werken und ihren Jahrzehnte-Seiten (253 Adressen am 2026-09-09) | 2026-09-09 | F6 | 5.1 | `lib/published.ts`, `scripts/promote.ts` |
| Hobby-/Shop-Modus per `NEXT_PUBLIC_SITE_MODE`; Hobby ignoriert Affiliate-Variablen, hat keinen Verfügbarkeits-Button und keinen Provisionssatz | 2026-09-08 | E20 | 2.0 (PLAN-2) | `lib/siteMode.ts`, Tests |
| Farbschema: warmes Papier, sanfteres Terrakotta `#945138`, `ink-3` auf WCAG AA; ein Test liest `globals.css` und prüft sechs Paare in beiden Modi | 2026-09-09 | §5 | 6.22 | `app/globals.css`, `lib/contrast.ts`, `lib/__tests__/contrast.test.ts` |

## Betrieb und Schutz

| Funktion | seit | Spec | Roadmap | Code |
|---|---|---|---|---|
| Alle externen Aufrufe serverseitig; der Browser spricht nur mit `/api/*` und `/img/*` | 2026-09-06 | N1 | Schritt 1–5 | `lib/sources/`, `app/api/` |
| Bildroute `/img/<S\|M\|L>/<ol-…\|gb-…>`: die ID im Pfad, nie eine URL; 30 Tage CDN (belegt: MISS 2,1 s → HIT 0,24 s), Fehlschläge `no-store`; jeder Fehlschlag schreibt `bb.img` mit dem Status der Gegenseite und trägt ihn als `X-Cover-Upstream`; eine gescheiterte Kachel fragt nach 1,5 s ein zweites Mal | 2026-09-09 / 09-11 | N8 | 1.3, 6.25, 6.31 | `app/img/[size]/[cover]/route.ts`, `lib/coverurl.ts`, `lib/coverlog.ts`, `components/CoverImage.tsx` |
| Next-Datencache: Suche 24 h, Werk/Ausgaben 24 h, Google-Titelsuche 7 d, ISBN 24 h, Hash-Bilder 30 d, ISR 24 h | 2026-09-06 / 09-08 | N4, E6 | 1.10 | `lib/sources/*.ts` |
| Google an genau zwei Stellen (Seite 0, ISBN-Nachschau); Mosaik, Metadaten, OG-Bild und Suche kosten null | 2026-09-07 | F3.2, E10, N9 | Schritt 13a, PLAN-B B8 | `lib/work.ts` (`WorkPageOptions.googleBooks`), Integrationstests |
| Kontingent-Automat: Pause bei Googles eigener Meldung bis Mitternacht pazifisch, 90 s bei Rate-Limit, kein Zähler; eine Logzeile `bb.google` | 2026-09-07 / 09-09 | N9, E11 | alte §8.7, 0.13 | `lib/googlequota.ts` |
| Rate-Limit je IP und Route, gemeinsamer Eimer `google`, Eimer `img` (800 Stoß, 400 je Minute) | 2026-09-07 / 09-10 | N10 | PLAN-B B2, 1.3, 6.25 | `lib/ratelimit.ts`, `app/api/rate.ts` |
| Timeouts je Quelle (Suche 12 s, Ausgaben 12 s, Google 5 s); Seite 0 und Folgeseiten mit einem zweiten Versuch | 2026-09-06 / 09-09 | F3.3 | 1.10, 5.4a | `lib/sources/http.ts`, `OL_TIMEOUTS`, `fetchPageWithRetry` |
| Keine Kennung des Lesers: kein Konto, kein Tracking-Cookie; localStorage nur für Suchen und Markt | 2026-09-06 | N11, E14 | — | — |
| Gebauter Cover-Index (139 Werke, Signaturen, Farbmaße) als Datei im Repo; Obergrenze 10 MB, testgeprüft | 2026-09-08 / 09-09 | §2.5, E18 | 6.10, 5.1 | `scripts/build-cover-index.ts`, `lib/coverindex.ts`, `lib/__tests__/coverindex.test.ts` |

## Werkzeuge neben der Seite

| Werkzeug | Wozu | Roadmap | Ort |
|---|---|---|---|
| Kuratier-App: Cover je Werk wählen, Reihenfolge per Drag & Drop, Vorschläge, streichen | 6.18 | `lab/curate/` |
| Duell-Prototyp: zwei Menschen, ein Link, dieselbe Runde | 5.8 | `lab/duel/` |
| Riesenmosaik aus Covern (Buch oder Autor) | 5.5 | `lab/mosaic/` |
| Ladebild-Vorlagen: Porträtbogen, Filmstreifen, zwanzig Autoren | 6.19a | `lab/loading/` |
| Faltungsmaß-Experiment (negativ: kein Maß trennt besser als dHash 8) | 6.10, 6.23 | `lab/fold/` |
| Farbschema-Mockups mit Kontrasttabelle | 6.22 | `lab/palette/` |
| Fixtures aufzeichnen, Cover-Index bauen, Werk befördern, Jahrzehnte-Seiten finden, Händler-Links prüfen, Ladebilder kopieren, Worktrees anzeigen | diverse | `scripts/` |

## Was es ausdrücklich **nicht** gibt

Damit niemand es aus einem Plan herausliest: keine Verfügbarkeits- oder Bestandsprüfung im Betrieb (E12), keine Provision (Hobby-Modus, E20), keine eigene Buchdatenbank (§1, E18), keine Bewertungen, keine Analyse-Seite (3.1), keine Reihen- oder Sprachvergleichsseiten (5.4b–e), keine Rotation der Startseite (6.17), kein Tastatur-Nachweis für Tab-Reihenfolge und Fokus-Ringe (0.8a), kein Nachweis des CDN-Treffers der Bildroute in Produktion (2.6).
