# Vergleich mit 9things.me (2026-10-06)

Julian, 2026-10-06: „https://9things.me/ — what can we learn from this". Angesehen im Browser-Fenster der Sitzung: Startseite, der Editor für „Books" (Suche „great gatsby", ein Buch gewählt), das Bildfenster, ein geteilter Link `/g/<7 Zeichen>` als Besucher, `/top/books` und die Erklärseite `/9-things-that-define-me`. **Dabei ist auf ihrem Server ein Raster angelegt worden** (`/g/TtkJuEf`, ein Buch): „Copy link" speichert sofort, auch bei 1 von 9. Es zählt in ihren Zahlen mit; löschen lässt es sich von außen nicht.

Die Vorgänger-Vergleiche: [my9albums](vergleich-my9albums.md) (2026-10-04, nicht erreichbar) und [my9books](vergleich-my9books.md) (2026-10-05, das japanische Vorbild). Hier steht nur, was dort noch nicht steht.

## Was 9things.me ist

Derselbe Brauch (私を構成する9枚, Japan 2016; laut ihrer Erklärseite Anfang 2026 als #My9Games weltweit), aber **für alles**: Spiele, Filme, Serien, Alben, Bücher, Anime, Manga oder „A bit of everything" in einem Raster. Englisch, ohne Anmeldung, „about a minute". Bücher kommen aus **Apple Books und Open Library** (so steht es unter dem Suchfenster). Jeder Treffer ist ein Cover, ein Tipp setzt es — es gibt keine Wahl zwischen Ausgaben. Die geteilte Seite hat **keine Kauflinks**, überhaupt kein Geld ist zu sehen.

## Knöpfe und Flächen

| Fläche | Was sie tut | Haben wir? |
|---|---|---|
| Startseite | Sieben Kategorien als Kacheln, darunter „Or get specific": fertige Nischen als Chips („9 life-changing books that define me", „9 horror movies …") | ein Verweis unter der Suche |
| **„Make it specific (optional)"** | Freies Feld plus Vorschläge (life-changing, sci-fi, childhood, most reread); der Titel wird „9 sci-fi books that define me" | **nein** — Titel fest („My Shelf-Portrait") |
| Titelwahl | „9 books that define me" oder „My 9 books" | ein Satz je Größe (3/6/9) |
| Name oder @handle | optional | ja (`by`) |
| Suchfenster | die neun Plätze als Leiste oben im Fenster, Suchfeld darunter; nach der Wahl **„✓ Added The Great Gatsby"**, Feld leer und im Fokus, Rahmen springt auf Platz 2 | Sprung zum nächsten freien Platz ja (`firstEmpty`); eine Bestätigung und die Leiste im Fenster nicht |
| Reihenfolge | ziehen | ja („Arrange") |
| Look | drei Farbschemata, „Show titles" | Gründe (Paper, Unschärfe, Mosaik), „with title and author" |
| **Bild: Feed 4:5 · Square · Story 9:16** | alle drei, Vorschau, „Download" | Story und Post (4:5); **Square offen** (5.18b, Julians „zu lang" in Instagram) |
| Teilen | X, Threads, Bluesky, Facebook, Reddit, Copy link, **Copy caption** | X, Threads, Bluesky, WhatsApp, Telegram, Copy link, Copy the picture |
| **„Copy caption"** | `My 9 books that define me⏎⏎9things.me/g/TtkJuEf #My9Things #My9Books` — dazu der Satz „Instagram and TikTok take images only: save or share the image, then paste the caption" | der Link steht im Satz des Bildes; einen Knopf „Satz kopieren" für Instagram nicht |
| Geteilte Seite `/g/<id>` | Raster, rechts „What 9 books define you? — Make your own 9 books", „Or start from these picks", „See what everyone else picks" | „Start from this one", „Start a new one of your own" — gleichwertig; dazu bei uns die Kaufliste |
| **„Most picked" `/top/books`** | Rangliste „From 115 grids … updated every few minutes", „Popular niches" | nein (my9books-Vergleich, Punkt 3: erst ab einigen hundert Kurzlinks) |
| **Erklärseite** `/9-things-that-define-me` | Was der Trend ist, Herkunft, warum er sich verbreitet, Anleitung, Tipps, Formate, Hashtags, FAQ | FAQ-Entwurf unter dem Brett, `noindex` |

## Was davon trägt

1. **Die Nische im Titel ist der billigste Gewinn.** „9 sci-fi books", „childhood", „most reread" macht aus einem Raster eine Aussage, und dieselbe Person kann mehrere bauen. Bei uns passte ein kurzes Wort in die Adresse (`b=` hält das Brett schon), Bild und Link-Karte nehmen es in den Titel. Es ist freier Text auf einem geteilten Bild — dieselbe Frage wie beim Namen (`cleanName`), also mit derselben Länge und Reinigung, kein neues Speichern. Ob „My Shelf-Portrait: sci-fi" oder „My sci-fi Shelf-Portrait": Julians Wort.
2. **Ihre Rangliste zeigt, warum wir mit dem Zählen warten.** Aus 115 Rastern stehen oben acht Bücher mit **genau 12** Wahlen (*Alien Gods*, *Apple and Knife*, *Gliff*, *Nausea*, …), dann *The Vegetarian* mit 11 — das sieht nach einer Handvoll Leuten aus, die mehrere Raster gebaut haben, nicht nach Geschmack. Die Regel aus dem my9books-Vergleich (auszählen erst, wenn der Store einige hundert Kurzlinks hält, und erst ansehen) bestätigt sich; dazu: **ein Brett je Kurzlink zählt nicht dasselbe wie ein Mensch**, eine Rangliste müsste Duplikate (gleiche Bücher, gleiche Reihenfolge) zusammenlegen.
3. **Drei Formate, und ihre eigene Empfehlung lautet 4:5.** Das ist die Antwort auf unsere offene Frage zum Quadrat: sie bauen es, empfehlen aber 4:5 für Beiträge und 9:16 für Stories — wie unsere Instagram-Recherche in 5.18b. Ein Quadrat ist billig (eine dritte Größe in `posterLayout`), lohnt aber nur, wenn Julians „zu lang" das Raster meinte, nicht das Bild.
4. **„Copy caption" schließt die Lücke von Instagram.** Instagram nimmt keinen Link im Beitrag; wer das Bild dort teilt, verliert den Weg zurück zur Seite. Ein Knopf, der Satz, Kurzlink und `#shelfportrait` in die Zwischenablage legt, mit dem einen Hinweissatz — das ist die Hälfte unseres Instagram-Wegs, die heute fehlt.
5. **Die Erklärseite zielt auf das, was Leute tippen.** Gesucht wird „9 books that define me" / „books that define me", nicht „Shelf-Portrait". Wenn 5.18b (4) — Indexierung — entschieden wird, gehört diese Wendung in den Untertitel oder die Beschreibung der Seite. Eine eigene Erklärseite nur, wenn Julian das FAQ gekürzt hat; ihre Tipps sind gut gedacht („Define, don't rank", „Cover your eras", „Keep one surprise", „Top-left reads first"), müssten bei uns aber neu geschrieben werden, nicht übersetzt.
6. **Apple Books als zweite Quelle für Cover.** Die iTunes Search API ist offen, ohne Schlüssel und ohne Googles Tageskontingent, mit großen Bildern. Aber: es sind E-Book-Cover des heutigen Angebots, keine gedruckten Ausgaben, und sie tragen selten eine ISBN der Druckausgabe — für unser Versprechen (dieses Cover, diese Ausgabe kaufen) taugen sie nicht als Ausgabe. Höchstens als Bild für ein Buch, das Open Library ohne Cover führt (die „Kachel ohne Cover" aus dem my9books-Vergleich). Nicht gemessen; vor jeder Nutzung Nutzungsbedingungen und Grenzen lesen.
7. **Unser Vorsprung bleibt das Cover und der Kauf.** 9things zeigt je Treffer ein beliebiges Cover und verkauft nichts; unser Brett ist „die Ausgabe, die ich gelesen habe", mit Kaufliste. Das gehört sichtbar auf die geteilte Seite und ins FAQ — es ist der eine Grund, unser Brett statt ihres zu bauen.

**Nicht zu übernehmen:** „A bit of everything" (wir sind Bücher); die Rangliste vor Masse; ein Speichern bei „Copy link" für ein halbleeres Brett ohne Not — bei uns legt erst ein fertiges Brett einen Kurzlink an, und das bleibt so (Obergrenze `LINK_CAP`).

## Vorschlag

1. **„Copy caption"** im Teilen-Fenster, mit dem Instagram-Hinweis — Claude, klein, ohne neue Daten.
2. **Eine Nische im Titel** — Julian entscheidet Wortlaut und Stellung; technisch wie der Name.
3. **Square** nur nach Julians Antwort zu „zu lang".
4. Die Wendung „books that define me" in Beschreibung/Untertitel, **wenn** 5.18b (4) auf Indexieren entschieden wird.
