# lab/inspiration — „The books that inspired me“

Julian, 2026-10-04, nach dem Vergleich mit my9albums.org ([docs/vergleich-my9albums.md](../../docs/vergleich-my9albums.md)): „can we set up a lab idea to create an mvp for this“; dann „don't go with the 9-theme, rename it internally and externally. more about favourites or inspiration“, und am 2026-10-05 „let's go with the inspiration theme“. ROADMAP **5.18**. Hieß einen Nachmittag lang `lab/nine`, einen Abend `lab/inspiration`.

```bash
npx tsx lab/inspiration/serve.ts      # http://localhost:4333/inspiration — suchen, neun wählen, Ausgabe wählen, teilen
npx tsx lab/inspiration/sample.ts     # zwei Poster aus Farbflächen nach lab/inspiration/out/, ohne Netz
npx vitest run lab/inspiration        # Brett, Layout, Poster, Share-Texte, Kurzlinks
```

## Frage

Trägt das my9albums-Format bei Büchern — und ist **„in the edition I read“** der Haken, den Alben nicht haben? Konkret: Bauen Leute in wenigen Minuten ein Brett, das sie posten würden, ohne Konto, ohne eine einzige Google-Anfrage — und führt das Bild zurück auf die Seite, zu den Büchern und zu einer eigenen Sammlung?

## Maß (woran Erfolg erkannt wird)

1. **Zeit bis zum Bild:** Julian und mindestens zwei Freunde, je ein Brett von der leeren Seite bis zum gespeicherten Bild. Ziel unter **3 Minuten** im Median; Open Library braucht 2–7 s je Suche (N3), neun Suchen sind also schon 20–60 s.
2. **Wird die Ausgabe gewählt?** Anteil der neun Plätze, bei denen „The edition I read“ benutzt wurde. Unter 1 von 9 im Schnitt heißt: der Haken trägt nicht, das Format ist my9albums mit Büchern; dann kein eigener Grund, es auf der Seite zu bauen.
3. **Lesbarkeit am Telefon:** das Story-Bild in Instagrams Vorschau — sind die neun Cover erkennbar, ist die Adresse lesbar?
4. **Kosten je Brett:** die Zahl der Open-Library-Anfragen (der Server druckt sie) und **0 Google-Anfragen**. Bei einer Welle zählt das, nicht die Zahl der Besucher: die Suche ist 24 h gecacht, ein beliebtes Buch kostet nach dem ersten Leser nichts mehr.
5. **Die Funnels:** Klickt jemand von der geteilten Seite auf ein Buch oder auf „Make it a collection“? Im Lab nur durch Zusehen; auf der Seite über `/go/` und `originOf`.

## Was gebaut ist

- **`board.ts`** (rein, getestet, **wird auch dem Browser ausgeliefert** — `serve.ts` streift die Typen mit dem TypeScript-Compiler ab, damit Seite und Server nicht auseinanderlaufen): neun Plätze, je Werk und gewähltes Cover, in der Adresse in **kompakter Form** (`?b=a1fz.7gxh3~p1ar.7gy8v~…&by=Julian`, Zahlen in Basis 36, 134–145 Zeichen für neun Bücher mit Name statt 238 in der ersten Form). Unlesbare Plätze bleiben leer statt das Brett zu verwerfen. Ein Werk steht höchstens einmal.
- **`links.ts`** (getestet): der **Kurzlink** `/inspiration/<8 Zeichen>` für ein fertiges Brett. Die ID ist der Hash des Bretts (gleiches Brett, gleiche ID; zweimal teilen schreibt nichts Zweites; niemand kann aus den IDs die Zahl der Bretter ablesen), Basis 32 ohne 0/O und 1/l, 40 Bit. Einmal geschrieben, nie geändert, **ohne Besitzer und ohne Besucher-ID** (N11). Im Lab eine JSON-Datei (`links.json`, git-ignoriert); auf der Seite **eine eigene Redis** (Julian, 2026-10-04: „i'm thinking we should set up a second redis for it“) — `SET NX`, sonst nichts anders. Ein fehlender Eintrag heißt „This link’s board is not on record here“, nie „no such board“ (N12).
- **`layout.ts`** (rein, getestet): Story 1080 × 1920 und Post 1080 × 1350. Ein 3 × 3 aus 2:3-Covern ist selbst 2:3 und passt in keins der beiden ohne Rand; das Raster richtet sich nach der Höhe und wird zentriert. Story: Kacheln 304 × 456; Post: 232 × 348 mit 174 px Seitenrand — darum Story zuerst.
- **`poster.ts`**: das PNG mit sharp, Text als SVG in DejaVu Serif (was fontconfig findet). Titel „The books that inspired me“ oder „The books that inspired <Name>“, eine Zeile (eine Unterzeile „— Name“ druckte den Namen doppelt); unten Name und Adresse der Seite, die Adresse 40 px in der Story und 32 px im Post, damit sie am Telefon lesbar ist (`buyitscovers.com/inspiration`, `INSPIRATION_SITE` überschreibt; nicht `SITE_URL`, das lokal `localhost:3000` ist). Ein dunkler Haarrahmen unter jeder Kachel, damit ein schwarzes Cover nicht im schwarzen Grund verschwindet. Ein Cover, dessen Bild nicht kommt, wird eine leere Kachel, kein Fehler.
- **`share.ts`** (rein, getestet): ein Satz je Plattform — „The books that inspired Julian, in the editions they were read in. What inspired you? #booksthatinspiredme“ — und die Intent-Adressen von **X** (280 Zeichen, Link zählt 23), **Threads** (500), **Bluesky** (300), **WhatsApp**, **Telegram**; der Test hält den längsten Namen unter jedem Limit. **Instagram** hat keinen Web-Intent: dort trägt das Bild die Adresse, und am Telefon reicht „Share the picture…“ das PNG über die **Web-Share-API** direkt an Instagram, WhatsApp oder Messages.
- **`serve.ts` + `index.html`**: zwei Ansichten. **Bauen** (`/inspiration?b=…`): „The books that inspired me — Nine books that changed how you see things, in the editions you read them in. Pick them, then share the picture.“ Suche nur auf Enter; der Treffer kommt mit dem bekanntesten Cover; „The edition I read“ lädt die Editionen (bis 300, wie lab/walls) als M-Bilder, die gewählte bekommt einen Rahmen; ein Klick auf ein Buch rollt zu seinen Werkzeugen; ◀ ▶ verschieben; Name; „Done — share it“ legt den Kurzlink an. **Geteilt** (`/inspiration/<id>`): die Wand ohne Werkzeuge, jede Kachel auf die **Buchseite mit diesem Cover** (`/book/<id>/cover/<seg>`, dort Läden und Urteil); „Share the picture“ (Story, Post, Web-Share, fünf Plattformen, Copy link); **„Buy these books“** als Liste; **„Make it a collection on Buy Its Covers“** (Ziel `/create#inspiration=<Brett>` — **die Seite liest das Fragment noch nicht**, das ist ein Schritt des Umzugs); „Make your own“. Rechts (am Telefon unten) **„What is Buy Its Covers?“** in drei Sätzen — Julians Versuch, ob eine Erklärung dort hingehört. **Der Name der Seite steht in der Prosa kursiv** (`{{BRAND}}` → `<i class="brand">`; Julian, 2026-10-05: „use italic for mentions of the brand name“), wie die Wortmarke.

## Stand

**Gebaut 2026-10-04**, Tests grün (22). **Erster Lauf mit echten Covern am 2026-10-05**, lokal, von Claude im Browser gespielt — Zahlen, Befunde und Bilder in [docs/history.md](../../docs/history.md) unter „2026-10-05 · lab/inspiration zum ersten Mal mit echten Covern“. Nichts blockierte; acht Fehler, die erst echte Daten zeigten, sind repariert (Name doppelt auf dem Poster, Adresse zu klein, Werkzeuge und Ausgaben-Auswahl außerhalb des Bildes oder unscharf, geteilte Seite am falschen Ende, falsches „Link copied“, Werk-IDs statt Titeln nach dem Neuladen, Zurück-Taste).

| Maß | Ergebnis des ersten Laufs | offen |
|---|---|---|
| 1 Zeit bis zum Bild | 4 min 43 s — **eine Maschine mit Werkzeugpausen**; Warten auf Open Library davon gut 20 s, eine Suche allein 12,5 s | Julian und zwei Freunde |
| 2 Ausgabe gewählt | 3 von 9; bei 4 von 9 war das Standardcover unpassend, der Wechsel also halb Reparatur | Schnitt über Menschen |
| 3 Lesbarkeit | auf 390 px verkleinert: neun Cover erkennbar; Adresse jetzt 40 px = 14,4 CSS-px (war 9,8) | Instagrams Vorschau am Telefon; Schutzzonen oben und unten |
| 4 Kosten | **34** Open-Library-Anfragen (27 + geladene Editionsseiten); **0 Google**; dazu rund 340 Vorschaubilder direkt vom Browser | — |
| 5 Funnels | Kachel → Buchseite mit gewähltem Cover und Läden; `/create#inspiration=` wird nicht gelesen (bekannt) | Leser |

**Als Nächstes, Julian:** Story-Bild in Instagrams Vorschau ansehen; ein eigenes Brett mit Stoppuhr, dann zwei Freunde.

## Wie lang ist ein Link — und warum kein fremder Kürzer

Julian, 2026-10-04: „but then shared links are gigantic? can we use an url shortener to go around that?“ Gemessen an neun echten Werk-IDs und achtstelligen Cover-IDs:

| Form | Länge |
|---|---|
| erste Form `?w=OL…W,…&c=ol-…,…&by=Julian` | 238 Zeichen |
| **beim Bauen:** kompakt, Basis 36, `?b=a1fz.7gxh3~…&by=Julian` | **134–145 Zeichen**, ohne Speicher |
| **beim Teilen:** Kurzlink `buyitscovers.com/inspiration/k3x9q2ab` | **~45 Zeichen**, braucht die zweite Redis |

**Kein fremder Kürzer** (bit.ly und Co.): er sieht jeden Klick und jede IP — die Seite verspricht, über Leser nichts zu erfassen; Plattformen werten Kürzer-Links als Spam-Signal; der Link stirbt mit dem Konto; die Vorschaukarte zeigt bit.ly statt der Seite. Darum der eigene Kurzlink, und das Brett bleibt während des Bauens in der Adresse, damit vor dem ersten Teilen nichts geschrieben wird.

## Offene Fragen

- **Der Hashtag.** `#booksthatinspiredme` ist ein Vorschlag; my9albums hatte den Seitennamen als Hashtag. Julian entscheidet.
- **Der Satz oben** und die Erklärung rechts: ein Versuch, kein Entwurf.
- **„The edition I read“ oder „The cover I remember“?** Der erste Lauf wählte das blaue Cugat-Cover von *Gatsby* und bekam den Katalogeintrag „Lulu.com, 2021“ — die Buchseite bietet den Nachdruck an. Gewählt wird ein Bild, keine Ausgabe.
- **Die Auswahl ist zu lang:** 85, 146 und 25 Cover für drei Werke, neueste zuerst, ohne Sprache, Jahr nur als Tooltip, Dubletten. Sprachfilter, Jahr unter dem Bild und das Falten der Seite (`foldDuplicateCovers`) wären die Mittel; welches zuerst, nach dem Lauf mit Menschen.
- **Titel in der Sprache des Werks** („Мастер и Маргарита“, „Der Proceß“) in „Buy these books“, auch wenn eine englische Ausgabe gewählt ist.
- **Instagrams Schutzzonen** (je 250 px oben und unten): Titel und Adresse liegen darin. Erst am Telefon ansehen.
- **Die Ausgabe sichtbar machen.** Auf dem Poster steht nur das Bild. Ein Jahr unter jeder Kachel („1961“) zeigte, was Alben nicht können — braucht eine Nachschau beim Rendern (das Jahr steht nicht in der Adresse).
- **Auf der Seite** (eigener Punkt, nicht dieser): die zweite Redis (`LINKS_`-Variablen, `SET NX`, kein Ablauf); `/create` liest `#inspiration=`; `next/og` mit Xanh und Jost statt sharp; das Poster mit langem `s-maxage` (hängt nur an der Adresse); eine `og:image`-Karte 1200 × 630 für den Kurzlink; `googleBooks: false`; ein Schalter wie `HOTORNOT`; `originOf` (CLAUDE.md Punkt 3) und ein Signal „poster gespeichert“ als Klasse ohne Kennung (Punkt 6/7); deutsche Fassung (§2.6: Überschrift neu geschrieben, nicht übersetzt) und Spiegeldatei unter `app/de/`.
