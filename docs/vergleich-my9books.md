# Vergleich mit my9books.com (2026-10-05)

Julian, 2026-10-05: „see what buttons, apis, or concepts we can take from https://www.my9books.com/en". Anders als bei my9albums (docs/vergleich-my9albums.md) war die Seite diesmal erreichbar: angesehen im Browser-Fenster der Sitzung — Startseite, Suchfenster, `/en/ranking`, eine Buchseite, eine Autorenseite, `/en/recommend`, ein geteiltes Regal `/en/s/<id>`, der Blog, `robots.txt`; dazu eine Antwort ihrer Such-API mitgelesen. Nichts gespeichert, kein Regal angelegt.

## Was my9books ist

„私を構成する9冊" — „die neun Bücher, aus denen ich bestehe", der japanische Hashtag-Brauch, nach dem die Seite heißt. Neun Plätze im Raster, je Platz ein Buch oder Manga, **je Buch ein Satz dazu** („ひとこと"), ein Name (meist leer: „名前なし"), dann ein Teil-Link `/s/<16 hex>` mit eigener Link-Karte (`/api/og/<id>`). Publikum: japanisch, überwiegend Manga (Platz 1 der Rangliste: *Fullmetal Alchemist 1*, 1.163 Mal gewählt; die ersten 15 sind Manga, dann *Harry Potter*). Die Seite gibt **18.029 Regale** an („Picked for you from 18,029 people's choices"), die Empfehlungsseite „über 16.000 Leser"; der Blog beginnt am 2026-03-04 — die Seite ist also rund sieben Monate alt.

**Technik, soweit sichtbar:** Next.js mit Turbopack (wie wir), auf Vercel (`dpl=`-Parameter). Daten aus der **Rakuten Books API** — nur japanischer Buchhandel; für unsere Märkte US/UK/DE nicht zu gebrauchen. Die eigene Suche `/api/books?q=&sort=standard&page=1` liefert je Treffer ISBN-13 als ID, Titel, Autoren, Datum, Verlag, Klappentext und zwei Bildgrößen (120 und 200 px). Eine Suche nach „Gatsby" brachte kein einziges Gatsby-Buch im Original — Rakuten kennt fast nur japanische Ausgaben. Geld: Amazon.co.jp als **Suchlink nach ISBN** (`/s?k=<ISBN>&tag=…`, nicht `/dp/`) und Rakuten-Affiliate, beide direkt verlinkt, die Amazon-Pflichtformel im Fuß.

## Knöpfe und Flächen, eins nach dem anderen

| Fläche | Was sie tut | Haben wir? |
|---|---|---|
| Neun leere Plätze, „Tap a slot" | Ein Platz öffnet das Suchfenster | ja, 3/6/9 (5.18b) |
| Suchfenster: **Simple / Advanced** | Advanced = drei Felder **Titel, Autor, ISBN** | nein; wir parsen eine Zeile (F1.8) |
| Sortierung im Suchfenster | **Relevance · Newest first · Oldest first · Best sellers** | nein |
| **„Can't find it? Add by title"** | Buch ohne Katalogtreffer von Hand anlegen | nein |
| Je Buch ein Satz | Steht auf dem geteilten Regal unter jedem Buch und auf der Buchseite gesammelt („Was die sagen, die es gewählt haben") | **nein** |
| Name | frei, leer erlaubt | ja (`by`, `cleanName`) |
| Geteiltes Regal `/s/<id>` | Bücher mit Satz, je Buch **Amazon · Rakuten · Related**; darunter „Picked for you" (sechs Empfehlungen aus allen Regalen) und **„People with similar taste — 3 in common"** (Regale anderer mit Überschneidung); unten „What are your 9 books? → Create your bookshelf" | Kacheln → Buchseite, Kaufliste, „Take your Shelf-Portrait"; **keine Empfehlungen, keine Nachbarn** |
| **Popular** `/ranking` | Die 50 meistgewählten Titel mit „Chosen by N people" und beiden Kauflinks | nein |
| **Buchseite** `/book/<isbn>` | „Für Leute, die X mögen": wie oft gewählt, **„12 % derer, die X wählten, wählten auch Y"**, die Sätze der Wähler, die zwölf häufigsten Mitwahlen mit Anzahl, Regale, die das Buch enthalten | Buchseite ja, aber ohne all das |
| **Autorenseite** `/author/<id>` | Wie oft Werke des Autors gewählt wurden (je Band), Mitwahlen | nein |
| **Find Similar** `/recommend` | Ein Buch wählen → Mitwahlen; mit drei FAQ-Fragen darunter | nein |
| Blog | Fünf Artikel an einem Tag: wie man wählt, was der Trend ist, Rangliste als Text, Genres, Anleitung | FAQ unter dem Brett (Entwurf) |
| Zweisprachig ja/en | Umschalter im Fuß | ja, en/de (E23) — Shelf-Portrait noch nur englisch |

**Indexierung (`robots.txt`):** gesperrt sind `/api/`, **die ganze englische Fassung `/en/`** und die Autorenseiten; offen sind die japanischen Buchseiten, Rangliste, Empfehlungen, Blog und die geteilten Regale. Das Geschäft mit der Suchmaschine sind also **die Buchseiten auf Japanisch**, betitelt „「X」好きにおすすめの本・マンガ" — „Bücher für Leute, die X mögen". Jede ist aus den Regalen der Nutzer gefüllt, nicht aus Modellprosa.

## Was davon trägt, und was es für uns heißt

1. **Der Satz je Buch ist der stärkste Inhalt.** Er macht aus einem Raster eine Person („Der Grund, warum ich Otaku wurde"), und er füllt die Buchseiten mit Text, den kein Modell geschrieben hat. Bei uns: das Brett liegt in der Adresse; neun freie Sätze passen nicht hinein, sie gehörten in den Kurzlink im Store. Das ändert, was ein Kurzlink speichert — **der Satz in der Datenschutzerklärung, den Julian am 2026-10-05 freigegeben hat, müsste neu** (CLAUDE.md, 5.18b). Dazu kommt Moderation: freie Sätze, öffentlich, dann womöglich auf Buchseiten. Wert hoch, Entscheidung Julians.
2. **Zählen ist der zweite Hebel, und er braucht Masse.** „Chosen by N people", die Rangliste, „X % wählten auch Y", „People with similar taste" und „Find Similar" sind alle **eine** Auswertung: die Mitwahl-Tabelle über alle gespeicherten Bretter. Unsere Kurzlinks (`insp:link:<id>`) sind genau diese Bretter, ohne Besitzer und ohne Besucher-ID — eine Zählung daraus fügt keine Kennung hinzu (N11 bleibt). Aber: Bretter, die nur als lange Adresse existieren, zählen nicht mit, und unter ein paar hundert Brettern sagt eine Mitwahl nichts (bei my9books trägt sie erst mit 18.000). **Auslöser statt Termin:** wenn der Store einige hundert Kurzlinks hält, einmal auszählen und ansehen, ob die Paare etwas sagen.
3. **Unsere Buchseite könnte so eine Landeseite werden** — „Auf Shelf-Portraits mit diesem Buch auch: …" — aus Punkt 2 gespeist, also echte Daten statt erfundener Rangfolgen (ROADMAP 5.4 hat „Die 10 schönsten Cover von X" genau deshalb gestrichen). Und **unser Zusatz, den sie nicht haben können:** welche *Ausgabe* gewählt wurde. „Die meisten wählten dieses Cover" ist eine Aussage, die nur diese Seite machen kann, und passt zu den Daten des Cover-Spiels (5.8b).
4. **Suchfeld mit ISBN.** Wer sein Buch in der Hand hält, tippt die ISBN ab — das trifft genau die Ausgabe und erspart die Ausgabenwahl. Open Library kann nach ISBN suchen; für den Picker reicht, eine Eingabe aus 10 oder 13 Ziffern als ISBN zu erkennen, ohne drittes Feld. Billig.
5. **„Can't find it? Add by title".** Bei uns ist das Cover der Sinn; ein Buch ohne Cover in Open Library ist aber eine Lücke, die der Leser sonst als Fehler sieht. Eine Kachel aus Titel und Autor (typografisch, im Stil der Seite) statt nichts — mit dem Hinweis aus dem FAQ, dass man Open Library selbst ergänzen kann.
6. **Sortierung im Suchfenster** (neueste/älteste) hilft bei Werken mit vielen Ausgaben, aber unsere Ausgabenwahl ist schon nach Werk gruppiert; „Best sellers" hätten wir nur als Open-Library-Leserzahl. Niedrig.
7. **Amazon als Suchlink nach ISBN** landet immer, auch ohne ISBN-10 und wenn die Ausgabe vergriffen ist; `/dp/` landet auf der genauen Ausgabe oder auf einer Fehlerseite. Wir bleiben bei `/dp/` (das Urteil am Kauflink setzt die genaue Ausgabe voraus), aber der Suchlink ist ein möglicher Rückfall, wenn `/dp/` nicht auflöst — gehört zu 4.x, nicht hierher.
8. **Indexierung:** sie indexieren die geteilten Regale und die Buchseiten, sperren die Zweitsprache. Für 5.18b (4) — ob Shelf-Portraits indexiert werden — heißt das: das Regal selbst ist dünner Inhalt, solange es keine Sätze trägt; mit Sätzen wird es eine Seite. Die Entscheidung hängt also an Punkt 1.
9. **Blog/Anleitung:** fünf Artikel an einem Tag, offensichtlich für die Suchmaschine. Bei uns hieße das Modellprosa — gegen die Regel „Weniger nach Claude aussehen". Höchstens das FAQ als eigene, indexierbare Seite, wenn Julian es gekürzt hat.

**Nicht zu übernehmen:** Rakuten (nur Japan); die Zählung „Chosen by N people" vor ausreichender Masse (eine „2" auf einer Buchseite wirkt schlechter als nichts); eine Nachbarliste „People with similar taste", solange Bretter keinen Namen tragen müssen — 8 von 8 Regalen auf der Buchseite hießen „名前なし", die Liste zeigt dann nur „Anonymous".

## Vorschlag

Drei Punkte für Julian, in dieser Reihenfolge:

1. **ISBN im Suchfeld des Editors** erkennen (und im Picker der Sammlungen) — Claude, ohne Entscheidung, klein.
2. **Ein Satz je Buch** auf dem Shelf-Portrait — Julian entscheidet: Speichern im Kurzlink, neuer Satz in der Datenschutzerklärung, Moderation (wer löscht, wie schnell; 5.18b (6) fehlt schon heute ein Werkzeug zum Löschen).
3. **Mitwahlen auszählen**, wenn der Store einige hundert Kurzlinks hält — erst ansehen, dann über Rangliste und einen Abschnitt auf der Buchseite entscheiden; die gewählte Ausgabe mitzählen.
