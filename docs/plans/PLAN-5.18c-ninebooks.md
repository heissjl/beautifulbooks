# PLAN 5.18c (b) — ein Shelf-Portrait mit einem Klick an Nine Books

Stand 2026-10-09, **Entwurf, nichts gebaut, nichts an ihn geschickt.** Julian: „prepare locally a plan what you would
change and show me how that would change mine and his site". Skizze beider Seiten:
[PLAN-5.18c-ninebooks-skizze.html](PLAN-5.18c-ninebooks-skizze.html) (lokal öffnen). Grundlage: sein `src/worker.js`
(Stand 2026-10-09), [docs/vergleich-ninebooks.md](../vergleich-ninebooks.md).

## Ziel

Wer ein Shelf-Portrait mit neun Büchern gemacht hat, kann es mit einem Klick und eigener CC0-Einwilligung in die
offene Datenbank von Nine Books geben — ohne ein Bild zu speichern und wieder hochzuladen, und ohne dass unser Server
die Liste je sieht.

## Grundsatz: der Browser des Lesers schickt, nicht unser Server

Der Knopf löst im Browser des Lesers ein `fetch` an seine API aus. Unser Server ist nicht beteiligt, speichert nichts
und kennt das Ergebnis nicht. Der Leser sieht vorher genau, was geht (neun Titel, Autoren, Name oder anonym) und willigt
mit seinem Wortlaut ein. Dass die Seite eine Übermittlung an einen Dritten *anbietet*, gehört trotzdem in die
Datenschutzerklärung.

## Was sich bei ihm ändern müsste (Pull Request auf `jnathan9/ninebooks`)

Heute nimmt `POST /api/lists` nur eine Liste mit signiertem Token aus seiner eigenen Bilderkennung
(`verify(body.token)` → `review.kind`, `review.image_hash`, `review.nonce`), und jeder POST braucht `Origin:
https://thestalwart.com`.

1. **Neue Variable `PARTNER_ORIGINS`** in `wrangler.toml`, z. B. `"https://buyitscovers.com"`. Getrennt von
   `ALLOWED_ORIGINS`, damit ein Partner nur den neuen Weg darf, nicht `/api/analyze` (das kostet ihn Modellaufrufe).
2. **Neuer Weg `POST /api/lists/reviewed`**, nur von `PARTNER_ORIGINS`:
   - `kind: "book"` (nur Bücher; wir haben keine Alben),
   - `items`: genau neun `{ title, creator }`, durch sein `itemRecord` wie bisher normalisiert — dieselben IDs wie
     aus einem Bild, also fließen sie in seine Verknüpfungen ein,
   - `consent` = sein `VERSION` (`ninebooks-cc0-v2`), `attribution`, `display_name` wie bisher,
   - `source_url`: zusätzlich zu X-Beiträgen auch `https://buyitscovers.com/shelfportrait/<id>` erlauben (die
     Kurzadresse des Boards; Muster `^/shelfportrait/[A-Za-z0-9]{8}$`),
   - **Dublettenschutz** statt `image_hash`: ein Hash über die sortierten neun Item-IDs plus Partner — dieselben neun
     zweimal geschickt ergeben eine Liste,
   - **Quote:** derselbe IP-Zähler wie beim Hochladen (5 je Stunde) und ein eigener Tageszähler für Partnerlisten,
     z. B. `PARTNER_DAILY_LIMIT = 200`. Kostet ihn kein Modell, nur Zeilen.
3. **Migration `0003_source.sql`:** Spalte `lists.source` (`'image'` Standard, `'buyitscovers'` für den neuen Weg).
   Im Export (`lists.csv`, `lists.jsonl`) als Spalte, damit, wer die Daten nutzt, Listen ohne Bild trennen kann —
   bei uns sind die Positionen die Plätze im Board, nicht Positionen in einem Foto; das sagt der Data Dictionary.
4. **Seine Oberfläche, optional** (Julian, 2026-10-09: „this is optional"): eine Zeile „via Buy Its Covers" an einer solchen Liste, als Link auf `source_url`. Nicht Bedingung; der PR bietet sie an.
5. **Tests** in `test/worker.test.js`: fremder Origin 403, acht Titel 400, ohne Einwilligung 400, Dublette ergibt
   dieselbe ID, Quote greift.
6. **CORS:** sein `Access-Control-Allow-Origin` für POST muss `PARTNER_ORIGINS` mit einschließen (Zeile ~877).

Rund 80 Zeilen Worker, eine Migration, 5 Tests. Ob er das will, entscheidet er; der Pull Request macht es ihm leicht,
ja oder nein zu sagen.

## Was sich bei uns ändert

1. **`components/InspirationShared.tsx`:** der Absatz „To an open database" (5.18c a, gebaut; seit 2026-10-09 zwischen
   „As a picture" und „As a link", „an experiment by Joe Weisenthal") bekommt das Feld, nur für den Macher, nur bei
   neun Büchern — offen oder hinter einem Knopf, siehe „Opt-out" unten.
2. **Neue Komponente `InspirationNineBooks.tsx`:** ein aufklappbares Feld darunter —
   - die neun Titel mit Autor (aus dem Board, wie sie in der Bestellliste stehen),
   - „Anonymous" (Standard) oder „With my name" (vorbelegt mit dem `by` des Boards),
   - Kästchen mit seinem Einwilligungstext (CC0, öffentlich, nicht zurücknehmbar — wörtlich von ihm übernommen),
   - „Send" → `fetch('https://ninebooks-api.pages.dev/api/lists/reviewed', …)` aus dem Browser,
   - danach: „Added — see your list on Nine Books" mit seinem Listenlink, oder seine Fehlermeldung wörtlich, nie eine
     erfundene („A failure must never be reported as a finding").
3. **`lib/inspiration/ninebooks.ts` (rein, getestet):** baut den Request-Körper aus dem Board (Titel, Erstautor,
   Reihenfolge, Kurzlink als `source_url`), prüft genau neun verschiedene Werke.
4. **Content-Security-Policy:** falls `connect-src` gesetzt ist, `https://ninebooks-api.pages.dev` aufnehmen.
5. **Datenschutz** (Analytik-Regel 6, Julian gibt frei), Vorschlag:
   - en: „On a finished Shelf-Portrait you can choose to add your nine books to Nine Books, an open database run by
     someone else. If you do, your browser sends the nine titles and authors — and your name, if you choose to give
     it — directly to that project, which publishes them as public-domain data. This site does not receive or keep
     that list."
   - de: „Unter einem fertigen Shelf-Portrait kannst du deine neun Bücher an Nine Books geben, eine offene Datenbank,
     die jemand anderes betreibt. Tust du es, schickt dein Browser die neun Titel und Autoren — und deinen Namen, wenn
     du ihn angibst — direkt an dieses Projekt, das sie als gemeinfreie Daten veröffentlicht. Diese Seite bekommt und
     behält die Liste nicht."
   - dazu `docs/recht-hobbyseite.md` §4.
6. **Analytik:** ein Tageszähler „an Nine Books geschickt" über `/api/seen` als feste Klasse, ohne Kennung und ohne
   Titel; Plan 3.1 §3 und ein Test. Oder gar nicht zählen — Julian entscheidet.
7. **Englisch zuerst**, wie das ganze Shelf-Portrait (noch nicht durch `t()`).

## Reihenfolge

1. Julian liest diesen Plan und die Skizze.
2. Julian schreibt ihn an (Issue oder Pull Request unter Julians Konto; den PR kann ich vorbereiten).
3. Erst wenn er den Weg öffnet: unsere Seite bauen, gegen seine Testumgebung oder einen lokalen Worker
   (`npm run dev` in seinem Repo) prüfen, Datenschutzsatz freigeben, deployen.

## Was offen bleibt

- Ob er Listen ohne Bild überhaupt will — sein Datensatz misst „neun Bücher auf einem Foto"; ein Board ist eine
  Auswahl am Bildschirm. **Julians Antwort für das Gespräch** (2026-10-09: „i think it's okay because we will have done
  the vetting of the titles"): jeder Titel eines Boards ist ein Open-Library-Werk, das der Leser selbst gesucht und
  gewählt hat — geprüfter als eine Erkennung aus einem Foto, die er erst gegenlesen lassen muss. Das gehört in den
  PR-Text. Die Spalte `source` hält beides trotzdem unterscheidbar.
- **Opt-out statt Opt-in?** (Julian, 2026-10-09: „make it opt out instead of opt in?") **Nicht als Voreinstellung,
  die ohne Klick sendet**, aus drei Gründen: (1) sein Server verlangt eine ausdrückliche Einwilligung in CC0, und CC0
  ist nicht zurücknehmbar — eine Liste, die jemand nur fürs Teilen gebaut hat, wäre ohne sein Zutun für immer
  gemeinfrei; (2) mit Namen ist es eine Übermittlung personenbezogener Daten an einen Dritten, und ein vorab
  gesetztes Häkchen ist nach EuGH *Planet49* (C-673/17) keine Einwilligung; (3) seine Seite bekäme Listen von Leuten,
  die nicht wissen, dass es sie gibt. **Was dem Wunsch nahekommt:** das Feld steht schon offen da (nicht hinter einem
  Knopf), anonym ist vorgewählt, und *ein* Klick auf „Add my nine" ist zugleich die Einwilligung — ein Schritt statt
  drei. Julian entscheidet.
- Kennung des Mitwirkenden: sein Paar-Code (`reader_token`) verknüpft Listen eines Menschen. Wir lassen ihn weg; jede
  geschickte Liste ist ein neuer Mitwirkender. Sonst müssten wir seinen Code im Browser halten.
