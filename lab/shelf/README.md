# lab/shelf — vom Foto des eigenen Regals zur teilbaren Sammlung

Julian, 2026-09-26: „setup lab project: take a picture of your own books, the website fetches the works with the covers and sets up a shareable link of a collection", dann „build a prototype". Roadmap **5.11**. Stand: **Prototyp gebaut 2026-09-26, Beispielmodus geprüft; die Erkennung wartet auf `ANTHROPIC_API_KEY` und die Messung auf fünf echte Fotos.**

## Die Frage

Kann ein Foto — ein Regal mit Buchrücken oder ein Stapel mit Umschlägen — zuverlässig genug in Werke und **die abgebildeten Ausgaben** übersetzt werden, dass daraus ohne Nacharbeit eine Wand wie eine Sammlung wird, mit einem Link, den man teilen kann?

## Entscheidungen (Julian, 2026-09-26, meine Vorschläge angenommen)

1. **Erkennen mit einem Bildmodell über die Anthropic-API** (`claude-sonnet-5`, Rückfall `claude-opus-5-5`, wenn das Konto das erste nicht nutzen darf).
2. **Der geteilte Link trägt die Liste selbst** (im Teil nach `#`), nichts wird gespeichert.
3. **Das Foto wird nie gespeichert**: es liegt nur für die Dauer der Anfrage im Speicher des Servers, geht einmal an Anthropic und wird weder geschrieben noch geloggt.
4. Vorerst nur lokal im Lab; eine Seite der Website (`/shelf`?) wäre ein eigener Roadmap-Punkt.

## Starten

```bash
# im Worktree; der Schlüssel steht in der .env.local des Hauptordners
set -a; source ../../../.env.local; set +a
npx tsx lab/shelf/serve.ts          # dann http://127.0.0.1:4330
```

Aus dem Hauptordner selbst: `set -a; source .env.local; set +a; npx tsx lab/shelf/serve.ts`. Ohne `ANTHROPIC_API_KEY` startet der Server trotzdem; die Seite sagt dann oben, dass kein Foto gelesen werden kann, und bietet **„Mit der Beispielliste ausprobieren"** (`sample.json`, zwölf Bücher, drei davon als Umschlag ohne Bild). `PORT` und `SHELF_SITE` (Ziel der Kachel-Links, Voreinstellung die Produktion) sind überschreibbar.

## Ablauf, wie gebaut

1. **Foto** wählen oder hineinziehen. Der Browser verkleinert es auf 1600 px lange Kante (JPEG 0,9, EXIF-Drehung berücksichtigt), bevor es den Rechner verlässt; größer liest das Modell ohnehin nicht.
2. **Erkennen** (`recognize.ts`): eine Anfrage mit dem Bild als base64 und strukturierter JSON-Ausgabe: je Buch `title`, `author`, `kind` (`spine`/`cover`), `box` [x, y, w, h] in Bildanteilen, `confidence`. `parseRecognition` liest auch ein Code-Fence, Prosa drumherum oder ein nacktes Array, beschneidet Kästen aufs Bild und nennt jede Reparatur; kein JSON wird als Fehler gemeldet, nicht als leeres Regal. Die Seite zeichnet die Kästen nummeriert über das Foto.
3. **Zuordnen** (`match.ts`): je Buch eine Suche über `lib/search.ts` (Open Library, kein Google), **eine Anfrage nach der anderen**, im Speicher gemerkt bis zum Neustart. `pickWork` gewichtet gleichen Hauptautor (Nachname; Vorname nur, wenn beide einen haben) vor gleichem Titel und lässt sonst die Reihenfolge der Suche entscheiden, die schon nach `rankContext` sortiert ist. Passt nur der Titel oder gar nichts, wird noch einmal nur nach dem Titel gesucht.
4. **Ausgabe wählen**: bei `kind: cover` wird der Kasten aus dem Foto geschnitten, signiert wie in `lib/imagehash.ts` (dHash, Helligkeit, Farbe) und mit den Covern von Seite 0 des Werks verglichen (`getWorkPage` mit `googleBooks: false`, ohne Geschwister und Beschreibung; Signaturen aus dem Index oder gehasht). Das nächste Cover mit Hamming ≤ 14 und — wo beide Farbe haben — Farbabstand ≤ 0,52 gilt als **die abgebildete Ausgabe**; sonst das Standardcover des Werks. Jede Kachel sagt, wie ihr Cover gewählt wurde: „Ausgabe aus dem Foto (Abstand d von n Covern)", „keins nah genug (nächstes d)", „Buchrücken — Standardcover", „Umschlag, aber kein Foto", „von Hand gewählt".
5. **Korrigieren**: je Kachel „× falsch" (weg), „neu suchen" (Suchfeld über `/api/search`, Treffer mit Cover antippen) und „anderes Cover" (Cover von Seite 0 des Werks, ungehasht).
6. **Teilen** (`sharelink.ts`): `#s=` + base64url aus Versionsbyte und je Buch zwei LEB128-Varints (Werknummer, Cover-ID; 0 = kein Cover), optional `&t=` Titel. Die geteilte Wand wird **nur aus dem Fragment** gebaut: Cover sofort von `covers.openlibrary.org`, Titel und Autor mit **einer** Open-Library-Suche `key:(/works/… OR …)` direkt aus dem Browser. Das Fragment erreicht keinen Server, auch diesen nicht. Die Seite trägt eine Kopie von Kodierer und Dekodierer; ein Test prüft, dass beide dieselben Bytes schreiben.

## Nach Farben ordnen (ROADMAP 5.16, seit 2026-09-28)

Nach der Erkennung liest der Browser je Buch die Farbe aus dem Foto — bei Rücken zuvor den Kasten des Modells auf die Trennlinien geschoben — und die Wand lässt sich „wie im Foto", „nach Farben" oder „hell nach dunkel" ordnen; der geteilte Link trägt die gewählte Reihenfolge. Code, Regeln und Messung in [lab/colorsort/README.md](../colorsort/README.md#als-schritt-im-regal-ablauf-labshelf-seit-2026-09-28); der Server bündelt `lab/colorsort/shelfcolors.ts` als `/colors.js`. Im Beispielmodus malt die Seite ein Regal als Foto, damit der Schritt ohne Schlüssel zu sehen ist (Farben erfunden).

## Die Ausgabe vom Buchrücken (ROADMAP 5.16, seit 2026-09-28)

Julian, 2026-09-28: „der plan ist auch, dass du die seite das entsprechende cover der im foto gezeigten version findet. schwierig vom buchrücken aus, aber lass es uns versuchen".

Ein Rücken zeigt weder Vorderseite noch ISBN. Zwei Dinge auf ihm sagen etwas über die Ausgabe:
1. **Der Verlag am Fuß.** Das Modell liest ihn jetzt mit. `recognize(…, { publisher: true })` erweitert Prompt und Schema; die Website ruft ohne die Option auf und bleibt Wort für Wort gleich. `samePublisher` in `edition.ts` vergleicht locker: gemeinsames Wort ohne „Verlag/Books/Press/…", oder Initialen („dtv" = Deutscher Taschenbuch Verlag).
2. **Die Farbe.** Verlage ziehen die Farbe der Vorderseite meist über den Rücken. Der Rücken-Kasten wird auf die Kanten geschoben (`refineSpineBox`), seine Farbe gelesen. Von jedem Kandidaten-Cover lädt der Server das kleine Bild (`-S.jpg`, vier gleichzeitig, im Speicher gemerkt) und nimmt seine drei Hauptfarben. Abstand = OKLab-Abstand zur nächsten Hauptfarbe mit ≥ 15 % Anteil.

**Regel** (`pickBySpine`, gesetzt, nicht gemessen): Kandidaten sind die Cover von Seite 0 des Werks mit demselben Verlag, ohne Verlag die ersten 16. Gewählt wird bei Verlagstreffer das farblich nächste Cover, wenn der Abstand ≤ 0,10 ist; ohne Verlag nur, wenn es außerdem das zweitbeste um ≥ 0,03 schlägt. Sonst bleibt das Standardcover, und die Kachel sagt, was verglichen wurde. Der Verlag allein reicht nie: ein Verlag druckt ein Werk unter vielen Umschlägen.

**Ablauf:** ein zweiter Durchgang nach den Werken, damit die Wand zuerst steht und die Cover an ihrem Platz wechseln. Er kostet je Rücken eine Editions-Anfrage an Open Library (Seite 0) und bis zu 16 kleine Coverbilder. „anderes Cover" zeigt bei Rücken die Cover in der Reihenfolge der Ähnlichkeit, mit Verlag, Jahr und Abstand.

**Gemessen (2026-09-28), gestellt:** als „Rücken" diente ein Streifen aus der Mitte eines echten Open-Library-Covers (ein Sechstel der Breite) vor grauer Wand, der Kasten 8 px zu weit links, auf drei Werken (Gatsby 7 Cover auf Seite 0, `OL1168007W` 7, `OL82563W` 75).
- **Mit Verlag: 6/6, 7/7, 9/10** richtig; der eine Fehler (Cappelen Damm) stand erst auf Platz 8.
- **Nur Farbe: 3/7 und 4/10** gewählt, alle gewählten richtig. Die übrigen lehnte die Regel ab, obwohl das richtige Cover in 13 von 17 Fällen auf Platz 1 der Liste stand. Mit Verlag wählt sie also, ohne Verlag bietet sie an.
- Dauer: 8,8 s für Gatsby, sechs Rücken, kalt.
- **Was das nicht misst:** ein echter Rücken hat oft eine andere Farbe als die Mitte der Vorderseite (Band, Streifen, schwarzer Rücken bei farbiger Front); Licht und Weißabgleich eines Telefons; und ob Sonnet den Verlag wirklich lesen kann. Das zeigen erst Julians Fotos.

**Grenzen:** nur Seite 0 (die 100 jüngsten Ausgabensätze) wird verglichen, Gatsby hat dort 7 von 379 Covern. Ein älteres Exemplar findet seine Ausgabe daher oft nicht und bekommt ehrlich das Standardcover. Weitere Seiten kosten je eine Anfrage.

## Gemessen (2026-09-26)

- **Linklänge** (reale Größenordnung der IDs: Werke um 27–33 Mio., Cover um 12 Mio.): **20 Bücher 240 Zeichen, 60 Bücher 667** mit `http://127.0.0.1:4330/`; mit `https://beautifulcovers.vercel.app/shelf` 258 bzw. 685. Rund 10,7 Zeichen je Buch. Die Beispielwand (11 Bücher nach einer Löschung, Titel „Probe-Regal") ergab 145 Zeichen.
- **Beispielmodus, kalt:** 12 von 12 Werken gefunden, alle als `author+title`, **7,9 s** Open Library für zwölf Suchen nacheinander; warm 0,1 s.
- **Ausschnitt-Vergleich mit einem idealen „Foto"** (ein Open-Library-Scan in einen grauen Rahmen geklebt, Kasten exakt): Gatsby Abstand 2 unter 7 Covern, *Beloved* Abstand 0 unter 52 — der Weg Ausschnitt → Signatur → Cover funktioniert. Über echte Fotos (Perspektive, Glanz, Regalkante) sagt das **nichts**; die Schwelle 14 ist gesetzt, nicht gemessen.
- Geprüft im Browser-Pane: Beispielmodus, Entfernen, Neu-Suchen („Animal Farm Orwell" → 12 Treffer, ersetzt), anderes Cover (Gatsby: 7 auf Seite 0), Link erzeugen, geteilte Wand aus dem Link (11 Titel von Open Library nachgeladen). Bei 375 px: drei Kacheln je Reihe à 104 px, keine waagrechte Verschiebung.

## Was noch fehlt — die eigentliche Messung

- ~~`ANTHROPIC_API_KEY` in die `.env.local` des Hauptordners~~ — **eingetragen von Julian am 2026-09-28**; der Server meldet damit „recognition with claude-sonnet-5“. Lokal hat das Modell noch kein Foto gesehen.
- **Fünf echte Regalfotos von Julian** (Rücken, Umschläge, gemischt; hell und schummrig). Je Foto: Anteil richtig erkannter Werke ohne Eingriff, Anteil richtig gewählter Ausgaben bei Umschlägen, Fehltreffer, Dauer (steht in der Statuszeile), Tokens (ebenfalls; daraus die Kosten). Schwelle zum Weitermachen (Vorschlag): ≥ 80 % der Werke richtig ohne Eingriff, jede Korrektur in unter 10 Sekunden. Die Fotos gehören nach `docs/tests/` (git-ignoriert), die Zahlen in diese Datei und in docs/history.md.

## Offene Punkte

1. **Übersetzte Titel landen auf Nebendatensätzen.** Ein Rücken „One Hundred Years of Solitude" trifft `OL43108828W` (2 Ausgaben, Titel und Autor passen genau) statt `OL274505W` *Cien años de soledad* (208); „Die Verwandlung" trifft den deutschen Datensatz (9) statt *Metamorphosis* (956). Die Kachel öffnet auf der Website trotzdem eine Wand, und die Website lädt Geschwister-Datensätze nach (6.13); eine Regel „größeres Werk desselben Autors weiter oben gewinnt" würde aber auch kleine eigene Bücher (Kafkas *Erzählungen und kleine Prosa*, 8) auf das berühmte umbiegen. Erst mit echten Fotos entscheiden.
2. **Seite 0 ist die jüngste Seite.** Nur die neuesten 100 Ausgabensätze werden verglichen (Gatsby: 7 Cover von 379). Ein älterer Umschlag findet seine Ausgabe dann nicht und fällt aufs Standardcover — ehrlich beschriftet, aber verloren. Weitere Seiten kosten je eine Open-Library-Anfrage; messen, wie oft das nötig wäre.
3. **Die Schwelle Hamming ≤ 14 / Farbe ≤ 0,52 ist ungemessen** (siehe oben).
4. Gesucht wird mit `Titel Autor`; ein falsch gelesener Autor kann die erste Suche leeren, dann folgt die zweite nur nach Titel — zwei Anfragen für ein Buch.
5. Der Link zeigt auf diesen lokalen Server. Auf der Website wäre es `/shelf#s=…`; das wäre ein eigener Roadmap-Punkt mit eigener Prüfung (N11: nichts über den Teilenden, nichts gespeichert).
6. Ohne Schlüssel ist nur der Beispielmodus prüfbar; die Aufnahme mit dem Telefon (`<input type=file>` öffnet dort die Kamera-Auswahl) ist ungetestet.

## Dateien

`serve.ts` (Server, 127.0.0.1:4330), `index.html` (die eine Seite), `recognize.ts` (seit 5.13a nur ein Verweis auf `lib/recognize.ts`, das auch `/walls` nutzt; `pickWork` und Verwandte liegen in `lib/bookmatch.ts`), `match.ts` (Werk und Cover), `sharelink.ts` (Link), `sample.json`, Tests unter `__tests__/` ohne Netz.

## Regeln (lab/README.md)

Kein Google aus dem Lab ohne Messung; Tests ohne Netz; nichts erreicht die Website ohne eigenen Roadmap-Punkt.
