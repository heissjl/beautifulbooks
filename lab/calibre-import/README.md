# lab/calibre-import — die Calibre-Bibliothek als eigene Sammlung auf der Seite

Roadmap 5.17, Plan: [PLAN-5.17](../../docs/plans/PLAN-5.17-calibre-zur-sammlung.md). Julian, 2026-10-03: „bereite die calibre -> online collection variante als zweites lab-experiment vor", dann: „geh das projekt Calibre → Sammlung (5.17) an".

Die Gegenrichtung zu [lab/calibre](../calibre/README.md) (5.16). Nur lokal, nur für Julian; die Website ändert sich dafür nicht.

## Die Frage

Für wie viele Bücher der Calibre-Bibliothek findet sich das richtige Werk bei Open Library, ohne dass Julian jedes einzeln bestätigt — und trägt die Seite eine Sammlung dieser Größe, in der er dann die Cover wählt, die `lab/calibre` zurückschreibt?

**Erfolg** (Plan §2): ≥ 70 % der Bücher bekommen ein Werk, höchstens 2 Fehler in einer Stichprobe von 40; kein Buch landet ohne Julians Blick in der Sammlung, wenn nur der Titel stimmt; die Sammlung steht unter Julians eigenen, und ein dort gewähltes Cover kommt beim richtigen Buch an — geprüft an einem Buch mit deutschem Titel.

## Benutzen

```bash
npx tsx lab/calibre-import/measure.ts              # 1. den Katalog fragen (einmal; jede Antwort bleibt auf der Platte)
npx tsx lab/calibre-import/measure.ts --sample 40  #    dazu 40 Treffer zum Nachsehen, mit festem Zufall
npx tsx lab/calibre-import/serve.ts --test-visitor # 2. die Prüfseite; lädt zu `npm run dev` hoch, mit einer Wegwerf-ID
npx tsx lab/calibre-import/serve.ts --base https://buyitscovers.com --as-test   # 3a. die echte Seite, als Test-Besucher
npx tsx lab/calibre-import/serve.ts --base https://buyitscovers.com   # 3b. die echte Seite, unter Julians eigener ID
npx tsx lab/calibre/serve.ts <Sammlungs-ID>        # 4. zurück: die gewählten Cover in Calibre (Sicherungen dort)
```

Die Prüfseite (Port 4328, 127.0.0.1, Token) zeigt je Buch eine Zeile: links Cover und Titel aus Calibre, rechts das gefundene Werk und der Grund. **Treffer sind angehakt, Vorschläge nicht.** „another work…" sucht für eine Zeile von Hand im Katalog; „Create the collection" schickt die angehakten Zeilen in einer Anfrage an die Seite und schreibt die Zuordnungsdatei für den Rückweg.

**Tests auf der echten Seite laufen unter einer eigenen Test-ID** (Julian, 2026-10-03: „benutze vielleicht eine dedizierte test-user ID, mit der wir in production testen"): `BB_TEST_VISITOR` in der `.env.local` des Hauptordners, benutzt mit `--as-test`; die Sammlung heißt dann „My Calibre library (test)" und steht nie unter Julians eigenen. Um sie im Browser zu bearbeiten: ein privates Fenster, `https://buyitscovers.com/create#id=<Wert von BB_TEST_VISITOR>` (der Wert steht nur in der `.env.local`; das Cockpit zeigt ihn unter „Dienste & Einstellungen"). Ansehen kann sie jeder mit dem Link `/c/<id>`.

Für Schritt 3b braucht das Werkzeug Julians eigene Besucher-ID: `BB_VISITOR=<ID>` in der `.env.local` des Hauptordners (die ID steht auf `/create` unter „Your ID"). Ohne sie lädt es nicht hoch. Die neue Sammlung ist **nicht gespeichert** und verfällt nach 48 Stunden, wenn Julian auf der Seite nicht „Keep it" drückt — das Werkzeug schickt nie `save`.

## Regeln

1. **Calibre wird nur gelesen** (`sqlite3 -readonly`, über `lab/calibre/library.ts`). Geschrieben wird ausschließlich durch `lab/calibre`, mit dessen Sicherungen.
2. **Nur Open Library, nie Google** (Lab-Regel 6). Drei Anfragen gleichzeitig, jede Antwort im Cache; ein zweiter Lauf fragt nur, was fehlt.
3. **Schweigen ist nicht „nicht gefunden"** (SPEC N12): eine Anfrage ohne Antwort wird nicht gespeichert, das Buch heißt „no answer" und wird beim nächsten Lauf wieder gefragt.
4. **Ein Treffer ist nur:** die ISBN, wenn dazu Autor oder Titel des Werks zum Buch passen — oder Autor **und** Titel. Alles andere ist ein Vorschlag und geht ohne Haken nirgendwohin.
5. **Die Besucher-ID** ist der Schlüssel zu Julians Sammlungen (E22). Sie geht als Cookie in die eine Anfrage und sonst nirgends hin: keine Ausgabe, keine Datei, keine Adresse; ein Test hält jede Ausgabe dagegen. `--test-visitor` macht für einen Dev-Server eine Wegwerf-ID und druckt den Link, der sie dem Browser gibt.
6. **Hochgeladen wird je Kachel** nur, was `validTile` behält: Werk, Cover, Titel, Autor, höchstens die ISBN. Nichts sonst aus Calibre.
7. **Nichts über Julians Bücher liegt im Repository.** Cache, Ergebnis, Entscheidungen und Zuordnungsdateien liegen neben den Backups von `lab/calibre`: `~/Library/Application Support/BuyItsCovers/calibre/import/<Bibliothek>/` (`cache.json`, `assignments.json`, `decisions.json`, `uploads.json`) und `…/calibre/maps/<Sammlungs-ID>.json`. Ein Worktree wird gelöscht; dieser Ordner nicht.

## Dateien

| Datei | |
|---|---|
| `clean.ts` | ein Calibre-Buch als Frage an den Katalog: Reihen-Vorsatz, Jahr, Autor im Titel, Dateinamen-Reste, Untertitel — rein, getestet |
| `lookup.ts` | die zwei Fragen (Ausgabe einer ISBN, Suche der Seite) und der Cache auf der Platte |
| `assign.ts` | Buch → Werk → Kachel, Treffer oder Vorschlag; die Zahlen; die Stichprobe — rein bis auf den übergebenen Katalog, getestet |
| `review.ts` | Julians Entscheidungen über dem Ergebnis — rein, getestet |
| `upload.ts` | die eine Anfrage an die Seite; woher die Besucher-ID kommt |
| `measure.ts` | Schritt 1 als Kommando |
| `serve.ts`, `index.html` | die Prüfseite und das Hochladen |
| `../calibre/map.ts` | die Zuordnungsdatei Buch ↔ Werk, und in `../calibre/match.ts` die Art `mapped` |

## Status

**Gebaut und gemessen am 2026-10-03; gegen `npm run dev` hochgeladen, auf der Seite ein Cover getauscht und auf einer Probe-Kopie zurückgeschrieben; am selben Abend einmal gegen die echte Seite, als Test-Besucher: `https://buyitscovers.com/c/y3lsl27ot5`, 319 Kacheln aus 328 Büchern, nicht gespeichert (verfällt am 2026-10-05 ohne „Keep it"). Unter Julians eigener ID und an der echten Bibliothek ist noch nichts geschehen.** Zahlen und Einzelheiten: [Historie](../../docs/history.md#2026-10-03--die-calibre-bibliothek-als-eigene-sammlung-lab-roadmap-517).

Gemessen an Julians Bibliothek (445 Bücher, 131 mit ISBN):

- **328 Bücher finden ihr Werk** — 74 % der Bibliothek, 78 % der 421, nach denen sich fragen lässt (24 haben keinen Autor: Lizenztexte, READMEs, Aufsätze). 102 über die ISBN, 226 über Autor und Titel. Daraus werden 319 Kacheln.
- **69 Vorschläge**, 24 nicht gefunden. Von den 27 „gleicher Autor, anderer Titel" waren beim Durchsehen rund 23 richtig — das sind die übersetzten Titel („Der Schnupfen" → *Katar*, „By Night in Chile" → *Nocturno de Chile*): die Suche findet sie, der Titelvergleich kann sie nicht bestätigen. Von den 33 „nur der Titel" rund 20 (Autor in anderer Schrift oder Schreibweise), 13 falsch.
- **Stichprobe:** 40 Treffer, 1 falsch („MaddAddam" → die Box der Trilogie). Der Fehler hat eine Form — der Werktitel enthält den Buchtitel nur —, und die ist seitdem ein Vorschlag (von 7 solchen waren 2 ein anderes Buch, 2 fraglich, 3 richtig).
- **Aufwand:** 593 Anfragen an Open Library, 4 Minuten, keine ohne Antwort.
- **Die Seite trägt 320 Kacheln:** kein Überlauf bei 390 und 1280 px, die Bilder laden erst beim Scrollen. Aber die Sammlung ist 20.000–24.000 px hoch, und im Editor lässt sich ein Buch nur durch Scrollen finden.
- **Rückweg:** mit der Zuordnungsdatei 314 von 320 Kacheln sicher bei ihrem Buch (ohne sie 300); die 6 übrigen sind Werke mit zwei oder drei Büchern in Calibre. „Das Lied von Vogel und Schlange" bekam auf der Probe-Kopie das auf der Seite gewählte Oetinger-Cover und nach der Rücknahme sein altes zurück; danach alle 423 Cover bytegleich mit dem Original.

**Offen, bei Julian:** die Test-Sammlung ansehen; die 69 Vorschläge durchsehen und anhaken; wenn es passt, dasselbe unter der eigenen ID (Schritt 3b); `lab/calibre --write` an der echten Bibliothek (5.16).

**Was dieses Werkzeug nicht ist:** Julian, 2026-10-03: „das soll ja einfach erstmal nur eine sammlung initialisieren aus einer calibre datei, die man hochlädt oder verbindet". Das Ergebnis ist dasselbe — eine Sammlung aus der Bibliothek —, der Weg ein anderer: hier läuft ein Kommando auf Julians Mac, liest den Bibliotheksordner und braucht seine ID in einer Datei. Auf der Seite lädt niemand etwas hoch. Die Fassung für die Seite ist als 5.17a in der Roadmap vorgeschlagen; was sie von hier übernehmen kann, sind `clean.ts` und `assign.ts`.

**Was das Experiment nicht kann:** 55 der 328 Werke haben bei Open Library höchstens vier Ausgaben — dort gibt es auf der Seite wenig zu wählen. Manche davon sind verirrte Einzelwerke neben dem großen („Der Prozess" traf ein Werk mit einer Ausgabe statt Kafkas *Proceß*); die Suche von Hand auf der Prüfseite behebt den Einzelfall, eine Regel dafür gibt es nicht.
