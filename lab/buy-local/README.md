# lab/buy-local — „Buy locally": eine unabhängige Buchhandlung in der Nähe, bei der man bestellen kann

Julian, 2026-09-26: „set up lab project: buy locally link. user can specify country and postcode and site tries to find the website of a local bookshop where one can preorder. has to be non-chain bookshops. do research first whether a lookup page of local bookshops exists already that can be used". Roadmap **5.12**. Stand: **Recherche erledigt (2026-09-26), nichts gebaut.**

## Die Frage

Wer Land und Postleitzahl angibt, soll zu einer **inhabergeführten, nicht filialisierten** Buchhandlung in der Nähe kommen, bei der er das Buch (die ISBN der gewählten Ausgabe) bestellen oder vorbestellen und abholen kann. Gibt es dafür schon Dienste, auf die die Seite verlinken kann — und wo nicht, reicht OpenStreetMap?

## Der Grundsatz, der die Antwort ordnet

Die Kauflinks der Seite sind **URL-Vorlagen; die Seite fragt nie einen Händler** (`lib/buylinks.ts`, `app/go/[provider]/[isbn]/route.ts`). An der Verfügbarkeitsprüfung (§9.3 Schritt 16, SPEC §8.7) scheiterte genau das: vier von sechs Shops verbieten den geprüften Pfad in der robots.txt. Für „Buy locally" heißt das:

1. **Bester Fall — ein Deep Link:** ein nationaler Dienst unabhängiger Buchhandlungen nimmt ISBN (und am besten Postleitzahl) in der Adresse; der Leser klickt, der Dienst zeigt Läden mit Bestand oder Bestellmöglichkeit. Die Seite holt nichts, speichert nichts, und die robots.txt betrifft sie nicht, weil kein Roboter die Seite abruft, sondern der Leser. So funktioniert genialokal heute schon in `lib/buylinks.ts`.
2. **Zweiter Fall — offene Daten:** ein Verzeichnis unter offener Lizenz, einmal geladen und als Datei eingecheckt (wie `data/cover-index.json`), nie pro Anfrage.
3. **Kein Fall:** eine Kartenseite ohne Adressschema oder ein Verzeichnis, das Skripte abweist — dann höchstens ein Link auf die Startseite des Finders.

„Nicht filialisiert" ist am sichersten, wo die Liste **selbst** nur unabhängige Läden enthält (Genossenschaft oder Verband Unabhängiger). Mitgliederlisten allgemeiner Branchenverbände (Börsenverein, Hauptverband, SBVV, Booksellers Association) enthalten auch Thalia, Morawa, Orell Füssli oder Waterstones.

## Ergebnis je Land

Geprüft am 2026-09-26: Existenz (HTTP-Abruf), robots.txt, Adressschema aus Suchergebnissen und je einem Abruf. „Deep Link" heißt: die Seite kann ohne einen einzigen Abruf eine Adresse bauen. Wo ein Adressschema nur aus Suchergebnissen stammt, steht **„von Hand prüfen"**.

### Deutschland

| Dienst | Was er ist | Nicht-Kette | Bestellen / Abholen | Adresse | robots / Zugriff | Affiliate | Urteil |
|---|---|---|---|---|---|---|---|
| **genialokal.de** | Gemeinschaftsshop der **eBuch eG** (Genossenschaft inhabergeführter Buchhandlungen, > 800 Mitglieder; rund 700 im Shop) mit Libri | **stark** — eBuch lehnt Filialisierung ab, Mitglieder sind inhabergeführt | Bestand je Laden sichtbar, reservieren, über Nacht in den Laden bestellen, Versand; ~80 % holen laut genialokal ab | ISBN: `/Suche/?q=<isbn>` (in `lib/buylinks.ts`, am 2026-09-26 in Chrome bestätigt, history 6.41). **Laden wählen:** `?storeID=<kürzel>` an jeder Adresse (z. B. `?storeID=rahden`, aus Suchergebnissen). Postleitzahl in der Adresse: keine gefunden — die Seite fragt PLZ oder Standort selbst ab | `/Suche/`, `/api` für Roboter gesperrt; Anubis-Botschutz (WebFetch 404, curl erhält eine Honeypot-Seite) → die Liste der Läden ist für uns nicht abrufbar | Awin, 7,5 %, 60 Tage (im Hobby-Modus E20 ohnehin aus) | **Deep Link — bester Dienst in DE.** Für „genau dieser Laden" fehlt die Zuordnung PLZ → `storeID`; die gibt es nur von eBuch |
| buchkatalog.de | Zeitfracht (Grossist), > 2.000 Partnerbuchhandlungen, Click & Collect | schwach — jeder Zeitfracht-Kunde | ja | nicht untersucht | robots: nur SEO-Bots gesperrt | — | nicht nötig neben genialokal |
| buchhandlung.de | Libri-Plattform, Karte „Lieblingsbuchhandlung finden", Läden mit eigenem Libri-Shop (`<laden>.buchhandlung.de`) | schwach — jeder Libri-Kunde | ja, je Laden | Karte ohne Adressschema; Ladenshops je Subdomain | `/shop/article/` für Roboter gesperrt | — | nicht nutzbar als Finder |
| buchhandlung-finden.de | früher Börsenverein, > 5.000 Läden | schwach (Verbandsmitglieder inkl. Ketten) | — | — | leitet am 2026-09-26 auf eine Börsenverein-Seite ohne Finder um | — | **eingestellt** |

### Österreich

| Dienst | Was er ist | Nicht-Kette | Bestellen | Adresse | Zugriff | Urteil |
|---|---|---|---|---|---|---|
| buchhandel.at | Verzeichnis des **Hauptverbands** (Mitglieder, Öffnungszeiten, ob Onlineshop, Bücherschecks) | **schwach** — Mitglieder schließen Thalia und Morawa ein | verweist auf den Onlineshop des Ladens | WordPress-Archiv `/buchhandlung/`, Kategorien; keine PLZ-Adresse gefunden | robots: nichts gesperrt | **Link auf das Verzeichnis**, nicht als Daten |
| buecher.at/buylocal | Liste von Mitglieds-Onlineshops („Unterstützen Sie Ihre Buchhandlung") | schwach | ja, je Laden | statische Liste | — | Quelle zum Abgleich von Hand |
| buchkatalog.at | Zeitfracht-Portal, Abholung im Partnerladen | schwach | ja | nicht untersucht | — | nicht nötig |

**Kein nationaler Dienst unabhängiger Läden mit ISBN-Suche gefunden.** genialokal liefert nur in Deutschland.

### Schweiz

| Dienst | Was er ist | Nicht-Kette | Bestellen | Adresse | Urteil |
|---|---|---|---|---|---|
| Buchzentrum — Genossenschaftsmitglieder | Liste der Partnerbuchhandlungen des Grossisten Buchzentrum (Genossenschaft), je Ort eine Seite | mittel — Genossenschaft, aber nicht als „unabhängig" definiert | über den eigenen Shop des Ladens | `buchzentrum.ch/de/buchwelt-schweiz/buchhandlungen/<ort>` (aus Suchergebnissen; von Hand prüfen) — Ort, keine PLZ | **Link je Ort möglich**, Zuordnung PLZ → Ort nötig |
| LivreSuisse Boutique (Romandie) | seit 2025 gemeinsamer Shop von 40–44 **unabhängigen** Westschweizer Buchhandlungen; Laden wird beim Kauf gewählt | stark | ja, Abholung oder Versand | nicht untersucht | Kandidat für Deep Link (fr-CH), von Hand prüfen |
| SBVV „who is who" | Branchenverzeichnis; SBVV definiert „unabhängig" als **höchstens drei Standorte** | schwach (Verzeichnis enthält Ketten), aber die Definition ist nützlich | — | — | nur die Definition |

### USA

| Dienst | Was er ist | Nicht-Kette | Bestellen / Abholen | Adresse | Zugriff | Affiliate | Urteil |
|---|---|---|---|---|---|---|---|
| **Bookshop.org** | Online-Shop für Indies; ABA-Plattform seit 2023; Store Locator `/pages/bookstores` | stark (nur unabhängige Läden) | **keine Abholung** — versendet vom Grossisten; der gewählte Laden bekommt die Marge | ISBN: `/a/<affiliate>/<isbn>` bzw. `/search?keywords=<isbn>` (schon in `lib/buylinks.ts`) | `/search` für Roboter gesperrt; Skripte erhalten 403 | ja (4.1) | Deep Link, aber **kein lokaler Laden zum Vorbestellen** |
| **IndieBound Indie Store Finder** (ABA) | Karte, nur **ABA-Mitglieder** (unabhängig, Ladengeschäft) | stark | über die Website des Ladens | Formular per POST (`search_for`), kein GET-Parameter gefunden | robots erlaubt | IndieBound-Affiliate ging 2023 zu Bookshop.org | **Link auf den Finder** (ohne PLZ) |

### Vereinigtes Königreich

| Dienst | Was er ist | Nicht-Kette | Bestellen / Abholen | Adresse | Zugriff | Urteil |
|---|---|---|---|---|---|---|
| **Hive.co.uk** | Shop des Grossisten Gardners, > 350 unabhängige Läden; Leser wählt per Postleitzahl einen Laden und holt dort ab (Laden erhält 10–25 %) | stark (Independent Bookshop Network) | **ja, Click & Collect im gewählten Laden** | Store Locator `/storelocator`; ISBN-Suchadresse nicht bestätigt (von Hand prüfen) | Cloudflare antwortet Skripten 403 | **Deep Link — bester Dienst im UK**, sobald das Adressschema von Hand bestätigt ist |
| Bookshop.org UK | wie USA | stark | keine Abholung | wie USA | 403 für Skripte | Deep Link, nicht lokal |
| Booksellers Association — Bookshop Search | alle BA-Mitglieder UK & Irland, Filter, Website und Telefon | **schwach** — Mitglieder schließen Waterstones, WHSmith ein | — | ASP.NET-Formular mit Postback, keine Adresse mit PLZ | robots.txt 404 | nur Link auf die Suchseite |

### Frankreich

| Dienst | Was er ist | Nicht-Kette | Bestellen / Abholen | Adresse | Zugriff | Urteil |
|---|---|---|---|---|---|---|
| **librairiesindependantes.com** | Suchmaschine des Syndicat de la librairie française (SLF) über 16 Portale, > 1.200 unabhängige Läden, mit Charta | stark | Buch suchen → Laden nach Standort wählen → Abholung oder Versand beim Partnerportal | **`/product/search/?query=<isbn>`** — am 2026-09-26 mit 9782070360024 (*L'Étranger*, Folio) abgerufen: zeigt das Buch, Standortwahl auf der Seite, Weiterleitung zu den Portalen | robots.txt 404 (nichts gesperrt) | **Deep Link, bestätigt — bester Dienst in FR** |
| Place des Libraires | ~650–1.000 Läden, täglicher Bestandsabgleich, reservieren ohne Konto | mittel | ja | nicht untersucht | 403 für Skripte | über librairiesindependantes erreichbar |
| leslibraires.fr | Portal eines Netzes unabhängiger Läden | stark | ja | `/recherche/` für Roboter gesperrt | — | über librairiesindependantes erreichbar |
| **Base des librairies en France** (Kulturministerium, data.gouv.fr) | offene Daten, Licence Ouverte 2.0, Stand 2026-04-20 | Label-Spalte: **502 LIR** (unabhängige Referenzbuchhandlung), 34 LR; Ketten enthalten (58 Zeilen mit Fnac/Cultura/Gibert/Decitre/Furet im Namen) | — | CSV, **3.237 Zeilen**; Felder: Name, Sortiment, Label, Gemeinde, INSEE-Code, PLZ, Département, Region — **keine Website, keine Koordinaten** | frei | Daten, aber ohne Website nur als Gegenprobe |

### Spanien

| Dienst | Was er ist | Nicht-Kette | Bestellen / Abholen | Adresse | Zugriff | Urteil |
|---|---|---|---|---|---|---|
| **todostuslibros.com** | Plattform des Buchhändlerverbands **CEGAL**, gefördert vom Kulturministerium; zeigt nach Standort die Läden **mit Bestand**; kaufen oder reservieren und abholen | mittel — „für jede Buchhandlung, unabhängig von der Größe", Werbung „librerías de barrio" | ja | Buchseite `/libros/<slug>_<isbn-mit-bindestrichen>` (z. B. `el-extranjero_978-84-206-6978-6`); die ISBN allein reicht nur über `/busquedas?…` (Parameter von Hand prüfen) | `/busquedas` und `/libros/*/librerias` für Roboter gesperrt — ein Leserklick ist kein Roboter | **Deep Link, mit Vorbehalt Adressschema** |
| Bookshop.org ES | 2021 mit 200 Läden gestartet | — | — | **`es.bookshop.org` leitet am 2026-09-26 per 301 auf bookshop.org um** | — | **eingestellt** (Wikipedia nennt nur noch US und UK) |

### Italien

| Dienst | Was er ist | Nicht-Kette | Bestellen / Abholen | Adresse | Zugriff | Urteil |
|---|---|---|---|---|---|---|
| **Bookdealer.it** | E-Commerce nur für **unabhängige** Buchhandlungen, > 700 Läden; beim Kauf werden die Läden nahe der Adresse zuerst gezeigt; Abholung oder Lieferung, der Betrag geht an den Laden | stark | ja | **`/libro/<isbn>/<slug>`** (aus Suchergebnissen; ob der Slug weggelassen werden kann, von Hand prüfen) | am 2026-09-26 von hier nicht erreichbar (curl Zeitüberschreitung, WebFetch 522) | **Deep Link — bester Dienst in IT** |

### Niederlande

| Dienst | Was er ist | Nicht-Kette | Bestellen / Abholen | Adresse | Zugriff | Urteil |
|---|---|---|---|---|---|---|
| **Libris.nl** | Gemeinschaftsshop von ~230 **zelfstandige** Libris- und Blz.-Buchhandlungen; „Waar is dit boek op voorraad" nach PLZ; Kauf geht an den lokalen Laden | mittel-stark — Inhaber unabhängig, aber unter gemeinsamer Marke (Formel) | ja | je Laden: `libris.nl/<laden>/a/<autor>/<titel>/<isbn>` (aus Suchergebnissen, z. B. `boek-en-buro`); allgemein `libris.nl/boek?authortitle=…-<isbn>`; von Hand prüfen, ob eine reine ISBN-Adresse geht | 403 für Skripte | **Deep Link — bester Dienst in NL**; ob eine Formel als „nicht Kette" zählt, entscheidet Julian |
| KBb (Koninklijke Boekverkopersbond) | Branchenverband | schwach | — | — | — | nicht nutzbar |

### International: OpenStreetMap

`shop=books` mit `brand`/`brand:wikidata` zum Aussortieren von Ketten, `website`/`contact:website` für den Link, `second_hand=only` für Antiquariate. Gemessen am 2026-09-26 (docs/history.md), je Postleitzahl ein Nominatim-Aufruf und eine Overpass-Abfrage im Umkreis von 15 km:

| Postleitzahl | Radius | `shop=books` | mit Website | Ketten (davon nur am Namen erkannt) | Antiquariat | ohne Kette | ohne Kette **mit Website** |
|---|---|---|---|---|---|---|---|
| Berlin 10997 | 5 km | 135 | 91 | 10 (1) | 15 | 125 | **87** |
| Berlin 10997 | 15 km | 295 | 196 | 29 (2) | 19 | 266 | 185 |
| London WC1E 7HX | 5 km | 141 | 82 | 29 (1) | 7 | 112 | **61** |
| London WC1E 7HX | 15 km | 283 | 167 | 78 (3) | 21 | 205 | 104 |
| Lüchow (Wendland) 29439 | 5 km | 1 | 1 | 0 | 0 | 1 | **1** |
| Lüchow 29439 | 15 km | 6 | 1 | 0 | 1 | 6 | 1 |
| Northampton MA 01060 | 5 km | 6 | 4 | 0 | 1 | 6 | **4** |
| Northampton MA 01060 | 15 km | 12 | 7 | 1 | 1 | 11 | 6 |

Was die Zahlen sagen:

- **In der Stadt reicht OSM für „eine Buchhandlung mit Website in der Nähe" reichlich**; das Ausschließen von Ketten über `brand` trifft 9 von 10 (Berlin) und 28 von 29 (London); der Rest braucht eine Namensliste (Waterstones, Thalia, WHSmith, Hugendubel, The Works, Oxfam, TG Jones, Foyles, Dussmann, Blackwell's, Barnes & Noble). Eine Namensliste irrt auch: „The Barnes Bookshop" fiel auf „Barnes". Grenzfälle, die Julian entscheiden muss: Daunt Books (5), Walther König (3, Kunstbuchläden mit `brand`), Oxfam (Wohltätigkeit, gebraucht).
- **Auf dem Land trägt OSM kaum:** Lüchow hat im 15-km-Umkreis sechs Einträge, davon eine Druckerei („Buchdruckerei", falsch getaggt) und ein Antiquariat; nur einer trägt eine Website. In Northampton fehlt der Odyssey Bookshop die Website, die er hat.
- **Eine Website ist kein Bestellweg.** OSM sagt nicht, ob der Laden online bestellen lässt; das müsste gemessen werden (unten).
- **Nutzungsregeln:** Nominatim erlaubt vom Nutzer ausgelöste Anfragen bei mäßiger Nutzerzahl (≤ 1/s, Cache Pflicht, eigener User-Agent, Attribution; keine Autovervollständigung, keine Massenabfragen). Die öffentlichen Overpass-Server sind ausdrücklich **nicht als Backend einer App** gedacht (~10.000 Anfragen/Tag Richtwert; empfohlen wird eine eigene Instanz). Also: **kein Live-Overpass aus der Website**, sondern ein einmal gebauter Auszug je Land als Datei (ODbL: Attribution und Share-Alike für die abgeleitete Datenbank). Postleitzahl → Koordinaten ginge ohne Nominatim über den GeoNames-Postleitzahlen-Export (CC BY 4.0), als Datei.
- Eine von fünf Overpass-Abfragen brach mit einem Serverfehler ab und ging beim zweiten Versuch durch — ein Fehler ist kein „keine Buchhandlung" (N12).

## Empfehlung

**Je Markt ein Deep Link in den nationalen Dienst unabhängiger Buchhandlungen, mit ISBN; der Leser wählt dort seinen Laden per Postleitzahl.** Keine Postleitzahl bei uns, kein Abruf, dieselbe Form wie die vorhandenen Kauflinks, und die Nicht-Ketten-Garantie liefert der Dienst:

| Land | Link | Garantie |
|---|---|---|
| DE | genialokal `/Suche/?q=<isbn>` (vorhanden) — als „Buy locally" hervorheben, nicht als einer von sechs Shops | eBuch-Genossenschaft |
| FR | librairiesindependantes.com `/product/search/?query=<isbn>` | SLF-Charta |
| IT | bookdealer.it `/libro/<isbn>/…` | nur Unabhängige |
| NL | libris.nl, ISBN-Adresse von Hand bestätigen | Libris/Blz. (Formel) |
| ES | todostuslibros.com, ISBN-Adresse von Hand bestätigen | CEGAL (nicht streng) |
| UK | hive.co.uk, ISBN-Adresse von Hand bestätigen | Independent Bookshop Network |
| US | Bookshop.org (vorhanden) **plus** Link auf den IndieBound-Finder für die Abholung beim Laden | ABA |
| AT, CH | Verzeichnis-Link (buchhandel.at, Buchzentrum je Ort, LivreSuisse für fr-CH); Deep Link fehlt | schwach |

**OSM nur dort, wo kein Dienst existiert (AT, CH, alle übrigen Länder), und dann als vorgebauter Auszug**, nicht live — und nur mit dem Hinweis, dass die Seite nicht weiß, ob der Laden bestellt. Die Postleitzahl kann dann im Browser gegen die Datei laufen, damit sie die Seite nie erreicht (N11).

Die Märkte US/UK/DE (`lib/market.ts`, E9) reichen für AT, CH, FR, ES, IT, NL nicht; „Buy locally" braucht ein **Land**, unabhängig vom Markt der übrigen Kauflinks — oder die Märkte wachsen (E9 berühren).

## Was vor dem Bauen gemessen wird

1. **Adressschemata von Hand in einem normalen Browser** (kein Skript): je Dienst drei ISBNs (ein Klassiker, eine Neuerscheinung, eine Vorbestellung, also ein Titel vor dem Erscheinungstag) — landet der Leser beim Buch, und kommt er in höchstens zwei Klicks zu einem Laden in seiner Postleitzahl? Besonders Hive, Libris, todostuslibros, Bookdealer, LivreSuisse.
2. **Vorbestellung**: welche Dienste führen Titel vor Erscheinen (genialokal und librairiesindependantes vermutlich ja), mit Abholung im Laden.
3. **Nur bei OSM:** 20 zufällige Läden ohne Kette mit Website aus Berlin und London von Hand öffnen — wie viele nehmen eine Bestellung online an (Shop, Formular, E-Mail)? Unter der Hälfte wäre „find the website of a local bookshop where one can preorder" mit OSM allein nicht einzulösen.
4. **Genauigkeit „ohne Kette"** auf dem Land: 10 kleine Orte in DE/AT/CH, OSM gegen genialokal bzw. buchhandel.at von Hand.

## Offene Entscheidungen (Julian)

1. **Deep Link reicht?** Der Dienst zeigt die Läden, nicht unsere Seite (Vorschlag). Die Alternative — die Seite nennt selbst den nächsten Laden — braucht Daten, die es in DE, UK, NL, IT, ES nicht offen gibt (genialokal, Hive, Libris weisen Skripte ab).
2. **eBuch fragen?** Eine Liste der genialokal-Läden mit `storeID` und PLZ (oder ein Parameter „PLZ" für die Suche) würde „genau dieser Laden" in DE ermöglichen. Das ist eine Mail von Julian, keine Technik.
3. **Was zählt als „nicht Kette"?** Formeln unabhängiger Inhaber (Libris/Blz., Buchzentrum-Partner), Kleinketten (Daunt, Walther König; SBVV-Grenze drei Standorte), Wohltätigkeitsläden (Oxfam).
4. **Land statt Markt:** ein eigenes Länderfeld für „Buy locally" oder Märkte erweitern (E9).
5. **OSM überhaupt?** Nur als Auszug, mit ODbL-Attribution auf der Seite und im About; oder AT/CH vorerst nur mit Verzeichnis-Link.
6. **Affiliate:** genialokal (Awin, 7,5 %), Bookshop.org, Hive haben Programme; im Hobby-Modus (E20) bleiben sie aus.

## Regeln (lab/README.md)

Kein Google; kein Abruf eines Händlers aus der Website; Tests ohne Netz; nichts erreicht die Website ohne eigenen Roadmap-Punkt. Ein Verzeichnis, das Skripte abweist oder in der robots.txt sperrt, wird nicht abgegrast.

## Quellen

- genialokal: [ebuch.net — genialokal Onlineshop](https://www.ebuch.net/produkte-leistungen/genialokal-onlineshop), [genialokal Mitmachen](https://www.genialokal.de/mitmachen/), [eBuch (Wikipedia)](https://de.wikipedia.org/wiki/EBuch), [buchmarkt.de 2025-12-22](https://buchmarkt.de/2025/12/22/buchhandelsverbundgruppe-ebuch-blickt-auf-erfolgreiches-jubilaeumsjahr-zurueck/), [literaturcafe.de](https://www.literaturcafe.de/bestellen-im-buchhandel/), [genialokal Affiliate](https://www.genialokal.de/Affiliate/), [affiliate-marketing.de](https://www.affiliate-marketing.de/partnerprogramme/genialokal.de), Beispiel `storeID`: [genialokal.de/?storeID=gzbuch](https://www.genialokal.de/?storeID=gzbuch)
- DE sonst: [buchkatalog.de Über uns](https://www.buchkatalog.de/UeberUns), [buchhandlung.de Karte](https://www.buchhandlung.de/karte/karte.html), [Pressemitteilung buchhandlung-finden.de](https://www.verbaende.com/news/pressemitteilung/bequem-zur-naechsten-buchhandlung-ueberall-in-deutschland-mit-der-neuen-suchmaschine-www-buchhandlung-finden-de-103874/)
- AT: [buchhandel.at Buchhandlungen](https://buchhandel.at/buchhandlungen/), [buecher.at/buylocal](https://buecher.at/buylocal/), [Konsument: Online-Buchhandel](https://konsument.at/markt-dienstleistung/online-buchhandel)
- CH: [Buchzentrum Genossenschaftsmitglieder](https://www.buchzentrum.ch/de/buchwelt-schweiz/buchhandlungen/partner), [SBVV who is who](https://www.sbvv.ch/who-is-who), [SBVV-Umfrage Unabhängige Buchhandlungen 2023](https://www.sbvv.ch/userfiles/Branchenmonitor/2023-Umfrage_Unabhangige_Buchhandlungen_SBVV.pdf), [RTS: LivreSuisse-Boutique](https://www.rts.ch/info/culture/livres/2025/article/nouvelle-boutique-en-ligne-40-librairies-romandes-reunies-sur-livresuisse-28862896.html), [Le Temps](https://www.letemps.ch/culture/livres/les-librairies-independantes-romandes-s-allient-pour-la-vente-en-ligne)
- US: [IndieBound Indie Store Finder](https://www.indiebound.org/indie-store-finder), [IndieBound (Wikipedia)](https://en.wikipedia.org/wiki/IndieBound), [Bookshop.org Store Locator](https://bookshop.org/pages/bookstores), [Bookshop.org: Laden wählen](https://support.bookshop.org/en/support/solutions/articles/65000189158-how-do-i-choose-which-bookstore-i-m-supporting-), [Bookshop.org: keine Abholung](https://support.bookshop.org/en/support/solutions/articles/65000168045/), [ABA Membership](https://www.bookweb.org/membership)
- UK: [Hive Bookshop Finder](https://www.hive.co.uk/storelocator), [The Bookseller: Hive launches with 350 indies](https://www.thebookseller.com/news/gardners-hive-launches-350-indies-board), [BA Bookshop Search](https://www.booksellers.org.uk/bookshopsearch.aspx)
- FR: [librairiesindependantes.com](https://www.librairiesindependantes.com/), [Base des librairies en France (data.gouv.fr)](https://www.data.gouv.fr/datasets/base-des-librairies-en-france), [CNL: Liste LIR 2026](https://centrenationaldulivre.fr/sites/default/files/2026-01/liste-etablissements-labellises-lir-au-1er-janvier-2026.pdf), [Place des Libraires (capcampus)](https://www.capcampus.com/livre-1354/en-un-cllic-trouvez-le-libraire-qui-a-en-stock-le-livre-que-vous-recherchez-a13059.htm), [leslibraires.fr Netz](https://www.leslibraires.fr/le_reseau/)
- ES: [todostuslibros Quiénes somos](https://www.todostuslibros.com/servicios/quienes_somos), [CEGAL: Todos tus libros](https://www.cegal.es/que-hacemos/proyectos-tecnologicos-y-de-innovacion/todos-tus-libros/), [Publishnews: Bookshop.org llega a España (2021)](https://publishnews.es/la-plataforma-bookshop-org-llega-a-espana/), [Bookshop (Wikipedia)](https://en.wikipedia.org/wiki/Bookshop_(company))
- IT: [Bookdealer](https://www.bookdealer.it), [Bookdealer (Wikipedia)](https://it.wikipedia.org/wiki/Bookdealer), [StartupItalia](https://startupitalia.eu/lifestyle/bookdealer-come-funziona-le-commerce-delle-librerie-indipendenti/)
- NL: [Libris Over Libris](https://libris.nl/klantenservice/over-libris), [Libris Waar is dit boek op voorraad](https://libris.nl/klantenservice/waar-is-dit-boek-op-voorraad), [Libris Winkels](https://libris.nl/winkels)
- OSM: [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/), [Overpass: Commons / Fair use](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html), [GeoNames Postleitzahlen](https://download.geonames.org/export/zip/)
