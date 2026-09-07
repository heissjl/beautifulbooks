# Testbericht: ein Durchklick als Nutzer, 2026-09-07

Aufgenommen von Claude auf Julians Bitte, gegen den laufenden Dev-Server. Was daraus als Anforderung folgt, steht in [SPEC.md](../../SPEC.md); was daraus zu tun ist, in [ROADMAP.md](../../ROADMAP.md) unter Phase 1. Dieses Dokument ist der Befund und wird nicht fortgeschrieben.

Eine Sitzung als Nutzer, im Browser gegen den laufenden Dev-Server. Bewusst **frische Titel** statt der bekannten Klassiker, damit die Caches kalt sind: Wolf Hall, Norwegian Wood, Things Fall Apart, Klara and the Sun, The Sellout, Half of a Yellow Sun, The Master and Margarita, Die Verwandlung, Die Blechtrommel, A Confederacy of Dunces, If on a Winter's Night a Traveler, The Bell Jar, The Wind-Up Bird Chronicle, Alice in Wonderland, The Hunger Games, Crime and Punishment, Ursula K. Le Guin.

Geprüft: Startseite, Suche, Trefferliste, Detailseite, Seitenleiste, Telefon-Schublade, Marktwechsel, Zurück-Knopf, About, `/go`, Fehlerpfade, Eingabevalidierung, Rate-Limit, Metadaten, OG-Bild, Sitemap, robots.

---

## Bugs, nach Schwere

### 1. Ein Timeout bei Open Library wird dem Leser als „No books found" verkauft

Der schwerste Fund. `searchWorks` fängt **jeden** Fehler ab und gibt `[]` zurück; die Route antwortet daraufhin **HTTP 200** mit `works: []`, und die Oberfläche zeigt „No books found. Try another title".

Gemessen an kalten Suchen, alle bei exakt 8,0 s (dem Wert von `OL_TIMEOUTS.search`):

| Suche | 1. Versuch | 2. Versuch |
|---|---|---|
| norwegian wood | 8,0 s → 0 Treffer | 8,0 s → 0 Treffer, dann 5,0 s → 9 Treffer |
| things fall apart | 0 Treffer | 15 Treffer, Achebe zuerst |
| the wind-up bird chronicle | 8,03 s → 0 Treffer | — |

Vier von rund vierzehn kalten Suchen liefen so ins Leere. Murakamis *Norwegian Wood* hat bei Open Library 124 Werke und 56 Ausgaben im ersten Treffer; die Seite sagte trotzdem, es gebe das Buch nicht.

Zwei Verschärfungen:
- Der vorhandene Fehlerzustand („Something went wrong … Please try again in a moment", `BookGrid.tsx:70`) ist auf diesem Weg **unerreichbar**, weil der Fetch erfolgreich ist. Es gibt ihn nur für Netzfehler.
- Die Antwort trägt `Cache-Control: s-maxage=3600`. In Produktion cacht das CDN die leere Antwort damit **eine Stunde**. Ein Besucher, der als erster nach einem Buch sucht und Pech hat, sperrt es für alle anderen bis zur nächsten Stunde aus.

Das verstößt gegen die eigene Regel aus SPEC N12: wo die Seite etwas nicht weiß, soll das dastehen. Hier behauptet sie das Gegenteil von dem, was sie weiß.

**Vorschlag:** `searchWorks` muss „keine Treffer" von „Quelle hat nicht geantwortet" trennen (werfen statt `[]`), die Route antwortet 503 ohne Cache-Header, die Oberfläche zeigt den Fehlerzustand mit einem Knopf „nochmal versuchen". Derselbe Riss steckt auch in der Work-Route, dort aber richtig herum: ein Timeout dort ergibt 503 (einmal beobachtet, beim nächsten Versuch 200).

### 2. Der Leerzustand nennt einen Filter, der nicht gesetzt ist

„No books found — Try another title, **or remove the language filter**." steht auch dann da, wenn „All languages" aktiv ist (`BookGrid.tsx:80`, fest verdrahtet). Bei einem Tippfehler wie `gatsbee` schickt der Satz den Leser auf eine falsche Fährte.

### 3. Ein Klick auf ein gefaltetes Cover kostet bis zu fünf Google-Anfragen, nicht eine

Gemessen auf der Gatsby-Detailseite im Netzwerk-Panel:

| Klick | ausgelöste Anfragen an `/api/isbn/…` |
|---|---|
| Cover mit 4 Ausgaben und 10 gefalteten Scans | **5** |
| Cover mit 2 Ausgaben | **2** |

Das ist so gebaut (SPEC F2.8: trägt ein gefaltetes Cover mehrere ISBNs, werden alle gefragt), aber das Kostenmodell in SPEC N9 rechnet mit „1 pro Auswahl". Je besser die Faltung, desto teurer der Klick. Die Rechnung „rund 500 kalte Detailseiten pro Tag" ist damit zu optimistisch, und das betrifft direkt die offene Entscheidung 0.7 in der Roadmap.

### 4. Eine unbekannte Work-ID antwortet mit HTTP 200

`/book/OL99999999W` liefert **200** mit generischem Titel „Beautiful Books" und ohne JSON-LD; erst die API dahinter sagt 404. Ein syntaktisch kaputtes `/book/not-a-work` gibt korrekt 404. Für die Indexierung aus Phase 5 ist ein solcher Soft-404 schädlich: Google nimmt die Seite als gültig auf.

### 5. Die About-Seite zitiert genau die Formulierung, die zurückgezogen wurde

Die Seite erklärt die Verdikte als **„Shops show this cover"** und **„Shops show a different cover"** (`app/about/page.tsx:97,101`). Das sind die Sätze, die am 2026-09-07 ersetzt wurden, weil sie mehr behaupten, als geprüft wird. Die Oberfläche sagt heute „The publisher's current image for this ISBN is this cover." Zwei Absätze weiter widerspricht die About-Seite sich selbst: „No shop is contacted for this."

Dazu fehlen die beiden Zustände, die seit dem Sicherungsautomaten existieren: „wird gerade geprüft" und „die Quelle hat nicht geantwortet". Die About-Seite kennt nur drei von fünf.

### 6. `?offset=1500` liefert die Seite 1400

Die Antwort meldet `page.offset: 1400`, obwohl 1500 angefragt wurde. Ein Client, der stur weiterblättert, bekäme dieselbe Seite zweimal. In der Praxis läuft der Client nicht dort hinein, aber die Route soll melden, was sie geliefert hat.

---

## Was nicht sauber wirkt

### 7. Das Zwei-Cover-Mosaik schneidet beide Bilder auf ein Drittel

Bei genau zwei Covern bekommt jede Hälfte eine Kachel von **113 × 341 px** bei einem Bild von 333 × 500 px, mit `object-fit: cover`. Sichtbar bleibt rund ein Drittel der Breite. Bei *The Manningtree Witches* steht deshalb zweimal derselbe Ausschnitt nebeneinander, man liest „ANNINGTRE WITCH | ANNINGTRE WITCH". Das sieht nach einem Rendering-Fehler aus, nicht nach Gestaltung. Die Layouts mit einem, drei und vier Covern sind korrekt (2:3).

Siehe [2026-09-07-mosaik.png](2026-09-07-mosaik.png).

### 8. Das Mosaik zeigt dieselbe Ausgabe mehrfach

Der Kurzpfad hasht bewusst nicht, also faltet er auch keine Duplikate. Folge: Karten mit zwei fast identischen Bildern (siehe 7). Dasselbe im **Open-Graph-Bild**: das Teilbild von Wolf Hall zeigt vier Cover, davon zwei identische spanische Ausgaben. Gerade das Bild, das über einen geteilten Link entscheidet, wirkt dadurch nachlässig. `lib/seo.ts` nimmt die ersten vier Cover ohne Rücksicht auf Wiederholung.

### 9. Die Wand zeigt sichtbare Wiederholungen

Wolf Hall, englischer Reiter, 11 Kacheln: dreimal dasselbe rote Rosen-Cover und zweimal dasselbe weiße „Wolf Hall" (siehe [2026-09-07-seitenleiste.png](2026-09-07-seitenleiste.png)). Das ist die Regel aus Schritt 12 (über Verlagsgrenzen wird oberhalb Distanz 8 nie gefaltet), und sie ist gut begründet — für den Leser sieht es trotzdem nach einem Fehler aus. Ein Hinweis an der Kachel („anderer Verlag, gleiches Motiv") wäre ehrlicher als beides: als stilles Falten und als stilles Wiederholen.

### 10. Die Kauf-Links liegen unter der Kante, frisch gemessen

Auf 1440 × 900, Wolf Hall:

| | |
|---|---|
| sichtbare Höhe der Seitenleiste | 804 px |
| Inhalt der Seitenleiste | 1.256 px |
| „Buy this ISBN" liegt bei | y = 1.051, also **151 px unter dem Fensterrand** |

Am Fenster sieht man das große Cover und darunter „Title" und „Published". Nichts deutet an, dass es weitergeht. Bei *Beloved* waren es 437 px, hier 151 — die Zahl hängt an der Zahl der Metadatenzeilen, das Problem bleibt. Bestätigt Roadmap 1.2.

### 11. Das automatisch gewählte Cover ist wirklich beliebig

Gatsby öffnet mit einer Ausgabe von **„100 MustReads", 2026**, einer indischen Print-on-Demand-Ausgabe unter ISBN 9789388843089 — das ist der zuletzt katalogisierte Datensatz, nicht ein Cover, das jemand sehen will. Die Kauf-Links darunter zeigen auf ein Buch, das im Handel kaum zu bekommen ist.

Auf dem Telefon ist es deutlicher: die Peek-Leiste steht **sofort beim Laden** am unteren Rand und verdeckt eine Kachelreihe, obwohl der Leser nichts ausgewählt hat. Bestätigt Roadmap 1.1.

Nebenbei: die automatische Auswahl steht **nicht** in der URL (`/book/OL464512W?q=wolf+hall` ohne `?cover=`), erst ein Klick schreibt sie hinein. Ein geteilter Link zeigt dem Empfänger also möglicherweise ein anderes Cover als dem Absender.

### 12. Ableitungen mit identischem Titel schlüpfen durchs Ranking

| Suche | Platz 1 | müsste sein |
|---|---|---|
| `alice in wonderland` | **Alice in Wonderland in Five Acts**, 1 Ausgabe, Bühnenfassung | Alice's Adventures in Wonderland, 3.547 Ausgaben (steht auf 2) |
| `klara and the sun` | Klara and the Sun ✓ | — aber Platz 2 ist **Alice's Adventures in Wonderland** |
| `the great gatsby` | Fitzgerald ✓ | — aber **11 von 15** Karten sind Bücher *über* Gatsby, Platz 2 ist die Penguin-Critical-Study von Stephen Matterson |

Die Regel greift nicht, wenn die Ableitung denselben Titel und einen eigenen Erstautor hat: `MARKED_DERIVATIVE` kennt „stage", aber nicht „in five acts", und `SECONDARY_LITERATURE` kennt „companion" und „study guide", aber nicht den Fall „gleicher Titel, anderer Autor, ein Fünfzigstel der Ausgaben". Genau dieser Vergleich läge im `RankContext` schon vor.

Richtig lagen: `the hunger games`, `wolf hall`, `the sellout`, `half of a yellow sun`, `a confederacy of dunces`, `if on a winter's night a traveler`, `die blechtrommel`, `the bell jar`, `things fall apart`, `ursula k le guin` (20 von 20 Karten Le Guin).

### 13. Die Karte zeigt den Katalogtitel, nicht den gesuchten

| Suche | angezeigt |
|---|---|
| `crime and punishment` | «Преступление и наказание» von „Fiódor Dostoievski" |
| `die verwandlung` | „Metamorphosis" von Franz Kafka |
| `the master and margarita` | «Мастер и Маргарита» |

Jeweils das richtige Werk, aber in einer Sprache, die der Leser nicht gesucht hat. Bei Dostojewski kommt dazu, dass Platz 2 der Übersetzer Michael R. Katz als Autor ist und die englischsprachige Sammelausgabe erst auf Platz 6 steht.

### 14. „first published 1920" bei The Great Gatsby

Erschienen ist er 1925. Der Wert kommt aus Open Librarys `first_publish_year` und wird ungeprüft als Tatsache gezeigt — auf der Karte, in der Detailseite und im JSON-LD (`datePublished`). Bei Wolf Hall (2009) und den anderen geprüften Titeln stimmte er.

### 15. Die Ladeszene läuft bei gesetztem Sprachfilter sehr lange

*Nineteen Eighty-Four* mit `lang=de`: die Bühne stand **über 20 Sekunden**, weil `leadLanguagesSettled` auf die deutsche Gruppe wartet und deutsche Ausgaben bei Open Library erst auf Seite 3 bis 4 liegen. Nach dem Umschalten stand „400 of 537 editions checked". Die Obergrenze greift, aber die Wartezeit fühlt sich wie ein Hänger an. Ohne Filter war dieselbe Seite nach etwa 8 s da.

### 16. Cover kommen weiterhin direkt von Open Library

Die Konsole meldet auf jeder Seite mehrfach LCP-Warnungen zu `covers.openlibrary.org`-Bildern („add `loading=eager` / `priority`"). Kein Fehler, aber der Beleg, dass Roadmap 1.3 (Bild-Cache) und ein `priority` auf den ersten Kacheln offen sind.

---

## Funktionen, die fehlen würden

- **Ein „nochmal versuchen"-Zustand** statt „nichts gefunden" (folgt aus Bug 1).
- **Tippfehler-Toleranz.** `gatsbee` liefert null Treffer ohne Vorschlag; Open Library selbst findet dort auch nichts, aber ein „Meinten Sie *gatsby*?" wäre billig (Levenshtein gegen die zwölf kuratierten Titel und die letzten Suchen).
- **Sekundärliteratur sichtbar machen.** Statt sie nur nach hinten zu rechnen, ein kleines Label „about this book" auf der Karte, oder ein Umschalter „nur Ausgaben des Werks".
- **Alternativtitel auf der Karte** („Metamorphosis · Die Verwandlung"), das löst 13 ohne Ranking-Eingriff.
- **Hinweis, dass die Sprach-Pillen seitlich scrollen** (auf dem Telefon endet die Reihe hart am Rand, ohne Verlaufskante).
- **Einen Weg zurück zur Wand aus der Telefon-Schublade heraus**, wenn man ein anderes Cover ansehen will: heute schließen, scrollen, tippen, wieder öffnen.

---

## Was nachweislich funktioniert

- **`/go/<anbieter>/<isbn>`**: baut das Ziel aus der eigenen Tabelle neu. Ein untergeschobenes `&url=https://evil.example.com` wird ignoriert, ein unbekannter Anbieter und eine kaputte ISBN führen auf die Startseite. Kein offener Redirect.
- **Rate-Limit**: 20 Anfragen durch, danach 429 mit `Retry-After: 3` und `Cache-Control: no-store`.
- **Eingaben**: leere Query 400, kaputte ISBN 400 („Malformed ISBN"), unbekannte Sprache fällt auf `all`, Query bei 200 Zeichen gedeckelt, `<img src=x onerror=…>` wird escaped und nicht eingefügt.
- **Telefon-Schublade**: öffnet über die Peek-Leiste, Fokus landet auf „Close", Escape schließt, der Hintergrund ist gesperrt und danach wieder frei, „Buy this ISBN" steht bei y = 729 in einem 812 hohen Fenster.
- **Marktwechsel**: setzt `market=de`, die Liste wechselt auf Thalia, genialokal, Amazon, Hugendubel, AbeBooks, Booklooker, alle Links mit `?market=de`.
- **Zurück-Knopf**: Query, Suchfeld und alle elf Karten wiederhergestellt.
- **Metadaten**: Titel „The covers of Wolf Hall by Hilary Mantel", Beschreibung mit der Ausgabenzahl der Quelle, Canonical, JSON-LD ohne `offers`/`aggregateRating`, OG-Bild 1200 × 630 in 2,9 s, `robots.txt` sperrt `/api/`, Sitemap mit Startseite, About und den kuratierten Werken.
- **Verdikte**: `verified` und `unknown` korrekt, der Wortlaut nennt die Quelle („The publisher's current image for this ISBN…").
- **Seitenleiste scrollt eigenständig**, die Wand dahinter bleibt stehen.

---

## Was ich nicht prüfen konnte

**Enter im Suchfeld.** Das Automatisierungs-Panel schickt Tastendrücke ohne `key`-Wert, deshalb löst weder Enter noch ein Zeilenumbruch im Text ein `submit` aus. Das ist ein Werkzeugproblem, kein Befund: das Formular hat `onSubmit` und einen `type="submit"`-Knopf, das sollte im echten Browser gehen. **Bitte einmal von Hand prüfen**, es ist der häufigste Weg, eine Suche abzuschicken. Aus demselben Grund konnte ich die Tastaturbedienung insgesamt nicht testen (Tab-Reihenfolge, Enter auf einer Kachel, Fokus-Ringe).
