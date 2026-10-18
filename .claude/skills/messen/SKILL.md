---
name: messen
description: Die N14-Messung einer Seite bei 390×844 und 1280×800 — abgeschnittene Zeilen, Platzhalter gegen Feld, Seitenbreite, leere Bilder. /messen <url> gegen den Dev-Server.
disable-model-invocation: true
---

# /messen <url>

Misst die Seite `$ARGUMENTS` so, wie 6.30 die Startseite am 2026-09-11 gemessen hat (SPEC N14, ROADMAP 6.40): bei 390 × 844 und 1280 × 800 in einem headless Chrome.

```bash
npx tsx lab/n14/measure.ts $ARGUMENTS
```

Was zurückkommt, je Breite: Seitenbreite gegen Fensterbreite (mehr heißt seitliches Scrollen), die abgeschnittenen Textzeilen mit ihren ersten Wörtern, jeder Platzhalter in Pixeln gegen den Platz im Feld, Bilder und leere Bilder. `--widths 390,1280` und `--wait 8000` lassen sich ändern, `--json` gibt die Rohwerte.

Regeln: gegen `npm run dev` (oder einen lokalen `next start`), nie gegen die Produktion — eine Adresse mit `buyitscovers.com` lehnt das Skript ab, `--production-once` ist die eine Ausnahme nach einem Deploy. Ein Dev-Server aus der Bash hat in der Sandbox kein Netz (umgang.md §10); Seiten, die den Katalog brauchen, misst man gegen einen Server außerhalb. Eine Zahl, die hier steht, gehört in docs/history.md — eine Messung im Chat ist keine.
