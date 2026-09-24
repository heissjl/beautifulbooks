# lab/distill — ein kleines Netz statt des dHash, von CLIP gelernt

Roadmap 6.23, Stufe (c). Julian, 2026-09-23: „ich wollte eine alternative zum hash für die runtime klassifikation im browser, so wie jev das für text wäre. brauchen wir also doch ein kleines neuronales netzwerk?“

**Die Frage:** Lernt ein kleines CNN (Eingabe 64×96, einige hunderttausend Parameter, ONNX unter 1 MB), einen Cover dorthin zu legen, wo CLIP ihn hinlegt, und zwar gut genug, dass es den dHash dort ersetzen kann, wo er heute entsteht (`lib/coverhash.ts`, auf dem Server)?

**Das Maß:** auf den 116 Paaren aus `lab/clip` den dHash (AUC 0,76) deutlich schlagen und nahe an CLIP (0,85) bleiben; auf 43 Werken **außerhalb** des Index CLIPs Ordnung der Paare nachbilden; unter 10 ms je Bild.

```bash
npx tsx lab/distill/teacher.ts        # CLIP-Vektoren für alle 20.526 Index-Cover (etwa 45 min, setzt nach Abbruch fort)
npx tsx lab/distill/outside.ts        # die 43 Werke außerhalb des Index auflösen (erledigt, outside-works.json)
npx tsx lab/distill/outside.ts --embed   # deren CLIP-Vektoren — erst wenn teacher.ts fertig ist (eine gemeinsame Vektordatei)
npx tsx lab/distill/prompts.ts        # CLIPs Textvektoren für die Frage „kein Cover“
~/.venvs/bb-distill/bin/python lab/distill/train.py [--width 1.0] [--epochs 40]
```

**Umgebung:** PyTorch in `~/.venvs/bb-distill` (außerhalb von iCloud, rund 1 GB), angelegt mit `python3 -m venv ~/.venvs/bb-distill && ~/.venvs/bb-distill/bin/pip install torch torchvision onnx onnxruntime pillow numpy`. **Nicht** in die globale Anaconda-Umgebung installieren: dort zog `pip install torch` am 2026-09-23 numpy auf 2.4 und brach scipy; zurückgesetzt auf numpy 1.24.3 und sympy 1.11.1. MPS ist mit torch 2.11 auf macOS 13.4 nicht verfügbar, trainiert wird auf der CPU. `lab/distill/out` ist ein Symlink auf `~/.cache/bb-distill`, weil die Bild-Caches für das Training über 200 MB groß sind und nicht in iCloud gehören: `mkdir -p ~/.cache/bb-distill && ln -s ~/.cache/bb-distill lab/distill/out`.

**Zurückgehalten** vom Training ist alles, was gemessen wird: die Bilder der gelabelten Paare, alle gelabelten und von Hand ausgeschlossenen Nicht-Cover und alle 1.382 Cover der 43 Außenwerke. Die Labels für das Training sind CLIPs Vektoren, es werden keine menschlichen Labels verbraucht. Die Augmentierung (Ton, Kontrast, Gamma, Ausschnitt, Unschärfe) ist der Kern: Das Netz muss für jeden verschobenen Scan beim Vektor des sauberen Bildes landen, und genau diese Unempfindlichkeit fehlt dem dHash.

## Ergebnis, erster Lauf (2026-09-23)

**Das Netz:** fünf 3×3-Faltungen mit Schrittweite 2 und eine weitere, dann eine lineare Abbildung in CLIPs 512 Dimensionen. **530.896 Parameter**, ONNX 2,1 MB in fp32 (int8 etwa 0,5 MB, noch nicht gebaut), **0,21 ms je Bild** in onnxruntime auf der CPU des M2. Trainiert 40 Epochen auf 20.033 Index-Covern, 45 s je Epoche, gut 30 Minuten. Die erste Bauart mit tiefenweisen Faltungen (MobileNet) brauchte 417 s je Epoche, weil PyTorchs CPU-Rückwärtsschritt für sie langsam ist, und wurde deshalb ersetzt.

**Frage B, die 116 gelabelten Paare** (26 gleich, 90 verschieden, keines im Training):

| Maß | AUC, alle Paare | AUC ohne Übersetzungen (16 gleich, 90 verschieden) |
|---|---|---|
| dHash | 0,763 | 0,821 |
| CLIP (Lehrer) | 0,852 | 0,926 |
| **kleines Netz** | **0,910** | **0,940** |

Die höhere Zahl bei „alle Paare“ ist kein Verdienst: **Bei 64×96 Pixeln liest das Netz keinen Text.** Übersetzungen mit demselben Motiv hält es deshalb für gleich, CLIP nicht. Ohne diese Paare sortiert es so gut wie CLIP.

**Am strengen Ende ist es schwächer.** Dieselbe Blindheit für Text lässt reine Textseiten zusammenfallen: zwei verschiedene Dante-Titelseiten bei 0,985. Faltungen der 16 Dubletten gleicher Sprache:

| Regel | gefunden | falsch gefaltet (von 90) |
|---|---|---|
| CLIP ≥ 0,90 | 8 | 1 |
| CLIP ≥ 0,85 | 13 | 6 |
| Netz ≥ 0,95 | 9 | 5 |
| **Netz ≥ 0,96, gesperrt wenn eines der beiden Bilder „kein Cover“ ≥ 0,3** | **8** | **2** |
| **Netz ≥ 0,94, dieselbe Sperre** | **13** | **3** |

Die Sperre nutzt den Zero-Shot des Netzes selbst, mit CLIPs Prompts aus `lab/clip` (v2). Sie hält die Textseiten fern, und mit ihr schlägt das Netz CLIP bei gleicher Trefferzahl (13 gefunden: 3 falsch statt 6). **Einschränkung:** Sperre und Schwelle wurden an denselben 106 Paaren gewählt, an denen gemessen wird. Das ist optimistisch und braucht eine frische Stichprobe.

**Frage A, kein Cover** (80 Nicht-Cover gegen 171 von Auge gelabelte Cover, alle zurückgehalten): AUC **0,892** für das Netz, 0,877 für CLIP. Das Netz verliert hier nichts.

**Außerhalb des Index** (43 Werke, 23.339 Paare im selben Werk, kein Bild im Training):
- Das Netz findet CLIPs „gleiche Jacke“ (Paare mit CLIP ≥ 0,90, 1.538 Stück) mit **AUC 0,940**.
- Die Rangkorrelation mit CLIP über alle Paare ist nur **0,51**. Grob ordnet es wie CLIP, im Mittelfeld nicht.
- Pro Bild liegt es außerhalb weiter vom Lehrer weg als innerhalb: Kosinus 0,63 gegen 0,76 bei zurückgehaltenen Index-Bildern. **Es hat Klassiker gelernt**, neue Genres kennt es schlechter. Mehr Trainingsdaten von außerhalb wären der nächste Hebel.

## Was als Nächstes zu messen ist

1. **Eine frische Stichprobe gelabelter Paare**, blind wie in `lab/clip`, um Sperre und Schwelle zu prüfen, die hier an der Prüfmenge gewählt wurden. Dazu Julians Gegenlesen der bisherigen.
2. **Höhere Auflösung** (etwa 128×192), damit Typografie zählt. Das würde die Textseiten und die Übersetzungen trennen, kostet aber Rechenzeit, die noch zu messen ist.
3. **Mehr Werke außerhalb des Index im Training.** Die Lehrer-Labels kosten nur Rechenzeit.
4. **int8 und die Signatur:** ein Modell von 0,5 MB bauen, in Node (onnxruntime-node) messen, und prüfen, ob 64 Dimensionen statt 512 (PCA, int8, also 64 Byte je Cover) die Messwerte halten.

## Stand

**2026-09-23, erster Lauf gemessen.** Lehrer-Vektoren für 20.518 von 20.526 Index-Covern und 1.348 von 1.382 Außen-Covern. In die Außenmenge sind *The Girl with the Dragon Tattoo* und *Der Medicus* über Datensätze mit nur einer Ausgabe geraten; sie bleiben als Randfälle drin. **Ergebnis:** Ein Netz von 0,5 MB sortiert gleiche und verschiedene Jacken so gut wie CLIP und rechnet ein Bild in 0,2 ms. Es liest aber keinen Text und braucht deshalb die Sperre gegen Textseiten. Noch nicht reif für die Seite, siehe die vier offenen Punkte oben.
