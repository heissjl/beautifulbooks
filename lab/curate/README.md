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
- **1984 ist ausgeschlossen** (`EXCLUDED` in `serve.ts`), auf Julians Anweisung. Damit sind es 99; das hundertste kommt beim nächsten Bau des Index dazu.

## Bedienung

Klick auf ein Cover wählt es und springt zum nächsten Werk. Pfeiltasten bewegen den Rahmen, Enter wählt, Backspace geht ein Werk zurück. „Überspringen" merkt sich, dass das Werk angesehen und keines gewählt wurde.

## Status

Gebaut am 2026-09-08. Was daraus wird — die Rotation auf der Startseite — ist Roadmap 6.17 und ein eigener Punkt; `data/curated.json` ist die Schnittstelle dorthin.
