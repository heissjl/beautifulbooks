# Was an der Seite nach Claude aussieht (2026-10-02)

Julian, mit einem Bildschirmfoto der Ilias-Seite von whichedition.com: „some visual elements are very claude-y and so they are on our site. can you identify the most derivative claude-prototypical stuff on our website so we can make it seem more human-made or at least human-curated".

Angesehen am 2026-10-02 unter `npm run dev` bei 1280 × 800: Startseite, `/book/OL468431W` (Gatsby), `/collections`, `/about`, eine 404-Seite. Cover luden im Dev-Server nicht (kein Netz), Aufbau und Texte schon. Dazu Zählungen im Code (`components/`, `app/`, `app/globals.css`).

## Vorweg: whichedition hat dieselben Merkmale

Das Bildschirmfoto zeigt fast alles, was unten steht: Großbuchstaben-Etikett mit Sperrung („PICK WHAT MATTERS MOST TO YOU"), Pillen („Best for most"), Serifenname · Jahr mit Mittelpunkt, „Compare all 5 →", ein schwarzes Banner mit Symbol und Pfeil, Gedankenstriche im Werbetext. **Menschlich wirkt die Seite trotzdem**, und zwar wegen der About-Seite: ein Foto, „I buy the editions, read them, photograph them on my own table", was er gerade liest, sein Regal, „Last updated June 2026". Die Oberfläche ist Baukasten, die Stimme ist eine Person. Daraus folgt die Reihenfolge unten: **die Stimme bringt mehr als jedes Bauteil.**

## Die stärksten Merkmale, nach Wirkung geordnet

### 1. Die Farben sind Claudes eigene

`--bg: #f4f0e8` (warmes Creme), `--surface: #fbf9f4`, `--accent: #945138` (Terrakotta), `--ink: #1a1714`. Das ist sehr nah an der Markenpalette von Anthropic und an Claudes eigener Oberfläche (Elfenbein und ein Ton aus Lehm und Orange). Jede „geschmackvolle" Seite, die ein Modell ohne Vorgabe baut, landet hier. Die Kommentare in `app/globals.css` belegen sogar, wie der Ton entstand: Terrakotta, auf Julians Wunsch etwas entsättigt — also eine Korrektur des Vorschlags, keine eigene Wahl.

**Gegenmittel:** eine Farbe aus dem Material nehmen statt aus dem Geschmack. Etwa das Gelb der Edelmann-Umschläge bei Hanser, das Orange von Penguin, der Regenbogen der edition suhrkamp — oder gar keinen Akzent und ein kühles Galeriepapier, damit nur die Cover farbig sind (SPEC §8.1 sagt ohnehin „covers carry the color"). Denkbar auch: der Akzent wechselt je Sammlung.

### 2. Der Hero ist die Standardformel

`app/page.tsx`: Serifenüberschrift, deren letzte Wörter kursiv in der Akzentfarbe stehen („Judge a book *by its covers.*"), darunter ein grauer Absatz, ein Suchfeld mit Knopf, zwei Textlinks mit „→", rechts ein Fächer aus schräg gelegten Kacheln. Das ist Zeile für Zeile die Startseite, die v0, Claude und Lovable für jedes Produkt bauen. Das Wortspiel „Judge a book by its covers" ist dazu das erste, das einem Modell zu Covern einfällt.

**Gegenmittel:** ein echtes Bild statt der Formel — die Wand eines Buchs in voller Breite, ein heutiges Cover groß, oder ein Foto aus Julians Regal. Überschrift ohne den Kursiv-Akzent-Trick. Ob der Satz bleibt, entscheidet Julian; er ist nicht falsch, nur nahe liegend.

### 3. Großbuchstaben-Etiketten über allem

Die Klasse `.kicker` (`text-xs uppercase tracking-[0.12em] text-ink-3`) steht 23-mal im Code: „251 COVERS", „THIS BOOK", „SELECTED COVER", „LOOKS LIKE THIS", „OR READ IT IN ANOTHER EDITION", „RECENT", „POPULAR", „SHOP IN". Das ist das deutlichste Einzelmerkmal generierter Oberflächen — und genau das „PICK WHAT MATTERS MOST TO YOU" auf dem Bildschirmfoto.

**Gegenmittel:** die meisten streichen; wo eine Überschrift nötig ist, normale Schreibung in der Serifenschrift. Ein Mensch beschriftet nicht jeden Kasten.

### 4. Pfeile hinter jedem Link

„See all →", „76 books →", „All 76 →", „Create your own collection →", „See these covers by decade →", „Help us find the prettiest cover of all time! →". Auf `/collections` stehen bei jeder Sammlung zwei Pfeillinks zum selben Ziel.

**Gegenmittel:** Pfeile weg, die Unterstreichung trägt den Link. Höchstens einer pro Seite, wo wirklich „weiter" gemeint ist.

### 5. Pillen mit Zählern

`rounded-full` 47-mal, die Klasse `.chip`: Sprachreiter „English 123 · German 13 …", „Titles & authors / Author only". Pillen mit Zahl sind das Filter-Bauteil jedes Dashboards.

**Gegenmittel:** Reiter als einfache Wörter mit Unterstrich für den gewählten, die Zahl klein dahinter oder gar nicht.

### 6. Gleichförmige Karten, weiche Schatten, Einblend-Animation

Auf der Startseite und unter `/collections` ist jede Sammlung ein Kasten mit Haarlinie, Titel links, Zähler rechts, sechs gleich große Kacheln mit weichem Schatten (`.cover-shadow`). Kacheln kommen mit `tile-in` (hochrutschen und wachsen) und `cover-img` (0,45 s Einblenden). Gleich große Rechtecke mit Schatten und sanftem Auftritt sind der Normalzustand jeder generierten Galerie.

**Gegenmittel:** Cover in ihrem echten Seitenverhältnis, ohne Rahmen und Kasten, eng nebeneinander wie auf einem Tisch; Animation nur, wo sie etwas erklärt.

### 7. Mittelpunkt-Zeilen und Slogan im Kopf

„Open Library dates it to 1920 · 251 covers · 1,100 of 1,180 editions checked", „Verlag · Jahr · Sprache"; im Kopf neben dem Logo der graue Slogan „Covers, side by side.". Einzeln harmlos, zusammen das Muster.

## Die Texte

### 8. Die About-Seite spricht wie ein Modell, das sich rechtfertigt

Der Inhalt ist richtig und ehrlich; der Ton ist der von CLAUDE.md und docs/history.md, der zum Leser durchgesickert ist:

- **Verneinungsketten:** „there are no affiliate parameters, no advertising and no paid placement"; „nothing about you. No cookie, no address, no identifier, nothing that could be traced back to a person".
- **„X, nicht Y"-Wendungen:** „There is one thing the order does follow, and it is not money"; „says so rather than guessing either way"; „rather than reporting the silence as ‚nothing known'".
- **Messprotokoll statt Erzählen:** „Measured across three books", „The measurements were taken on 2026-09-26", „which about one cover in nine manages".
- **Nachgeschobene Pointen:** „which is little", „and the wall is long enough already".
- **Keine Person.** Kein „ich", kein Name außer im Impressum, kein Datum, kein Grund, warum es die Seite gibt.

**Gegenmittel:** Julian schreibt die About-Seite in der ersten Person neu, kurz: wer, warum, seit wann, was er sammelt. Die Fakten bleiben, die Beteuerungen schrumpfen auf je einen Satz. Die Verdikt-Liste kann bleiben, sie ist Referenz.

### 9. Gedankenstriche

Rund zehn Oberflächentexte und viele Sammlungsbeschreibungen tragen Gedankenstriche. Für sich kein Fehler; in der Menge das bekannteste Merkmal von Modelltext. Bei neuen Texten sparsam.

## Was schon menschlich wirkt — und ausgebaut werden kann

**Die Sammlungsbeschreibungen.** „Heinz Edelmann designed the first German edition of The Lord of the Rings for Klett in 1969–70…", die Bibliothek der Erinnerung, die Reihe Hanser ab Canettis „Die Stimmen von Marrakesch", die Scans aus einer Privatsammlung. So etwas erfindet kein Modell ohne Vorlage; das ist kuratiert, und es sieht man. Ausbauen:

- ~~Sammlungen zeichnen mit „chosen by Julian"~~ — abgelehnt (Julian, 2026-10-02: „so etwas will ich nicht").
- **Eine Auswahl mit Meinung:** je Sammlung oder Buch ein Lieblingscover mit einem Satz Begründung — genau das, was whichedition menschlich macht, ohne Bewertung aller Cover.
- **Eigene Fotos** von Büchern aus Julians Regal, wo die Rechte es tragen (die Bildfrage aus 5.5 gilt auch hier).
- **„Zuletzt geändert"** auf About und Sammlungen.

## Was ich zuerst ändern würde

1. Die About-Seite in der ersten Person, mit Foto oder Regal (Julian schreibt, Claude kürzt).
2. Farbe: Creme und Terrakotta ersetzen (Julian wählt aus zwei, drei Entwürfen bei 390 × 844 und 1280 × 800).
3. Etiketten, Pfeile und Pillen ausdünnen — ein mechanischer Durchgang, eine Stunde, ohne Gestaltungsentscheidung.
4. Den Hero durch ein echtes Bild ersetzen.

Punkt 3 kann sofort geschehen; 1, 2 und 4 brauchen Julian.

## Vorschläge (2026-10-02)

Julian zu den Punkten 3, 4 und 7: „zeig beispiele und mach einen vorschlag", zur Farbe: „mach ein mockup". Alles zusammen im Mockup **`lab/look/`** (`npx tsx lab/look/build.ts --embed` → `lab/look/out/look.html`): die Gatsby-Seite in fünf Fassungen, hell und dunkel, darunter die Tabellen mit jeder Stelle im Code. Hier die Regeln und das Wichtigste; die vollständigen Listen stehen in `lab/look/build.ts` (`KICKERS`, `ARROWS`, `DOTS`).

### Etiketten (Punkt 3)

**Regel:** ein Kasten bekommt nur dann eine Beschriftung, wenn er ohne sie unklar wäre — dann als Satz, nicht als Stempel. **Schritt 1:** die Klasse `.kicker` in `app/globals.css` verliert `uppercase` und die Sperrung und wird `text-sm text-ink-2`; das trifft alle 23 Stellen auf einmal. **Schritt 2**, je Stelle:

| Heute | Vorschlag |
|---|---|
| 251 COVERS (über den Sprachreitern) | streichen, die Zahl steht in der Zeile unter dem Autor |
| THIS BOOK | streichen |
| SELECTED COVER (Telefon) | Verlag und Jahr: „Penguin Books, 2010" |
| LOOKS LIKE THIS | Serifenüberschrift „Covers that look like this one" |
| GET THIS PRINTING, OR READ IT IN ANOTHER EDITION, BY OTHER AUTHORS, YOUR OTHER COLLECTIONS | Serifenüberschrift, normale Schreibung |
| 3 BOOKS · 1,180 EDITIONS | „3 books, 1,180 editions" |
| WHICH COVER? über „The standings" | streichen |
| RECENT / POPULAR, SHOP IN, COUNTRY, PICK COVERS … | normale Schreibung, klein |

### Pfeile (Punkt 4)

**Regel:** kein Pfeil hinter Text. Pfeile bleiben, wo sie eine Richtung meinen („← Home", Tastenhilfe im Spiel, Verschiebeknöpfe). Acht Stellen; die wichtigste: auf `/collections` führen „76 books →" und die Kachel „All 76 →" zum selben Ziel — **der Titel wird der Link, „76 books" grau ohne Link, die letzte Kachel heißt „70 more"**. Auf der Startseite wird die Überschrift „Collections" selbst zum Link, „See all →" fällt weg. **„See these covers by decade" behält seinen Wortlaut**, verliert nur den Pfeil und bekommt die Unterstreichung (Julian, 2026-10-02: „hier fand ich das vorher besser, aber bitte ohne pfeil"); umgesetzt in `components/DecadeLink.tsx`.

### Mittelpunkte und Slogan (Punkt 7)

**Regel:** ganze Sätze, wo es Aussagen sind; Komma und Klammer wie auf einer Katalogkarte, wo es Angaben sind.

| Heute | Vorschlag |
|---|---|
| Kopf: „Covers, side by side." | streichen — Logo und Suche genügen, die Startseite sagt im ersten Satz, was die Seite ist |
| Open Library dates it to 1920 · 251 covers · 1,100 of 1,180 editions checked | 251 covers from 1,100 of 1,180 editions. Open Library dates the book to 1920. |
| Penguin Books · 2010 · English | Penguin Books, 2010 (English) |
| AbeBooks · ISBN | AbeBooks by ISBN |
| About · Beautiful Books (Tab) | bleibt |

### Farbe (Punkt 1)

Drei Fassungen neben *Heute* und *Heutige Farben, neue Form*: **Galerie** (kein Akzent, kühles Papier — am strengsten), **Edelmann-Gelb** (Reihe Hanser: Gelb als Fläche für Suchknopf, gewählte Sprache und ersten Laden, Schrift schwarz), **Penguin-Orange** (Band über der Seite, Orange als Fläche, Links dunkles Orange `#a84400`). Jede besteht WCAG AA hell und dunkel (Tabellen im Mockup). Gelb und Penguin-Orange gehen nur als Fläche mit Tinte darauf; als Linktext auf hellem Grund fallen sie durch. Die Fassung *Heutige Farben, neue Form* zeigt, wie viel Punkt 3, 4 und 7 allein ausmachen — wer nur die Form ändert, ändert schon viel.

## Umgesetzt (2026-10-02)

Julian wählte „Heutige Farben, neue Form" — mit senkrecht mittiger Schrift in den Sprachreitern. Gebaut als **ROADMAP 6.84**; Einzelheiten im Archiv, Messung in der Historie. Offen bleiben die Farbe (Galerie, Edelmann-Gelb, Penguin-Orange), der Hero (Punkt 2), die About-Seite (4.12, Bedingung für den Shop-Modus) und die Gleichförmigkeit der Kacheln (Punkt 6).
