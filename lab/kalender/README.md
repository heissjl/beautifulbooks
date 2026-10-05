# kalender — der Posting-Kalender (ROADMAP 5.6b)

**Frage:** Was postet Julian wann auf welchem Kanal, und wie greift er ein, ohne dreißig Einträge von Hand zu ändern? Strategie und Begründung: [PLAN-5.6b](../../docs/plans/PLAN-5.6b-organische-reichweite.md); Kanäle, Messung und Schwellen: PLAN-5.5-5.6-kanaele.md.

```bash
npx tsx lab/kalender/serve.ts     # dann http://localhost:4325
```

- `posts.json` ist die einzige Liste: Einträge mit Datum, Kanal, Art, Text, Pfad, Bild, Voraussetzungen und Status (`vorschlag`, `freigegeben`, `gepostet`, `verworfen`), dazu `done`, die erfüllten Voraussetzungen. Von Hand änderbar; das Werkzeug liest sie bei jeder Anfrage neu.
- `model.ts` ist rein: Link mit `?via=<kanal>`, Verschieben, Hinweise (überfällig, zu lang, Wörter gegen Vollständigkeit, Exposé zuerst, Launches eine Woche auseinander, höchstens drei Reddit-Antworten). Tests in `__tests__/`, auch gegen die Datei selbst.
- `serve.ts` und `index.html`: lokal, nur `127.0.0.1`, spricht mit keiner Plattform und keinem Katalog. **Posten bleibt Julians, von Hand** (ROADMAP 5.6). `KALENDER_FILE` zeigt auf eine andere Datei, zum Ausprobieren.

**Erfolg:** Julian postet nach dem Kalender und ändert ihn im Werkzeug statt in der Datei; nach acht Wochen sagt K14, welche Kanäle tragen.

**Stand 2026-10-04:** gebaut, 70 Einträge (davon sieben Gestalter-Galerien, PLAN-5.6b §4a) vom 5.10. bis 1.12.2026, nichts gepostet; im Browser geprüft (Karte öffnen, freigeben, Voraussetzung abhaken, einen Kanal um eine Woche verschieben).

**Bilder:** `python3 lab/kalender/render_gemeinfrei.py` rendert das Instagram-Karussell und den ersten Pin aus fünf gemeinfreien Einbänden nach `out/` (git-ignoriert, Cache unter `out/cache`). Grundlage: docs/plans/research-gemeinfreie-cover.md.
