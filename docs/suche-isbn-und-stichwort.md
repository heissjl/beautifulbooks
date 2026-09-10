# Suche: ISBN und Stichwort

Gemessen am 2026-09-10 gegen den lokalen Entwicklungsserver, vierzehn Eingaben. Anlass: Julians Frage, wie die Suche nach ISBN und nach Stichworten funktioniert, „damit wir dort die beste Lösung finden".

Als Flussdiagramm: <https://claude.ai/code/artifact/a6ec70fb-ccff-4488-8624-66c75b0cbeff>

## Der Stand

**Die Suche unterscheidet nicht, was eingetippt wurde.** `lib/search.ts` normalisiert die Eingabe, weist alles unter `MIN_QUERY_LENGTH` (3) mit einem eigenen 400 ab und schickt den Rest als `q=` an Open Library — eine Anfrage, keine an Google (§8.7).

Das trägt weiter als erwartet: **Open Librarys allgemeine Suche erkennt ISBNs von sich aus**, in jeder Schreibweise.

## Was gemessen wurde

| Eingabe | Treffer | Erste Karte | Wo man landet |
|---|---:|---|---|
| `gatsby` | 13 | The Great Gatsby — Fitzgerald | Wand, nichts ausgewählt |
| `gatsby fitzgerald` | 10 | The Great Gatsby — Fitzgerald | Wand, nichts ausgewählt |
| `ishmael reed` | 18 | Mumbo jumbo — Ishmael Reed | Wand, nichts ausgewählt |
| `Der Prozess` | 8 | Der Proceß — Kafka | Wand, nichts ausgewählt |
| `1984` | 16 | Nineteen Eighty-Four — Orwell | Wand, nichts ausgewählt |
| `9780451524935` | 1 | Nineteen Eighty-Four | **224 Cover, keins markiert** |
| `978-0-451-52493-5` | 1 | Nineteen Eighty-Four | **224 Cover, keins markiert** |
| `978 0451 524935` | 1 | Nineteen Eighty-Four | **224 Cover, keins markiert** |
| `0451524934` (ISBN-10) | 1 | Nineteen Eighty-Four | **224 Cover, keins markiert** |
| `9780743273565` | 1 | The Great Gatsby | **232 Cover, keins markiert** |
| `9780451524936` (falsche Prüfziffer) | 0 | — | **„No books found"** |
| `9780000000000` (erfunden) | 0 | — | **„No books found"** |
| `OL1168083W` (Work-ID eingefügt) | 0 | — | **„No books found"**, obwohl die Seite existiert |
| `ab` | — | 400 | „Search for at least 3 characters" |
| (leer) | — | 400 | eigener Satz, keine Anfrage |

Eine ISBN-Suche kostet dieselbe eine Open-Library-Anfrage wie jede andere und antwortet in **0,4 bis 0,6 s** — schneller als eine Stichwortsuche (0,6 bis 3,2 s), weil der Index sofort greift.

## Der Befund

**Die ISBN-Suche funktioniert, sie hört einen Schritt zu früh auf.** Die Trefferkarte verlinkt über `detailHref` (`components/BookWorkCard.tsx`) auf `/book/<id>?q=9780451524935` — die ISBN steht also noch in der Adresse, wird aber von niemandem gelesen. Wer eine bestimmte Ausgabe in der Hand hält, bekommt die Wand aller 224 Cover und sucht von Hand.

Drei Nebenbefunde:

1. Eine **falsche Prüfziffer** ist von „Buch nicht im Katalog" nicht zu unterscheiden. Beides ergibt „No books found" — ein Satz über die Welt, wo einer über die Eingabe gemeint ist (N12, F1.7).
2. Eine **eingefügte Work-ID** findet nichts, obwohl genau diese Seite existiert.
3. Die Wand zeigt seit 1.1 **absichtlich nichts vorgewählt** — was für eine Stichwortsuche richtig ist und für eine ISBN-Suche das Gegenteil dessen, was gefragt wurde.

## Drei Wege

**1. Nichts ändern.** Kostet nichts. Preis: Wer mit einer ISBN kommt, sucht seine Ausgabe von Hand, und eine vertippte Prüfziffer sieht aus wie ein fehlendes Buch.

**2. Die Eingabe erkennen und durchreichen — empfohlen.** Vor der Suche prüfen, was da steht: `cleanIsbn` und `isbn10to13` liegen bereits in `lib/normalize.ts`, eine Work-ID ist `/^OL\d+W$/`. **Die Suche selbst bleibt unverändert**, Open Library beantwortet die ISBN weiterhin. Neu sind nur zwei Kanten: bei genau einem Treffer führt der Link auf `?isbn=…` statt `?q=…`, und die Detailseite wählt das Cover der Ausgabe vor, die diese ISBN trägt (`Edition.isbn13` liegt vor, die Kauf-Links brauchen es ohnehin). Eine Work-ID führt direkt auf ihre Seite.

Kosten: **keine zusätzliche Anfrage, kein Google-Kontingent.** Ehrliche Einschränkung: die Ausgabe muss unter den geladenen sein — jenseits von `MAX_EDITIONS_SCANNED` bleibt die Wand unmarkiert, und dann darf die Seite nichts anderes behaupten.

**3. Ein eigener ISBN-Weg über Google Books.** `/api/isbn/<isbn13>` gibt es schon, aber es beantwortet eine andere Frage: welches Bild ein Händler heute unter dieser Nummer zeigt, nicht welche Ausgabe gemeint ist. Preis: eine Google-Anfrage je Suche gegen ein Tageskontingent von 1.000 (E10), für etwas, das Open Library gratis beantwortet. **Nicht empfohlen.**

## Verwandt

- **F1.8 Query-Parsing** in Titel + Autor (E3) steht unter „Zurückgestellt, mit Auslöser". Weg 2 ist davon unabhängig: er zerlegt die Eingabe nicht, er erkennt nur ihre Form.
- Die Wortwahl bei null Treffern gehört zu **1.4** (ein Ausfall ist kein Befund) — hier in der milderen Form: eine unbeantwortbare Eingabe ist kein leeres Regal.
