# Regalfoto: der Testsatz und sein erster Lauf (2026-10-04)

ROADMAP 5.11a. Julian lieferte am 2026-10-04 zwölf Fotos aus Buchhandlungen („hier sind testfotos“); mit der Galeriewand und dem Brett vom 2026-09-30 sind es vierzehn. Sie liegen lokal als `docs/tests/regalfoto-set-01.jpg` … `-14.jpg` (git-ignoriert, Regel vom 2026-09-11). Je Foto steht in [lab/shelf/testset/truth.json](../../lab/shelf/testset/truth.json), was ein Mensch darauf lesen kann — **ein Entwurf von Claude, aus den Fotos gelesen, von Julian zu korrigieren**. `npx tsx lab/shelf/evaluate.ts` schickt jedes Foto durch dieselbe Funktion wie die Website (`lib/walls/readphoto.ts`) und hält das Ergebnis dagegen; die Zahlen jedes Laufs liegen unter `lab/shelf/testset/results/`.

**Was die Spalten heißen.** „Gelesen von Liste“: wie viele Bücher der Wahrheitsliste zurückkamen. „Mit Autor“: von den gelesenen Büchern, deren Autor auf dem Foto steht, wie viele mit diesem Autor kamen. „Darüber hinaus“: Lesungen, die zu keinem Buch der Liste passen — auf einem **vollzähligen** Foto ist das ein Fehler, auf den dichten Regalen ist die Liste nur eine Untergrenze und der Rest ungeprüft (dort stehen mehr Bücher, als der Entwurf nennt). Angeschnittene Bücher zählen weder so noch so.

## Erster Lauf (Stand `add4609` plus `readPhoto`, Sonnet 5, effort medium, ohne Denken)

| Foto | Was | gelesen von Liste | mit Autor | darüber hinaus | Teile | Zeit | Kosten |
|---|---|---|---|---|---|---|---|
| 01 | Schaufenster, Umschläge hinter Glas mit Spiegelung | 4 / 4 | 2 / 3 | 1 (Fehler) | – | 4,2 s | 1,5 ct |
| 02 | ein Umschlag in der Hand | 1 / 1 | 1 / 1 | 0 | – | 1,8 s | 1,0 ct |
| 03 | ein Umschlag frontal, zwei Rücken daneben | 2 / 2 | 2 / 2 | 0 | – | 2,4 s | 1,0 ct |
| 04 | Jazz-Regal, vier Böden, gemischt, schräg | 43 / 46 (93 %) | 24 / 25 | 25 (ungeprüft) | 4 | 23,9 s | 9,9 ct |
| 05 | Science-Fiction-Regal, **verwackelt** | 12 / 23 (52 %) | 8 / 9 | 7 (ungeprüft) | – | 8,1 s | 2,3 ct |
| 06 | Büchertisch von oben | 3 / 3 | 1 / 1 | 0 | – | 2,7 s | 1,2 ct |
| 07 | übersetzte Literatur, drei Böden | 43 / 49 (88 %) | 38 / 43 | 12 (ungeprüft) | 6 | 18,5 s | 10,5 ct |
| 08 | Staff-Picks-Ständer, fünfzehn Umschläge | 14 / 15 (93 %) | 14 / 14 | 0 | – | 5,9 s | 1,9 ct |
| 09 | City-Lights-Regal, vier Böden, viele Doppelte | 32 / 38 (84 %) | 20 / 23 | 34 (ungeprüft) | 11 | 17,4 s | 12,1 ct |
| 10 | Belletristik, drei Böden | 46 / 46 (100 %) | 45 / 46 | 34 (ungeprüft) | 9 | 17,4 s | 11,9 ct |
| 11 | Kunstbücher, sechzehn Umschläge | 15 / 15 | 8 / 8 | 0 | – | 7,2 s | 2,2 ct |
| 12 | Schuber und Kassetten, quer, schräg | 20 / 20 | 11 / 12 | 31 (ungeprüft) | 8 | 19,9 s | 8,8 ct |
| 13 | Galeriewand, rund neunzig Rücken | 38 / 39 (97 %) | 9 / 9 | 62 (ungeprüft) | 9 | 19,7 s | 13,1 ct |
| 14 | ein Brett, 22 Romane | 19 / 21 (90 %) | 19 / 19 | 0 | – | 7,3 s | 2,4 ct |
| **alle** | 14 Fotos | **292 / 322 (91 %)** | 202 / 215 (94 %) | 1 Fehler auf den sieben vollzähligen | | 157 s | 79,8 ct |

## Was der Lauf sagt

- **Umschläge sind gelöst.** Die sieben vollzähligen Fotos (Umschläge, das Brett): 58 von 61 Büchern, ein einziger Fehler — „Southon — Emma“, Titel und Autor eines angeschnittenen Buchs vertauscht. 1–2,4 ct, 2–7 s.
- **Dichte Regale: 84–100 % der Liste**, mit dem zweiten Blick (4–11 Teile), 9–13 ct und 17–24 s Lesezeit.
- **Unschärfe ist die Grenze, nicht das Verfahren.** Das verwackelte Regal (05) kommt auf 52 %, und weil der erste Blick dort unter 30 Büchern bleibt, gibt es keinen zweiten. Was fehlt, kann auch ein Mensch nur mit Mühe lesen (*Red Mars*, *Blue Mars* stehen in großen Lettern da und fehlen trotzdem).
- **Was fehlt:** auf dem Brett wieder *Collected Novellas* (violett auf violett) und *Lord Malquist & Mr Moon*; am Ständer *The Snow Leopard* (das Buch steht aufgeklappt); bei der übersetzten Literatur alle vier Per Petterson am rechten Rand; bei City Lights sechs dünne Rücken zwischen Doppelten.
- **Was über die Listen hinaus kommt, ist dreierlei:** (a) echte Bücher, die der Entwurf nicht nennt (*Finding the Right Notes*, *Sealed in Stone*, *Rising Up*, *Our Country Friends*) — die Mehrheit; (b) **Bruchstücke angeschnittener Bücher am Bildrand**: „GO“, „Self“, „Clash“, „Free“, „SETH“, „LEE“, dazu Verlagsnamen als Titel („South Carolina“, „Grizzly Peak“) — alle vom angeschnittenen obersten Boden des Fotos 10; (c) Verlesenes und falsch Zusammengeführtes: „Warrior for Gringostroika at the CIA — Melvin A. Goodman“ (zwei Nachbarn in einem), „OCD Tripping to the Courtyard — Ana Navarro“, „Edmund Fillmore — J.R.R. Tolkien“.

## Was daraus folgt (Vorschläge, noch nichts gebaut)

1. **Julian korrigiert die Wahrheitslisten**, vor allem der dichten Fotos (04, 07, 09, 10, 12, 13): erst mit vollzähligen Listen ist „darüber hinaus“ eine Fehlerzahl.
2. **Bruchstücke am Rand:** ein Satz im Prompt („ein Buch, dessen Titel der Bildrand abschneidet, auslassen“) oder der angeschnittene oberste und unterste Streifen wird beim zweiten Blick nicht gelesen — am Testsatz zu messen.
3. **Ein Feld für Unsicheres** (die Vermutung vom 2026-10-03: ohne Konfidenz verschweigt das Modell, was es halb liest) — am Testsatz zu messen, ob es *Collected Novellas* und die Pettersons zurückbringt, ohne die Fehler auf den vollzähligen Fotos zu erhöhen.
4. **Das verwackelte Foto** braucht keinen besseren Prompt, sondern einen Satz an den Leser: „the photo is blurred — try again, holding still“ — erkennbar an der Schärfe des Bilds (Kantenstärke), ohne Modell.

## Zweiter Lauf: nur ein Blick (`PHOTO_DENSE_AT=off`)

Für die Frage, ab wie vielen Büchern sich der zweite Blick lohnt (Julian, 2026-10-04: „die grenze für die dichte hochsetzen“). Über alle vierzehn Fotos: **261 von 322 (81 %) für 37,8 ct**, gegen 292 von 322 (91 %) für 79,8 ct mit zweitem Blick.

| Foto | ein Blick | zwei Blicke | Lesungen im ersten Blick | Kosten ein / zwei |
|---|---|---|---|---|
| 04 Jazz | 37 / 46 | 43 / 46 | 55 | 4,6 / 9,9 ct |
| 07 übersetzte Literatur | 38 / 49 | 43 / 49 | 44 | 4,6 / 10,5 ct |
| 09 City Lights | 29 / 38 | 32 / 38 | 43 | 3,7 / 12,1 ct |
| 10 Belletristik | 38 / 46 | 46 / 46 | 42 | 4,1 / 11,9 ct |
| 12 Schuber | 20 / 20 | 20 / 20 | 35 | 3,6 / 8,8 ct |
| 13 Galeriewand | 30 / 39 | 38 / 39 | 44 | 3,8 / 13,1 ct |

Alle anderen Fotos lesen im ersten Blick höchstens 21 Bücher. Die Schwelle steht seitdem bei 40: sie trifft die fünf Fotos, bei denen der zweite Blick etwas bringt, und lässt die Schuber aus. Ergebnisse: `lab/shelf/testset/results/*-one-look.json`.

**Berichtigung der Preise (2026-10-04, beim Zusammenführen mit main):** alle Cent-Angaben in diesem Dokument bis hierher rechnen mit **angenommenen** 3 $ / 15 $ je Million Token. Die Analyse-Sitzung (ROADMAP 3.1, K13) hat den Listenpreis nachgeschlagen: `claude-sonnet-5` kostet **2 $ / 10 $** (`lib/insights/prices.ts`). Alle Kosten sind also um ein Drittel niedriger als oben genannt: ein gewöhnliches Foto rund **1,5 ct** statt 2, ein dichtes **6–9 ct** statt 9–13, der Testsatz-Lauf mit zweitem Blick **53 ct** statt 80, mit einem Blick 25 statt 38. Die Verhältnisse (zweiter Blick ≈ doppelte Kosten über den ganzen Satz, Vierfaches bei einer dichten Wand) bleiben. Budget und Auswertungsskript rechnen seitdem mit der gemeinsamen Tabelle.

## Dritter Durchgang: die drei Ideen (2026-10-04, abends) — **zur Hälfte gemessen, dann war das Guthaben leer**

Julian: „miss die drei ideen am testsatz“. Stand des Codes: Schwelle 40, Preise aus `lib/insights/prices.ts`. Die Varianten sind Schalter des Auswertungsskripts (`--variant cut,trim,unsure`) und der Lesefunktion; die Website übergibt keine.

**Abbruch:** während der Läufe antwortete die Anthropic-API mit „Your credit balance is too low“. Zwei Vergleichsläufe brachen bei Foto 13 ab; die Varianten `trim` und `unsure` sind **nicht gelaufen**. Was unten steht, sind zwei Vergleichsläufe über die Fotos 01–12 und ein vollständiger Lauf der Variante `cut`.

### (c) Ein Hinweis bei Unschärfe — gemessen, ohne Modell, trägt

`lib/sharpness.ts`: je Kachel (12 × 12) das Verhältnis der stärksten Helligkeitssprünge zwischen direkten Nachbarn zu denen über vier Pixel, davon das 90. Perzentil. Rund 30 ms je Foto, kein Aufruf.

| Foto | 01 | 02 | 03 | 04 | **05** | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 13 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Schärfe | 0,56 | 0,43 | 0,55 | 0,57 | **0,33** | 0,46 | 0,63 | 0,52 | 0,74 | 0,60 | 0,59 | 0,73 | 0,61 | 0,58 |

Das verwackelte Regal (05) liegt mit 0,33 deutlich unter allen anderen (0,43–0,74); eine Schwelle bei 0,38 trennt. Ein erster Versuch über das ganze Bild trennte **nicht**: der scharfe Umschlag in der Hand (02) lag mit 0,28 unter dem verwackelten Foto, weil der unscharfe Hintergrund das Bild beherrscht — darum kachelweise, und ein Foto ist so scharf wie seine schärfsten Kacheln. **Einschränkung:** ein einziges unscharfes Beispiel. Das reicht für einen Hinweis an den Leser („the photo looks blurred“), nicht dafür, ein Foto abzuweisen.

### Das Rauschen zwischen zwei gleichen Läufen — und was es über die Schwelle 40 sagt

| Fotos 01–12 | gelesen von Liste | Stümpfe | Fehler auf vollzähligen | Kosten |
|---|---|---|---|---|
| Vergleich a | 231 / 262 (88 %) | 9 | 2 | 35,1 ct |
| Vergleich b | 239 / 262 (91 %) | 16 | 3 | 40,3 ct |

Derselbe Code, dieselben Fotos, **acht Bücher Unterschied** — und sieben davon stammen von einem einzigen Foto: die Belletristik (10) las im ersten Blick einmal weniger als 40 Bücher und bekam **keinen zweiten Blick** (35 von 46), einmal mehr und bekam ihn (45 von 46). Im `cut`-Lauf traf dasselbe City Lights (09: 23 von 38) und die Galeriewand (13: 27 von 39). **Die Schwelle 40 liegt mitten in der Spanne, die ein erster Blick auf einem dichten Regal liest (35–55): ob der zweite Blick kommt, ist dort Zufall.** Mit 30 kam er auf allen sechs dichten Fotos. Das ist die Folge des Hochsetzens vom selben Tag und gehört entschieden: zurück auf 30 (das Tagesbudget begrenzt die Ausgaben inzwischen ohnehin), oder ein Dichtesignal, das nicht schwankt — die Zahl der Böden, die `shelvesOf` findet, kostet nichts und ist bei jedem Lauf gleich.

Die Fehler auf vollzähligen Fotos schwanken genauso: „The Secret History — Donna Tartt“ (08, erfunden), „Ten Commandments“ (02, ein unscharfer Rücken im Hintergrund), „Extraordinary“ (03, ein angeschnittenes Buch) kamen je in einem der zwei Läufe. Unter drei Punkten Unterschied ist bei einem einzelnen Lauf nichts zu behaupten.

### (a) Bruchstücke am Bildrand, Variante `cut` (ein Satz im Prompt) — gemessen, **trägt nicht**

„Leave out a book that the edge of the picture cuts off so that its title is not whole.“

- **Die Stümpfe bleiben:** auf Foto 10 kommen „GO“, „SELF“, „CLASH“, „FREE“, „SETH“ mit dem Satz genauso wie ohne. Sie stammen aus dem angeschnittenen Streifen über dem obersten Brett, der beim zweiten Blick ein eigenes Stück ist — dort gibt es nichts als Stümpfe, und das Modell liefert sie.
- **Echte Bücher gehen verloren:** *City on the Edge* (01, rechts angeschnitten, Titel lesbar) fehlt nur in diesem Lauf.
- Über alle vierzehn 271 von 322 — nicht vergleichbar, weil drei dichte Fotos in diesem Lauf keinen zweiten Blick bekamen (siehe oben); mit dem Satz liest der erste Blick eher weniger, was die Schwelle noch seltener auslöst.

Der gezielte Weg ist Variante `trim` — die niedrigen Randstreifen beim zweiten Blick gar nicht lesen —, **nicht gemessen** (Guthaben).

### (b) Ein Feld für Unsicheres, Variante `unsure` — **nicht gemessen** (Guthaben)

Gebaut und schaltbar: ein Feld `u` je Buch, der Satz „give your best reading and set u to true“ statt „leave out“; das Skript zählt, wie viele Listenbücher nur als unsichere Lesung kommen und wie viele unsichere Lesungen daneben liegen.

### Was als Nächstes zu messen ist, sobald wieder Guthaben da ist

1. `--variant trim`, zweimal, gegen zwei Vergleichsläufe (alle mit derselben Schwelle).
2. `--variant unsure`, zweimal.
3. Vorher die Schwellenfrage entscheiden, sonst misst jeder Lauf vor allem, ob der zweite Blick kam.
Je Lauf rund 35–55 ct; sechs Läufe etwa 3 $.

