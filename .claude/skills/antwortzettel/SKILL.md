---
name: antwortzettel
description: Den Antwortzettel bauen (ROADMAP 5.6c §5.2) — Bluesky und X nach Threads der letzten Tage durchsuchen, in die eine Antwort mit Bild von der Seite passt, jede Zeile gegen die Seite prüfen, Karten holen, den Zettel unter docs/antwortzettel/<datum>.md schreiben. Postet nichts. Auslösen mit /antwortzettel, oder einen Agenten mit dem Auftrag in §8 losschicken.
---

# /antwortzettel [bsky|x|beide] [stunden]

Ein Zettel ist eine Liste von höchstens acht fremden Threads, je mit Link, Reichweite, dem Antwortentwurf in Julians Stimme, dem Bild und dem gebauten `?via=`-Link. **Der Zettel wird geschrieben, nicht gepostet.** Posten ist Julians Wort je Eintrag (§7). Drei Zettel liegen als Muster in `docs/antwortzettel/` (2026-10-17, 2026-10-31, 2026-11-02); der Ordner ist git-ignoriert, weil er fremde Handles hält.

Argumente: `$ARGUMENTS` — ohne Angabe beide Plattformen, 72 Stunden. `bsky` allein braucht kein Chrome und taugt für einen Agenten ohne Julian; `x` braucht sein eingeloggtes Chrome (§3).

## 0. Vor dem ersten Schritt

- `docs/umgang.md` §5 (Browser-Bereich, X-Suche, Bluesky-Composer), §8 (Bluesky ohne Login) und §1 (Open Library sperrt bei Bursts) lesen.
- `docs/plans/PLAN-5.6c-reichweite-zweiter-anlauf.md` §4 (Stilblatt S1–S8) und §5.2 (Regeln des Zettels) lesen. Der letzte Zettel in `docs/antwortzettel/` zeigt Form und Ton; seine Einträge nicht wiederholen (ein Thread bekommt eine Antwort, nie zwei).
- **Reddit ist tabu:** nicht lesen, nicht suchen, nicht zitieren. Julian nennt Reddit-Threads selbst.
- **Nie posten, nie liken, nie folgen, nichts löschen, kein Konto anlegen, keine Zugangsdaten eintippen.** Ein Agent, der im Chrome arbeitet, liest dort nur.

## 1. Bluesky suchen (ohne Login)

```bash
python3 -I lab/kalender/zettel_bsky.py docs/antwortzettel/<datum>/bsky-candidates.json
```

22 Begriffe, letzte 72 h, öffentliche API `api.bsky.app` (nicht `public.api.bsky.app`: die gibt der Suche 403), gewichtet nach Likes + 2 × Antworten + 2 × Reposts. Felder je Zeile: `link`, `handle`, `name`, `age_h`, `likes`, `replies`, `reposts`, `text`, `alt` (Bildbeschreibungen), `ext` (verlinkte Adresse), `queries`, `reply`. Ein anderes Zeitfenster: die Zahl `72` im Skript ist die Grenze; für einen Zettel mit anderem Fenster das Skript kopieren, nicht die Zahl im Repository ändern. Vier Begriffe laufen gern in den Timeout — das ist in Ordnung, das Skript meldet sie auf stderr und macht weiter.

Lesen: die ersten 40 Zeilen des JSON ansehen, dann jeden Kandidaten im Browser-Bereich (ohne Login lesbar) öffnen und **den Thread selbst lesen**: wer schreibt (Profil), was die Antworten schon sagen, ob ein Bild dabei ist. Der Skript-Text ist der Köder, nicht die Entscheidung.

## 2. X suchen (nur in Julians Chrome)

Vorbedingung: Claude in Chrome ist verbunden und das Konto `@buyitscovers` ist eingeloggt (prüfen mit `tabs_context_mcp`, dann `x.com/home` laden; zeigt die Seite „Sign in“, aufhören und Julian sagen, dass X heute ausfällt — den Zettel mit Bluesky allein schreiben). Zwei Chrome-Instanzen: `switch_browser`, Julian klickt „Connect“.

Zwei Suchen in der **Top**-Ansicht (`x.com/search?q=<query>`, ohne `f=live`), Datum auf heute minus vier Tage:

1. Cover-Begriffe (seit dem 31.10.): `("book covers" OR "book cover" OR "nine books" OR "which edition" OR "penguin classics" OR "folio society" OR "sf masterworks" OR "clothbound") since:<JJJJ-MM-TT> min_faves:30`
2. Hauls und Ausgaben (seit dem 2.11.): `("first edition" OR "this edition" OR "favorite edition" OR "favourite edition" OR "book haul" OR "my bookshelf" OR "cover art") (book OR novel OR paperback) since:<JJJJ-MM-TT> min_faves:40`

**Befund vom 2.11.:** die Hauls mit Fotos tragen (2.000 bis 45.000 Aufrufe), und die Fotos zeigen genau die Ausgaben, die die Seite auf der Wand hat — die Antwort ist die Wand des Buchs, das im Haul liegt. Die Cover-Begriffe bringen vor allem Rechteinhaber. Was auf X nichts taugt: „best cover“ (Musik, Spiele), „this edition“ allein.

Lesen: `read_page` liefert jeden Beitrag vollständig (Konto, Status-Link, Text, Alt-Text der Bilder, Zahlen im `group`-Label); `javascript_tool` wird nach rund 600 Zeichen abgeschnitten, `get_page_text` gibt nur den ersten Artikel. Zweimal nach unten scrollen reicht; X lädt nach. Jeden Kandidaten als Status-Seite öffnen und den Thread lesen. **Nichts klicken, was eine Handlung ist** (Like, Follow, Repost, Antwort) — nur Lesen und Scrollen. Am Ende die eigenen Tabs schließen.

## 3. Aussortieren

Weg kommt:

- **Rechteinhaber:** Gestalter, Illustratoren, Verlage, Autoren mit eigenem Buch, Agenturen, Design-Blogs (Julians Regel vom 2026-10-07, keine Ansprache). Das Profil entscheidet, nicht der Post.
- **Werkzeug- und Verkaufsposts** (Bücher zu verkaufen, Apps, Newsletter), Scherztitel in fremden Threads, Posts, in denen „cover to cover“ „durchgelesen“ heißt.
- **Dünne Wände:** Fantasy und Neuerscheinungen mit drei Ausgaben haben nichts zu zeigen — vorher die Wand ansehen (§4).
- **Schon beantwortet:** ein Handle, dem ein früherer Zettel schon geantwortet hat, bekommt frühestens nach Wochen die nächste Antwort.

Bleiben: Hauls und Regalfotos mit erkennbaren Ausgaben, Jahrestage („#OTD erschienen“), Fragen nach einer Ausgabe oder Übersetzung, Meinungen über Cover, Fotos alter Taschenbücher, Reihen-Posts (Masterworks, NYRB, Penguin), deutsche Buch-Challenges. Höchstens acht Einträge, X und Bluesky zusammen; lieber vier gute als acht halbe.

## 4. Jede Zeile gegen die Seite prüfen (Pflicht seit 2026-10-31)

Am 31.10. hätte der Zettel zwei gelbe Gollancz-Bände von 2022 mit „the numbered run, 1 to 73, in order“ beantwortet — ein Design, das keine Sammlung hielt. Seitdem gilt für jede Zeile, die ein Buch, eine Ausgabe, eine Reihe oder eine Zahl nennt:

1. **Werk finden:** `curl -s 'https://buyitscovers.com/api/search?q=<titel>'` → `works[0].id`, `title`, `authors`, `firstPublishYear`, `editionCount`. Titel und Autor im Ergebnis mit dem Foto abgleichen (eine ISBN aus dem Gedächtnis hat schon einmal das falsche Buch getroffen; bei Zweifel `/api/isbn/<isbn>` mit der ISBN vom Foto).
2. **Wand ansehen:** `https://buyitscovers.com/book/<id>` im Browser-Bereich öffnen und prüfen, ob die Ausgabe vom Foto darauf steht. Steht sie nicht darauf, darf die Zeile sie nicht als „on our wall“ versprechen — dann eine Zeile über die anderen Ausgaben, oder keine Antwort.
3. **Reihe bestimmen, bevor sie genannt wird:** Reihe und Druck lesen (`docs/ausgaben-recherche.md`, `docs/reihen-recherche.md`), dann die Sammlung finden: `data/collections.json` (`slug`, `title`, `works`), aber **die Datei ist nicht, was die Seite zeigt** — ob eine Sammlung veröffentlicht ist, sagt nur ein Abruf von `https://buyitscovers.com/collections/<slug>` (200 oder 404, **ein** Abruf, nie wiederholt). Hält die Sammlung das Buch nicht, sagt die Zeile das nicht („kein Nile bei Tom Adams“ → die Zeile verweist auf die Reihe, verspricht kein Nile-Cover).
4. **Zahlen von der Seite:** `editionCount` ist Open Librarys Ausgabenzahl („188 printings on record“); die Wand zeigt oft weniger Cover. Eine Zahl kommt in die Zeile nur mit der Quelle in der Zettel-Notiz. **Keine Vollständigkeitswörter** („every“, „all“, „complete“), es sei denn die Reihe ist abgeschlossen und die Sammlung hält sie ganz (die yellows: 21 von 21, Quellen in `reihen-recherche.md`); ein Reihen-Intro, das „often“ sagt, wird nicht zu „every“.
5. **Karte holen und ansehen** (eine Anfrage je Karte, Produktion ist dafür in Ordnung):
   - Buch: `curl -s -o docs/antwortzettel/<datum>/<slug>-card.png 'https://buyitscovers.com/book/<id>/opengraph-image'`
   - Sammlung: `…/collections/<slug>/opengraph-image`
   - Jahrzehnte-Seite oder Wand als Screenshot im hellen Schema: `npx tsx lab/video/screen/shot-light.ts <url> <out.png> 1200 675 2` (umgang.md §6; „Chrome did not start“ heißt ein alter headless Chrome auf Port 9353).
   Jede Karte mit `Read` ansehen und im Zettel sagen, was sie zeigt (vier verschiedene Cover sind gut; ein Leineneinband ohne Bild ist schwach — dann die Wand als Screenshot).

## 5. Die Zeile schreiben

Stilblatt §4, kurz: **Bildunterschrift, nicht Erklärung** (S1); **ein Gedanke, eine Zeile** (S2); trockener Witz über die Lesekultur, nie über das Buch (S3); „we“ als kleiner Laden mit Meinung (S4); **keine Quellenangabe, kein Disclaimer** (S5); **der Link zuletzt — auf X nie in der ersten Antwort mit Bild**, sondern als zweite Antwort darunter (S7); englisch, Kleinschreibung erlaubt, keine Hashtags (S8). Julians eigene Zeilen als Maß: „Tom Adams' Agatha Christie covers for Fontana, 1963–1979“, „don't gatekeep the editions“, „The Great Gatsby, decade by decade since 1925.“ Sieben Entwürfe mit Pointe hat er einmal am Stück verworfen („none of these sound organic“) — die schlichte Unterschrift gewinnt.

Links: Buch `buyitscovers.com/book/<id>?via=bluesky` bzw. `?via=x`, Sammlung `buyitscovers.com/collections/<slug>?via=…`, Jahrzehnte `buyitscovers.com/book/<id>/decades?via=…`. Keine Antwort nennt eine Ausgabe, die §4 nicht bestätigt hat. Eine Zeile, die nur fragt („the viking jacket or the NYRB one? asking for the wall“), darf ohne Link stehen — der Link kommt, wenn sie antworten.

## 6. Den Zettel schreiben

Datei `docs/antwortzettel/<JJJJ-MM-TT>.md`, Bilder in `docs/antwortzettel/<JJJJ-MM-TT>/`. Form wie die Muster:

```
# Antwortzettel, <Wochentag> <Datum> (Julian: „<sein Auftrag>“)
<Wie gesucht: Skript, Fenster, Trefferzahl; X-Suchen mit since/min_faves; Regeln in einem Satz; wer aussortiert wurde (Rolle, nicht nur Name).>
**Befund:** <ein Absatz: was diese Woche trägt>
## X (Bild und Satz, Link als zweite Antwort, `?via=x`)
### X1 · @handle — „<Thema>“
- <Link> · <Datum> · **<Aufrufe>, <Likes>, <Antworten>**
- Geprüft: *<Titel>* <Werk-ID>, <editionCount> Ausgaben; die Karte zeigt <…> (`<datei>`).
- **Antwort (mit Bild):** `<zeile>`
- **Zweite Antwort:** `buyitscovers.com/book/<id>?via=x`
**Nicht:** <aussortierte Kandidaten mit Grund>
## Bluesky (Link darf in die Antwort, `?via=bluesky`)
### B1 · …
## Eigener Post (wenn es einen Anlass gibt: neue Sammlung, Jahrestag)
## Gelernt
```

Bluesky-Zahlen: Likes, Reposts, Antworten; X-Zahlen: Aufrufe, Likes, Antworten. Jede Zahl mit Datum (sie altern). Unter „Gelernt“ nur, was der nächste Zettel braucht (eine Suchformel, eine Falle) — und dasselbe als datierte Zeile in `docs/umgang.md`, wenn es ein Werkzeug betrifft.

Dann: Abschnitt in `docs/history.md` (`## <Datum> — <n>ter Antwortzettel (ROADMAP 5.6c)`: Suche, Trefferzahlen, was aussortiert wurde und warum, welche Prüfungen nach §4 liefen, „nichts gepostet“), Commit „5.6c: <n>th reply list — <Befund in einem Halbsatz> (docs only)“, kein Push. Den Zettel und die zwei, drei besten Karten mit `SendUserFile` schicken; im Bericht an Julian: Zahl der Einträge, der Befund, und dass nichts gepostet ist.

## 7. Posten auf Zuruf (nur mit Julians Wort je Eintrag)

Erst wenn Julian einen Eintrag nennt („poste B1“, „poste du diese variante“). Beides in seinem Chrome, Konto `buyitscovers.com` bzw. `@buyitscovers`:

- **Bluesky-Antwort mit Bild:** Status-Seite öffnen, „Reply“ (`find`), in den Composer klicken, Zeile tippen; das Bild vorher in die Zwischenablage: `osascript -e 'set the clipboard to (read (POSIX file "<pfad>.jpg") as JPEG picture)'` (eine `.png`, die JPEG-Daten hält, vorher nach `.jpg` kopieren), dann `cmd+v` im Composer, „Add alt text“ ausfüllen, „Save“, „Publish reply“. **Prüfen ohne Login:** `curl 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=buyitscovers.com&filter=posts_with_replies&limit=3'` — die Antwort steht mit `reply.parent` und einem Bild oben. Ein Bild verdrängt die Link-Karte; der Link bleibt im Text.
- **X-Antwort mit Bild, Link als zweite Antwort:** die Fallen aus umgang.md §5 (2026-10-22 und 2026-10-31): der Modal-Composer verliert Text — den **Inline-Composer** der Status-Seite nehmen; `find "Post button"` liefert gern „Add post“ (legt einen leeren zweiten Beitrag an → „Remove post“, dann „Post“); Bild über `file_upload` auf das versteckte `input type=file`; nach dem Posten leitet X nach `/i/graduated-access` um und ein „Reply“-Klick tippt in die Suchleiste — **die eigene Antwort als Status-Seite öffnen** und erst dort den Link als zweite Antwort tippen. Prüfen: das Profil `x.com/buyitscovers` im Browser-Bereich ohne Login lesen.
- Danach: `postedUrl` und Uhrzeit in den Zettel beim Eintrag, ein Absatz in der `history.md` unter dem Zettel des Tages (Zitat von Julians Wort, Zeile, Bild, Bestätigung), Tabs schließen.

## 8. Als Auftrag an einen Agenten

Ein Agent (Agent-Tool, `general-purpose`) bekommt diesen Text als Auftrag; `bsky` geht ohne Julian, `x` nur, wenn Claude in Chrome in der Sitzung verbunden ist und Julian am Rechner sitzt:

> Baue den Antwortzettel für <Datum> nach `.claude/skills/antwortzettel/SKILL.md` im Projekt `/Users/claude-m1/projects/beautifulbooks`: Plattform <bsky|beide>, Fenster 72 h. Lies zuerst §0 bis §6 des Skills, dann den letzten Zettel in `docs/antwortzettel/` als Muster. Suche, lies jeden Thread selbst, sortiere Rechteinhaber aus, prüfe jede Zeile nach §4 gegen die Seite (ein Abruf je Prüfung, nie wiederholen; Open Library nie direkt bei Bursts), hole die Karten, schreibe den Zettel und den history-Abschnitt, committe ohne Push. Poste nichts, like nichts, folge niemandem, tippe nirgends Zugangsdaten. Reddit ist tabu. Berichte am Ende: Zahl der Einträge, der Befund, welche Prüfungen etwas gestrichen haben, und was du nicht prüfen konntest.

Was der Agent **nicht** darf, steht in §0; was er zurückmeldet, prüft die Hauptsitzung gegen den Zettel (N12: ein Timeout ist kein „nichts gefunden“), bevor Julian ihn bekommt.
