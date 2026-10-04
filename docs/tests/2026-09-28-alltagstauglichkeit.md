# Alltagstauglichkeit: zwei Durchsichten vom 2026-09-28

Zwei unabhängige Durchsichten derselben Frage — was müsste sich ändern, damit ein durchschnittlicher Mensch die Seite regelmäßig und ohne Umwege benutzt —, am 2026-09-29 auf Julians Wunsch („füge beide berichte zusammen“) in eine Datei gelegt:

- **[Teil A](#teil-a-durchklick-unter-npm-run-dev)**: die Sitzung `interface-usability-improvements`, unter `npm run dev`, bei 800 px, 375 × 812 und in Julians Chrome bei 1512 × 790. Deutsch, Befunde A1–A7 und ein zweiter Durchgang.
- **[Teil B](#teil-b-durchsicht-von-außen)**: eine Durchsicht von außen, die Julian in die Sitzung `beautiful-books-ux-plan` gab (Verfasser nicht genannt), gegen **Produktion** in Chrome bei ~455 px, Dunkelmodus. Englisch, unverändert.

Beide Texte stehen unten, wie sie geschrieben wurden; nur die Überschriften sind eine Ebene tiefer gerückt. **Was daraus folgt** — welcher Befund zu welchem Roadmap-Punkt wird, was schon gebaut ist, was einer Entscheidung widerspricht und was sich als Artefakt der Messung herausstellte — steht im [Plan 6.63](../plans/PLAN-6.63-alltag.md), mit einer Tabelle über beide Teile.

## Wo beide dasselbe sehen

| Thema | Teil A | Teil B | Punkt |
|---|---|---|---|
| Sekundärliteratur zwischen den Romanen | A3 (10 von 15 Karten bei Gatsby) | §3 („Critical Insights“) | 6.81, 6.69 |
| Zahlen, die sich ändern | A4 (254 → 283 → 287) | §4 (293 / 291 / 162) | 6.71 |
| Suche schwer erreichbar | A2 (Startseite), A6 (keine Navigation) | §3 (Lupe statt Feld) | 6.76, 6.68 |
| Laden dauert, Bilder kommen spät | A1, zweiter Durchgang (leere Kacheln) | §6 | 6.75, 6.73 |
| Nichts ändert sich beim Wiederkommen | A2 (zuletzt gesucht/angesehen) | §1 | 5.8c |
| Reihenfolge der Wand | A7 (neuester Druck zuerst — als Frage) | §7 (wechselt beim Neuladen) | 6.65 |

---

## Teil A: Durchklick unter `npm run dev`


Frage von Julian: Was müsste sich an Oberfläche und Inhalt ändern, damit ein durchschnittlicher Mensch die Seite regelmäßig und ohne Umwege benutzt? Nur Beobachtungen, nichts gebaut, nichts committet. Gesehen unter `npm run dev` (Worktree `interface-usability-improvements`), Startseite, Suche „the great gatsby“, Werkseite OL468431W mit gewähltem Cover, jeweils bei 800 px Pane-Breite und 375 × 812.

### Vorbemerkung

Die Seite ist ihrer Natur nach kein Werkzeug für jeden Tag, sondern für den Moment, in dem jemand ein Buch kaufen oder verschenken will. „Regelmäßig“ entsteht nicht durch mehr Funktionen, sondern dadurch, dass die drei Wege, die es schon gibt — Suche, Sammlungen, Spiel — beim zweiten Besuch schneller und beim ersten selbsterklärend sind. Die Befunde sind danach geordnet, was einen Leser beim Wiederkommen am meisten kostet.

### Befunde

#### 1. Warten ist das größte Hindernis, und die Seite sagt nicht, wie lange

- Kalt dauerte die Suche **19,2 s** (`/api/search`, Logzeile), die Werkseite **20,9 s** und antwortete danach mit **503** („Book data source unavailable, try again shortly“). Beim zweiten Aufruf stand die Wand nach wenigen Sekunden.
- Die Ladeszene („Looking for … in Open Library“, Autorenmosaik) ist schön, nennt aber keine Erwartung. Bei 5 s wartet man, bei 20 s glaubt man an einen Fehler.
- Die Fehlseite der Werkseite hat nur „Back to search“, keinen *Try again* — die Suche hat einen (1.4). Ein Leser, der von außen (Link, Suchmaschine) kommt, landet in einer Sackgasse.
- **Vorschlag:** (a) *Try again* auch auf der Werkseite, und ein automatischer zweiter Versuch im Browser nach dem 503, bevor die Seite etwas zeigt; (b) ab etwa 8 s ein Satz, worauf gewartet wird („Open Library antwortet gerade langsam — meist unter 10 s“, 6.3 sagt das schon); (c) während Open Library sucht, sofort das zeigen, was die Seite ohne Netz weiß: Treffer aus den 500 indexierten Werken (`data/cover-index.json` hat die Titel) als „Sofort da“-Zeile über der Ladeszene. Für die Klassiker, die die meisten suchen, wäre die Suche damit augenblicklich.

#### 2. Auf der Startseite steht die Suche an dritter Stelle

- Über dem Suchfeld stehen zwei Einladungen (Spiel, eigene Sammlung). Auf dem Telefon beginnt das Suchfeld bei etwa 540 von 812 px; Überschrift, Versprechen und zwei Links kommen davor. Wer die Seite kennt und nur suchen will, scrollt oder tippt vorbei.
- **Vorschlag:** Suchfeld direkt unter das Versprechen, die beiden Einladungen darunter als eine Zeile oder in die Kopfzeile (siehe 6). Beim Wiederbesuch — es gibt `useRecentSearches` — die letzten Suchen und die zuletzt angesehenen Bücher (localStorage, ohne Server, N11-konform) als erste Reihe statt der immer gleichen 18 Klassiker (Rotation 6.17 ist offen).

#### 3. Die Trefferliste zeigt Sekundärliteratur wie Bücher

- „the great gatsby“: 15 Karten, davon **10** Sekundärliteratur, Cliffs Notes, Aufsatzbände oder Datensätze mit 2–3 Ausgaben und leerem Mosaik; drei davon heißen wörtlich „The Great Gatsby“ (Matterson, Lehan, Parkinson) und sehen für einen Laien wie der Roman aus. Das Ranking schiebt sie nach hinten (6.1), aber sie füllen das Raster mit leeren Kacheln.
- Titel kommen roh aus Open Library: „The last tycoon“, „The great Gatsby“, „Careless people“ nebeneinander mit „The Great Gatsby“.
- **Vorschlag:** Karten ohne ein einziges Cover und mit weniger als n Ausgaben hinter einen Abschnitt „Also about this book (10)“ klappen; der Roman und die Sammelausgabe bleiben oben. Titel in der Anzeige normalisieren (Title Case nur, wo der Katalog durchgehend klein schreibt).

#### 4. Zahlen, die sich beim Hinsehen ändern

- Der Zähler lief in einer Minute von „254 covers · 1,100 of 1,180 editions checked“ über „283 · 1,219 of 1,219“ zu „287 · 1,235“; die Reiter zählten mit (English 125 → 139 → 140, Unknown 52 → 65 → 68). Das ist ehrlich (Schritt 15), aber für einen Laien sieht es aus, als stimme etwas nicht.
- **Vorschlag:** während des Nachladens einen Fortschritt statt wechselnder Endzahlen („287 covers so far · loading more“), die Reiterzahlen erst nach dem letzten Stapel einblenden; der Satz unter der Wand erklärt es dann nur noch einmal.

#### 5. Kaufen liegt unter der Falte, in beiden Ansichten

- Nach dem Klick auf ein Cover zeigt die Seitenleiste: großes Bild, „Image from Open Library · on 29 editions“, **„+ Add to collection“**, „30 scans of this cover“ als Streifen, einen Erklärsatz, dann etwa fünfzehn Druck-Chips (Scribner · 2003, 2020, 2020, Classics 2018, Simon & Schuster …) mit „More ↓“. Die Läden waren bei 800 × 600 nicht im Bild; auf dem Telefon in der Schublade ebenso wenig — dort folgen sie nach Cover, Sammlung-Button, Streifen und Chips.
- Das Versprechen der Seite (§1: „die Ausgabe finden, die man im Regal haben will“) endet also erst nach zwei Bildschirmen. „Add to collection“ ist die erste Handlung, die angeboten wird — vor dem Kauf.
- **Vorschlag:** Reihenfolge in der Seitenleiste: Bild → Verdikt und **erste Laden-Reihe** → Sammlung → Scans und Drucke eingeklappt („29 printings with this cover ▸“). Die Druck-Chips braucht fast niemand offen; wer sie braucht, sucht sie. Gegenprobe mit 1.2 („fünf sichtbare Bedienelemente“): der Streifen und die Chips zählen dort offenbar nicht mit.

#### 6. Es gibt keine Navigation außer auf der Startseite

- Die Kopfzeile jeder Unterseite hat Wortmarke, Zurück und Suchfeld; Sammlungen und Spiel sind nur von der Startseite und aus dem Fuß („Your collections · About · Impressum · Privacy“) erreichbar. Wer auf einer Werkseite ist und zu den Sammlungen will, geht über die Startseite.
- **Vorschlag:** zwei Wörter in der Kopfzeile, „Collections“ und „Game“ (auf dem Telefon hinter dem Lupen-Icon oder als zweite Zeile), dazu „Your collections“, sobald `bb_visitor` gesetzt ist.

#### 7. Kleinere Dinge, die ein Laie bemerkt

- **„Unknown 68“** ist der zweitgrößte Reiter. „Unknown“ sagt einem Leser nichts; „Language not recorded“ oder „Other“ ganz hinten wäre verständlicher, und der Reiter könnte standardmäßig in „All languages“ aufgehen.
- **„Audible 2013“** steht als Kachel in der englischen Wand — ein Hörbuch-Cover, obwohl Hörbücher laut features.md „ganz wegfallen“. Entweder gilt das nur für die Ausgabenliste, oder hier fehlt der Filter; nicht gemessen, nur gesehen.
- **„Titles & authors / Author only“** als Umschalter unter dem Feld: ein Laie weiß nicht, was der zweite tut, bis er ihn drückt. Ein Platzhalter im Feld („Author only: type a name“) beim Umschalten würde reichen.
- Die Kachel-Unterschriften der Wand („Arcturus 2011“) sind Verlag und Jahr; die erste Reihe ist „neuester Druck zuerst“, darum eröffnen Arcturus, Audible und Cambridge University Press die Wand des Gatsby, nicht Scribner 1925 oder der Penguin von 1950. Für jemanden, der „das schöne Cover“ sucht, wäre eine Sortierung „häufigste zuerst“ (die Faltungszahl +28 ist ja da) oder „ältester Druck zuerst“ die interessantere erste Reihe. Das widerspricht E17/6.31 (nichts rückt nach), also nur als Frage.
- Die Startwand blendet auf dem Telefon 3 Kacheln je Reihe, sechs Reihen tief; „Collections“ kommt erst danach. Das ist konsistent mit 6.30, aber die Sammlungen — der Teil, den ein Laie am ehesten weiterschickt — sieht auf dem Telefon kaum jemand.

### Was nicht das Problem ist

Typografie, Farben, Fokus-Ringe, Telefon-Schublade, Reiter-Umbruch, Zurück-Link und Teilen-Menü funktionierten alle wie beschrieben; die Wand selbst ist der Grund, die Seite zu zeigen. Die Befunde oben sind Reihenfolge und Wartezeit, nicht Gestaltung.

### Nicht gemacht

Nichts gebaut, nichts committet. Keine Messung gegen Produktion. Die 19 s der kalten Suche sind eine Beobachtung von einer Sitzung, keine Messreihe.

### Zweiter Durchgang: in Julians Chrome (Erweiterung), 1512 × 790, Dunkelmodus

Dieselbe Seite unter `npm run dev`, diesmal mit der Chrome-Erweiterung im echten Browser: Startseite → „nineteen eighty four“ getippt und Enter → erste Karte → Kachel „+22“ gewählt → Seitenleiste bis zu den Läden gescrollt. Die Fenstergröße 390 × 844 nahm Chrome nicht an (das Fenster blieb 1512 breit), die Telefonbefunde stammen also nur aus dem ersten Durchgang.

Was der zweite Durchgang **bestätigt**: Befund 3 (11 von 17 Karten für „nineteen eighty four“ sind Sekundärliteratur, Bloom, SparkNotes, CliffsNotes, Coles, Lektürehilfen; dazu „1984“ von Fido Nesti und Samuel R. Delany, für einen Laien nicht vom Roman zu unterscheiden), Befund 5 (in der Seitenleiste kommen Bild, „Add to collection“, 23-Scans-Streifen und die Druck-Chips vor der ersten Laden-Reihe; sie liegt erst nach eigenem Scrollen der Leiste im Bild), Befund 6 (keine Navigation), Befund 7 zu „Unknown 99“ als zweitgrößtem Reiter, hier neben 20 weiteren Sprach-Chips in drei Zeilen.

Was **neu** ist:

- **Warmer Cache, aber leere Kacheln.** Die Suche antwortete in ~3 s, aber nach 13 s trug nur 1 von 5 Karten der ersten Reihe ein Mosaik; die Wand des Werks zeigte 11 s nach dem Klick noch zehn graue Platzhalter, die Bilder kamen erst nach ~16 s. Der Text ist längst da, die Bilder nicht — der Eindruck ist „kaputt“, nicht „lädt“. Ein Platzhalter, der sichtbar atmet oder einen Fortschritt trägt (die Startwand hat so etwas, 6.33), würde den Unterschied machen.
- **Der Vertreter eines gefalteten Covers kann der unbrauchbarste Druck sein.** Für das Cover mit +22 führt „Perma-Bound · 1981“ (Schulbuch-Bindung, keine ISBN): „This edition has no ISBN on record, so no shop can look it up by number“, und die einzigen Knöpfe sind „AbeBooks · title & year“ und „eBay · title & year“ — obwohl 22 weitere Drucke mit demselben Cover dahinterstehen, davon sicher welche mit ISBN (New American Library, Signet). Die Regel „der Druck, der den gezeigten Scan trug, führt“ (6.14) ist für die Nachvollziehbarkeit richtig, aber für den Leser, der kaufen will, falsch herum. Vorschlag: Scan-Träger führt nur, wenn er eine ISBN hat; sonst der erste Druck mit ISBN, und der Scan-Träger wird als Quelle genannt. Das ist eine Änderung an `orderEditionsForMarket`, keine an der Wahrheit der Seite.
- **Nach dem Abschicken liegt das Suchfeld halb unter der Kopfzeile.** Enter scrollt die Ergebnisseite so, dass die untere Kante des Felds und der Search-Knopf hinter der festen Kopfzeile stehen (Screenshot nach 3 s und nach 13 s gleich). Wer die Suche korrigieren will, scrollt erst hoch. Vermutlich `scroll-margin-top` oder das Ziel des Scrollens.
- **Markt US vorgewählt, in Deutschland.** Die Laden-Reihe steht auf „US“, obwohl der Besucher in Deutschland sitzt — Chrome meldet Englisch als Sprache, und `lib/market.ts` liest Accept-Language. Ein deutscher Leser mit englischem Browser bekommt Amazon.com. Der Umschalter ist da, aber klein und rechts vom Label; „DE“ sollte bei einer deutschen Zeitzone oder einem `de`-Anteil in Accept-Language gewinnen, nicht nur bei `de` an erster Stelle.
- **Dunkelmodus funktioniert und sieht gut aus** — in Julians Chrome ist er an, und Wortmarke, Chips, Reiter, Verlaufskanten und die Seitenleiste tragen ihn ohne Bruch. Nicht in features.md aufgeführt; gehört als Zeile dorthin.
- **Die Seitenleiste scrollt für sich**, mit eigenem Scrollbalken und „More ↓“; das Rad über der Leiste bewegt nur sie. Das ist bei Kenntnis gut, aber ein Laie, der die Läden sucht, merkt nicht, dass die Leiste mehr hat als das Bild — „More ↓“ liegt am unteren Rand und sieht wie ein Knopf für die Wand aus. Ein Hinweis in der Leiste selbst („Find this printing ↓“ unter dem Bild) wäre direkter.
- Das Mosaik der Karte „Animal Farm / Nineteen Eighty-Four“ nennt den Autor „George Orwell, George Orwel“ — ein Tippfehler aus Open Library, der auf der Karte steht. Ein Namens-Dedupe nach losem Schlüssel (Initiale + Nachname) auf der Karte würde ihn schlucken.

---

## Teil B: Durchsicht von außen

*Gesehen gegen Produktion, Chrome, ~455 CSS-px, Dunkelmodus. Unverändert.*

### Beautiful Books (beautifulcovers.vercel.app) — UX / content review

**Reviewed:** 2026-09-28, via Chrome, narrow viewport (~455 CSS px), dark theme
**Pages tested:** home, search results (`/?q=`), book wall (`/book/OL468431W`), cover detail panel (`?cover=`), by-decade view (`/book/…/decades`), share menu, versus game (`/versus`), standings (`/versus/board`), collection builder (`/create`)
**Goal of review:** what would make the site usable by an average person daily, consistently and efficiently

#### Summary

The core mechanic (search a title → see every cover it has had, by language/year → buy the one you want) is strong and the fuzzy search is better than most ("Jane Austin" resolved to Jane Austen). Nearly all problems are *daily-use friction*: the site is built for a single browsing session, not for someone who returns every day. Items are ranked by impact.

#### 1. No reason to return — build a retention loop

Nothing on the home page changes between visits: six static collections, eighteen static classics.

- Add a **"Cover of the day"** at the top of the home page (source: vote data + curated collections).
- Surface **Recently viewed** and **Your saved covers** on the home page instead of a footer link labelled "Your collections".
- Add a **recently added / recently voted-on** feed.
- The versus game already has a daily-habit shape. Add a **streak counter** and a **"your votes so far"** page. Currently a vote produces zero feedback — no "you picked the one 71 % of people pick", no animation, nothing. This is the cheapest engagement win on the site.

#### 2. Identity model blocks cross-device daily use

Collections are tied to a cookie-held ID the user is told to copy and paste to other devices, and anyone holding the ID can edit the collections. That is both a security and a usability dead-end for an everyday user.

- Add passwordless login (magic link or passkey) and migrate the cookie ID into it.
- Keep the anonymous mode for first use; say plainly "sign in to keep this on your phone".

#### 3. Search is the product, but the search box disappears

- On book and versus pages the header only shows a magnifier icon; typing needs an extra click. Keep a **persistent search field** in the header on every page; bind `/` to focus it.
- Results grid has no sort or filter (year, language, cover count). With 13 books / 12,627 editions for one author, that matters.
- Autocomplete shows a single "Popular" hit. Show 5–8 with cover thumbnails, and distinguish the *work* from *books about the work* ("Critical Insights: The Great Gatsby" by another author currently sits in the same list as the novel).

#### 4. Data-quality issues that undermine trust

- **Wrong dates shown as fact.** *The Great Gatsby* appears as 1920 everywhere (published 1925). "Open Library dates it to 1920" is honest but reads as a bug. Options: curated override for the ~1,600 books in the game, or show the earliest *edition* year in your own data (a 1925 Scribner edition exists in the wall) alongside the OL date.
- **Inconsistent counts for the same book:** 293 covers on the wall, 291 after reload, 162 on the decade page ("from 181 edition records"). Compute once server-side, cache it, and state on the decade page that it only includes editions with a known year.
- **Non-covers in results grid.** Collage thumbnails include spines, blank flyleaves, half-cropped scans. The "not a cover" reporting mechanism already exists in the game; apply that (or an aspect-ratio + entropy heuristic) before thumbnails appear in results.
- **Versus game contradicts its own copy.** Page text says "two covers of two books", but two covers of *Far from the Madding Crowd* were served against each other.

#### 5. The ranking method won't converge

- Standings state a cover is called best only after "3 rounds of 3335 votes" — ~10,000 votes before anything is declared, at 1,056 votes today.
- Interim ranking is raw win-rate on tiny samples ("won 3 of 3"), which rewards covers that drew three easy opponents.
- Switch to Elo or Bradley–Terry with a confidence interval, show rank with an uncertainty band, and pair covers with similar current ratings so each vote is maximally informative. This turns the leaderboard into something worth checking daily.

#### 6. Performance on the book wall

- Wall loads ~300 images with a "900 of 1,180 editions checked" progress bar; images pop in over several seconds; result-grid collages arrive later still. On a phone this is the dominant impression of the site.
- Fixes: paginate or virtualise the wall (e.g. 36 at a time + "show more"); serve pre-generated collage thumbnails instead of composing client-side; preload the *next* pair in the versus game while the current one is displayed; cache the edition scan per work rather than re-checking every visit.

#### 7. Interaction bugs observed

| Bug | Observation | Likely cause / fix |
|---|---|---|
| Underlined inline links not clickable by coordinate | Clicking the text of "help us find the prettiest cover" (home) and "Standings" (versus) did nothing twice; clicking the DOM element directly worked | Hit area probably a few px tall — pseudo-element underline or `display:inline` `<a>` inside flex parent. Give links `display:inline-block` + padding. |
| "Selected cover" bottom bar doesn't intercept clicks immediately | Clicking "Details" right after selecting a cover selected the cover *behind* the bar instead | Bar animates in with `pointer-events` applied late, or grid has higher z-index during transition |
| Grid order changes between loads of the same wall | First tile differed on reload | Use deterministic order (year desc, then publisher) — also gives users a scannable structure |
| Inconsistent back-links | "‹ Results", "‹ Home", "← The wall" — different glyph and destination depending on entry path | Single back-link component, consistent glyph |

#### 8. Smaller content / UX points

- Home shows 6 of 30 collections; the other 24 are only reachable via "See all" or a dropdown on `/create`. Show them all with a filter by publisher / series / award.
- Footer label "Impressum" means nothing to non-German readers; it links to `/contact` — call it "Contact".
- Cover detail panel: purchase buttons are ISBN-specific; a 2013 printing is often out of stock. Add an "any edition" fallback link.
- Add **"Save to collection"** directly on the detail panel and on versus cards. Saving currently requires going to `/create` and re-finding the book.
- Keyboard hints for the game ("← and → choose, ↓ skips") are below the fold; move them next to the covers. Add the same shortcuts on the wall (arrows move selection, Enter opens details).

#### Suggested order of work

1. Vote feedback + streak (item 1) — small, high impact
2. Persistent header search + `/` shortcut (item 3)
3. Fix the two click bugs and deterministic wall order (item 7)
4. Wall pagination + next-pair preload (item 6)
5. Date override + consistent counts (item 4)
6. Rating model change (item 5)
7. Passwordless login (item 2)
