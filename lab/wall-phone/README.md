# wall-phone — die Wand am Telefon, gemessen (ROADMAP 6.73)

**Frage:** Woran liegt es, dass am Telefon Kacheln und Mosaike sekundenlang grau bleiben — an unserer `/img`-Route, am Cover-Host (archive.org) oder am Browser? Und greift `loading="lazy"`? Erst mit den Zahlen wird entschieden, ob etwas gebaut wird (weniger Bilder vor dem Scrollen, kleinere Größe für hintere Reihen, `priority` für die erste Kachel, ein atmender Platzhalter).

**Maß:** headless Chrome bei 390 × 844 (mobil, DPR 2), gedrosselt auf „Fast 4G“, ohne Scrollen, 15 s je Besuch: Zeit bis der erste Bildschirm voll ist, leere Bilder im Bild nach 5 und 10 s, Bildanfragen vor dem ersten Scrollen gegen Bilder auf der Seite, Wasserfall der ersten 20 Bildanfragen (Start, erstes Byte, Ende, Größe, `/img` oder fremd). „cold“ ist der erste Aufruf seit `next start`, „warm“ der zweite mit geleertem Browser-Cache.

**Status:** gemessen 2026-10-19, Zahlen in docs/history.md.

```
npx tsx lab/wall-phone/measure.ts http://localhost:3102 [--net fast4g|none] [--json]
```

Gegen einen frisch gestarteten `next start` außerhalb der Sandbox (die Route `/img` holt die Bilder von Open Library). Nie gegen die Produktion.
