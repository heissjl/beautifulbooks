# Antiquariate für ältere Ausgaben: welche Suchseite, und wann sie vorn steht

Stand: 2026-09-26, Recherche von Claude auf Julians Frage:

> „schau ob es dienste oder websites von antiquariaten gibt oder eine antiquariaten-kette die eine suchseite hat, die wir besonders für ältere werke benutzen können (und da dann auch voranstellen in der auswahl)"

Gehört zu ROADMAP **4.10** (die Nummer 4.6 ist seit 2026-09-08 vergeben, E19). Kein Code geändert. Die Messungen stehen auch in der [Historie](history.md).

## 1. Das Ergebnis in sechs Sätzen

1. **Eine Kette von Antiquariaten mit eigener Suchseite gibt es in keinem der drei Märkte.** Der antiquarische Handel besteht aus Einzelhändlern, die ihren Bestand auf Marktplätzen anbieten. Was es als Kette gibt, sind Wiederverkäufer gebrauchter Bücher (World of Books, medimops/momox, reBuy, ThriftBooks, Better World Books, Half Price Books) und die Oxfam-Buchläden. Deren Bestand beginnt praktisch mit der ISBN; für ein Buch von 1929 sind sie die falsche Adresse.
2. **Für ältere Ausgaben trägt weiter AbeBooks**, in Deutschland unter dem Namen **ZVAB** mit demselben Bestand (beide gehören seit 2008 zu Amazon). Nach Titel, Autor, Verlag und Jahr zu suchen, geht dort schon heute (`searchLinksFor`), und das Partnerprogramm zahlt 5 % über Impact.
3. **Der eine neue Kandidat, den ich empfehle, ist Antiqbook** (Niederlande, unabhängig, europäische Antiquare). Die Suche ist per robots.txt erlaubt, liefert Treffer im HTML, und sie lässt sich nach Titel, Autor und Jahr fragen. Getestet: *Berlin Alexanderplatz*, Döblin, 1929 findet genau die **S.-Fischer-Erstausgabe von 1929** (Celler Versandantiquariat, 100 €). Ein Partnerprogramm habe ich nicht gefunden.
4. **Biblio** (USA, unabhängig, stark bei seltenen Büchern, 5 % über Awin) ist für US und UK die zweite Wahl nach AbeBooks. Der Suchpfad ist für Crawler gesperrt, genau wie bei AbeBooks, eBay und fast allen anderen. Darum habe ich ihn nicht abgerufen, und das URL-Muster bleibt **unverifiziert**.
5. **Die Metasuchen scheiden für einen Leser-Link aus.** viaLibri, die beste Suche für seltene Bücher, dokumentiert zwar eine „Search Link API“, zeigt Besuchern ohne Konto aber eine Anmeldeseite. Die ILAB-Suche braucht ein Formular-Token. eurobuch schaltet vor die Treffer eine Bot-Prüfung, in der ein CAPTCHA kommen kann. BookFinder (Amazon) und AddALL sperren ihre Suche für alle Crawler.
6. **Vorschlag:** eine Ausgabe gilt als „älter“, wenn sie **keine ISBN** hat oder ihr **Jahr vor 1970** liegt, optional auch, wenn es **vor 1990** liegt. Dann stehen die antiquarischen Suchen vorn, gefragt mit den Feldern des gewählten Drucks, und der Satz darunter sagt, dass niemand nachgesehen hat, ob es ein Exemplar gibt. Das ist eine Tatsache über den Druck, wie die Registrierungsgruppe der ISBN, und keine Sortierung nach Provision. Aufwand etwa ein Tag.

## 2. Wie gemessen wurde

- **robots.txt** von 32 Adressen am 2026-09-26 gelesen, einmal je Adresse, mit einem gewöhnlichen Browser-User-Agent.
- **Suchpfade, die robots.txt für `User-agent: *` sperrt, habe ich nicht abgerufen**, auch keinen einzelnen Test: AbeBooks, ZVAB, Booklooker, Biblio, Alibris, BookFinder, AddALL, viaLibri, eBay, World of Books, reBuy, medimops (die Suche). Dort steht „nicht abgerufen“, und das Muster stammt aus der Dokumentation des Anbieters, aus dem eigenen Code (AbeBooks ist seit 2026-09-10 im Betrieb und wurde im Browser geprüft, [Testbericht M10](tests/2026-09-11-mobil.md)) oder aus Adressen, die eine Suchmaschine indexiert hat.
- **Erlaubte Suchpfade** habe ich je Muster **einmal** abgerufen, mit einer ISBN eines älteren Drucks (dtv-Taschenbuch 295, *Berlin Alexanderplatz*, `9783423002950`) und einem Druck ohne ISBN (Döblin, S. Fischer 1929; Fitzgerald, Scribner 1925). Zwischen den Abrufen lagen ein bis zwei Sekunden.
- Wo Cloudflare oder eine eigene Bot-Prüfung antwortete (403, 425), steht **„unverifiziert“**. Ein Leser im Browser sieht dort womöglich Treffer, der Abruf beweist es nicht.

## 3. Die Dienste im Einzelnen

**Typ:** M = Marktplatz unabhängiger Antiquare, K = Kette/Wiederverkäufer gebrauchter Bücher, S = Metasuche.

### 3.1 Marktplätze antiquarischer Händler

| Dienst | Typ, Eigentum | Ohne ISBN? | URL-Muster | robots.txt (`*`) | Test | Partnerprogramm | Urteil |
|---|---|---|---|---|---|---|---|
| **AbeBooks** (.com/.co.uk/.de) | M, Amazon (seit 2008) | **ja**: Titel `tn`, Autor `an`, Verlag `pn`, Jahr `yrl`/`yrh` | `/servlet/SearchResults?isbn=…`; `/servlet/SearchResults?tn=…&an=…&pn=…&yrl=1929&yrh=1929` | `/servlet/` gesperrt (nur Google/Bing erlaubt) | nicht abgerufen; im Betrieb seit 2026-09-10, im Browser geprüft (M10: 270 Angebote *Infinite Jest* nach Titel/Autor) | 5 % bis 400 €, 30 Tage Cookie, Impact; ein Konto für alle Domains inkl. ZVAB; Deep-Links nach ISBN, Titel, Autor erlaubt | **bleibt die Grundlage**, weltweit der größte Bestand |
| **ZVAB** | M, gleicher Bestand wie AbeBooks.de, Amazon | ja, dieselben Felder | `https://www.zvab.com/servlet/SearchResults?tn=…&an=…&pn=…&yrl=…&yrh=…` | wie AbeBooks | nicht abgerufen | über dasselbe AbeBooks-Konto | **im Markt DE statt „AbeBooks“ zeigen**: gleicher Bestand, aber der Name, den deutsche Leser mit Antiquariat verbinden. `antiquariat.net` und `choosebooks.de` leiten auf zvab.com weiter |
| **Booklooker** | M, unabhängig (DE) | Titelpfad **unbestätigt**; indexierte Adressen zeigen `…/Angebote/autor=…` und `…/infotext=…` | `https://www.booklooker.de/B%C3%BCcher/Angebote/isbn=…` (im Betrieb) | **`Disallow: /` für alle unbekannten Bots**; nur benannte Suchmaschinen dürfen | nicht abgerufen | 4–5 %, eigenes Programm über Netzwerke | im Markt DE mit ISBN behalten; ohne ISBN nur, wenn Julian `titel=`/`autor=` einmal im Browser bestätigt (ROADMAP 1.8) |
| **Biblio** (.com/.co.uk) | M, unabhängig (Asheville, USA), seltene Bücher | ja: Autor, Titel, Verlag, Jahr, ISBN | `https://www.biblio.com/search.php?author=…&title=…&publisher=…` (Muster aus der Formularseite, **unverifiziert**) | `/search.php` gesperrt | nicht abgerufen | 5 % (über 500 $ pauschal 25 $), eigenes Programm und Awin | **zweite Wahl für US/UK**, nachdem Julian das Muster einmal im Browser bestätigt hat |
| **Alibris** | M, unabhängig (USA) | ja (Titel, Autor, Stichwort) | `/booksearch?mtype=B&title=…&author=…` | `/booksearch?` gesperrt | nicht abgerufen | 4–5 %, 10 Tage Cookie | Reserve; deckt sich großteils mit AbeBooks und Biblio |
| **Antiqbook** | M, unabhängig (NL), europäische Antiquare | **ja: `title`, `author`, `year`** | `https://www.antiqbook.com/search?q=<ISBN>`; `https://www.antiqbook.com/search/advanced?title=…&author=…&year=1929` | **erlaubt** (gesperrt sind nur Konto, Warenkorb, `/ajax/`) | **ISBN `9783423002950`: 1 Treffer** (dtv 1996). **Döblin/Titel/1929: 1 Treffer, S. Fischer 1929.** Gatsby/Fitzgerald ohne Jahr: 52 Treffer (1946, 1948, 1953 darunter). Suche `q=` mit `yearFrom=yearTo=1925`: 2 Treffer, beide Kassetten ohne Buch. Alles im HTML | nicht gefunden; Händler zahlen Antiqbook Provision oder eine Monatsgebühr | **neu aufnehmen**, für alle Märkte, bei älteren Ausgaben vorn in DE, in US/UK hinter der Klappe |
| **antikvariat.net** | M, Skandinavien | vermutlich | — | erlaubt | Startseite 403 (Bot-Schutz), unverifiziert | — | außerhalb unserer Märkte |

### 3.2 Metasuchen

| Dienst | Eigentum | Ohne ISBN? | URL-Muster | robots.txt | Test | Partnerprogramm | Urteil |
|---|---|---|---|---|---|---|---|
| **viaLibri** | unabhängig; durchsucht nach eigener Angabe über 20.000 Antiquare auf 35 Plattformen | ja: `author`, `title`, `publisher`, `all_text` (für ISBN), `year_min`, `year_max` | `https://www.vialibri.net/searches?title=…&author=…&year_min=1929&year_max=1929&source=beautifulcovers` (offizielle „Search Link API“) | `/searches/*` gesperrt | nicht abgerufen. **Die API-Seite selbst sagt: Besucher ohne Anmeldung sehen die Anmeldeseite**, dazu „nicht für automatische Suchen“ und etwa 100–200 Suchen je Nutzer und Tag | keins bekannt | **nicht als Leser-Link**: ein Knopf, der auf eine Anmeldung führt, ist ein kaputter Knopf. Auf der About-Seite als Tipp für Sammler denkbar |
| **ILAB** | Weltverband der Antiquare; Suche „powered by viaLibri“ | ja (Titel, Autor, Verlag, Stichwort) | Formular mit `action=ilab/vialibri/search` und `CRAFT_CSRF_TOKEN` | erlaubt | kein stabiler Deep-Link möglich (Token), unverifiziert | — | nein; der Verband ist aber das Gütesiegel, wenn jemand nach „echten“ Antiquaren fragt |
| **eurobuch** (.de/.com) | unabhängig (DE); nach eigener Angabe rund 60.000 Anbieter, darunter ZVAB, AbeBooks, Booklooker, eBay, Amazon | teilweise: `author`, `title`, `publisher`, `isbn`; **kein Jahresfeld** im Formular | `https://www.eurobuch.de/search_results.php?isbn=…`; `…?author=…&title=…&publisher=…` | Suchpfad **erlaubt**; gesperrt sind `/meta/`, `/click.php` u. a., und `ClaudeBot` ausdrücklich ganz | **HTTP 425 mit Bot-Prüfung**: die Seite erkannte die ISBN als Döblin/dtv, zeigte die Treffer aber erst nach einer „Sicherheitsprüfung (ggf. mit CAPTCHA)“ oder mit Konto. Unverifiziert | eigenes Partnerprogramm, Satz nicht veröffentlicht | Reserve für DE, hinter der Klappe; nicht vorn, solange ein Klick in einer Prüfung landen kann |
| **BookFinder** / JustBooks | AbeBooks, also Amazon (seit 2005) | ja | `/search/?author=…&title=…` | `/search/`, `/suche/` für `*` gesperrt | nicht abgerufen | verdient an den Plattformen, kein eigenes Programm | nein; bringt gegenüber AbeBooks nichts Unabhängiges |
| **AddALL** | unabhängig | ja | — | **`Disallow: /`** für `*` | nicht abgerufen | eBay, Amazon, Alibris | nein |

### 3.3 Ketten und Wiederverkäufer gebrauchter Bücher

| Dienst | Markt | Ohne ISBN? | robots.txt Suche | Test | Partnerprogramm | Urteil |
|---|---|---|---|---|---|---|
| **Oxfam Online Shop** | UK | Stichwort; eigene Rubriken „Antiquarian 1901–1949“, „1801–1900“ usw. | `/search/` auf oxfam.org.uk gesperrt; `onlineshop.oxfam.org.uk` antwortete nicht (Zeitüberschreitung) | unverifiziert | 10 %, 30 Tage, Awin | **der einzige Kettenladen mit echtem antiquarischem Bestand** und mit Spendenzweck; ein Suchmuster fehlt noch. Kandidat für UK hinter der Klappe, sobald Julian eines im Browser findet |
| **World of Books / Wob** | UK, US | nein, praktisch nur ISBN-Bestand | `/search` gesperrt | nicht abgerufen | 5 % (Awin) | nein für ältere Ausgaben |
| **medimops / momox shop** | DE | nein, praktisch nur ISBN-Bestand | Suchparameter `fcIsSearch` gesperrt; momox-shop.de hinter Cloudflare | nicht abgerufen | 10 % (medimops, Awin), momox bis 20 % | nein |
| **reBuy** | DE | nein | `/kaufen/suchen` und `?q=` gesperrt | nicht abgerufen | bis 13 % (Awin) | nein |
| **ThriftBooks** | US | Freitext (schon im Code) | `/browse/` erlaubt | *Gatsby Fitzgerald Scribner 1925*: 1 Treffer im HTML, eine heutige Ausgabe des Werks, kein Druck von 1925 | Impact/Partnerize | bleibt, wo es ist; kein Antiquariat |
| **Better World Books** | US, UK | Freitext | Suche für `*` nicht gesperrt | 403 (Cloudflare), unverifiziert | 5 %, CJ | steht schon in 4.3 wegen des Spendenzwecks; für ältere Ausgaben nicht besser als AbeBooks |
| **Half Price Books** | US (Ladenkette) | — | robots.txt hinter Cloudflare (403) | unverifiziert | — | nein, nicht prüfbar |
| **Powell's** | US | Freitext | erlaubt | 403 (Cloudflare), unverifiziert | eigenes Programm | nein; gebraucht, aber kaum antiquarisch |

### 3.4 Österreich und Schweiz

Eigene Suchen der Verbände habe ich nicht gefunden: antiquare.de (Verband Deutscher Antiquare) und vebuku.ch haben keine Buchsuche auf der Startseite und verweisen auf ILAB bzw. viaLibri. **AT und CH laufen schon heute über den Markt `de`** (`COUNTRY_TO_MARKET`), und ZVAB, Booklooker und Antiqbook führen österreichische und Schweizer Händler. Ein eigener Markt lohnt sich dafür nicht.

## 4. Was robots.txt hier bedeutet

robots.txt regelt, was **Programme** abrufen dürfen: unsere Tests, eine serverseitige Prüfung wie der Verfügbarkeits-Knopf (F2.10, E12) und Crawler, die unseren Links folgen. Einen **Leser, der einen Link anklickt**, regelt sie nicht. Fast jede Buchseite sperrt ihre Suche für unbekannte Bots, AbeBooks, ZVAB und eBay eingeschlossen, deren Links seit Wochen im Betrieb sind. **Ein Unterscheidungsmerkmal ist die Sperre also nur dort, wo sie ungewöhnlich ist**: Booklooker sperrt alles, AddALL sperrt alles, eurobuch sperrt `ClaudeBot` namentlich.

Für die Seite heißt das zweierlei:

1. Keiner dieser Pfade wird je **automatisch** abgefragt, weder vom Verfügbarkeits-Knopf noch von einem Skript. Die Regel aus E12 gilt unverändert.
2. Die Bemerkung zu Bookshop.org in 4.1 („eine Suchseite, die per robots.txt gesperrt ist“) meint, dass der Link ohne Partner-ID auf eine Liste statt auf ein Buch führt und nichts einbringt. Als Ausschlussgrund für einen Leser-Link taugt sie nicht, sonst fiele auch AbeBooks. **Julian entscheidet**, ob das so gelesen wird. Für die Empfehlung unten habe ich es angenommen.

## 5. Empfehlung je Markt

| Markt | Vorn bei älteren Ausgaben | Hinter der Klappe | Neu im Code |
|---|---|---|---|
| **US** | AbeBooks · title & year, eBay | Biblio · title & year (nach Bestätigung), Antiqbook, ThriftBooks, WorldCat | Biblio, Antiqbook |
| **UK** | AbeBooks · title & year, eBay | Biblio, Antiqbook, Oxfam (sobald es ein Muster gibt), WorldCat | Biblio, Antiqbook |
| **DE** (+AT/CH) | **ZVAB** · title & year, **Antiqbook** · title & year; mit ISBN dazu Booklooker · ISBN | eBay, eurobuch, WorldCat | ZVAB statt AbeBooks.de, Antiqbook |

Warum Antiqbook in DE vorn steht und in US/UK nicht: seine Händler sitzen überwiegend in den Niederlanden, Deutschland, Belgien und Skandinavien. Der Test zeigt, dass es bei einem deutschen Titel von 1929 den richtigen Druck findet. Bei *Gatsby* dagegen kamen vor allem neue Folio-Ausgaben.

## 6. Vorschlag für die Seite

### 6.1 Die Regel: wann eine Ausgabe „älter“ ist

`linkPlan` kennt heute vier Fälle (`home`, `foreign`, `kdp`, `no-isbn`, SPEC §2.4). Vorgeschlagen ist eine fünfte Eigenschaft, **„älterer Druck“**. Sie verschiebt nur die Reihenfolge, der Rest bleibt:

| Stufe | Bedingung | Daten | In den Fixtures (245 Ausgaben mit Cover) |
|---|---|---|---|
| **A** | keine ISBN | `edition.isbn13` fehlt | 18 (7 %). Heute schon `no-isbn`; neu ist nur, *welche* Läden vorn stehen |
| **B** | Jahr **vor 1970** | `edition.year` | 9, davon 2 mit ISBN. Vor 1967–1970 gab es keine ISBN, eine ISBN an so einem Datensatz gehört also zu einem anderen Druck, oder das Jahr stimmt nicht. Dann fragt die Titel-und-Jahr-Suche zuerst, der ISBN-Link folgt |
| **C** *(Julian entscheidet)* | Jahr **vor 1990**, auch mit ISBN aus dem eigenen Sprachraum | `edition.year` | 15 weitere mit ISBN aus 1970–1989. Ein Druck von 1985 ist fast nie das, was ein Neubuchladen heute ausliefert, auch nicht unter derselben Nummer |

Die Fixtures sind Open Librarys **erste** Seiten, also die jüngsten Datensätze. Ältere Drucke liegen weiter hinten. Die wahren Anteile auf einer ganz geladenen Wand sind höher, gezählt habe ich sie nicht.

**Warum nur das Jahr und nicht das Verdikt:** „kein Verlagsbild“ (`unknown`) wäre ein gutes Zeichen, dass ein Druck vergriffen ist. Das Verdikt kommt aber erst einen Moment nach der Auswahl, und SPEC F2.9 hält fest, dass `pending` nichts bewegen darf. Mit dem Jahr steht die Reihe fest, bevor gefragt wird. `differs` behält seinen eigenen Fall. `verified` bei einem Druck vor 1990 heißt, dass der Verlag das Bild noch führt. Dann gilt `home` weiter, auch unter Stufe C: der Druck ist offenbar lieferbar.

Stufe C trifft zudem auf Julians Regel vom 2026-09-09 („wenn es aber die Möglichkeit gibt, einen Affiliate-Link zu setzen zu genau dieser Edition, sollte das Vorrang haben“). Bookshop und Amazon haben für eine ISBN von 1985 einen Link auf genau diese Nummer. **Stufe C hebt die Regel für alte Drucke auf, und das entscheidet Julian**, nicht der Code.

### 6.2 Wie der Link ohne ISBN gebaut wird

Die Felder kommen aus dem **gewählten Druck**, wie heute in `searchLinksFor`: Titel des Drucks, erster Autor des Werks, Verlag über `searchablePublisher` und über `searchFacts` (nur aus einem gedruckten Open-Library-Datensatz, E21) und das Jahr.

- **AbeBooks/ZVAB:** `tn`, `an`, `pn`, `yrl=yrh=Jahr`, wie bisher. Neu ist nur, dass im Markt DE die Domain `zvab.com` und die Beschriftung „ZVAB“ verwendet werden.
- **Antiqbook:** `/search/advanced?title=…&author=…&year=…`, **ohne Verlag**. Das Formular hat kein Verlagsfeld, und über `keywords` würde der Verlag die Treffer eher verschlucken (die Lehre aus ROADMAP 6.35: zu eng ist eine Sackgasse, etwas zu weit ist eine Liste). Mit ISBN `/search?q=<ISBN>`.
- **Biblio:** `author`, `title`, `publisher`, erst nach der Bestätigung im Browser.
- **Ein Jahr ± 1?** Open Library datiert oft nach der Auflage, ein Händler nach dem Titelblatt. `yrl=Jahr−1&yrh=Jahr+1` wäre gutmütiger. Vorschlag: vorerst beim genauen Jahr bleiben, wie heute, und erst bei einem gemessenen Fehlschlag weiten.

### 6.3 Wortlaut

Die Sätze zu den Fällen stehen in `noteFor` (`lib/linkplan.ts`), die Verdikte in `lib/verdicts.ts`. Beide Dateien bleiben die jeweils einzige Quelle. Vorschläge, alle ohne „available“, „in stock“ oder „has it“ (N12):

- **A/B, ohne ISBN:** „This printing is from 1929, before ISBNs, so shops that sell new books cannot look it up. These search second-hand and antiquarian listings by title, author and year. Whether any has a copy was not checked.“
- **B, mit ISBN:** wie oben, dazu „The ISBN on this record may belong to a later printing.“
- **C:** „This printing is from 1985. Copies of it are sold second-hand, so marketplaces for used and antiquarian books come first. Whether any has a copy was not checked.“

Das Jahr im Satz ist das des Datensatzes. Fehlt es, greift die Regel nicht (außer Stufe A), und es erscheint kein Satz über ein Alter, das niemand kennt.

### 6.4 Und die Provision?

SPEC §2.4 und die About-Seite sagen: die Reihenfolge ist **nicht nach Provision sortiert**, sie folgt der ISBN. Die neue Regel folgt dem **Alter des Drucks**, einer Tatsache über die Ausgabe von derselben Art wie die Registrierungsgruppe. Sie widerspricht dem Satz also nicht. Die About-Seite muss ihn aber erweitern („follows the ISBN and the age of the printing“), sonst beschreibt sie die Seite unvollständig.

Dazu schiebt die Regel die Reihe zu **niedrigeren** Sätzen: AbeBooks, ZVAB und Biblio zahlen 5 %, Antiqbook gar nichts, Bookshop.org 10 %. Im Hobby-Modus (E20) verdient ohnehin kein Link. Der Verdacht, nach Geld zu sortieren, fällt damit weg. Der einzige echte Konflikt ist der mit Julians Vorrangregel, siehe Stufe C.

### 6.5 Aufwand

| Schritt | Zeit |
|---|---|
| `isOlderPrinting(edition)` (rein, getestet) und die Leitlisten je Markt in `linkPlan` | 1–2 h |
| ZVAB-Domain und -Label für DE, Antiqbook (und später Biblio) in `searchLinksFor`/`RETAILERS`; `twoQuestionShops` nimmt Antiqbook auf | 1–2 h |
| `noteFor`-Sätze, About-Absatz, SPEC §2.4 (Tabelle und Fall), Tests (Leitreihe, keine Doppel-Labels, kein Satz ohne Jahr) | 1–2 h |
| Browser: Döblin 1929 (DE), Gatsby 1925 (US), ein Druck von 1985, bei 390 × 844 und 1280 × 800 | 1 h |

**Zusammen etwa ein Tag.** Keine neue externe Anfrage und kein Google: alle Links sind URL-Vorlagen, erzeugt beim Anzeigen.

## 7. Offene Entscheidungen (Julian)

1. **Die Dienste:** Antiqbook aufnehmen (empfohlen)? ZVAB statt AbeBooks.de im Markt DE (empfohlen)? Biblio für US/UK nach einer Bestätigung im Browser? Oxfam UK, wenn sich ein Suchmuster findet?
2. **Die Regel:** nur A + B (ohne ISBN oder vor 1970) oder auch C (vor 1990)? C hebt für alte Drucke die Vorrangregel für Partner-Links vom 2026-09-09 auf.
3. **robots.txt:** zählt ein für Crawler gesperrter Suchpfad gegen einen **Leser-Link** (dann fielen auch AbeBooks und eBay), oder nur gegen automatische Abrufe (so ist die Empfehlung gerechnet)?
4. **Drei Handgriffe im Browser, je zwei Minuten:** Booklooker `…/Angebote/titel=…` (ROADMAP 1.8), Biblio `search.php?author=&title=` und die Suche im Oxfam Online Shop. Ich rufe gesperrte Pfade nicht ab, ein Leser darf sie öffnen.

## 8. Quellen

- AbeBooks/ZVAB-Partnerprogramm: [zvab.com/partnerprogramm](https://www.zvab.com/partnerprogramm/), [abebooks.com/books/affiliateprogram](https://www.abebooks.com/books/affiliateprogram/)
- viaLibri: [Search Link API](https://www.vialibri.net/content/search-link-api), [FAQ](https://blog.vialibri.net/vialibri-faq/)
- ILAB: [Book Search](https://ilab.org/page/book-search)
- eurobuch: [Affiliateprogramm](https://www.eurobuch.de/partner.php)
- Booklooker-Partnerprogramm: [affiliate-marketing.de](https://www.affiliate-marketing.de/partnerprogramme/booklooker.de)
- Biblio: [Affiliate Program](https://www.biblio.com/affiliate-program), [Awin-Profil](https://ui.awin.com/merchant-profile/88369)
- Alibris: [Affiliates](https://www.alibris.com/affiliates/home)
- BookFinder gehört AbeBooks: [Wikipedia](https://en.wikipedia.org/wiki/BookFinder.com), [The Millions 2005](https://themillions.com/2005/11/abebooks-buys-bookfindercom.html)
- Antiqbook: [marelibri, About Antiqbook](http://www.marelibri.com/AboutAntiqbook.html)
- Oxfam Online Shop: [Awin-Profil](https://ui.awin.com/merchant-profile/2921), [Antiquarian 1901–1949](https://onlineshop.oxfam.org.uk/category/antiquarian-1901-1949)
- World of Books: [Awin UK](https://ui.awin.com/merchant-profile/116709)
- medimops/momox/reBuy: [medimops Partnerprogramm](https://www.medimops.de/Das-medimops-Partnerprogramm/), [reBuy](https://www.rebuy.de/s/partner-programm), [momox (Awin)](https://ui.awin.com/merchant-profile/11487)
- Better World Books: [Affiliate](https://www.betterworldbooks.com/go/affiliate)
- robots.txt jeweils unter `https://<host>/robots.txt`, gelesen am 2026-09-26.
