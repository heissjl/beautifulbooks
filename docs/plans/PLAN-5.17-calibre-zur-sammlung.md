# PLAN 5.17 — Die Calibre-Bibliothek als eigene Sammlung auf der Seite

Stand: 2026-10-03, **Schritte 1–5 und 7 umgesetzt** (`lab/calibre-import/`, [README](../../lab/calibre-import/README.md), [Historie](../history.md#2026-10-03--die-calibre-bibliothek-als-eigene-sammlung-lab-roadmap-517)); **offen ist Schritt 6** — einmal gegen die echte Seite, von Julian — und seine Entscheidungen in §6. Abweichung vom Plan: Cache und Entscheidungen liegen nicht in `lab/calibre-import/`, sondern neben den Backups unter `~/Library/Application Support/BuyItsCovers/calibre/import/` (ein Worktree wird gelöscht, und die Dateien sind die Liste von Julians Büchern). Ursprünglicher Stand: offen, nichts gebaut. Geschrieben für eine Sitzung, die den Code nicht kennt. Julian, 2026-10-03: „bereite die calibre -> online collection variante als zweites lab-experiment vor. schreibe einen plan dafür, ich setze es dann in einer anderen session um".

Lab-Experiment, Ordner `lab/calibre-import/`, nur lokal und nur für Julian. Die Website wird dafür **nicht** geändert; was das Experiment an ihr braucht, gibt es schon.

## 1. Worum es geht

Das erste Experiment ([lab/calibre](../../lab/calibre/README.md), Roadmap 5.16) schreibt Cover aus einer Sammlung in Calibre. Es setzt voraus, dass Julian die Sammlung auf der Seite von Hand zusammenstellt, und es findet ein Buch nur, wenn Titel und Autor in Calibre so heißen wie das Werk bei Open Library — „Per Anhalter durch die Galaxis" findet „The Hitchhiker's Guide to the Galaxy" nicht.

Die Gegenrichtung schließt den Kreis:

1. **Calibre → Sammlung:** das Werkzeug liest die Bibliothek, findet zu jedem Buch das Werk bei Open Library und legt daraus eine eigene Sammlung auf der Seite an — unter Julians Besucher-ID, sodass sie in seinem Browser unter „Your collections" steht.
2. **Auf der Seite wählen:** im Editor `/c/<id>/edit` tauscht Julian je Kachel das Cover gegen ein anderes desselben Werks (das gibt es seit 5.13m: Klick auf die Kachel, `swap`).
3. **Sammlung → Calibre:** `lab/calibre` schreibt die gewählten Cover zurück. Weil der Import sich gemerkt hat, welches Calibre-Buch welches Werk ist, ist die Zuordnung dabei **sicher** — auch für übersetzte Titel.

## 2. Die Frage und woran Erfolg erkannt wird

**Frage:** Für wie viele der 445 Bücher findet sich das richtige Werk bei Open Library, ohne dass Julian jedes einzeln bestätigt — und trägt eine Sammlung dieser Größe auf der Seite?

**Erfolg:**
- ≥ 70 % der Bücher bekommen ein Werk; in einer Stichprobe von 40, von Hand geprüft, sind höchstens 2 falsch.
- Kein Buch landet ohne Julians Blick in der Sammlung, wenn nur der Titel stimmt (die Regel aus 5.11a: jeder solche Treffer am Regalfoto war geraten).
- Die Sammlung steht in Julians Browser unter seinen eigenen, lässt sich im Editor öffnen, und `lab/calibre` schreibt danach ein gewähltes Cover in das richtige Buch — geprüft an einem Buch mit deutschem Titel.

**Zu messen und in die Historie zu schreiben:** Anteil über ISBN / über Titel + Autor / nur Titel / nicht gefunden; Fehler in der Stichprobe; Dauer und Zahl der Open-Library-Anfragen; wie sich die Sammlungsseite mit ~300–445 Kacheln verhält (Ladezeit, 390 px und 1280 px).

## 3. Was schon da ist — nichts davon neu bauen

| Baustein | Wo | Wofür |
|---|---|---|
| Bibliothek lesen, nur lesen | `lab/calibre/library.ts` (`findLibrary`, `readLibrary`, `CalibreBook`) | Bücher mit Titel, Autoren, ISBN-13, Ordner. Über `sqlite3 -readonly`, geht auch bei offenem Calibre |
| Buch → Werk → Kachel | `lib/walls/photo.ts` (`matchPhotoBook`, `tileFromWork`), `lib/bookmatch.ts` (`pickWork`, `sameAuthor`, `titleScore`) | Nimmt `{title, author}` und liefert eine Kachel samt Grund (`author+title`, `author`, `title-only`) und `unsure`. Gebaut für das Regalfoto, passt unverändert: ein Calibre-Buch ist ein sehr gut gelesener Buchrücken |
| Suche | `lib/search.ts` (`search`) | Eine Open-Library-Anfrage je Suche, nie Google |
| ISBN → Ausgabe → Werk und **deren** Cover | Muster in `lab/collections/from-isbns.ts` (`resolve`: `https://openlibrary.org/isbn/<isbn>.json` → `works[0].key`, `covers[]`) | Für die 131 Bücher mit ISBN der genaueste Weg — und das Cover ist dann das der Ausgabe, die Julian hat |
| Kachel-Form und Grenzen | `lib/walls/model.ts` (`Tile`, `validTile`, `MAX_TILES` = 500, `WallOp`) | 445 Bücher passen in eine Sammlung |
| Sammlung anlegen | `POST /api/walls {title, tiles}` (`app/api/walls/route.ts`) | Legt eine gefüllte Sammlung in einem Schritt an; Besitzer ist die Besucher-ID im Cookie `bb_visitor` |
| Sammlung ändern | `POST /api/walls/<id> {ops}` — höchstens 50 Operationen je Anfrage (`OPS_PER_REQUEST` in `lib/walls/edit.ts`) | Für ein späteres Nachtragen neuer Bücher |
| Lokaler Server mit Token | `lab/calibre/serve.ts`, `scripts/cockpit/guard.ts` | Muster für die Prüfseite |
| Sicherer Rückweg | `lab/calibre/` ganz | Schreibt Cover in Calibre, mit Backup, Journal und Kontrolle |

Eine Kachel aus dem Import trägt `printings: []`, außer das Cover kam über die ISBN der Ausgabe — dann ist die ISBN aus Calibre ein Druck, der dieses Cover trug (E8: eine ISBN ist ein Druck, kein Bild; nur in diesem Fall gehört sie an die Kachel).

## 4. Der Ablauf

### 4.1 Zuordnen (nur lesen, nur Open Library)

Für jedes Buch, in dieser Reihenfolge:

1. **ISBN** (131 Bücher): `GET https://openlibrary.org/isbn/<isbn13>.json`. Liefert Ausgabe, Werk und die Cover der Ausgabe. Treffer → Grund `isbn`, Cover = `covers[0]` der Ausgabe, sonst weiter wie bei 2 für das Cover.
2. **Titel + erster Autor:** `matchPhotoBook({ title, author, kind: 'spine' })`. Grund `author+title` → Treffer. Grund `title-only` oder `author` → **Vorschlag**, nicht Treffer. Achtung: `matchPhotoBook` markiert nur `title-only` als `unsure`; für ein Regalfoto ist „gleicher Autor, anderer Titel" ein brauchbarer Treffer, für den Import nicht — der Import wertet den Grund selbst aus.
3. **Nichts** → im Bericht, nicht in der Sammlung.

Calibre-Eigenheiten, die vor der Suche zu glätten sind (rein, mit Tests): Autor als „Nachname, Vorname" (`normalizeAuthor` kann das schon); Titel mit Reihen-Vorsatz („[Philip K. Dick 04] • Flow My Tears…", „1974-Rendezvous With Rama" — beide stehen so in Julians Bibliothek); Untertitel nach Doppelpunkt. Einträge ohne Autor oder mit „Unknown" überspringen (in der Bibliothek stehen auch Calibres „Quick Start Guide" und Fachaufsätze).

**Welches Cover die Kachel bekommt:** (a) das der Ausgabe aus der ISBN; sonst (b) Julians kuratiertes Cover des Werks, sonst das erste der Suchkarte — beides macht `tileFromWork` schon. Das Cover ist nur der Startwert: gewählt wird danach auf der Seite.

**Übersetzungen:** Open Library führt eine Übersetzung meist als Ausgabe des Originalwerks, manchmal als eigenes Werk. Beides ist recht — die Kachel zeigt dann eben die Wand, auf der das Cover liegt. Ob die Suche mit einem deutschen Titel das Werk findet, ist genau die offene Messung; `lab/international-covers/` hat Erfahrungen dazu (übersetzte Titel aus Wikidata) und ist der nächste Schritt, falls der Anteil zu klein ist — nicht vorher.

**Anfragen:** höchstens ~900 an Open Library für die ganze Bibliothek (`matchPhotoBook` sucht erst mit Titel und Autor und, wenn das nichts Brauchbares bringt, noch einmal mit dem Titel allein; bei einer ISBN ohne Treffer kommt die Suche dazu), **drei gleichzeitig** (`PHOTO_SEARCHES_AT_ONCE`), Zeitlimit je Anfrage, User-Agent aus `lib/seo.ts` (`userAgent`). **Auf der Platte gecacht** (`lab/calibre-import/cache.json`, git-ignoriert) und fortsetzbar: ein zweiter Lauf fragt nur, was fehlt. Eine Quelle, die nicht antwortet, ist nicht „nicht gefunden" (N12) — solche Bücher bleiben offen und werden beim nächsten Lauf wieder gefragt. **Nie Google** (Lab-Regel 6).

### 4.2 Prüfen (lokale Seite)

Eine Seite wie die von `lab/calibre` (127.0.0.1, Token, Port 4328): je Buch eine Zeile — Calibre-Cover und Titel links, gefundenes Werk mit Cover rechts, der Grund als Etikett. Treffer sind vorgehakt, Vorschläge nicht (die Regel „maybe" aus 5.11a). Julian hakt ab oder an, kann eine Zeile mit einer eigenen Suche korrigieren (`/api/search?q=` über `lib/search.ts`) und sieht oben die Zahlen der Messung. Entscheidungen werden lokal gespeichert, damit ein zweiter Lauf sie behält.

### 4.3 Hochladen

`POST <base>/api/walls` mit `{ title: 'My Calibre library', tiles }` und dem Cookie `bb_visitor=<Julians ID>`. Die Antwort trägt die ID der Sammlung; das Werkzeug druckt `https://buyitscovers.com/c/<id>/edit`.

- **Die Besucher-ID ist der Schlüssel zu Julians Sammlungen** (E22). Sie kommt aus `BB_VISITOR` in der `.env.local` des Hauptordners (Muster: Memory „worktree build needs env"), wird nie geloggt, nie in eine Datei im Repository geschrieben, nie in eine Adresse gesetzt. Ohne die Variable lädt das Werkzeug nicht hoch und sagt, wo Julian die ID findet (auf `/create`, „Your ID").
- Eine neue Sammlung ist **ungespeichert** und verfällt nach 48 Stunden (5.13j). Das ist hier ein Vorteil: Julian sieht sie an und drückt „Save" — oder lässt sie verfallen. Das Werkzeug schickt kein `save`.
- **Erst gegen `npm run dev`** (`--base http://localhost:3000`, dort lebt die Sammlung im Speicher des Dev-Servers), dann **einmal** gegen Produktion. Kein Probieren gegen die echte Seite.
- Die Sammlung ist privat, solange Julian sie nicht unter „Collections by readers" zeigt. Hochgeladen werden nur Werk-ID, Cover-ID, Titel, Autor und gegebenenfalls eine ISBN je Kachel — nichts aus Calibre sonst, keine Dateinamen, keine Notizen.
- Doppelte Werke (zwei Ausgaben desselben Buchs in Calibre) ergeben eine Kachel; die Zuordnungsdatei behält beide Bücher.

### 4.4 Der Rückweg — die Brücke zu `lab/calibre`

Beim Hochladen schreibt der Import eine **Zuordnungsdatei** nach `~/Library/Application Support/BuyItsCovers/calibre/maps/<Sammlungs-ID>.json` (außerhalb des Repositorys, wie die Backups): `{ wall, library, createdAt, books: [{ bookId, workId }] }`.

`lab/calibre` bekommt dafür eine kleine Erweiterung (Teil dieses Punkts, mit Tests):

- `serve.ts` sucht zur geladenen Sammlung eine Zuordnungsdatei **für dieselbe Bibliothek** (`libraryKey` aus `safety.ts`).
- `match.ts` kennt eine vierte, **sichere** Art `mapped`: die Kachel hat das Werk, das der Import diesem Buch zugeordnet hat. Sie steht vor `isbn`. Hat ein Werk zwei Bücher, ist es wie bisher nicht sicher, sondern Julians Wahl.
- Die Sicherungen von `lab/calibre` bleiben, wie sie sind. Die Zuordnungsdatei ändert nur, welches Buch vorgeschlagen wird — geschrieben wird weiter erst nach Klick, mit Backup und Kontrolle.

Tauscht Julian im Editor ein Cover, bleibt das Werk der Kachel dasselbe — die Zuordnung hält. Fügt er Kacheln hinzu, die nicht aus Calibre stammen, haben sie keine Zuordnung und laufen über Titel und Autor wie heute.

## 5. Schritte für die Umsetzung

Jeder Schritt ein Commit, der 5.17 nennt.

1. **Messen, bevor etwas gebaut wird** — `lab/calibre-import/measure.ts`: liest die Bibliothek, ordnet zu (4.1), schreibt den Cache und druckt die Zahlen aus §2. Dazu `clean.ts` (Titel und Autor glätten, rein) und `lookup.ts` (ISBN-Abruf, Cache) mit Tests unter `lab/calibre-import/__tests__/` — ohne Netz, mit zwei, drei aufgezeichneten Antworten als Fixture. **Hier entscheidet sich, ob es weitergeht:** unter 50 % Treffern zuerst die Titel-Frage lösen (Wikidata-Titel wie in `lab/international-covers/`), nicht die Seite bauen.
2. **Stichprobe:** 40 zufällige Treffer als Liste mit beiden Titeln und Autoren ausgeben, Julian oder die Sitzung prüft sie von Hand; Ergebnis in die Historie.
3. **Prüfseite** (4.2): `serve.ts`, `index.html`. Im Browser bei 1280 × 800 ansehen; ein Telefon ist für dieses Werkzeug kein Ziel.
4. **Hochladen** (4.3) gegen `npm run dev`, mit einer Test-ID aus `newVisitorId()`; dann die Sammlungsseite und den Editor mit der vollen Sammlung ansehen und messen (390 × 844 und 1280 × 800, weil das die Website ist).
5. **Rückweg** (4.4): `mapped` in `lab/calibre/match.ts` mit Tests; ein Buch mit deutschem Titel auf einer **Probe-Kopie** (`lab/calibre/rehearsal.ts`) durchspielen.
6. **Einmal gegen Produktion**, mit Julians ID, von Julian gestartet.
7. Aufschreiben: README des Ordners (Frage, Maß, Stand), Zeile in `lab/README.md`, Messungen in `docs/history.md`, Roadmap 5.17 abhaken und kürzen, Langtext ins Archiv.

Optional, nur wenn Julian es will (eigene Messung): **das Cover erkennen, das Calibre schon hat** — die Signatur von `cover.jpg` (`lib/imagehash.ts`, `signature`) gegen die Cover des Werks (`getWorkPage(…, { googleBooks: false })`, Seite 0), Abstand ≤ 8 wie bei der Faltung. Kostet eine Ausgaben-Seite je Buch (3–10 s) und sagt je Kachel „das ist dein Cover" statt „das ist ein Cover des Werks". In der Bibliothek ist mindestens ein Cover (*The Invisible Man*, 309 × 475) offenbar schon ein Open-Library-Scan.

## 6. Was Julian entscheidet

1. **Darf die Liste seiner Bücher in den Speicher der Seite?** Privat, unter seiner ID, aber es ist der Produktions-Redis. Wenn nein, bleibt das Experiment bei `npm run dev` stehen — dann ist auch der Rückweg nur lokal möglich.
2. **Eine Sammlung oder mehrere?** Vorschlag: zuerst eine („My Calibre library"); Aufteilen nach Calibre-Schlagwort oder Reihe erst, wenn die eine zu groß zum Wählen ist.
3. **Was nie hochgeht:** eine Ausschlussliste (Schlagwort oder Buchnummern) für Fachliteratur und Privates. Vorschlag: nur Bücher mit einem sicheren Treffer, Vorschläge nur nach Haken.
4. **Die optionale Cover-Erkennung** (§5, letzter Absatz).

## 7. Risiken

- **Zu wenige Treffer bei deutschen Titeln.** Deshalb Schritt 1 zuerst und allein.
- **Falsche Treffer bei häufigen Titeln** („Emma", „Solaris" als Film-Buch): nur `author+title` zählt als Treffer; die Stichprobe misst den Rest.
- **Open Library ist langsam** (2–7 s je Suche, gelegentlich mehr): Cache, drei gleichzeitig, fortsetzbar; ein voller Lauf dauert eher zehn Minuten als eine.
- **Eine Sammlung mit 400 Kacheln** ist doppelt so groß wie die größte kuratierte (198). Wenn die Seite das nicht trägt, ist das ein Befund für die Roadmap, kein Grund, die Seite im Experiment zu ändern.
- **Die Besucher-ID** in einer Umgebungsvariable: wer sie hat, kann Julians Sammlungen ändern. Nie loggen, nie committen — ein Test prüft, dass sie in keiner Ausgabe des Werkzeugs steht.
- **Calibre** wird in diesem Experiment nur gelesen. Geschrieben wird ausschließlich durch `lab/calibre`, mit dessen Sicherungen.
