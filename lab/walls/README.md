# lab/walls — die eigene Cover-Wand, ohne Konto

Roadmap 5.13, Plan [PLAN-5.13-wand-funnel.md](../../docs/plans/PLAN-5.13-wand-funnel.md) (Stufe 1 von dreien: kuratieren → kaufen → rahmen). Julian, 2026-09-28: „first users need to be able to curate collections, so they need a way to save them, i don't want proper logins, but maybe we can use something similar to the way that taketest.xyz does".

```bash
npx tsx lab/walls/serve.ts                       # dann http://localhost:4325
WALLS_FILE=/tmp/w.json npx tsx lab/walls/serve.ts  # beim Testen: nicht in lab/walls/walls.json schreiben
```

## Die Frage

Kann ein Leser eine Wand aus Covern zusammenstellen, sie behalten, teilen und auf einem anderen Gerät weiterbearbeiten — ohne Konto und ohne Passwort, wie bei taketest.xyz?

**Erfolg:** Anlegen, Wählen, Ordnen, Teilen und der Umzug auf ein anderes Gerät funktionieren im Browser; ein fremder Besucher kann nichts ändern; der Server hält die Besucher-ID nicht im Klartext.

## Wie es funktioniert

- **Eine Besucher-ID wie bei taketest.xyz** (E22; Julian hat N11 dafür aufgehoben). Die erste Wand setzt das Cookie `bb_visitor` mit 128 Zufallsbits; wer nur schaut, bekommt keins. Die Fußzeile zeigt die ID mit „Save“ — auf einem anderen Gerät eingefügt, gehören dort dieselben Wände dazu.
- **Der Server speichert je Wand nur `sha256(id)`** (`model.ts`, `isOwner` mit `timingSafeEqual`); eine gelesene Speicherdatei verrät nicht, wem eine Wand gehört. Schreiben nur als JSON, das Cookie ist `SameSite=Lax`.
- **Operationen statt ganzer Wände** (`add`, `remove`, `move`, `title`, `columns`), wie die Entwürfe aus 5.10b. Der Server nimmt eine Kachel nur in der Form, die er selbst baut (`validTile`): Werk- und Cover-Id per Muster, ISBNs per Muster, Längen gekappt, höchstens 60 Cover.
- **Jede Kachel trägt ihre Drucke** (bis zu fünf: ISBN, Verlag, Jahr) — die Einkaufsliste `/api/walls/<id>/list` ist der Eingang von Stufe 2. E-Book-Drucke fallen weg (E21).
- **Nur Open Library, nie Google** (lab-Regel 6): eine Suche je Anfrage, bis zu drei Ausgabenseiten je geöffnetem Werk, im Speicher gecacht.

Die erste Fassung (Schlüssel je Wand, Bearbeitungslink, Schlüsselbund; N11-treu) liegt in Commit `d34218c`.

## Dateien

| Datei | |
|---|---|
| `../../lib/walls/` | Modell und Besitzer liegen seit dem MVP (5.13a) in `lib/walls/`; das Lab importiert sie von dort |
| `covers.ts` | Ausgaben → wählbare Cover mit ihren Drucken — rein, getestet an der Gatsby-Fixture |
| `serve.ts` | lokaler Server, Speicher `walls.json` (git-ignoriert) |
| `index.html` | die ganze Oberfläche |

## Status

**Gebaut und durchgespielt am 2026-09-28** ([Historie](../../docs/history.md)), am selben Abend auf E22 umgebaut: 12 Tests; im Browser keine ID vor der ersten Wand, eine danach; ein Gerät ohne Cookie sieht die Wand schreibgeschützt und bekommt sie per eingefügter ID zurück; per `curl` 403 für eine fremde ID, kein Cookie für bloßes Schauen; 390 px ohne Überbreite. **12 von 12 Kacheln tragen eine ISBN.**

**Das MVP auf der Seite ist gebaut (5.13a, SPEC F9), noch nicht deployt.** Die Auswahl faltet hier nicht — dasselbe Motiv kann zweimal auf die Wand. Auf der Seite gehört „Add to my wall“ deshalb an die gefaltete Wand der Buchseite, nicht in einen eigenen Picker.
