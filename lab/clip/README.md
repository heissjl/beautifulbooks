# lab/clip — sieht ein vortrainiertes Bildmodell, was der dHash nicht sieht?

Roadmap 6.23, Stufe (b). Julian, 2026-09-22: ob sich ein Modell nutzen lässt, um „Hörbuch-Cover oder Seiten statt Covern im Versus-Spiel“ besser auszufiltern oder „besser bei den Faltungen von gleichen/fast gleichen Covern“ zu werden. Jev (TypeSafe AI) nimmt nur Text und wurde deshalb verworfen (ROADMAP 6.23). Hier wird CLIP gemessen, das Bilder sieht.

```bash
npx tsx lab/clip/notcover.ts               # Frage A: Cover oder nicht? (Prompt-Satz v2, --prompts v1 zum Vergleich)
npx tsx lab/clip/fold.ts                   # Frage B: dieselbe Jacke? gegen alle gelabelten Paare
npx tsx lab/clip/fold.ts --sample          # neue Paare aus den Bändern 9–24 zum Labeln ziehen
python3 lab/clip/sheet.py notcover [--blind]   # Kontaktbögen; --blind ohne Zahlen, zum Labeln
python3 lab/clip/sheet.py fold [--blind]
```

**Modell:** `Xenova/clip-vit-base-patch32` (ViT-B/32, 512 Dimensionen) über `@huggingface/transformers`, **auf 3.5 festgelegt**: 4.x bringt eine onnxruntime für macOS 14 mit, und dieser Mac läuft auf 13.4 (dlopen scheitert an einem libc++-Symbol). Läuft lokal auf der CPU, ohne GPU und ohne Netz nach dem ersten Laden. Bilder (`M`-Größe von covers.openlibrary.org, nach ID, also ohne Ratenlimit), Modell und Vektoren liegen unter `lab/clip/out/`, das git-ignoriert ist. **Kosten:** 2.523 Cover in 470 s, Download eingerechnet, also rund eine Stunde für den ganzen Index mit 20.526 Covern, einmal, offline.

`score.ts` enthält die reine Arithmetik (Kosinus, Zero-Shot, AUC, Schwellen) und ist getestet. `clip.ts` übernimmt Netz und Modell.

## Frage A: Cover oder nicht?

**Wahrheit:** 79 Nicht-Cover, nämlich die 23 von Hand aus dem Spiel genommenen (`data/versus-pool.json`, `excluded`) und 56 von Claude aus den Kontaktbögen gelabelte. Dagegen 1.131 Cover: die gelabelten und alle Spiel-Cover, die niemand als Fehler markiert hat. Insgesamt 235 Bilder von Auge gelabelt. Labels in `notcover-labelled.json`, jeweils mit dem Bogen, auf dem sie gesehen wurden.

**Zero-Shot:** Das Bild wird mit Textbeschreibungen verglichen („a book cover“ gegen „a scanned page of printed text“ und andere), ein Softmax darüber ergibt die Wahrscheinlichkeit für „kein Cover“.

| Maß | AUC | ½ der Nicht-Cover fangen | ¾ fangen | 90 % fangen |
|---|---|---|---|---|
| Prompts v1 (erster Versuch) | 0,905 | 23 Cover fälschlich mit | 78 | 346 |
| **Prompts v2** | **0,935** | **9** | 114 | 236 |
| nächstes bekanntes Nicht-Cover | 0,844 | 53 | 203 | 699 |

**Einschränkung zu v2:** Die Prompts wurden an denselben Bögen entworfen, an denen gemessen wird. v1 zog mit „theatre poster“, „square audiobook cover“ und „audio CD case“ illustrierte echte Cover nach oben (*The Color Purple*, *Things Fall Apart*, *Game of Thrones*). v2 streicht diese Prompts und benennt, was auf den Bögen tatsächlich zu sehen war: Rückseiten mit Barcode und Pressestimmen, ein Ausleihzettel, leere Seiten. Die Zahl von v2 ist deshalb optimistisch. Die ehrliche Probe ist die folgende.

**Zufallsprobe außerhalb des Spiels,** 120 Bilder, blind gelabelt (`sheet.py notcover --blind`): **4 sind keine Cover, 2 sind unklar** (3–5 %). Eine feste Schwelle fängt keines davon, schon bei 0,3 nicht. Als **Rangfolge** funktioniert es aber: das unklare Bild auf Platz 1, zwei Titelseiten auf den Plätzen 5 und 8, das zweite unklare auf Platz 7. Die leere Tafel und das Foto zweier Buchrücken landen auf den Plätzen 21 und 27 von 120.

**Im laufenden Spiel** (1.000 Cover, alle durch die Qualitätsregeln aus 5.8a gekommen) sind **10 der 40 obersten keine Cover**: ein Bibliotheks-Ausleihzettel mit Stempeln, zwei Rückseiten von *A Game of Thrones*, eine indonesische Rückseite, eine englische Rückseite aus *Monte Cristo*, nur Text, das Foto einer CD neben *Where the Wild Things Are*, die Titelseite der *Genji*-Übersetzung, eine Tafel mit Barcode sowie zwei dunkle Leinentafeln. Das ist der unmittelbare Nutzen.

**Wo CLIP versagt:** bei den von Open Library generierten Platzhaltern (Titel in einem Kasten auf flacher Farbe, „Note: This is not the actual book cover“, „COVER COMING SOON“). Sie sehen für CLIP wie Cover aus, 16 der 23 ausgeschlossenen gehören dazu. Da sie alle aus einer Vorlage stammen, fängt sie eine Vorlagenregel oder der Abstand zu einem bekannten Platzhalter, nicht der Zero-Shot. Leere Tafeln erkennt `looksPlain` bereits.

**Hörbücher:** Unter rund 2.600 angesehenen Bildern waren genau zwei (Naxos AudioBooks *Metamorphosis*, eine MP3-CD *Moonstone*). Den Rest fangen schon die Metadaten (`physical_format` /audio/ in `openlibrary-parse.ts`). Eigene Prompts dafür schaden, siehe v1.

**Ergebnis A:** Als **Prüfliste und Sortierschlüssel** taugt CLIP, als **Löschregel** nicht. Das passt zur Regel, nie ein Cover zu löschen, nur weil es leer aussieht (§9.3 Schritt 12): Was CLIP oben einreiht, schaut ein Mensch an oder es wandert ans Ende der Wand.

## Frage B: dieselbe Jacke?

**Wahrheit:** 116 Paare aus demselben Werk mit dHash-Abstand 9–24, dem strittigen Band, in dem die Faltung heute nur mit ISBN- oder Verlagsbelegen faltet. Davon 17 aus `lab/fold` (2026-09-09) und 100 neue, gezogen mit `fold.ts --sample` (je Band 25, je Werk und Band höchstens eines) und **blind gelabelt**, also ohne beide Maße auf dem Bogen. Ein Paar war nicht beurteilbar. Ergebnis: **26 gleiche, 90 verschiedene.** Regel: gleich heißt gleicher Entwurf, also Motiv und Layout. Eine Übersetzung mit demselben Motiv zählt als gleich und ist im Vermerk markiert, gleiches Motiv in anderem Layout zählt als verschieden. Labels in `pairs-labelled.json`.

| Maß | AUC |
|---|---|
| dHash (64 Bit) | 0,763 |
| **CLIP (Kosinus)** | **0,852** |

Alle Paare liegen über 8 Bit, **der dHash allein faltet also keines davon.** Eine CLIP-Schwelle würde falten:

| CLIP ≥ | gleiche (ohne Übersetzungen) | verschiedene fälschlich gefaltet |
|---|---|---|
| 0,95 | 2/16 | 0/90 |
| 0,92 | 6/16 | 0/90 |
| **0,90** | **8/16** | **1/90**, *Das Parfum*: dasselbe Gemälde in anderem Layout |
| 0,88 | 9/16 | 3/90 |
| 0,85 | 13/16 | 6/90 |

Übersetzungen mit demselben Motiv liegen bei 0,76–0,84. CLIP liest den Titel kaum mit, und die Faltung faltet über bekannte Sprachen hinweg ohnehin nicht. Deshalb zählen für die Faltung die 16 Paare in derselben Sprache.

**Ergebnis B:** Im strittigen Band holt CLIP bei 0,90 die Hälfte der Dubletten derselben Sprache zurück. Unter 90 verschiedenen Paaren faltet es dabei ein einziges falsch, und das ist ein Grenzfall. Das ist der „deutlich mehr echte Dubletten bei gleicher Zahl falscher Faltungen“, den 6.23 als Messlatte setzt, allerdings nur an **einer** Stichprobe und **einem** Labeler.

## Was fehlt, bevor etwas davon auf die Seite geht

1. **Ein zweiter Blick auf die Labels.** Alle neuen Labels stammen von Claude. Julian sollte zumindest die 26 gleichen Paare und die 56 Nicht-Cover aus den Bögen gegenlesen.
2. **Wie es in den Index kommt.** 512 Floats für jedes der 20.526 Cover wären 42 MB, zu viel für eine eingecheckte JSON-Datei. Der Index braucht die Vektoren aber gar nicht, nur die **Kanten**: die Paare im selben Werk mit CLIP ≥ 0,90 und die Cover, die zur Prüfung vorgemerkt sind. Das sind ein paar KB, berechnet von `scripts/build-cover-index.ts`, nie im Request.
3. **Die Wand faltet heute im Browser über Signaturen** (SPEC §2.3). Eine CLIP-Kante gibt es nur für Cover im Index. Für alle anderen bleibt es bei der heutigen Regel.

## Stand

Gemessen 2026-09-22. Frage A: taugt als Prüfliste, nicht als Regel. Frage B: bestanden auf einer kleinen Stichprobe, die Übernahme hängt an 6.36 (Dublette oder zwei Cover?, Julian) und am gegengelesenen Label-Satz.
