# lab/collections — thematische Sammlungen kuratieren

Roadmap 5.10 und 5.10a, SPEC F8. Julian, 2026-09-24: „am besten wir haben eine zweite kuratier-app für diese art von sammlungen, mit der wir verschiedene sammlungen kuratieren können".

```bash
npx tsx lab/collections/serve.ts                 # dann http://localhost:4322
npm run dev                                      # die Seiten: http://localhost:3000/collections
```

## Die Frage

Kann Julian eine Sammlung — die Bücher einer Liste von Autorinnen, oder die Ausgaben einer Verlagsreihe — so schnell füllen wie die Startseite mit `lab/curate/`, ohne dass dabei jemand auf die Wand gerät, den er nicht bestätigt hat?

## Wie es funktioniert

- **Eine Sammlung hat eine Grenze.** Bei `authors` die Autorinnen mit ihren Open-Library-Keys, bei `series` die Verlagsschreibweisen. Die App sucht nur innerhalb der Grenze, und der Server nimmt ein Werk nur, wenn die **erste** Autorin auf der Liste steht (`model.ts`, `upsertPick`). Wer von der Liste genommen wird, verliert ihre Werke auf der Wand. Eine Autorin kommt nur auf die Liste, wenn Julian sie sucht und „hinzufügen" drückt.
- **Kandidaten**: je Autorin die bis zu 40 meistgedruckten Werke (`search.json?q=author_key:…&sort=editions`), je Verlag die Werke mit einer Ausgabe unter dem Namen. Geladen erst beim Aufklappen.
- **Cover**: aus bis zu 600 Ausgaben des Werks (Open Library `editions.json`), mit Jahr und Verlag darunter, bei Autorensammlungen ergänzt um den gebauten Index. Bei einer Reihe nur Cover von Ausgaben, deren Verlagsfeld einer Schreibweise genau entspricht.
- **Nur Open Library, nie Google** (lab-Regel 6). Alles Geholte liegt in `cache.json` (git-ignoriert), ein zweiter Start fragt nichts nochmal.
- **Geschrieben wird nach jeder Änderung** in `data/collections.json`, atomar. Die Reihenfolge der Datei ist die Reihenfolge der Seite. `COLLECTIONS_FILE=<pfad>` lenkt das Schreiben um — beim Testen immer setzen, damit keine Testwahl in Julians Daten landet (die Lehre aus `lab/curate`).
- **Entwurf und veröffentlicht**: ein Häkchen. Ein Entwurf ist nur unter `npm run dev` zu sehen; veröffentlicht erscheint die Sammlung nach dem nächsten Deploy.

## Vorschläge von Freunden (5.10a)

Freunde schlagen auf der Website unter `/suggest` Bücher vor (Passwort `SUGGEST_PASSWORD`). Der Reiter **Vorschläge** holt sie ab:

```bash
SUGGEST_REMOTE=https://beautifulcovers.vercel.app SUGGEST_ADMIN_PASSWORD=… npx tsx lab/collections/serve.ts
```

„Übernehmen" setzt Buch und Cover auf die Wand der Sammlung — bei einer Autorin, die nicht auf der Liste steht, erst nachdem Julian sie oben hinzugefügt hat — und markiert den Vorschlag; „Ablehnen" markiert nur. Vorschläge für eine neue Sammlung werden als „erledigt" markiert, anlegen muss Julian sie selbst. Die Produktion wird nur beim Öffnen des Reiters und bei jeder Entscheidung gefragt, nie in einer Schleife.

## Entwürfe von Freunden (5.10b)

Unter `/curate` bauen Freunde ganze Sammlungen, als Entwürfe in der Redis. Der Reiter **Entwürfe** holt sie ab (dieselben zwei Variablen wie oben) und zeigt je Entwurf die Namen, die gegenüber der Sammlung in der Datei neu sind. „Ersetzen" überschreibt die gleichnamige Sammlung (Wand, Liste, Text; „veröffentlicht" bleibt), „Als neue Sammlung übernehmen" legt eine an (Slug bei Bedarf mit `-2`). Beides veröffentlicht nichts. Die Logik, die beide Werkzeuge teilen, liegt seit 5.10b in `lib/collectionedit.ts`.

## Status

Gebaut und durchgespielt am 2026-09-24 (Historie). Erste Sammlung „Women writers" als Entwurf mit fünf Werken; die Wand füllt Julian.
