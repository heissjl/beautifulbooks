# lab/colorsort — das eigene Regal nach Farben

Julian, 2026-09-28: „start a new lab project. i want an option to take a picture of my library and then have an algorithm to sort the books by colours". Roadmap **5.16**. Stand: **Prototyp gebaut 2026-09-28, am gemalten Beispielregal geprüft; ein echtes Regalfoto hat es noch nicht gesehen.**

## Die Frage

Kann aus einem einzigen Foto eines Regals — ohne Bildmodell, ohne Netz — genau genug abgelesen werden, wo die Buchrücken sind und welche Farbe jeder hat, dass die vorgeschlagene Farbordnung so aussieht, wie ein Mensch das Regal von Hand sortieren würde?

**Erfolg** (Vorschlag, noch nicht mit Julian abgestimmt): auf fünf echten Fotos (hell, schummrig, voll, mit Lücken, mit Stützen) werden ≥ 90 % der Trennlinien ohne Eingriff richtig gefunden, und die sortierte Ansicht hat keinen Rücken, dessen Platz Julian auf den ersten Blick falsch findet.

## Starten

```bash
npx tsx lab/colorsort/build.ts     # schreibt lab/colorsort/index.html (eine Datei, ~19 KB)
open lab/colorsort/index.html      # oder aufs Telefon schicken und dort öffnen
```

Die Datei braucht keinen Server und schickt nichts ab: **das Foto verlässt das Gerät nicht**, weil es keinen Ort gibt, wohin es gehen könnte. „Foto aufnehmen" öffnet auf dem Telefon die Kamera, „Foto wählen" die Galerie, „Gemaltes Beispielregal" ein zufälliges Regal aus `synthetic.ts`.

## Ablauf, wie gebaut

1. **Foto verkleinern** auf 1400 px lange Kante (`createImageBitmap` dreht nach EXIF).
2. **Regalböden** (`spines.ts`, `findRowCuts`): je Bildzeile der Farbunterschied zur Zeile darüber und darunter in OKLab, davon **der Median über die Breite**. Ein Brett läuft durch die ganze Breite, die Oberkanten verschieden hoher Bücher nicht. Spitzen weit über dem Median (6 × MAD) sind Kanten; Streifen unter 12 % der Bildhöhe (das Brett selbst) fallen weg, der Rest sind Reihen.
3. **Buchrücken** (`findSpineCuts`): je Spalte der Farbunterschied nach links und rechts, gelesen nur im unteren Teil der Reihe (35–95 % der Höhe, denn Bücher stehen auf dem Brett und kurze lassen oben Luft), und davon **das 20-%-Quantil**: eine Trennlinie muss in vier von fünf Zeilen da sein. Spitzen über Median + 4 × MAD, mindestens 3,5 % der Reihenhöhe auseinander (schmalere Rücken gibt es kaum).
4. **Farbe je Rücken** (`color.ts`, `spineColor`): die Pixel ohne die äußeren 15 % links und rechts (Fuge, Schatten) und 8 % oben und unten, k-means mit k = 3 in OKLab, **der größte Cluster** ist die Farbe. Schrift und Logo sind klein, Leinen und Papier groß.
5. **Ordnen** (`sort.ts`): *Regenbogen* — erst Weiß (Buntheit unter 0,04 und Helligkeit ≥ 0,7), dann die Farben reihum nach OKLCh-Farbton ab 10° (Rot; Rosa bei ~350° kommt damit ans Ende), in 30°-Stufen, innerhalb einer Stufe hell nach dunkel; zuletzt Grau und Schwarz von hell nach dunkel. Oder *hell nach dunkel* ohne Farbton. Alle vier Werte sind Schieber auf der Seite.
6. **Wieder einräumen** (`layout`): die neue Folge füllt die Reihen der Reihe nach, jede bis zu der Breite, die ihre Bücher auf dem Foto einnahmen; was übrig bleibt, kommt in die letzte Reihe.
7. **Zeigen**: rechts dasselbe Regal, **zusammengesetzt aus den Ausschnitten des Fotos** in der neuen Ordnung (auf den Boden gestellt, jede Reihe mittig), darunter ein Farbstreifen, die Zahl der Bücher, die stehen bleiben, und die Liste „Reihe 1, Platz 3 ← jetzt Reihe 2, Platz 7". Links auf dem Foto trägt jeder Rücken einen Punkt in seiner Farbe mit seinem neuen Platz. „Bild sichern" lädt die sortierte Ansicht als JPEG.
8. **Korrigieren** durch Antippen des Fotos: *Trennlinie* setzt eine Linie oder nimmt die nächste weg, *Kein Buch* graut eine Lücke, eine Buchstütze oder ein Stück Wand aus, *Regalboden* setzt oder nimmt eine Reihenkante (die Rücken der Reihe werden dann neu gesucht). *Neu erkennen* verwirft alle Korrekturen.

## Gemessen (2026-09-28)

- **Gemaltes Regal** (900 × 620, zwei Reihen, Schrift als Streifen in der Mitte jedes Rückens, dunkle Fugen, 10 % Lichtabfall zum Rand), sechs Zufallsregale (Seeds 7, 1–5, je 21–25 Bücher pro Reihe): beide Reihen gefunden, **alle 295 Trennlinien auf ±3 px, keine überzählige**. Die Tests in `__tests__/colorsort.test.ts` verlangen etwas weniger (≥ 95 % der Linien, höchstens eine zu viel je Reihe, jede Farbe innerhalb 0,06 OKLab der gemalten), damit ein anderer Seed sie nicht zufällig rot macht.
- **Der Median reichte nicht:** mit dem Median statt des 20-%-Quantils fand die Erkennung auf dem gemalten Regal **27 Linien zu viel** — die Ränder der Titelzeile, die über die halbe Höhe laufen. Echte Rücken mit langen Titeln werden dasselbe tun; ob 20 % bei schräg lehnenden Büchern zu streng ist, zeigt erst ein Foto.
- Dauer im Browser für ein gemaltes Regal: **175 ms** vom Bild bis zur ersten Ansicht (Regalböden, 54 Stücke mit k-means — die Bücher und die Wandstücke an den Reihenenden).
- Im Browser-Pane geprüft: Beispielregal, „Kein Buch" auf dem Wandstück rechts (54 → 53), eine Linie weggenommen (53 → 52), 390 px breit ohne waagrechtes Verschieben.
- **Befund am gemalten Regal:** das Stück Wand rechts neben den Büchern und der Streifen links davon werden als Bücher gelesen (hellgrau, landen also unter „Weiß" vorn). Die Erkennung kann eine Wand nicht von einem hellen Rücken unterscheiden; dafür ist „Kein Buch" da.

## Offene Punkte — erst mit echten Fotos entscheiden

1. **Kein echtes Foto gesehen.** Perspektive (Reihen nicht waagrecht, Rücken zur Bildmitte geneigt), Glanzlichter auf Schutzumschlägen, Schatten zwischen den Büchern und schummriges Licht sind alle ungeprüft. Fünf Fotos von Julian, als Dateien nach `docs/tests/` (git-ignoriert); die Zahlen hierher und in docs/history.md.
2. **Zweifarbige Rücken.** Der größte Cluster gewinnt; ein Rücken halb rot, halb weiß landet bei der knapp größeren Hälfte. Die Seite kennt alle drei Cluster (`clusters`) — ob der buntere bevorzugt werden soll, sobald er ≥ 30 % hat, ist eine Frage für echte Regale.
3. **Braun, Beige und Creme** liegen zwischen Farbe und Grau. Die Schwelle 0,04 ist gesetzt, nicht gemessen; am Schieber ansehen, wo alte Taschenbücher und Leinen fallen.
4. **Wand und Stützen** werden als Bücher gelesen (siehe oben). Möglich wäre: ein Stück am Reihenende, dessen Farbe der Fläche über den Büchern gleicht, gilt als Wand.
5. **Die Reihen werden nach Breite neu gefüllt**, nicht nach Höhe; ein großer Bildband kann so in eine niedrige Reihe wandern. Die Höhe jeder Reihe steht im Foto — prüfen, ob es stört.
6. **Liegende Stapel und schräg lehnende Bücher** erkennt es nicht. Ein Bildmodell (wie in `lab/shelf/`, `lib/recognize.ts`) könnte Kästen liefern, kostet aber einen Schlüssel und schickt das Foto fort; erst wenn die Linien an echten Fotos scheitern.
7. **Weniger umräumen:** die Ordnung beginnt immer oben links. Ein Kreis kann an jeder Stelle beginnen; die Stelle, an der am meisten Bücher stehen bleiben, wäre eine billige Verbesserung (`unmoved` zählt es schon).

## Dateien

`color.ts` (OKLab, k-means, Farbe eines Rückens), `spines.ts` (Reihen und Trennlinien), `sort.ts` (Ordnung, Einräumen), `synthetic.ts` (gemaltes Regal mit bekannten Antworten), `app.ts` (die Seite), `page.html` (ihr Gerüst), `build.ts` (bündelt beides mit esbuild zu `index.html`), Tests unter `__tests__/` ohne Netz.

## Regeln (lab/README.md)

Kein Netz, kein Google, kein Bildmodell; nichts erreicht die Website ohne eigenen Roadmap-Punkt. Eine Farbordnung auf der Website — etwa die eigene Sammlung (5.13a) nach Farben — wäre ein eigener Punkt.
