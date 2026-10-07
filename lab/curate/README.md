# lab/curate — ein Cover und ein Jahr für jedes der hundert Werke

Roadmap 6.18. Julian, 2026-09-08: „ich will gute Cover für alle 100 festlegen können … kannst du eine lokale Mini-App erstellen, in der ich mich da schnell durchklicken kann?"

```bash
npx tsx lab/curate/serve.ts      # dann http://localhost:4321 öffnen
```

## Die Frage

Kann ein Mensch in einer Sitzung für hundert Bücher je ein Cover wählen, ohne dass die App im Weg steht? Das Maß ist die Zeit je Buch und dass nichts verloren geht, wenn man abbricht.

## Wie es funktioniert

- **Die Cover kommen aus `data/cover-index.json`**, dem gebauten Index (E18): 10.362 Cover zu 100 Werken, mit ihren IDs. Für die Liste geht **keine einzige Anfrage** hinaus; nur die Bilder des gerade gezeigten Werks lädt der Browser von Open Library, und die kommen aus dessen CDN.
- **Google Books wird nie gefragt** (lab-Regel 6).
- **Das Jahr** wird je Werk einmal bei Open Library geholt (`first_publish_year` plus die Liste aller Jahre) und in `lab/curate/years.json` zwischengespeichert. Angezeigt wird beides: was der Katalog sagt und was die Ausreißerprüfung aus `lib/firstyear.ts` daraus macht — bei *Lolita* etwa 1777 gegen 1954. Das Feld ist vorbelegt und wird von Hand bestätigt oder korrigiert; leer heißt „nicht geprüft", nicht „unbekannt".
- **Geschrieben wird nach jeder Wahl** in `data/curated.json`, atomar (erst `.tmp`, dann umbenannt). Abbrechen ist folgenlos, die App springt beim nächsten Start zum ersten offenen Werk.
- **Vorschläge**: `npx tsx lab/curate/suggest.ts` sucht neue Bücher über unsere eigene Suche (Open Library, nie Google — lab-Regel 6), wirft alles weg, was die Liste schon kennt oder gestrichen wurde, deckelt auf zwei je Autor und schreibt `lab/curate/suggestions.json`. Jeder Vorschlag bringt die Zahlen mit, die für ihn sprechen (Ausgaben, Leser, Jahr); die App zeigt sie neben dem Titel. Ihre Cover werden **nicht beim Start** geholt, sondern nach und nach: der Server holt den Rest im Hintergrund, eines je 1,2 Sekunden, und der Browser zieht die nächsten drei Werke vor. Wer weiterklickt, wartet also nicht (Julian, 2026-09-09). Was geholt wurde, liegt in `extra-covers.json` und ist beim nächsten Start schon da.
- **Nachzügler**, die der Index nicht kennt, stehen in `EXTRA_WORKS` in `serve.ts` und bekommen ihre Cover einmal von Open Library: *The Garden of Eden* (7 Cover), *East of Eden* (78), *Stoner* (54). Sie stehen am Ende des Durchlaufs.
- **1984 ist ausgeschlossen** (`EXCLUDED` in `serve.ts`), auf Julians Anweisung. Damit sind es 99; das hundertste kommt beim nächsten Bau des Index dazu.

- **Größe je Cover** (seit 2026-10-07, Julian: „ändere die app so, dass ich weiß ob die cover L, M oder S größe haben und stelle die L vorne an"). Jedes Open-Library-Cover gibt es als `-S`, `-M` und `-L`, aber aus einem kleinen Scan wird kein großes Bild: `-L` ist dann nur das Original. Gemessen am 2026-10-07 an zwei Covern: L passt in 500 × 500, M ist 180 breit, S 58 hoch. Eine Kachel trägt deshalb **L**, wenn die längere Seite des Originals 500 px erreicht, **M** ab 180 breit oder 360 hoch, sonst **S**, und **?**, wenn der Datensatz keine Größe nennt; der Tooltip nennt die Pixel. Die Größe kommt aus dem Datensatz des Covers (`covers.openlibrary.org/b/id/<n>.json`), nicht aus dem Bild — `/api/sizes` benutzt dafür `CoverSizes` aus `lab/calibre/download.ts` und **teilt dessen Cache** (`~/Library/Application Support/BuyItsCovers/calibre/cover-sizes.json`). Der Server antwortet nach höchstens acht Sekunden mit dem, was er hat, und nennt die Zahl der noch laufenden Fragen; die Seite fragt nach, bis keine mehr läuft, und **stellt die Cover dann einmal um**: L, M, S, ?, innerhalb einer Klasse in Open Librarys Reihenfolge. Danach rutscht nichts mehr. Die nächsten drei Werke werden mit vorgeladen. Gemessen: ein kaltes Werk mit 125 Covern in 0,7 s, aus dem Cache in 0,01 s.

## Drei Ansichten

**Kuratieren** — ein Werk je Bildschirm, alle seine Cover, Wahl und Jahr. Unten steht alles, was schon angesehen wurde: anklicken springt zurück, das × streicht das Buch.

**Reihenfolge** — dieselbe Auswahl als Wand, links im **Sechser-Raster wie am Rechner**, rechts daneben im **Dreier-Raster wie auf dem Telefon**, beide in derselben Reihenfolge. Ziehen im linken Raster sortiert um, und eine gestrichelte Linie zeigt, wo die achtzehn aufhören, die es auf die Startseite schaffen. Damit lässt sich sehen, was sonst nur zu ahnen ist: dass zwei helle Cover nebeneinander sich gegenseitig löschen, und dass die zweite Reihe am Telefon eine andere ist als am Rechner.

**Offen** (seit 2026-09-24, Julian: „dass ich leichter durch die liste scrollen kann von denen, die ich noch nicht kuratiert hab") — alle Werke ohne Wahl als Raster zum Durchscrollen, mit Cover, Titel, Autor und Zahl der Cover; übersprungene stehen mit dabei und sind markiert, gestrichene nicht. Ein Klick springt in die Kuratieren-Ansicht auf genau dieses Buch. Darunter stehen die **gestrichenen** Werke, und ein Klick holt eines als offenes zurück — bis zum 2026-09-24 war ein Strich nur durch Editieren der Datei umkehrbar, was auffiel, als Julian *Mrs. Dalloway* wiederhaben wollte, die er am 2026-09-08 gestrichen hatte. Die Zahl im Reiter sagt, wie viele offen sind, und in der Kuratieren-Ansicht führt „nächstes offenes" von hier aus weiter, ohne die gewählten durchzublättern.

**Die Reihenfolge der Datei ist die Reihenfolge der Wand.** `lib/curated.ts` liest `data/curated.json` von oben nach unten; was hier gezogen wird, steht nach dem nächsten Deploy so auf der Startseite.

## Bedienung

Klick auf ein Cover wählt es und springt zum nächsten Werk. Pfeiltasten bewegen den Rahmen, Enter wählt, Backspace geht ein Werk zurück. „Überspringen" merkt sich, dass das Werk angesehen und keines gewählt wurde.

## Was beim ersten Durchgang herauskam (2026-09-08)

35 Werke angesehen, 30 Cover gewählt, fünf übersprungen — rund zwanzig Sekunden je Buch. Ein harter Neustart des Servers kostete nichts: alle Einträge lagen da, die App sprang zum ersten offenen Werk.

**Offen und wichtig:** ein Test gegen die laufende App schreibt in dieselbe Datei wie ein Mensch. Beim ersten Durchgang sind so zwei erfundene Wahlen in Julians Daten gelandet und mussten von Hand entfernt werden. Die Datei gehört hinter eine Umgebungsvariable (`CURATE_FILE`), bevor das nächste Mal jemand gegen die App testet.

## Die Saatrunden

`suggest.ts` hat drei: die erste vom 2026-09-09 (50 Vorschläge quer durch die Literatur), dann zwei vom 2026-09-24 auf Julians Bitte — **zwanzig Werke von Autorinnen des 20. Jahrhunderts**, danach **zehn weitere aus dem 20. und zehn aus dem 21.** Die neueste Runde läuft zuerst, damit ein `--target` ihre Bücher kauft und nicht die der alten Liste.

Zwei Dinge, die dabei auffielen und beim nächsten Mal Zeit sparen:

1. **Der Abgleich vergleicht Titel.** Wo Open Library ein Buch unter einem anderen Titel führt als die Saat — *The Lover* als `L'Amant`, *Memoirs of Hadrian* als `Mémoires d'Hadrien`, das Tagebuch als `Het Achterhuis` —, findet das Skript nichts Sicheres. Solche Werke stehen mit von Hand nachgeschlagener ID in `NAMED_EXTRAS` in `serve.ts`.
2. **Ein `--target` wird aufgefüllt.** Bleiben von der neuen Runde Plätze übrig, nimmt das Skript sie aus der alten Liste — beim ersten Lauf kamen so fünf Bücher von Männern in eine Runde, die nach Autorinnen gefragt hatte. Sie wurden wieder entfernt; wer eine thematische Runde fährt, liest den Schluss des Laufs.
3. **Nicht in `head` pipen.** Ein `| head -20` schließt die Pipe, das Skript stirbt an SIGPIPE, bevor es die Datei schreibt — ein Lauf von zehn Minuten war damit umsonst (2026-09-24). In eine Datei schreiben und die lesen.

## Status

Gebaut am 2026-09-08. Was daraus wird — die Rotation auf der Startseite — ist Roadmap 6.17 und ein eigener Punkt; `data/curated.json` ist die Schnittstelle dorthin.
