# Plan: die Suche überarbeiten (ROADMAP 6.60)

Stand: 2026-09-27. Auftrag (Julian, 2026-09-27): „starte einen agenten, der die suchfunktion überarbeitet. automatische smarte erkennung von tippfehlern?, möglichkeit explizit nur nach autor zu suchen, checke ob die sprachpillen noch sinn ergeben?"

**Status: Teil 1 (Tippfehler) und Teil 2 (Autorensuche) sind gebaut; Teil 3 ist entschieden (Julian, 2026-09-27: „mach das noch, dann deploy") und gebaut: die Sprach-Pillen sind aus der Suche entfernt (§6.1).** Deploy durch die koordinierende Session. Gemessen am 2026-09-27 von Deutschland aus direkt gegen Open Library, Abfragen je mindestens 1,1 s auseinander; die Antworten, auf die sich die Tests stützen, liegen in `lib/__fixtures__/search/responses.json` (`npx tsx scripts/record-search-fixtures.ts`).

---

## 1. Ausgangslage

- `/api/search?q=&lang=` fragt **genau einmal** Open Library (`search.json`, 20 Treffer), führt gleiche Werke zusammen (`mergeWorks`), filtert nach Sprache (`filterWorksByLanguage`) und reiht (`rankWorks`). Google wird bei der Suche nie gefragt (N9).
- Autorennamen werden nicht gesondert geparst (E3, F1.1). Der Link „More by …" unter einer Wand (6.53) führte auf `/?q=<Name>`, also die Freitextsuche.
- Die Sprach-Pillen (F1.2) setzen `?lang=`: die Trefferliste behält nur Werke mit mindestens einer Ausgabe in der Sprache (Werke **ohne** Sprachangabe bleiben), und die Detailseite stellt die Sprachgruppe nach vorn und wartet auf sie (6.3).
- Die Suchroute zog bis heute auch einen Token aus dem `google`-Eimer ab, obwohl sie Google nicht fragen kann — eine Suche verbrauchte Rate-Limit, das für die Detailseiten gedacht ist.

## 2. Tippfehler: was Open Library tut

**Open Library hat keine Rechtschreibhilfe.** Die Antwort von `search.json` hat keine Felder dafür (`numFound, start, numFoundExact, num_found, documentation_url, q, offset, docs`), und Solrs Unschärfe-Operator `~` wirkt nicht: `gatsbee~`, `gatsbee~2`, `title:gatsbee~`, `prejudise~1` finden nichts. Ein Tippfehler findet ein Buch nur, wenn irgendein Datensatz denselben Fehler trägt.

| Eingabe | Treffer | Bestes Werk (Ausgaben) | Was der Leser sah |
|---|---|---|---|
| `Gatbsy` | 2 | The Great Gatsby (1.180) | richtig — ein Datensatz heißt „Learn German with the Great Gatbsy" |
| `gatsbee` | **0** | — | „No books found" |
| `pride and prejudise` | **0** | — | „No books found" |
| `lord of the rigns` | **0** | — | „No books found" |
| `Tolkein` | 26 | *Inklings* (11), Platz 1 „J. R. R. Tolkein" (1 Ausgabe) | Bücher über Tolkien und Namensvettern |
| `Hemmingway` | 64 | 8 Ausgaben, Platz 1 „The Old Man and the Sea — Ernest Hemmingway" (1) | Streugut mit dem Tippfehler |
| `harry poter` | 19 | Philosopher's Stone (400) | richtig |
| `Orwel 1984` | 266 | Nineteen Eighty-Four (727) auf Platz 2 | fast richtig |
| `the hobit` | 3 | The Hobbit (481) | richtig |
| `Kafka Verwandlung` | 254 | Metamorphosis (956) | richtig, kein Tippfehler |
| `Dostojewski` | 3.106 | Sekundärliteratur (Zweig, *Drei Meister*, 5) | **kein Tippfehler**, sondern die deutsche Umschrift; Open Library führt ihn als „Fiódor Dostoievski" |

Die Unterscheidung, auf die alles hinausläuft: **drei Fälle sind leer, zwei schwach, der Rest findet trotz Fehler.** Eine Korrektur darf nur die ersten beiden anfassen.

### 2.1 Optionen

| Option | Gewinn | Kosten | Urteil |
|---|---|---|---|
| a) Open Librarys eigene Unschärfe | — | — | gibt es nicht (oben) |
| b) „Meinten Sie …?" aus einer lokalen Liste, ohne zweite Anfrage | Vorschlag bei leerem Ergebnis | 0 Anfragen | zu wenig: der Leser muss klicken, und bei `Tolkein` sieht er weiter Streugut |
| c) **Korrigierte Anfrage, nur wenn die erste leer oder schwach ist** | `gatsbee`, `pride and prejudise`, `lord of the rigns`, `Tolkein`, `Hemmingway` finden ihr Buch | **eine** Anfrage mehr, nur in diesen Fällen, gecacht wie jede Suche | **gewählt** |
| d) Trigramm/Levenshtein auf ganzen Titeln | findet auch Titel außerhalb | Liste der Titel reicht nicht für Freitext mit Autor | nur wortweise sinnvoll → in c) enthalten |
| e) Google Books „spelling" | — | verboten (Google nie für die Suche) | nein |

### 2.2 Gebaut (Option c)

- **Wortliste** (`lib/lexicon.ts`, nur Server): Titel und Autorennamen aus `data/index-works.json` (500 Werke), `data/curated.json` und allen Sammlungen in `data/collections.json` (Entwürfe eingeschlossen): **4.907 Wörter**, rund 1.800 Titel und 1.200 Namen. Einmal je Server-Instanz gebaut; ein Durchlauf über 40 Anfragen dauert 35 ms.
- **Korrektur** (`lib/spelling.ts`, rein): jedes Wort ab **vier Buchstaben**, das die Liste nicht kennt, wird durch das nächste bekannte ersetzt — höchstens **1 Änderung** bei vier und fünf Buchstaben, **2** ab sechs; eine Vertauschung zweier Nachbarn zählt als eine (`tolkein` → `tolkien`). Bei Gleichstand gewinnt das Wort mit demselben Anfangsbuchstaben, dann das häufigere. Zahlen und bekannte Wörter bleiben unberührt, klein Getipptes bleibt klein.
- **Wann** (`lib/search.ts`): nur wenn Open Librarys Antwort **schwach** ist — leer oder kein Werk mit mehr als **30** Ausgaben (`WEAK_BEST_EDITIONS`, gemessen vor dem Sprachfilter) — **und** die Korrektur etwas ändert. Dann eine zweite Suche (ein Versuch, 8 s). Sie ersetzt das Ergebnis, wenn das erste leer war oder das beste Werk der Korrektur mindestens **das Fünffache** hat (`BETTER_FACTOR`) und selbst über 30 liegt.
- **Was der Leser sieht:** „Showing results for **Tolkien**. Search for „Tolkein" instead" — der Link setzt `?exact=1` und fragt ohne Korrektur. Schweigt die zweite Anfrage bei leerem erstem Ergebnis, bleibt es bei „No books found" mit dem Link „Did you mean „gatsby"?" — angeboten, nicht behauptet (N12). Schweigt sie bei schwachem Ergebnis, bleibt das Ergebnis, wie es war.

### 2.3 Gemessen mit der gebauten Korrektur

| Eingabe | Bestes Werk vorher | Korrektur | Platz 1 danach |
|---|---|---|---|
| `gatsbee` | 0 Treffer | gatsby | The Great Gatsby (1.194) |
| `pride and prejudise` | 0 Treffer | pride and prejudice | Pride and Prejudice (4.175) |
| `lord of the rigns` | 0 Treffer | lord of the rings | The Lord of the Rings (253) |
| `Tolkein` | 26 (nach dem Zusammenführen) | Tolkien | The Hobbit (481) |
| `Hemmingway` | 8 | Hemingway | The Old Man and the Sea (307) |
| `Dostojewski` | 5 | Dostoievski | Преступление и наказание (1.178) |
| `harry poter`, `Gatbsy`, `the hobit`, `Orwel 1984`, `virgina woolf` | stark | — (keine zweite Anfrage) | unverändert richtig |

**Fehlalarme:** 30 gewöhnliche Anfragen, darunter 13 mit schwacher Antwort (*Piranesi* 23, *Austerlitz* 25, *Sátántangó* 14, *Kornél Esti* 5, *Hopeful Monsters* 7, *Omensetter's Luck* 14 …): **keine** Korrektur angezeigt. Die fünf Akzeptanz-Queries lösen keine zweite Anfrage aus (ihr schwächstes bestes Werk: *Mumbo Jumbo* mit 23 — aber alle Wörter sind bekannt).

**Kosten:** eine zweite Open-Library-Anfrage nur bei leerem oder schwachem Ergebnis mit einem Wort in Reichweite; unter den 30 gewöhnlichen Anfragen höchstens bei einer Handvoll, und jede Antwort 24 h gecacht. Kein Google.

**Grenzen, bewusst hingenommen:** Wörter außerhalb der Liste werden nicht korrigiert (`gatsbee` geht nur, weil *Gatsby* auf der Liste steht); `Dostoevsky` ist kein Tippfehler und bleibt schwach (bestes Werk 76, Platz 1 ein Buch über ihn) — dafür ist die Autorensuche da (§3).

## 3. Nur nach Autor suchen

**Das Problem, aus 6.53:** die Freitextsuche nach einem Namen findet Bücher *über* die Person so gut wie ihre eigenen. Harper Lee: **3 von 18** Treffern ihre, Margaret Mitchell **6 von 16**.

### 3.1 Was Open Library dafür hat

- `search.json?q=author_key:<OL…A>&sort=editions` — genau die Anfrage der Reihe „More by …", 125 ms bis 1,7 s.
- `search.json?q=author:(<Name>)&sort=editions` — mit richtigem Namen gut (Fitzgerald 49 von 50 eigene, Le Guin 46, Tolkien 44), aber **ohne Umschriften**: `author:(Dostojewski)` findet einen einzigen Datensatz.
- `search/authors.json?q=<Name>` — kennt die **Alternativnamen** (`Dostojewski` → OL22242A, 2.822 Werke), ordnet aber nach Textähnlichkeit statt Bekanntheit: bei `Tolkien` steht Christopher (2.177 Leser) vor J.R.R. (16.495), bei `Hemingway` SparkNotes (1.297 Leser) unter den ersten fünf.
- **Eine Person, mehrere Datensätze:** *Nineteen Eighty-Four* hängt an OL15318546A (2 Werke, 8.582 Leser), Orwells Hauptdatensatz ist OL118077A (635 Werke, 16.945 Leser). Mit nur dem Schlüssel des Werks zeigte die Autorensuche von *1984* aus zwei Werke.

### 3.2 Gebaut

- **Adresse:** `/?author=<Name>` und `/?author=<Name>&key=<OL…A>`. Das Suchfeld zeigt den Namen, die Chips darunter „Titles & authors · Author only"; ein Wechsel mit einer Suche auf dem Schirm fragt dieselben Wörter sofort anders herum. In der Autorensuche verschwinden die Sprach-Pillen (§5).
- **Name → Person** (`pickAuthor`, `lib/authorsearch.ts`): `authors.json`, dann die Person mit den **meisten Lesern**, bei Gleichstand den meisten Werken; eine Person ohne Werke nie. Dazu **Datensätze desselben Namens** (`authorMatchKey`) mit mindestens **10 %** ihrer Leser (`SAME_PERSON_SHARE`, höchstens fünf Schlüssel): Orwell bekommt vier, Harper Lee einen (ihr zweiter Datensatz hat 0 Leser).
- **Tippfehler im Namen:** hat die gefundene Person weniger als **100 Leser** (`WEAK_AUTHOR_READERS`) und ist ein Wort des Namens in Reichweite der Wortliste, wird der korrigierte Name nachgeschlagen; er gewinnt mit dem Fünffachen der Leser. `Tolkein` → Ivan Tolkein Wotherspoon (0 Leser) → **J.R.R. Tolkien**; `Hemmingway` → ein verirrter „Ernest Hemmingway" (17) → **Ernest Hemingway** (6.432).
- **Werke** (`authorResultWorks`): `author_key:(…)` nach Ausgaben sortiert, 50 Datensätze; nur Datensätze, deren **erster** Autorenschlüssel einer ihrer ist, ohne Sekundärliteratur, markierte Adaptionen und Bandteilungen — die Regeln der Reihe aus 6.53, **ohne** deren Mindestausgaben (dazu §6, Frage 2). Mit einem Schlüssel ist die Adresse genau die der Reihe, beide teilen sich also einen Cache-Eintrag.
- **Der Link „More by <Name> →"** führt jetzt auf `/?author=<Name>&key=<Schlüssel des Werks>`. Der Schlüssel zählt immer; der Name fügt ihre übrigen Datensätze hinzu. Findet der Name eine andere Person, bleibt es beim Schlüssel allein.
- **Ausfälle:** schweigt `authors.json` und ein Schlüssel liegt vor, wird nur mit dem Schlüssel gefragt; ohne Schlüssel ist es 503 „The catalogue did not answer", nie „No author found" (N12). Zwei eigene Leerzustände: „No author found" (niemand unter dem Namen, mit Link auf die Freitextsuche) und „No books by X with a cover".
- **Kosten:** mit Schlüssel und bekanntem Namen zwei Open-Library-Anfragen (Name, Werke), bei einem Tippfehler im Namen drei; alle 24 h gecacht. Kein Google, Eimer `search`.

### 3.3 Gemessen

| Suche | Person | Werke | Anteil eigener Datensätze | Platz 1 |
|---|---|---|---|---|
| Harper Lee | OL498120A | 16 | **16 von 16** (Freitext: 3 von 18) | To Kill a Mockingbird (214) |
| Margaret Mitchell | OL151749A + 3 | 15 | 15 von 15 nach Schlüssel, aber ein Kochbuch einer Namensvetterin („Desserts") | Gone With the Wind (362) |
| George Orwell | OL118077A + 3 | 36 | 36 von 36 | Nineteen Eighty-Four (727) |
| Tolkien | OL26320A | 46 | 46 | The Hobbit (481) |
| Dostojewski | OL22242A | 30 | 30 | Преступление и наказание (1.178) |
| Kafka | OL33146A | 22 | 22 | Metamorphosis (964) |
| Hemingway | OL13640A | 29 | 29 | The Old Man and the Sea (307) |

Harper Lees Liste zeigt, was bleibt: Übersetzungen, die Open Library als eigene Werke führt (*Tespih Agacinin Gölgesinde*, *O Sol e Para Todos*, *Matar a un ruiseñor* zweimal), eine Schachtel („Caja Especial"), eine deutsche „Interpretationshilfe" und eine Unterrichtspräsentation. Alle stehen hinter den echten Werken, weil nach Ausgaben sortiert wird.

## 4. Die Sprach-Pillen: was sie tun

Gemessen über die echte Kette (`parseSearchDocs` → `mergeWorks` → Filter → `rankWorks`) an 16 Anfragen: die fünf Akzeptanz-Queries, sieben nicht-englische Titel (*Die Verwandlung*, *Der Zauberberg*, *Le petit prince*, *L'étranger*, *Cien años de soledad*, *Il nome della rosa*, *Madame Bovary*) und vier weitere (*Harry Potter*, *Dune*, *Crime and Punishment*, *The Master and Margarita*). 16 × 7 Pillen = 112 Fälle.

| Befund | Zahl |
|---|---|
| **English** entfernt bei englischen Titeln 0 bis 1 Werk; Platz 1 ändert sich nie | 16 von 16 ohne Wirkung auf Platz 1 |
| Nicht-englische Pille lässt bei englischen Titeln **1 bis 3** Werke übrig (*The Great Gatsby*: 15 → 2, *Pride and Prejudice*: 15 → 1) | — |
| **Leere Liste**: „No books found … with an Italian edition" | **7 von 112** (*Gravity's Rainbow* it/pt/ja, *Der Zauberberg* it/pt/ja, *The Master and Margarita* ja) |
| **Platz 1 wechselt** | **15 von 112**; bei *Mumbo Jumbo* mit de/es/it/pt/ja fünfmal auf einen Datensatz **ohne** Sprachangabe, weil Reeds Roman nur zwei Sprachen hat und Datensätze ohne Angabe bleiben |
| Die Karten zeigen trotz Pille dieselben Mosaike (E15, sprachneutral) | immer |

Die Pille tut also zweierlei, und beides schwach: sie **dünnt die Liste aus** — meist auf das berühmte Werk, das ohnehin vorn stand, plus Datensätze ohne Sprachangabe — und sie **stellt auf der Detailseite die Sprachgruppe nach vorn**, was die Ladeszene bei `1984` mit `lang=de` auf über 20 s verlängert (6.3). Was ein Leser vermutlich erwartet, wenn er „German" drückt — deutsche Cover —, zeigt die Trefferliste nicht, sondern erst die Detailseite, und dort gibt es die Sprach-Reiter ohnehin.

**Verwirrung:** der Leerzustand sagt ehrlich „with an Italian edition", aber Pynchons Roman *hat* Übersetzungen — nur nicht unter den 20 Treffern mit Sprachangabe `ita`. Der Leser liest daraus: kein italienisches *Gravity's Rainbow*.

## 5. Empfehlung

1. **Tippfehler (gebaut):** so lassen. Messbar gewonnen: drei leere und zwei schwache von elf gemessenen Tippfehlern finden jetzt ihr Buch, kein Fehlalarm unter 30 gewöhnlichen Anfragen, eine Anfrage mehr nur im Bedarfsfall.
2. **Autorensuche (gebaut):** so lassen; der Link „More by …" zeigt jetzt ihre Bücher statt einer Freitextsuche (Harper Lee 16 von 16 statt 3 von 18).
3. **Sprach-Pillen: entfernen** und `?lang=` nur noch als Wunsch für die Detailseite weitertragen. Begründung: English ist ohne Wirkung, die übrigen Pillen machen in 7 von 112 Fällen eine leere und in 15 eine andere erste Karte, und was sie versprechen (Cover in einer Sprache) liefert die Trefferliste nicht. **Von Julian so entschieden und gebaut (§6.1).**
4. **Nebenbei gebaut:** die Suchroute zieht keinen Token mehr aus dem `google`-Eimer (sie kann Google nicht fragen).

## 6. Offene Fragen an Julian

1. **Sprach-Pillen — entschieden 2026-09-27, (a):** entfernt. Die Suche filtert nicht mehr nach Sprache (die Route liest `lang` nicht); ein vorhandenes `?lang=` bleibt in der Adresse, reist mit den Karten auf die Detailseite und wählt dort den ersten Reiter. Geprüft bei 390 und 1280 px: eine Chipzeile (nur noch „Titles & authors · Author only"), kein Überlauf; `/?q=gravity's rainbow&lang=it` zeigt jetzt 12 Werke statt „No books found", die Karte führt auf `/book/OL2636675W?…&lang=it`.

**Die Punkte 2, 3, 5 und 6 stehen wie gebaut, bis Julian etwas anderes sagt** (keine Mindestausgaben in der Autorensuche, 10-%-Regel für gleichnamige Datensätze, keine aus Besuchen gelernte Wortliste, keine Umschrift-Tabelle). **Punkt 4 bleibt offen.**
2. **Mindestausgaben in der Autorensuche:** die Reihe unter der Wand verlangt `max(2, 2 %)` des größten Werks. In der Liste hieße das: Harper Lee 3 statt 16 Werke, Margaret Mitchell **1** statt 15, Kafka 9 statt 22, Tolkien 42 statt 46. Vorschlag: keine Schwelle (jetzt gebaut), die Einzelausgaben stehen ohnehin hinten. Alternative: Datensätze mit einer einzigen Ausgabe weglassen.
3. **Mehrere Datensätze einer Person:** 10 % der Leser holt *Nineteen Eighty-Four* in Orwells Liste, bringt aber bei Margaret Mitchell ein Kochbuch einer Namensvetterin mit (ihr zweiter Datensatz hat 879 Leser gegen 894, und darunter liegt Fremdes). Schwelle so lassen, höher setzen, oder eine Liste bekannter Zusatzschlüssel pflegen (wie `authors` in `collections.json`)?
4. **Die Reihe „More by …" selbst** fragt weiter nur den Schlüssel des Werks — von *1984* aus also OL15318546A und damit fast nichts. Soll sie dieselbe Namensauflösung bekommen (eine Anfrage mehr je Wand, gecacht)?
5. **Wortliste:** nur was die Seite kennt (Index, Wand, Sammlungen). Soll sie wachsen, etwa um die letzten Suchen aller Besucher? Das wäre eine gespeicherte Angabe über Leser (N11) — Empfehlung: nein.
6. **Umschriften** (`Dostojewski`, `Tschechow`, `Tolstoi`) sind keine Tippfehler; die Autorensuche findet sie über Open Librarys Alternativnamen, die Freitextsuche korrigiert `Dostojewski` zufällig richtig auf „Dostoievski". Eine eigene Umschrift-Tabelle? Empfehlung: erst, wenn Leser danach suchen (3.1).

## 7. Wo was steht

- Code: `lib/spelling.ts`, `lib/lexicon.ts`, `lib/authorsearch.ts`, `lib/search.ts`, `lib/sources/openlibrary.ts` (`searchUrl`, `authorLookupUrl`, `searchAuthorsByName`, `authorWorksUrl` für mehrere Schlüssel), `app/api/search/route.ts`, `components/SearchBar.tsx`, `HomeSearchBar.tsx`, `BookGrid.tsx`, `BookWorkCard.tsx`, `BookDetail.tsx` (Rückweg), `AuthorWorks.tsx` und `lib/authorworks.ts` (Link).
- Tests: `lib/__tests__/spelling.test.ts`, `lib/__tests__/search-overhaul.test.ts`; Fixtures `lib/__fixtures__/search/responses.json`, aufgenommen mit `scripts/record-search-fixtures.ts`.
- Spec: F1.1, F1.2 (Autorensuche ohne Pillen), F1.9, F1.10, N9/N10. Messungen: [Historie](../history.md), Eintrag vom 2026-09-27.
