# Roadmap-Archiv — erledigte Punkte in voller Länge

Stand: 2026-09-10. Beim Aufräumen der Roadmap an diesem Tag wurden die **erledigten** Punkte dort auf je ein paar Zeilen gekürzt (Ergebnis, Datum, Verweis) und ihr vollständiger Text **wortgleich** hierher verschoben — samt Vorgeschichte, Kandidaten, Zwischenständen und Nachträgen, so wie sie am Tag des Abhakens standen. Nichts ist gestrichen; wer wissen will, *warum* etwas so gebaut wurde, liest hier oder in der [Historie](history.md), die die Messungen chronologisch führt.

Die Nummern sind die der [Roadmap](../ROADMAP.md). Ein Punkt, der nach dem 2026-09-10 abgehakt wird, wandert beim Abhaken hierher: die Roadmap behält die Kurzfassung, dieses Archiv bekommt den Langtext unter seiner Nummer.

---

## Phase 0 — Entscheidungen

### 0.6

**0.6 Vercel-Plan.** Hobby ist laut Nutzungsbedingungen nur für nicht-kommerzielle Nutzung. Vorschlag: Hobby bis zum ersten Affiliate-Link, dann Pro (20 USD/Monat) — **so umgesetzt mit 2.0: Hobby-Plan für den Hobby-Modus; Pro am Umschalttag** — oder Cloudflare Pages (kostenlos, kommerziell erlaubt, Next.js über OpenNext) oder ein Hetzner-VPS mit Coolify. Serverstandort ändert an Impressum und Datenschutz nichts (Betreiber in Deutschland, EU-Nutzer); Frankfurt hält nur den Drittland-Absatz kürzer. **Recherche 2026-09-08 ([docs/recht-hobbyseite.md](docs/recht-hobbyseite.md) §5): Vercels Auftragsverarbeitungsvertrag gilt nur für Pro und Enterprise, auf Hobby fehlt er (Art. 28 DSGVO). Drei Wege: bewusst tragen, Pro (20 USD/Monat), Cloudflare Pages. Julian hat am 2026-09-08 entschieden: erst einmal Hobby und das Restrisiko tragen; die Frage steht als 0.12 für später.** *0.6 damit erledigt für den MVP.*


### 0.8

**0.8 Zwei Minuten von Hand: geht Enter im Suchfeld?** *Beantwortet von Julian am 2026-09-10: „enter scheint im suchfeld problemlos zu klappen." Damit ist die Frage erledigt, die zwei Sitzungen lang nicht zu beantworten war — das Automatisierungs-Panel schickt Tastendrücke ohne Tastenwert, und `form.requestSubmit()` belegte nur, dass das Formular absendbar ist, nicht dass Enter es auslöst. **Es brauchte einen Menschen an einer Tastatur, und das war die ganze Zeit die richtige Antwort.** Damit ist auch **6.28** (Suchfeld in der Kopfzeile) nicht mehr blockiert.*

**Was aus diesem Punkt offen bleibt und getrennt weiterläuft:** die drei Dinge, die hier als „gleich mitprüfen" standen — Tab-Reihenfolge, Enter auf einer Cover-Kachel, Sichtbarkeit der Fokus-Ringe — sind **nicht** mitbeantwortet worden, und sie sind auch nicht dieselbe Frage. Sie stehen jetzt als **0.8a**.

*Ursprünglicher Punkt:* *Zweiter Anlauf 2026-09-08 im Browser-Panel: der synthetische Enter löst wieder nichts aus, aber das Feld sitzt in einem `<form>` mit `type="submit"`-Knopf, und `form.requestSubmit()` führte zur Trefferliste (`/?q=mumbo+jumbo`, 11 Bücher). Ein echter Browser schickt so ein Formular bei Enter per Spezifikation ab (implizite Übermittlung). Bleibt Julians Prüfung am Gerät, samt Fokus-Ringen, die das Panel per `focus()` nicht sichtbar macht.* Der Durchklick konnte es nicht prüfen — das Automatisierungs-Panel schickt Tastendrücke ohne Tastenwert, deshalb löste weder Enter noch ein Zeilenumbruch ein Absenden aus. Das Formular hat `onSubmit` und einen `type="submit"`-Knopf, im echten Browser sollte es also gehen. Es ist der häufigste Weg, eine Suche abzuschicken, deshalb gehört es geprüft und nicht angenommen. Gleich mitprüfen: Tab-Reihenfolge, Enter auf einer Cover-Kachel, Sichtbarkeit der Fokus-Ringe. Kommt dabei etwas heraus, wird daraus ein Punkt in Phase 1.


### 0.9

**0.9 Speichermodell: eine Präzisierung von E6 abnicken.** *Erledigt 2026-09-07: als **E18** in SPEC §6 aufgenommen, E6 verweist darauf, und §1 sagt jetzt ausdrücklich, dass ein Index abgeleiteter Werte nicht die ausgeschlossene „eigene Buchdatenbank“ ist.* (Vorschlag aus [PLAN-speicher.md](docs/plans/PLAN-speicher.md), 2026-09-07.) Beim Durchdenken von 6.10 zerfiel „brauchen wir einen Speicher?" in zwei Fragen, die fast nichts miteinander zu tun haben: ein **Index**, den ein Skript vor dem Deploy baut und der als Datei im Repo mitkommt, und **Zähler**, in die die laufende Seite schreibt. Nur das Zweite ist Infrastruktur.

E6 sagt heute „Next-`fetch`-Cache, kein KV, bis ein Auslöser eintritt", und das liest sich als „gar kein Speicher". Damit blieben sechs Punkte liegen, die an nichts als einer Datei hängen (6.10, 6.9, 5.1, 5.4, 1.9 und das kalte Hashing aus SPEC §7). Vorschlag, als Satz an E6 oder als E18:

> Gebaute, nur lesbare Daten im Repo sind kein Speicher im Sinne von E6. Ein Index, den ein Skript vor dem Deploy erzeugt und der mit dem Deploy ausgeliefert wird, ist erlaubt; ein Speicher, in den die laufende Seite schreibt, bleibt zurückgestellt.

Zwei Minuten, aber es ist eine Entscheidung und keine Umsetzung.


### 0.11

**0.11 Ordnerstruktur, bevor es weitergeht.** *Erledigt 2026-09-08: Julian hat Option A gewählt — Website im Root, Experimente in `lab/`, der Clip noch nicht. Angelegt: `lab/README.md` mit den sieben Regeln, Lint-Regel in `eslint.config.mjs`, `/scratch-*` in `.gitignore`, Regeln in CLAUDE.md.* (Julian, 2026-09-08: „mache einen Vorschlag für meine Neuordnung, bevor wir das Projekt weitermachen“ — auch für Dinge wie einen automatisierten TikTok-Clip, die nicht mit der Website vermischt, aber im selben Kontext sein sollen.) Vorschlag in [docs/plans/PLAN-struktur.md](docs/plans/PLAN-struktur.md): **die Website bleibt im Root, Experimente kommen nach `lab/<name>/`**, dürfen `lib/` benutzen (das keinen Import aus `next` hat, geprüft) und werden von einer Lint-Regel daran gehindert, in die Website zu wandern; `lab/` ist von der Phasenreihenfolge ausgenommen, aber jedes Experiment hat eine Roadmap-Zeile, und nichts erreicht die Website ohne einen eigenen Punkt. Ein Monorepo mit Workspaces (`apps/web`, `packages/covers`) wäre ein Tag Umbau mit 273 Pfadangaben in Doku und Kommentaren, für eine Trennung, die die Lint-Regel auch leistet — erst, wenn eine zweite ausgelieferte Anwendung entsteht. Zu entscheiden: A oder B, der Name, und ob der Clip (PLAN-struktur §4, Prototyp für 5.5) jetzt gebaut werden darf, obwohl Phase 1 offen ist. Nach der Entscheidung eine Stunde, Claude.


---

## Phase 1 — Vor echtem Verkehr

### 1.1

**1.1 Beim Öffnen eines Buchs kein Cover automatisch auswählen.** *Erledigt 2026-09-09 nach dem Plan, Kandidat 2. `coverForId` (lib/pages.ts) ersetzt `selectCoverFrom` ohne Rückfall; die zweite Spalte zeigt bis zur ersten Auswahl `WorkPanel` — Jahresspanne und Zahl der Verlage, der Klappentext mit Nennung seiner Ausgabe (`blurbFor` wählt Sprache vor Länge, sonst wäre er bei Wolf Hall portugiesisch), die Einladung und ein Link auf den Open-Library-Datensatz mit dem Hinweis, dass er dort zu korrigieren ist. **Gemessen im Headless-Browser gegen den Dev-Server:** eine kalt geöffnete Detailseite stellt **0** Anfragen an `/api/isbn` (vorher mindestens 1), ein geteilter Link mit `?cover=` genau **1**. Damit kostet eine kalte Detailseite ohne Auswahl 1 Google-Anfrage statt 2 — rund 1.000 statt 500 am Tag. Auf dem Telefon erscheint keine Peek-Leiste mehr beim Laden, und der Platz dafür (`pb-20`) wird erst mit einer Auswahl reserviert. [Screenshots](docs/tests/2026-09-09-werkpanel-ohne-auswahl.png) und [mit Auswahl](docs/tests/2026-09-09-seitenleiste-mit-auswahl.png), Zahlen in der [Historie](docs/history.md).* (Julian, 2026-09-07.) *Umsetzungsplan: [docs/plans/PLAN-1.1-keine-vorauswahl.md](docs/plans/PLAN-1.1-keine-vorauswahl.md).* Heute fällt `selectCoverFrom` auf das erste Cover der ersten Gruppe zurück: der neueste Datensatz der führenden Sprache, nicht das schönste und nicht das bekannteste. Zwei Gründe: das Produkt („Judge a book by its covers“ heißt, auf einer Wand zu landen, nicht auf einer getroffenen Entscheidung) und das Kontingent (die Auswahl löst die ISBN-Nachschau aus, **eine Google-Anfrage pro geöffnetem Buch**, ob jemand die Seitenleiste ansieht oder nicht; eine kalte Detailseite fiele von 2 auf 1, ohne ein einziges Cover zu kosten).

**Wie beliebig, im Durchklick gesehen [T11]:** *The Great Gatsby* öffnet mit einer Ausgabe von „100 MustReads“, 2026, unter ISBN 9789388843089 — eine indische Print-on-Demand-Ausgabe, auf die dann auch die Kauf-Links zeigen. Auf dem Telefon steht die Peek-Leiste dadurch **sofort beim Laden** am unteren Rand und verdeckt eine Kachelreihe, ohne dass jemand etwas ausgewählt hat.

Unberührt: geteilte Links mit `?cover=`, die Peek-Leiste auf dem Telefon, die Ladeszene. Zu gestalten ist die breite Ansicht, denn eine leere zweite Spalte wäre schlechter als das Problem. Drei Kandidaten, unentschieden:
1. Die Wand läuft bis zur ersten Auswahl über die volle Breite und rückt dann zusammen. Ehrlich zur Sache, kostet ein Umspringen des Layouts.
2. Die Spalte trägt bis zur Auswahl eine kurze Erklärung, was ein Klick bringt.
3. **Julians Vorschlag:** ein Algorithmus wählt ein **farbenfrohes** Cover automatisch, und das kleine Google-Cover darunter lädt erst, **wenn die Seitenleiste gescrollt wurde**.

**Der Plan entscheidet sich für Kandidat 2**, größer gefasst als hier beschrieben: die Spalte zeigt bis zur ersten Auswahl *das Werk* statt *einer Ausgabe* — einen Ort, den die Seite bisher gar nicht hat. Kandidat 1 fällt weg, weil ein Umbruch des Rasters bei *Gatsby* alle 293 Kacheln unter dem Finger wegsortiert.

**Kandidat 3 ist beim Planen geprüft und als Standard verworfen**, aus zwei Gründen, die vorher nicht sichtbar waren. Erstens **gibt es das Farbmaß nicht**: `decodeToGray` rechnet jedes Bild in der ersten Schleife auf Graustufen um, die Signatur trägt nur Hash, Kontrast und Helligkeit. „Farbenfroh" müsste als Sättigungsmaß nachgerüstet werden. Zweitens fällt der zweite Teil von selbst weg: ohne automatische Auswahl wird gar nichts nachgeschlagen, bis jemand klickt — dieselbe Ersparnis, vollständig und ohne einen neuen Auslöser, der nach 1.2 ohnehin wackelig wäre. **Die Idee behält ihren Wert für 1.9**, wo ein auffälliges Cover gesucht wird, ohne dem Leser eine Wahl abzunehmen; dort ist sie notiert.


### 1.2

**1.2 Die Kauf-Links sind in der Seitenleiste nicht auffindbar.** *Erledigt 2026-09-09 zusammen mit 1.11, aus dem es zur Hälfte fiel. Zwei Eingriffe: der Block schrumpfte von 14 auf **5 sichtbare Bedienelemente** (alles Übrige hinter „Other ways to find it"), und das Cover in der Seitenleiste ist an der Fensterhöhe gedeckelt — in einer 400 px breiten Spalte war es 600 px hoch und schob die Läden allein aus dem Bild (Kandidat b). **Gemessen bei 1440 × 900:** Inhalt der Spalte bei* Beloved *2.351 → **851 px**, bei* Wolf Hall *1.256 → **766 px**; der erste Kauf-Knopf steht bei* Wolf Hall *jetzt bei y = 847 im 900-px-Fenster statt 151 px darunter, bei* Beloved *bei y = 870 statt 437 px darunter. Angeheftete Leiste (der Zustand nach einem Klick in die Wand): 586 bzw. 828. Auf dem Telefon steht der erste Knopf in der Schublade bei y = 565 von 812 — ohne zu scrollen. Zahlen in der [Historie](docs/history.md). **Julians Zusatzidee ist damit anders beantwortet, als sie gestellt war:** hochgezogen werden nicht die provisionsfähigen Links, sondern die, die zur ISBN passen — was in der Mehrheit der Fälle gerade nicht dieselben sind. Der Satz auf der About-Seite ist entsprechend ergänzt.* (Julian, 2026-09-07: „man weiß erst gar nicht, dass man scrollen muss“.) Gemessen auf 1440 × 900 bei *Beloved*: sichtbare Höhe der Seitenleiste 804 px, Inhalt 2.351 px, davon das Cover allein 554 px; „Buy this ISBN“ liegt 437 px unter dem Fensterrand, ohne sichtbaren Hinweis, dass unterhalb des Covers etwas kommt.

**Im Durchklick am 2026-09-07 auf einem frischen Buch bestätigt [T10]:** *Wolf Hall*, dieselbe Auflösung, Seitenleiste 804 px sichtbar bei 1.256 px Inhalt, „Buy this ISBN“ bei y = 1.051, also 151 px unter der Kante. Am Fenster sieht man das große Cover und darunter „Title“ und „Published“, sonst nichts ([Bild](docs/tests/2026-09-07-seitenleiste.png)). Der Abstand hängt an der Zahl der Metadatenzeilen — 437 px bei *Beloved*, 151 px hier — das Fehlen jedes Hinweises nicht.

Kandidaten: (a) Kauf-Links **über** das Cover; (b) das Cover in der Höhe deckeln, wie es die Telefon-Schublade schon tut (180 px), damit Bild und Links zusammen ins Fenster passen; (c) eine festgeklebte Leiste am unteren Rand der Seitenleiste mit den ersten Links, analog zur Peek-Leiste; (d) eine Verlaufskante als Hinweis, das Billigste und Schwächste.

**Julians Zusatzidee, nur die zwei provisionsfähigen Links hochzuziehen, hat heute zwei Haken:** beide (Amazon, Bookshop) sind unkonfiguriert, es gibt also null Links zum Nudgen (Phase 4); und die About-Seite sagt „The order of the shops is not sorted by what they pay“. Vertretbar wäre eine Ordnung nach `BuyLink.kind` (Buchseite vor Trefferliste), die zufällig dieselben Links begünstigt und dem Leser nachweisbar nützt; oder der Satz auf About wird geändert. Unausgesprochen geht es nicht.


### 1.3

**1.3 Bild-Cache vor Open Library und Google** (SPEC N8). *Erledigt 2026-09-09 als eigene Route `/img/<S|M|L>/<ol-123|gb-abc>` mit CDN-Cache (30 Tage), nicht als `next/image`-Optimierung.*

**Die Messung, die den Punkt trägt** (aus Deutschland, 2026-09-09): eine kalte Detailseite von *The Great Gatsby* will **151 verschiedene Bilder** — 146 von `covers.openlibrary.org`, 5 von Google —, je 12–29 KB, und ein einzelnes `-M.jpg` brauchte **5,9 bis 16,0 Sekunden**. Damit war auch die zweite Option erledigt: 151 Quellbilder je Detailseite verbrauchten das Transformationskontingent des Hobby-Plans in wenigen Aufrufen, und die Cover werden ohnehin in der Größe geholt, in der sie stehen.

**Was gebaut wurde:** der Pfad trägt eine **Cover-ID, nie eine URL** — die Zieladresse baut `coverUrlFor` neu, wie `/go/` den Händler-Link aus der Tabelle baut; ein Bild-Proxy, der eine URL aus der Anfrage nimmt, ist ein offener Proxy. `proxiedCoverSrc` schreibt nur um, was dieser Code selbst gebaut hat. Ein Test hat dabei eine Unsauberkeit gefangen: `width >= 800` hätte eine `w999`-Adresse auf `L` (w800) abgebildet, also ein anderes Bild unter derselben Adresse ausgeliefert; jetzt sind es exakt die drei Breiten, die dieser Code anfragt. Fehlschläge tragen `no-store`.

**Geprüft am Dev-Server:** alle 66 Bilder einer Gatsby-Seite kommen von der eigenen Herkunft, **keines mehr von einem fremden Host**; die Antwort trägt `image/jpeg` und `public, max-age=3600, s-maxage=2592000, stale-while-revalidate=86400`; `/img/M/http-evil.example` → 400, `/img/XL/ol-…` → 400, eine unbekannte ID → 502.

**Was der Dev-Server nicht zeigen kann, und was nach dem nächsten Deploy zu messen ist:** den eigentlichen Gewinn. Lokal steht kein CDN davor, ein zweiter Abruf dauert deshalb weiter 7 s. In Produktion muss der zweite Abruf desselben Covers `x-vercel-cache: HIT` tragen und im zweistelligen Millisekundenbereich liegen. Bis das gemessen ist, ist der Punkt gebaut, aber nicht belegt — die Zahl gehört zu 2.6. Mitzudenken ist dabei die Kehrseite: bei kaltem CDN sind 151 Bilder 151 Funktionsaufrufe, allerdings **einmal für alle Leser**, nicht je Leser.

*Ursprünglicher Punkt:* Cover laden heute direkt von `covers.openlibrary.org`, das auf archive.org weiterleitet und unter Last langsam oder gar nicht liefert (bei 18 gleichzeitigen Anfragen kamen nach 15 s nur die Google-Bilder); Open Library dokumentiert außerdem Rate-Limits für Cover. Optionen: `next/image` ohne `unoptimized` mit `remotePatterns` (Vercels Bildoptimierung, Kontingent des Plans prüfen) oder eine eigene Proxy-Route mit CDN-Cache. Vorher messen, wie viele verschiedene Bilder eine Detailseite lädt, damit das Kontingent der Optimierung nicht die nächste Grenze wird. *Im Durchklick bestätigt [T16]: die Konsole meldet auf jeder Seite mehrfach LCP-Warnungen zu `covers.openlibrary.org`; das `priority` auf den ersten Kacheln gehört mit dazu (6.5).* Verwandt, aber getrennt: 6.12 (Signaturen überleben eine Instanz nicht).


### 1.4

**1.4 Ein Ausfall der Suche heißt nicht mehr „No books found“. [T1, T2]** *Erledigt 2026-09-07, Commit `0991444`.*

Der schwerste Fund des Testberichts. `searchWorks` verschluckte jeden Fehler in eine leere Liste, die Route antwortete 200, und der Leser las, es gebe das Buch nicht — bei vier von rund vierzehn kalten Suchen, zweimal davon für *Norwegian Wood*, das Open Library mit 124 Werken führt.

**Ergebnis:** `SourceUnavailableError` trennt Schweigen von Leere; die Route antwortet 503 ohne Cache-Header, und nur die 200 trägt noch `s-maxage`. Der Deckel für die Suche steht auf 12 s statt 8, weil von zwölf ungedeckelt gemessenen Suchen drei zwischen 9 und 10 s antworteten. Die Oberfläche zeigt „The catalogue did not answer“ mit einem Knopf „Try again“; der Leerzustand nennt den Sprachfilter nur noch, wenn einer gesetzt ist. Mitgefunden und behoben: Suchen unter drei Zeichen (Open Library lehnt sie mit 422 ab) hießen ebenfalls „nichts gefunden“. Live belegt, `austerlitz sebald` antwortete während der Prüfung mit 503 nach 10,5 s.


### 1.5

**1.5 Die Sätze, die etwas Falsches sagten. [T5, T14, T2, T11]** *Erledigt 2026-09-07, Commit `48a493a`.*

**Ergebnis:** Die Verdikte stehen nur noch an einer Stelle (`lib/verdicts.ts`); Seitenleiste und About-Seite lesen daraus, ein Auseinanderlaufen ist ausgeschlossen. Die About-Seite zeigt jetzt alle fünf Zustände im Wortlaut der Oberfläche statt drei in der zurückgezogenen Fassung „Shops show this cover“. Fünf Tests halten fest, was diese Sätze nicht sagen dürfen. Das Erscheinungsjahr ist ein Zitat geworden: „Open Library dates it to 1920“ statt „first published 1920“ — eine zweite Quelle zum Gegenprüfen gibt es nicht, weil die Wand den jüngsten Datensatz zuerst lädt. Der Punkt zum geteilten Link erledigt sich mit 1.1 und steht dort.


### 1.6

**1.6 Die zwei Bilder, die nach einem Fehler aussahen. [T7, T8]** *Erledigt 2026-09-07, Commit `48a493a`.*

**Ergebnis:** Die hohen Kacheln passen das ganze Cover ein, statt die Hälfte wegzuschneiden ([vorher](docs/tests/2026-09-07-mosaik.png), [nachher](docs/tests/2026-09-07-mosaik-behoben.png)). Betroffen war auch die linke Spalte des Drei-Cover-Mosaiks, was der Bericht nicht gesehen hatte; das Vier-Cover-Raster blieb unangetastet. Karte und Teilbild wählen jetzt ein Cover je Druck, erkannt an Verlag und Jahr: das [Teilbild von *Wolf Hall*](docs/tests/2026-09-07-teilbild-behoben.png) zeigt vier verschiedene Cover statt zweimal derselben spanischen Ausgabe.

**Was dabei nicht zu lösen war:** Zwei Verlage, die dieselbe Gestaltung lizenzieren (Granta 2021 und Catapult 2021 bei *The Manningtree Witches*), stehen weiter nebeneinander. Das erkennt nur ein Bildvergleich, und der bräuchte Signaturen, die der Server erst holen und hashen müsste — mehrere Sekunden auf einer Route, auf die der Vorschau-Dienst eines Messengers nicht wartet. Die Wand faltet sie, die Karte nicht.


### 1.7

**1.7 Zwei Antworten, die nicht stimmen. [T4, T6]** *Erledigt 2026-09-08 auf `mvp-hobby`: unbekannte Work-ID → `notFound()` mit eigener 404-Seite, aber nur bei sicherem „gibt es nicht“ (ein schweigender Katalog rendert die Seite); `?offset=1500` → leere Seite, die 1500 meldet, Gesamtstand aus einem Ein-Datensatz-Abruf. Der 404 konnte live nicht geprüft werden, weil Open Library in einer Ausfall-Episode war; gehört in 2.6.* Beides klein, beides sauber prüfbar.
- Eine unbekannte, aber wohlgeformte Work-ID (`/book/OL99999999W`) antwortet mit **200** statt 404; `notFound()` läuft nur für ein kaputtes ID-Muster. Vor Phase 5 beheben, sonst indexiert Google den Soft-404.
- `?offset=1500` liefert die Seite 1400 und meldet 1400. Die Route soll den Offset melden, den sie geliefert hat, und jenseits der Kappung eine leere Seite geben.


### 1.10

**1.10 Eine gescheiterte Suche einmal wiederholen.** *Erledigt 2026-09-08: `searchWorks` fragt bei Schweigen (Timeout, Netzfehler, 5xx, Rumpf ohne `docs`) ein zweites Mal, nie bei 4xx; beide Versuche zusammen auf 20 s gedeckelt. Der Such-Cache steht bei 24 h statt 1 h (Julians Entscheidung am selben Tag). **Die Messung danach fiel anders aus als erwartet: 80 Suchen am Abend, kein einziger Ausfall, Median 0,9 s** — die Wiederholung hat kein einziges Mal ausgelöst und ist nur durch Unit-Tests belegt. Die Lehre steht in der [Historie](docs/history.md): die Ausfallquote von Open Library ist keine Quote, sondern eine Folge von Episoden, und sie lässt sich in einer Sitzung nicht ermitteln. Das ist ein Argument für Phase 3 und gegen jede Entscheidung zu 0.10 auf dieser Grundlage.* (Gemessen 2026-09-08 aus Deutschland, vier kalte Suchen über `lib/search.ts`.) **Im ersten Anlauf scheiterten drei von vier**: `the great gatsby` und `alice in wonderland` mit `fetch failed`, `crime and punishment` im Timeout nach 12 s. Derselbe Aufruf unmittelbar danach lieferte **alle vier** vollständig. Eine nackte `curl`-Suche mit `limit=3` brauchte dazwischen **10,5 s** — der Deckel steht bei 12 s, es ist also kein weiter Abstand.

**Warum das vor dem Ranking kommt.** 1.4 hat den Ausfall ehrlich gemacht: die Route antwortet 503 und die Oberfläche sagt „The catalogue did not answer" mit einem Knopf „Try again". Der Leser drückt diesen Knopf, und dann geht es. Genau diesen Druck kann der Server selbst ausführen, bevor er aufgibt. Ein Ranking-Fehler zeigt das falsche Buch; ein Ausfall zeigt gar keins, und er trifft nach dieser Messung die Mehrzahl der kalten Suchen.

**Der Beleg liegt im eigenen Repo:** `scripts/build-cover-index.ts` hat für 6.10 genau das gemacht — drei Versuche je Seite und behalten, was vor dem Abbruch da war. Damit fielen im ersten Durchgang neun von fünfzig Werken aus, im zweiten **keines**. In `lib/sources/http.ts` und `lib/sources/openlibrary.ts` steht heute **kein einziger** Wiederholungsversuch.

**Zu bauen:** ein zweiter Versuch im Suchpfad, nur bei Netzfehler und Timeout, nie bei 4xx (422 unter drei Zeichen darf nicht wiederholt werden), mit kurzer Pause; der Deckel gilt je Versuch, die Gesamtzeit braucht eine eigene Obergrenze, sonst wartet der Leser 24 s statt 12. Danach dieselben vier Suchen zehnmal kalt messen und die Ausfallquote vorher/nachher hier eintragen. **Diese Zahl gehört auch zu 0.10**, wo „Ausfallquote der Quellen" eine der drei Zahlen ist, nach denen über einen eigenen Datenbestand entschieden wird. Eine Stunde, Claude.


### 1.11

**1.11 Kauf-Links, die ins Leere laufen: die ISBN weiß vorher, welcher Laden eine Chance hat.** *Erledigt 2026-09-09 nach dem Plan, zusammen mit 1.2. Alle fünf Hebel gebaut: `registrationArea` liest die Registrierungsgruppe (`lib/normalize.ts`, offline), `linkPlan` (`lib/linkplan.ts`, 33 Tests) sortiert in vier Fällen — **home / foreign / kdp / no-isbn** —, `orderEditionsForMarket` sortiert die Ausgaben unter einem gefalteten Cover, `kind: 'product'` wird außerhalb von `home` zurückgenommen, und `titleSearchLinksFor` liefert die fehlenden Titelsuchen der Katalog-Händler. **Julians Entscheidung zur Zone B (2026-09-09): „wenn es die Möglichkeit gibt, einen Affiliate-Link zu setzen zu genau dieser Edition, sollte das Vorrang haben"** — „Or read it in another edition" erscheint deshalb nur bei `foreign` und `no-isbn`, und die Läden des Marktes stehen dann dort **einmal**, nicht zusätzlich mit der fremden ISBN. Live geprüft an einer indischen ISBN von* Gatsby *(978-93, Pharos Books 2019): vorn AbeBooks, eBay und Google Lens, darunter „This printing's ISBN was registered in India", dahinter vier weitere, unter der Trennlinie Bookshop.org und Amazon mit dem Werktitel. **Ein Fund beim Prüfen:** der Werktitel von OL468431W lautet wörtlich `The Great Gatsby(Published In 1925)` und wäre so in die Suchabfrage gegangen — `displayTitle` schneidet den Klammerzusatz jetzt ab (der Seitenkopf bleibt 6.15 vorbehalten). **Offen bleibt Julians Stichprobe** (Plan §7, zehn Minuten mit 1.8): führen Bookshop.org und ThriftBooks eine türkische ISBN, was tut Amazons `/dp/` bei einer nie geführten? Fällt das anders aus, ändert sich `CATALOGUE_SHOPS` in `lib/linkplan.ts` und sonst nichts.*

**Nachtrag vom selben Tag, zwei Korrekturen nach Julians Blick auf die fertige Spalte:**
- **Bei `differs` führen wieder die Suchen, und zwar ganz.** („dann müssen suchen mit autor und jahr leichter vorgeschlagen werden als nur zig buttons wo immer ein anderes cover dahinter liegt.") Der erste Umbau hatte davon nur Google Lens übrig gelassen und damit SPEC F2.9 verletzt, wo die Such-Links bei `differs` vor die Kauf-Links gehören. Jetzt ersetzt `differs` die erste Reihe vollständig — AbeBooks, eBay, Google Lens, alle drei mit Titel, Autor, Verlag und Jahr —, die Läden rücken hinter die Klappe, die Überschrift heißt „Find the cover you picked", und der Verdikt-Hinweis steht **über** der Reihe, weil er ihr Grund ist. Mitgeliefert: Hebel 4 aus diesem Punkt, den der erste Umbau vergessen hatte — bei `unknown` hängt sich die antiquarische Suche hinten an die Reihe, nur die Reihenfolge, kein Satz.
- **Die Ausgabe, deren registriertes Bild dieses Cover ist, steht vorn.** („die version die das gleiche aktuelle cover hat wie die isbn sollte zuerst vorgeschlagen werden, nicht nach jahr sortiert.") `orderEditionsForMarket` sortiert jetzt zuerst nach dem Verdikt, dann nach Markt und Jahr. Testfall aus dem Screenshot: bei *Beloved* trägt ein gefaltetes Cover Vintage International 2025 und 2004, das Jahr stellte 2025 voran, und es ist die 2004er ISBN, zu der der Verlag dieses Bild führt. Preis: die Reihe sortiert sich einmal um, wenn die Verdikte eintreffen — `pending` und `unavailable` bewegen deshalb nichts. *Umsetzungsplan: [docs/plans/PLAN-1.11-kauflinks-ux.md](docs/plans/PLAN-1.11-kauflinks-ux.md).* (Julian, 2026-09-08: „damit weniger Links ins Leere laufen“.) Gemessen am 2026-09-08 über die fünf Fixture-Werke (*1984*, *Gravity's Rainbow*, *Mumbo Jumbo*, *Pride and Prejudice*, *The Great Gatsby*), 567 Ausgaben, offline, ohne eine einzige Anfrage.

**Drei Vermutungen sind zuerst gefallen, und das ist Teil des Ergebnisses:**

| Vermutung | Messung | Folge |
|---|---|---|
| Kaputte ISBNs erzeugen tote Links | **0 von 526** ISBNs mit falscher Prüfziffer, 0 mit falscher Länge | Eine Prüfziffernprüfung in `cleanIsbn` wäre richtig, bringt aber nichts. Nicht bauen |
| Die KDP-Flut (979-8, „Independently Published“) füllt die Wand mit Unverkäuflichem | **182 der 526 ISBNs sind 979-8** — aber **181 davon tragen gar kein Cover** | Erreicht die Wand nicht. Erklärt nebenbei die Lücke aus Schritt 11 (Gatsby: 379 Cover auf 1.180 Datensätzen) |
| Alte, vergriffene Ausgaben sind das Hauptproblem | **82 % der Cover-Ausgaben sind von 2005 oder jünger**, nur 7 % vor 1990 | Das Alter ist der zweite Hebel, nicht der erste |

**Was übrig bleibt, ist größer als alle drei: der Sprachraum der ISBN passt nicht zum Laden.** Von den **243 Ausgaben, die tatsächlich ein Cover tragen** und damit auf der Wand landen:

| Sprachraum der ISBN | Ausgaben | Anteil |
|---|---|---|
| **andere** (Türkei 47, Spanien 18, Italien 14, Indien 9, Tschechien 5, Kolumbien 4, Portugal 4, Brasilien 4, Schweden 3, Taiwan 3, …) | 107 | **44 %** |
| englisch (978-0/1) | 60 | 24 % |
| deutsch (978-3) | 26 | 10 % |
| spanisch/portugiesisch | 22 | 9 % |
| **ohne ISBN** — gar keine Kauf-Links, nur Suchlinks | 18 | 7 % |
| französisch (978-2) | 9 | 3 % |

Der voreingestellte Markt ist **US**. Für einen Leser dort zeigt die Seitenleiste bei rund **drei Vierteln** der Cover fünf Links auf Bookshop.org, Amazon.com, AbeBooks, ThriftBooks und eBay — zu einer ISBN, die in der Türkei, in Serbien oder in Dänemark vergeben wurde. Bookshop.org und ThriftBooks führen solche Titel praktisch nie; Amazons `/dp/<ISBN-10>` landet auf einer 404, wenn der Marktplatz die ISBN nie geführt hat. **Und das sind nicht die schlechten Cover, sondern die interessanten** — die türkischen und serbischen Umschläge sind der Grund, warum die Wand sehenswert ist. Es darf also nichts ausgeblendet werden; die Links müssen anders geführt werden.

**Vier Hebel, keiner kostet eine Anfrage:**

1. **Die Registrierungsgruppe aus der ISBN lesen** (`978-3…` = deutschsprachig, `978-0/1…` = englisch, `979-8…` = Amazon-KDP) und die Händlerreihenfolge danach bestimmen, nicht allein nach dem Markt des Lesers. Für eine fremde ISBN führen die Läden, die überhaupt eine Chance haben — **AbeBooks und eBay** sind Marktplätze und international; Bookshop, ThriftBooks, Thalia und Hugendubel sind Katalog-Händler und haben keine. Eine reine Tabelle, offline, testbar. **Das ist der Hauptteil des Punkts.**
2. **Die Reihenfolge der Ausgaben unter einem Cover.** Nach dem Falten ist `editionIds` die Ankunftsreihenfolge von Open Library, also **nach Alter des Datensatzes**, und der erste Block liefert die Links, die der Leser zuerst sieht. Bei 44 % fremden ISBNs führt oft die falsche. Sortieren nach: ISBN im Sprachraum des Marktes zuerst, dann ISBN überhaupt vorhanden, dann Jahr. *(In den Fixtures trägt kein einziges rohes Cover mehr als eine Ausgabe — die Mehrfachzuordnung entsteht erst beim Falten, `foldDuplicateCovers` in `lib/works.ts` hängt die `editionIds` der Mitglieder aneinander.)*
3. **`kind` ehrlich machen.** `kind: 'product'` heißt heute nur „diese URL hat die Form einer Produktseite“ — Blackwell's `/bookshop/product/<isbn>` und Amazons `/dp/` bekommen es für **jede** ISBN, auch für eine, die der Laden nie geführt hat. Das ist dieselbe Sorte Behauptung, die §9.2 sonst verbietet, eine Ebene tiefer. Entweder `kind` an die Gruppe koppeln oder das Wort in der Oberfläche zurücknehmen.
4. **Das Verdikt weiterverwenden, das ohnehin schon geholt wird.** Bei `differs` rücken die Suchlinks heute schon über die Kauf-Links. Bei **`unknown`** — Google kennt zu dieser ISBN gar keinen Datensatz — ist die Wahrscheinlichkeit, dass ein Katalog-Händler sie führt, klein; auch dort gehören die Suchlinks (Titel + Verlag + Jahr, antiquarisch) nach oben. **Nur die Reihenfolge, nie ein Satz**: „unknown“ heißt weiterhin nicht „nicht zu kaufen“, und die Wortlaute in `lib/verdicts.ts` bleiben unangetastet.

5. **Die angereicherte Suche ist der fünfte Hebel — aber als eigene Zeile, nicht im Kauf-Link.** (Julians Frage am 2026-09-08: „Aber die ISBN-Suchen durch andere Suchbegriffe anzureichern würde nicht helfen?“) Sie hilft, und die Daten dafür sind da: von den 243 Cover-Ausgaben tragen **97 % Verlag *und* Jahr**, 99 % einen Verlag, 98 % ein Jahr. Aber sie beantwortet eine **andere Frage** als der Kauf-Link, und die zwei dürfen nicht in denselben Knopf:

   | | Was der Link verspricht | Woraus er gebaut wird |
   |---|---|---|
   | **Kauf-Link** | „genau dieses Exemplar“ | ISBN allein |
   | **Suchlink** | „irgendein Exemplar dieses Drucks“ | Titel + Verlag + Jahr |

   **Terme in den ISBN-Link zu mischen macht es schlechter, nicht besser.** Der Leser hat ein türkisches Cover angeklickt; eine Titelsuche bei Bookshop US liefert dann zwar Treffer, aber ein Penguin-Taschenbuch — der Link läuft nicht mehr ins Leere, er führt in die Irre, und das ist der Fehler, den §9.2 und die Verdikte gerade verhindern sollen. Dazu der mechanische Haken: die meisten Suchfelder verknüpfen mit UND, `9789944… gatsby` findet also **null**, weil kein Datensatz beides enthält. (Mit in die Stichprobe unten nehmen.)

   **Was stattdessen zu tun ist, und es ist eine echte Lücke:** `searchLinksFor` bietet heute nur AbeBooks, eBay, Google Lens, TinEye, WorldCat und Open Library. **Für Bookshop, ThriftBooks, Thalia, Hugendubel und Booklooker gibt es gar keine Titelsuche** — also ausgerechnet für die Katalog-Händler, bei denen der ISBN-Link bei fremder ISBN sicher leer ausgeht. Diese Zeile fehlt und ist billig nachzurüsten.

   **Welcher Titel, ist dabei die eigentliche Entscheidung: 56 % der Cover-Ausgaben tragen einen anderen Titel als das Werk** — „Die Enden der Parabel“, „El arco iris de gravedad“, „L'arc-en-ciel de la gravité“. Für AbeBooks und eBay (international, antiquarisch) ist der **Ausgabentitel** richtig, denn gesucht wird dieser Druck; antiquarische Angebote tragen ohnehin oft keine ISBN, dort ist Titel + Verlag + Jahr die **bessere** Abfrage als die ISBN. Für einen Katalog-Händler im Markt des Lesers ist der **Werktitel** richtig — und der Link muss dann auch so heißen („find another edition“), nie wie ein Kauf-Link für das gezeigte Cover.

**Was gemessen werden muss, bevor das gebaut wird**, denn zwei Annahmen oben sind begründet und nicht belegt: dass Bookshop.org und ThriftBooks fremdsprachige ISBNs nicht führen, und dass Amazons `/dp/` bei einer nie geführten ISBN auf 404 geht. Beides sind **Stichproben von Hand im Browser**, zehn Minuten, zusammen mit 1.8 — kein Skript, denn genau dieser Pfad ist bei vier von sechs Händlern per robots.txt untersagt (0.1). Je Händler drei ISBNs: eine englische, eine türkische, eine deutsche.

**Beim Planen der Spalte am 2026-09-08 dazugekommen** (Julian: „das muss sinnvoll in die Cover-Wall-Seite integriert werden und darf aus einer UX-Perspektive nicht zu sehr verwirren“), zwei reine Oberflächenfehler, beide im Plan gelöst:

- **„AbeBooks“ steht im US-Markt zweimal in derselben Spalte, „eBay“ ebenfalls** — einmal als ISBN-Link, einmal als Suchlink, gleiches Label, wenige Zeilen auseinander, kein sichtbarer Unterschied. Im DE-Markt betrifft es AbeBooks.
- **Die zwei Überschriften beantworten dieselbe Frage.** „Buy this ISBN“ und „Find this exact cover“ zielen beide auf *dieses Exemplar*; die Frage „ich will das Buch einfach lesen“ hat keinen Ort und wird stillschweigend von den Händler-Knöpfen mitbeantwortet, die dafür nicht gebaut sind.

Dazu die Zählung, die erklärt, warum hier nichts hinzugefügt werden darf: **14 Bedienelemente** für eine einzige Ausgabe im US-Markt (15 im DE), plus zwei Erklärabsätze und acht Metadatenzeilen — und der ganze Apparat wiederholt sich je Ausgabe, die ein gefaltetes Cover trägt. Das ist die Ursache der in 1.2 gemessenen 2.351 px. **Der Entwurf kommt auf 5 sichtbare Elemente** und erledigt damit die Hälfte von 1.2.

**Zusammenhang mit anderen Punkten:** 1.2 macht die Kauf-Links auffindbar — das lohnt erst, wenn sie auch irgendwohin führen, also 1.11 zuerst oder zusammen. 4.1 (Bookshop-ID) repariert einen anderen toten Link derselben Familie. Der Nebenbefund zu 979-8 gehört zu 1.1: die Vorauswahl bei *Gatsby* traf eine indische Print-on-Demand-Ausgabe (978-93), und Hebel 2 ist genau die Sortierung, die das verhindert. Ein halber Tag, Claude — plus Julians zehn Minuten Stichprobe.


---

## Phase 2 — Betrieb

### 2.0

**2.0 Der Hobby-MVP: ein Betriebsmodus ohne Provision, und die Shop-Variante daneben.** *Erledigt 2026-09-08: gebaut, gemerged, deployt. Die Seite läuft im Hobby-Modus unter https://beautifulcovers.vercel.app — Händler-Links ohne Provisionsparameter (78 geprüft, keiner trägt einen), kein Verfügbarkeits-Button, Impressum und Datenschutz aus `IMPRINT_*`. Der Umschalttag auf `shop` braucht das volle Impressum (0.4) und den Pro-Plan (0.6/0.12).* (Julian, 2026-09-08.) *Umsetzungsplan: [docs/plans/PLAN-2-mvp-hobby.md](docs/plans/PLAN-2-mvp-hobby.md); Branch `mvp-hobby`.* Ein Schalter `NEXT_PUBLIC_SITE_MODE` mit Default `hobby`: die `AFFILIATE_*`-Variablen werden ignoriert, auch wenn sie gesetzt sind (Test), kein Verfügbarkeits-Button und keine Route dafür, kein Provisionssatz in Fußzeile und About, kein `rel="sponsored"`. **Händler-Links, Markt, Suchlinks und die Klickzählung bleiben** (Julians Entscheidung am selben Abend: „solange es keine Affiliate-Links sind“). Das Verdikt bleibt an (Julian, 2026-09-08). Dazu `/privacy` und `/contact` mit Name, Anschrift und E-Mail aus `IMPRINT_*` in `.env.local` (Vorlage `.env.example`, nie im Repo), `maxDuration` auf den zwei langsamen Routen, Vercel Web Analytics. `shop` schaltet Provision und Button ein und läuft lokal oder als Preview, bis Phase 4 entschieden ist. Vor dem Deploy außerdem 1.7 und 6.15 Schritt 1–2. Ein Tag Claude, eine halbe Stunde Julian (0.2, 0.4 in klein, 2.1), dann eine Stunde zu zweit für Merge und Abnahme (2.6). **Der Umschalttag auf `shop` in Production braucht vorher das volle Impressum (0.4) und den Pro-Plan (0.6).**


### 2.1

**2.1 Vercel-Projekt.** *Erledigt 2026-09-08 abends, zusammen im Browser eingerichtet.* Projekt `beautifulbooks` im Team „Julian Heiss' projects" (Hobby), Repository `heissjl/beautifulbooks`, Branch `main` = Production, Framework Next.js. **Produktionsadresse: https://beautifulcovers.vercel.app** — am 2026-09-08 spät von Julian von `beautifulbooks-kappa` umbenannt, nachdem `beautifulbooks.vercel.app` vergeben war (siehe 2.2). **Eine Umbenennung ist nicht folgenlos:** die alte Adresse antwortet danach mit 404, und `NEXT_PUBLIC_SITE_URL` muss mitgeändert und neu gebaut werden, sonst zeigen Canonical, Sitemap und OG-Bild auf eine tote Adresse. Variablen für Production und Preview: `GOOGLE_BOOKS_API_KEY` (von Julian eingetragen), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_MODE=hobby`, die vier `IMPRINT_*`; die fünf `AFFILIATE_*`-Zeilen aus `.env.example` wurden beim Import **entfernt**, nicht leer gelassen. Funktions-Region auf **Frankfurt (fra1)** umgestellt, Vercel legt neue Projekte in Washington (`iad1`) an; dabei muss die alte Region ausdrücklich **abgewählt** werden, sonst bleibt der Speichern-Knopf ohne Meldung ausgegraut (Hobby erlaubt eine Region). Geprüft wird das am Header `x-vercel-id` der laufenden Seite, nicht am Häkchen. **Web Analytics eingeschaltet**, Hobby-Umfang: 50.000 Ereignisse im Monat, 30 Tage Verlauf, **keine Custom Events** (die gibt es erst ab Pro — für 3.1 kein Verlust, weil dort ohnehin ein eigener Endpunkt geplant ist), gedeckelte Datenaufnahme. Erster Build 1 min 49 s.

**Zwei Fallen, beide erlebt:** (1) Die Laufzeitgrenze ist kein Thema — Hobby erlaubt 300 s je Funktion, die Suche braucht im schlechtesten Fall 20 s. (2) **Das Skript `/_vercel/insights/script.js` antwortet mit 404, solange Web Analytics im Dashboard nicht eingeschaltet ist.** Der `<script>`-Tag steht im HTML, gezählt wird trotzdem nichts. Wer nur ins HTML schaut, hält es für erledigt.


### 2.3

**2.3 Impressum, Datenschutzerklärung, Affiliate-Hinweis.** *Erledigt 2026-09-08: `/contact` und `/privacy` stehen, aus `IMPRINT_*` gespeist, in der Fußzeile verlinkt; der Datenschutztext beschreibt genau das, was der Code tut, je Betriebsmodus. Kein Cookie-Banner nötig. **Der Affiliate-Hinweis fehlt bewusst** — im Hobby-Modus wäre er falsch; er gehört zum Umschalttag. Grundlage: [docs/recht-hobbyseite.md](docs/recht-hobbyseite.md).* Ursprünglicher Punkt: als Seiten mit Links in der Fußzeile (Angaben aus 0.4). Inhalt der Datenschutzerklärung: Hosting und IP-Adressen, Vercel Analytics, Cover-Bilder von Drittservern (Open Library, Google), localStorage und Cookie `market`, die Klickzählung ohne jede Kennung (SPEC F5), ggf. Drittlandtransfer (Vercel ist im EU-US Data Privacy Framework). Generator: e-recht24 oder IHK. Kein Cookie-Banner nötig, solange nur Vercel Analytics läuft. **Mindestinhalt und die Tabelle, was die Seite tatsächlich verarbeitet, stehen seit 2026-09-08 in [docs/recht-hobbyseite.md](docs/recht-hobbyseite.md) §3; dort auch, dass `beforeSend` den Suchbegriff aus den Analytics-URLs nehmen soll.** Amazon verlangt für den Affiliate-Hinweis einen konkreten Wortlaut (Phase 4).


---

## Phase 4 — Geld

### 4.6

**4.6 Werberegeln in die Spec.** *Erledigt 2026-09-08 als **E19**, nach Julians Entscheidung: kein von Hand verkaufter oder belegter Platz; ein Platz nur, wenn ein Marktplatz ihn automatisch füllt.* Die Regeln: höchstens ein Platz je Seite, außerhalb von Wand, Ergebnis und Händlerliste; automatisch gefüllt; keine Kennung des Lesers, sonst kein Platz; gekennzeichnet; Kategorien ausschließbar; niemand zahlt mit Funktion. Ausführlich in [PLAN-4-einnahmen.md](docs/plans/PLAN-4-einnahmen.md) §4.


---

## Phase 6 — Qualität

### 6.1

**6.1 Gleichnamige Ableitungen und Sekundärliteratur nach hinten. [T12]** *Erledigt 2026-09-08. Vier Regeln statt einer: „in N acts / a play / an opera" in `MARKED_DERIVATIVE`; ein Titel, der auf „notes" endet, als Sekundärliteratur; der Zweitautor-Vergleich zusätzlich über den **Open-Library-Autorenschlüssel**, was den Übersetzer-Datensatz fängt, dessen Name anders transkribiert ist; und `SAME_TITLE_EDITION_RATIO` = 30 für ein Werk, das den Titel eines viel größeren mit anderem Erstautor trägt. **Über 15 Suchen gemessen: 7 verbessert, 8 unverändert, keine verschlechtert** — nur ein erster Treffer änderte sich überhaupt, und es war der falsche (`alice in wonderland`). Die Schwelle ist abgelesen, nicht gewählt: Fenster 17–65, weil der Katz-Datensatz bei 65x fallen und Lars Myttings* Norwegian Wood *bei 12x bleiben muss. Zwei Annahmen dieses Punktes hat die Messung widerlegt — die Leserzahl trennt nicht (die Bühnenfassung hat 1.010 Leser gegen 2.307), und der Autorenschlüssel taugt nicht als Schutz, weil derselbe Mensch mehrere trägt. **Nebenbei gemessen und behoben:** `notes on` hielt Zoë Hellers Roman* Notes on a Scandal *für einen Studienführer und drückte ihn bei der Suche nach seinem eigenen Titel auf Platz 4; jetzt Platz 1. Alles in der [Historie](docs/history.md).*

**Offen geblieben, und bewusst nicht im Ranking gelöst:** steht der Hauptdatensatz unter einem fremdsprachigen Titel, fehlt der Sekundärliteratur das gleichnamige große Werk, gegen das sie gemessen werden könnte — bei `crime and punishment` steht Harold Blooms Band deshalb auf Platz 2, denn der Roman ist als «Преступление и наказание» geführt und sein englischer Datensatz hat nur 19 Ausgaben. **Dieselbe Wurzel wie 6.13 und 6.15**, dort zu lösen. Ebenfalls offen: `klara and the sun` hat auf Platz 2 ein Werk ohne jede Titel- oder Autorenbeziehung zur Anfrage, das allein von seiner Leserzahl lebt; die Regel dagegen wurde geprüft und **verworfen**, weil sie bei `crime and punishment` und `die verwandlung` den richtigen Treffer von Platz 1 gelöscht hätte.

<details><summary>Der ursprüngliche Befund</summary> Die Regel aus Schritt 10 greift nicht, wenn eine Ableitung denselben Titel trägt und einen eigenen Erstautor hat. Gemessen: `alice in wonderland` liefert „Alice in Wonderland in Five Acts“ (eine Ausgabe, Bühnenfassung) vor Carrolls Original mit 3.547 Ausgaben; bei `the great gatsby` sind elf von fünfzehn Karten Bücher über Gatsby, auf Platz 2 eine Penguin-Critical-Study von Stephen Matterson; `klara and the sun` hat auf Platz 2 „Alice's Adventures in Wonderland“. Zehn andere Suchen lagen richtig, das Ranking ist also nicht kaputt, nur blind für diesen Fall.

**Am 2026-09-08 nachgemessen, und der Fall ist enger zu fassen als gedacht.** `alice in wonderland` liefert weiterhin „Alice in Wonderland in Five Acts" mit **einer** Ausgabe auf Platz 1, vor Carrolls Original mit 3.547 — aber die Bühnenfassung ist dort **unter Lewis Carroll selbst** geführt. Die Regel aus 6.1 „gleicher Titel, *anderer* Erstautor" greift also nicht, und `MARKED_DERIVATIVE` um „in five acts" zu ergänzen behandelt nur diesen einen Titel. Was in allen Fällen trägt, ist das **Ausgabenverhältnis bei gleichem normalisiertem Titel**, unabhängig vom Autor:

| Suche | Platz 2 (bzw. 1) | Ausgaben | gegen das größte Werk |
|---|---|---|---|
| `alice in wonderland` | Alice in Wonderland in Five Acts (Platz **1**) | 1 | 3.547× |
| `the great gatsby` | Stephen Matterson | 3 | 400× |
| `crime and punishment` | Michael R. Katz (Übersetzer) | 18 | 65× |

**Die Gegenprobe, die die Schwelle setzt:** Lars Myttings *Norwegian Wood* ist ein eigenes Buch und liegt bei rund einem Zwölftel von Murakami. Ein Faktor irgendwo zwischen **25 und 50** trennt die drei Zeilen oben von Mytting; welcher, ist zu messen und nicht zu raten. Ebenfalls neu gesehen: „Crime and Punishment Notes" (Cliffs Notes, 8 Ausgaben) steht auf Platz 3, `SECONDARY_LITERATURE` erkennt „Notes" also nicht.

Der entscheidende Vergleich liegt im `RankContext` schon vor: gleicher normalisierter Titel, **anderer** Erstautor, ein Bruchteil der Ausgaben des größten Werks im selben Ergebnis. `MARKED_DERIVATIVE` um „in N acts“, „a play“, „an opera“ ergänzen. Vorsicht bei echten Namensgleichheiten (Lars Myttings *Norwegian Wood* ist ein eigenes Buch, kein Ableger von Murakami) — deshalb muss die Ausgabenzahl mit hineinspielen, nicht nur der Titel. Vorher die zehn Suchen aus dem Durchklick als Regressionsschutz festhalten.

</details>


### 6.10

**6.10 „Cover, die so aussehen wie dieses".** (Julian, 2026-09-07.) *Erledigt 2026-09-08 nach [PLAN-speicher](docs/plans/PLAN-speicher.md) Variante A. Erst über 50 Bücher, auf Julians Wunsch am selben Tag auf **100** erweitert (Branch `cover-index`).* **Am 2026-09-09 auf alle kuratierten Werke erweitert** und um `indexSignatures` ergänzt, damit eine serverseitig gerenderte Seite falten kann, ohne ein einziges Bild zu holen (5.4a).
- **Dabei die Schwellenfrage gemessen und verneint** ([lab/fold](lab/fold/README.md), aus Julians Beobachtung, es seien oft gleiche Cover mit einer anderen Grundfarbe des Scans). Die Beobachtung stimmt, aber kein Maß trennt gleiche von verschiedenen Gestaltungen: nicht ein höherer Abstand, nicht Autokontrast oder Histogrammausgleich, nicht ein 16×16- oder 32×32-Raster, nicht eine Farbschranke, und eine Rauschmaske über den Bits macht es schlechter. Die 8 bleibt; oberhalb entscheidet weiter die Metadatenlage. **Offen** bleibt ein Deskriptor, der Gestaltung von Motivähnlichkeit trennt — wer das angeht, labelt erst mehr als 17 Paare.

**Ergebnis:** `data/cover-index.json` — 100 Werke, **10.362 Cover, 757 KB** — wird von `scripts/build-cover-index.ts` erzeugt und mitcommittet; `lib/coverindex.ts` liest ihn einmal beim Modulstart in typisierte Arrays, `/api/similar/[coverId]` beantwortet daraus eine Anfrage ohne einen einzigen externen Aufruf, und **direkt unter dem gewählten Cover** stehen unter „Looks like this" bis zu drei Cover **anderer** Bücher, je Buch nur eines. Am Fuß der Seitenleiste, wo die Reihe zuerst stand, fand sie niemand; die About-Seite erklärt sie jetzt ausführlich und nennt das Baudatum. Die Signatur trägt dafür neu **Sättigung und ein 16-Eimer-Farbhistogramm** (`lib/imagehash.ts`), berechnet im selben Durchlauf wie der dHash und nur dort, wo sie gebraucht wird — die Seitenantworten wachsen nicht.

**Die Schwelle wurde erlaufen, nicht ausgerechnet, und das war nötig.** Der erste Entwurf mischte Struktur und Farbe zu einer Zahl und ließ alles unter 0,45 durch. Gemessen an 58.000 zufälligen Coverpaaren aus verschiedenen Büchern liegt der Median aber bei 0,51 Farbe und 0,48 Struktur — die Schwelle ließ **100 % aller Cover** einen Nachbarn finden, und beim Ansehen war in vier von sechs Stichproben nur Rauschen. Jetzt sind es zwei **Tore** (Farbe ≤ 0,055, Struktur ≤ 0,28), gesetzt nach dem, was beim Hinsehen standhält: **17 % der Cover haben bei 100 Werken überhaupt einen Nachbarn** (bei 50 waren es 11 %), und diese Paare überzeugen — das cremefarbene Gallimard-*1984* findet den cremefarbenen Gallimard-*Camus*, der braune Leineneinband findet *Brave New World* und *Ulysses* im selben Ton, das dunkelblaue Voyager-*Neuromancer* findet drei dunkelblaue Bände. Die meisten Cover zeigen gar keine Reihe, und das ist für eine Fundsache das richtige Verhalten.

**Zwei Dinge, die der Lauf über die Daten gelernt hat.** Open Library ließ im ersten Durchgang **neun von fünfzig Werken** an je einem Timeout scheitern; mit drei Versuchen je Seite und dem Behalten dessen, was vor dem Abbruch da war, fiel im zweiten Durchgang **kein einziges** aus. Und der Index wiegt 73 Byte je Cover, also etwa wie geplant — aber mit 112 Covern je Werk statt der veranschlagten 50, sodass 500 Werke eher **4 MB** ergäben als 1,8. Das liegt nah an der Grenze aus PLAN-speicher §3.6, ab der SQLite der nächste Schritt wäre.

**Was jetzt daran hängt und billiger geworden ist:** 6.9 (mehr von diesem Autor) und 5.1 (die Sitemap-Liste) lesen denselben Index nur anders; `data/index-works.json` mit den 50 Werken ist der erste Zuschnitt der Liste aus 5.1.


### 6.10a

**6.10a Ein einzelnes „Looks like this" wird zur unscharfen Riesenkachel.** *Erledigt 2026-09-09: drei feste Spalten statt `flex-1`, und das Bild kommt als `-M` (180 px) statt `-S` (~45 px). **Gemessen bei 1440 × 900:** die Kachel eines einzelnen Treffers ist jetzt **118 px** breit in einer 373 px breiten Spalte — vorher die volle Spaltenbreite. Der Titel unter der Kachel war entgegen der ersten Vermutung immer da (live gesehen: „Cien años de soledad“, genau der Treffer aus dem Screenshot); er ging im unscharfen Bild unter.* (Julian, 2026-09-09, mit Screenshot von *Beloved*.) Die Reihe soll bis zu drei kleine Cover zeigen. Findet der Index **eines**, füllt es die ganze Spaltenbreite — bei 1440 px rund 370 px — und ist dabei sichtbar verwaschen.

**Ursache, im Code nachgesehen und nicht vermutet**, zwei Dinge, die einzeln harmlos sind:
- `SimilarCovers` in `components/BookDetail.tsx` gibt jedem `<li>` ein `min-w-0 flex-1`. Bei drei Treffern ist das ein Drittel, bei einem die volle Breite. Es gibt keine Obergrenze.
- `CoverImage` läuft mit `unoptimized`, das `sizes="80px"` ist also nur eine Angabe an den Browser und ändert die geladene Datei nicht: geladen wird `urlSmall`, Open Librarys `-S.jpg` mit rund 80 px Breite. Auf ein Drittel der Spalte passt das, auf die ganze nicht.

**Zu tun:** die Kachelbreite festhalten statt sie verteilen zu lassen (ein Raster mit drei Spalten, in dem eine einzelne Kachel links steht, statt `flex-1`), und bei größerer Darstellung `url` statt `urlSmall` nehmen. Eine halbe Stunde. **Gleich mitprüfen:** ob unter der Kachel der Titel steht — im Screenshot ist keiner zu sehen, obwohl die Komponente eine Zeile rendert.

**Zweiter Befund aus demselben Screenshot — Ursache gesucht, nicht gefunden, und die naheliegende Vermutung widerlegt.** Die Spalte zeigte über der Reihe ein leeres Coverfeld und **gar keinen Ausgaben-Block**: kein Verlag, keine ISBN, keine Händler. Das passiert, wenn die `editionIds` des gewählten Covers auf keine geladene Ausgabe zeigen. Am 2026-09-09 dazu gemessen:

| Geprüft | Ergebnis |
|---|---|
| Cover ohne auflösbare Ausgabe, alle fünf Seiten von *Beloved* | **0** von 66 Covern bei 51 Ausgaben |
| Die Cover, die die ISBN-Nachschau nachträglich einsetzt (F2.8) | Können es nicht sein: `useIsbnCovers` überspringt jedes Cover, dem keine Ausgabe zugeordnet ist (`if (editionIds.length === 0) continue`) |
| 14 Cover von *Beloved* im Browser durchgeklickt | Der Ausgaben-Block erschien **jedes Mal** |

Bleibt offen. Der Screenshot trägt die Vercel-Leiste, stammt also vermutlich von der **ausgelieferten** Seite, die den Stand vor dem 2026-09-09 fährt; dann wäre es möglicherweise schon behoben. Wer den Fehler wiedersieht, hält fest: welches Werk, welches Cover, und ob die Seite noch lud.


### 6.14

**6.14 Ein gefaltetes Cover ist nirgends zu sehen.** *Erledigt 2026-09-09, über die Seitenleiste statt über das „+N“ — das Abzeichen bleibt Zierde, weil es auf dem Telefon kein Hover gibt. Unter dem großen Cover steht **„The same cover, N scans“**: alle Scans desselben Motivs als kleine Kacheln, der Vertreter zuerst, die gewählte mit Ring, ein Klick tauscht das große Bild. Die URLs werden aus den Cover-IDs neu gebaut (`coverUrlFor`), es musste nichts durchs Modell getragen werden. Die Zeile "Image from ..." nennt jetzt die Quelle **des gezeigten Scans** — live geprüft an *Gatsby*, wo ein Google-Cover in ein Open-Library-Cover gefaltet ist und die Zeile beim Umschalten von „Open Library“ auf „Google Books“ wechselt.*

***Dabei ist Julians Sortierfrage erst wirklich gelöst worden.*** Beim Bauen fiel auf, dass die Kachel nach dem Falten Drucke nennt, die den gezeigten Scan nie trugen — `foldDuplicateCovers` hängt die Ausgaben der Mitglieder an den Vertreter. `buildWall` merkt sich deshalb, **wer welchen Scan vor dem Falten trug**, und `orderEditionsForMarket` stellt diesen Druck nach vorn. **Das war nötig, weil das Verdikt allein den Fall aus Julians Screenshot nicht löst:** die gefaltete Kachel von *Beloved* trägt Vintage International 2025 und 2004, und **beide Datensätze führen dieselbe ISBN** 9781400033416 — gleiches Verdikt, also entschied wieder das Jahr. Jetzt folgt der führende Druck dem Bild: einen anderen Scan anklicken, und 2004 rückt mit eigener ISBN und eigenen Links nach vorn (live gemessen).

(Beim Nachgehen von 6.13 am 2026-09-08 gefunden.) Das „+N" auf einer Kachel ist `pointer-events-none`, also reine Zierde; die Seitenleiste nennt die Faltung nur als Text („· 1 duplicate scan folded"); und `selectCoverFrom` löst einen Link, der die ID eines gefalteten Covers trägt, auf dessen **Vertreter** auf. Es gibt keinen Weg, ein gefaltetes Bild anzusehen. *(Am 2026-09-09 nachgesehen: das Abzeichen ist `components/CoverGallery.tsx:103`, ein `pointer-events-none`-Span, dessen einzige Auskunft ein `title`-Attribut ist — auf dem Telefon also gar keine.)*

Bei *Ansichten eines Clowns* trifft das die beiden dtv-Fassungen der Zeichnung mit der Gitarre (1967 und 1984, Bilddistanz 6): dieselbe Gestaltung, aber sichtbar verschieden gedruckt — cremefarbener gegen weißen Grund, anderer Anschnitt. Eine davon ist unsichtbar.

**Das widerspricht E16**, wo festgehalten ist, dass ein Cover nie gelöscht wird, weil es leer aussieht, sondern nur ans Ende sortiert — ein Fehlurteil soll eine Position kosten, kein Cover. Das Falten tut aus einem anderen Grund genau das, was E16 verbietet. Falten bleibt auf der Wand richtig (sonst besteht Gatsby aus 293 fast gleichen Kacheln), aber es muss umkehrbar sein: das „+N" anklickbar machen, oder die Seitenleiste zeigt die gefalteten Fassungen als kleine Kacheln unter dem gewählten Cover — dieselbe Bauform wie „Looks like this". Ein bis zwei Stunden.


### 6.18

**6.18 Eine kleine Kuratier-App zum Durchklicken.** *Gebaut 2026-09-08 und seither in Benutzung: 100 Werke, davon rund zwei Drittel gewählt. Was noch daraus wird, ist 6.17 (Rotation) und 5.8 (Minispiel). **Seit dem 2026-09-09 schlägt sie auch vor**: `lab/curate/suggest.ts` sucht neue Bücher über die eigene Suche, deckelt auf zwei je Autor, wirft Bekanntes und Gestrichenes weg und schreibt fünfzig angereicherte Vorschläge (Ausgaben, Leser, Jahr) in `suggestions.json`; die App zeigt sie am Ende des Durchlaufs und holt ihre Cover erst beim Aufschlagen. Damit stehen 150 Werke im Werkzeug. Am selben Abend um vier Dinge erweitert: Werke, die der Cover-Index nicht kennt, dürfen dazu (`EXTRA_WORKS`, Cover einmal von Open Library geholt und zwischengespeichert — so kamen *The Garden of Eden* mit 7 Covern, *East of Eden* mit 78 und *Stoner* mit 54 hinein), und ein Knopf **„aus der Liste streichen"** nimmt ein Buch dauerhaft aus dem Durchlauf und von der Startseite, im Unterschied zu „überspringen", das es für später behält. Dazu eine Liste am Fuß der Seite, über die man zu jedem angesehenen Buch zurückspringt. **Seit dem 2026-09-08 spät hat die App eine zweite Ansicht „Reihenfolge"** (Julian: „ich will die Reihenfolge durch Drag and Drop bestimmen und nebendran Dreierreihen (mobil) und Sechserreihen (Desktop) sehen, damit ich die Wirkung sehe"): links das Sechser-Raster zum Ziehen, rechts das Dreier-Raster des Telefons, beide in derselben Reihenfolge, mit einer Linie nach der achtzehnten Kachel. **Die Reihenfolge der Datei ist die Reihenfolge der Wand**, deshalb ist sie jetzt eigener Zustand im Werkzeug — vorher hätte die nächste Wahl eine von Hand gelegte Anordnung wieder überschrieben.* (Julian, 2026-09-08: „ich will gute Cover für alle 100 festlegen können, für Lolita z. B. das aus dem Screenshot. Kannst du eine lokale Mini-App erstellen, in der ich mich da schnell durchklicken kann?") Läuft lokal unter `lab/curate/`, wird nie ausgeliefert.

**Warum das schnell geht:** die Cover kommen aus `data/cover-index.json` — 10.362 Stück für die 100 Werke, mit ihren IDs; die Bilder lädt der Browser direkt von Open Library. Kein Netz für die Liste, keine Google-Anfrage, kein Kontingent.

**Was die App können muss:** ein Werk je Bildschirm, alle seine Cover als Raster, Klick wählt und springt weiter; Tastatur (Pfeile, Enter); ein Feld für das Erstausgabejahr, vorbelegt mit Open Librarys Wert und **markiert, wenn die Lücken-Regel aus 6.16 anschlägt**; Fortschritt sichtbar; jederzeit unterbrechbar, weil `data/curated.json` nach jeder Wahl geschrieben wird. Ein halber Tag, Claude.


### 6.19

**6.19 Ein Ladebildschirm für die Suche — und der der Cover-Wand, der auf dem Telefon nicht passte.** *Erledigt 2026-09-09 (Julian: „lass uns beide Ladebildschirme angehen, und zwar sowohl für Desktop als auch Mobile").*

**Zwei Messungen standen am Anfang, beide auf einem Telefon:**

| Gemessen | |
|---|---|
| Der Cover-Fächer der Wand | die vier Kacheln liefen von **−96 px bis 471 px** in einem 459 px breiten Fenster: die erste angeschnitten, die letzte über dem Rand, die Seite scrollte seitlich |
| Die ersten Sekunden einer Werkseite über einen Link von außen | **völlig leer**, nur „Collecting covers" unter einer leeren Fläche — genau der Weg, den jeder Besucher aus einer Suchmaschine nimmt |
| Die Suche selbst | zehn graue Kästen, 1 bis 13 Sekunden lang |

**Gebaut wurde eine Antwort für alle drei:** `components/AssemblingWall.tsx`, eine kleine Wand aus Covern, die Kachel für Kachel erscheint — **drei je Reihe auf dem Telefon, sechs am Rechner**, also im Rhythmus der Wand, die dabei entsteht. Sie zeigt die Cover, **die die Startseite ohnehin schon geladen hat** (`WALL_WORKS`, Daumennagelgröße): kein neues Bild im Bündel, keine zusätzliche Anfrage auf dem üblichen Weg, nichts, was mit der Kuratierung auseinanderlaufen kann. Die Bewegung ist reines CSS, `prefers-reduced-motion` bekommt den Block ohne sie.

**Klein, gedimmt und ohne Titel — mit Absicht:** was jemand beim Warten sieht, darf nicht wie eine Antwort auf seine Suche aussehen (N12). Darunter steht, worauf gewartet wird („Looking for »east of eden« in Open Library").

**Der Fächer rechnet jetzt in Bildschirmbreiten** statt in festen Pixeln (`--stage-w`, `--spread` in `app/globals.css`): bei höchstens vier Kacheln bleibt ab 320 px Breite auf jeder Seite Luft, gemessen 16 px bei 320, 19 px bei 375, 22 px bei 430; ab 640 px sind die alten Werte wieder da. `overflow-x: clip` verhindert das seitliche Scrollen selbst dann, wenn die Rechnung eines Tages nicht mehr aufgeht.

**Das Riesenmosaik ist damit nicht verbraucht.** Der ursprüngliche Vorschlag (Julian: „wie sich langsam das Bild von Orwell aus seinen Editionen aufbaut") bleibt als Ausbau offen: er bräuchte ein vorgerechnetes Bild im Bündel und wirft die Rechtefrage aus 5.5 auf, weil ein Mosaik ein abgeleitetes Werk aus fremden Covern ist und nicht bloß deren Anzeige. Die jetzige Lösung kommt ohne beides aus; wenn das Mosaik kommt, ersetzt es die Kacheln in genau einer Komponente.


### 6.19a

**6.19a Das Mosaik als Ladebild.** *Erledigt 2026-09-09 als MVP (Julian: „die beiden Einwände können wir nach hinten schieben. baue, committe, merge und deploye dann einen mvp und halte in der roadmap fest was er kann und was nicht").*

**Was der MVP kann.** Die Suche wartet seit heute vor einem Mosaik: Vorschlag 3b, zwanzig Vorlagen in `public/loading`, eine je Sitzung. **Eine** JPEG-Datei (83–102 KB auf dem Telefon, 124–159 KB am Rechner) und ein Manifest von 2,3 KB; die Reihenfolgen rechnet der Browser aus der Helligkeitskarte (`lib/loading.ts`, ~1 ms), was das Manifest von 18 KB auf 2,3 drückt. Kein Cover wird einzeln geladen, keine fremde Anfrage, **null Google**. Gemessen: 0,19 ms JavaScript je Bild bei 1.440 Zellen, 19 ms zum Dekodieren, ein DOM-Knoten. Das Bild wird beim **ersten Tastendruck** geholt, das Feld bekommt seine Höhe aus dem Manifest, bevor die Datei da ist, `prefers-reduced-motion` bekommt das fertige Bild, und **solange oder falls das Bild fehlt, steht dort die Cover-Wand von vorher**. Neu in der Website: `lib/loading.ts` (rein, 17 Tests), `components/mosaicClearing.ts`, `components/MosaicLoader.tsx`, `scripts/build-loading-assets.ts`; die Bilder entstehen weiter in `lab/loading`. Spec: F1.6a, N11 um die gemerkte Vorlage ergänzt, Datenschutzseite ebenso.

**Was er nicht kann, und was bewusst offen bleibt:**

| Offen | |
|---|---|
| **Die Rechtefrage aus 5.5** | Ein Mosaik ist ein abgeleitetes Werk aus fremden Covern, kein bloßes Anzeigen. **Julian hat den Einwand am 2026-09-09 ausdrücklich zurückgestellt**, um den MVP zu sehen; die Frage ist damit nicht beantwortet, sondern vertagt. |
| **N12** | Ein großes Porträt neben einer Suche ist ein Bild mit einem Gegenstand. Der MVP setzt eine Zeile darunter („Mark Twain · made of 897 covers of 8 of their books"), aber Größe und Dimmung sind nicht mit dem Kopf entschieden, sondern übernommen. |
| **Nicht auf der Werkseite** | Die ersten Sekunden einer Werkseite zeigen weiter `AssemblingWall`; die Suche und die Jahrzehnte-Seite zeigen das Mosaik. |
| **4,56 MB im Repository** | 40 Dateien in `public/loading`. Hebel, falls das stört: weniger Vorlagen oder nur eine Größe. |
| **Nicht auf einem Telefon gemessen** | 0,19 ms je Bild sind auf einem Mac gemessen. Die ersten Bilder nach dem Dekodieren kosten das Zehnfache (2–3 ms), und das ist der Moment, den ein Telefon zeigen würde. |
| **Der Text ist englisch, die Namen sind es nicht** | Die Zeile unter dem Bild sagt „of their books" — geschlechtsneutral, aber hölzern. |

**Die Rotation ist zur Hälfte Autorinnen** (Julian, 2026-09-09: „nimm Jack Kerouac mit auf. Wir brauchen noch ein paar Heartthrobs in unserer Rotation. Und es sollten 50% Autorinnen sein"). Zehn und zehn: Twain, Dickens, Conan Doyle, Wilde, London, Stevenson, Tolstoi, Poe, Verne, **Kerouac** — Austen, Montgomery, Alcott, Shelley, Cather, Woolf, Emily Brontë, George Eliot, Wharton, Burnett. Acht Männer sind dafür in die Reserve gegangen (Wells, Carroll, Conrad, Whitman, Stoker, Kipling, Dumas, Hugo); `templates.json` führt 26 Reserven, davon genug Autorinnen, um die Hälfte zu halten.

**Kerouac hat genau ein gemeinfreies Porträt:** seine Musterungsaufnahme der US-Marine von 1943, gemeinfrei als Werk der US-Regierung. Alles andere auf Commons steht unter CC BY-SA, und ein abgeleitetes Werk daraus zöge eine Share-alike-Pflicht nach sich, die hier niemand will. Das Bild ist obendrein das beste: ein junges Gesicht mit hartem Kontrast, 144 Kacheln reichen dafür.

**Zwei Regeln haben sich beim Bauen der Frauen geändert.** Die **Mindestgröße eines Porträts** lag bei 500 px und war zu streng — das Raster ist 40 × 36, 300 px sind also acht Pixel je Zelle; die alte Schranke hatte Kafka, Katherine Mansfield, Willa Cather und Christina Rossetti grundlos aussortiert. Und **eine dünne Palette sieht man**: unter etwa 250 Covern wird das Gesicht weich, und das billigste Mittel dagegen ist nicht ein besseres Porträt, sondern **mehr Werke derselben Autorin** (`maxWorks` je Vorlage). Burnett 161 → 281 Kacheln, Cather 226 → 406, Wharton 82 → 431. Am dünnsten bleiben Emily Brontë (183; sie hat nur sechs Werke) und Burnett — die beiden weichsten Bilder der zwanzig.

**Und ein Fehler, der genau das war, was CLAUDE.md verbietet:** *George Eliots* Mosaik entstand aus **zwei** Covern. Unter einer Ratenbegrenzung lieferte die Cover-CDN die meisten Bilder nicht, `fetchAll` verschluckte jeden einzelnen Fehlschlag, und der Lauf meldete „101 covers, 1 designs" — was wie ein dünnes Buch aussieht und ein Ausfall war. Fehlende Bilder werden jetzt **gezählt**, stehen in der Zeile je Werk, und ein Bau bricht ab, wenn weniger als die Hälfte ankommt: „that is an outage, not a palette". Edith Wharton ist beim ersten Versuch genau daran gescheitert und wurde danach neu gebaut.

**Drei Nachbesserungen und eine Bestandsaufnahme am 2026-09-10** (Julian: schneller, Übergänge prüfen, Zufall prüfen, und „mobile wurde bei mir die Animation nicht gezeigt sondern nur ein fertiges Mosaik").

**Die Animation läuft ein Viertel schneller**, 3 s statt 4. Weil das Einrasten mit `1 − (1 − p)²` gewichtet ist, passiert der sichtbare Teil ohnehin in der ersten Sekunde.

**Der Zufall war keiner.** Die Vorlage wurde **einmal je Sitzung** gewürfelt und gemerkt — das war Absicht (zwanzig Vorlagen und ein Wurf je Suche heißt neunzehn von zwanzig Suchen zahlen für eine Datei, die der Browser noch nie gesehen hat), aber nicht das, was Julian erwartete. Jetzt wird **bei jedem Anzeigen neu gewürfelt**, die zuletzt gezeigte ausgeschlossen, damit der Wechsel sichtbar ist. Gemessen an fünf Suchen hintereinander: vier verschiedene Bilder geholt, keines doppelt. Der Preis steht dabei: wer zehnmal sucht, zahlt für bis zu zehn Bilder à ~90 KB statt für eines — jedes danach im Browser-Cache. Der `sessionStorage`-Eintrag ist damit weg, und N11 und die Datenschutzseite zählen wieder drei Dinge statt vier.

**Welcher Ladebildschirm wo erscheint** (geprüft am 2026-09-10):

| Übergang | Was wartet |
|---|---|
| Startseite → Suchergebnis | **Mosaik** (`BookGrid` → `GridSkeleton`) |
| Ergebnis → Werkseite, mit Vorschau aus der Karte | **Cover-Fächer** (`LoadingStage`) |
| Werkseite direkt von außen aufgerufen | **Cover-Wand** (`AssemblingWall`, weil keine Vorschau vorliegt) |
| Werkseite → Jahrzehnte-Seite | **Mosaik** (`decades/loading.tsx`) |
| Jahrzehnte-Seite → zurück zur Werkseite | Cover-Fächer oder Cover-Wand, wie oben |
| Mosaik, solange die Datei unterwegs ist oder ausbleibt | **Cover-Wand** |
| Leere Startseite | Cover-Wand der Kuration (kein Ladezustand) |

**Zum Telefon: das ist vermutlich kein Fehler, sondern eine Einstellung.** `prefers-reduced-motion: reduce` bekommt das fertige Bild ohne Bewegung — so steht es in F1.6a —, und **iOS meldet `reduce` sowohl bei „Bewegung reduzieren" als auch im Stromsparmodus**. Das ist genau das beobachtete Verhalten. Zu prüfen am Gerät: Einstellungen → Bedienungshilfen → Bewegung, und der Batterie-Schalter. **Eine zweite Ursache war trotzdem möglich und ist behoben:** die Uhr der Animation startete, *bevor* die verwürfelte Wand gezeichnet war (1.440 Kacheln) und bevor die Seite ihr Layout hatte. Auf einem Telefon mit laufender Suche sind das ein paar hundert Millisekunden, die als Animation zählten, die niemand sah — und ein langer Hänger hätte genau ein fertiges Mosaik ergeben. Gezeichnet wird jetzt sofort, gezählt ab dem **ersten Bild**.

**Auch beim Wechsel von der Cover-Wand zur Jahrzehnte-Seite** (Julian, 2026-09-10: „baue den Ladebildschirm auch ein für das Laden beim Wechsel von Coverwall zu Decade Wall"). `app/book/[id]/decades/loading.tsx` zeigt statt der Cover-Wand das Mosaik. **Das ist die Wartezeit, für die es gebaut wurde:** eine Suche kommt weit öfter nach ein, zwei Sekunden zurück als nach zehn, die Animation wird dort also meist abgeschnitten — hier hat sie 4,5 bis 12,9 s, läuft durch und hält danach das fertige Gesicht. Wer vorher gesucht hat, sieht dieselbe Vorlage, weil die Wahl je Sitzung gilt; und weil `MosaicLoader` bis zum Eintreffen des Bildes ohnehin die Cover-Wand zeigt, ist der Weg dorthin unverändert.

**Nachgebessert nach dem ersten Deploy** (Julian, 2026-09-09): **„Looking for …" steht jetzt über dem Mosaik**, als Überschrift in der Display-Schrift — „dann ist niemand verwirrt". Erst lag die Zeile *auf* dem Bild, auf einem Grund in `--surface` bei 90 %; Julian am selben Abend: „der Ladetext sollte grafisch über dem Mosaik stehen, nicht als Overlay". Er hat recht — eine Zeile auf einem Mosaik braucht einen eigenen Grund und liest sich dann wie ein aufgeklebtes Etikett, während sie darüber gesetzt sagt, was die Seite gerade tut. Wer auf dem Bild zu sehen ist, steht weiterhin klein darunter.

**Ursprünglich (aus 6.19, offen).** Julians ursprünglicher Vorschlag: das Bild eines Autors, das sich langsam aus den Covern seiner Ausgaben aufbaut. `lab/mosaic` kann es bereits — ein erkennbares Gesicht aus 222 Covern, ohne Überblendung. **Zwei Dinge stehen davor:** ein vorgerechnetes Bild im Bündel (Sprite-Streifen oder Einzelbild mit Maske; Größe zu messen, das heutige PNG ist zu groß), und die Rechtefrage aus 5.5 — die Anzeige fremder Cover ist eine Sache, ein daraus abgeleitetes Werk als eigenes Seitenelement eine andere. Ersetzt bei Umsetzung die Kacheln in `AssemblingWall`, sonst nichts. (Julian, 2026-09-08: „wir brauchen noch eine Idee für einen Ladebildschirm der Buch-Suche, nicht dem der Coverwall. Vielleicht können wir eine Animation von den vorher erstellten Riesenmosaiken nehmen? Wie sich langsam das Bild von Orwell aus seinen Editionen aufbaut. Es darf aber clientseitig nicht zu ressourcenverbrauchend sein.") Heute wartet die Suche ohne Bild; die Cover-Wand hat ihre Ladeszene (`LoadingStage`), die Suche nicht — und sie ist die längste Wartezeit der Seite (1–13 s, ROADMAP 2.6).

**Das Material liegt fertig in `lab/mosaic`:** ein Photomosaik baut aus 222 Covern ein erkennbares Gesicht, ohne Überblendung, in unter 30 s Rechenzeit — offline, einmal.

**Vier Wege, nach Kosten im Browser sortiert** (zu messen, bevor einer gewählt wird):

| Weg | Was der Browser tut | Kosten |
|---|---|---|
| **Sprite-Streifen**, 16–24 vorgerechnete Stufen in einem WebP, per `background-position` durchgeschaltet | ein Bild dekodieren, eine CSS-Animation | am billigsten; Dateigröße zu messen |
| **Animiertes WebP/AVIF** | Dekodierung je Bild übernimmt der Browser | einfach, aber Dekodierlast läuft durch |
| **Canvas mit Kachelliste**: das Endbild als ein WebP, dazu eine kleine JSON-Zuordnung, Kacheln erscheinen einzeln | ein Bild plus wenige hundert `drawImage` | mittel, dafür beliebig lang und nie zweimal gleich |
| **Echte Cover als DOM-Kacheln** | hunderte Bildanfragen | **fällt weg** — das ist genau der Ressourcenverbrauch, den Julian ausschließt |

**Empfehlung: der Sprite-Streifen**, mit dem Canvas-Weg als Ausbau, falls die Animation zu kurz wirkt. Zwei Randbedingungen: `prefers-reduced-motion` schaltet auf das Endbild ohne Bewegung, und das Motiv darf nichts behaupten — ein Autorenporträt aus Covern ist ein Bild, kein Suchergebnis. **Anmerkung zum Motiv:** Orwell ist naheliegend, aber 1984 fliegt gerade aus der Liste (6.17); ein Motiv, das nicht an einem einzelnen Buch hängt, altert besser.

**Vorgearbeitet in `lab/loading/` am 2026-09-09** (Julian: „mach für einen zweiten Autoren drei Vorschläge für eine solche Animation") — [lab/loading/README.md](lab/loading/README.md), Kontaktbogen `lab/loading/out/mark-twain-filmstrip.png`. Gebaut auf **Mark Twain**, 897 Cover aus seinen acht auflagenstärksten Büchern über ein gemeinfreies Porträt von 1907. Der Weg ist der Canvas-Weg, nicht der Sprite-Streifen: **ein JPEG plus ein Manifest**, aus dem sich jede der drei Animationen zeichnen lässt, statt vorgerechneter Stufen.

| | Was sie zeigt | Wenn die Suche sie abschneidet |
|---|---|---|
| **1 Rückzug** | die Kamera geht zurück, im letzten Drittel kippt die Wand in ein Gesicht | volles Bild, aber vor 60 % ohne Gesicht; läuft ganz auf dem Compositor |
| **2 Schwerste Zelle zuerst** | die Reihenfolge, in der das Mosaik gerechnet wurde: Extremwerte zuerst, das Gesicht steht bei 30 % als Schatten | sieht unfertig aus, weil es das ist |
| **3 Umsortieren** | die Wand steht sofort, aber falsch sortiert und gedimmt; eine Diagonale sortiert sie, das Gesicht fällt aus dem Rauschen | volles Bild, aber die Front bleibt als halbfertige Kante stehen |
| **3b Das Rauschen klärt sich** | dieselbe Wand ohne Welle: zufällige Reihenfolge, und die Dämpfung hebt sich mit — nichts läuft von einer Seite zur anderen | **volles Bild zu jedem Zeitpunkt, und nichts bleibt sichtbar unfertig** |

**Empfehlung aus dem Experiment: 3b** (nachgereicht am selben Tag auf Julians Rückfrage „weniger Kante im Effekt, sondern ein langsames Klären des Rauschens"), weil der häufigste Fall nicht das Ende der Animation ist, sondern ihr Abbruch nach ein bis zwei Sekunden — und eine eingefrorene Diagonale sieht halbfertig aus, ein leicht verrauschtes Bild nicht.

**Gemessen** (40 × 37 Zellen, 480 px, Browser-Pane auf dem Mac, nicht auf dem Telefon): **105 KB** als JPEG q60 — als PNG wären es 750 KB, als WebP 81 KB; 19 ms Laden und Dekodieren; **0,16 ms JavaScript je Bild** (3b: 0,29 ms, das teuerste der vier und noch immer unter 2 % des Budgets eines Bildes); vier DOM-Knoten für alle vier Felder. Damit ist die Größenfrage aus dem Absatz darüber beantwortet: **das heutige PNG ist zu groß, ein JPEG ist es nicht.**

**Vier Befunde, die vor einer Umsetzung zählen.** (a) **40 Spalten, nicht 24** — bei 24 ist die Kachel ein erkennbares Buch und das Gesicht weg. (b) Der **Untergrund entscheidet, welche Hälfte** man bei Nummer 2 zuerst sieht: auf hellem Grund die dunklen Zellen (Haar, Augen, Schultern), im Dunkelmodus die hellen. (c) Eine falsch sortierte Cover-Wand und eine richtig sortierte **sehen gleich aus** — Nummer 3 war unsichtbar, bis das Unsortierte gedimmt wurde; und bei gleichmäßiger Rate sieht das erste Drittel von 3b aus wie der Anfang, weshalb die Kacheln dort mit `1 − (1 − p)²` zuerst schnell und dann langsam einrasten. (d) **Ein zweiter Autor ist nicht austauschbar:** Twain sitzt bei mittlerem Abstand 470, Virginia Woolf bei 861, und ihr Gesicht ist in Ladebildgröße kaum zu lesen — 897 Kacheln gegen 335, und ein Foto mit echtem Schwarz und Weiß gegen ein weiches Porträt. **Ein Ladebild braucht mehr Kontrast als ein Plakat.**

**Zwanzig Vorlagen gebaut, am selben Tag** (Julian: „baue damit 20 Vorlagen, die als Ladebildschirm verwendet werden können, nimm Rücksicht auf die anderen Bedingungen bei mobile und desktop und darauf dass es schnell und flüssig bleiben muss und wenig Traffic produzieren sollte"). **`lab/loading/templates.json` ist eingecheckt, die Bilder nicht** — ein Bau ist ein Befehl, und 5 MB abgeleiteter Cover-Bilder haben im Repository nichts zu suchen, solange die Rechtefrage offen ist.

**Wie die zwanzig zustande kamen.** (1) Ein **gemeinfreies Porträt**, gefunden über Wikidata `P18` und geprüft am Lizenzfeld von Commons — Dateinamen zu raten funktioniert nicht: von 26 plausiblen Namen von Hand existierten zwei. Vier Autoren fielen heraus, weil ihr Porträt auf Commons kleiner als 500 px ist (Kafka, Dickinson, Brontë, Tschechow — alle vier berühmte Bilder, alle vier dort nur als Daumennagel). (2) Ein **Foto statt eines Gemäldes**, wo es die Wahl gab. (3) **Genug Ausgaben:** jeder der zwanzig hat acht Werke mit ihm als Erstautor, von 966 Ausgaben (Whitman) bis 12.431 (Dickens). (4) **Ein Kopf, kein Garten** — der einzige Schritt, der sich nicht automatisieren ließ: `portrait-sheet.ts` legt alle zwanzig Porträts auf einen Bogen und zeichnet den Rahmen ein, aus dem gebaut wird. Neun sind sitzende Halbfiguren, deren Kopf ein Fünftel des Bildes ausmacht; die haben von Hand einen Ausschnitt bekommen. Tolstoi ist der Extremfall: sitzend zwischen Bäumen, der Kopf ein Zwanzigstel.

**Womit alle zwanzig gebaut sind** (in `build-all.ts`, an einer Stelle): **40 Spalten**; **3:4 für jedes Bild**, damit das Feld beim Wechsel der Vorlage nicht die Form ändert und seine Höhe feststeht, bevor die Datei da ist; **480 und 640 px**, von denen immer nur eine geholt wird; **Qualität 50**; **Farbgewicht 0,15**.

**Was „schnell, flüssig und wenig Traffic" konkret hieß.** Eine Anfrage je Suche, nicht zwanzig: die Vorlage wird **einmal je Sitzung** gewürfelt und im `sessionStorage` gemerkt, sonst zieht neunzehn von zwanzig Suchen eine Datei, die der Browser noch nie gesehen hat. Die Größenwahl hat eine **Toleranz von 20 %** — ohne sie verlangt ein 260-px-Rahmen bei doppelter Pixeldichte 520 px und bekommt die 640er Datei, 60 % mehr Bytes für Pixel, auf die niemand zeigen kann. **Höchstens zwei Gerätepixel**, nie drei. Das Feld bekommt seine **Höhe aus dem Manifest**, bevor das Bild da ist. **Vorladen beim ersten Tastendruck**, nicht beim Absenden.

**Gemessen an den zwanzig.** Alle kommen auf dasselbe Raster, **40 × 36 = 1.440 Zellen**, weil der 3:4-Schnitt sie gleich formt — genau darum geht es, das Feld ändert sich beim Wechsel nicht. Zusammen sind sie **10.532 Cover aus 160 Werken**. Auf der Platte **4,56 MB** für alle vierzig Dateien; ein Leser holt **eine**, **83 bis 102 KB** auf dem Telefon, 124 bis 159 KB am Rechner. Ein Bau von zwanzig dauert **17 Minuten** kalt, 3,8 Minuten mit warmem Cover-Cache, und kostet **null Google-Anfragen**. Die Palette reicht von 146 Covern (Mary Shelley) bis 1.368 (Dickens) — und hört überraschend früh auf, eine Rolle zu spielen: Shelleys 146 tragen ein Gesicht.

**Der Befund, der beim Bauen am meisten wert war: die Passung entscheidet nichts.** Tolstois erstes Porträt — Prokudin-Gorskis Farbfoto von 1908 — saß bei einem mittleren Abstand von **285, dem zweitbesten der zwanzig, und zeigte kein Gesicht**: ein weiches altes Bild eines grauen Mannes vor grauen Bäumen, und das Mosaik traf jedes Grau davon. Mit Sass' Atelierporträt aus den 1880ern, Kontrast 63 statt 42, steht das Gesicht da. Aber Whitman hat den **niedrigsten** Kontrast aller zwanzig (35,8) und liest sich einwandfrei, weil sein Hell und Dunkel im Bart sitzt und Tolstois in einem Baum saß. Der Kontrastwert steht jetzt in der Tabelle und markiert vier der zwanzig — **er ist ein Grund hinzusehen, kein Urteil: er hatte in einem von fünf Fällen recht.**

**Offen bleibt außer der Rechtefrage ein Einwand aus N12:** ein großes Porträt von Mark Twain, während jemand *East of Eden* sucht, ist ein Bild mit einem Gegenstand — genau deshalb ist die heutige `AssemblingWall` klein, gedimmt und unbeschriftet. Größe, Dimmung und eine Zeile, die sagt, was das Bild ist, sind zu entscheiden, bevor das auf die Seite kommt.


### 6.20

**6.20 Die Teilen-Vorschau zeigt nicht das gewählte Cover.** *Erledigt 2026-09-09 über Weg (a): eine eigene Adresse `/book/<werk>/cover/<cover>` mit eigenem Vorschaubild, das dieses eine Cover groß zeigt statt des Vier-Cover-Mosaiks; Canonical zeigt auf die Werkseite zurück, damit nicht zwei Adressen um dieselbe Wand konkurrieren. **Die Detailseite bleibt statisch** — das war der Preis von Weg (b). Im Blättern bleibt `?cover=` die Quelle der Wahrheit, der Teilen-Knopf baut die Pfad-Adresse.* (Julian, 2026-09-08: „der Share-Button sollte die aktuelle Auswahl widerspiegeln.") **Nachgesehen: der Link tut es bereits** — `ShareButton` kopiert `window.location.href`, und die URL trägt seit jeher `?cover=…`. Falsch ist die **Vorschau**: `app/book/[id]/opengraph-image.tsx` bekommt nur `params`, nie die Query, und `generateMetadata` liest sie heute nicht. Geteilt wird also der richtige Link mit dem allgemeinen Vier-Cover-Mosaik darüber.

**Der Haken ist nicht der Code, sondern das Rendering.** Liest `generateMetadata` die Query, wird die Detailseite **dynamisch** — die ISR-Frist von 24 h fällt weg, jede Seite kostet wieder eine Funktion. Drei Wege: (a) eine eigene Route mit dem Cover im Pfad, die dieselbe Seite rendert und ihr eigenes OG-Bild hat (ISR bleibt, mehr Code); (b) `generateMetadata` mit `searchParams` und den Preis bezahlen (einfach, teuer); (c) so lassen und nur den Knopf ehrlich beschriften. Vorher messen, was eine dynamische Detailseite kostet.


### 6.21

**6.21 Teilen-Knöpfe für soziale Netze.** *Erledigt 2026-09-09: ein Menü hinter dem Teilen-Knopf mit Link kopieren, `navigator.share` auf dem Telefon, Pinterest, WhatsApp, Bluesky, X und E-Mail. **Alles reine Links** — kein fremdes Skript, kein Cookie, kein Banner, und kein Netzwerk erfährt von einem Leser, der nicht klickt. Pinterest steht vorn: eine Pinnwand aus Covern ist genau das, was diese Seite in einem fremden Haus wäre, und es ist das einzige Ziel, das das Bild selbst mitbekommt. **Der Knopf steht seit demselben Tag am Cover statt in der Kopfzeile** (Julian): am Rechner unter dem grossen Cover in der Seitenleiste, auf dem Telefon in der Peek-Leiste neben "Details"; ohne gewähltes Cover bleibt er in der Kopfzeile, sonst ließe sich das Buch selbst nicht mehr teilen.* (Julian, 2026-09-08: „lass uns Social-Media-Share-Buttons einfügen, die das Cover als Vorschau mitgeben, wenn man teilt. Spricht was dagegen?") **Dagegen spricht nichts, solange es Links bleiben und keine Widgets.** Die eingebetteten Knöpfe von Facebook, X und Co. laden fremde Skripte und setzen Cookies; das wäre das Ende von N11 und der Anfang eines Cookie-Banners. Eine schlichte Adresse (`.../intent/tweet?url=…`, `wa.me/?text=…`, `mailto:`) lädt nichts, setzt nichts und tut dasselbe. Auf dem Telefon kommt `navigator.share` dazu, das gar keinen Knopf je Netzwerk braucht.

**Zwei Dinge sind vorher zu klären:** die Vorschau zeigt erst dann das gewählte Cover, wenn 6.20 entschieden ist — vorher teilen die Knöpfe das Mosaik. Und das OG-Bild ist heute **914 KB**; das ist für WhatsApp und Signal an der oberen Kante, ein kleineres wäre besser. Rechte: die Vorschau trägt fremde Cover auf eine fremde Plattform, dieselbe Frage wie beim Clip (5.5) und beim Mosaik — für ein Vorschaubild eines Links ist das üblich und vertretbar, gehört aber notiert.


### 6.22

**6.22 Das Farbschema ändern.** *Erledigt 2026-09-09: Julian hat nach den Mockups das **sanftere Terrakotta** gewählt und die **ink-3-Korrektur** mitgenommen. Ausgeliefert: Akzent `#945138` hell und `#dbac94` dunkel (Farbwinkel unverändert 16, Sättigung 61 → 45, Helligkeit 43 → 40), `ink-3` `#746c62` und `#837b6f`. Grundfarbe, Schriften und alles Übrige unverändert — die Wand bleibt die Bühne. **Der Kontrast des Akzents steigt dabei von 4,56 auf 5,29**, `ink-3` von 3,28 / 4,14 auf 4,55 / 4,51. Beide Modi im Browser nachgesehen.*

***Damit das nicht wieder unbemerkt kaputtgeht:*** die Rechnung steht jetzt in `lib/contrast.ts`, und `lib/__tests__/contrast.test.ts` liest `app/globals.css` selbst und prüft **sechs Paare in beiden Modi** gegen AA — keine Kopie der Werte, weil genau das Auseinanderlaufen der Fehler war. Gegenprobe gemacht: mit dem alten `ink-3` fällt der Test. Die Kandidaten in `lab/palette/` bleiben stehen, „Vorher" zeigt den alten Stand samt seiner roten Zeile.*

*(Julian, 2026-09-09.)* Heute: warmes Papier `#f4f0e8` mit Off-Black, dunkel als warmes Schwarz `#131110`, eine Akzentfarbe Terrakotta `#b1502b` hell und `#e6a677` dunkel, Fraunces für Titel, Geist für die Oberfläche (SPEC §5). Die Tokens stehen an einer Stelle, in `app/globals.css` unter `@theme inline`; ein Wechsel ist also eine kleine Änderung, sobald entschieden ist, **was** sich ändern soll.

**Es geht vor allem um die Akzentfarbe** (Julian, 2026-09-09). Terrakotta `#b1502b` steht heute auf dem Suchknopf, den Sprach-Pillen, den Fokus-Ringen, den Links und dem Verdikt-Hinweis — es ist die einzige Farbe der Oberfläche und damit die einzige, die mit den Covern konkurriert. Wer sie ändert, ändert den Charakter der Seite; wer nur den Hintergrund ändert, ändert die Bühne.

**Zu klären, bevor etwas gebaut wird:** stört die Grundfarbe, der Akzent oder beides? Soll es wärmer, kälter, dunkler, ruhiger werden? Und vor allem — **die Wand ist der Grund für jede Farbentscheidung**: der Hintergrund steht hinter hunderten Covern in allen Farben, und je bunter er ist, desto mehr streitet er mit ihnen. Papierweiß war genau deshalb gewählt. Ein Vorschlag lässt sich billig zeigen: dieselbe Wand in drei Färbungen nebeneinander, entweder in der Kuratier-App oder als kleine Seite unter `lab/`.

**Was dabei nicht verhandelbar ist:** der Kontrast muss WCAG AA halten (die Verdikte und die Metadaten stehen heute in `ink-2` und `ink-3` auf Papier), und heller wie dunkler Modus müssen beide stimmen, weil `prefers-color-scheme` beide ausliefert.

**Mockups liegen seit dem 2026-09-09 in [`lab/palette/`](lab/palette/README.md)** (Julian: „mache screenshot mockups für 6.22"). Kein Farbfeld-Vergleich, sondern **dieselbe Wand und dieselben Bedienelemente in jeder Färbung, hell und dunkel**, darunter je die Kontrasttabelle der Paare, die in der Oberfläche wirklich vorkommen. Vier Kandidaten, entschieden ist nichts:

| Kandidat | Was sich ändert | Was es kostet |
|---|---|---|
| **Heute · Terrakotta** | nichts, die Referenz | steht am nächsten an den Rot- und Ockertönen der Cover und konkurriert dort am ehesten mit ihnen |
| **Terrakotta, sanfter** (Julian, 2026-09-09: „baue ein sanfteres terrakotta") | `#945138` hell, `#dbac94` dunkel: Sättigung 61 → 45, Helligkeit 43 → 40, Farbwinkel unverändert bei 16 | nichts — im Gegenteil: der Kontrast steigt von **4,56 auf 5,29** |
| **Tinte** | gar keine Akzentfarbe; der Akzent ist dieselbe Tinte wie der Text | alle Farbe kommt von den Covern, was das Produktversprechen ist — aber Knöpfe und Fokusringe müssen ihre Sichtbarkeit aus Form holen, und die Seite wird strenger |
| **Indigo** | kühler Akzent auf demselben Papier | tritt hinter die Wand zurück, weil kein Cover dieses Blau trägt; verliert die Wärme, die Papier und Akzent heute gemeinsam erzeugen |
| **Olive** | gedämpfter Akzent **und** kühleres Papier — der einzige, der die Grundfarbe anfasst | die Wand wirkt kühler beleuchtet und die Cover wärmer; das Papier verliert seinen Charakter und nähert sich Weiß |

**Warum das sanftere Terrakotta zugleich dunkler ist, und das ist kein Geschmack:** das heutige `#b1502b` hält mit **4,56** nur knapp WCAG AA. Reines Entsättigen fällt darunter — gemessen: `#a85c40` 4,33, `#a1614a` 4,27, `#9d6552` 4,18. Weicher wird es also nur über die Helligkeit, und der Umweg bringt zum ersten Mal Reserve. Wer den Ton später noch weiter beruhigen will, muss ihn weiter abdunkeln, sonst wird aus dem Akzent ein Barrierefreiheitsfehler.

**Ein Befund beim Bauen der Mockups überholt die Farbfrage: `ink-3` verfehlt heute WCAG AA.** Gemessen 3,28 im hellen und 4,14 im dunklen Modus gegen die 4,5, die normaler Text braucht — und `ink-3` trägt die Metadatenzeilen und die Verdikt-Hinweise bei 11–12 px, die Ausnahme für großen Text greift also nicht. Die nächstliegenden bestehenden Werte sind `#746c62` (4,55) und `#837b6f` (4,51), kaum ein Schattenunterschied; deshalb ist es nie jemandem aufgefallen. **Das gehört korrigiert, welcher Akzent auch immer gewinnt.** Die drei Vorschläge tragen es bereits, „Heute" absichtlich nicht — sonst zeigte die Tabelle nicht, was ausgeliefert wird.

**Zu entscheiden bleibt Julians Wahl**; danach sind es neun Zeilen in `app/globals.css` unter `@theme inline` und ein eigener Commit.


### 6.28

**6.28 Ein Suchfeld in der Kopfzeile, auf jeder Seite.** *Erledigt 2026-09-10. Es steht auf Detailseite, Jahrzehnte-Seite, About, Kontakt, Datenschutz und 404 — nicht auf Startseite und Trefferliste, die ihr eigenes Feld haben (im HTML nachgezählt: dort 0 Felder in der Kopfzeile, überall sonst genau 1). **Ein einziges `<input>`:** auf breiten Schirmen per CSS sichtbar, auf dem Telefon öffnet die Lupe dasselbe Element über der Kopfzeile, mit „Cancel" daneben. Der Zurück-Link heißt jetzt **„Results"** bzw. **„Home"**. Der Sprachfilter wird mitgenommen (`/book/…?lang=de` → `/?q=dune&lang=de`), die letzte Suche landet in `recentSearches`.*

**Drei Dinge sind beim Bauen aufgefallen, alle drei erst in der Messung:**
- **`useSearchParams` hätte jede Seite mit diesem Feld aus dem statischen Rendern genommen** — der Build sagt es ausdrücklich („should be wrapped in a suspense boundary") und brach an `/about` ab. Der Sprachfilter wird jetzt beim Absenden aus `window.location` gelesen, was im Ereignishandler ohnehin sicher ist. About, Datenschutz, Kontakt und die Jahrzehnte-Seiten sind weiter statisch.
- **„Results" war zuerst an der Adresse festgemacht** (`href !== '/'`) und stand damit auch bei `?lang=de` ohne Query da, wo es gar keine Trefferliste gibt. Jetzt entscheidet die Query.
- **Der Cursor landete nicht im Feld:** ein `requestAnimationFrame` nach dem Tippen auf die Lupe feuert, solange das Feld noch `display: none` ist, und ein nicht dargestelltes Element nimmt keinen Fokus. Ein Effekt auf `open` läuft nach der Klasse.

*Ursprünglicher Punkt:* (Julian, 2026-09-09: „wenn man innerhalb einer buchseite, einer cover wall oder decade ist, muss es ganz oben in der leiste die suchleiste geben, damit man nicht erst zur startseite zurückwechseln muss vor einer neuen suche. spricht da was dagegen? auf mobil muss es vielleicht anders aussehen." *Der frühere Einzeiler „Sticky-Suchfeld auf dem Telefon" ist hierin aufgegangen.*)

**Dagegen spricht nichts Grundsätzliches, und ein Nebengewinn ist größer als der genannte Anlass:** `SiteHeader` ist bereits `sticky top-0`. Ein Feld dort ist also nicht nur ohne Umweg über die Startseite erreichbar, sondern **mitten aus einer Wand von 300 Covern heraus**, ohne hundert Reihen nach oben zu scrollen. Es bleibt außerdem während der Ladeszene bedienbar, weil die Kopfzeile durchgehend gerendert wird.

**Drei Dinge sind zu entscheiden, und eines davon ist ein echter Fund:**

1. **Der Zurück-Link heißt heute „‹ Search" — das geht dann nicht mehr.** Er führt zur *Trefferliste, aus der man kam, samt Query* (`backHrefFrom`), ein Suchfeld daneben fängt dagegen von vorn an. Zwei Bedienelemente, dasselbe Wort, verschiedene Wirkung: genau die Sorte stiller Doppeldeutigkeit, die 1.11 gerade bei „AbeBooks" beseitigt hat. Der Link muss umbenannt werden — „‹ Results" oder „‹ Back to results" —, sonst ist das Feld eine Verschlechterung.
2. **Auf dem Telefon passt es nicht daneben.** Bei 375 px trägt die Kopfzeile schon Zurück-Link, Wortmarke und Teilen-Knopf. Drei Wege: ein Lupensymbol, das das Feld über die Kopfzeile aufklappt; das Feld ersetzt auf inneren Seiten die Wortmarke; oder das Feld sitzt als zweite, ebenfalls angeheftete Zeile unter der Kopfzeile — das war der ursprüngliche Einzeiler. **Mitzudenken:** auf der Detailseite ist unten bereits die Peek-Leiste angeheftet (F2.11); mit einer zweiten Zeile oben hätte die Wand dann Möbel an beiden Rändern.
3. **Platz auf dem Rechner** ist da, sobald die Zeile „Covers, side by side." weicht — sie ist Zierde und unterhalb von `md` ohnehin ausgeblendet.

**Der Blocker ist weg:** **0.8** ist am 2026-09-10 von Julian am Gerät beantwortet — Enter sendet ab. Ein Feld auf jeder Seite vervielfacht also nichts Kaputtes mehr. *(Die restliche Tastaturprobe, 0.8a, betrifft Tab-Reihenfolge und Fokus-Ringe und hält diesen Punkt nicht auf; sie gehört aber mitgeprüft, sobald das Feld in der Kopfzeile steht — dort ist die Tab-Reihenfolge eine neue Frage.)* Der Preis an Client-Code ist dagegen klein: `SearchBar` ist eine Client-Komponente mit `useRecentSearches` (localStorage), und die Jahrzehnte-Seite hydriert wegen `CoverImage` ohnehin schon.

**Nicht mit hineinnehmen:** die Sprach-Pillen. Auf der Startseite gehören sie zum Feld, in einer Kopfzeile wären sie eine zweite Reihe für eine Einstellung, die auf einer Detailseite nichts tut. Ein halber Tag, Claude.

