# n14 — die N14-Messung als Befehl

**Frage:** Steht eine Seite bei 390 × 844 und 1280 × 800 ohne abgeschnittene Zeilen, mit Platzhaltern, die in ihr Feld passen, ohne seitliches Scrollen und ohne leere Bilder? (SPEC N14, Methode aus ROADMAP 6.30, 2026-09-11.)

**Maß:** je Breite die Zahl der abgeschnittenen Textzeilen (`scrollWidth > clientWidth` oder `scrollHeight > clientHeight` bei `overflow ≠ visible`) mit den ersten Texten, je Eingabefeld die Breite des Platzhalters in der Schrift des Felds (Canvas) gegen den Platz im Feld, `scrollWidth` des Dokuments gegen `innerWidth`, Bilder und leere Bilder.

**Status:** gebaut 2026-10-18 (ROADMAP 6.40); der Skill `/messen <url>` ruft es auf.

```
npx tsx lab/n14/measure.ts http://localhost:3000/ [--widths 390,1280] [--wait 8000] [--json]
```

Gegen den Dev-Server, nie gegen die Produktion (eine Adresse mit `buyitscovers.com` wird abgewiesen, `--production-once` ist die eine Ausnahme nach einem Deploy). Headless Chrome über `lab/video/screen/cdp.ts`; die Telefonbreite kommt über `Emulation.setDeviceMetricsOverride`, weil Chrome unter 500 px sonst nichts layoutet (docs/umgang.md §6). Die Startseite vom 2026-09-11 (6.30) ist der Prüfstein: 0 abgeschnittene Titel bei 390, Platzhalter passt.

**`shot.ts` (2026-10-27, 6.110f):** `npx tsx lab/n14/shot.ts <url> <out.png> [--width 1280] [--height 800] [--scheme light|dark] [--wait ms] [--click <js>] [--after ms]` — ein Screenshot in voller Auflösung (Pixelverhältnis 2) aus demselben headless Chrome, hell oder dunkel, auf Wunsch nach einem Klick (ein JS-Ausdruck, der klickt). Der Browser-Bereich der Desktop-App skaliert 1280 px auf 800 × 500 herunter, zu klein für ein Urteil über ein Layout. Nur gegen den Dev-Server.

