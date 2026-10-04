# lab/calibre — Cover von der Seite in die eigene Calibre-Bibliothek

Roadmap 5.16 und 5.16a. Julian, 2026-10-03: „gibt es eine möglichkeit dass ich die cover-seiten meiner bücher in meiner calibre bibliothek anpasse nach denen, die ich auf der website oder in einer collection auf der website auswähle? das ganze muss nicht für alle user funktionieren, sondern kann für mich lokal umgesetzt werden" — und danach: „mache sicherheitsvorkehrungen, dass es mir nicht meine bibliothek zerschießt".

Nur lokal, nur für Julian. Nichts davon ist auf der Website, und die Website ändert sich dafür nicht.

## Die Frage

Lassen sich die Cover, die Julian auf der Seite in einer Sammlung wählt, in seine Calibre-Bibliothek schreiben — dem richtigen Buch zugeordnet, groß genug, und so, dass jeder Tausch zurückgeht?

**Erfolg:** Julian wählt auf der Seite zehn Cover, startet ein Kommando, und zehn Bücher in Calibre tragen sie — mit weniger als einer falschen Zuordnung und einem Weg zurück.

## Die App: Bibliothek zuerst (5.16a)

Julian, 2026-10-03, nach dem ersten echten Lauf: „lass uns daraus eine lokale app bauen mit gui die mir meine calibre cover anzeigt und dann die website benutzt, damit ich gezielt cover ersetzen kann".

```bash
npm run calibre               # nur schauen: blättern, Werk finden, Cover vergleichen
npm run calibre -- --write    # „Use this cover" schreibt, ein Buch je Klick (Calibre geschlossen)
```

Das Werkzeug druckt eine Adresse mit Token (Port 4329). Die Seite zeigt **jedes Buch der Bibliothek mit dem Cover, das es hat**, samt Pixelmaß; filtern nach Titel oder Autor, nach „Small covers" (unter 400 px Breite), „No cover", „Changed here"; sortieren nach Autor, Titel, kleinstem Cover.

Ein Klick auf ein Buch öffnet es: die App sucht das Werk bei Open Library — über die ISBN, wo es eine gibt, sonst über Titel und Autor mit der Suche der Seite (`lib/search.ts`, `pickWork`) — und legt darunter **die Cover des Werks** aus, mit Jahr und Sprache, die Sprache des Buchs vorgewählt, die Cover der eigenen Ausgabe („your edition", aus der ISBN) vorn. Stimmt das Werk nicht, gibt es die anderen Treffer und ein Suchfeld; die Wahl merkt sich die App je Bibliothek (`works.json` neben den Backups). Ein Klick auf ein Cover holt das Bild in voller Größe und stellt es neben das in Calibre; „Use this cover" schreibt es — durch dieselbe `safety.ts` mit allen Sicherungen unten —, „Put the previous cover back" nimmt es zurück.

**„Die Website benutzen" heißt hier: ihr Code und ihr Katalog, lokal ausgeführt.** Die laufende Seite wird nicht gefragt — ihre Rate-Limits und ihr Google-Kontingent gehören den Besuchern —, und Google Books wird nie gefragt (Lab-Regel 6). Was die App zeigt, sind deshalb die Open-Library-Cover des Werks, ungefaltet; je Werk führt ein Link auf dessen Seite bei buyitscovers.com.

## Aus einer Sammlung (5.16)

```bash
npx tsx lab/calibre/selftest.ts                 # 1. der Schreibweg auf einer Wegwerf-Bibliothek (Calibre geschlossen)
npx tsx lab/calibre/rehearsal.ts                # 2. eine Probe-Kopie der echten Bibliothek: alle Bücher und Cover, keine E-Book-Dateien
npx tsx lab/calibre/serve.ts <sammlung>         # 3. nur schauen: Zuordnung und Bildgrößen, nichts kann geschrieben werden
npx tsx lab/calibre/serve.ts <sammlung> --write --library "<Probe-Kopie>"   # 4. der erste Schreiblauf gehört auf die Kopie
npx tsx lab/calibre/serve.ts <sammlung> --write # 5. die echte Bibliothek
npx tsx lab/calibre/undo.ts                     # was sich zurücknehmen lässt; mit <Buchnummer> oder --all nimmt es zurück
```

`<sammlung>` ist die Adresse oder ID einer eigenen Sammlung (`https://buyitscovers.com/c/<id>`) oder der Slug einer kuratierten (`sf-masterworks`). Das Werkzeug druckt eine Adresse mit Token; nur die öffnet die Seite. Gewählt wird auf der Website wie heute — das Werkzeug liest die Sammlung nur.

Jede Zeile zeigt links das Cover, das Calibre jetzt hat, rechts das aus der Sammlung, beide mit Pixelmaßen. „Use this cover" schreibt ein Buch; „Use all sure matches" schreibt alle sicheren Zuordnungen, deren neues Bild nicht kleiner ist als das alte.

## Die Sicherungen

Jede steht im Code, nicht nur hier ([safety.ts](safety.ts)):

1. **Ein einziges Kommando schreibt, und es ist Calibres eigenes:** `calibredb set_metadata <id> --field cover:<Datei>`. `metadata.db` und die Buchordner fasst das Werkzeug nie selbst an; es legt nichts an, löscht nichts, benennt nichts um. Gelesen wird über `sqlite3 -readonly`.
2. **Ohne `--write` kann nichts geschrieben werden** — der Server lehnt jede Schreibanfrage ab, die Knöpfe sind aus.
3. **Nie, während Calibre läuft.** Geprüft vor jedem Schreiben (über den Programmnamen); `calibredb` verweigert zusätzlich von sich aus.
4. **Vor dem ersten Schreiben einer Sitzung eine Kopie von `metadata.db`**, vor jedem Schreiben eine Kopie des alten `cover.jpg`, beide per SHA-256 mit dem Original verglichen, bevor etwas geändert wird. Liegt das alte Cover nur in iCloud und nicht auf dem Mac, wird nicht geschrieben.
5. **Das neue Bild wird vorher ganz dekodiert:** eine Fehlerseite, ein Platzhalter, eine halbe Datei oder ein Bild unter 200 × 280 px wird nie Cover.
6. **Ein kleineres Bild braucht eine eigene Bestätigung** (weniger als 90 % der Pixel des alten); der Sammelknopf lässt solche Zeilen aus.
7. **Nach jedem Schreiben wird die Bibliothek neu gelesen:** gleiche Bücher, jede andere Zeile unverändert, bei diesem Buch Titel, Autoren, Ordner und Formate unverändert, die E-Book-Dateien im Ordner unberührt (Größe und Änderungszeit), das neue Cover lässt sich dekodieren und hat die Proportionen des gegebenen Bilds. Stimmt etwas davon nicht, kommt das alte Cover zurück und die Sitzung **schreibt nicht weiter**.
8. **Ein Journal** hält jeden Schreibvorgang mit seinem Backup fest; jeder lässt sich zurücknehmen, von der Seite aus oder mit `undo.ts` — auch ohne die Sammlung, die ihn ausgelöst hat.
9. **Nur sichere Zuordnungen ohne Klick auf die Zeile:** sicher ist eine gemeinsame ISBN oder gleicher Titel **und** gleicher Autor, und nur wenn genau ein Buch passt. Alles andere ist ein Vorschlag, den Julian in der Zeile selbst wählt.
10. **Der Server hört nur auf 127.0.0.1**, nimmt Anfragen nur mit dem Token aus dem Terminal, Schreibanfragen nur als JSON von der eigenen Seite, und nimmt aus einer Anfrage nie einen Pfad, eine Adresse oder ein Kommando — nur eine Zeilennummer und eine Buchnummer, beide gegen das Geladene geprüft.

**Wo die Backups liegen:** `~/Library/Application Support/BuyItsCovers/calibre/<Name der Bibliothek>-<Kürzel>/` — `snapshots/` (Kopien von `metadata.db`), `covers/<Buchnummer>/` (alte Cover), `journal.jsonl`. Außerhalb des Repositorys (ein Worktree wird gelöscht) und außerhalb der Bibliothek (der Ordner gehört Calibre). Jede Bibliothek hat ihr eigenes Journal, weil eine Probe-Kopie dieselben Buchnummern hat wie das Original. Das Werkzeug löscht dort nie etwas; `CALIBRE_BACKUP_DIR` verlegt den Ort.

**Wenn doch etwas schiefgeht:** Calibre schließen, `npx tsx lab/calibre/undo.ts --all`. Letzter Ausweg: die jüngste Kopie aus `snapshots/` als `metadata.db` in die Bibliothek legen und die Cover aus `covers/` zurückkopieren — oder in Calibre „Bibliothek wiederherstellen", das die Datenbank aus den `metadata.opf` der Buchordner neu baut.

**Was die Sicherungen nicht abdecken:** Die Bibliothek liegt in iCloud Drive, wovon Calibre selbst abrät — das Risiko, dass iCloud während eines Schreibens synchronisiert, ist dasselbe wie bei jeder Änderung in Calibre und wird hier nicht kleiner. Und das Cover **in der EPUB-Datei** ändert das Werkzeug nicht: Calibre schreibt es in die Kopie, die es an den Reader schickt oder exportiert.

## Dateien

| Datei | |
|---|---|
| `library.ts` | die Bibliothek lesen, nur lesen (`sqlite3 -readonly`) |
| `source.ts` | eine Sammlung als Liste von Covern: eigene (ein Abruf bei der Seite) oder kuratierte (aus `data/collections.json`) |
| `match.ts` | Cover ↔ Calibre-Buch: ISBN, Titel + Autor, Vorschläge — rein, getestet |
| `image.ts` | ist das ein Bild, das Cover werden darf? — rein, getestet |
| `safety.ts` | der einzige Ort, der schreibt: Prüfungen, Backup, Journal, Kontrolle danach, Rücknahme |
| `app.ts`, `app.html` | **die App** (Port 4329): Bibliothek als Cover-Wand, Werk finden, Cover wählen, schreiben |
| `find.ts` | Buch → Werk: Titel glätten, ISBN-Abruf, Suche, Vorschlag; die gemerkten Zuordnungen (`WorkMap`) |
| `covers.ts` | Ausgaben eines Werks → wählbare Cover mit Sprache, Jahr, Verlag — rein, getestet |
| `download.ts`, `http.ts` | Bild holen und prüfen; Antworten und die Tür (127.0.0.1, Token) — von beiden Servern benutzt |
| `serve.ts`, `index.html` | der Sammlungs-Modus (Port 4327) und seine Seite |
| `selftest.ts` | der ganze Schreibweg auf einer Wegwerf-Bibliothek, 21 Prüfungen |
| `rehearsal.ts` | Probe-Kopie der echten Bibliothek (nur `metadata.db` und Cover) |
| `undo.ts` | zurücknehmen ohne Seite |

Open Library und Google werden nur nach Bilddateien gefragt, eine je Cover, höchstens zwei gleichzeitig; keine Anfrage an die Google-Books-API (Lab-Regel 6).

## Status

**Gebaut und auf einer Probe-Kopie durchgespielt am 2026-10-03** ([Historie](../../docs/history.md)). **Der erste Lauf an der echten Bibliothek, am selben Abend auf Julians Wort („teste mit ubik und invisible man"):** zwei Cover geschrieben — *Ubik* (#457, 315 × 500 → 319 × 500) und *The Invisible Man* (#364, 309 × 475 → 309 × 475, eine andere Datei gleicher Größe). Danach 445 Bücher und 423 Cover wie vorher, die E-Book-Dateien beider Ordner mit unveränderter Änderungszeit, beide alten Cover und eine Kopie von `metadata.db` im Backup-Ordner, beide Schritte in `undo.ts` aufgeführt. **Julian nahm beide danach selbst zurück** (`undo.ts --all`): beide Cover sind wieder bytegleich die alten (SHA-256 wie vor dem Schreiben), das Journal ist leer. Der ganze Kreis — schreiben, prüfen, zurücknehmen — ist damit an der echten Bibliothek gelaufen. Die Rücknahme war ein Versehen (Julian: „ich wollte nicht zurücknehmen, ich dachte der befehl öffnet calibre"); beide Cover wurden gleich danach noch einmal geschrieben und **stehen jetzt in der Bibliothek**.

Gemessen an Julians Bibliothek (445 Bücher, 423 mit Cover, 131 mit ISBN) und der Sammlung „SF Masterworks" (73 Cover):

- **Zuordnung:** 17 sicher (15 über Titel + Autor, 2 über ISBN), alle 17 von Hand geprüft und richtig; 2 „ähnlicher Titel" (beide richtig, aber nicht automatisch); 12 nur „gleicher Autor". Über alle 56 Sammlungen: 125 sichere Zuordnungen bei 4.353 Covern, davon 4 über die ISBN — **der Titel trägt, nicht die ISBN.**
- **Bildgröße:** alle 17 Bilder kamen in 5 s; typisch 310 × 500 px, das größte 415 × 635. **12 von 17 sind kleiner als das Cover, das Calibre schon hat** (mit der 90-%-Schwelle 10). Für die Bibliotheksansicht eines Readers reicht das, als Vollbild ist es weich. Das ist die Grenze des Experiments, nicht des Werkzeugs: größere Bilder hat Open Library für diese Drucke nicht.
- **Schreibweg:** 9 Schreibvorgänge und 9 Rücknahmen auf der Probe-Kopie (Seite, Sammelknopf, `undo.ts --all`); danach waren alle 423 Cover bytegleich mit dem Original. Ein laufendes Calibre-Programm hat das Schreiben blockiert, wie es soll.

**Die App (5.16a), gebaut am selben Abend:** gegen die echte Bibliothek nur schauend geprüft, schreibend auf einer Probe-Kopie. Die Bibliothek in Zahlen: 423 Cover, **76 unter 400 px Breite**, 22 Bücher ohne Cover; Sprachen laut Calibre 277 englisch, 67 deutsch, 26 spanisch, 3 niederländisch, 72 ohne Angabe. Ein Buch öffnen dauert 1,4–5,6 s für das Werk und 2,5–3,3 s für die erste Seite Cover. Fünf Stichproben: zwei über die ISBN richtig (samt „your edition"-Covern), zwei deutsche Titel über Titel + Autor richtig (*Jenny*, *Ochsenkrieg*), einer nicht gefunden (*Francisco Pizarro, der Eroberer von Peru*). Für *Jenny* (600 × 800) hatte Open Library ein **größeres** Bild (754 × 1200) — die Grenze „meist kleiner" gilt für die SF-Masterworks-Drucke, nicht überall. Durchgeklickt auf der Kopie: filtern, öffnen, wählen, schreiben, zurücknehmen; danach bytegleich. 33 Tests.

**Offen:** eine eigene Sammlung statt einer kuratierten (die Kacheln tragen dort die ISBNs ihrer Drucke); übersetzte Titel finden kein Buch („Per Anhalter durch die Galaxis") — das löst die Gegenrichtung, [5.17](../../docs/plans/PLAN-5.17-calibre-zur-sammlung.md), die sich merkt, welches Buch welches Werk ist.
