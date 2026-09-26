# Plan für Roadmap 5.12: „Buy from a local bookshop" in der Seitenleiste

Geschrieben 2026-09-26 für eine Sitzung, die den Code nicht kennt. Julian: „ok, have it set up as another ausfaltbare option to find the edition like we have now with 'other ways to find it', make a plan and a local version we check before pushing it". Vorher lesen: [CLAUDE.md](../../CLAUDE.md), die Recherche [lab/buy-local/README.md](../../lab/buy-local/README.md), den Roadmap-Punkt [5.12](../../ROADMAP.md), SPEC §2.4 (Märkte, E9), §8.5, N11, N12, N14. Code und Kommentare Englisch (E7), dieser Plan Deutsch.

**Stand: lokale Fassung gebaut (2026-09-26), nicht gepusht, wartet auf Julians Blick** (§6).

## 1. Ziel und Nicht-Ziel

**Ziel.** Unter „Other ways to find it" steht ein zweiter aufklappbarer Abschnitt **„Buy from a local bookshop"**. Darin: ein Satz, eine Länderauswahl, je Land ein oder zwei Links in den nationalen Dienst unabhängiger Buchhandlungen mit der ISBN der gewählten Ausgabe (ohne ISBN: Titel und Autor, wo das Adressschema das trägt), und ein Satz, dass die Seite keinen Bestand kennt. Der Leser wählt den Laden **auf der Seite des Dienstes**.

**Messlatte.**
1. Kein Abruf: die Links sind URL-Vorlagen wie in `lib/buylinks.ts`; kein Händler, kein Dienst wird von der Seite gefragt.
2. Kein Satz behauptet, ein Laden habe das Buch; kein „every/all/complete" (Test in `lib/__tests__/localshops.test.ts`).
3. Die ISBN steht nur in Adressen, deren Form von Hand bestätigt ist; sonst ein als „finder" markierter Link auf Startseite, Finder oder Verzeichnis.
4. Die Wahl des Lands bleibt im Browser (localStorage, in try/catch); nichts davon erreicht den Server.
5. Bei 390 × 844 (Blatt) und 1280 × 800 (Seitenleiste) nichts abgeschnitten, kein seitliches Scrollen (N14).

**Nicht-Ziel.** Kein eigener Ladenfinder, kein OpenStreetMap (Julian hat es nicht entschieden, §7), keine Affiliate-Parameter (genialokal über Awin ist eine spätere Entscheidung), keine Zählung über `/go`, keine Änderung an E9 — die Länderliste gehört nur diesem Abschnitt.

## 2. Befund im Code

- `components/BookDetail.tsx`, Funktion `EditionBlock`: „Get this printing" (Zone A aus `linkPlan`), darunter `<details className="group mt-4 border-t border-line pt-3">` mit der Zusammenfassung „Other ways to find it (n)" (Zone „rest"), danach die Angaben zur Ausgabe und „Or read it in another edition". `EditionBlock` läuft in der Seitenleiste (Desktop) und im Blatt `CoverSheet` (Telefon) — dieselbe Komponente, also erscheint der neue Abschnitt an beiden Orten ohne Änderung an `CoverSheet.tsx`.
- `lib/buylinks.ts`: genialokal `/Suche/?q=<isbn>` und `?q=<text>`, Bookshop.org `/search?keywords=` (US und UK) sind live und in 1.8 geprüft.
- `components/useMarket.ts` zeigt das Muster für localStorage mit `useSyncExternalStore` (kein `setState` im Effekt, Lint-Regel `react-hooks/set-state-in-effect`).
- Märkte (E9) sind US/UK/DE; `COUNTRY_TO_MARKET` legt AT/CH auf DE. Für FR/IT/ES/NL/AT/CH braucht der Abschnitt ein eigenes Land.

## 3. Entwurf

### 3.1 Gestalt (Text-Skizze)

```
▸ Other ways to find it (12)
─────────────────────────────
▾ Buy from a local bookshop
  Find it at an independent bookshop near you.
  COUNTRY [ France ▾ ]
  [ Librairies indépendantes ]
  Search across more than 1,200 independent bookshops; choose one by
  location for pickup or delivery.
  You choose the shop on the service's own page. This site does not
  know which shop has this book.
```

Ein Finder-Link trägt das Kürzel „finder" im Knopf, und der Schlusssatz bekommt dann den Zusatz „Links marked "finder" open the service without this book; search there by title or ISBN." Links öffnen in einem neuen Tab (`rel="noopener noreferrer"`).

### 3.2 Daten und Logik (`lib/localshops.ts`, rein, clientsicher)

- Tabelle `COUNTRIES`: je Land ein oder mehrere Dienste mit `byIsbn?`, `byTerms?` (nur bestätigte Formen), `finder` (immer) und einer Zeile `note`.
- `localShopLinks(country, { isbn13, title, author })`: ISBN-Link, sonst Titelsuche, sonst Finder-Link (`kind: 'book' | 'finder'`).
- `LOCAL_COUNTRIES` (nach Namen sortiert), `defaultLocalCountry(market)` (US→US, UK→UK, DE→DE), `LOCAL_COUNTRY_KEY`, `LOCAL_SHOPS_COPY` — **alle Wörter des Abschnitts an einer Stelle**, geprüft gegen „in stock/available/has it/every/all/complete".

### 3.3 Länder und Links

| Land | Link in der lokalen Fassung | Art | Bestätigt? |
|---|---|---|---|
| DE | genialokal `https://www.genialokal.de/Suche/?q=<isbn>` (ohne ISBN: `?q=<Titel Autor>`) | Buch | **ja** (6.41, 1.8) |
| FR | librairiesindependantes.com `https://www.librairiesindependantes.com/product/search/?query=<isbn>`; ohne ISBN die Startseite | Buch / Finder | **ja** für die ISBN (2026-09-26); Freitext in `query` **unbestätigt** |
| UK | Hive Store Locator `https://www.hive.co.uk/storelocator` + Bookshop.org UK `https://uk.bookshop.org/search?keywords=<isbn>` | Finder + Buch | Finder-Adresse aus der Recherche; Bookshop live seit 2026-09-07 |
| US | IndieBound-Finder `https://www.indiebound.org/indie-store-finder` + Bookshop.org `https://bookshop.org/search?keywords=<isbn>` | Finder + Buch | wie UK |
| IT | Bookdealer `https://www.bookdealer.it/` | Finder | Startseite |
| ES | Todos tus libros `https://www.todostuslibros.com/` | Finder | Startseite |
| NL | Libris `https://libris.nl/winkels` | Finder | Seite aus den Quellen |
| AT | buchhandel.at `https://buchhandel.at/buchhandlungen/` — „Directory … includes chains and does not search for the book" | Finder (Verzeichnis) | Seite aus den Quellen |
| CH | Buchzentrum `https://www.buchzentrum.ch/de/buchwelt-schweiz/buchhandlungen/partner` — „Not limited to independents" | Finder (Verzeichnis) | Seite aus den Quellen |

Bookshop.org verschickt vom Grossisten und kennt keine Abholung; die Zeile sagt das („Ships from a wholesaler, no pickup; the independent shop you choose there gets the margin").

### 3.4 Postleitzahl

Julians Auftrag: ein Feld für die Postleitzahl, **nur wo die Adresse des Dienstes sie annimmt**, und die Postleitzahl verlässt den Browser nur im Link, den der Leser klickt. **Keiner der Dienste hat einen bestätigten Postleitzahl-Parameter** (genialokal fragt PLZ oder Standort selbst ab, Hive sucht per Formular, IndieBound per POST). Die lokale Fassung zeigt deshalb **kein** Feld: ein Feld, das nirgends hingeht, wäre eine Frage ohne Zweck. Sobald ein Dienst einen Parameter hat (von Hand geprüft), bekommt sein Eintrag `byIsbn(isbn, postcode?)`, und das Feld erscheint nur für dieses Land; die PLZ wird dann wie das Land in localStorage gemerkt, nie auf dem Server.

### 3.5 Merken

`localStorage['localShopCountry']`, gelesen über `useSyncExternalStore` (Server-Schnappschuss leer → Land des Markts), geschrieben in try/catch. Ohne Speicher (privates Fenster) gilt die Wahl bis zum nächsten Rendern; die Seite funktioniert trotzdem.

## 4. Adressen, die von Hand im Browser geprüft werden müssen

Je Dienst drei ISBNs (ein Klassiker, eine Neuerscheinung, eine Vorbestellung) in einem normalen Browser, kein Skript (robots.txt und Botschutz, lab/buy-local). Erst danach wandert der Dienst von „Finder" zu „Buch":

1. **Hive (UK):** gibt es eine ISBN-Adresse, z. B. `https://www.hive.co.uk/Search/Keyword?keyword=<isbn>` oder `https://www.hive.co.uk/Product/…/<isbn>`? Und ein PLZ-Parameter im Store Locator?
2. **Libris (NL):** reine ISBN-Adresse, z. B. `https://libris.nl/boek?authortitle=<…>-<isbn>` oder eine Suche `https://libris.nl/zoeken?query=<isbn>`?
3. **Todos tus libros (ES):** `https://www.todostuslibros.com/busquedas?keyword=<isbn>` (Parametername unbekannt) oder die Buchseite `/libros/<slug>_<isbn-mit-bindestrichen>` ohne Slug?
4. **Bookdealer (IT):** `https://www.bookdealer.it/libro/<isbn>` ohne Slug — landet es beim Buch?
5. **LivreSuisse (fr-CH):** Adresse des gemeinsamen Shops überhaupt, und ob eine ISBN-Suche geht; heute nicht in der Tabelle.
6. **librairiesindependantes.com (FR):** nimmt `?query=` auch Titel und Autor (für Ausgaben ohne ISBN)?
7. **genialokal (DE):** ein PLZ-Parameter oder `?storeID=` kombiniert mit `/Suche/?q=<isbn>`?
8. **Die Finder-Seiten selbst** (Hive Store Locator, IndieBound, libris.nl/winkels, buchhandel.at/buchhandlungen/, Buchzentrum-Partnerliste): öffnen sie noch die erwartete Seite?
9. **Vorbestellung:** führen genialokal und librairiesindependantes einen Titel vor dem Erscheinungstag, mit Abholung im Laden?

## 5. Tests und Prüfung

- `lib/__tests__/localshops.test.ts`: bestätigte ISBN-Links DE/FR, Titelsuche DE, Rückfall auf Finder FR, nur Finder für AT/CH/IT/ES/NL (und nie die ISBN in deren Adresse), UK/US Finder + Bookshop, https überall, keine PLZ-/Koordinaten-Parameter, Länderliste und Voreinstellung aus dem Markt, Wortwahl.
- `npx tsc --noEmit`, `npm run lint`, `npm run test:run`.
- Im Browser gegen `npm run dev`: Buchseite mit gewähltem Cover, Abschnitt öffnen, Land wechseln, `href` prüfen; 390 × 844 im Blatt und 1280 × 800 in der Seitenleiste; Peek-Leiste und Blatt öffnen/schließen.

## 6. Was Julian vor dem Push ansieht

Lokal: `http://localhost:3100/book/OL468431W?cover=ol%3A14681251` (The Great Gatsby, Broadway Play Publishing 2021, ISBN 9780881459210); auf dem Telefon „Details" in der Leiste antippen. Fragen an Julian:

1. Platz: unter „Other ways to find it" (so gebaut) oder darüber?
2. Titel: „Buy from a local bookshop" gut, oder „Find it at a local bookshop" (ehrlicher, weil wir nicht verkaufen)?
3. Bookshop.org in UK/US drinlassen, obwohl es keine Abholung gibt?
4. Die Finder-Länder (IT, ES, NL, AT, CH) schon zeigen oder erst nach der Handprüfung (§4)?

## 7. Spätere Optionen (nicht in diesem Schritt)

- **OpenStreetMap-Auszug** für Länder ohne Dienst (AT, CH, Rest): nur als vorgebaute Datei, PLZ im Browser gegen die Datei, ODbL-Attribution; Zahlen in lab/buy-local.
- **Affiliate:** genialokal (Awin, 7,5 %), Bookshop.org, Hive — im Hobby-Modus (E20) aus; Entscheidung mit Phase 4.
- **eBuch nach der `storeID`-Liste fragen** (Julians Mail): dann „genau dieser Laden" in DE.
- **Voreinstellung aus der Browsersprache** (fr → FR, it → IT …) statt nur aus dem Markt.
