# Beautiful Books – Spezifikation

Stand: 2026-09-08. Diese Datei sagt, **was die Seite ist und sein soll**. Sie enthält keine Historie und keine offenen Aufgaben:

- Was noch zu tun ist, mit Reihenfolge und Zuständigkeit: [ROADMAP.md](ROADMAP.md).
- Was wann gebaut, gemessen und warum entschieden wurde: [docs/history.md](docs/history.md). Die Umsetzungspläne dazu: [docs/plans/](docs/plans/).
- Arbeitsregeln für Claude Code: [CLAUDE.md](CLAUDE.md).

Die Spec ist Deutsch; Code, Kommentare und Commits sind Englisch (E7). Wenn Code und Spec sich widersprechen, gilt die Spec, bis Julian anders entscheidet.

---

## 1. Produktidee

Eine visuelle Buchsuche. Man gibt einen Titel ein und bekommt pro **Buch** eine Karte mit einem Mosaik seiner Cover. Ein Klick öffnet die Detailseite mit den Covern, die zwei offene Kataloge zu diesem Buch kennen, nach Sprache gruppiert, mit den Ausgaben dahinter und Kauf-Links pro ISBN.

Kernwert: *Die Cover eines Buchs nebeneinander sehen und die Ausgabe finden, die man tatsächlich im Regal haben will.* Die Überschrift der Seite ist „Judge a book by its covers.“

**Die Seite verspricht keine Vollständigkeit.** Open Library und Google Books kennen zusammen nur einen Teil dessen, was je gedruckt wurde, und nur ein Teil der Datensätze trägt ein Bild (§7). Deshalb steht nirgends „every“, „all“ oder „complete“, weder im UI noch in Meta-Tags noch im README; der Zähler auf der Detailseite nennt, was tatsächlich geprüft wurde, und alle Texte müssen zu ihm passen.

Nicht Teil des Produkts (bewusst): Nutzerkonten, Bewertungen, Buchrücken-Bilder ([docs/spine-research.md](docs/spine-research.md)), eigene Buchdatenbank. Ein **Index abgeleiteter Werte** — Cover-Signaturen und Farbmaße, keine Katalogdatensätze — ist davon nicht betroffen (E18).

---

## 2. Domänenmodell

Typen in `lib/model.ts`.

### 2.1 Work (Buch)

Ein Work ist das abstrakte Buch, unabhängig von Ausgabe, Sprache und Format.

| Feld | Typ | Pflicht | Herkunft |
|---|---|---|---|
| `id` | string | ja | Open-Library-Work-ID (`OL30751W`), sonst synthetisch `t:<titel>::a:<autor>` |
| `title` | string | ja | Titel der Primärquelle |
| `authors` | string[] | ja (≥1) | Autorennamen. Open Library führt Übersetzer ohne Rolle unter den Autoren; sie werden auf der Detailseite über die Ausgaben erkannt (2.2) |
| `authorKeys` | string[] | nein | Open-Library-Autoren-Keys, zu `authors` ausgerichtet; Grundlage der Übersetzer-Erkennung |
| `firstPublishYear` | number | nein | Open Library |
| `editionCount` | number | nein | Gesamtzahl bei der Quelle, nicht nur die geladenen |

`WorkSummary` (Suchergebnis) trägt zusätzlich `popularity` (`readinglog_count`, `want_to_read_count`, `ratings_count` von Open Library) und `sourceRank`, die Position in Open Librarys eigener Reihung. Beide tragen das Ranking (F1.4).

**Identitätsregel:** Zwei Ausgaben gehören zum selben Work, wenn
1. beide dieselbe Open-Library-Work-ID haben, **oder**
2. normalisierter Titel **und** Erstautor übereinstimmen. Der Titel verliert dabei Untertitel nach „:“ und Reihen- oder Ausgabenzusätze in Klammern am Ende (seit 2026-09-08, ROADMAP 6.15 Schritt 1). Der Erstautor gilt als derselbe, wenn der Open-Library-Autoren-Key gleich ist **oder** der lose Namensschlüssel (Initiale + Nachname); der Key führt zusammen, trennt aber nie, weil Open Library dieselbe Person unter mehreren Keys führt (6.15 Schritt 2).

Sprache ist **kein** Teil der Work-Identität. Übersetzungen sind Ausgaben desselben Works.

**Zwei Stellen, an denen die Umsetzung hinter dieser Regel zurückbleibt.** Beide sind gemessen und in der Roadmap eingetragen; bis sie behoben sind, beschreibt dieser Absatz das Soll und nicht das Ist.

**Erstens: Übersetzungen bleiben eigene Karten.** Regel 2 vergleicht Titel *und* Autor, und eine Übersetzung hat einen anderen Titel — die Regel greift also nie, obwohl der Satz oben genau das verlangt. Bei der Suche „ansichten böll" sind fünf von sechs Karten derselbe Roman (ROADMAP 6.15). Eine verlässliche maschinelle Verbindung zwischen den Datensätzen gibt es nicht; welche Regel dazukommt oder ob dieser Absatz umgeschrieben werden muss, entscheidet die Messung dort.

**Zweitens: die Zusammenfassung gilt nur für die Suche, nicht für die Detailseite.** Open Library führt dasselbe Buch oft als mehrere Werk-Datensätze (*Ansichten eines Clowns*: sechs). Die Suche fasst sie nach Regel 2 zu einer Karte zusammen, die Detailseite lädt aber nur die Ausgaben **einer** ID. Folge: die Karte zeigt Cover und eine Ausgabenzahl, die die Wand nicht einlösen kann (14 gegen 8). **Beide Seiten müssen dieselbe Gruppe meinen**; wie, entscheidet [ROADMAP](ROADMAP.md) 6.13.

Normalisierung: lowercase, Diakritika entfernen, Satzzeichen entfernen, Whitespace zusammenfassen, führende Artikel (`the`, `a`, `der`, `die`, `das`, `le`, `la`) entfernen, Untertitel nach `:` abschneiden.

**Übersetzer:** Ein Autor, der nie der erste ist und dessen Open-Library-Key auf keiner Ausgabe in der Hauptsprache des Werks steht, ist ein Übersetzer und wird aus der Autorenzeile entfernt (`withoutTranslators`). Ausgaben ohne Sprachangabe zählen nicht als Beleg. Suchkarten ohne Ausgabendaten zeigen bei drei und mehr Namen nur den Erstautor.

### 2.2 Edition (Ausgabe)

Eine konkret veröffentlichte Ausgabe.

| Feld | Typ | Pflicht | Bemerkung |
|---|---|---|---|
| `id` | string | ja | `ol:OL123M` oder `gb:abc123` |
| `workId` | string | ja | Referenz auf Work |
| `source` | `'openlibrary' \| 'googlebooks'` | ja | |
| `title` | string | ja | Titel dieser Ausgabe (kann vom Work-Titel abweichen) |
| `coverUrl` | string | **ja** | Ausgaben ohne Cover werden nie angezeigt |
| `coverUrlSmall` | string | nein | Für Mosaik und Raster |
| `language` | string (ISO 639-1) | nein | Unbekannt = `undefined`, nicht `'unknown'` |
| `publisher`, `publishedDate`, `year` | | nein | `year` geparst aus `publishedDate` |
| `isbn13`, `isbn10` | string | nein | ISBN-13 bevorzugt, ISBN-10 wird konvertiert |
| `pageCount`, `format`, `description`, `previewUrl` | | nein | `format` aus `hardcover \| paperback \| ebook \| other`; `description` ohne HTML |

**Dedupe-Regel:** gleiche ISBN-13 = dieselbe Ausgabe, quellenübergreifend. Ohne ISBN bleibt jede Quell-Ausgabe eigenständig. Bei Duplikaten werden die Metadaten zusammengeführt (Beschreibung > Seitenzahl > Verlag), **die Cover beider Quellen bleiben erhalten** (2.3). Mehrere ISBN-13 an einem Datensatz werden nicht modelliert (betrifft 1 von 300 geprüften Datensätzen).

### 2.3 Cover (Entscheidung E8)

Ein Cover ist ein Bild, das eine oder mehrere Ausgaben tragen. Es ist die zentrale Entität des Produkts und **nicht** durch die ISBN bestimmt: Verlage drucken Backlist-Titel mit neuem Cover unter alter ISBN nach, und ein Design erscheint unter mehreren ISBNs. Beispiel: ISBN 9780684824772 (Scribner 1996) trägt bei Open Library das gemalte Cover von 1996 und im Handel das rote 50th-Anniversary-Cover von 2022.

| Feld | Typ | Bemerkung |
|---|---|---|
| `id` | string | `ol:<cover_i>` oder `gb:<volumeId>` |
| `url`, `urlSmall` | string | Bild groß und klein |
| `source` | Source | |
| `editionIds` | string[] | Ausgaben, die dieses Cover tragen, ≥1 |
| `similarIds` | string[] | Cover, die in dieses gefaltet wurden, weil sie dasselbe Design zeigen |

Regeln:
- **Dedupe nach Bild, nicht nach ISBN.** Zwei Cover-IDs sind zwei Cover, auch bei gleicher ISBN. Zwei Ausgaben mit gleicher ISBN werden zu einer Ausgabe, behalten aber alle ihre Cover.
- Open Library liefert pro Ausgabe ein `covers`-Array; **alle** gültigen IDs werden übernommen.
- **Signaturen** (`lib/imagehash.ts`, Server): dHash 64 Bit, Kontrast, mittlere Helligkeit, pro Cover berechnet und 30 Tage gecacht; die Route liefert sie pro Seite mit. **Gefaltet wird im Browser** (`foldDuplicateCovers`, `lib/works.ts`) über alle geladenen Seiten, in drei Stufen: Hamming-Distanz ≤ 8 immer; ≤ 20 bei gleicher ISBN-13; ≤ 16 bei gleichem Verlag, Jahr ±1 und gleicher oder unbekannter Sprache. Über Verlagsgrenzen oberhalb von 8 nie, über Sprachgrenzen nie. Katalog-Scan vor Google-Bild als Repräsentant; Kacheln zeigen „+N“.
- **Ein gefaltetes Cover muss erreichbar bleiben.** *Seit 2026-09-09 (ROADMAP 6.14): nicht über das „+N" auf der Kachel — das bleibt Zierde, und auf dem Telefon gibt es kein Hover —, sondern in der Seitenleiste.* Unter dem großen Cover steht **„The same cover, N scans"**: alle Scans desselben Motivs als kleine Kacheln, der Vertreter zuerst, die gewählte mit Ring. Ein Klick tauscht das große Bild; die URLs werden aus den Cover-IDs neu gebaut (`coverUrlFor`, rein), es musste dafür nichts durchs Modell getragen werden. Die Zeile „Image from …" nennt die Quelle **des gezeigten Scans**, nicht die der Kachel — ein Google-Cover kann in ein Open-Library-Cover gefaltet sein. Das ist derselbe Gedanke wie E16: ein Fehlurteil beim Falten soll eine Position kosten, kein Cover.
- **Nichts wird für leer gehalten und gelöscht.** `looksLikeScannedPage` (nahezu weiß, flach, ohne Struktur, alle drei zugleich) sortiert ein Bild nur ans Ende seiner Sprachgruppe. Die Zahlen, die eine Klappentextseite beschreiben, beschreiben auch einen weißen Umschlag und dunkle Leineneinbände (E16).
- **Die Acht bleibt, und das ist gemessen** (2026-09-09, [lab/fold](lab/fold/README.md)). Julians Beobachtung stimmt — dieselbe Gestaltung in zwei Scans liegt bei 11 und 12 (*The Outsider*, *Catch-22*), dieselbe Illustration rot gegen orange bei 16 (*The Catcher in the Rye*). **Anheben hilft trotzdem nicht:** in denselben Bändern liegen echte Unterschiede (*Herr der Ringe* gegen *Lord of the Rings* bei 11, zwei verschiedene *Lord of the Flies* bei 12). An 17 von Hand einsortierten Paaren trennt **kein** Maß die sieben gleichen von den zehn verschiedenen: weder Autokontrast noch Histogrammausgleich, weder ein 16×16- noch ein 32×32-Raster, weder eine Farbschranke noch eine Rauschmaske über den Bits (die schadet, weil auf flächigen Umschlägen kein sicheres Bit übrig bleibt). Oberhalb von 8 entscheidet deshalb weiter die Metadatenlage, nicht der Abstand. Wer das ändern will, braucht einen anderen Deskriptor **und** mehr als 17 beurteilte Paare — als gelerntes Maß auf Julians Vorschlag hin in ROADMAP 6.23 aufgenommen. Bis dahin ist die Regel hier die geltende, nicht die endgültige.
- Cover, die im Zeitbudget nicht gehasht wurden, bleiben ungefaltet; beim nächsten Aufruf liegen die Bilder im Cache. Die Cover-Zahl eines Werks sinkt deshalb bei wiederholtem Aufruf. Das ist gewollt und der Zähler sagt es nicht anders.

### 2.4 Kauf-Links und Markt (Entscheidung E9)

Links werden **nicht gespeichert**, sondern zur Anzeige aus der ISBN generiert (`lib/buylinks.ts`). Ein Nutzer hat einen **Markt**: `us` (Default), `uk`, `de`. Erkennung (`lib/market.ts`): `?market=` oder Cookie, dann `x-vercel-ip-country`, dann `Accept-Language`, sonst US; Umschalter in der Seitenleiste, Wahl in Cookie und localStorage. Die Oberfläche bleibt Englisch.

| Markt | Händler (Reihenfolge) | Amazon |
|---|---|---|
| `us` | Bookshop.org, Amazon, AbeBooks, ThriftBooks, eBay | amazon.com |
| `uk` | Bookshop.org UK, Amazon, Blackwell's, Waterstones, AbeBooks, eBay | amazon.co.uk |
| `de` | Thalia, genialokal, Amazon, Hugendubel, AbeBooks, Booklooker | amazon.de |

Zwei Ebenen:
- **Kaufen (braucht eine ISBN):** Amazon `/dp/<ISBN-10>` (979-ISBNs ohne ISBN-10: Buchsuche `i=stripbooks`), Blackwell's und Bookshop mit Partner-ID als Produktseite, alle anderen als ISBN-Suche beim Händler. `BuyLink.kind` sagt ohne Anfrage, ob ein Link auf **eine Buchseite** (`product`) oder eine **Trefferliste** (`search`) führt; Suchen tragen ein kleines „search“.
- **Finden (auch ohne ISBN, immer da):** AbeBooks und eBay nach Titel, Autor, Verlag und Jahr auf der Markt-Domain; Google Lens und TinEye mit dem Cover-Bild; WorldCat; die Open-Library-Ausgabenseite als Nachweis.

**Die Reihenfolge der Händler richtet sich nach der Registrierungsgruppe der ISBN** (`registrationArea` in `lib/normalize.ts`, `linkPlan` in `lib/linkplan.ts`; seit 2026-09-09, ROADMAP 1.11). Gemessen am 2026-09-08 über 567 Ausgaben der fünf Fixture-Werke: von den 243 Ausgaben mit Cover tragen **44 % eine ISBN aus weder dem englischen noch dem deutschen Sprachraum** — Türkei 47, Spanien 18, Italien 14, Indien 9, langer Schwanz. Voreingestellt ist US, also zeigte die Spalte bei rund drei Vierteln der Cover fünf Knöpfe zu einer Nummer, die in Istanbul vergeben wurde. Vier Fälle:

| Fall | Wann | Vorn | Was der Satz sagt |
|---|---|---|---|
| `home` | Gruppe passt zum Markt (US/UK 978-0/1, DE 978-3) | Bookshop.org und Amazon, bzw. Thalia und Amazon | nichts; es gibt keine Ordnung zu erklären |
| `foreign` | Gruppe passt nicht — **die Mehrheit** | AbeBooks und eBay (DE: Booklooker), als **Titel**-Suche mit Verlag und Jahr, weil antiquarische Angebote oft keine ISBN tragen | „This printing's ISBN was registered in Turkey. Marketplaces that list copies from anywhere come first; no shop was asked." |
| `kdp` | 979-8, Amazons eigener Bereich (182 von 526 ISBNs, davon 181 ohne Cover) | Amazon | nennt den Bereich und, falls zutreffend, dass es keine ISBN-10 gibt |
| `no-isbn` | keine ISBN (7 %) | Titelsuchen | „no ISBN on record, so no shop can look it up by number" |

**Drei Regeln, die dabei nicht verhandelbar sind:**
1. **Nie eine Behauptung über einen Händler.** Die Registrierungsgruppe ist eine Tatsache über die Nummer und begründet eine Reihenfolge. Sie sagt nicht, dass ein Laden das Buch nicht hat — kein Laden wird gefragt (F2.9, §9.2).
2. **Ein Label steht genau einmal.** „AbeBooks" und „eBay" standen zweimal in derselben Spalte, wenige Zeilen auseinander, einmal als ISBN-Link und einmal als Suchlink, ohne sichtbaren Unterschied. Ein Test hält es fest.
3. **`kind: 'product'` wird außerhalb von `home` zurückgenommen.** Es hieß nur „diese URL hat die Form einer Produktseite" und wurde als Versprechen gerendert; für eine Nummer, die der Laden nie geführt hat, ist das dieselbe Sorte Behauptung eine Ebene tiefer.

**„Or read it in another edition"** erscheint **nur**, wenn kein provisionsfähiger Link auf genau diese Ausgabe möglich ist — also bei `foreign` und `no-isbn` (Julian, 2026-09-09: „wenn es aber die Möglichkeit gibt, einen Affiliate-Link zu setzen zu genau dieser Edition, sollte das Vorrang haben"). Die Zeile sucht die Läden des Marktes nach dem **Werk**titel (`titleSearchLinksFor`; 56 % der Ausgabentitel sind Übersetzungen, „Die Enden der Parabel" bei Bookshop US ist wieder eine Null) und sagt dazu, dass sie zu einem anderen Druck führt. Die Links entstehen serverseitig, damit ein Affiliate-Parameter gesetzt werden kann; nur Händler, deren ISBN-Endpunkt schon Freitext nimmt, sind dabei — für Blackwell's und Booklooker ist kein Titelpfad bestätigt (ROADMAP 1.8).

**Die Ausgaben unter einem gefalteten Cover** sind nach drei Kriterien sortiert (`orderEditionsForMarket`), in dieser Reihenfolge (Julian, 2026-09-09: „die version die das gleiche aktuelle cover hat wie die isbn sollte zuerst vorgeschlagen werden, nicht nach jahr sortiert"):

1. **Wer den gezeigten Scan tatsächlich trägt**, gemessen an der Cover-Liste **vor** dem Falten. Das Falten hängt die Ausgaben der Mitglieder an den Vertreter, danach nennt eine Kachel also Drucke, die dieses Bild nie hatten. Wechselt der Leser über „The same cover, N scans" den Scan, wandert der zugehörige Druck nach vorn.
2. **Das Verdikt**, für Drucke, die Kriterium 1 nicht trennt.
3. **Der Markt**: ISBN aus dem eigenen Sprachraum, dann irgendeine ISBN, dann das jüngste Jahr.

**Warum Kriterium 1 nötig war und das Verdikt allein nicht reicht** (gemessen 2026-09-09 an *Beloved*): die gefaltete Kachel trägt Vintage International 2025 und 2004, und **beide Datensätze führen dieselbe ISBN** 9781400033416 — das Verdikt ist für beide gleich, und das Jahr stellte 2025 voran. Vorher war es die reine Ankunftsreihenfolge von Open Library, also das Alter des Datensatzes.

Dass das Verdikt den Markt schlägt, ist Absicht: der Leser hat ein **Bild** angeklickt, und der Druck, der es heute trägt, ist die ehrliche Voreinstellung, auch wenn er schwerer zu kaufen ist — die Händlerreihenfolge passt sich dann an (Fall `foreign`). `pending` und `unavailable` bewegen nichts, sonst spränge die Reihe auf eine Antwort, die noch gar nicht da ist.

**Affiliate-Parameter** kommen aus Umgebungsvariablen pro Markt (`AFFILIATE_AMAZON_TAG_US|UK|DE`, `AFFILIATE_BOOKSHOP_ID_US|UK`); ohne Variable entsteht der neutrale Link. Nur Amazon und Bookshop.org haben überhaupt einen Provisionsparameter; die übrigen neun Links sind Servicelinks. Die Reihenfolge der Händler ist **nicht** nach Provision sortiert — sie folgt der ISBN, siehe oben —, und die About-Seite sagt beides. **Im Hobby-Modus (E20) werden die Variablen ignoriert, auch wenn sie gesetzt sind**: die öffentliche Seite verspricht, dass kein Link etwas einbringt, und ein Test belegt es für jeden Markt; die Links tragen dann auch kein `rel="sponsored"`.

**Ein Kauf-Link führt zur ISBN, nicht zum Cover** (2.3). Die Seite sagt deshalb pro ausgewähltem Cover, ob das Bild, das der Verlag zu dieser ISBN hinterlegt hat, dieses Cover ist (F2.9). Kauf-Links laufen über `/go/<provider>/<isbn>` (F5); die Such-Links bleiben direkt.

**Werbung** neben den Kauf-Links regelt E19: höchstens ein Platz je Seite, automatisch von einem Netzwerk gefüllt, ohne Kennung des Lesers, nie in Wand, Ergebnis oder Händlerliste. Heute gibt es keinen.

### 2.5 Der gebaute Cover-Index (Entscheidung E18)

`data/cover-index.json` hält für jedes Cover einer festen Werkliste dessen **abgeleitete Zahlen** — dHash, Kontrast, Helligkeit, Sättigung, Farbhistogramm — und die Zuordnung zu Werk und Titel. **Kein Bild wird gespeichert**, nur Messwerte; das ist der Unterschied zwischen einem Index und einem Archiv.

- Er wird **vor dem Deploy von einem Skript erzeugt** (`scripts/build-cover-index.ts`) und mitcommittet, ist also keine Infrastruktur im Sinne von E6, sondern eine Datei (E18).
- Er ist **nur lesbar und serverseitig**. `lib/coverindex.ts` liest ihn einmal beim Modulstart in typisierte Arrays; eine Ähnlichkeitssuche ist danach ein linearer Durchlauf über wenige tausend XOR-Operationen. **Nie aus Client-Code importieren** — die Datei ginge vollständig an den Browser.
- **Er darf auf 10 MB wachsen, nicht weiter** (Julian, 2026-09-09). Gemessen am selben Tag: **6,4 KB je Werk** (890 KB bei 139 Werken), die Grenze liegt also bei rund **1.600 Werken**. Ein Test bricht, wenn die Datei sie überschreitet — das ist kein Defekt, sondern der Zeitpunkt, an dem zwischen Aufteilen, anderem Format und einem echten Speicher zu entscheiden ist (ROADMAP 5.1). Bis dahin ist die Liste, auf die die Seite zeigt, **dieselbe Datei wie die Indexliste** (`lib/published.ts`): ein Werk ohne Signaturen rendert eine Jahrzehnte-Seite, die nichts faltet.
- Er ist eine **Momentaufnahme** und veraltet, sobald ein Katalog sich ändert. Das ist tragbar, weil er nichts trägt, was stimmen muss: er beantwortet „was sieht ähnlich aus", nie „welche Ausgabe kaufe ich". `builtAt` steht in der Datei.
- Welche Werke er kennt, steht in `data/index-works.json` (**100**, Stand 2026-09-08; erster Zuschnitt der Liste aus ROADMAP 5.1). Umfang heute: 10.362 Cover, 757 KB.

---

## 3. Funktionale Anforderungen

### F1 – Suche

- **F1.1** Freitext. Der Text geht **nur** an Open Library (`lib/search.ts`, genau ein externer Aufruf). Autorennamen im Query werden nicht gesondert geparst (E3).
- **F1.2** Sprachfilter `all | en | de | fr | es | it | …`, Default `all` (E2). Der Filter wirkt auf die Ausgaben, nicht auf die Works: ein Work erscheint, wenn es mindestens eine Ausgabe in der Sprache hat.
- **F1.3** Ergebnis: Works nach Relevanz. Pro Work Titel, Autor(en), Erstveröffentlichung, Ausgabenzahl, das Cover aus der Suche; das **Mosaik** lädt jede Karte selbst nach (`/api/works/[id]?summary=1`, bis zu vier Cover verschiedener Ausgaben aus Seite 0, acht Anfragen gleichzeitig, ein Tag Cache, **keine Google-Anfrage**). Das Mosaik ist sprachneutral (E15).
- **F1.4** Relevanz (`relevance` mit `rankContext`, `lib/works.ts`): Ausgangspunkt `100 − 5 · sourceRank`, denn Open Library reiht bei allen geprüften Queries richtig. Dazu bis zu 40 Punkte Popularität, **relativ zum meistgelesenen Werk desselben Ergebnisses**; Titeltreffer nur 20/10/5. Relevanz ist relational; ohne Kontext ist die Funktion nur für ein einzelnes Werk sinnvoll. Ein „exakter Titel gewinnt“-Bonus darf nie zurückkehren (§7).

  **Ableitungen verlieren 60 Punkte**, erkannt an vier Regeln (`derivativeIds`, `looksLikeSecondaryLiterature`):

  | Regel | Woran | Beispiel |
  |---|---|---|
  | Selbstauskunft im Titel | `MARKED_DERIVATIVE`: „(adaptation)“, „graphic novel“, „stage“, „retold by“, **„in N acts“, „a play“, „an opera“** | *Alice in Wonderland in Five Acts*, eine Ausgabe, stand vor Carrolls 3.547 |
  | Sekundärliteratur | `SECONDARY_LITERATURE` (Study Guide, Companion, Trivia, …), dazu ein Titel, der **auf „notes“ endet** | *Crime and Punishment Notes* (Cliffs Notes, 8 Ausgaben) |
  | Zweitautor ist Erstautor eines viel größeren Werks | `DERIVATIVE_EDITION_RATIO` = 10, verglichen über **Namen und Open-Library-Autorenschlüssel** | Der Übersetzer-Datensatz von *Crime and Punishment* führt Dostojewski als zweiten Autor unter demselben Schlüssel `OL22242A`, aber in anderer Transkription |
  | Trägt den Titel eines viel größeren Werks | `SAME_TITLE_EDITION_RATIO` = 30, **nur bei anderem Erstautor** | *The Great Gatsby* von Stephen Matterson, 3 Ausgaben gegen 1.199 |

  **Die beiden Schutzregeln sind so wichtig wie die Regeln selbst.** Der Erstautor muss verschieden sein, sonst fiele Kafkas deutsche *Verwandlung* (9 Ausgaben) unter die englische *Metamorphosis* (955) und Bulgakows russischer Datensatz unter seine Übersetzungen. Und das Ausgabenverhältnis muss die Schwelle reißen, sonst fiele ein Buch, das nur zufällig denselben Titel trägt: Lars Myttings *Norwegian Wood* liegt bei einem Zwölftel von Murakami, Randall Kennedys *Sellout* bei einem Sechzehntel. Die Schwelle 30 ist **abgelesen und nicht gewählt** (§7).

  Die Regel irrt bewusst in eine Richtung: ein unbekanntes Buch mit berühmtem Titel verliert Plätze an das berühmte. Das kostet eine Position und verbirgt nichts (E16), und wer den berühmten Titel eingetippt hat, wollte genau diese Reihenfolge.

  **Offene Lücke:** die Ableitungsregel greift nicht, wenn eine Ableitung denselben Titel trägt und einen **eigenen Erstautor** hat. Gemessen am 2026-09-07: `alice in wonderland` liefert „Alice in Wonderland in Five Acts“ (eine Ausgabe, Bühnenfassung) vor Carrolls Original mit 3.547; bei `the great gatsby` sind elf von fünfzehn Karten Bücher *über* Gatsby, auf Platz 2 eine Penguin-Critical-Study. Der Vergleich, der das entscheidet — gleicher normalisierter Titel, anderer Erstautor, ein Bruchteil der Ausgaben — liegt im `RankContext` bereits vor. Siehe [ROADMAP](ROADMAP.md) 6.1.
- **F1.5** URL-Zustand `/?q=…&lang=…`; Back-Button und Teilen funktionieren.
- **F1.6** Kürzlich gesucht (localStorage, max. 5) und eine kuratierte Cover-Wand aus zwölf Werken als leerer Zustand (`lib/curated.ts`). Die zwölf sind **nach Aussehen von Hand gewählt**, nicht nach einer Regel, und ausdrücklich nicht die Liste aus ROADMAP 5.1, die nach Ausgabenzahl entsteht. Die Auswahl darf ungleich sein — seit dem 2026-09-07 steht ein Werk mit zwei Covern neben Werken mit hunderten. Über der Wand steht **keine Beschreibung der Auswahl mehr** (Julian, 2026-09-09): die Zeile „18 books, one cover each, picked by eye“ ist entfernt. Kommt wieder eine hin, darf sie **keine Coverzahl versprechen** (N12) — sie sagt, was die Auswahl ist, nicht wie viel dahinter liegt.
- **F1.6a Das Warten zeigt ein Mosaik** (ROADMAP 6.19a, seit 2026-09-09). Während die Suche läuft — 1 bis 13 s — und während die Jahrzehnte-Seite gebaut wird (4,5 bis 12,9 s, seit 2026-09-10), baut sich das Gesicht eines Autors aus den Covern seiner eigenen Bücher auf: eine Wand in falscher Reihenfolge, gedimmt, deren Kacheln in zufälliger Ordnung an ihren Platz finden, während sich die Dämpfung hebt. **Genau eine vorgerechnete JPEG-Datei** aus `public/loading` (83–102 KB auf dem Telefon, 124–159 KB am Rechner) und ein Manifest von 2,3 KB; **kein Cover wird einzeln geladen**, und keine der zwanzig Vorlagen kostet eine Anfrage an eine fremde Quelle. Die Vorlage wird **bei jedem Anzeigen neu gewürfelt** (seit 2026-09-10; die zuletzt gezeigte ist ausgeschlossen, damit der Wechsel sichtbar ist), die Datei beim **ersten Tastendruck** geholt, und das Feld bekommt seine Höhe aus dem Manifest, bevor das Bild da ist. `prefers-reduced-motion` bekommt das fertige Bild **ohne Aufbau**, dessen Deckkraft langsam zwischen 0,7 und 1 atmet, damit es nicht wie eine fertige Seite aussieht. **Solange das Bild fehlt oder nicht kommt, steht dort die Cover-Wand von vorher** (`AssemblingWall`) — ein fehlendes Bild ist kein leeres Feld. Gezeigt wird das Mosaik bei der Suche, vor der Jahrzehnte-Seite und auf einer Werkseite, zu der keine Vorschau vorliegt (Aufruf von außen, Rückweg von der Jahrzehnte-Seite); wo eine Karte ein Cover mitgegeben hat, bleibt es beim Cover-Fächer aus F2.12. **Wonach gesucht wird, steht über dem Bild** — als Überschrift in der Display-Schrift, nicht als Auflage auf dem Mosaik: eine Zeile auf dem Bild braucht einen eigenen Grund und liest sich dann wie ein aufgeklebtes Etikett. Wer auf dem Bild zu sehen ist und aus wie vielen Covern es besteht, steht klein darunter, damit es niemand für ein Suchergebnis hält (N12).
- **F1.7** Zustände: leer, lädt, Fehler, keine Treffer. **Ein Ausfall der Quelle ist kein leeres Ergebnis.** Antwortet Open Library nicht oder läuft in den Timeout, zeigt die Seite „The catalogue did not answer“ mit einem Knopf zum erneuten Versuch — nie „No books found“ — und die Antwort wird nicht gecacht. Der Leerzustand nennt den Sprachfilter nur, wenn einer gesetzt ist. Eine Suche unter `MIN_QUERY_LENGTH` (drei Zeichen) wird gar nicht erst gestellt, weil Open Library sie mit 422 ablehnt; sie ergibt 400 und einen eigenen Satz, keine Fehlanzeige. *Erledigt 2026-09-07, siehe [Historie](docs/history.md).*

**Akzeptanzkriterien** (`lib/__tests__/acceptance.test.ts`, gegen aufgezeichnete Fixtures; im Browser vor jedem abgeschlossenen Schritt):

| Query | Erwartung |
|---|---|
| `mumbo jumbo` | *Mumbo Jumbo* von Ishmael Reed zuerst; gleichnamige Werke anderer Autoren als eigene Works |
| `1984` | *Nineteen Eighty-Four* (OL1168083W) zuerst; Adaptionen, Bühnenfassung und Study Guides dahinter; Übersetzungen in derselben Karte |
| `gravity's rainbow` | Pynchons Roman vor allen Companions und Guides |
| `the great gatsby` | Genau ein Fitzgerald-Work, zuerst |
| `pride and prejudice` | Genau ein Austen-Work, zuerst; Adaptionen getrennt |

### F2 – Detailseite `/book/[workId]`

- **F2.1** Die Route nimmt eine Work-ID.
- **F2.1a** Eine unbekannte, aber wohlgeformte Work-ID antwortet mit **404**, nicht mit 200 und einer leeren Seite. Ein Soft-404 wird sonst indexiert (F2.13). *Heute 200, siehe [Durchklick](docs/tests/2026-09-07-durchklick.md) Punkt 4.*
- **F2.2 Seitenweises Laden.** Open Library liefert Ausgaben in Hundertern, nach Anlagedatum des Datensatzes absteigend; eine Seite zeigt also nur die zuletzt katalogisierten Drucke, und Seite 0 ist ein Sprachengemisch. `GET /api/works/[id]?offset=<0|100|…>&signatures=<0|1>` liefert **eine Seite** (`getWorkPage`, `lib/work.ts`); der Browser (`useWorkPages`) lädt Seite 0, zeigt die Wand und holt die Folgeseiten nacheinander nach, bis `page.nextOffset` fehlt oder 1.500 Datensätze erreicht sind (`MAX_EDITIONS_SCANNED`). Google Books läuft nur auf Seite 0 (F3.2). Seite 0 wird zweimal geholt: ungehasht für den sofortigen Start, dann gehasht. Ein Fehler auf einer Folgeseite wird einmal wiederholt und beendet sonst das Nachladen, ohne die Wand zu leeren. Die Antwort meldet den Offset, den sie **tatsächlich geliefert** hat; ein Offset jenseits der Kappung ergibt eine leere Seite, nicht stillschweigend die letzte. *Heute liefert `?offset=1500` die Seite 1400 und meldet 1400 (Durchklick, Punkt 6).*
- **F2.3 Zähler statt Versprechen.** Während des Ladens „N covers · M of K editions checked“, danach „N covers from K editions“, bei Kappung „first 1,500 of K editions checked“, bei Abbruch „…, the source stopped answering“. Ein 1-px-Balken zeigt den Fortschritt. Darunter der Hinweis, dass die meisten Datensätze keinen Scan tragen.
- **F2.4 Sprach-Tabs.** Cover gruppiert nach Sprache der Ausgaben, die sie tragen. Reihenfolge: die im Suchfilter gewählte Sprache zuerst, dann Englisch, dann Deutsch (`LEAD_LANGUAGES`), dann nach Häufigkeit, „Unknown“ zuletzt. Die Ladeszene wartet, bis die gewünschte Sprache (sonst Englisch) da ist, längstens bis 300 Ausgaben geprüft sind, damit die vorderen Reiter nicht unter dem Mauszeiger nachrücken. Unterhalb von `sm` stehen die Reiter in einer seitlich scrollbaren Zeile.
- **F2.5** Innerhalb eines Tabs Jahr absteigend, unbekanntes Jahr dahinter, Bilder, die nach Textseite aussehen, ganz hinten (2.3).
- **F2.6 Auswahl.** Klick auf ein Cover zeigt es groß mit der Ausgabe, die es trägt: eine Kopfzeile `Verlag · Jahr · Sprache`, die ISBN, und die zwei bis drei Läden, die für diese Nummer überhaupt eine Chance haben (2.4). **Alles Übrige steht hinter einer zugeklappten Zeile** „Other ways to find it (N)": die restlichen Händler- und Suchlinks, der Vorschau-Link, der Verfügbarkeits-Button (F2.10), Format, Seitenzahl, Erscheinungsdatum, „also printed with 1 other cover" und der Klappentext. **Trägt ein gefaltetes Cover mehrere Ausgaben, ist genau eine offen** und die übrigen sind je ein Chip `Verlag · Jahr`; vorher wiederholte sich der ganze Apparat je Ausgabe. Gemessen am 2026-09-09 bei 1440 × 900: der Inhalt der Spalte fiel bei *Beloved* von **2.351 auf 851 px** und bei *Wolf Hall* von **1.256 auf 766 px**, die sichtbaren Bedienelemente von **14 auf 5**, und der erste Kauf-Knopf steht im Fenster statt 437 bzw. 151 px darunter (ROADMAP 1.2/1.11). Dazu ist das Cover in der Seitenleiste an der Fensterhöhe gedeckelt (31vh Breite): in einer 400 px breiten Spalte war es 600 px hoch und schob die Läden allein aus dem Bild. **Beim Öffnen ist nichts ausgewählt** (seit 2026-09-09, ROADMAP 1.1): kein Rückfall auf das erste Cover, weil die Wand nach Datensatzalter sortiert ist und das erste Cover damit die jüngste Erfassung wäre — bei *The Great Gatsby* eine Print-on-Demand-Ausgabe von 2026, auf die dann die Kauf-Links zeigten. `coverForId` (lib/pages.ts) liefert ohne `?cover=` `null`; wird die Spalte je wieder leer wirken, gehört dorthin etwas über das Werk, **nie** ein ausgewähltes Cover.
- **F2.6a Die zweite Spalte ohne Auswahl: das Werk.** Solange nichts gewählt ist, zeigt die Seitenleiste auf breiten Bildschirmen `WorkPanel` statt einer Ausgabe — der einzige Ort der Seite, der vom **Buch** spricht statt von einer Ausgabe. Inhalt, alles aus geladenen Ausgaben gezählt, ohne eine einzige Anfrage: eine Zeile mit Jahresspanne und Zahl der Verlage (`editionSpan`, erst wenn mehr als eine Seite geladen ist, sonst behauptet sie eine Spanne und korrigiert sich); der Klappentext mit Nennung der Ausgabe, aus der er stammt; die Einladung, ein Cover zu wählen; ein Link auf den Open-Library-Datensatz mit dem Hinweis, dass er dort korrigiert werden kann. Der Klappentext ist **Verlagswerbung für eine Ausgabe**, nie eine Beschreibung des Werks, deshalb wird er zugeschrieben. `blurbFor` (lib/works.ts) wählt ihn nach Sprache vor Länge: bei *Wolf Hall* ist der längste von 26 Ausgaben portugiesisch. Weicht die Sprache von der gesuchten ab, wird sie genannt.
- **F2.7** Ausgewähltes Cover in der URL (`?cover=…`), Suche und Sprache bleiben erhalten (`?q=&lang=`); der Zurück-Link führt zur Suche mit Query. In der URL steht **nur eine Auswahl des Lesers**, und seit F2.6 gibt es keine andere mehr: ein geteilter Link zeigt dem Empfänger dieselbe Ausgabe wie dem Absender, und ein Link ohne `?cover=` zeigt beiden die Wand. Nennt die Adresse ein inzwischen gefaltetes Duplikat, landet die Auswahl auf dem Cover, in das es gefaltet wurde.
- **F2.8 ISBN-Nachschau erst bei Auswahl.** `GET /api/isbn/<isbn13>?signatures=1` (`lib/isbn.ts`) liefert das Bild, das der Verlag bei Google zu dieser ISBN hinterlegt hat. Gefragt wird **nur** für ein ausgewähltes Cover (`useIsbnCovers`), nie beim Laden. Das Bild geht vor dem Falten in die Wand, damit es in den Katalog-Scan hineinfaltet, wenn es dasselbe Design ist. Trägt ein gefaltetes Cover mehrere ISBNs, werden alle gefragt — **eine Auswahl kostet also so viele Anfragen, wie das Cover ISBNs trägt, nicht eine** (gemessen am 2026-09-07: ein Klick auf ein Cover mit vier Ausgaben löste fünf Anfragen aus, ein anderer zwei). Je besser die Faltung, desto teurer der Klick; N9 rechnet das ein.
- **F2.9 Verdikt an den Kauf-Links** (`verifyIsbnCover`, `lib/works.ts`). Kein zweiter Schwellenwert: das Urteil benutzt die Faltung der Wand selbst, damit Seitenleiste und Wand sich nie widersprechen.

  **Das Verdikt bestimmt die erste Reihe** (`linkPlan`, seit 2026-09-09): bei `differs` besteht sie aus **AbeBooks, eBay und Google Lens** — Suchen nach Titel, Autor, Verlag und Jahr, plus Bildsuche —, die Händler rücken hinter die Klappe, die Überschrift heißt „Find the cover you picked", und der Verdikt-Hinweis steht **über** der Reihe, weil er ihr Grund ist. Ein ISBN-Link kann dort nicht führen: was er öffnet, liefert nachweislich das andere Bild (Julian, 2026-09-09: „nur zig buttons wo immer ein anderes cover dahinter liegt"). Bei `unknown` hängt sich die antiquarische Suche hinten an die Reihe — **nur die Reihenfolge, kein Satz**: „unknown" heißt weiterhin nicht „nicht zu kaufen", und die Wortlaute in `lib/verdicts.ts` bleiben unangetastet.

  | Zustand | Text | Verhalten |
  |---|---|---|
  | `verified` | „The publisher's current image for this ISBN is this cover.“ | Kauf-Links zuerst |
  | `differs` | „… is a different cover.“ mit dem Bild daneben, verlinkt auf dessen Kachel | **Die Suchen übernehmen die erste Reihe ganz** |
  | `unknown` | „No current publisher image is on record for this ISBN.“ | Kauf-Links zuerst |
  | `pending` | eigener Satz: wird gerade geprüft | |
  | `unavailable` | eigener Satz: die Quelle hat nicht geantwortet | wird nicht als „kein Bild“ gemerkt, später erneut gefragt |

  **Der Text nennt die Quelle, weil die Prüfung nur so weit reicht:** kein Händler wird kontaktiert; verglichen wird mit dem Verlagsbild bei Google. Ein Verdikt darf nie mehr behaupten, als geprüft wurde; deshalb hat jeder Zustand seinen eigenen Satz.
- **F2.10 Verfügbarkeits-Button, nur im Shop-Modus** (`lib/availability.ts`, `GET /api/availability`, nur auf Klick, 6 h Cache; im Hobby-Modus antwortet die Route 404 und der Button existiert nicht, E20). Fragt jeden Händler des Marktes nach der ISBN **und** nach einer unmöglichen Kontroll-ISBN und vergleicht. Zustände: **found it / can't tell / won't answer / no answer**. `can't tell` heißt ausdrücklich nicht „hat es nicht“ (Hugendubel und genialokal rendern Treffer im Browser); keiner der Zustände ist eine Bestandsprüfung. **Nicht für den Betrieb freigegeben** (E12): vier von sechs Händlern verbieten den Pfad in ihrer robots.txt, Amazons Partnerbedingungen untersagen automatisierte Zugriffe. `scripts/check-buylinks.ts` macht dieselbe Messung von Hand.
- **F2.11 Telefon** (unter `lg`): eine **Peek-Leiste** am unteren Rand, sobald ein Cover gewählt ist (Miniatur, Verlag, Jahr, „Details“), darüber eine **Schublade** (`CoverSheet`, `role="dialog"`, Escape und Hintergrundklick schließen, Hintergrund scrollt nicht). Die Cover-Wand bleibt vertikal (E13). Seitenleiste und Schublade sind **exklusiv** gerendert (`useIsDesktop`), nicht per CSS versteckt, damit das Coverbild nicht doppelt geladen wird.
- **F2.12 Ladeszene.** Karten geben Titel, Autor und Cover per sessionStorage mit (`useWorkPreview`); die Seite zeigt sofort Titel und Hero-Cover, setzt die ersten eintreffenden Cover als Fächer in Szene (`LoadingStage`, bis zu vier) und lässt sie per FLIP auf ihre Kacheln fliegen (`flyCovers`, respektiert `prefers-reduced-motion`). Bei warmem Cache endet die Szene sofort.
- **F2.13 Auffindbar und teilbar.** `app/book/[id]/page.tsx` ist eine Server-Komponente mit `revalidate = 86400` und `generateStaticParams` über die kuratierten Werke; Titel „The covers of *Titel* by *Autor*“, Beschreibung mit der Ausgabenzahl der Quelle, Schema.org `Book` (`name`, `author`, `datePublished`, bis zu vier `image`, `sameAs` auf Open Library; **ohne** `aggregateRating` und `offers`), Open-Graph-Bild 1200×630 als Cover-Mosaik. Alles aus `lib/seo.ts`, kostet zwei gecachte Open-Library-Anfragen und **null** Google. Der sichtbare Text bleibt clientseitig.

  Das OG-Bild entscheidet darüber, ob ein geteilter Link geöffnet wird, und zeigt deshalb **vier erkennbar verschiedene Cover** nach der Regel aus F4. Vorher nahm es die ersten vier der Wand: bei *Wolf Hall* war zweimal dieselbe spanische Ausgabe darunter.

- **F2.14 „Looks like this".** **Direkt unter dem gewählten Cover** stehen bis zu drei Cover **anderer** Bücher, deren Umschläge dem gewählten in Farbe und Aufbau nahekommen (`/api/similar/<coverId>`, Daten aus dem gebauten Index, §2.5). Je Buch höchstens ein Cover; das eigene Werk bleibt draußen, dessen Wand ist einen Klick entfernt. **Kennt der Index ein Cover nicht, erscheint der Abschnitt gar nicht** — er deckt 100 Werke ab, nicht den Katalog, und Schweigen ist die ehrliche Form von „nicht indiziert". Die Reihe ist bewusst klein und ohne erklärenden Absatz: sie erscheint bei etwa jedem sechsten Cover und schiebt dann die Kauf-Links nach unten, die ohnehin zu weit unten stehen (ROADMAP 1.2). Ausführlich erklärt sie die About-Seite, die auch nennt, wann der Index gebaut wurde.

  **Drei feste Spalten, und das Bild in `-M`** (seit 2026-09-09, ROADMAP 6.10a). Vorher bekam jede Kachel `flex-1`: bei drei Treffern ein Drittel, bei **einem** die ganze Spalte — rund 370 px bei 1440 —, gefüllt mit Open Librarys `-S`-Miniatur von etwa 45 px. Auf einer Seite über das Aussehen von Covern ist ein verwaschenes Bild kein Schönheitsfehler. `CoverImage` läuft mit `unoptimized`, `sizes` ändert die geladene Datei also nicht; die Größe muss in der URL stehen.

### F3 – Datenquellen

- **F3.1 Open Library** (primär): Suche `/search.json` (mit den Popularitätsfeldern), Work `/works/{id}.json`, Ausgaben `/works/{id}/editions.json?offset=&limit=100`, Cover `covers.openlibrary.org/b/id/{id}-{S|M|L}.jpg`.
  - Der Editions-Endpoint liefert Autoren **nur als Keys**, keine Namen. Autorennamen für Ausgaben kommen vom Work.
  - `author_name` im Suchergebnis enthält Duplikate und Übersetzer; nur der erste Eintrag ist der Erstautor. Dieselbe Person kann mehrere Keys haben.
  - Ausgaben kommen nach Datensatzalter, nicht nach Erscheinungsjahr (F2.2).
- **F3.2 Google Books** (sekundär, nur ergänzend). Hat keinen Work-Begriff und **erzeugt nie eigene Works** (E5): Treffer werden per normalisiertem Titel + Erstautor einem Open-Library-Work zugeordnet, der Rest verworfen. **Google wird an genau zwei Stellen gefragt** (E10):
  1. `searchEditionCandidates` auf **Seite 0** einer Detailseite: zusätzliche Cover, Beschreibungen, Vorschau-Links. Abschaltbar über `WorkPageOptions.googleBooks`; Mosaike und Metadaten schalten es ab.
  2. `lookupIsbnOrThrow` beim **Auswählen eines Covers** (F2.8): das Verlagsbild zur ISBN, die Grundlage des Verdikts.
  - Bild-URLs nur mit `zoom=1` und `&fife=w800`; `zoom=2` und höher ist eine Seite aus dem Buch-Scan, nicht das Cover.
  - Google antwortet häufig mit transienten 503; die ISBN-Nachschau wiederholt einmal und meldet sonst `unavailable`, nie „kein Cover“.
  - **Kontingent** (N9): eigener Schlüssel `GOOGLE_BOOKS_API_KEY`, 1.000 Anfragen pro Tag. Ohne Schlüssel läuft die Seite auf Open Library allein.
- **F3.3 Ausfallsicherheit.** Jede Quelle fällt unabhängig aus: ein Fehler bei Google führt zu Teilergebnissen, nie zu einem Seitenfehler. Timeouts (`OL_TIMEOUTS`, `GB_TIMEOUT_MS`): Suche **12 s**, Work 5 s, Editions 12 s, Google 5 s. Seite 0 wird bei Fehler einmal wiederholt; der zweite Versuch trifft den Cache. Die Detailseite unterscheidet „nicht gefunden“ (404) von „nicht erreichbar“ (503).

  **Die Suche trifft dieselbe Unterscheidung.** `searchWorks` wirft `SourceUnavailableError`, wenn Open Library schweigt, einen Fehlerstatus liefert oder mit einem Rumpf ohne `docs` antwortet; eine leere Liste bedeutet ausschließlich, dass Open Library geantwortet hat und nichts hatte. Die Route macht daraus 503 ohne Cache-Header, und nur die 200 trägt `s-maxage`. Vorher verschluckte der Client jeden Fehler, die Route antwortete 200 mit leerer Liste, und der Leser las „No books found“ für ein Buch mit hunderten Ausgaben.

  **Eine gescheiterte Suche wird einmal wiederholt** (`SEARCH_RETRY` in `lib/sources/openlibrary.ts`). Wiederholt wird nur **Schweigen**: Timeout, Netzfehler, ein Rumpf, der sich nicht lesen ließ, und 5xx. Ein **4xx wird nie wiederholt** — es ist eine Antwort über genau diese Anfrage, und ein zweiter Versuch wiederholte den Fehler (422 unter drei Zeichen, 429 aus dem Rate-Limit). Beide Versuche zusammen sind auf 20 s gedeckelt, der Deckel je Versuch wird auf den Rest gekürzt, und unterhalb von 5 s Rest unterbleibt der zweite Versuch: er brächte dann meist nur einen weiteren Timeout und eine längere Wartezeit. Der Leser drückt diesen Knopf ohnehin — F1.7 gibt ihm „Try again" —, also drückt ihn der Server einmal selbst.

  **Der Deckel liegt bei 12 s, nicht bei 8.** Gemessen am 2026-09-07 über zwölf kalte Suchen direkt bei Open Library, ohne Deckel: sieben antworteten unter 8 s, **drei zwischen 9 und 10 s**, eine nach 24 s, eine gar nicht. Acht Sekunden machten also aus einem Drittel der langsamen, aber gültigen Antworten einen Fehler. Der Preis ist eine längere Wartezeit im schlechten Fall; das Skelett steht so lange auf dem Schirm, und die Wartezeit endet jetzt in einer Auskunft statt in einer falschen.
- **F3.4** Hörbücher, Zeitschriften, Proceedings werden herausgefiltert.

### F4 – Cover-Mosaik

- 1 Cover: voll. 2: nebeneinander. 3: eines groß links, zwei rechts. ≥ 4: 2×2.
- **Keine Kachel schneidet mehr weg, als ihr Seitenverhältnis verlangt.** Ein Cover ist 2:3. Eine Kachel, die deutlich schmaler ist, zeigt nur einen Streifen: bei zwei Covern nebeneinander in einem 2:3-Rahmen sind die Kacheln 1:3, und `object-fit: cover` zeigt dann etwa die halbe Breite jedes Bildes. Die hohen Kacheln — die beiden Hälften des Zwei-Cover-Mosaiks und die linke Spalte des Drei-Cover-Mosaiks — **passen das ganze Cover ein** statt es zu beschneiden; der Kartengrund zeigt sich darüber und darunter. Das Vier-Cover-Raster bleibt unverändert, seine Zellen sind bereits 2:3.
- **Eine Kachel je Druck.** Cover werden nach Verlag und Jahr der tragenden Ausgabe zusammengefasst, ersatzweise nach der Ausgabe selbst (`coverImages` in `lib/seo.ts`, dieselbe Auswahl für Karte und Teilbild). **Karte und Wand müssen dieselbe Zahl unterschiedlicher Gestaltungen zeigen** — heute tun sie es aus zwei Gründen nicht: die Karte entscheidet nach Metadaten und die Wand nach Bild, und schwerer wiegend fasst die Karte mehrere Werk-Datensätze zusammen, die die Wand nie lädt (§2.1, ROADMAP 6.13). Das Mosaik hasht nicht, kann also nur die Metadaten befragen. Das reicht nicht: nicht nur zwei Verlage mit einer lizenzierten Gestaltung stehen nebeneinander, sondern schon **ein** Verlag, der dieselbe Gestaltung in einem anderen Jahr neu auflegt (gemessen an *Ansichten eines Clowns*: dtv 1967 und dtv 1984, Bilddistanz 6, auf der Wand eine Kachel, auf der Karte zwei). Gemessen am 2026-09-07 über sechs Karten der Suche `pynchon`: bei zwei davon liegen zwei Kacheln bei Distanz 10 und 13, zeigen also dasselbe Motiv ([ROADMAP](ROADMAP.md) 6.7). Die Regel irrt bewusst in Richtung „lieber eine Wiederholung als eine leere Kachel": aussortierte Cover rücken nach, wenn sonst ein Platz frei bliebe.
- Fallback ohne Cover: Platzhalter; ein fehlgeschlagenes Bild zeigt nie Alt-Text in einem grauen Kasten (`CoverImage`).

### F5 – Klick-Zählung `/go/[provider]/[isbn]?market=`

Jeder Kauf-Link führt über diese Route, die den Klick festhält und weiterleitet. Das Ziel wird **serverseitig aus der Händlertabelle neu gebaut** und nie aus der Anfrage übernommen; die Route ist damit kein offener Redirect. Unbekannter Anbieter oder kaputte ISBN führen auf die Startseite. **Aufgezeichnet:** Anbieter, Markt, ISBN, Linkart, Zeit, als eine Zeile `bb.click {…}` in den Plattform-Logs (`lib/clicks.ts`). **Nicht aufgezeichnet:** IP, Cookie, User-Agent, Referrer, irgendeine Kennung des Lesers (E14). Die Such-Links laufen nicht darüber.

### F6 – Seiten und Rahmen

- **Startseite** `/`: Hero („Judge a book by its covers.“), Suchfeld, Sprache als Chips, kuratierte Wand; mit `?q=` die Trefferliste.
- **About** `/about`: was die Seite tut, woher die Bilder kommen, was fehlt und warum, was die Verdikte bedeuten (inklusive „kein Händler wird gefragt“), Kauf-Links und Provision, Klickzählung ohne Kennung. **Die About-Seite zitiert die Verdikte im Wortlaut, den die Oberfläche zeigt, und alle fünf Zustände aus F2.9.** Beide lesen dazu aus `lib/verdicts.ts`; von Hand geschrieben liefen sie auseinander, und die Seite erklärte noch „Shops show this cover“, als die Oberfläche das längst nicht mehr sagte — zwei Absätze über ihrem eigenen Satz „No shop is contacted for this“.
- **Fußzeile** (`SiteFooter`) unter jeder Seite: Quellen, Bildrechte, Links auf About, Impressum und Privacy; der Provisionshinweis nur im Shop-Modus (E20), weil er im Hobby-Modus falsch wäre (N12).
- **Impressum** `/contact` und **Datenschutzerklärung** `/privacy` (seit 2026-09-08, Grundlage [docs/recht-hobbyseite.md](docs/recht-hobbyseite.md)): Name, ladungsfähige Anschrift und E-Mail kommen aus `IMPRINT_*` in der Umgebung, nie aus dem Repository, und fehlen sie, bricht der Build statt eine leere Zeile auszuliefern (`lib/imprint.ts`). Die Datenschutzerklärung beschreibt genau, was der Code tut, je Modus, und nichts darüber hinaus.
- **Jahrzehnte-Seite** `/book/[workId]/decades` (ROADMAP 5.4a, seit 2026-09-09): dieselben Cover wie die Wand, gruppiert nach dem Jahrzehnt ihres frühesten Drucks, je Jahrzehnt eine **gezählte** Zeile (Verlage, Sprachen, Einbandangaben). Der Pfad ist **englisch**, wie alle Pfade der Seite (Julian, 2026-09-09: „nimm /decades“); die Roadmap sagte anfangs `/jahrzehnte`.
  - **Die Schwelle entscheidet, nicht die Lust zu veröffentlichen:** unter 20 Covern über 4 Jahrzehnte gibt es keine Seite, sondern einen 404 (`worthAPage` in `lib/decades.ts`). `data/decade-pages.json` hält fest, welche Werke tragen; nur die stehen in der Sitemap und nur bei ihnen zeigt die Werkseite den Link. **Seite, Skript und Sitemap müssen dieselbe Rechnung machen** — tun sie es nicht, zeigt die Sitemap auf einen 404, und der 404 ist hier eine Aussage über die Datenlage, kein Fehler.
  - **Sie faltet aus dem gebauten Index** (`indexSignatures`, E18), nicht durch Hashen im Request: ein Jahrzehnt stellt Drucke einer Epoche nebeneinander, wo zwei Scans desselben Umschlags direkt aneinandergeraten. Ein Cover, das der Index nicht kennt, behält seine Kachel — das ist eine Lücke, keine Behauptung von Einzigartigkeit (N12).
- **Ein echter 404** für eine wohlgeformte, aber unbekannte Work-ID (`app/not-found.tsx`; ROADMAP 1.7): nur ein sicheres „gibt es nicht“ wird zum 404, ein schweigender Katalog rendert die Seite und lässt den Client den Ausfall melden.
- `sitemap.xml` (Startseite, About, Impressum, Privacy, kuratierte Werke, und die Jahrzehnte-Seiten, die die Schwelle tragen) und `robots.txt` (`/api/` gesperrt, weil jeder Aufruf dort eine externe Anfrage kostet; `/go/` gesperrt, weil jeder Aufruf dort als Klick zählt).

---

## 4. Nicht-funktionale Anforderungen

- **N1 Server-seitig fetchen.** Externe APIs werden nur vom Server aufgerufen; der Browser spricht nur mit `/api/search`, `/api/works/[id]`, `/api/isbn/[isbn]`, `/api/availability`. Schlüssel bleiben auf dem Server.
- **N2 Kein Fan-out bei der Suche.** Eine Suche ist **ein** externer Aufruf. Die Mosaik-Nachladungen pro Karte sind gedeckelt (acht gleichzeitig), gecacht und kosten keine Google-Anfrage.
- **N3 Antwortzeit.** Suche im Normalfall unter 3 s; Open Library braucht aus Deutschland regelmäßig 2–7 s für eine Suche und 3–10 s pro Editions-Seite, deshalb Timeouts (F3.3) und Cache (N4). Eine kalte Detailseite zeigt die erste Wand nach etwa 8 s und ist bei zwölf Seiten nach rund 40 s vollständig; warm unter 5 s.
- **N4 Caching** über den Next-Datencache (`fetch` mit `revalidate`, E6), ohne eigene Infrastruktur:

  | Was | Dauer |
  |---|---|
  | Open-Library-Suche | 24 h (seit 2026-09-08; vorher 1 h) |
  | Work und Editions-Seite | 24 h |
  | Google-Titelsuche | 7 Tage (Buchmetadaten ändern sich nicht stündlich) |
  | Google-ISBN-Nachschau | 24 h (beantwortet „welches Bild zeigt der Verlag *heute*“, muss frisch sein) |
  | Cover-Bilder fürs Hashing | 30 Tage |
  | Verfügbarkeitsantwort / Kontrollantwort | 6 h / 24 h |
  | Detailseite (ISR) | 24 h |

  **Die Suche wurde am 2026-09-08 von 1 h auf 24 h gehoben** (ROADMAP 1.10), mit demselben Argument, das für Work, Editions und die Google-Titelsuche längst galt: die Trefferliste zu einem Titel ändert sich nicht stündlich. Der Preis ist, dass ein neu angelegtes Werk einen Tag später erscheint; der Gewinn ist, dass die Wiederholung aus F3.3 nur noch den ersten Leser einer Anfrage retten muss und nicht jeden Leser der nächsten Stunde. Der `s-maxage` der Route folgt dem Wert.

  Ein Deploy löscht den Cache; das ist bekannt und bis zu einem Auslöser hingenommen (ROADMAP, zurückgestellt).
- **N5 Kein Logging im Produktpfad**, nur über `DEBUG` (`lib/debug.ts`). Einzige bewusste Ausnahme: die Klickzeile aus `lib/clicks.ts` (F5).
- **N6 Typen.** `tsc --noEmit` ohne Fehler, kein `any` in `lib/`.
- **N7 Tests.** Unit-Tests für Normalisierung, Identität, Dedupe, Relevanz, Seiten-Merge, Rate-Limit, Kontingent-Automat, SEO-Texte; Integrations- und Akzeptanztests gegen aufgezeichnete Antworten in `lib/__fixtures__/` (`scripts/record-fixtures.ts`), nie gegen das Netz. Ein Test belegt, dass Seite 0 genau eine Google-Anfrage stellt, ein Mosaik keine und eine Suche keine.
- **N8 Bilder.** Cover laufen seit dem 2026-09-09 über die **eigene Route `/img/<S|M|L>/<ol-123|gb-abc>`** (ROADMAP 1.3), davor der CDN. Der Pfad trägt eine **Cover-ID, nie eine URL**: die Zieladresse wird mit `coverUrlFor` neu gebaut, genau wie `/go/[provider]/[isbn]` den Händler-Link aus der Tabelle baut — eine Bild-Weiterleitung, die eine URL aus der Anfrage nimmt, ist ein offener Proxy. `proxiedCoverSrc` schreibt nur Adressen um, die dieser Code selbst gebaut hat, und lässt alles andere direkt laufen; das ist die sichere Richtung.

  **Warum, gemessen aus Deutschland am 2026-09-09:** eine kalte Detailseite von *The Great Gatsby* will **151 verschiedene Bilder** (146 Open Library, 5 Google) zu je 12–29 KB — und ein einziges davon brauchte **5,9 bis 16,0 Sekunden**. `covers.openlibrary.org` leitet auf archive.org weiter, das unter Last langsam oder gar nicht liefert, und dokumentiert Rate-Limits für Cover. Mit der Route zahlt der erste Leser ein Cover einmal, alle weiteren bekommen es aus dem CDN (30 Tage `s-maxage`); nebenbei erreicht die IP des Lesers archive.org und Google nicht mehr, was zuvor 151-mal pro Seite geschah.

  **Nicht `next/image`-Optimierung**, die zweite Option des Punkts: 151 Quellbilder je Detailseite verbrauchten das Transformationskontingent des Hobby-Plans in wenigen Seitenaufrufen, und die Cover werden ohnehin schon in der Größe geholt, in der sie stehen. Die Route transformiert nichts, sie bewegt Bytes und lässt sie zwischenspeichern. Der Bild-Fallback in der UI bleibt.

  **Ein Fehlschlag wird nicht gecacht** (`no-store` auf 400 und 502): ein schweigendes archive.org ist eine Episode, keine Tatsache über das Cover — dieselbe Regel wie F1.7.
- **N9 Google-Kontingent: 1.000 Anfragen pro Tag** (abgelesen 2026-09-07), nicht erhöhbar per Selbstbedienung. Kosten bei kaltem Cache:

  | Vorgang | Google-Anfragen |
  |---|---|
  | Suche | 0 |
  | Suchkarten-Mosaik, Metadaten, OG-Bild | 0 |
  | Detailseite, Seite 0 | 1 (Titelsuche) |
  | Detailseite, geöffnet und nur angesehen | **0** zusätzlich (seit 2026-09-09, F2.6: ohne Auswahl keine Nachschau) |
  | Auswahl eines Covers | 1 **pro ISBN des gewählten Covers** (F2.8), gemessen 2 bis 5 |
  | jede weitere Seite | 0 |

  Eine kalt geöffnete Detailseite kostet damit **1** Anfrage statt bisher mindestens 2, also rund **1.000 statt 500** Seiten am Tag für den, der nur schaut (gemessen 2026-09-09, [Historie](docs/history.md)). Mit einer Auswahl kostet ein Seitenbesuch 3 bis 6 statt 2 — die Schätzung „500“ ist die Obergrenze für reines Stöbern, nicht für einen Besuch, der bis zu den Kauf-Links führt (gemessen im [Durchklick](docs/tests/2026-09-07-durchklick.md), Punkt 3). `lib/googlequota.ts` hört auf, Google zu fragen, sobald Google selbst `dailyLimitExceeded` oder `quotaExceeded` meldet, bis zur nächsten Zurücksetzung um Mitternacht **pazifischer** Zeit; bei `rateLimitExceeded` 90 s Pause; bei jedem anderen 403 **kein** Automat (E11). Kein Tageszähler: wegen des Datencaches weiß der Code nicht, welche Aufrufe das Haus verlassen haben. Derselbe Schlüssel bedient heute Entwicklung und Betrieb (ROADMAP). Läuft die Grenze doch voll, schreibt der Automat **eine ungeschützte Zeile** `bb.google` in das Log (Ereignis, Pausendauer, Ende der Pause), genau eine je Öffnung — vorher war das Ereignis in der Produktion unsichtbar, weil `DEBUG` dort nicht gesetzt ist. Eine Warnung *davor* kann die Seite aus demselben Grund nicht geben, aus dem es keinen Tageszähler gibt: die frühe Warnung muss auf Googles Seite zählen (ROADMAP 0.13).
- **N10 Rate-Limit** (`lib/ratelimit.ts`, `app/api/rate.ts`): Token-Bucket pro IP und Route, im Speicher, ohne Abhängigkeit. `search` 30/20 pro Minute, `works` 120/60, `isbn` 40/20, `availability` 6/3, dazu ein gemeinsamer Eimer `google` 20/5 für alle Anfragen, die ein Kontingent kosten können (Seite 0, ISBN-Nachschau; nie ein Mosaik). Antwort 429 mit `Retry-After`. **Es bremst den Stoß, nicht den Tag** (5 pro Minute sind 7.200 pro Tag) und zählt pro Instanz; es ist kein Sicherheitsmerkmal.
- **N11 Datensparsamkeit.** Die Seite speichert nichts über den Leser: kein Konto, keine Kennung, kein Tracking-Cookie. Im Browser liegen nur die letzten Suchen und die Marktwahl (localStorage, Cookie `market`), die Ladeszene-Vorschau in sessionStorage. Die Klickzählung (F5) und jede spätere Analyse arbeiten mit Aggregaten (E14).
- **N12 Ehrliche Texte.** Jede Aussage im UI folgt aus Daten, die gemessen wurden; wo die Seite etwas nicht weiß, steht das da. Konkret: nie „every / all / complete“ (§1), Verdikte nennen ihre Quelle (F2.9), `can't tell` heißt nicht „nicht vorrätig“ (F2.10), Zähler und umgebender Text widersprechen sich nicht (F2.3), ein Ausfall heißt nicht „nichts gefunden“ (F1.7, F3.3), und ein Hinweis nennt keine Einstellung, die nicht gesetzt ist. Tests in `lib/__tests__/seo.test.ts` weisen die drei Wörter zurück.

  **Zahlen aus den Quellen sind Zitate, keine Tatsachen.** Open Librarys `first_publish_year` gibt für *The Great Gatsby* 1920 an, erschienen ist er 1925. Die Zeile nennt deshalb ihre Quelle — „Open Library dates it to 1920“ statt „first published 1920“. Eine zweite Quelle gibt es hier nicht: die Wand lädt den jüngsten Datensatz zuerst, die älteste Ausgabe auf dem Schirm ist also nicht die älteste Ausgabe. Im JSON-LD bleibt der Wert als `datePublished` stehen, wie jedes andere Feld dort aus Open Library stammt und über `sameAs` an seiner Quelle nachprüfbar ist.

---

## 5. Gestaltung

Leitidee: **Galerie, nicht Shop.** Tokens in `app/globals.css` (Tailwind 4, `@theme inline`).

- **Farben:** warmes Papier (`#f4f0e8`) mit Off-Black-Tinte; Dark Mode als warmes Schwarz (`#131110`) mit heller Tinte, über `prefers-color-scheme`. Eine Akzentfarbe, Terrakotta (`#945138` hell, `#dbac94` dunkel). Kein Verlauf im Hintergrund.

  **Der Ton wurde am 2026-09-09 gedämpft** (ROADMAP 6.22, Kandidaten in `lab/palette/`): Farbwinkel unverändert bei 16, Sättigung 61 → 45, Helligkeit 43 → 40. **Dass er dabei dunkler wurde, ist Arithmetik und kein Geschmack:** das alte `#b1502b` hielt WCAG AA mit 4,56 um 0,06, und reines Entsättigen fällt jedes Mal darunter (`#a85c40` 4,33, `#a1614a` 4,27, `#9d6552` 4,18). Über die Helligkeit landet er bei **5,29** und hat damit zum ersten Mal Reserve. Wer ihn weiter beruhigen will, muss ihn weiter abdunkeln; unterhalb von Sättigung 22 ist es kein Terrakotta mehr, sondern Braun.

  **`ink-3` verfehlte bis dahin WCAG AA** — 3,28 hell und 4,14 dunkel gegen die 4,5, die normaler Text braucht. Es trägt die Metadatenzeilen und die Verdikt-Hinweise bei 11–12 px, die Ausnahme für großen Text greift also nicht. Jetzt `#746c62` (4,55) und `#837b6f` (4,51) — kaum ein Schattenunterschied, weshalb es niemandem auffiel. **Jede künftige Änderung an den Tokens wird gegen diese Paare gerechnet, nicht nach Augenmaß:** `contrastRows` in `lab/palette/palettes.ts` prüft sie.
- **Typografie:** Fraunces (Variable Font, optische Größe) für Titel und Wortmarke, Geist Sans für UI, Geist Mono für ISBNs. Basis 15 px, 8-px-Raster.
- **Bausteine:** `.chip` (Sprach- und Tab-Chips), `.btn` / `.btn-accent`, `.kicker` (Kapitälchen-Label), `.cover-shadow` (Kontaktlinie plus weicher Schatten), `.cover-img` (Einblenden nach Laden). Fokus-Ringe in Akzentfarbe, `prefers-reduced-motion` respektiert.
- **Seiten:** Startseite mit Hero, großem Suchfeld und Sprach-Chips; Ergebnisraster aus rahmenlosen Karten mit Buchschatten und zwei Zeilen Text; Detailseite mit Cover-Wand links (zwei Drittel) und der gewählten Ausgabe als eigenständig scrollende, sticky Seitenleiste rechts, Sprach-Tabs als Chips, Metadaten als Definitionsliste, Kauf-Links als ruhige Buttons; auf dem Telefon Raster zweispaltig und die Seitenleiste als Schublade (F2.11).
- **Zugänglichkeit:** Alt-Texte mit Verlag und Jahr, `role=tablist`/`tab`, `aria-pressed` auf Chips und Covern, Schublade als modaler Dialog.

---

## 6. Entscheidungen

| # | Datum | Frage | Entscheidung |
|---|---|---|---|
| E1 | 2026-09-06 | Umfang der Neufassung | Datenschicht neu, UI behalten (Option A). Umgesetzt, siehe [history](docs/history.md). |
| E2 | 2026-09-06 | Sprachfilter-Default | `all`; API-Route und UI haben denselben Default. |
| E3 | 2026-09-06 | Query in Titel + Autor zerlegen | Nein. Das Ranking trägt allein; vorgemerkt mit Auslöser (ROADMAP, zurückgestellt). |
| E4 | 2026-09-06 → 09-07 | Mosaik-Cover ohne Fan-out | Gecachter Nachlade-Call pro Karte aus Seite 0; der Google-Anteil entfiel, weil Open Library allein alle vier Kacheln füllt. |
| E5 | 2026-09-06 | Rolle von Google Books | Nur ergänzend, nur auf der Detailseite; erzeugt nie eigene Works. |
| E6 | 2026-09-06 | Caching-Backend | Next-`fetch`-Cache, kein KV, bis ein Auslöser eintritt. **Präzisiert durch E18**, das sagt, was hier „Speicher“ heißt. |
| E7 | 2026-09-06 | Sprache der Doku | Spec und Roadmap Deutsch, Code, Kommentare und Commits Englisch. |
| E8 | 2026-09-06 | Cover-Identität | Cover ist eigene Entität, Dedupe nach Bild, nie nach ISBN (2.3). |
| E9 | 2026-09-06 | Märkte | Mehrere Märkte, US zuerst; Händler und Affiliate-Konten pro Markt; Oberfläche Englisch (2.4). |
| E10 | 2026-09-07 | Wo Google gefragt wird | An genau zwei Stellen (F3.2). Kein dritter Aufrufer ohne Messung gegen die 1.000 pro Tag. |
| E11 | 2026-09-07 | Kontingent-Schutz | Kein Tageszähler (unehrlich wegen Cache), sondern Sicherungsautomat auf Googles eigener Fehlermeldung (N9). |
| E12 | 2026-09-07 | Verfügbarkeits-Button | Bleibt vorerst drin; **nicht für den Betrieb freigegeben**. Seit E20 (2026-09-08) nur im Shop-Modus vorhanden; für den Hobby-MVP damit beantwortet (ROADMAP 0.1, Option a). |
| E13 | 2026-09-07 | Detailseite auf dem Telefon | Cover-Wand bleibt vertikal, Seitenleiste wird zur Schublade. Eine horizontale Wand zeigte zwei statt neun bis zwölf Cover. |
| E14 | 2026-09-07 | Klickzählung und Analyse | Keine Kennung des Lesers, nur Aggregate. Eine Sitzungskennung brächte Einwilligung und Banner für Erkenntnisse, die nicht gebraucht werden. |
| E15 | 2026-09-07 | Mosaik und Sprachfilter | Das Mosaik bleibt sprachneutral: Seite 0 enthält die gesuchte Sprache fast nie, und weitere Seiten pro Karte sind zu teuer. |
| E16 | 2026-09-07 | Leer aussehende Cover | Werden nie gelöscht, nur ans Ende sortiert; eine Löschregel traf vier echte Cover von acht. |
| E17 | 2026-09-07 | Reihenfolge der Sprach-Tabs | Gesuchte Sprache, dann Englisch, dann Deutsch, dann Häufigkeit, Unbekannt zuletzt; Reihenfolge wird nach dem ersten Auftauchen eingefroren. |
| E18 | 2026-09-07 | Was E6 mit „Speicher“ meint | **Gebaute, nur lesbare Daten im Repo sind kein Speicher im Sinne von E6.** Ein Index, den ein Skript vor dem Deploy erzeugt und der mit dem Deploy ausgeliefert wird, ist erlaubt; ein Speicher, in den die **laufende Seite schreibt**, bleibt zurückgestellt. Abgrenzung zu §1: ein solcher Index hält **abgeleitete Werte** (Signaturen, Farbmaße) und Kennungen, keine Katalogdatensätze — die „eigene Buchdatenbank“, die §1 ausschließt, bleibt ausgeschlossen. Begründung und Größenrechnung in [docs/plans/PLAN-speicher.md](docs/plans/PLAN-speicher.md). |
| E20 | 2026-09-08 | Betriebsmodus | **`NEXT_PUBLIC_SITE_MODE`: `hobby` (Default, auch wenn nicht gesetzt) oder `shop`; jeder andere Wert bricht den Build.** Hobby ist die öffentliche Seite bis Phase 4: Händler-Links bleiben (Julian: „solange es keine Affiliate-Links sind“), aber die Affiliate-Variablen werden ignoriert, der Verfügbarkeits-Button und seine Route sind aus, kein Provisionssatz, kein `rel="sponsored"`. Shop schaltet das ein und läuft lokal oder als Preview. `main` ist Production und Hobby; der Umschalttag braucht vorher das volle Impressum und einen kommerziell nutzbaren Hosting-Plan. Ein Schalter statt zweier Branches, weil zwei gepflegte Branches auseinanderlaufen. Plan: [docs/plans/PLAN-2-mvp-hobby.md](docs/plans/PLAN-2-mvp-hobby.md). |
| E19 | 2026-09-08 | Werbung | **Höchstens ein Platz je Seite, und nur, wenn ein Netzwerk ihn automatisch füllt** — kein von Hand verkaufter oder belegter Platz (Julian: zu viel Arbeit). Der Platz liegt außerhalb von Cover-Wand, Ergebnisraster und Händlerliste; das Netzwerk darf keine Kennung des Lesers setzen (N11, E14) und muss Kategorien ausschließen können, sonst gibt es den Platz nicht; gekennzeichnet; kein Anzeigenkunde beeinflusst Wand, Ranking, Verdikt oder Händlerliste. Programmatic Display mit Einwilligung, Direktvermarktung, Bezahlfunktionen auf Google-Daten und Merch aus Covern sind ausgeschlossen. Analyse in [docs/plans/PLAN-4-einnahmen.md](docs/plans/PLAN-4-einnahmen.md). |

---

## 7. Gemessene Grenzen (Stand 2026-09-07)

Die Zahlen, die den Entwurf bestimmen. Herkunft und Messaufbau in [docs/history.md](docs/history.md); die mit ¹ markierten stammen aus den Messungen vom 2026-09-07, dem [Durchklick](docs/tests/2026-09-07-durchklick.md) und der Dubletten-Analyse.

| Grenze | Zahl | Folge |
|---|---|---|
| Verlässlichkeit der Suche¹ | **Sie schwankt in Episoden, sie ist keine Quote.** 2026-09-07: 4 von rund 14 kalten Suchen im damaligen 8-Sekunden-Timeout; 12 Suchen ohne Deckel: 7 unter 8 s, 3 zwischen 9 und 10 s, eine nach 24 s, eine gar nicht. 2026-09-08 mittags: 3 von 4 gescheitert. 2026-09-08 abends, 80 Suchen (40 verschiedene Titel kalt, dazu 4 Titel zehnmal): **kein einziger Ausfall**, Median 0,9 s, langsamste 5,0 s | Deckel auf 12 s, ein Ausfall erscheint als Ausfall (F1.7), und die Wiederholung aus F3.3 kostet in einer guten Episode nichts, weil sie nicht auslöst |
| Kosten einer Auswahl¹ | 2 bis 5 Google-Anfragen pro Klick, je nach Zahl der ISBNs am gefalteten Cover. **Wer nichts auswählt, kostet seit dem 2026-09-09 nichts über die Titelsuche hinaus** (gemessen: 0 Anfragen an `/api/isbn` beim kalten Öffnen, 1 bei geteiltem Link mit `?cover=`) | N9; entscheidet ROADMAP 0.7 mit |
| Ladeszene mit Sprachfilter¹ | *1984* mit `lang=de`: über 20 s Bühne, weil deutsche Ausgaben erst auf Seite 3–4 liegen; ohne Filter 8 s | Die Wartegrenze aus F2.4 greift, fühlt sich aber wie ein Hänger an |
| Ranking bei gleichnamigen Ableitungen¹ | Vorher: `alice in wonderland` Bühnenfassung mit 1 Ausgabe vor dem Original mit 3.547; `the great gatsby` 11 von 15 Karten Sekundärliteratur. Nach den vier Regeln vom 2026-09-08, über 15 Suchen gemessen: **7 verbessert, 8 unverändert, keine verschlechtert**; nur ein erster Treffer änderte sich, und das war der falsche | F1.4 erledigt (ROADMAP 6.1); offen bleibt, was hinter einem fremdsprachigen Haupttitel liegt |
| Was die Ableitungsregeln nicht fangen¹ | Steht der Hauptdatensatz unter einem fremdsprachigen Titel, hat die englische Sekundärliteratur kein gleichnamiges großes Werk zum Vergleich: bei `crime and punishment` steht Harold Blooms Band auf Platz 2, weil der Roman als «Преступление и наказание» geführt wird | Dieselbe Wurzel wie [ROADMAP](ROADMAP.md) 6.13/6.15; dort zu lösen, nicht im Ranking |
| Schwelle für gleichen Titel¹ | Muss fallen: Übersetzer-Datensatz 65x, Penguin-Studie 400x, Bühnenfassung 117x, Bloom 177x. Muss bleiben: Randall Kennedys *Sellout* 16x, Lars Myttings *Norwegian Wood* 12x. Fenster 17–65 | `SAME_TITLE_EDITION_RATIO` = 30, mit Faktor 2 Abstand nach beiden Seiten |
| Titel in der Sprache des Katalogs¹ | `crime and punishment` → «Преступление и наказание»; `die verwandlung` → „Metamorphosis“ | Richtiges Werk, fremde Sprache auf der Karte; ROADMAP 6.2 |
| Abdeckung | *The Great Gatsby*: 1.180 Datensätze bei Open Library, 379 mit Bild, 293 Cover nach dem Falten. *Nineteen Eighty-Four*: 537 / 272 / 226. | Die Seite zeigt, was die Kataloge haben; F2.3 sagt es, §1 verbietet mehr. |
| Was Google beisteuert | Cover: *1984* 4 von 282, *Beloved* 12 von 72, *Mumbo Jumbo* 3 von 13; dazu Beschreibungen und Vorschau-Links. Fürs Mosaik: nichts, was Open Library nicht hat. | Google ist für die Menge zweitrangig, für das Verdikt (F2.9) unersetzlich. |
| Kontingent | 1.000 Google-Anfragen pro Tag, Entwicklung und Betrieb am selben Schlüssel. | ~500 kalte Detailseiten pro Tag (N9). |
| Google-Ausfälle | 503 bei etwa jeder dritten ISBN-Anfrage in der Messung; 30-Tage-Kurve bestätigt es. | Retry plus `unavailable`, nie „kein Cover“. |
| Open-Library-Latenz | 2–7 s Suche, 3–10 s pro Editions-Seite aus Deutschland, gelegentlich über 12 s. In einer guten Episode dagegen 0,9 s im Median über 80 Suchen (2026-09-08 abends). | Timeouts F3.3, Wiederholung der Suche und von Seite 0, Cache N4. |
| Seite 0 | Sprachengemisch, meist ohne Sprachangabe; bei *1984* keine deutsche Ausgabe auf Seite 0. | Mosaik sprachneutral (E15); Ladeszene wartet auf die Sprache (F2.4). |
| Dedupe-Schwellen | Verschiedene Designs mit gemeinsamem Public-Domain-Motiv liegen bei Distanz 17–22; echte Duplikate desselben Verlags bei 5–16, gleiche ISBN bis 20. | Drei Stufen (2.3); oberhalb von 8 nur mit Metadaten. |
| Was die Stufen nicht fangen¹ | *Mason & Dixon*: 12 gezeigte Kacheln, davon 7 dasselbe Motiv. Gleiche ISBN bei Distanz 22 (Stufe faltet bis 20); „Henry Holt" gegen „Holt Paperbacks" bei 10 (Wortmengen-Vergleich erkennt das Haus nicht); fehlende Sprachangabe bei 11. | [ROADMAP](ROADMAP.md) 6.7, nach der Quellenprüfung 6.6 |
| Kaltes Hashing | 4 s Budget pro Seite reichen beim ersten Aufruf nur für einen Teil der Bilder; das Signatur-Memo lebt je Serverinstanz. | Cover-Zahl sinkt beim zweiten Besuch; hingenommen, bis [ROADMAP](ROADMAP.md) 6.12 die Signaturen in den Datencache legt. |
| Verdikt | Von 20 ISBNs bei *Beloved*: 4 `verified`, 4 `differs`, 12 `unknown`. | Wo Google ein Bild hat, zeigt der Handel in der Hälfte der Fälle ein anderes; ohne Amazon-PA-API bleibt die Mehrheit unbekannt. |
| Verfügbarkeitsprüfung | Aussage für etwa zwei von sechs Händlern; vier verbieten den Pfad per robots.txt. | Vier Zustände, nicht freigegeben (F2.10, E12). |
| Provision | Nur 2 von 11 Kauf-Links haben einen Provisionsparameter; keiner ist konfiguriert. | Nichts verdient, bevor die Programme stehen (ROADMAP). |
| Kappung | 1.500 Datensätze pro Werk; *Pride and Prejudice* hat 4.041. | Zähler sagt „first 1,500 of K“. |

---

## 8. Nummern-Konkordanz

Kommentare im Code zitieren Abschnitte der Spec, wie sie bis zum 2026-09-07 gegliedert war. §1–§4 und §6 tragen weiter dieselben Nummern. Für den Rest:

| Alte Nummer | Heute |
|---|---|
| §5 Befund des vorhandenen Codes | [history](docs/history.md), „alte §5“ |
| §7 Umsetzungsplan, Schritte 1–9 | [history](docs/history.md), „alte §7“ |
| §8.1 Design | §5 hier; Erledigtes in history, Offenes in [ROADMAP](ROADMAP.md) |
| §8.2 Hosting, §8.3 Provision, §8.4 Traffic | [ROADMAP](ROADMAP.md) |
| §8.5, §8.5.1 Aus der Nutzung | Erledigtes in history, Offenes in ROADMAP |
| §8.6 Zurückgestellt | ROADMAP, „Zurückgestellt mit Auslöser“ |
| §8.7 Klärungsliste | Messungen in history, „alte §8.7“; Entscheidungen in ROADMAP Phase 0 |
| §9 Analyse und Schritte 10–16 | [history](docs/history.md), „alte §9“ |
| §10 Nächste Schritte | ROADMAP; Erledigtes in history, „alte §10“ |
