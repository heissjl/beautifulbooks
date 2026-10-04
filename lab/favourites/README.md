# lab/favourites — „My favourite books“

Julian, 2026-10-04, nach dem Vergleich mit my9albums.org ([docs/vergleich-my9albums.md](../../docs/vergleich-my9albums.md)): „can we set up a lab idea to create an mvp for this“; dann „don't go with the 9-theme, rename it internally and externally. more about favourites or inspiration“. ROADMAP **5.18**. Hieß einen Nachmittag lang `lab/nine`.

```bash
npx tsx lab/favourites/serve.ts      # http://localhost:4333/favourites — suchen, neun wählen, Ausgabe wählen, teilen
npx tsx lab/favourites/sample.ts     # zwei Poster aus Farbflächen nach lab/favourites/out/, ohne Netz
npx vitest run lab/favourites        # Brett, Layout, Poster, Share-Texte, Kurzlinks
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
- **`links.ts`** (getestet): der **Kurzlink** `/favourites/<8 Zeichen>` für ein fertiges Brett. Die ID ist der Hash des Bretts (gleiches Brett, gleiche ID; zweimal teilen schreibt nichts Zweites; niemand kann aus den IDs die Zahl der Bretter ablesen), Basis 32 ohne 0/O und 1/l, 40 Bit. Einmal geschrieben, nie geändert, **ohne Besitzer und ohne Besucher-ID** (N11). Im Lab eine JSON-Datei (`links.json`, git-ignoriert); auf der Seite **eine eigene Redis** (Julian, 2026-10-04: „i'm thinking we should set up a second redis for it“) — `SET NX`, sonst nichts anders. Ein fehlender Eintrag heißt „This link’s board is not on record here“, nie „no such board“ (N12).
- **`layout.ts`** (rein, getestet): Story 1080 × 1920 und Post 1080 × 1350. Ein 3 × 3 aus 2:3-Covern ist selbst 2:3 und passt in keins der beiden ohne Rand; das Raster richtet sich nach der Höhe und wird zentriert. Story: Kacheln 304 × 456; Post: 232 × 348 mit 174 px Seitenrand — darum Story zuerst.
- **`poster.ts`**: das PNG mit sharp, Text als SVG in DejaVu Serif (was fontconfig findet). Titel „My favourite books“ oder „<Name>’s favourite books“; unten Name und Adresse der Seite (`buyitscovers.com/favourites`, `FAVOURITES_SITE` überschreibt; nicht `SITE_URL`, das lokal `localhost:3000` ist). Ein dunkler Haarrahmen unter jeder Kachel, damit ein schwarzes Cover nicht im schwarzen Grund verschwindet. Ein Cover, dessen Bild nicht kommt, wird eine leere Kachel, kein Fehler.
- **`share.ts`** (rein, getestet): ein Satz je Plattform — „Julian’s favourite books, in the editions they were read in. What are yours? #myfavouritebooks“ — und die Intent-Adressen von **X** (280 Zeichen, Link zählt 23), **Threads** (500), **Bluesky** (300), **WhatsApp**, **Telegram**; der Test hält den längsten Namen unter jedem Limit. **Instagram** hat keinen Web-Intent: dort trägt das Bild die Adresse, und am Telefon reicht „Share the picture…“ das PNG über die **Web-Share-API** direkt an Instagram, WhatsApp oder Messages.
- **`serve.ts` + `index.html`**: zwei Ansichten. **Bauen** (`/favourites?b=…`): „My favourite books — Nine books that stayed with you, in the editions you read them in. Pick them, then share the picture.“ Suche nur auf Enter; der Treffer kommt mit dem bekanntesten Cover; „The edition I read“ lädt die Editionen (bis 300, wie lab/walls); ◀ ▶ verschieben; Name; „Done — share it“ legt den Kurzlink an. **Geteilt** (`/favourites/<id>`): die Wand ohne Werkzeuge, jede Kachel auf die **Buchseite mit diesem Cover** (`/book/<id>/cover/<seg>`, dort Läden und Urteil); „Share the picture“ (Story, Post, Web-Share, fünf Plattformen, Copy link); **„Buy these books“** als Liste; **„Make it a collection on Buy Its Covers“** (Ziel `/create#favourites=<Brett>` — **die Seite liest das Fragment noch nicht**, das ist ein Schritt des Umzugs); „Make your own“. Rechts (am Telefon unten) **„What is Buy Its Covers?“** in drei Sätzen — Julians Versuch, ob eine Erklärung dort hingehört.

## Stand

**Gebaut 2026-10-04**, Tests grün (22), Poster-Muster aus Farbflächen angesehen, beide Ansichten bei 390 und 1280 px angesehen (kein seitliches Scrollen). **Nicht mit echten Covern gesehen:** die Sitzung, die es baute, erreichte Open Library nicht (Egress-Proxy). Der erste Lauf ist Julians, lokal; danach Maß 1–5.

## Wie lang ist ein Link — und warum kein fremder Kürzer

Julian, 2026-10-04: „but then shared links are gigantic? can we use an url shortener to go around that?“ Gemessen an neun echten Werk-IDs und achtstelligen Cover-IDs:

| Form | Länge |
|---|---|
| erste Form `?w=OL…W,…&c=ol-…,…&by=Julian` | 238 Zeichen |
| **beim Bauen:** kompakt, Basis 36, `?b=a1fz.7gxh3~…&by=Julian` | **134–145 Zeichen**, ohne Speicher |
| **beim Teilen:** Kurzlink `buyitscovers.com/favourites/k3x9q2ab` | **~45 Zeichen**, braucht die zweite Redis |

**Kein fremder Kürzer** (bit.ly und Co.): er sieht jeden Klick und jede IP — die Seite verspricht, über Leser nichts zu erfassen; Plattformen werten Kürzer-Links als Spam-Signal; der Link stirbt mit dem Konto; die Vorschaukarte zeigt bit.ly statt der Seite. Darum der eigene Kurzlink, und das Brett bleibt während des Bauens in der Adresse, damit vor dem ersten Teilen nichts geschrieben wird.

## Offene Fragen

- **Der Hashtag.** `#myfavouritebooks` ist ein Vorschlag; my9albums hatte den Seitennamen als Hashtag. Julian entscheidet.
- **Der Satz oben** und die Erklärung rechts: ein Versuch, kein Entwurf.
- **Die Ausgabe sichtbar machen.** Auf dem Poster steht nur das Bild. Ein Jahr unter jeder Kachel („1961“) zeigte, was Alben nicht können — braucht eine Nachschau beim Rendern (das Jahr steht nicht in der Adresse).
- **Auf der Seite** (eigener Punkt, nicht dieser): die zweite Redis (`LINKS_`-Variablen, `SET NX`, kein Ablauf); `/create` liest `#favourites=`; `next/og` mit Xanh und Jost statt sharp; das Poster mit langem `s-maxage` (hängt nur an der Adresse); eine `og:image`-Karte 1200 × 630 für den Kurzlink; `googleBooks: false`; ein Schalter wie `HOTORNOT`; `originOf` (CLAUDE.md Punkt 3) und ein Signal „poster gespeichert“ als Klasse ohne Kennung (Punkt 6/7); deutsche Fassung (§2.6: Überschrift neu geschrieben, nicht übersetzt) und Spiegeldatei unter `app/de/`.
