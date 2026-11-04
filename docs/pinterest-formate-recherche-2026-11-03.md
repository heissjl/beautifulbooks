# Pinterest: Bewertung des Ansatzes und Recherche zu Pin-Formaten (2026-11-03)

Julian, 2026-11-03 abends, in der Sitzung, die seither alles Pinterest macht: „Bewerte kurz den bisherigen strategischen Ansatz für Reichweite und die Tools, die es für den Umgang mit und für Pinterest gibt. Überlege noch mit kurzer Recherche eines Subagenten, welche weiteren Arten von Pins erfolgversprechend wären (große Bilder von Sammlungen wie auf Reddit? oder mehr Boards mit vielen einzelnen Titeln, ohne viel Extra-Branding von der Website, aber Verlinkung auf die Cover?)“

Gehört zu ROADMAP 5.5, [PLAN-5.5-5.6 §7](plans/PLAN-5.5-5.6-kanaele.md) und [PLAN-5.6c §3.4](plans/PLAN-5.6c-reichweite-zweiter-anlauf.md); die Übergabe der Vorgängersitzung ist [pinterest-uebergabe.md](pinterest-uebergabe.md). Die Recherche in §4 hat ein Agent am 2026-11-03 gemacht (21 Suchen und Abrufe); **[A]** ist Pinterest offiziell, **[B]** eine Messung Dritter mit Zahlen, **[C]** Praktikermeinung, **[V]** eine Vermutung von mir. Alle Zahlen in §1 sind an diesem Abend gelesen, einmal je Quelle.

## 1. Stand am 2026-11-03 abends, gemessen

**Pinterests Statistik** (`analytics.pinterest.com/overview/`, letzte 30 Tage 4.10.–3.11., organisch, „Your Pins“):

| Impressions | Engagements | Ausgehende Klicks | Saves | Publikum |
|---|---|---|---|---|
| 18 (Kopfzahl; die Tabelle je Pin summiert 34, Pinterest nennt beides Schätzung) | 0 | 0 | 0 | 0 |

Je Pin: SF Masterworks 22, Animal Farm 5, Feminist Press 3, Harry Potter 2, Nineteen Eighty-Four 1, The Otherwise Award 1. Top-Boards: Covers through the decades 10 (3 Pins), SF Masterworks 4 (1 Pin). Follower 0.

**K16** (`/api/insights?days=30` mit dem Admin-Passwort als Bearer, einmal): unter den Kanälen **keine Zeile `pinterest`**, also 0 Einstiege; Buchbesuche mit Herkunft Pinterest 0. Zum Vergleich dieselben 30 Tage: direct 3.647 (Bot-geprägt, 3.1i), engine 21, reddit 10, site 10, x 6, social 4, bluesky 1.

**Konto:** „Created“ zeigt 5 Pins (SF Masterworks, Feminist Press, Animal Farm, The Otherwise Award, Nineteen Eighty-Four). *Harry Potter* fehlt unter Created und unter Scheduled, steht aber mit 2 Impressions in der Statistik: der Pin war veröffentlicht und ist weg — gelöscht oder von Pinterest entfernt; Julian fragen. **Scheduled Pins 7:** A Game of Thrones 4.11. 12:00, The Hobbit 4.11. 19:00, Brave New World 5.11. 12:00, Dune 5.11. 19:00, Fahrenheit 451 6.11. 12:00, The Fellowship of the Ring 6.11. 19:00 (nur noch einer; der alte Pin `4000372565200832576` aus der Übergabe ist nicht mehr in der Liste), Ender’s Game 7.11. 19:00. Ein Entwurf (Fellowship, „27 days until expiration“). Die Datei `docs/pins/queue.json` hält 32 Pins: 5 veröffentlicht, 8 geplant (darunter Harry Potter), 19 Entwürfe.

**Was die Zahl heißt:** drei Tage, sechs Pins, kein Klick. Zu früh für ein Urteil (Tailwind maß, dass ein Fünftel neuer Pins nach einer Woche noch gar nicht verteilt war, §4 Q2), zu wenig für Hoffnung. Der Maßstab bleibt PLAN-5.5-5.6 §5: um den 26.12.2026 80 Pins und ≥ 50 Besuche je Woche mit `via=pinterest`, sonst einstellen.

## 2. Bewertung des Ansatzes

**Was stimmt.**

- **Pinterest als der Kanal ohne Follower** (PLAN-5.6c §3.4) ist richtig gedacht, und die Recherche stützt es: Verteilung hängt an Suchwörtern im Titel, am Alt-Text und an „neues Bild + neue Adresse“, nicht an Followern (§4 Q2 [B]). Ein Pin lebt Monate, die Seite hat Material für Jahre.
- **Schwelle mit Datum und Abbruchregel**, zwei voneinander unabhängige Messungen (Pinterests Statistik, K16) — beide funktionieren, beide heute gelesen. Follower und Likes zählen nicht (PLAN-5.6c §8), richtig.
- **Jeder Pin von Hand gewählt**, Julians Ja im Cockpit, Claude plant ein: das ist genau Pinterests Regel für Automatisierung („the end user must choose each Pin“, umgang §15, [reichweite-recherche §F](reichweite-recherche-2026-10-17.md)).
- **Allgemeine Suchnamen statt Sammlungsnamen** (Julian, 3.11.): ~80 % der viralsten Pins tragen ein Ziel-Suchwort im Titel [B]. Die acht Entwürfe mit allgemeinen Namen gehen in die richtige Richtung.

**Was schwach ist.**

- **Ein einziges Format.** Alle 32 Pins sind Montagen mit Wortmarke (Wand mit 75 Covern, Jahrzehnte mit 9, Vergleich mit 3), alle Links führen auf Sammel- und Jahrzehnte-Seiten. Das Umfeld, in dem Pinterest sie zeigt („vintage book covers“, „penguin covers“), besteht aus **Einzel-Covern auf großen Nutzer-Boards** (470, 630 Pins; §4 Q3). Unser Format ist dort das fremde.
- **Die Wand ist im Feed Textur.** Eine Spalte des Pinterest-Rasters ist etwa 236 px breit [V, Desktop]; 75 Cover darauf sind je rund 25 px, erst der Klick zeigt das Bild. Pinterests einzige Gestaltungsregel zum Motiv heißt „front and centre“ [A]; unter den viralsten Pins sind 89 % Einzelbilder [B]. Die erste eigene Zahl (SF Masterworks 22 Impressions, 0 Saves) widerspricht dem nicht, beweist aber auch nichts.
- **Die Annahme im Plan ist unbelegt.** PLAN-5.5-5.6 §7 sagt, Pinterest „belohnt Sammlungen und Vergleiche, nicht Einzelstücke“. Dafür fand die Recherche keinen Beleg — für das Gegenteil (Montagen würden bestraft) auch keinen. Es ist eine Frage, die nur ein Test mit beiden Linien beantwortet (§5).
- **Tempo.** Zwei Pins am Tag ergeben bis zum 26.12. höchstens rund 106 Pins. Das reicht für die Schwelle, nicht für eine Einzel-Cover-Linie, die auf Pinterest in Hunderten zählt. Der Planer hält höchstens 10 geplante Pins zugleich und 30 Tage voraus [A], also wöchentliches Nachlegen von Hand, je Pin 2–3 Minuten in Julians Chrome.
- **Branding.** Die Wortmarke im Bild ist für die Verteilung nicht messbar wirksam; sie ist der Rückweg für ein Bild, das jemand ohne Link speichert (so begründet in `app/pin.tsx`). Für ein Einzel-Cover braucht es sie nicht: das Cover ist das Bild, der Link ist die Marke, die Quellenangabe steht in der Beschreibung (Weg a).

## 3. Die Werkzeuge

| Werkzeug | Was es tut | Stand und Grenze |
|---|---|---|
| `/book/<id>/pin.jpg`, `/collections/<slug>/pin.jpg`, `/book/<id>/compare.jpg?covers=` (`app/pin.tsx`, `app/comparepin.tsx`, `lib/pinlayout.ts`, `lib/comparelayout.ts`, `lib/comparepin.ts`) | die drei Pin-Bilder, 1000 × 1500, Mosaik-Grund, nie Google | 4–20 s je Bild warm, kalte Sammlungen 55–67 s auf dem Dev-Server bei 30 s Funktionszeit (Übergabe Punkt 4); Vergleichs-Pins erst nach Julians Cover-Wahl, sieben von zehn trugen ein falsches Jahr |
| `lib/pins.ts`, `scripts/pin-list.ts` | Titel ≤ 100, Beschreibung ≤ 500 Zeichen, keine Vollständigkeitswörter, `?via=pinterest` | braucht Open Library (sperrt nach Serien); `decadePin` schreibt noch die alte Form (Übergabe Punkt 7) |
| `docs/pins/queue.json` + Cockpit „Pins“ (`scripts/cockpit/pins.ts`) | die eine Liste; Julians Ja/Nein/Offen; Bilder vom Server; ein geplanter Pin ist gesperrt | kein Feld für die Art des Pins (Wand, Jahrzehnte, Vergleich, Cover) und keins für Alt-Text |
| `scripts/measure-pins.ts` | Pixel-Probe der Bilder gegen den Dev-Server (N14) | nur Montagen; weiß nichts von Einzel-Covern |
| Einplanen über Claude in Chrome (umgang §15) | Pin anlegen, Felder prüfen, „Publish at a later date“ | 2–3 Minuten je Pin; 10 geplante zugleich; Bild eines geplanten Pins nicht änderbar [A] |
| Messung | `analytics.pinterest.com/overview/` (per `get_page_text`), `/pin/<id>/analytics` je Pin; K16 über `/api/insights?days=30` mit Bearer | beide heute gelesen, Werte in §1 |
| Teilen-Menü der Seite (`components/ShareMenu.tsx`) | „Pinterest“ baut einen Merken-Link mit dem L-Cover und der Buchadresse | der Weg, auf dem **Leser** Einzel-Cover pinnen; ob daraus Rich Pins werden, ist ungeprüft (Übergabe Punkt 8) |
| `lab/mosaic/` | Autorenporträt aus Covern, auch 1000 × 1500 | Hingucker, kein Format für eine Reihe |
| `lab/kalender/` | 13 Pinterest-Einträge vom Oktober | überholt durch die Warteschlange; der Kalender ist kein Pinterest-Werkzeug mehr |

**Was fehlt:** ein Weg für Einzel-Cover-Pins. Das Bild wäre das Cover selbst (2:3 von Natur aus). **Gemessen am 2026-11-04:** Open Librarys „L“, das die Seite zeigt, ist auf 500 px an der langen Seite gedeckelt (*Dune*: 258 × 400 bis 372 × 500), das **Original ohne Größenkürzel** (`covers.openlibrary.org/b/id/<id>.jpg`) kann ein 2634 × 4313-Scan sein — oder dasselbe kleine Bild; Pinterest empfiehlt 1000 × 1500 [A], ein Scan mit 300 px wird weich. Der Index (`data/cover-index.json`, 35.351 Signaturen) hält keine Maße, ein Skript muss die Breite messen. Alt-Text gibt es im Pinterest-Formular unter „More options“ [V], in unserer Liste nicht. → Gebaut am 2026-11-04, §8.

## 4. Was die Recherche ergab

### Q1 Dichte Sammelbilder gegen ein Motiv

**Befund.** Pinterest sagt offiziell nichts zu Collagen oder zur Zahl der Motive. Die Vorgaben: 2:3 (1000 × 1500), das Produkt „front and centre“, Text oben, Bild Mitte, Einzelheiten unten, Logo sichtbar, aber nicht dominant; andere Seitenverhältnisse „may negatively impact performance“. Eine aktuelle Maximalhöhe: nicht gefunden. Die größte Messung (Tailwind, 1,2 Mio. Pins, 2024): 89 % der viralsten Pins sind Einzelbild-Pins, Video 8 %, Pinterests eigener Collage-Pin-Typ 2 % — **zu dichten Montagen als JPEG gibt es keine Messung.** Älter (Curalate 2013): mehrere dominante Farben 3,25 × mehr Repins, ohne Gesichter +23 %. Zum Text im Bild kein offizieller Wert; die „20-%-Regel“ aus Blogs ist unbelegt.

- [A] business.pinterest.com/creative-best-practices (abgerufen 2026-11-03): „We recommend using a 2:3 aspect ratio, or 1000 x 1500 pixels“; größere Verhältnisse können im Feed abgeschnitten werden.
- [A] community.pinterest.biz/t/the-best-pin-formats-and-practices-for-product-sellers/1319: „Other ratios may cause your Pin to truncate or may negatively impact performance.“
- [B] Tailwind Benchmark Teil 2, 2024-12-09, 17.000 Konten: „89% of the most viral Pins were Image Pins“, „collages at 2%“; 87 der 100 häufigsten dominanten Farben weiß bis hellgrau. tailwindapp.com/pinterest-marketing/research/2025-benchmark-study-part-2 (Anbieterstudie).
- [B, älter] Curalate 2013 über searchenginewatch.com (2013-06-04) und mediapost.com.

**Für die Seite:** Wand-Pins sind weder verboten noch nachweislich bestraft, aber nichts spricht dafür, dass sie als Format gewinnen. 2:3 nicht verlassen; die Wand als Zweitformat führen und gegen die eigenen Zahlen messen.

### Q2 Viele Einzel-Cover-Pins, viele Boards, wenig Branding

**Befund.** (1) Zu Verlags- und Archivkonten (Penguin, Faber, Book Cover Archive, Casual Optimist, Cover Junkie) keine Zahlen: ohne Login nicht lesbar; Book Riot nannte 2015 ein Cover-Konto mit über 100.000 Pins. (2) **Spam:** Pinterest nennt keine Zahl zu Pins je Tag, Domain-Anteil oder Duplikaten; verboten sind „repetitive, deceptive, or irrelevant“ Inhalte „in an attempt to make money“, nicht genehmigte Automatisierung und Links, deren Ziel niemand vorhersehen kann [A]. Tailwind maß: **neues Bild + gleiche Adresse behält 64 % der Verteilung** noch beim 11.–25. Pin derselben Adresse, gleiches Bild + gleiche Adresse 11 %, **neues Bild + neue Adresse ist die beste Klasse** — genau das, was ein Pin je Cover-Seite wäre [B]. (3) **Visuelle Suche:** Pinterest Engineering beschreibt Lens als Mischung aus Bildmerkmalen (Objekte, Farben, Licht, Qualität) und Annotationen; ob Text im Bild in „visually similar“ schadet: nicht gefunden. Gemessen ist der **Alt-Text: +25 % Impressions, +123 % ausgehende Klicks** [B, Text und Grafik des Berichts widersprechen sich], und Suchwörter im Titel. (4) **Urheberrecht:** kein dokumentierter Takedown-Fall gegen Cover-Boards gefunden; Pinterest entfernt mechanisch bei vollständiger DMCA-Meldung.

- [A] policy.pinterest.com/en/community-guidelines (Stand Mai 2026, neue Fassung ab 2026-11-12): kein Abschnitt zu Duplikaten, keine Zahl.
- [B] Tailwind Benchmark Teil 3, 2025-03-27: „Pins pointing to the same URL but using new images maintained 64% of their original distribution“; „~20% of the Pins still hadn't received any distribution“ nach einer Woche. tailwindapp.com/pinterest-marketing/research/2025-benchmark-study-part-three; Definition tailwindapp.com/blog/fresh-pin-definition-2025.
- [B] Tailwind Teil 2: Alt-Text; „~80% of the most viral Pins included one or more target keywords in the title“; Beschreibungen im Mittel 220–232 Zeichen; Hashtags nur in 19 %.
- [A, älter] Pinterest Engineering, „Building Pinterest Lens“, medium.com/@Pinterest_Engineering/59812d8cbfbc.
- [C] community.pinterest.biz/t/how-to-avoid-spam/41069 (2025-12-10): eine Zieladresse für alle Pins „can start to look repetitive“.
- Urheberrecht: redpoints.com zum DMCA-Ablauf; [älter] UCL Copyright Blog 2018-02; [älter] travelinlibrarian.info 2015-12.

**Für die Seite:** „Ein Cover = ein Pin = eigene Adresse“ verstößt gegen keine Regel, solange kein Skript ohne Wahl pinnt und kein identisches Bild zweimal; es ist die beste gemessene Verteilungsklasse. Was zählt, sind Suchwort im Titel und Alt-Text, nicht die Wortmarke im Bild. Rechtlich bleibt es Weg (a): fremde Werke mit Quellenangabe, kein Freibrief, aber kein dokumentiertes Takedown-Muster.

### Q3 Weitere Pin-Typen

**Befund.** Suchmaschinentreffer auf pinterest.com zu „vintage book covers“ und „penguin covers“ zeigen als Muster **Nutzer-Boards mit Hunderten Einzel-Covern** („470 Vintage Book Covers ideas“, „630 book covers 1890's“, „160 Penguin – old covers ideas in 2026“) und **einzelne Cover-Pins mit Jahr** („Penguin Book Covers (1935)“), daneben Listicle-Pins aus Blogs („20 inspirational Penguin book cover designs“). „Before/after redesign“ nur als Verweis auf eine NYT-Slideshow; „same book, 10 countries“: nicht gefunden; Infografiken und Shop-Pins fehlen in den Treffern. Saisonale Boards nicht geprüft. Alles Snippet-Niveau [C], ohne Reichweitenzahlen. (pinterest.com/leojam82/vintage-book-covers/, au.pinterest.com/beautoldbooks/book-covers-1890s/, uk.pinterest.com/bonzojones/penguin-old-covers/)

**Für die Seite:** das einzelne markante Cover mit Jahr ist das Format, das in diesem Umfeld schon dominiert; Länder- und Gestalter-Raster wären ein Alleinstellungsmerkmal ohne Nachfragebeleg — als Test, nicht als Hauptlinie.

### Q4 Produktstand 2026

Idea Pins sind seit Mai 2023 im normalen Pin aufgegangen [A, community.pinterest.biz/topic/59473]. Planer: bis 30 Tage voraus, höchstens 10 geplante Pins zugleich, Bild nachträglich nicht änderbar [A, help.pinterest.com/business/article/schedule-pins]. „Monthly views“ gibt es weiter [A, Community-Threads 2025/26]. API: Standard-Zugang braucht Entwicklerrichtlinien, Datenschutzerklärung und ein Video der OAuth-Integration [A, developers.pinterest.com/docs/key-concepts/access-tiers/]. **Der Agent schloss, ein Probezugang (Trial) reiche zum Pinnen — das übernehme ich nicht:** die Recherche vom 2026-10-17 las auf derselben Seite, dass Pins mit Trial-Zugang nur Sandbox-Einträge sind, die niemand sieht ([reichweite-recherche §F](reichweite-recherche-2026-10-17.md)). Ein Skript braucht Standard-Zugang, und es dürfte nur Pins setzen, die Julian gewählt hat.

**Offen / nicht gefunden:** offizielle Zahlen zu Pins je Tag und Duplikaten; Maximalhöhe; Text-Overlay in der visuellen Suche; Zahlen der Verlags- und Archivkonten; dokumentierte DMCA-Fälle gegen Cover-Reposts; Messdaten zu Montagen; Rich-Pin-Status; saisonale Boards.

## 5. Antwort auf die zwei Fragen

### 5.1 Große Bilder von Sammlungen, wie auf Reddit — nein, nicht als Wachstumsformat

Auf Reddit trägt ein Regalfoto, weil es in einem Gemeinschafts-Feed steht, hochgewählt wird und von Stolz erzählt (r/bookshelf, r/VintagePaperbacks: Hauls, Sammlungen, „my shelf“). Auf Pinterest wird ein Pin über die Suche und über ähnliche Bilder gefunden und als **eine** Idee auf ein Board gespeichert; eine Wand aus 75 Covern ist in der Spalte Textur und als Idee unteilbar. Die Belege (§4 Q1: „front and centre“, 89 % Einzelbilder) und die erste eigene Zahl zeigen in dieselbe Richtung. Das Pinterest-Genre „bookshelf“ und „home library“ sind Fotos von Räumen — eine gerenderte Wand steht dort nicht im Wettbewerb [V, nicht gemessen].

**Daher:** je Sammlung **ein** Wand-Pin als Gesicht ihres Boards, danach keine weiteren; das Jahrzehnte-Raster (9) und der Vergleich (3) bleiben als lesbare Montagen; die Porträts aus `lab/mosaic` als gelegentlicher Hingucker, keine Reihe.

### 5.2 Mehr Boards mit vielen einzelnen Titeln, wenig Branding, Link aufs Cover — ja, als Testlinie

So, dass es regelkonform bleibt und messbar wird:

1. **Jeder Pin von Hand gewählt** (Julians Ja), kein identisches Bild zweimal, je Pin neues Bild und neue Adresse — die beste gemessene Verteilungsklasse (§4 Q2).
2. **Cover, die Pinterest noch nicht hat:** alte Drucke, fremdsprachige Ausgaben, seltene Scans. Das aktuelle Penguin-Cover liegt dort tausendfach, unseres wäre eines mehr; ein Scan einer 1962er-Ausgabe ist von Natur aus „frisch“. Ob Pinterest identische Bilder über Konten hinweg zusammenlegt, ist nicht dokumentiert [V] — Tailwinds Messung gilt innerhalb eines Kontos.
3. **Nur Cover mit ≥ 500 px Breite**, vor dem Pinnen gemessen, nie hochgerechnet — gemessen am Original bei Open Library, nicht an der L-Fassung der Seite (§3).
4. **Text:** Titel mit Buch, Autor, Verlag, Jahr und einem Suchwort („… 1965 paperback cover“); Beschreibung mit Quellenangabe (Weg a) und dem, was der Link zeigt; **Alt-Text** gefüllt; Link `/book/<id>?cover=<coverId>&via=pinterest`, also auf genau dieses Cover (die Adresse ist die Quelle der Wahrheit für das gewählte Cover, CLAUDE.md).
5. **Boards mit Suchnamen:** die fünf aus der Warteschlange (Science fiction book covers, Classic book covers, Vintage paperback covers, Book cover design, Fantasy book covers), dazu etwa „1960s paperback covers“, „Penguin Classics covers“, „German book covers“; ein Board erst beurteilen, wenn es 20 Pins hat.
6. **Wenig Branding:** das Cover allein, keine Wortmarke, kein Rahmen. Den Rückweg ohne Link leisten Beschreibung und Boardname.
7. **Tempo:** zusätzlich zu den zwei Montagen drei Einzel-Cover am Tag, also fünf. Die Grenze ist nicht das Material, sondern Julians Ja und 2–3 Minuten Chrome je Pin; bei 10 geplanten zugleich heißt das Nachlegen alle zwei Tage. Trägt die Linie, ist der einzige genehmigte Weg darüber hinaus die API mit Standard-Zugang (Antrag mit Video) und ein Skript, das **nur** Pins mit `ja` setzt — Pinterests „the end user must choose each Pin“ erfüllt das Cockpit. Entscheidung für später.
8. **Messung:** je Linie in Pinterests Statistik (Impressions, Saves, ausgehende Klicks **je Pin**), gesamt K16. Vergleich am **1.12.2026** (vier Wochen): Saves und Klicks je Pin, Montagen gegen Einzel-Cover. Die Schwelle vom 26.12. bleibt.

## 6. Weitere Formate, kurz beurteilt

| Format | Beleg | Urteil |
|---|---|---|
| Einzelnes markantes Cover mit Jahr | dominiert das Umfeld (§4 Q3) | die Testlinie aus §5.2 |
| Vergleich, drei Ausgaben | gebaut; im Feed lesbar | behalten, nach Julians Cover-Wahl |
| Jahrzehnte-Raster, neun Cover | gebaut; lesbar | behalten; ein Pin je Werk |
| Wand, 75 Cover | kein Beleg dafür; Textur im Feed | je Sammlung einer, als Gesicht des Boards |
| „Same book, 10 countries“ | nicht gefunden | ein Testpin aus der internationalen Sammlung, nicht mehr |
| Gestalter-Reihe (eine Gestalterin, zehn Cover) | Boards nach Gestaltern gibt es | als Board der Einzel-Cover-Linie, kein eigenes Bild |
| Before/after Redesign | nur eine NYT-Slideshow als Treffer | lassen |
| Saisonale Boards (Halloween-Paperbacks) | nicht geprüft | dieses Jahr zu spät; Notiz für Oktober 2027 |
| Listicle-Pin („20 covers of …“) | kommt aus Blogs vor | ist wieder eine Wand; lassen |
| Autorenporträt-Mosaik | `lab/mosaic`, funktioniert | gelegentlich, als Hingucker |

## 7. Entscheidungen, alle Julians — eine Zeile je Punkt

1. **Einzel-Cover-Testlinie** nach §5.2: ja/nein; wenn ja, welche Boards zuerst und welches Tempo (Vorschlag: die fünf vorhandenen Namen plus drei, drei Pins am Tag zusätzlich).
2. **Wand-Pins** nur noch einer je Sammlung: einverstanden?
3. **Die fünf geplanten Jahrzehnte-Pins mit altem Text und altem Bild** (A Game of Thrones geht am 4.11. um 12:00 heraus): lassen, Text im Pin ändern (geht ohne Löschen, umgang §15), oder löschen und neu mit Mosaik-Grund (dein Klick)?
4. **Harry Potter:** hast du den Pin gelöscht? Sonst neu anlegen.
5. **Alt-Text** als Feld in Warteschlange und Cockpit: ja?
6. **Messpunkt 1.12.** für den Vergleich der Linien: einverstanden?

## 8. Was dafür zu bauen wäre (Claude, etwa ein Tag, nur bei Ja zu 1)

**Gebaut am 2026-11-04** (Julian: „Ja, bauen“), in drei Stunden statt einem Tag: `lib/coverpins.ts` (Auswahl, rein, mit Tests), `coverPin` in `lib/pins.ts` (Wortlaut, Alt-Text, Link aufs Cover), `scripts/pin-covers.ts` (Open Library, Originale messen, Entwürfe schreiben), Felder `kind` und `alt` in Warteschlange, Cockpit-Ansicht und Prüfungen. Zwei Dinge wusste der Plan falsch: Open Librarys L ist auf 500 px gedeckelt, das Bild muss das Original sein (§3); und die Faltung der Seite darf die Fakten eines Scans nicht liefern (umgang §1). Zahlen des ersten Laufs in der Historie. Was unten steht, ist der Plan, wie er vor dem Bau war.

- `scripts/pin-covers.ts`: wählt je Board Kandidaten aus Index und Jahrzehnte-Seiten (Jahr bis 1990 oder nicht englisch, Breite ≥ 500 px gemessen, keine Innenseite), schreibt Entwürfe in `docs/pins/queue.json` mit `kind: 'cover'`, Bild `/img/L/<id>`, Titel, Beschreibung, Alt-Text nach Vorlage, Link auf das Cover; nie Google.
- `queue.json` und Cockpit „Pins“: Feld `kind` (wall, decades, compare, cover) zum Filtern und für den Vergleich am 1.12., Feld `alt`.
- Einplanen wie bisher über Julians Chrome, Alt-Text unter „More options“.
- **Analytik-Checkliste:** `via=pinterest` ist eine bestehende Klasse (K16); nichts Neues wird gespeichert oder gesendet; die Bilder kommen aus der bestehenden `/img/`-Route, die nichts zählt; kein neuer Shop-Link, kein bezahlter Aufruf. Nur die Beschreibung je Pin wird neu geschrieben.
