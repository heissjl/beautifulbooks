# haiku — Cover beschreiben, dann einbetten

**Frage** (ROADMAP 6.102, nach [docs/haiku-zone.md](../../docs/haiku-zone.md)). Findet eine Textachse — ein Modell
beschreibt jedes Cover in drei Haikus, die Haikus werden eingebettet — Paare, die zusammengehören und die das
heutige „sieht so aus“ (6.10, Farbe und Struktur) nicht findet?

**Maß.** Kein Urteil per Zahl: ein Kontaktbogen, pro Cover fünf Nachbarn nach Haiku neben den fünf aus 6.10, oben
die 20 engsten Paare. Dazu zwei Zahlen gegen Fehler der Methode: wie oft ein Cover in fremden Top-5-Listen steht
(Hubness), und wie viele Cover nie darin stehen.

**Ablauf.**

```bash
set -a; source .env.local; set +a; npx tsx lab/haiku/describe.ts 200   # Modell, Antworten in ../bb-lab-cache/haiku/desc/
../bb-lab-cache/haiku/venv/bin/python lab/haiku/embed.py                # lokal, fastembed BAAI/bge-small-en-v1.5
npx tsx lab/haiku/sheet.ts                                              # lab/haiku/out/sheet.html
python3 -m http.server 4331 --bind 127.0.0.1 -d lab/haiku/out           # Bilder laden nur über http
```

Die venv: `python3 -m venv ../bb-lab-cache/haiku/venv && ../bb-lab-cache/haiku/venv/bin/pip install fastembed`.
Ein zweiter Lauf von `describe.ts` fragt nichts mehr (Cache). Kein Google, kein Open-Library-Katalog — die Bilder holt
das Modell selbst von `covers.openlibrary.org`.

## Stand 2026-10-08: gemessen

- **Stichprobe:** 200 Cover aus `data/cover-index.json`, eins je Werk (jedes 2,5. Werk, sein erstes Cover).
- **Kosten:** `claude-haiku-4-5`, 36.762 Eingabe- und 12.436 Ausgabe-Tokens, **0,099 USD** für 199 Cover (Preis aus
  `lib/insights/prices.ts`), also rund 0,05 Cent je Cover; der ganze Index (35.351) läge bei etwa 18 USD.
  Einbettung lokal, kostenlos.
- **6.10 zum Vergleich:** nur 50 der 200 haben überhaupt einen Nachbarn in 6.10 — und das über den ganzen Index,
  während die Haiku-Nachbarn nur unter den 200 gesucht werden. Der Vergleich ist also zugunsten von 6.10 schief.
- **Erster Lauf, roh: unbrauchbar.** *The Spy Who Came in from the Cold* stand in 53 von 200 Top-5-Listen, 33 Cover
  in keiner; die engsten Paare (0,94) waren *Goodnight Moon*, *A Doll's House*, *All the Light We Cannot See* — weil
  13 der 200 Antworten Überschriften trugen („# Haiku 1: Image and Motif“) und die Einbettung nach Antwortform
  sortierte. Alle Werte lagen zwischen 0,65 (Median) und 0,80: jedes Haiku sagt „serif letters, light, dark“.
- **Bereinigt** (Überschriften gestrichen, Mittelwert abgezogen): der häufigste Nachbar steht in 16 Listen, nur
  6 Cover in keiner.
- **Hingesehen:**
  - *Gut, und 6.10 findet es nicht:* *Native Son* (Gesicht im Profil) → *Der Vorleser*, *Imaginary Homelands*,
    *Lady Chatterley*, *Beloved* — lauter Porträts; *La familia de Pascual Duarte* (kahler Baum) → *Disgrace*
    (kahler Baum auf Orange), *Tao Te Ching* (Baum im Nebel), *The Big Sleep*; *Madame Bovary* ↔ *The Notebook*
    (Frau im Kleid); *Eleanor Oliphant* ↔ *Becoming* (heller Gegenwarts-Bestseller); die zwei Project-Gutenberg-Cover
    (*Cyrano*, *Peter Rabbit*, gleiche Vorlage) finden einander.
  - *Langweilig:* 14 der 20 engsten Paare sind schlichte cremefarbene Titelseiten alter Ausgaben (*The Namesake*,
    *Peter Pan*, *The Once and Future King*, *A Time to Kill* auf Niederländisch). Richtig, aber genau die Cover,
    die Julian nicht nebeneinander sehen will.
  - *Falsch:* *The Underground Railroad* ↔ *Peter Rabbit*; *Los detectives salvajes* (Wüste, Abendrot) bekommt
    *Invisible Man*, *Der Exorzist*, *I, Robot* — Stimmung „dunkel“, sonst nichts.
- **Nebenbefund:** das Verbot, den Titel zu nennen, hält, aber Inhalt sickert durch („duality haunts“ bei *Jekyll and
  Hyde*) — das Modell erkennt das Buch und beschreibt es mit.

**Befund.** Die Textachse findet, was Pixel nicht können: **dasselbe Motiv in anderer Gestaltung.** Sie kostet
fast nichts. Aber sie ballt sich um die schlichten Titelseiten, und ihr Zahlenwert sagt wenig — 0,30 ist bei einem
Porträt gut und bei einem Abendrot zufällig.

**Wenn es weitergeht (Julian entscheidet):** (1) feste Felder statt Haikus — Motiv, Farben, Schrift, Epoche als
JSON, dann *Motiv allein* einbetten; die Haiku-Form erzwingt Bildsprache, verwässert aber gerade das Motiv mit
„light/dark“; (2) schlichte Titelseiten vorher aussortieren (6.10 kennt Kontrast und Sättigung schon); (3) ein
Bild-Embedding (6.23 b) auf derselben Stichprobe als Gegenprobe, ob der Text-Umweg überhaupt nötig ist. Erst
danach eine Zeile auf der Buchseite.

## 6.102a — erst das Index aufräumen (2026-10-09)

Julian, 2026-10-09: „first we need to scrap more of the faulty or boring covers from the index. like the ones that are
only a title page in cream … only once we have a refined index we can think about indexing it.“

**Kontrast allein trennt nicht** (`plain.ts`, Bogen `out/plain.html`, 60 Zufallscover je Band). Die zehn cremefarbenen
Titelseiten der Haiku-Stichprobe haben dHash-Kontrast 7–15, echte Gestaltungen ab 18 — aber im ganzen Index stehen
unter ≤ 8 auch *Lolita* (goldene Figur), Lovecraft, *Ulysses* in Grün, Baudelaire in Orange, und unter 16–20 noch viele
Titelseiten (*Howards End*, *Middlemarch*, *Sister Carrie*, *Genji*). Bänder: ≤ 8: 1.354, 9–12: 1.336, 13–15: 1.110,
16–20: 1.940 von 35.351.

**CLIP Zero-Shot trennt** (`plainclip.ts`, Bogen `out/plainclip.html`, 40 Zufallscover je Band). Über die Vektoren aus
`lab/clip` (Branch `claude/jev-cover-filtering-9ed86c`, `clip.ts` und `score.ts` unverändert übernommen, Cache in
`../bb-lab-cache/clip/out/`, kein Bild neu geholt): vier „schlichte“ Beschreibungen (Titelseite auf Creme, rein
typografisch klein, Leinentafel einer Farbe, Textseite) gegen fünf „gestaltete“. 21.316 der 35.351 Cover haben einen
Vektor.

| schlicht ≥ | Cover | angesehen |
|---|---|---|
| 0,9 | 245 | alles Textseiten, Titelseiten, leere Tafeln, ein Ausleihzettel |
| 0,7–0,9 | 448 | fast alles schlicht; Ausnahme *Il pendolo di Foucault* (griechisch, typografisch) |
| 0,5–0,7 | 520 | überwiegend schlicht; dazwischen echte Gestaltungen (*Invisible Man*, *The Color Purple*) und eine Rückseite (*Wonder*) |
| 0,4–0,5 | 397 | etwa drei Viertel schlicht (Titelseiten, Tafeln, ein Barcode); *The Woman in White* mit Porträt, *To the Lighthouse* |
| 0,3–0,4 | 477 | nicht angesehen |
| < 0,3 | 19.225 | Stichprobe 0–0,4: fast nur Gestaltungen; durchgerutscht eine schwarze Tafel (0,38) und eine Werther-Titelseite (0,29) |

Also rund **1.600 Cover ≥ 0,4 (7,6 %)**, ein Rand von rund 500 zwischen 0,3 und 0,4. Wie in lab/clip: eine Rangfolge
für den Blick, keine Löschregel. **Offen, Julian:** (1) ob „aussortiert“ heißt *nicht im Ähnlichkeits- und
Haiku-Index* (Wand unverändert, dort sortiert `looksLikeScannedPage` schon ans Ende) oder mehr; (2) ob die
fehlenden 14.035 Cover einen CLIP-Vektor bekommen (Bilder von `covers.openlibrary.org`, lab/clip maß 2.523 in 470 s,
also grob 45 Minuten); (3) die Schwelle, nach einem Prüfbogen des Rands 0,3–0,5.
