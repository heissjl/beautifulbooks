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

## Stand

**2026-09-23, Pause:** Die Skripte stehen, die Außenmenge ist aufgelöst (43 Werke, 1.382 Cover; *The Girl with the Dragon Tattoo* und *Der Medicus* wurden auf Datensätze mit einer Ausgabe aufgelöst und bleiben als Randfälle drin). `teacher.ts` war bei rund 2.000 von 17.800 fehlenden Covern, als der Mac zugeklappt wurde. **Weiter:** `teacher.ts` erneut starten, bis alle Vektoren da sind, dann `outside.ts --embed`, dann `train.py`. Noch nichts trainiert, noch nichts gemessen.
