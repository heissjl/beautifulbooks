# palette — Farbschema-Kandidaten (ROADMAP 6.22)

**Frage.** Julian am 2026-09-09: „Das Farbschema ändern." Genauer: es geht vor
allem um die **Akzentfarbe**. Terrakotta `#b1502b` steht heute auf Suchknopf,
Sprach-Pillen, Fokusringen, Links und dem Verdikt-Hinweis — die einzige Farbe
der Oberfläche und damit die einzige, die mit den Covern konkurriert.

**Maß.** Kein Geschmacksurteil, sondern zwei Prüfungen nebeneinander:

1. **Wie hält sich die Färbung gegen die Wand?** Der Hintergrund steht hinter
   hunderten Covern in allen Farben; je bunter er ist, desto mehr streitet er
   mit ihnen. Papierweiß war genau deshalb gewählt. Deshalb zeigt die Seite
   nicht Farbfelder, sondern **dieselbe Wand und dieselben Bedienelemente** in
   jeder Färbung, hell und dunkel — `prefers-color-scheme` liefert beides aus,
   und ein Schema, das nur in einem Modus trägt, ist keins.
2. **WCAG AA.** Unter jeder Wand steht die Kontrasttabelle der Paare, die in
   der Oberfläche wirklich vorkommen. Rot heißt: durchgefallen, und damit raus,
   unabhängig vom Aussehen.

**Stand.** Vier Kandidaten, beschrieben in `palettes.ts`: *Heute* (Terrakotta,
als Referenz), *Tinte* (gar keine Akzentfarbe), *Indigo* (kühler Akzent auf
demselben Papier), *Olive* (gedämpfter Akzent und kühleres Papier — der
einzige, der die Grundfarbe anfasst). Entschieden ist nichts; die Wahl trifft
Julian.

**Der Befund, der die Farbfrage überholt:** `ink-3` verfehlt heute WCAG AA auf
dem eigenen Grund — **3,28 hell und 4,14 dunkel** gegen die 4,5, die normaler
Text braucht. Es trägt die Metadatenzeilen und die Verdikt-Hinweise bei 11–12
px, die Ausnahme für großen Text greift also nicht. Die nächstliegenden
bestehenden Werte sind `#746c62` (4,55) und `#837b6f` (4,51) — kaum ein
Schattenunterschied, weshalb es nie jemandem auffiel. Das gehört korrigiert,
**welcher Akzent auch immer gewinnt**; die drei Vorschläge tragen es bereits,
*Heute* absichtlich nicht.

## Bauen

```bash
npx tsx lab/palette/build.ts                                  # -> index.html, Bilder von Open Library
npx tsx lab/palette/build.ts --base http://localhost:3000/img # über die eigene Bildroute, viel schneller
npx tsx lab/palette/build.ts --embed --out /tmp/mockup.html   # eingebettete Bilder, verschickbar
npx tsx lab/palette/build.ts --work=Neuromancer               # eine andere Wand
```

Die Cover kommen aus `data/cover-index.json`, es wird also nichts gesucht und
keine Anfrage an Google gestellt. Ohne `--base` lädt der Browser sie direkt von
Open Library, was 6 bis 16 Sekunden je Bild dauern kann (die Messung hinter
ROADMAP 1.3) — für die committete Fassung ist das der Preis dafür, dass sie
ohne laufenden Server funktioniert.

Nichts hieraus erreicht die Website. Wenn eine Färbung gewählt ist, sind es
neun Zeilen in `app/globals.css` unter `@theme inline` — und ein eigener
Roadmap-Punkt.
