# Ausgaben, Drucke und Cover recherchieren

Wie man herausfindet, welches Cover zu welcher Ausgabe und welchem Druck gehört, und was jede Quelle dazu taugt. Entstanden am 2026-10-08 aus der Prüfung der SF Masterworks (Julian: „kannst du aus diesen letzten änderungen und recherche regeln ableiten … damit wir mehr factual accuracy haben in zukunft? vllt brauchen wir mehr regeln und kontext im umgang mit jeder dieser Datenbanken und allgemein mit der recherche von editionen und versionen, da das der knackpunkt der seite ist“). Die Kurzfassung steht in CLAUDE.md unter „Editions, printings and covers“; Messungen und Fälle in [history.md](history.md).

## 1. Die Begriffe, die auseinanderzuhalten sind

| Begriff | Was es ist | Woran man es erkennt |
|---|---|---|
| **Werk** | der Text (*The Forever War*) | Open-Library-Werk `OL…W` |
| **Ausgabe** | eine Veröffentlichung mit eigener ISBN, eigenem Format, eigener Reihe | ISBN, Verlag, Reihe und Nummer |
| **Druck** | eine Auflage derselben Ausgabe, oft unter derselben ISBN | Datum und Zahlenreihe im Impressum, ISFDB-Publikation |
| **Cover** | das Bild auf einem bestimmten Druck | Bild, Künstler, „variant of“ |

**Eine ISBN ist kein Druck und kein Cover.** Gollancz hielt die ISBN 1857988086 von 1999 bis 2004 und wechselte 2004 das Bild (Raumschiff → Soldat, beide Chris Moore). Open Library zeigt zu dieser ISBN zufällig den Druck von 2004. Das ist der Fall, für den die Seite existiert — und derselbe Fehler, den sie bei sich selbst machen kann.

**Zwei Reihen mit demselben Namen sind zwei Reihen.** „Gollancz SF Masterworks (HC)“ Nr. III (2001, gebunden) ist nicht die nummerierte Taschenbuchreihe „Millennium / Gollancz SF Masterworks“ Nr. 73 (2009). Vor jeder Zuordnung zu einer Reihensammlung: Reihenname *und* Nummer auf dem Druck lesen.

## 2. Die Quellen

### ISFDB (isfdb.org) — die Autorität für SF-Drucke

- **Was sie kann:** jede Publikation (Druck) einzeln, mit Datum, ISBN, Reihe und Nummer, Preis, Format, **Cover-Künstler je Druck** und Hinweisen wie „variant of *The Buchanan Campaign* 1995“ (dasselbe Bild schon früher anderswo) oder „‚72‘ printed on the spine“. Die Seite einer Publikationsreihe (`pubseries.cgi?<n>`) listet alle Drucke aller Nummern; der früheste je Nummer ist der Erstdruck.
- **Bilder:** meist auf `isfdb.org/wiki/images/…`, manchmal von Amazon (`m.media-amazon.com`, „Cover art supplied by Amazon.com“) — ein Amazon-Bild kann einen späteren Druck zeigen als den beschriebenen; dann das Datum des Datensatzes nicht auf das Bild übertragen.
- **Zugang:** die Seiten liegen hinter Cloudflare. `curl` und WebFetch bekommen 403 oder „Just a moment…“. Gelesen wird in Julians Chrome: eine Seite öffnen, weitere Seiten mit `fetch()` aus derselben Seite holen (gleicher Ursprung, ein Aufruf alle 0,8 s), Ergebnisse in eine Variable schreiben und stückweise auslesen (die Antwort des Werkzeugs wird bei etwa 1.000 Zeichen abgeschnitten). Die **Bilder** dagegen lädt `curl` ohne Weiteres.
- **Vorsicht:** „date unknown“-Drucke sortieren ans Ende; eine Reihe kann denselben Titel in mehreren Formaten führen.

### Open Library — Werke, Ausgaben, Cover-Bilder

- **Eine Ausgabe ist eine ISBN, kein Druck.** Ihre `covers` sind eine geordnete Liste; das erste Bild ist das, was überall gezeigt wird (auch auf dieser Seite). Ein Datensatz „1999“ kann das Bild von 2004 tragen.
- Wichtige Fakten stehen schon in CLAUDE.md („Facts about the APIs“): Autoren der Ausgaben als Schlüssel, Größe eines Covers ohne das Bild über `covers.openlibrary.org/b/id/<n>.json`, Sperre bei Schüben.
- **Ein Bild hochladen** (nur mit Julians Ja, unter seinem Konto `wertstoffhof`): die Seite `https://openlibrary.org/books/<OLID>/x/add-cover` direkt öffnen, Datei ins Feld setzen, das Formular mit `form.submit()` abschicken — der Knopf im eingebetteten Dialog schickt nichts ab. Das neue Bild wird **Hauptcover** der Ausgabe und ist sofort unter seiner Nummer abrufbar. Hochladen auf die Ausgabe, deren ISBN **und** Datum zum Druck passen (2026-10-08 zuerst auf die gebundene Ausgabe 2001 statt auf die nummerierte 2009 — korrigiert).
- **Ein Bild entfernen oder umsortieren:** `…/x/manage-covers`, Vorschaubild in den Papierkorb ziehen, `form.submit()`. Nebenwirkung: der Platzhalter `-1` wird mitgespeichert (`covers: [380098, -1]`); bei Open Library verbreitet, harmlos.
- Jede Änderung mit Ausgabe, alter und neuer Cover-Nummer in die Historie.

### Google Books

- Das Bild zu einer ISBN ist das, was der Verlag **heute** dafür eingetragen hat — meist der neueste Druck. Gut für „was liefert ein Laden jetzt“ (das Verdikt der Seite), wertlos für „wie sah der Erstdruck aus“.

### Wikipedia-Reihenlisten

- Spalten mit zwei ISBN bei den SF Masterworks: die erste ist die der ursprünglichen nummerierten Reihe, die zweite die der Neuauflage ab 2010. **Keine** sagt etwas über Drucke innerhalb einer ISBN. Gut, um eine Reihe vollständig und in Nummernfolge zu haben; das Cover kommt aus der ISFDB.

### Reddit und imgur

- reddit.com und i.redd.it sind für Claude gesperrt (Browser und Abruf); über Spiegelseiten auszuweichen umginge die Sperre. Julian speichert eine Liste (`…/top.json?t=all&limit=100`), ein Skript, das er selbst startet, lädt die Bilder (`lab/collections/badscificovers_download.py`). imgur-Bilder lädt `curl`.
- Bild-Foren verlangen Bilder auf Reddit oder imgur; die eigene Seite gehört in einen Kommentar.

## 3. Bilder vergleichen

- Die Bild-Signatur (dHash, `lib/imagehash.ts`) **reiht nur**. Ein Foto eines Buchs auf dem Tisch liegt 18–26 Bit vom sauberen Scan desselben Covers; ein anders beschnittener Scan desselben Bildes bis 31 (*VALIS*). Entschieden wird auf einem Kontaktbogen: links die Vorlage, daneben die nächsten Kandidaten mit Abstand (`lab/collections/badscificovers_sheets.py`, die Bögen der SF-Masterworks-Prüfung unter `lab/collections/in/sfm-check/`).
- Großbilder vorher verkleinern: der Decoder verweigert Bilder mit mehreren Megapixeln (Reddit-Fotos mit 2160 × 3840) und meldet dann „kein Bild“.
- „Steht nicht im Katalog“ erst nach dem Durchgehen aller Ausgaben des Werks, nicht nach einer Suche.

## 4. Was in eine Sammlung gehört

- **Ein Credit gehört zum Bild eines Drucks** (6.52): Künstler, `coverIsbn` und `isfdbRecord` beschreiben genau das Bild unter `coverId`. Wechselt das Cover, wechseln sie mit — oder fallen weg.
- **Der `isfdbRecord` zeigt auf den Druck, dessen Bild gezeigt wird**, nicht auf den Erstdruck der ISBN (2026-10-08: die Soldaten-Kachel zeigte auf 1999).
- Ein Werk darf zweimal in einer Sammlung stehen, wenn die Reihe es in zwei Gestaltungen gedruckt hat; die Einleitung sagt es, die Reihenfolge ist Erstdruck vor Nachdruck. Eine Ausgabe einer *anderen* Reihe gehört nicht hinein.
- Online-Entwürfe (`/curate`) tragen keine Credits; die Seite ergänzt sie aus der Datei, wenn Werk und Cover übereinstimmen (`withFileFacts` in `lib/collections.ts`, seit 2026-10-08). Credits also immer in der Datei pflegen, dann `push-draft.ts`.
- **Steht ein Werk zweimal in der Sammlung, geht kein Online-Entwurf mehr** (die Seite lehnt das Veröffentlichen ab, sobald die *deployte* Datei ein Werk doppelt führt — ein Entwurf hält jedes Werk einmal). Dann: Datei ändern, deployen, den veröffentlichten Entwurf entfernen (`POST /api/curate/publish` mit `{ slug, clearDraft: true }`, Admin-Passwort als Bearer; dasselbe tut `lab/collections/serve.ts`), der Schalter bleibt an. So geschehen mit `sf-masterworks` am 2026-10-08.

## 5. Wenn jemand von außen widerspricht — und was dabei schiefging

Ein Leser schrieb unter den Reddit-Post: „The covers you have for The Forever War and More Than Human are not the original SF Masterwork covers.“ Er hatte recht. Die anschließende „Prüfung aller 73“ war **nicht** genau, obwohl sie es sein sollte (Julian, 2026-10-08: „der allerletzte punkt stimmt ja aber genau nicht. da hattest du den fehler gemacht, obwohl es ein genauer check sein sollte“):

- Verglichen wurde nur **Bild gegen Bild** (unseres gegen das des ISFDB-Erstdrucks). Wo sie abwichen, stand sofort „späterer Druck“ in den Notizen, in der Sammlung und auf dem Reddit-Bild — ohne nachzusehen, **zu welchem Druck unser Bild gehört**. Bei #73 war es kein späterer Druck, sondern eine gebundene Ausgabe einer anderen Reihe von 2001. Aufgefallen ist das erst, als Julian die Künstler noch einmal prüfen ließ.
- Nicht verglichen wurde die **ISBN**. Der Abgleich unserer `coverIsbn` mit den ISBN, die die ISFDB für jede Nummer der Reihe führt, findet die falsche Ausgabe in einer Zeile; nachgeholt am 2026-10-08, Ergebnis: zwei Treffer, #71 *Dune* (9780575073340, gebundene HC-Reihe 2001; nummeriert ist 0575081503) und #72 *The Moon Is a Harsh Mistress* (9780575073364; nummeriert 0575082410). #73 war da schon korrigiert. Die ISBN je Nummer stehen jetzt in `lab/collections/lists/sf-masterworks-isfdb-first.tsv`.

**Daraus die Regeln für jede Prüfung einer Reihe:**
1. Zuerst die **Ausgabe** prüfen (ISBN der Kachel gegen die ISBN der Reihe und Nummer in der ISFDB), dann den **Druck** (Datum), erst dann das **Bild**. Ein Bildvergleich allein sagt nur „anders“, nie „warum“.
2. Jede Beschriftung wie „späterer Druck“, „Erstdruck“, „Neuauflage“ braucht einen Datensatz mit Datum für genau dieses Bild. Ohne ihn heißt es „anderes Cover“ — oder nichts.
3. Ein Widerspruch von außen wird in der Quelle geprüft, bevor geantwortet wird; das Ergebnis geht in die Historie; dann die ganze Sammlung auf denselben Fehler — mit Regel 1, nicht nur mit dem Bildvergleich.
4. Was als „geprüft“ gemeldet wird, nennt, **was** geprüft wurde („Bild gegen Erstdruck“), nicht nur „alle 73 geprüft“.
