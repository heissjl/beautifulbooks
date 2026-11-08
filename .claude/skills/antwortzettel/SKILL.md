---
name: antwortzettel
description: Den Antwortzettel bauen (ROADMAP 5.6c §5.2) — Bluesky und X nach Threads der letzten Tage durchsuchen, in die eine Antwort mit Bild von der Seite passt, jede Zeile gegen die Seite prüfen, Karten holen, den Zettel unter docs/antwortzettel/<datum>.md schreiben. Postet nichts. Auslösen mit /antwortzettel, oder einen Agenten mit dem Auftrag in §8 losschicken.
---

# /antwortzettel [bsky|x|beide] [stunden]

Ein Zettel ist eine Liste von höchstens acht fremden Threads, je mit Link, Reichweite, den geprüften Fakten, einer Bildunterschrift (§5), dem Bild und dem gebauten `?via=`-Link. **Der Zettel wird geschrieben, nicht gepostet.** Posten ist Julians Wort je Eintrag (§7). Vier Zettel liegen als Muster in `docs/antwortzettel/` (2026-10-17 der erste, mit der Neuner-Welle; 2026-10-24 ein Zettel auf Zuruf zu einem einzigen Thread, mit Brett; 2026-10-31 und 2026-11-02 die Form, die gilt); der Ordner ist git-ignoriert, weil er fremde Handles hält.

Argumente: `$ARGUMENTS` — ohne Angabe beide Plattformen, 72 Stunden. `bsky` allein braucht kein Chrome und taugt für einen Agenten ohne Julian; `x` braucht sein eingeloggtes Chrome (§3).

## 0. Vor dem ersten Schritt

- `docs/umgang.md` §8 (Bluesky ohne Login) und §1 (Open Library sperrt bei Bursts) lesen; für `x` dazu §5 (X-Suche in Chrome, die Composer-Fallen). Auf dem Mac gibt es kein `timeout`, und zsh zerlegt `for p in "a b"; set -- $p` nicht — Schleifen über Adressen in Python oder mit Arrays schreiben, sonst laufen Abrufe als ungültige Adresse ins Leere.
- **„Open Library nie direkt“ meint die Katalog-API** (`openlibrary.org/search.json`, `/works/…json`): die fragt die Seite für uns über `/api/search`. Der Cover-Host `covers.openlibrary.org` darf für einzelne Kacheln gefragt werden, mit Pause zwischen den Abrufen.
- `docs/plans/PLAN-5.6c-reichweite-zweiter-anlauf.md` §4 (Stilblatt S1–S8) und §5.2 (Regeln des Zettels) lesen. Der letzte Zettel in `docs/antwortzettel/` zeigt Form und Ton; seine Einträge nicht wiederholen (ein Thread bekommt eine Antwort, nie zwei).
- **Reddit ist tabu:** nicht lesen, nicht suchen, nicht zitieren. Julian nennt Reddit-Threads selbst.
- **Nie posten, nie liken, nie folgen, nichts löschen, kein Konto anlegen, keine Zugangsdaten eintippen.** Ein Agent, der im Chrome arbeitet, liest dort nur.

## 1. Bluesky suchen (ohne Login)

```bash
python3 -I lab/kalender/zettel_bsky.py docs/antwortzettel/<datum>/bsky-candidates.json [stunden]
```

22 Begriffe, letzte 72 h (zweites Argument ändert das Fenster), öffentliche API `api.bsky.app` (nicht `public.api.bsky.app`: die gibt der Suche 403), gewichtet nach Likes + 2 × Antworten + 2 × Reposts. Felder je Zeile: `link`, `handle`, `did`, `name`, `age_h`, `likes`, `replies`, `reposts`, `text`, `alt` (die Bildbeschreibungen als ein String, mit „ / “ verbunden), `images` (die Bildadressen in voller Größe), `followers`, `bio` (seit dem 3.11., eine `getProfiles`-Anfrage je 25 Konten), `ext` (verlinkte Adresse), `queries`, `reply`, `more_from_handle` (höchstens drei Zeilen je Konto, der Rest gezählt — ein Plattenlabel-Bot füllte sonst 20 Zeilen). Vier Begriffe laufen gern in den Timeout — das ist in Ordnung, das Skript meldet sie auf stderr und macht weiter. Die Konsole zeigt die ersten 60 Zeilen mit `F<Follower>` und `img<Anzahl>`.

Lesen: die ersten 40 bis 60 Zeilen des JSON ansehen, dazu jede weitere Zeile mit Ausgaben-, Cover- oder Haul-Wörtern; `bio` und `followers` entscheiden die Rechteinhaber-Frage (§3) schon in der Liste, die `images` mit `curl` holen und mit `Read` ansehen (Pause zwischen den Abrufen; **der Browser-Bereich zeigt die Bilder eines Threads nicht**, nur den ALT-Text). Dann jeden verbliebenen Kandidaten **selbst lesen** — die Antworten im Thread holt `curl -s 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://<did>/app.bsky.feed.post/<rkey>'` (`thread.replies[].post.record.text`; der `rkey` ist das letzte Glied des `bsky.app`-Links), schneller als der Browser-Bereich, der je Seite 20–50 s braucht. Der Skript-Text ist der Köder, nicht die Entscheidung.

## 2. X suchen (nur in Julians Chrome)

X ist der Kanal mit Publikum; die Suche braucht ein eingeloggtes Konto, also Julians Chrome (Claude in Chrome). Profile und einzelne Status-Seiten sind ohne Login lesbar, die Suche nicht.

**Werkzeuge laden** (ein `ToolSearch`-Aufruf, die Chrome-Werkzeuge sind aufgeschoben):

```
select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__find,mcp__claude-in-chrome__tabs_close_mcp
```

**Login und Konto prüfen:** `tabs_context_mcp {createIfEmpty: true}`, dann `navigate` nach `x.com/home` und `find "profile link or Sign in button"` — der Profil-Link trägt das Handle (`/heissjl` oder `/buyitscovers`): **im Zettel-Kopf das Konto nennen**; fürs Lesen ist beides recht, fürs Posten nach §7 muss es @buyitscovers sein (am 3.11. war @heissjl eingeloggt). Steht da „Sign in“ oder antwortet Chrome nicht (zwei Instanzen: `switch_browser`, Julian klickt „Connect“), **aufhören und melden** — den Zettel mit Bluesky allein schreiben, X als „heute ausgefallen“ im Kopf. Ein Agent fragt Julian nicht nach dem Login und tippt nie Zugangsdaten.

**Zwei Suchen in der Top-Ansicht** (`x.com/search?q=<query>&src=typed_query`, ohne `f=live`; Datum = heute minus vier Tage, die Anfrage URL-kodiert):

1. Cover-Begriffe (seit dem 31.10.): `("book covers" OR "book cover" OR "nine books" OR "which edition" OR "penguin classics" OR "folio society" OR "sf masterworks" OR "clothbound") since:<JJJJ-MM-TT> min_faves:30`
2. Hauls und Ausgaben (seit dem 2.11.): `("first edition" OR "this edition" OR "favorite edition" OR "favourite edition" OR "book haul" OR "my bookshelf" OR "cover art") (book OR novel OR paperback) since:<JJJJ-MM-TT> min_faves:40`

Höchstens vier Suchen je Lauf (X drosselt die Suche); die Latest-Ansicht (`&f=live`) nur, wenn eine Welle läuft und die Top-Ansicht sie schon zeigt. **Suche 2 ist mit demselben `since` nach drei Tagen erschöpft** (4.11.: 28 von 41 Treffern schon in einem Zettel) — an Folgetagen `since` auf zwei Tage setzen oder `min_faves` senken; Suche 1 bringt dann die neuen Treffer, ergänzt um `OR "deluxe edition" OR "modern classics"`. Ein Ausschluss der Grok-Bilder über den Text (`-"Grok Imagine"`) filtert nichts, das Etikett sitzt im Bild — die Scherzkonten stehen im Zettel unter „Nicht“ und werden überlesen.

**Ergebnisse lesen:** `read_page` (ohne Filter) liefert jeden Beitrag vollständig — Konto, Status-Link, Text, Alt-Text der Bilder, Zitat und das `group`-Label „30 replies, 43 reposts, 928 likes, 372 bookmarks, 45778 views“; rund 30 k Zeichen je Seite, die Hälfte Seitenleiste. **Die Liste ist virtualisiert:** nach dem Scrollen sind die ersten Beiträge aus dem DOM — also **vor dem ersten Scroll** sammeln (`window.__z` aus `article`-Elementen: Status-Link, Handle, Text, `group`-Label), dann `window.scrollBy(0,3000)` per `javascript_tool` und drei Sekunden warten (lädt nach, ohne Screenshot; `computer scroll` mit 10 Ticks bewegt wenig), sammeln, wieder scrollen — sechs Schritte geben rund 40 Treffer; je Schritt an `window.__z` anhängen, Duplikate über den Status-Link. **Die Medienpfade stehen schon in der Suchliste** (`img`-Quellen je `article`): die Fotos der Kandidaten lassen sich holen und ansehen, bevor eine Status-Seite geöffnet wird — am 4.11. 20 Fotos vor dem ersten Status-Aufruf, sechs Status-Seiten statt zwanzig. `browser_batch` nimmt höchstens 25 Aktionen. **Follower vor Likes:** ein Post mit 36 Likes kam von einem Konto mit 132.400 Followern — vor dem Kürzen der Liste je Kandidat das Profil im Browser-Bereich lesen (ohne Login, rund 5 s), nicht nur nach Likes und Aufrufen schneiden. `get_page_text` gibt auf X nur den ersten Artikel, und **`javascript_tool` wird nach rund 600 Zeichen abgeschnitten** — Listen aus dem DOM in `window.__z` legen und in Scheiben lesen (`JSON.stringify(window.__z.slice(0,4))`). Kandidaten mit Link, Handle, Text und Zahlen in eine Datei `docs/antwortzettel/<datum>/x-candidates.md` schreiben, bevor weitergelesen wird.

**Befund vom 2.11.:** die Hauls mit Fotos tragen (2.000 bis 45.000 Aufrufe), und die Fotos zeigen genau die Ausgaben, die die Seite auf der Wand hat — die Antwort ist die Wand des Buchs, das im Haul liegt. Die Cover-Begriffe bringen vor allem Rechteinhaber; „best cover“ und „this edition“ allein liefern Musik, Spiele, Fußball. Auf X trägt ein laufendes Format (die Klassiker-Neun, 30.575 Aufrufe am ersten Tag) mehr als jede Suche nach Ausgaben.

**Je Kandidat** (Status-Seite `x.com/<handle>/status/<id>` in Chrome öffnen, vier Sekunden warten):

- **Thread lesen:** `read_page` zeigt den Beitrag und die ersten Antworten (Ton, ob jemand schon die Ausgabe nennt).
- **Zahlen:** das `group`-Label des ersten Artikels, mit Lesezeitpunkt in den Zettel: `[...document.querySelectorAll('article')].slice(0,1).map(a=>a.querySelector('[role=group]')?.getAttribute('aria-label'))`. Eine Funktion auf `window` überlebt `navigate` nicht — je Status-Seite ein IIFE mitschicken, das Zahlen, Text (140 Zeichen), Medienpfade und die ersten drei Antworten (je 60 Zeichen) zusammen zurückgibt; das passt in die 600 Zeichen.
- **Bilder ansehen** (der Alt-Text reicht nicht, die Ausgaben stehen auf dem Foto): im DOM die Medien-Pfade holen — `window.__z=[...document.querySelectorAll('img')].map(i=>i.src).filter(s=>/twimg\.com\/media/.test(s)).map(s=>new URL(s).pathname)` (nur den Pfad zurückgeben: Adressen mit Abfrageteil blockt das Werkzeug als „Cookie/query string data“), dann je Pfad ohne Login `curl -s -o <datei>.jpg 'https://pbs.twimg.com/media/<id>?format=jpg&name=large'` (geprüft 3.11.: 200, image/jpeg, 335 KB) und mit `Read` ansehen. Direkt nach dem Laden sind die Bilder manchmal noch nicht im DOM — dann zwei Sekunden warten und noch einmal fragen.
- **Profil für die Rechteinhaber-Frage:** `x.com/<handle>` im Browser-Bereich der Desktop-App (ohne Login lesbar) — `get_page_text` gibt dort nur den ersten Artikel und `[data-testid=UserDescription]` gibt es ohne Login nicht; `document.body.innerText.split('\n').slice(0,30)` in `javascript_tool` hält Name, Handle, Bio und Follower. Chrome bleibt für die Suche.
- **Nichts klicken, was eine Handlung ist:** kein Like, Follow, Repost, keine Antwort, kein „Show more“ in fremden Threads, das einen Dialog öffnet. Nur Lesen und Scrollen. Am Ende die eigenen Tabs schließen (`tabs_close_mcp`).

**Ohne Chrome** (ein Agent ohne Julian): X-Status-Seiten, die Julian oder ein früherer Zettel nennt, sind im Browser-Bereich ohne Login lesbar (Text, Zahlen, Alt-Text), und die Bilder kommen über den Pfad wie oben; neue Threads finden geht nur mit Suche, also nicht.

## 3. Aussortieren

Weg kommt:

- **Rechteinhaber:** Gestalter, Illustratoren, Verlage, Autoren mit eigenem Buch, Agenturen, Design-Blogs (Julians Regel vom 2026-10-07, keine Ansprache). Das Profil entscheidet, nicht der Post.
- **Werkzeug- und Verkaufsposts** (Bücher zu verkaufen, Apps, Newsletter), Scherztitel in fremden Threads, Posts, in denen „cover to cover“ „durchgelesen“ heißt.
- **Dünne Wände:** Fantasy und Neuerscheinungen mit drei Ausgaben haben nichts zu zeigen — vorher die Wand ansehen (§4).
- **Schon beantwortet:** ein Handle, dem ein früherer Zettel schon **geantwortet** hat (gepostet, nicht nur entworfen), bekommt frühestens nach Wochen die nächste Antwort; ein nur entworfener Eintrag sperrt nicht, aber ein Handle bekommt je Zettel eine Zeile — ein neuer, besserer Post desselben Kontos ersetzt den Entwurf. Prüfen: `grep -oh '@[A-Za-z0-9_.-]*' docs/antwortzettel/*.md | sort -u`. Ein Thread, der in einem früheren Zettel **gestrichen** wurde, darf wiederkommen, wenn sich die Seite geändert hat (B4 vom 31.10. fiel, weil keine Sammlung die gelben Masterworks hielt; seit dem 1.11. gibt es die Sammlung — am 2.11. wurde er B5): dann mit Verweis auf den alten Eintrag und dem Grund, warum es jetzt geht.
- **Profile, die KI ablehnen** („No AI No NFTs No Crypto“ in der Bio): die Seite ist mit Claude gebaut, eine Antwort dort wäre kein Gespräch, sondern ein Streit (17.10., 11.480 Follower, trotzdem nein).
- **Comics, Manga, Kinderbuchreihen:** Open Library hat die Ausgaben meist nicht, und eine Reihe, die niemand auf der Seite geprüft hat (Goosebumps, 49 Likes), bekommt keine Zeile über unseren Bestand.
- **Institutionen** (Project Gutenberg, Verlagskonten, Bibliotheken): nein, wie Rechteinhaber.
- **Gebrückte Konten** (Handle auf `….ap.brid.gy`, Bio „bridged from … follow @ap.brid.gy to interact“) sind Mastodon-Konten; eine Bluesky-Antwort erreicht sie nur, wenn das eigene Konto gebrückt ist — streichen, mit Vermerk.
- **Bots und Dauerposter:** mehr als drei Treffer eines Kontos sind ein Verkaufs- oder Label-Bot, das Skript kappt sie.
- **Alter gegen Größe:** auf X ist ein Post nach einem Tag durch — außer er hat Hunderte Likes oder wird zitiert (ein Post mit 700 Likes wurde nach vier Tagen noch gelesen, die Klassiker-Neun wuchs zwei Wochen lang); auf Bluesky lebt ein Thread 24–48 h. Zahlen im Zettel immer mit dem Lesezeitpunkt, sie altern.
- **Laufende Formate sind der Haken:** eine Welle („nine books“, Klassiker-Neun), eine tägliche Challenge (#Buch-Challenge, #Booktober, über „Buchcover“ zu finden) — dort passt die Seite als Antwort; die Suche nach Ausgaben allein trägt auf X nicht. Zitat-Poster einer Welle bekommen keine Kopie der Antwort, höchstens einen Like von Julian.

Bleiben: Hauls und Regalfotos mit erkennbaren Ausgaben, Jahrestage („#OTD erschienen“), Fragen nach einer Ausgabe oder Übersetzung, Meinungen über Cover, Fotos alter Taschenbücher, Reihen-Posts (Masterworks, NYRB, Penguin), deutsche Buch-Challenges. Höchstens acht Einträge, X und Bluesky zusammen; lieber vier gute als acht halbe.

## 4. Jede Zeile gegen die Seite prüfen (Pflicht seit 2026-10-31)

Am 31.10. hätte der Zettel zwei gelbe Gollancz-Bände von 2022 mit „the numbered run, 1 to 73, in order“ beantwortet — ein Design, das keine Sammlung hielt. Seitdem gilt für jede Zeile, die ein Buch, eine Ausgabe, eine Reihe oder eine Zahl nennt:

1. **Werk finden:** `curl -s 'https://buyitscovers.com/api/search?q=<titel>'` → `works[0].id`, `title`, `authors`, `firstPublishYear`, `editionCount`; **fünf Sekunden Abstand** zwischen zwei Suchen (die Seite fragt dafür Open Library, umgang.md §1). Titel und Autor im Ergebnis mit dem Foto abgleichen (eine ISBN aus dem Gedächtnis hat schon einmal das falsche Buch getroffen; bei Zweifel `/api/isbn/<isbn>` mit der ISBN vom Foto).
2. **Wand ansehen:** `https://buyitscovers.com/book/<id>` im Browser-Bereich öffnen, **zuerst den Titel der Seite lesen** (h1 und `<title>`): Open Librarys Werktitel kommt bis auf die Karte, und am 3.11. hieß *The Hobbit* dort „Reliable List of Expedia™ Customer Service Phone Numbers …“ (Vandalismus, Revision 28) — ein falscher Titel heißt keine Zeile und eine Meldung an die Hauptsitzung. Dann prüfen, ob die Ausgabe vom Foto darauf steht. **Die Wand lädt seitenweise:** `[data-cover-id]` nach 10–20 s listet nur die erste Seite (18 von 44 Kacheln) — bis zum Ende scrollen (`window.scrollTo(0, document.body.scrollHeight)`, warten, wiederholen, bis die Zahl steht) oder im Zettel sagen, wie viele Kacheln geprüft sind („unter den 15 geladenen von 23 nicht“). Fremdsprachige Ausgaben liegen hinter dem Sprachreiter: `[...document.querySelectorAll('[role=tab]')].find(t=>/Swedish/.test(t.innerText)).click()` in `javascript_tool` schaltet ihn auch im versteckten Browser-Bereich, danach liefert `[data-cover-id]` die Kacheln des Reiters. Der Seitentext nennt nur Verlag und Jahr je Kachel; die Bilder vergleichen geht so: `javascript_tool` liest `[data-cover-id]` mit Beschriftung, eine Open-Library-Kachel `ol:<n>` ist `https://covers.openlibrary.org/b/id/<n>-M.jpg` (`curl -L`, die Adresse antwortet oft 302), eine Google-Kachel `gb:<id>` ist `https://buyitscovers.com/img/M/gb-<id>`; die Bilder mit `Read` ansehen. **Die Beschriftung einer Kachel kann ein anderer Druck desselben Bildes sein** (das Dell-Cover von *A Wrinkle in Time* steht unter „Perfection Learning 1979“) — das Bild entscheidet, nicht das Etikett; die Zeile nennt dann das Bild, nicht den Druck. Steht die Ausgabe nicht darauf, darf die Zeile sie nicht als „on our wall“ versprechen — dann eine Zeile über die anderen Ausgaben, oder keine Antwort; „not on our wall yet“ verspricht etwas, also „not on our wall“ oder gar nichts.
3. **Reihe bestimmen, bevor sie genannt wird:** Reihe und Druck lesen (`docs/ausgaben-recherche.md`, `docs/reihen-recherche.md`), dann die Sammlung finden: `data/collections.json` (`slug`, `title`, `works`), aber **die Datei ist nicht, was die Seite zeigt** — ob eine Sammlung veröffentlicht ist, sagt nur ein Abruf von `https://buyitscovers.com/collections/<slug>` (200 oder 404, **ein** Abruf je Prüfung und Tag — hat der Zettel desselben Tages die Seite schon abgerufen, gilt sein Befund, kein zweiter Abruf). Das gilt in beide Richtungen: `published: true` in der Datei und 404 auf der Seite kommt vor, `published: false` und 200 auch (die schwarzen Bänder, 4.11.) — der Live-Zustand liegt im Snapshot, nicht in der Datei, und das ist so gewollt. Hält die Sammlung das Buch nicht, sagt die Zeile das nicht („kein Nile bei Tom Adams“ → die Zeile verweist auf die Reihe, verspricht kein Nile-Cover).
4. **Zahlen von der Seite:** `editionCount` ist Open Librarys Ausgabenzahl („188 printings on record“); die Wand zeigt oft weniger Cover, und **ihr Zähler fällt beim Falten im Browser** (62 → 48 binnen Sekunden) — eine Coverzahl nur von der fertig gefalteten Seite, oder keine. Das Jahr der Seite („Open Library dates the book to …“) ist ein Zitat, kein Befund (6.16): weicht es vom Post ab, kommt kein Jahr in die Zeile, und der Fall geht als Zeile an die Hauptsitzung. Eine Zahl kommt in die Zeile nur mit der Quelle in der Zettel-Notiz. **Keine Vollständigkeitswörter** („every“, „all“, „complete“), es sei denn die Reihe ist abgeschlossen und die Sammlung hält sie ganz (die yellows: 21 von 21, Quellen in `reihen-recherche.md`); ein Reihen-Intro, das „often“ sagt, wird nicht zu „every“.
5. **Karte holen und ansehen** (eine Anfrage je Karte, Produktion ist dafür in Ordnung):
   - Buch: `curl -s -o docs/antwortzettel/<datum>/<slug>-card.png 'https://buyitscovers.com/book/<id>/opengraph-image'` (die Karte kommt als `image/jpeg`, der Name `.png` ist Gewohnheit; für die Zwischenablage in §7 nach `.jpg` kopieren)
   - Sammlung: `…/collections/<slug>/opengraph-image`
   - Jahrzehnte-Seite oder Wand als Screenshot im hellen Schema: `npx tsx lab/video/screen/shot-light.ts <url> <out.png> 1200 675 2` (umgang.md §6; „Chrome did not start“ heißt ein alter headless Chrome auf Port 9353). **Aus einer Agenten-Sandbox läuft das nicht** (der DevTools-Client erreicht Chrome nicht, auch auf einem frischen Port): ein Agent nimmt `chrome --headless=new --screenshot=<out> --window-size=1200,900 --force-device-scale-factor=2 --virtual-time-budget=9000 <url>` (dunkel, 45 s) und sagt im Zettel, dass das helle Bild die Hauptsitzung macht, bevor gepostet wird.
   Eine Karte, die ein Zettel desselben Tages schon geholt hat, wird kopiert, nicht neu geholt. Jede Karte mit `Read` ansehen und im Zettel sagen, was sie zeigt (vier verschiedene Cover sind gut; ein Leineneinband, eine „No image available“-Kachel oder drei Übersetzungen sind schwach — dann die Wand als Screenshot). Der Screenshot mit 1200 × 675 zeigt Kopf und erste Reihe; liegt das gemeinte Cover darunter, die Höhe erhöhen (1200 × 1200) oder im Zettel sagen, dass es unter dem Falz liegt. Zeigt die Karte Übersetzungen und das gemeinte Cover steht nur auf der Wand, sagt der Zettel genau das; eine Wand, die das Cover vom Foto nicht hält, wird nie als „his cover“ angeboten.
6. **Meinung von Befund trennen:** „best-dressed“, „near the top of the wall“, „the paperbacks put the devil on the front“ sind Meinung und stehen im Zettel als solche in der Notiz; „97 printings on record“ ist Befund mit Datum. Was der fremde Post behauptet (Erstausgabe 1927) und die Seite anders sagt (1928), wird nicht übernommen und nicht korrigiert — im Zettel vermerkt als „nicht geprüft, welches stimmt“.
7. **Erst das Bild:** was auf dem Foto erkennbar ist, steht in den Fakten; „which one?“ fragt der Zettel nicht (31.10., B5: der Umschlag war erkennbar).

## 5. Fakten und Bildunterschrift (seit 2026-11-08)

Der Zettel liefert je Eintrag **geprüfte Fakten und genau eine Bildunterschrift, keine Varianten, keine Pointe**. Die Zeile mit Haltung schreibt Julian, oder er nimmt die Unterschrift. Grund: von fünf Zetteln hat er keine geschriebene Pointe genommen („none of these sound organic“, 17.10.; „keiner außer uns wird verstehen was hier ‚folden‘ heißt und es interessiert auch niemanden. ein guter witz ist es auch nicht … die antworten sind einfach nicht auf dem niveau“, 4.11.), seine eigenen Zeilen dagegen trugen: „Tom Adams' Agatha Christie covers for Fontana, 1963–1979“, „The Great Gatsby, decade by decade since 1925.“, „don't gatekeep the editions“.

**Die Fakten** (für Julian, nicht zum Posten): was auf dem Foto liegt (Titel, Verlag oder Reihe, Jahr, Gestalter, wenn belegt), ob genau dieses Cover auf der Seite steht und mit welcher Kachel, was das mitgeschickte Bild zeigt, worüber der Thread gerade redet.

**Die Unterschrift** beschreibt das Bild, das mitgeht, nicht den Post und nicht die Seite:

- **Muster:** `<Titel oder Reihe>, <was zu sehen ist>, <Verlag und Jahr, wenn belegt>.` Ein ganzer, schlichter Satz oder eine Bildunterschrift mit Subjekt. Wer das Buch nicht kennt und die Seite nie gesehen hat, versteht ihn.
- **Beispiele, geprüft:** `The New York Trilogy, editions since 1987. Art Spiegelman's Penguin cover is in the top row.` · `Penguin Classics, mid-1980s to early 2000s: cream frame, black panel, a period picture for each book.`
- **Nur Belegtes:** jedes Wort kommt vom Foto, aus dem Post oder von der Seite (§4). Ein Gestaltername nur mit Quelle, ein Jahr nur, wenn die Seite nicht widerspricht (die Seite sagt „Editions here run from 1982“ → kein „since 1976“; ein Jahr aus 6.16 wie *War and Peace* 1845 → gar keins).
- **Keine Innenwörter:** wall, fold/folded, tile, tab, on record, printings, editions checked, our wall, the counter, „at last count“.
- **Kein Witz und keine Metapher:** nichts mit wardrobe, uniform, outfit, clothes, dressed, worn; keine Anspielung auf den Post, keine Frage ans Publikum, kein „we“.
- **Nichts über das Exemplar des Posters** („yours is here“): ob es auf der Seite steht, gehört in die Fakten.
- **Form:** englisch, deutsche Threads deutsch (17.10. B5, 31.10. B1); kein Gedankenstrich, keine Hashtags, keine Quellenangabe, kein Disclaimer, keine Zahl von Covern (der Zähler fällt beim Laden); kein Fragment wie „the pulp one, and the 35 others“.

Passt keine Unterschrift zum Bild, ist das Bild falsch: ein besseres holen (§4.5) oder den Eintrag streichen.

**Links:** auf X nie in der ersten Antwort, sondern als zweite darunter, allein; auf Bluesky hinter der Unterschrift. Buch `buyitscovers.com/book/<id>?via=bluesky` bzw. `?via=x`, Sammlung `buyitscovers.com/collections/<slug>?via=…`, Jahrzehnte `buyitscovers.com/book/<id>/decades?via=…`.

## 6. Den Zettel schreiben

Datei `docs/antwortzettel/<JJJJ-MM-TT>.md`, Bilder in `docs/antwortzettel/<JJJJ-MM-TT>/`. Form wie die Muster:

```
# Antwortzettel, <Wochentag> <Datum> (Julian: „<sein Auftrag>“ — bei einem Agentenlauf der Anfang des Auftragstexts)
<Wie gesucht: Skript, Fenster, Trefferzahl; X-Suchen mit since/min_faves; Regeln in einem Satz; wer aussortiert wurde (Rolle, nicht nur Name).>
**Befund:** <ein Absatz: was diese Woche trägt>
## X (Bild und Unterschrift, Link als zweite Antwort, `?via=x`)
### X1 · @handle — „<Thema>“
- <Link> · <Datum> · **<Aufrufe>, <Likes>, <Antworten>**
- **Fakten:** auf dem Foto <Titel, Verlag, Jahr>; *<Titel>* <Werk-ID>, <editionCount> Ausgaben; das Cover vom Foto steht <ja mit Kachel / nein / nicht geprüft> auf der Seite; im Thread <worum es geht>.
- **Bild:** `<datei>`, zeigt <…>.
- **Unterschrift:** `<genau eine, nach §5>`
- **Zweite Antwort:** `buyitscovers.com/book/<id>?via=x`
**Nicht:** <aussortierte Kandidaten mit Grund>
## Bluesky (Link darf in die Antwort, `?via=bluesky`)
### B1 · …
## Eigener Post (wenn es einen Anlass gibt: neue Sammlung, Jahrestag)
## Gelernt
```

Ein Block je durchsuchter Plattform — wer nur Bluesky gesucht hat, lässt den X-Block weg und sagt es im Kopf. Bluesky-Zahlen: Likes, Reposts, Antworten, Follower des Kontos; X-Zahlen: Aufrufe, Likes, Antworten. Jede Zahl mit Datum (sie altern). **Gestrichen wird durchgestrichen, nicht gelöscht** (`~~…~~` mit dem Grund und Julians Wort): der Zettel hält auch, was nicht gepostet wurde und warum — so kam die Regel in §4 zustande. Ein Eintrag aus einem früheren Zettel, der noch gilt (ein wachsender Post), wird mit Verweis auf den alten Zettel wiederholt, nicht neu gebaut. Unter „Gelernt“ nur, was der nächste Zettel braucht (eine Suchformel, eine Falle) — und dasselbe als datierte Zeile in `docs/umgang.md`, wenn es ein Werkzeug betrifft.

Nummerierung je Zettel neu ab B1 bzw. X1 (ein Testlauf neben einem bestehenden Zettel zählt weiter). Dann: Abschnitt in `docs/history.md` (`## <Datum> — <n>ter Antwortzettel (ROADMAP 5.6c)`: Suche, Trefferzahlen, was aussortiert wurde und warum, welche Prüfungen nach §4 liefen, „nichts gepostet“), Commit „5.6c: <n>th reply list — <Befund in einem Halbsatz> (docs only)“, kein Push. Den Zettel und die zwei, drei besten Karten mit `SendUserFile` schicken (ein Agent hat das Werkzeug nicht — er nennt die Pfade, die Hauptsitzung schickt); im Bericht an Julian: Zahl der Einträge, der Befund, und dass nichts gepostet ist.

## 6a. Zettel auf Zuruf: ein genannter Thread, ein Brett

Nennt Julian selbst einen Thread (auch einen von Reddit — den baut er, Claude liefert Bild und Satz), ist der Zettel ein einziger Eintrag, oft mit einem Shelf-Portrait-Brett als Antwort auf eine Neuner-Liste (Muster: 2026-10-17 X1, 2026-10-24). Dann:

- **Die neun in der Reihenfolge der Liste**, Zeile für Zeile; je Buch die Ausgabe, mit der man anfangen sollte oder die der Thread meint, über die ISBN-Suche der Seite (`/api/search?q=<isbn>`, `/api/isbn/<isbn>`) oder Open Librarys Editionsliste des Werks (fünf Sekunden Abstand, Kontaktbogen der Cover ansehen). **Titel im Ergebnis prüfen** — eine ISBN aus dem Gedächtnis traf schon *Untouchable* statt Penguin. Verworfene Alternativen mit Cover-ID im Zettel nennen, damit Julian tauschen kann.
- Das Brett in der Adresse (`lib/inspiration/board.ts`), **nur volle Bretter** haben Poster und Karte (`?b=` mit neun Paaren, sonst 400); die Unterzeile (`sub=`) darf nichts behaupten, was ein Buch des Bretts nicht erfüllt („in German paperbacks“ war falsch, als die NYRB-Ausgabe darin lag). Ein Cover, das in Open Library an einem Doppel-Werk hängt, bekommt im Brett das richtige Werk.
- **Das Bild zum Posten kommt aus der Produktion:** Editor-Link öffnen, „Share“ — unter `next dev` liefen die neun L-Bilder vom Internet Archive ins Zeitlimit. Alt-Text: die neun Titel in Brett-Reihenfolge, „Made on buyitscovers.com.“
- Unterschrift oder Julians Zeile ohne Link unter dem Post, der Link in der zweiten Antwort („Made with buyitscovers.com/shelfportrait?via=x — pick the book, then pick its cover.“); ein eigener Zitat-Post höchstens einer am Tag.

## 7. Posten auf Zuruf (nur mit Julians Wort je Eintrag)

Erst wenn Julian einen Eintrag nennt („poste B1“, „poste du diese variante“). Beides in seinem Chrome, Konto `buyitscovers.com` bzw. `@buyitscovers`:

- **Bluesky-Antwort mit Bild:** Status-Seite öffnen, „Reply“ (`find`), in den Composer klicken, Zeile tippen; das Bild vorher in die Zwischenablage: `osascript -e 'set the clipboard to (read (POSIX file "<pfad>.jpg") as JPEG picture)'` (eine `.png`, die JPEG-Daten hält, vorher nach `.jpg` kopieren), dann `cmd+v` im Composer, „Add alt text“ ausfüllen, „Save“, „Publish reply“. **Prüfen ohne Login:** `curl 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=buyitscovers.com&filter=posts_with_replies&limit=3'` — die Antwort steht mit `reply.parent` und einem Bild oben. Ein Bild verdrängt die Link-Karte; der Link bleibt im Text.
- **X-Antwort mit Bild, Link als zweite Antwort:** die Fallen aus umgang.md §5 (2026-10-22 und 2026-10-31): der Modal-Composer verliert Text — den **Inline-Composer** der Status-Seite nehmen; `find "Post button"` liefert gern „Add post“ (legt einen leeren zweiten Beitrag an → „Remove post“, dann „Post“); Bild über `file_upload` auf das versteckte `input type=file`; nach dem Posten leitet X nach `/i/graduated-access` um und ein „Reply“-Klick tippt in die Suchleiste — **die eigene Antwort als Status-Seite öffnen** und erst dort den Link als zweite Antwort tippen. Prüfen: das Profil `x.com/buyitscovers` im Browser-Bereich ohne Login lesen.
- **Bluesky-Post ohne Bild:** ein Link im Text zieht die Link-Karte; will Julian die Wand statt der Karte, Screenshot der Seite (Kopf und ein Abschnitt, umgang.md §5) und einfügen wie oben. Löschen tut nur Julian; ein gelöschter Post bleibt im Zettel stehen, mit Uhrzeit und Grund.
- Danach: `postedUrl` und Uhrzeit (UTC) in den Zettel beim Eintrag, ein Absatz in der `history.md` unter dem Zettel des Tages (Zitat von Julians Wort, Zeile, Bild, Bestätigung), Tabs schließen.

## 8. Als Auftrag an einen Agenten

Ein Agent (Agent-Tool, `general-purpose`) bekommt diesen Text als Auftrag; `bsky` geht ohne Julian, `beide` nur, wenn Claude in Chrome in der Sitzung verbunden ist, Julian dort bei X eingeloggt ist und am Rechner sitzt (für `beide` im Auftrag ergänzen: „X nach §2 in Julians Chrome: Werkzeuge mit einem ToolSearch laden, Login prüfen, bei ‚Sign in‘ oder ohne Verbindung X auslassen und melden; höchstens vier Suchen; nichts anklicken, was eine Handlung ist; Tabs am Ende schließen“):

> Baue den Antwortzettel für <Datum> nach `.claude/skills/antwortzettel/SKILL.md` im Projekt `/Users/claude-m1/projects/beautifulbooks`: Plattform <bsky|beide>, Fenster 72 h. Lies zuerst §0 bis §6 des Skills, dann den letzten Zettel in `docs/antwortzettel/` als Muster. Suche, lies jeden Thread selbst, sortiere Rechteinhaber aus, prüfe jede Zeile nach §4 gegen die Seite (ein Abruf je Prüfung, nie wiederholen; Open Library nie direkt bei Bursts), hole die Karten, schreibe je Eintrag die Fakten und genau eine Bildunterschrift nach §5 (keine Varianten, keine Pointe, keine Innenwörter), schreibe den Zettel (git-ignoriert, bleibt lokal) und den history-Abschnitt in `docs/history.md`, committe nur die history ohne Push. Poste nichts, like nichts, folge niemandem, tippe nirgends Zugangsdaten. Reddit ist tabu. Berichte am Ende: Zahl der Einträge, der Befund, welche Prüfungen etwas gestrichen haben, und was du nicht prüfen konntest.

Was der Agent **nicht** darf, steht in §0; was er zurückmeldet, prüft die Hauptsitzung gegen den Zettel (N12: ein Timeout ist kein „nichts gefunden“), bevor Julian ihn bekommt — vor allem die Unterschriften auf die Verbote aus §5, auf Vollständigkeitswörter („everything that replaced it“), auf Versprechen („yet“) und auf Behauptungen, die niemand geprüft hat („the current penguin“); der erste Testlauf am 2.11. (fünf Einträge in 16 Minuten, Bluesky allein) hatte je eine davon in drei Einträgen.
