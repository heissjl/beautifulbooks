# apple-books — Apple Books als dritte Bildquelle?

ROADMAP 6.93 (Julian, 2026-10-06: „können wir die apple book API benutzen?“, dann „ja, bau den lab-Versuch“).

## Frage

Wie viele Cover brächte Apple Books (iTunes Search API, `media=ebook`, ohne Schlüssel) zu den fünf Prüfwerken aus SPEC §3 F1, **die nach der Faltung der Wand neu bleiben** — und wie sehen sie aus?

## Messung

`npx tsx lab/apple-books/measure.ts`

1. Je Werk alle Ausgabenseiten von Open Library (bis 1500 Datensätze wie die Seite), Cover über den Parser der Seite (`parseEditions`, `assembleEditions`).
2. Apple-Suche im US-, UK- und deutschen Store, je mit Werktitel + Nachname und mit jedem Alias. Zuordnung in `itunes.ts`: Nachname des Autors unter den Personen, normalisierter Titel gleich (ein Autorenname im Titel wird abgezogen). Ein Treffer über einen **Alias** (`1984`, deutscher Titel) ist getrennt gezählt, weil die Seite keine solche Liste hat.
3. Signaturen für alle Bilder (`signatureFor`, mit Farbe), dann `foldDuplicateCovers` über beide. Ein Apple-Cover in einer Gruppe ohne Open-Library-Cover ist **neu**.
4. Ausgabe: `out/results.json`, `out/sheet.html` (neue Cover; gefaltete als Paar Apple ↔ Wand). **Erst das Blatt ansehen**, dann den Zahlen glauben.

Takt: Open Library eine Anfrage nach der anderen, 1,5 s Pause; Apple 4 s (Grenze etwa 20 pro Minute). Alles unter `out/` gecacht (git-ignoriert). Kein Google.

Grenzen der Messung: Apple-Bilder haben weder ISBN noch Verlag noch Sprache, also greifen nur die Faltstufen „≤ 8 immer“ und „≤ 13 bei Design und gleicher Farbwelt“ — ein Apple-Cover, das ein Scan desselben Umschlags mit Abstand 14–20 ist, zählt als neu. Ein Open-Library-Cover ohne Signatur faltet nicht.

## Stand

Gebaut 2026-10-06, 7 Tests (`__tests__/itunes.test.ts`).

**Erster Lauf 2026-10-06, nur gegen die aufgezeichneten Seiten** (`--fixtures`): `openlibrary.org` verweigerte diesem Mac an diesem Vormittag jede Verbindung (`ECONNREFUSED`, curl ebenso; `covers.openlibrary.org`, archive.org und Apple antworteten) — bevor das Skript eine einzige Antwort bekommen hatte. Die Wand ist also je Werk nur die erste Seite (Gatsby: drei Seiten, 300 Datensätze); bei *1984* liegen dahinter noch viele Seiten, dort ist „neu“ zu hoch. 45 Apple-Anfragen, kein Google.

| Werk | OL-Cover (gehasht) | Wand nach Faltung | Apple zugeordnet (davon Alias) | neu (davon Alias) | gefaltet |
|---|---|---|---|---|---|
| Mumbo Jumbo | 10 (10) | 9 | 4 (0) | 4 (0) | 0 |
| Nineteen Eighty-Four | 22 (22) | 21 | 140 (120) | 110 (92) | 6 |
| Gravity's Rainbow | 27 (26) | 22 | 3 (2) | 1 (1) | 1 |
| The Great Gatsby | 123 (123) | 101 | 129 (28) | 108 (22) | 17 |
| Pride and Prejudice | 65 (65) | 60 | 161 (46) | 145 (37) | 6 |

Angesehen auf dem Blatt (Server: `cd lab/apple-books/out && python3 -m http.server 4331`, die Bilder laden erst beim Scrollen):

- **Mumbo Jumbo**: vier echte Verlagscover, die die Wand nicht hat (u. a. Penguin Modern Classics, die Ausgabe zum 50. Jubiläum) — der klare Gewinn.
- **Gemeinfreie Werke** (Gatsby, Pride and Prejudice, *1984* in Europa): die Masse der „neuen“ Cover sind E-Books kleiner Anbieter — Art-déco-Vorlagen, Stockfotos, Sammelbände. Echte Verlagsausgaben stehen dazwischen, sind aber die Minderheit. Ohne Filter würde Apple diese Wände verdoppeln und verwässern.
- **Über den Alias `1984`** kommen viele Übersetzungen (Spanisch, Türkisch, Russisch) und eine Adaption: `1984: The Graphic Novel` wurde zugeordnet, weil `normalizeTitle` hinter dem Doppelpunkt abschneidet — ein Fehler der Zuordnung, den eine Übernahme beheben müsste.
- **Faltung**: 16 der 17 Gatsby-Paare zeigen wirklich denselben Umschlag (Cugats Augen in mehreren Scans und Ausgaben, deutsche Ausgaben mit ihrem Scan). Ein Paar ist falsch: ein gestreiftes Cover von *Der große Gatsby* faltete in ein anderes Design (`ol:10851231`). Apple-Bilder tragen keine Sprache, deshalb faltet auch das gelbe Auto des *Großen Gatsby* mit *Il grande Gatsby* — dasselbe Design, also richtig für die Wand.
- Das einzige neue Cover von *Gravity's Rainbow* (*Die Enden der Parabel*, 1906 laut Apple) lud nicht.

Offen: der volle Lauf gegen Open Library, sobald der Katalog wieder antwortet (ohne `--fixtures`, eine Anfrage nach der anderen); ob sich Verlagsausgaben von Kleinanbietern trennen lassen (Apple nennt keinen Verlag; `artistName` und Preis sind die einzigen Spuren); die Bedingungen.
