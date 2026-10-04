# Zuschnitt des Codes: eine Durchsicht (2026-10-03)

Julian: „think about whether we need to do some re-factoring of the codebase". Gelesen und gezählt am 2026-10-03 auf `main` (`11884c9` plus die Zusammenführung von 6.85). Ergebnis zuerst: **kein Umbau.** Der Code ist für seine Größe gesund — 1.012 Tests in 95 Dateien, kein `any` in `lib/`, kein einziges `TODO`, jede Entscheidung mit Begründung im Kommentar. Was es gibt, sind vier Stellen, an denen dieselbe Sache mehrfach geschrieben steht oder eine Datei mehr trägt, als eine Sitzung überblickt. Zwei Fehler, die die Durchsicht nebenbei fand, sind am selben Tag behoben. Der Rest ist ROADMAP 6.86 und wird je beim nächsten Anfassen der Datei erledigt, nicht als eigenes Vorhaben: ein Umbau ohne Anlass kostet Diff, verschiebt Zeilen, die Historie und Spec zitieren, und bringt dem Leser nichts.

## 1. Die Zahlen

| Ordner | Zeilen | Dateien | Bemerkung |
|---|---|---|---|
| `app/` | 4.633 | 88 | 33 API-Routen, 19 Seiten plus 21 Spiegel unter `app/de/` |
| `components/` | 10.794 | 80 | |
| `lib/` | 13.695 | 84 | 59 flache Module plus `sources/`, `hotornot/`, `walls/`, `suggest/`, `curate/`, `i18n/` |
| `lab/` | 9.476 | 51 | 17 Experimente, vier davon in die Seite befördert |
| `scripts/` | 5.322 | 36 | Messskripte, Fixtures, Cockpit |

Die zehn größten Dateien: `components/BookDetail.tsx` 1.217, `lib/works.ts` 947, `components/CurateTool.tsx` 743, `lib/hotornot/game.ts` 570, `lib/normalize.ts` 569, `lib/hotornot/rating.ts` 546, `components/CollectionEditor.tsx` 521, `components/Versus.tsx` 468, `lib/sources/openlibrary.ts` 437, `lib/hotornot/store.ts` 428.

## 2. Was zu tun ist, nach Nutzen je Aufwand

### 2.1 Sofort erledigt (2026-10-03)

- **Ein Test für den Spiegelbaum** (`lib/__tests__/mirror.test.ts`): jede `page.tsx` und `loading.tsx` außerhalb von `app/de/` und `app/api/` braucht ihre Datei unter `app/de/`, und kein Spiegel darf ohne Seite stehen. Ohne den Test bekäme ein deutscher Leser für eine neue Seite einen 404, den niemand auf Englisch sieht — genau der Fehler, den der Katalog-Test für Sätze schon abfängt (6.85).
- **`@anthropic-ai/sdk` stand unter `devDependencies`**, wird aber von `lib/recognize.ts` importiert, das `/api/walls/photo` zur Laufzeit ruft. Es lief nur, weil Vercel beim Bauen auch Dev-Abhängigkeiten installiert; ein `npm ci --omit=dev` hätte die Route gebrochen. Nach `dependencies` verschoben.

### 2.2 Beim nächsten Anfassen (ROADMAP 6.86)

1. **`components/BookDetail.tsx` teilen.** 1.217 Zeilen, 13 Komponenten in einer Datei: `BackLink`, `Shell`, `LoadFailed`, `TitleBlock`, `BookDetail`, `ScanProgress`, `SimilarCovers`, `CoverDetails`, `EditionBlock`, `IsbnText`, `VerdictNote`, `ShopLink`, `BookDetailPage`. Natürliche Schnitte: die Seite (`BookDetail`, `Shell`, `LoadFailed`, `TitleBlock`), die Spalte (`CoverDetails`, `SimilarCovers`), der Druck (`EditionBlock`, `IsbnText`, `VerdictNote`, `ShopLink`). Anlass ist 6.64, das `BackLink` ohnehin herauslösen will. Risiko klein: reine Verschiebung, die Tests der Seite laufen gegen die Komponenten, nicht gegen die Datei.
2. **`lib/works.ts` nach Anliegen teilen.** 947 Zeilen und rund 45 Exporte aus sechs Anliegen: Zusammenbau der Ausgaben (`assembleEditions`, `withoutTranslators`, `mergeWorks`), Ranking (`rankContext`, `relevance`, `rankWorks`, `derivativeIds`), Gruppierung (`groupCoversByLanguage`, `coversNewestFirst`), Faltung (`foldDuplicateCovers`, `sameCover`, `samePublisher`), Verdikt (`verifyIsbnCover`), Text (`blurbFor`, `editionSpan`). **Bedingung:** `lib/works.ts` bleibt als Sammelexport bestehen, weil SPEC, Historie, CLAUDE.md und Kommentare den Pfad in Dutzenden Stellen zitieren („`foldDuplicateCovers` in `lib/works.ts`"); die Zitate bleiben wahr, wenn die Funktion dort weiter importierbar ist.
3. **Eine `PageShell`.** 15 Seiten setzen dasselbe zusammen: `<div className="flex min-h-screen flex-col">`, `SiteHeader` mit `HeaderSearch`, `main` mit den gleichen Klassen, `SiteFooter`. Seit 6.85 reicht jede Server-Seite außerdem `locale` durch und übersetzt mit `translator(locale)`. Eine Hülle, die `locale`, Kopf, Fuß und die `main`-Klassen trägt, nimmt 19 Seiten je acht Zeilen ab und macht die nächste Seite in einer Zeile deutsch. Der Spiegel unter `app/de/` bleibt, er ist der Grund, warum die Seiten gecacht bleiben.
4. **Ein Hook für die localStorage-Speicher.** Vier Stellen schreiben denselben Mechanismus — `useSyncExternalStore` über `localStorage` plus ein eigenes `window`-Ereignis: `components/useMarket.ts`, `useLocalCountry` in `components/LocalShops.tsx`, `components/useRecentSearches.ts`, `components/editingSession.ts`. Ein `useStoredValue(key, parse)` ersetzt alle vier; die Cookie-Spiegelung des Markts bleibt dessen Besonderheit.

### 2.3 Was nicht zu tun ist, mit Grund

- **`lib/` in Ordner umsortieren** (Suche, Cover, Kauf, …): 59 flache Module sind an der Grenze, aber jeder Pfad steht in SPEC, Historie, Plänen und CLAUDE.md. Ein Umzug macht hunderte Zitate falsch, und `git log -- lib/works.ts` verliert die Geschichte. Erst, wenn ein Ordner einen Grund hat (wie `i18n/`, `hotornot/`, `walls/`).
- **`lab/` ausdünnen.** Vier Experimente sind befördert (`walls/` → 5.13, `buy-local/` → 5.12, `look/` → 6.84, `xanh-spacing/` → 6.61), ihre Messungen werden aber aus Historie und Roadmap zitiert. Sie bleiben, mit dem Status „befördert" in `lab/README.md`; `lab/` ist vom Build und vom Bundle ausgeschlossen, kostet also nichts.
- **Die drei Editoren zusammenlegen** (`CurateTool` 743, `CollectionEditor` 521, `WallView`/`WallPhoto`): sie bearbeiten drei verschiedene Dinge (Entwürfe in Redis für Freunde, die Datei für Julian, die Wand eines Lesers) mit drei Datenmodellen; die reinen Regeln teilen sie sich schon in `lib/collectionedit.ts`. Ein gemeinsamer Editor wäre eine Abstraktion ohne gemessenen Schaden dahinter.
- **Die API-Routen vereinheitlichen.** 33 Routen, 14 mit `rateLimited`, 10 handgeschriebene Fehlerantworten; die Form ist überall dieselbe. Ein Helfer spart je Route eine Zeile und erklärt nichts.
- **`hotornot/` (1.900 Zeilen in vier Dateien):** groß, aber eines Anliegens und gut geschnitten; E21 (ob der Speicher bleibt) steht davor.

## 3. Was die Durchsicht nicht war

Keine Suche nach toten Exporten (dafür fehlt ein Werkzeug wie `knip` im Projekt; wäre eine Stunde) und kein Blick auf die Bundle-Größe je Route (die Routentabelle des Builds zeigt First-Load-JS, nicht gelesen). Beides lohnt, sobald die Seite Besucher hat, deren Ladezeit zählt (Phase 3).
