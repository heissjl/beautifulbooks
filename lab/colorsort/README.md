# lab/colorsort — das eigene Regal nach Farben

Julian, 2026-09-28: „start a new lab project. i want an option to take a picture of my library and then have an algorithm to sort the books by colours". Roadmap **5.16**. Stand: **Prototyp gebaut 2026-09-28, am gemalten Beispielregal geprüft; am selben Tag als Farbschritt in den Regal-Ablauf von `lab/shelf/` eingebaut (siehe unten). Ein echtes Regalfoto hat es noch nicht gesehen.**

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

## Als Schritt im Regal-Ablauf (`lab/shelf/`, seit 2026-09-28)

Julian, 2026-09-28: „use the book detection by the other lab project for the collection curation to better find the books from the picture and make the colours sorting part of that process".

- **Wer die Bücher findet:** im Regal-Ablauf das Bildmodell (`lib/recognize.ts`): es weiß, welche Bücher da sind und wie sie heißen, und liefert je Buch einen Kasten — aber nur ungefähr. Die Kantenerkennung von hier sucht keine Bücher mehr, sondern **schiebt die linke und rechte Kante eines Rücken-Kastens auf die nächste Trennlinie** (`refineSpineBox`, bis 40 % der Breite zu jeder Seite; findet sie keine, bleibt der Kasten, wie das Modell ihn zog). Umschläge (`kind: cover`) bleiben unverändert.
- **Farbe und Ordnung:** `shelfcolors.ts` liest je Kasten die Farbe (wie oben) und ordnet mit `sort.ts`. `lab/shelf/serve.ts` bündelt die Datei als `/colors.js`; sie läuft im Browser auf dem Foto, das die Seite ohnehin hält — kein zusätzlicher Weg für das Foto, keine Anfrage.
- **Auf der Seite:** über der Wand „Reihenfolge: wie im Foto · nach Farben · hell nach dunkel", darüber ein Farbstreifen; jede Kachel trägt die Farbe ihres Buchs im Foto als kleines Feld, das Foto die angepassten Kästen. **Der geteilte Link trägt die gewählte Reihenfolge.** Bücher ohne Kasten stehen am Ende, und die Seite sagt, wie viele.
- **Achtung beim Ansehen:** die Kacheln zeigen das Cover von Open Library, geordnet wird nach der Farbe *des eigenen Exemplars im Foto*. Wo die Ausgabe nicht die abgebildete ist, passt das Kachelbild nicht zum Farbfeld; das ist gewollt (es ist dein Regal), kann aber auf der Wand unordentlich aussehen. Ob stattdessen nach der Coverfarbe geordnet werden soll, entscheidet Julian an einem echten Foto.
- **Beispielmodus ohne Schlüssel:** „Mit der Beispielliste ausprobieren" malt ein Regal mit zwölf Rücken und gibt den zwölf Büchern aus `sample.json` dessen Kästen, jeweils um bis zu ein Viertel der Breite verschoben wie von einem Modell. Die Farben sind damit erfunden; geprüft wird der Weg, nicht das Ergebnis.

## Gedrehte Rechtecke statt Kästen (2026-09-29)

Julian: „teilweise liegen die bücher ja auch oder sind schief im regal. die segmentierung sollte hier deutlich genauer sein".

Ein achsenparalleler Kasten kann ein lehnendes oder liegendes Buch nicht beschreiben, und eine Suche nach senkrechten Linien findet auf einem schrägen Rücken nichts. Deshalb (`oriented.ts`):

- **Das Modell** gibt je Buch eine Linie entlang der Mitte des Rückens von Ende zu Ende und dessen Breite, in Pixeln (`recognize(…, { axis: true, pixels })`). Die erste Fassung sagte „vom Fuß zum Kopf“; bei liegenden Büchern zog das Modell dann eine kurze Linie von unten nach oben, quer übers Buch. Jetzt heißt es „entlang der langen Seite“. Ist eine Linie trotzdem kürzer als das Buch dick, dreht die Seite sie um 90°.
- **`refineOriented`** sucht die beiden Längskanten *quer zur Richtung des Buchs*, mit derselben Regel wie für Trennlinien (eine Kante muss auf vier Fünfteln der Länge da sein). Es probiert Drehungen bis ±8° und wählt das **Kantenpaar**, das kräftig ist und Mitte und Dicke des Modells am nächsten bleibt. Die erste Fassung suchte jede Kante einzeln und fand bei einem zu dünn geschätzten Buch die zweite nicht (auf gemalten Szenen 21–36 % richtig); mit der Paarsuche sind es 40 von 42.
- **Kontrolle:** Wird das Buch durch die Verschiebung weniger einfarbig (Anteil der Hauptfarbe sinkt um mehr als 0,05), gilt das Rechteck des Modells.
- **`orientedColor`** liest die Farbe im gedrehten Rechteck: innere 70 % quer, 84 % längs.
- **Auf der Seite** stehen die Rechtecke gedreht auf dem Foto (grün: verschoben, orange: wie vom Modell). Die Seite schickt die Farben mit an den Server, damit die Ausgabenwahl dieselben Farben nutzt. Beim Hochladen schreibt sie eine Zeile ins Protokoll: wie viele stehend, lehnend und liegend, wie viele verschoben, der Anteil der Hauptfarbe vorher und nachher.

**Gemessen an einer gemalten Szene mit echten Titeln** (2000 × 1100; fünf Bücher stehend, zwei um 15° lehnend, drei liegend gestapelt), abgeschickt an `claude-sonnet-5`:

| | Modell allein | nach dem Nachschärfen |
|---|---|---|
| stehend (5) | 0–12 px quer daneben, Dicke bis 10 px falsch | alle ≤ 2 px, Dicke ≤ 3 px |
| lehnend (2) | 1–9 px; Winkel 2,5–3° (erste Fassung: 4–7°) zu wenig geneigt | beide ≤ 1 px |
| liegend (3) | nach der neuen Anweisung 1–2 px, Dicke bis 5 px falsch | alle ≤ 2 px |
| Farbe | — | 10 von 10 innerhalb weniger Stufen der gemalten |

Gemalt ist nicht fotografiert: gerade Kanten, gleichmäßiges Licht, keine Schatten. Das Ergebnis ist eine Untergrenze. Die Tests in `__tests__/oriented.test.ts` prüfen dasselbe ohne Modell an drei gemalten Szenen mit verschobenen, verdrehten und falsch dicken Rechtecken.

## Gemessen (2026-09-28)

- **Gemaltes Regal** (900 × 620, zwei Reihen, Schrift als Streifen in der Mitte jedes Rückens, dunkle Fugen, 10 % Lichtabfall zum Rand), sechs Zufallsregale (Seeds 7, 1–5, je 21–25 Bücher pro Reihe): beide Reihen gefunden, **alle 295 Trennlinien auf ±3 px, keine überzählige**. Die Tests in `__tests__/colorsort.test.ts` verlangen etwas weniger (≥ 95 % der Linien, höchstens eine zu viel je Reihe, jede Farbe innerhalb 0,06 OKLab der gemalten), damit ein anderer Seed sie nicht zufällig rot macht.
- **Der Median reichte nicht:** mit dem Median statt des 20-%-Quantils fand die Erkennung auf dem gemalten Regal **27 Linien zu viel** — die Ränder der Titelzeile, die über die halbe Höhe laufen. Echte Rücken mit langen Titeln werden dasselbe tun; ob 20 % bei schräg lehnenden Büchern zu streng ist, zeigt erst ein Foto.
- Dauer im Browser für ein gemaltes Regal: **175 ms** vom Bild bis zur ersten Ansicht (Regalböden, 54 Stücke mit k-means — die Bücher und die Wandstücke an den Reihenenden).
- **Kasten auf den Rücken schieben** (`refineSpineBox`), sechs gemalte Regale, 283 Rücken, beide Kanten um einen Anteil der Breite verschoben: um 10 % → **283/283** auf ±3 px zurück; um 25 % → **274/283**; um 35 % → 199/283; um 50 % → 5/283 (die Kante liegt dann auf halbem Weg zur Nachbarlinie; 128 Kästen bleiben unverändert). Ein Modell, das die Kante um mehr als ein Drittel der Rückenbreite verfehlt, wird also nicht mehr gerettet. Wie weit Sonnet wirklich daneben liegt, zeigt erst ein echtes Foto.
- Im Regal-Ablauf (Beispielmodus, Browser-Pane): 12 von 12 Farben gelesen, 12 Kästen verschoben, **71 ms**; „nach Farben" ordnet die Wand um, der geteilte Link (140 Zeichen) enthält die Werke in genau dieser Reihenfolge.
- Im Browser-Pane geprüft: Beispielregal, „Kein Buch" auf dem Wandstück rechts (54 → 53), eine Linie weggenommen (53 → 52), 390 px breit ohne waagrechtes Verschieben.
- **Befund am gemalten Regal:** das Stück Wand rechts neben den Büchern und der Streifen links davon werden als Bücher gelesen (hellgrau, landen also unter „Weiß" vorn). Die Erkennung kann eine Wand nicht von einem hellen Rücken unterscheiden; dafür ist „Kein Buch" da.

## Offene Punkte — erst mit echten Fotos entscheiden

1. **Kein echtes Foto gesehen.** Perspektive (Reihen nicht waagrecht, Rücken zur Bildmitte geneigt), Glanzlichter auf Schutzumschlägen, Schatten zwischen den Büchern und schummriges Licht sind alle ungeprüft. Fünf Fotos von Julian, als Dateien nach `docs/tests/` (git-ignoriert); die Zahlen hierher und in docs/history.md.
2. **Zweifarbige Rücken.** Der größte Cluster gewinnt; ein Rücken halb rot, halb weiß landet bei der knapp größeren Hälfte. Die Seite kennt alle drei Cluster (`clusters`) — ob der buntere bevorzugt werden soll, sobald er ≥ 30 % hat, ist eine Frage für echte Regale.
3. **Braun, Beige und Creme** liegen zwischen Farbe und Grau. Die Schwelle 0,04 ist gesetzt, nicht gemessen; am Schieber ansehen, wo alte Taschenbücher und Leinen fallen.
4. **Wand und Stützen** werden als Bücher gelesen (siehe oben). Möglich wäre: ein Stück am Reihenende, dessen Farbe der Fläche über den Büchern gleicht, gilt als Wand.
5. **Die Reihen werden nach Breite neu gefüllt**, nicht nach Höhe; ein großer Bildband kann so in eine niedrige Reihe wandern. Die Höhe jeder Reihe steht im Foto — prüfen, ob es stört.
6. **Liegende Stapel und schräg lehnende Bücher** erkennt diese Seite nicht. Im Regal-Ablauf (`lab/shelf/`) findet sie das Bildmodell; die Kanten-Anpassung gilt dort nur für senkrechte Rücken.
7. **Weniger umräumen:** die Ordnung beginnt immer oben links. Ein Kreis kann an jeder Stelle beginnen; die Stelle, an der am meisten Bücher stehen bleiben, wäre eine billige Verbesserung (`unmoved` zählt es schon).

## Dateien

`color.ts` (OKLab, k-means, Farbe eines Rückens), `spines.ts` (Reihen und Trennlinien, `refineSpineBox`), `shelfcolors.ts` (der Farbschritt für `lab/shelf/`), `sort.ts` (Ordnung, Einräumen), `synthetic.ts` (gemaltes Regal mit bekannten Antworten), `app.ts` (die Seite), `page.html` (ihr Gerüst), `build.ts` (bündelt beides mit esbuild zu `index.html`), Tests unter `__tests__/` ohne Netz.

## Regeln (lab/README.md)

Kein Netz, kein Google, kein Bildmodell; nichts erreicht die Website ohne eigenen Roadmap-Punkt. Eine Farbordnung auf der Website — etwa die eigene Sammlung (5.13a) nach Farben — wäre ein eigener Punkt.
