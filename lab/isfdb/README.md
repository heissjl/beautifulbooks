# lab/isfdb — wer hat das Cover gemacht?

Roadmap 6.50 und 6.52. Julian, 2026-09-25: „make a deep research if there are databases or websites where we can find out something about the cover creators of books" — und für die SF-Sammlungen „i want the cover artist data displayed on the wall itself".

## Die Frage

Für wie viele Cover, die die Seite zeigt, nennt ISFDB einen Umschlagkünstler — genau für diesen Druck, ohne Zweifel?

## Wie

- `parse.ts` liest ISFDBs `getpub.cgi?<ISBN>` (XML, ein `<Publication>` je Druck) und entscheidet mit `coverCredit`, ob eine Angabe gezeigt werden darf: nur wenn alle Drucke unter der ISBN, die einen Künstler nennen, dieselben nennen; Bildagenturen („Shutterstock") zählen nicht. Getestet mit einer aufgezeichneten Antwort in `__fixtures__/`.
- `measure.ts` misst an den ISBNs der Sammlungen und an 40 Werken des Index (bis fünf Cover je Werk). Zwei Sekunden zwischen den Anfragen, Antworten in `cache.json` (git-ignoriert); ein 403, 5xx oder Zeitlimit zählt als Fehlschlag, nie als „kein Künstler" (N12).
- `credit-collections.ts` schreibt die Angaben in `data/collections.json` für Sammlungen mit `coverCredits: 'isfdb'` und findet dafür je Kachel die ISBN des gezeigten Drucks.

```bash
npx tsx lab/isfdb/measure.ts
npx tsx lab/isfdb/credit-collections.ts sf-masterworks sf-masterworks-relaunch
```

## Status

Gemessen am 2026-09-25, Zahlen in der Historie. Lizenz der ISFDB-Daten: CC BY 4.0 (Namensnennung an der Angabe).
