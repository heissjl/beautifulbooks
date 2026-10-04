# lab/nine — „The 9 books that made me"

Julian, 2026-10-04, nach dem Vergleich mit my9albums.org ([docs/vergleich-my9albums.md](../../docs/vergleich-my9albums.md)): „can we set up a lab idea to create an mvp for this". ROADMAP **5.18**.

```bash
npx tsx lab/nine/serve.ts          # http://localhost:4333 — suchen, neun wählen, Ausgabe wählen, Bild laden
npx tsx lab/nine/sample.ts         # zwei Poster aus Farbflächen nach lab/nine/out/, ohne Netz
npx vitest run lab/nine            # Brett, Layout, Poster
```

## Frage

Trägt das my9albums-Format bei Büchern — und ist **„in the edition you read"** der Haken, den Alben nicht haben? Konkret: Bauen Leute in wenigen Minuten ein Brett, das sie posten würden, ohne Konto, ohne Speicher, ohne eine einzige Google-Anfrage?

## Maß (woran Erfolg erkannt wird)

1. **Zeit bis zum Bild:** Julian und mindestens zwei Freunde, je ein Brett von der leeren Seite bis zum heruntergeladenen Bild. Ziel unter **3 Minuten** im Median; Open Library braucht 2–7 s je Suche (N3), neun Suchen sind also schon 20–60 s.
2. **Wird die Ausgabe gewählt?** Anteil der neun Plätze, bei denen „Change edition" benutzt wurde. Unter 1 von 9 im Schnitt heißt: der Haken trägt nicht, das Format ist my9albums mit Büchern; dann kein eigener Grund, es auf der Seite zu bauen.
3. **Lesbarkeit am Telefon:** das Story-Bild auf einem Telefon in Instagrams Vorschau — sind die neun Cover erkennbar, ist die Adresse lesbar?
4. **Kosten je Brett:** die Zahl der Open-Library-Anfragen (der Server druckt sie) und **0 Google-Anfragen**. Bei einer Welle zählt das, nicht die Zahl der Besucher: die Suche ist 24 h gecacht, ein beliebtes Buch kostet nach dem ersten Leser nichts mehr.

## Was gebaut ist

- **`board.ts`** (rein, getestet): neun Plätze, je Werk und gewähltes Cover, **ganz in der Adresse** — `?w=OL…W,…&c=ol-…,…&by=Name`, unter 500 Zeichen auch mit neun Google-IDs und 40 Zeichen Name. Kein Redis, keine Besucher-ID (N11 bleibt, E22 wird nicht ausgeweitet), keine Aufbewahrungsfrage (5.13e). Unlesbare Plätze bleiben leer statt das Brett zu verwerfen. Ein Werk steht höchstens einmal auf dem Brett.
- **`layout.ts`** (rein, getestet): Story 1080 × 1920 und Post 1080 × 1350. Ein 3 × 3 aus 2:3-Covern ist selbst 2:3 und passt in keins der beiden ohne Rand; das Raster richtet sich nach der Höhe und wird zentriert. Story: Kacheln 304 × 456; Post: 232 × 348 mit 174 px Seitenrand — darum Story zuerst.
- **`poster.ts`**: das PNG mit sharp, Text als SVG in DejaVu Serif (was fontconfig findet). Ein dunkler Haarrahmen unter jeder Kachel, damit ein schwarzes Cover nicht im schwarzen Grund verschwindet (am Muster gesehen, 2026-10-04). Ein Cover, dessen Bild nicht kommt, wird eine leere Kachel, kein Fehler.
- **`serve.ts` + `index.html`**: die Seite zum Ausprobieren. Poster und Kachel-Links nennen die echte Seite (`NINE_SITE`, Standard `https://buyitscovers.com`), nicht `SITE_URL`, das lokal `localhost:3000` ist. Ein leerer Platz → Suche (Open Library, nur auf Enter, nicht bei jedem Tastendruck); der Treffer kommt mit dem **bekanntesten Cover** des Werks, „Change edition" lädt die Editionen (bis 300, wie lab/walls) und lässt das gelesene wählen; ◀ ▶ verschieben; Name; „Download for a story / a post"; „Copy link". Wer einen Link öffnet, sieht das Brett ohne Werkzeuge, jede Kachel führt auf die Buchseite der Seite (dort die Kauflinks über `/go/`), darunter „Make your own".

## Stand

**Gebaut 2026-10-04**, Tests grün (16), Poster-Muster aus Farbflächen angesehen, Seite bei 390 und 1280 px angesehen (kein seitliches Scrollen). **Nicht mit echten Covern gesehen:** die Sitzung, die es baute, erreichte Open Library nicht (Egress-Proxy). Der erste Lauf ist Julians, lokal; danach Maß 1–4.

## Wie lang ist ein Link — und warum kein Kürzer

Julian, 2026-10-04: „but then shared links are gigantic? can we use an url shortener to go around that?" Gemessen an neun echten Werk-IDs und achtstelligen Cover-IDs:

| Form | Länge |
|---|---|
| heute: `buyitscovers.com/9?w=OL…W,…&c=ol-…,…&by=Julian` | **238 Zeichen** |
| kompakt: Zahlen in Basis 36, ein Pfadsegment, `buyitscovers.com/9/a1fz.7gxh3-p1ar.7gy8v-…?by=Julian` | **134 Zeichen**, ohne Speicher |
| eigene Kurz-ID: `buyitscovers.com/9/k3x9q2ab` | ~35 Zeichen, braucht Speicher |

**Wo die Länge zählt, ist kleiner als gedacht:** X zählt jeden Link als 23 Zeichen (t.co), WhatsApp und iMessage zeigen die Vorschaukarte statt der Adresse, Instagram nimmt gar keine Links — dort trägt das Poster die Adresse `buyitscovers.com/9`, nicht den Link des Bretts. Lang sieht ein Link nur aus, wo er als Text eingefügt wird.

**Kein fremder Kürzer (bit.ly und Co.):** er sieht jeden Klick und jede IP — die Seite verspricht, über Leser nichts zu erfassen (`/go/`, Datenschutzhinweis); Plattformen stufen Kürzer-Links als Spam-Signal ein; der Link stirbt mit dem Konto oder dem Gratis-Plan; und die Vorschaukarte zeigt bit.ly statt der Seite.

**Ein eigener Kürzer** wäre eine Kurz-ID aus dem Hash des Bretts (gleiches Brett, gleiche ID), einmal geschrieben, nie geändert, ohne Besitzer und ohne Besucher-ID — die Redis des Spiels ist da. Er bringt aber zurück, was das Format sparen sollte: eine Speicherabhängigkeit (ein schweigender Speicher macht jeden Link tot, N12) und die Frage, wie lange er Bretter hält.

**Empfehlung (Claude):** zuerst die kompakte Form (134 Zeichen, nichts gespeichert); eine eigene Kurz-ID erst, wenn der Lauf zeigt, dass Leute den Link als Text teilen. **Julian entscheidet.**

## Offene Fragen

- **Die Ausgabe sichtbar machen.** Auf dem Poster steht heute nur das Bild. Ein Jahr unter jeder Kachel („1961") würde zeigen, was Alben nicht können — braucht aber Jahr oder Verlag in der Adresse (je Platz ~5 Zeichen) oder eine Nachschau beim Rendern.
- **Titel.** „made me" ist my9albums' Satz; eigene Varianten („that I'd buy again", „on my nightstand") sind ein anderes Spiel. Julian entscheidet.
- **Auf der Seite** (eigener Punkt, nicht dieser): `next/og` mit Xanh und Jost statt sharp, die Route mit langem `s-maxage` (das Bild hängt nur an der Adresse, ist also unveränderlich), `googleBooks: false`, ein Schalter wie `HOTORNOT`, `originOf` für die Analytik (CLAUDE.md Punkt 3) und ein Signal „poster geladen" als Klasse ohne Kennung (Punkt 6/7), deutsche Fassung (§2.6: Überschrift neu geschrieben, nicht übersetzt), Spiegeldatei unter `app/de/`.
