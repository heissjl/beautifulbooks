# lab/fold — warum die Faltung nicht schärfer wird, indem man an der Zahl dreht

Roadmap 5.4a / 6.10. Julian, 2026-09-09: „für decades-seite sollte die faltung-schwelle hochgesetzt werden. hier fallen ähnliche cover schneller auf. oft sind es gleiche cover nur mit einer anderen grundfarbe des scans. das ist auch ein problem für die generelle faltung."

```bash
python3 lab/fold/bands.py                 # Abstandsbänder über den gebauten Index, kein Netz
FOLD_OUT=/tmp/fold python3 lab/fold/sheet.py 13-16 10   # Kontaktbogen zum Hinsehen
python3 lab/fold/variants.py              # Tonwert-Normalisierung
python3 lab/fold/finer.py                 # feinere Raster und eine Farbschranke
```

Braucht `pillow`. Bilder landen unter `$FOLD_OUT` (Vorgabe `/tmp/fold`), nie im Repo.

## Die Frage

Die Wand faltet ab Abstand 8 bedingungslos, bis 20 bei gleicher ISBN, bis 16 bei gleichem Verlag im selben Jahr (`lib/works.ts`). Julians Beobachtung: auf der Jahrzehnte-Seite stehen sichtbar gleiche Cover nebeneinander, oft dieselbe Gestaltung in einem anderen Scan-Grundton. Also: **lässt sich die 8 anheben, oder der Hash gegen den Grundton unempfindlich machen?**

## Was gemessen wurde

**Erstens die Verteilung.** 100 Werke, 10.362 Cover, 846.779 Paare innerhalb eines Werks. Unter Abstand 8 liegen 0,7 % der Paare; 9–12 sind 0,4 %, 13–16 gut 1 %, 17–20 gut 3 %.

**Zweitens der Blick.** Je zehn Paare aus den Bändern 9–12 und 13–16, von Hand einsortiert (`pairs-labelled.json`, eingefroren, damit die Augenarbeit nicht bei jedem Lauf neu anfällt): **7 gleiche Gestaltung, 10 verschiedene, 3 nicht beurteilbar**, weil ein Bild nicht lud.

Julians Beobachtung stimmt und steht im Material: *The Outsider* (mean 53 gegen 29) und *Catch-22* (52 gegen 42) sind dieselbe Gestaltung in zwei Scans, Abstand 11 und 12. *The Catcher in the Rye* ist dieselbe Illustration einmal rot, einmal orange, Abstand 16.

**Aber im selben Band stehen echte Unterschiede:** *Herr der Ringe* gegen *Lord of the Rings* (anderes Bild) bei 11, zwei verschiedene *Lord of the Flies* bei 12, zwei verschiedene *Siddhartha*-Umschläge bei 14.

## Das Ergebnis: keine der naheliegenden Reparaturen trennt

| Maß | gleiche Gestaltung, schlechtestes | verschiedene, bestes | trennt? |
|---|---|---|---|
| dHash wie bisher | 21 | 10 | nein |
| nach Autokontrast | 23 | 13 | nein |
| nach Histogrammausgleich | 18 | 11 | nein |
| nur „sichere" Bits (Rauschschwelle) | 64 | 0 | nein, schlechter |
| 16×16 statt 8×8 | 0,422 | 0,152 | nein |
| 32×32 | 0,435 | 0,227 | nein |
| Farbschranke (4×4 RGB) | 0,303 | 0,055 | nein |

**Jede Spalte überlappt.** Es gibt keine Schwelle, die die sieben gleichen von den zehn verschiedenen trennt — nicht durch Anheben, nicht durch Normalisieren, nicht durch ein feineres Raster.

Warum die Bitmaske sogar schadet: auf flächigen Umschlägen bleibt fast kein „sicheres" Bit übrig (bei drei Paaren null), und dann meldet das Maß 0 oder 64 statt einer Aussage.

## Was daraus folgt

1. **Die 8 bleibt.** Sie ist konservativ, und das ist ihre Aufgabe: oberhalb entscheidet die Metadatenlage (ISBN, Verlag, Jahr), nicht der Abstand. Das war schon der gemessene Befund von 2026-09-07 und ist es weiterhin.
2. **Was Julian sah, war kein Schwellenproblem.** Die Jahrzehnte-Seite faltete **gar nicht** (`dedupeCovers: false`, weil serverseitiges Hashen die Seite in Produktion umbrachte). Sie faltet jetzt aus dem gebauten Index — dieselbe Regel wie die Wand, ohne eine einzige Anfrage.
3. **Offen bleibt** ein Deskriptor, der Gestaltung von Motivähnlichkeit trennt. Diese Messung sagt nur, welche vier Wege es nicht sind. **17 beurteilte Paare sind wenig** — wer hier weitergeht, labelt zuerst mehr, bevor er baut.

## Stand

Gemessen am 2026-09-09. Kein Code der Website stammt aus diesem Ordner; die Folge dieser Messung war eine Zeile in `app/book/[id]/decades/page.tsx` und eine in `scripts/find-decade-pages.ts`.
