# curated-ux — fühlt sich ein kuratiertes Werk besser an als ein beliebiges?

**Frage:** (ROADMAP 6.26) Lädt die Buchseite eines kuratierten Werks — Signaturen im Index, 18 davon vorgerendert — messbar schneller zur ersten Kachel und zur fertigen Wand als die eines beliebigen populären Werks? Wenn ja, lohnt mehr Vorrechnen (etwa `generateStaticParams` über alle 155); wenn nein, liegt es nicht am Index, und 6.26 löst sich in 6.25/6.73 auf.

**Maß:** je Werk, Breite (390 × 844, 1280 × 800) und Besuch (kalt: erster Aufruf nach `next start`; warm: zweiter): Millisekunden bis zur ersten Kachel mit geladenem Bild, bis die Wand steht (Kachelzahl 2 s unverändert und alle Bilder da oder keine `/api/works`-Anfrage mehr offen), Kacheln ohne Bild nach 10 s. Drei Gruppen zu je N Werken: vorgerendert, kuratiert ohne Vorrender, populär und nicht kuratiert (`data/popular-works.json`).

**Status:** gebaut und gelaufen 2026-10-18 gegen den lokalen Build; Zahlen in docs/history.md.

```
npx tsx lab/curated-ux/measure.ts http://localhost:3102 [--works 6] [--json]
```

Headless Chrome über `lab/video/screen/cdp.ts`; nie gegen die Produktion (die Adresse wird abgewiesen). Der Server fragt Open Library je Ausgabenseite einmal und behält die Antwort — der kalte Besuch misst Seite plus Katalog, der warme die Seite. Nacheinander, mit Pausen (umgang §1).
