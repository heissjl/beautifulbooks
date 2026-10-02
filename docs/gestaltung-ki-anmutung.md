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

- **Sammlungen zeichnen:** „chosen by Julian, September 2026", ein Satz, warum diese Reihe.
- **Eine Auswahl mit Meinung:** je Sammlung oder Buch ein Lieblingscover mit einem Satz Begründung — genau das, was whichedition menschlich macht, ohne Bewertung aller Cover.
- **Eigene Fotos** von Büchern aus Julians Regal, wo die Rechte es tragen (die Bildfrage aus 5.5 gilt auch hier).
- **„Zuletzt geändert"** auf About und Sammlungen.

## Was ich zuerst ändern würde

1. Die About-Seite in der ersten Person, mit Foto oder Regal (Julian schreibt, Claude kürzt).
2. Farbe: Creme und Terrakotta ersetzen (Julian wählt aus zwei, drei Entwürfen bei 390 × 844 und 1280 × 800).
3. Etiketten, Pfeile und Pillen ausdünnen — ein mechanischer Durchgang, eine Stunde, ohne Gestaltungsentscheidung.
4. Den Hero durch ein echtes Bild ersetzen.

Punkt 3 kann sofort geschehen; 1, 2 und 4 brauchen Julian.
