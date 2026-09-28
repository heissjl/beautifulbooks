# lab/walls — die eigene Cover-Wand, ohne Konto

Roadmap 5.13, Plan [PLAN-5.13-wand-funnel.md](../../docs/plans/PLAN-5.13-wand-funnel.md) (Stufe 1 von dreien: kuratieren → kaufen → rahmen). Julian, 2026-09-28: „first users need to be able to curate collections, so they need a way to save them, i don't want proper logins, but maybe we can use something similar to the way that taketest.xyz does".

```bash
npx tsx lab/walls/serve.ts                       # dann http://localhost:4325
WALLS_FILE=/tmp/w.json npx tsx lab/walls/serve.ts  # beim Testen: nicht in lab/walls/walls.json schreiben
```

## Die Frage

Kann ein Leser eine Wand aus Covern zusammenstellen, sie behalten, teilen und auf einem anderen Gerät weiterbearbeiten — ohne Konto, und ohne dass die Seite etwas über ihn speichert (N11)?

**Erfolg:** Anlegen, Wählen, Ordnen, Teilen und der Umzug auf ein anderes Gerät funktionieren im Browser; ein fremder Link kann nichts ändern; der Server hält keinen Schlüssel im Klartext.

## Wie es funktioniert

- **Schlüssel je Wand, nicht je Besucher.** taketest.xyz legt eine Besucher-ID in ein Cookie und zeigt sie zum Kopieren; das wäre hier eine Kennung (N11). Stattdessen hat jede Wand eine öffentliche Id und einen 128-Bit-Bearbeitungsschlüssel. Der Server speichert nur `sha256(schlüssel)` (`model.ts`, `keyOpens` mit `timingSafeEqual`).
- **Drei Wege zum Schlüssel:** `localStorage` in diesem Browser; der Bearbeitungslink `/w/<id>#k=<schlüssel>` (Fragment, erreicht nie einen Server und wird sofort aus der Adresse genommen); der **Schlüsselbund** unten auf der Seite — eine Zeile `bbw1.<id>.<key>~…`, die alle Wände dieses Browsers auf ein anderes Gerät bringt, taketests Fußzeilenfeld.
- **Operationen statt ganzer Wände** (`add`, `remove`, `move`, `title`, `columns`), wie die Entwürfe aus 5.10b. Der Server nimmt eine Kachel nur in der Form, die er selbst baut (`validTile`): Werk- und Cover-Id per Muster, ISBNs per Muster, Längen gekappt, höchstens 60 Cover.
- **Jede Kachel trägt ihre Drucke** (bis zu fünf: ISBN, Verlag, Jahr) — die Einkaufsliste `/api/walls/<id>/list` ist der Eingang von Stufe 2. E-Book-Drucke fallen weg (E21).
- **Nur Open Library, nie Google** (lab-Regel 6): eine Suche je Anfrage, bis zu drei Ausgabenseiten je geöffnetem Werk, im Speicher gecacht.

## Dateien

| Datei | |
|---|---|
| `model.ts` | Wand, Schlüssel, Operationen, Schlüsselbund, Einkaufsliste — rein, getestet |
| `covers.ts` | Ausgaben → wählbare Cover mit ihren Drucken — rein, getestet an der Gatsby-Fixture |
| `serve.ts` | lokaler Server, Speicher `walls.json` (git-ignoriert) |
| `index.html` | die ganze Oberfläche |

## Status

**Gebaut und durchgespielt am 2026-09-28** ([Historie](../../docs/history.md)): 13 Tests; im Browser Anlegen → zwölf Cover aus zwei Werken → sechs Spalten → ohne Speicher schreibgeschützt → per Bearbeitungslink und per Schlüsselbund wieder bearbeitbar; per `curl` 403 ohne und mit falschem Schlüssel; 390 px ohne Überbreite. **12 von 12 Kacheln tragen eine ISBN.**

**Was auf der Seite anders sein muss** (5.13a): die Auswahl faltet hier nicht — dasselbe Motiv kann zweimal auf die Wand. Auf der Seite gehört „Add to my wall" deshalb an die gefaltete Wand der Buchseite, nicht in einen eigenen Picker.
