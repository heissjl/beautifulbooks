# PLAN 5.11a — Das Regalfoto: zuverlässig, sichtbar, ohne Token zu fressen

Stand 2026-09-30, abends: **Schritte 1–3 gebaut** (Julian: „ok, starte hiermit“), Messung unten unter „Gebaut und gemessen“; Schritt 4 wartet auf Julians Umschlagfoto, Schritt 5 (B2) oder die Kantensuche auf eine Entscheidung. Geschrieben für eine Sitzung, die den Code nicht kennt. Roadmap **5.11a**; der Code ist `lib/recognize.ts` (Modell), `lib/walls/photo.ts` (Zuordnung), `app/api/walls/photo/route.ts` (ein POST) und `components/WallPhoto.tsx` (Foto, Kästen, Vorschlag).

## Anlass

Julian, 2026-09-30, nach zwei Fotos gegen die Produktion („i used these two photos to stress-test the add by photo function“): eine Galerie-Bücherwand (drei Fächer, drei Böden, rund neunzig Rücken, unten flach liegende Umschläge) und ein Brett mit 22 Romanen. Fünf Punkte:

1. Für das kleine Brett kamen **keine Ergebnisse** zurück.
2. Die **Kästen** über dem Foto sitzen nicht an der richtigen Stelle.
3. **Rücken und Umschlag** müssen unterschieden werden; bei einem Umschlag zählt **die abgebildete Ausgabe**.
4. Es braucht einen **Fortschritt**: Ladebild, Balken, oder die Kästen erscheinen Rücken für Rücken, während gelesen wird.
5. Den **Algorithmus neu bewerten**: zuverlässig, ohne Token zu fressen.

Die Fotos liegen lokal unter `docs/tests/2026-09-30-regalfoto-*.jpg` (git-ignoriert, Regel vom 2026-09-11), die Kästen darauf gezeichnet als `…-kaesten.png`.

## Gemessen (2026-09-30, lokal gegen `npm run dev` mit dem Schlüssel des Hauptordners; Fotos wie im Browser auf 1600 px lange Kante verkleinert)

| | Foto 1 Galeriewand (1200 × 1600) | Foto 2 ein Brett (1600 × 1200) |
|---|---|---|
| `claude-sonnet-5`, wie gebaut (effort high, JSON-Schema) | 26,6 s · 3.137 / 3.751 Token · **58 Bücher** gelesen | 10,7–12,4 s (drei Läufe) · 3.137 / 1.305–1.383 Token · **19–20 von 22** |
| Die Route als Ganzes | **61 s** · 50 gelesen, **auf 40 gekappt** (`MAX_PHOTO_BOOKS`) · 21 „gefunden“ | **21,7 s** · 20 gelesen · 19 gefunden |
| Richtig | Alle 21 nur über den Titel (`title-only`); **mindestens fünf falsch**: *Sub Rosa* → Amber Dawn, *Mousquetaires* → Dumas, *The Virgin* → *The Virgin Suicides*, *Crossing Over* → John Edward, *Sites Unseen* → Dianne Harris | **0 falsch**; *The Joke* und *Laughable Loves* landen auf den tschechischen Datensätzen (*Žert*, *Směšné lásky* — der Punkt 1 des Lab-READMEs); der violette *Collected Novellas* wird nie gelesen, einmal als *The Sheltering Sky* (0,40), einmal als *One Hundred Years of Solitude* (0,55) erfunden |
| `claude-haiku-4-5` | 4,7 s · 1.770 / 603 · 9 „Bücher“, 4 echt | 8,1 s · 1.770 / 1.230 · 18 „Bücher“, **~3 echt**, der Rest erfunden (*Dan Brown*, *Twilight*, *The Pillars of the Earth*) — **unbrauchbar** |
| `claude-sonnet-5`, effort low, ohne Schema | — | 9,8 s · 2.747 / 1.288 · 19 Bücher, zwei ohne Autor — fast gleich gut; das Schema kostet rund 400 Eingabetoken |

**Kosten:** bei 3 $ / 15 $ je Million Token kostet Foto 1 rund **6,6 ct**, Foto 2 rund **3 ct**. Token frisst das nicht. **Die Zeit frisst Open Library:** die 40 Suchen laufen nacheinander (`matchPhotoBooks`), rund 35 der 61 Sekunden; das Modell braucht 11–27.

**Kästen** (`…-kaesten.png`): auf Foto 2 stimmt die **x-Lage** der ersten zwölf Rücken, dann driftet sie nach links und bündelt sich; die **Höhe** läuft bis ins Brett (Bücher enden bei 0,77 der Höhe, die Kästen bei 0,86). Auf Foto 1 sind sie unbrauchbar: Höhen 0,33–0,40 für Rücken, die 0,20 messen; Bücher der mittleren Reihe im oberen Boden; die flach liegenden Umschläge unten als Streifen am Rand. Drei Läufe desselben Fotos verschieben die Kästen um bis zu 0,05 in x und 0,06 in y. **Das CSS ist nicht schuld:** die Hülle der Kästen (`inline-block max-w-full`) misst in Chrome 336 × 448 px bei einem Bild von 336 × 448 (Foto 1) und 597 × 448 bei 597 × 448 (Foto 2) — Rahmen und Bild sind pixelgleich. Die Zahlen kommen vom Modell, und Modelle dieser Art geben auf einem dichten Regal keine Kästen, die eine Kante treffen.

**„Keine Ergebnisse“ in Produktion:** `vercel logs` zeigt drei `POST /api/walls/photo` mit 200 (22:51:36, 22:53:45, 22:53:57), ohne Dauer, ohne Inhalt — die Route schreibt keine Zeile. Lokal nicht reproduzierbar: drei von drei Läufen lesen 19–20 der 22 Bücher, die Route findet 19. Zwei der Anfragen liegen zwölf Sekunden auseinander; ob die erste leer war, ein Fehler oder zweimal gedrückt, sagt nichts. Darum Punkt E unten.

**Rücken oder Umschlag:** das Modell unterscheidet (`kind`); auf Foto 1 sind die drei flach liegenden Bücher `cover`. Was fehlt, ist der nächste Schritt: die **Ausgabe** suchen. Im Lab gibt es ihn (`lab/shelf/match.ts`: Ausschnitt → Signatur wie `lib/imagehash.ts` → gegen die Cover der Seite 0 des Werks, Hamming ≤ 14, Farbe ≤ 0,52), auf der Seite nicht, und die Schwelle ist an keinem echten Foto gemessen.

## Befund, je Punkt ein Satz

1. **Keine Ergebnisse:** Ursache unbekannt, weil die Route nichts loggt — das ist der Fehler.
2. **Kästen:** die Koordinaten des Modells, nicht die Darstellung; in **einer** Reihe stimmt x, y und Höhe stimmen nie.
3. **Rücken/Umschlag:** unterschieden, aber die Ausgabe wird nicht gesucht.
4. **Fortschritt:** ein Request, der alles tut, und 61 Sekunden Stille.
5. **Algorithmus:** das Modell ist richtig gewählt (Haiku liest Phantasie, Sonnet liest 19–20 von 22) und billig; Zeit und Fehler liegen in der Suche nacheinander und in der Vorauswahl, die Titel-Treffer ohne Autor vorhakt.

## Vorschlag

**A. Zwei Phasen, ein Strom.** (Julian, 2026-09-30: „berücksichtigst du das?“ — ja, und seit dieser Rückfrage auch das Modell selbst: seine Antwort wird gestreamt, die Reihen stehen in ihr zuerst, und jedes Buch ist ein abgeschlossenes JSON-Objekt, das die Route weiterreicht, sobald es eintrifft — der Marker erscheint also **Rücken für Rücken, während gelesen wird**, nicht erst nach der ganzen Antwort; davor eine Statuszeile ab der ersten Sekunde.) Die Route antwortet als NDJSON-Strom (`ReadableStream`, kein Edge nötig): zuerst, während der 10–25 s des Modells, je gelesenem Buch eine Zeile `{"read": …}` — der Browser setzt sofort die Marker aufs Foto, grau, und schreibt „n books read, looking them up…“; dann je Buch eine Zeile `{"i": k, "tile": …}` oder `{"i": k, "failed": true}`, sobald **seine** Suche antwortet, **drei Suchen parallel** statt nacheinander — der Marker wird farbig, der Vorschlag wächst. `WallPhoto` liest den Strom mit `fetch` und `getReader()`; der Zustand bekommt `reading` → `looking-up` (mit k von n) → `read`. Das deckt Punkt 4 und drückt Foto 1 von 61 s auf rund 25 + 12. Die Grenze `MAX_PHOTO_BOOKS` steigt von 40 auf 80: Foto 1 liest 50–58, die Wand nimmt 500.

**B. Reihen statt Kästen.** (Julian, 2026-09-30: „erkläre das noch genauer bevor wir starten“.) Heute gibt das Modell je Buch vier Zahlen — links, oben, Breite, Höhe —, auf der Galeriewand 232 Schätzungen ohne Maßstab; gemessen kann es oben und Höhe je Buch nicht, und die Reihen verwechselt es. Brauchbar waren zwei Dinge: die **Leserichtung** (welches Buch neben welchem steht) und auf einem Brett die **waagrechte Lage** der ersten zwölf Rücken, danach driftet sie, weil das Modell eher zählt als misst und der Fehler sich nach rechts aufsummiert. Der Prompt fragt darum nur noch, was es kann:

- je **Boden** einmal `y0`, `y1` — sechs Zahlen für drei Böden statt 232, und Regalbretter sind die stärksten waagrechten Kanten im Bild;
- je **Buch** den Boden (`row`) und **die Mitte des Rückens** als eine Zahl in der Breite (`x`); keine Breite, keine Höhe;
- die **Streifen baut der Server** (`lib/walls/photo.ts`, rein, getestet): die Grenze zwischen zwei Nachbarn liegt in der Mitte zwischen ihren Mitten, nichts überlappt, die Reihenfolge der Lesung bleibt die im Bild; sind die Mitten eines Bodens nicht aufsteigend, wird der Boden **gleichmäßig** unter seinen Büchern geteilt (auf dem Brett mit 22 fast gleich breiten Rücken käme das allein schon nah hin);
- ein **Umschlag** (`kind: cover`) wird nicht als Streifen gezeichnet, sondern als Rechteck in seinem Boden, in eigener Farbe und mit dem Wort „cover“ — heute sieht der Kasten für beide gleich aus (Julian, 2026-09-30: „bei der segmentation anzeige im bild wird diese unterscheidung noch nicht gemacht“); später steht daran, ob die Ausgabe erkannt wurde (D).

**Messung:** die Streifen auf beide Fotos gezeichnet; je Foto gezählt, wie viele Streifen den Rücken treffen, dessen Titel sie tragen. **Schwelle:** neun von zehn auf dem Brett, sieben von zehn auf der Galeriewand; darunter B2.

**B2, je Boden ein Aufruf.** Ein erster kleiner Aufruf holt nur die Böden (wenige Zahlen, effort low). Der Server schneidet jeden Boden als eigenes JPEG aus dem Foto (jpeg-js kann dekodieren und kodieren, `lib/imagehash.ts` nutzt es schon) und fragt die Böden **parallel** ab. Gewinne: ein Boden hat zwanzig statt sechzig Bücher, also weniger Drift; die Reihe kann nicht verwechselt werden; die Aufrufe laufen nebeneinander. Der wichtigste Gewinn braucht eine Änderung im Browser: heute verkleinert er auf 1600 px lange Kante, und das Modell rechnet ein Bild ohnehin auf rund 1,15 Megapixel herunter — schickt der Browser **2400 px**, hat jeder Boden-Ausschnitt etwa doppelt so viele Pixel je Buchstabe wie heute, bei gleichen Bildtoken je Aufruf. Kosten: rund 4.500 statt 3.100 Eingabetoken je Foto, etwa ein Cent mehr; `MAX_BYTES` der Route von 6 auf 10 MB.

**Was beides nicht löst:** ein Modell dieser Art bleibt eine Schätzung ohne Lineal. Der Streifen zeigt, welches Buch gemeint ist, er ist keine Kante — darum schmal und nummeriert, kein Rahmen, der Genauigkeit verspricht. Genaue Kanten gäbe nur klassische Bildverarbeitung (senkrechte Rückenstöße, ohne Token) — ein eigenes Lab-Experiment, erst wenn die Streifen die Schwelle verfehlen.

**C. Ehrlichere Vorauswahl.** Ein Treffer `title-only` ohne gelesenen Autor ist ein Rateversuch (fünf von 21 auf Foto 1 nachweislich falsch, vermutlich mehr): er wird **nicht vorgehakt** und heißt „maybe: *Titel* by *Autor*?“ mit „search instead“ daneben (`onSearchFor` gibt es). `author+title` und `author` bleiben vorgehakt. Dazu der Satz, der auf Foto 1 fehlt: Kunstkataloge und Galeriebände stehen kaum in Open Library — „n of m are not in the catalogue“ statt nur „not found“ je Zeile.

**D. Umschlag → Ausgabe.** Für `kind: cover` wird der Ausschnitt (aus B) signiert und gegen die Cover der Seite 0 des Werks verglichen — der Lab-Code wandert nach `lib/walls/`, `getWorkPage` mit `googleBooks: false`, **kein Google**. Die Schwelle wird an einem echten Umschlagfoto gemessen (Julian: sechs bis zehn Bücher flach, Umschlag nach oben). Kein naher Treffer → die Kachel bekommt das Standardcover und den Hinweis „which cover? pick it“, der das Tausch-Fenster des Editors öffnet (seit 5.13m da). Google-Cover im Vergleich nur, wenn die Seite sie ohnehin hat.

**E. Eine Logzeile je Foto** wie bei den Klicks (`lib/clicks.ts`): gelesen, gefunden, nicht gefunden, nicht geantwortet, ms Modell, ms Suche, Token, Modell. **Nichts vom Bild, nichts vom Leser.** Beim nächsten „keine Ergebnisse“ sagt das Log innerhalb der Stunde, was war.

**F. Modell:** `claude-sonnet-5` bleibt; `effort` von high auf **medium** und das JSON-Schema bleibt (es hat in sechs Läufen nie versagt); Haiku kommt nicht in Frage (gemessen).

## Kosten (Julian, 2026-09-30: „das finde ich teuer, können wir hier nicht ein zweistufiges modell nehmen oder spezialisierter algorithmen, statt alles an sonnet zu schicken?“)

Die 7 ct der Galeriewand sind fast ganz **Ausgabe** (Preisliste wie oben angenommen, 3 $ / 15 $ je Million): Bild und Prompt 3.137 Token = 0,9 ct, die JSON-Antwort 3.751 Token = 5,6 ct; das Brett 0,9 + 2,0 ct. Je Buch schreibt das Modell rund 65 Token, mehr als die Hälfte davon der Kasten mit vier Dezimalzahlen, die Konfidenz und die langen Schlüssel. Mit B (Boden, Mitte als ganze Prozentzahl, kurze Schlüssel, keine Konfidenz) sind es 20–25 Token je Buch: **Galeriewand ≈ 2,3 ct, Brett ≈ 1 ct** — in Schritt 3 nachzumessen.

Zweistufig oder spezialisiert:

- **Haiku als erste Stufe:** nein. 3 von 22 auf dem Brett, das schon eine einzelne Reihe in voller Breite war; das Problem ist das Lesen gedrehter, gestalteter Schrift, nicht die Auflösung.
- **Klassische OCR** (Tesseract als WASM): scheitert an senkrechten Rücken in beiden Richtungen, Zierschriften und wenig Kontrast, und trennt Titel nicht von Autor; jede Zeile müsste trotzdem gesucht werden.
- **Google Cloud Vision, Texterkennung:** die ernsthafte zweite Stufe. 0,15 ct je Bild (1.000 je Monat frei), liest gedrehten Text gut und gibt **jedes Wort mit genauen Koordinaten** — daraus die Rückenstreifen exakt statt geschätzt (löst B gleich mit); das Modell bekommt nur Text (≈ 1 ct) oder gar nichts, wenn die Zeilen direkt in die Suche gehen. Preis: ein zweiter Anbieter sieht das Foto (Datenschutz-Absatz und Hinweis in `WallPhoto` ändern), ein zweiter Schlüssel, und das Gruppieren der Wörter zu einem Rücken ist Handarbeit (Titel und Autor in verschiedenen Schriften und Richtungen). **Erst als Lab-Messung an den zwei Fotos, ein halber Tag**, bevor es in diesen Plan kommt.
- **Eigene Segmentierung** (ein Erkennungsmodell für Rücken): braucht einen Rechner, der es ausführt; auf Vercel Hobby gibt es den nicht.

**Vorschlag:** die schlanke Antwort aus B zuerst (halbiert bis drittelt sofort); dazu eine **Tagesgrenze für Fotos** wie `lib/googlequota.ts` für Google, damit ein Abend mit vielen Fotos höchstens ein paar Euro kostet (Vorschlag 300 je Tag ≈ 3–7 €); Vision als Lab-Messung, wenn 1–2 ct je Foto noch zu viel sind oder die Streifen aus Schritt 3 die Schwelle verfehlen — es löst beides.

## Reihenfolge und Aufwand

| | Schritt | Deckt | Aufwand |
|---|---|---|---|
| 1 | E Logzeile + C Vorauswahl | 1, 5 | eine Stunde |
| 2 | A Strom, Suchen parallel, Grenze 80 | 4 | halber Tag |
| 3 | B Reihen statt Kästen, an beiden Fotos gemessen | 2 | halber Tag |
| 4 | D Umschlag → Ausgabe, an einem Umschlagfoto gemessen | 3 | ein Tag; braucht Julians Foto |
| 5 | B2 je Reihe ein Aufruf | 2 | halber Tag, nur nach schlechter Messung in 3 |

## Entscheidungen für Julian

1. Schritte 1–3 so bauen?
2. Ein Foto mit flach liegenden Umschlägen für Schritt 4.
3. Grenze 80 Bücher je Foto und 300 Fotos je Tag.
4. Google Cloud Vision als zweite Stufe im Lab messen — ja oder nein (zweiter Anbieter sieht das Foto).

## Gebaut und gemessen (2026-09-30, abends)

**Was steht:** `lib/recognize.ts` fragt Reihen und je Buch Reihe und Mitte, streamt die Antwort (`client.messages.stream`, `scanPartial` liest jedes geschlossene Objekt) und baut die Streifen (`placeBooks`: Nachbarn nach Mitte, nicht nach Reihenfolge; ohne Mitten gleichmäßig). `lib/walls/photo.ts`: `matchPhotoBook` mit `unsure` für Titel-Treffer, `matchPhotoBooksEach` mit drei Suchen zugleich, Grenze 80. Die Route streamt JSON-Zeilen (`book` je gelesenem Buch, `read` mit allen, `match` je Suche, `done`), zählt den Tag (`WallStore.countPhoto`, Hash `walls:photos`, 300) und schreibt `bb.photo`. `WallPhoto` liest den Strom, zeichnet Marker (grau beim Lesen, Akzent beim Finden, gestrichelt wenn nicht; „cover“ breiter), zeigt die Liste am Ende; `WallProposal` hakt „maybe“ nicht vor und bietet „search instead“. Tests: `lib/__tests__/recognize.test.ts` (Streifen, Teilantwort), `walls-photo.test.ts` (maybe, zu dritt, Grenze), `walls-store.test.ts` (Tageszähler), das Lab-Testfile auf das neue Format. 986 Tests grün, Build durch.

**Zeiten und Kosten** (lokal, `npm run dev`, Sonnet 5, effort high):

| | Brett | Galeriewand |
|---|---|---|
| erstes Buch im Strom | 4,4 s (im Browser 2,7 s nach dem Hochladen) | 2,7–2,9 s |
| alle Bücher gelesen | 8,8 s, 19 Bücher | 11,8–12,9 s, 38–41 Bücher (alter Prompt: 50–58) |
| Token, Kosten | 3.267 / 778–899 → **≈ 2,1 ct** (vorher 3) | 3.267 / 1.399–1.519 → **≈ 3,3 ct** (vorher 6,6) |
| Route gesamt | 16,3 s mit warmer Suche (vorher 21,7) | — |

effort medium: Brett gleich (19), Wand nur 25–27 Bücher für 982 Ausgabetoken — der Cent ist die Lesung nicht wert, es bleibt high. Der neue Prompt liest die Wand mit weniger Büchern als der alte (38–41 gegen 50–58, zwei Läufe je); die Reihen-Arbeit kostet Aufmerksamkeit. Das ist ein Argument für B2 (je Boden ein Aufruf, weniger je Antwort).

**Die Streifen** (`docs/tests/2026-09-30-regalfoto-2-streifen.png`, `…-1-streifen.png`): Reihen stimmen (Brett 0,25–0,95, Bücher stehen 0,32–0,77 — zu hoch, aber eine Reihe; Wand vier bis fünf Böden, fast auf der Kante). Die Mitten driften nach rechts: auf dem Brett treffen **6–8 von 19** Streifen ihren Rücken, die übrigen den Nachbarn, ab der Mitte zwei bis drei Rücken daneben. **Schwelle (9 von 10) verfehlt.** Zwei Versuche dagegen, beide lokal in Python:

1. **Ein Prozentraster ins Bild gezeichnet** (Linien alle 5 %, Zahlen alle 10 %, `…-streifen-raster.png`): die Lage wird nicht besser (ab dem dritten Buch um einen Rücken daneben, bis zu drei), und das Modell „liest“ an den Linien drei Titel, die nicht da sind (*Collected Stories*, *Play It As It Lays*, *Red Noses*). Verworfen.
2. **Kantensuche** (`…-kanten.png`): das **Buchband** in der Reihe des Modells findet die Spaltenvarianz sicher (0,35–0,75 statt 0,25–0,95), was allein schon die Streifenhöhe richtig machte; die **Rückenstöße** als lange senkrechte Kanten (Anteil der Zeilen mit Farbsprung > 40 je Spalte, Schwelle 0,45) finden auf dem Brett nur 10 von 22 — dunkle Rücken an dunklen Rücken bleiben unsichtbar, und mit lockerer Schwelle kommen Holzmaserung und Schrift dazu. Dann monotone Zuordnung (DP) der gelesenen Reihenfolge zu den Segmenten, Segmente dürfen übersprungen werden: bei gleicher Zahl wäre die Lage exakt, ganz ohne Mitte. **Nächstes im Lab (`lab/shelf/`):** Kantenmaß und Schwelle an beiden Fotos, Band aus der Varianz übernehmen (auch ohne Kanten ein Gewinn), dann entscheiden, ob es in den Server kommt (jpeg-js dekodiert dort schon).

**Die Oberfläche** (`…-strom-desktop.png`, `…-strom-phone.png`): 1280 px — Marker beim Lesen weiß, „Reading the photo… 10 books so far“, dann „20 books read, looking them up… 6 of 20“ mit den ersten Markern in Akzent, am Ende Streifen 19 (*A Valentine for Noel*) gestrichelt grau, Zeile „20 books read: 19 found with a cover, 1 not in the catalogue“. 390 px — kein Überlauf (scrollWidth 390), 21 Marker, die Leiste „You are adding to“ unten. Headless, mit `DOM.setFileInputFiles`.

**Produktion:** deployt am 2026-10-01 (Julian: „merge die commits in main“), zusammen mit allem, was unten folgt.

## Das „keine Ergebnisse“ — gelöst (2026-09-30, nachts)

Julian wiederholte den Versuch mit derselben Datei (ein JPEG vom Computer, am Desktop, in **LibreWolf**); die neue Logzeile sagte: 1.110.631 Bytes angekommen, Bild in voller Größe (3.267 Token), **0 Bücher, 20 Antworttoken**. Nachgestellt in einem headless LibreWolf über WebDriver BiDi mit demselben Canvas-Code wie `WallPhoto`: das Canvas liefert beim Auslesen (`toBlob`, `getImageData`) **ein blau-schwarzes Streifenmuster** statt des Fotos (`docs/tests/2026-09-30-regalfoto-librewolf-canvas.png`), 1.080.627 Bytes — der Fingerprinting-Schutz (`privacy.resistFingerprinting`), den LibreWolf, Firefox mit RFP und der Tor-Browser so einstellen. Genau dieses JPEG an das Modell geschickt: 0 Bücher, 20 Token, 3,3 s. Ein 8 × 8-Verlauf, gezeichnet und zurückgelesen, hat in LibreWolf 64 von 64 Pixeln falsch, in Chrome 0. HEIC war es nicht: das scheitert in Chrome schon beim Dekodieren („The source image could not be decoded“), jetzt mit eigenem Satz.

**Gebaut:** `canvasIsHonest()` im Browser (der Verlauf); ist das Canvas unehrlich, geht **das Original** (JPEG oder PNG bis 12 MB) hoch; `lib/photoprep.ts` auf dem Server dreht nach dem EXIF-Tag (eigener Parser, Tag 0x0112), verkleinert per Kastenmittel auf 1600 px und schreibt ein nacktes JPEG (Qualität 85) — **für jedes Foto**, also sieht das Modell nie EXIF und nie den GPS-Tag eines Telefons; `decode` in `lib/imagehash.ts` nimmt dafür 512 MB und 50 MP statt 64 MB und 20 MP. Die Logzeile trägt Bytes, gesendete Größe, Orientierung und ob verkleinert wurde. Gemessen: das Original mit 2000 × 1500 (380 KB) → 1600 × 1200, 20 Bücher; eine 12-Megapixel-Kopie (1,6 MB, 4032 × 3024) → erstes Buch nach 5,1 s, 19 Bücher nach 10,1 s; **in LibreWolf durchgespielt** (headless, `input.setFiles`): erstes Buch nach 2,5 s, 19 gelesen, 18 gefunden. Tests: `lib/__tests__/photoprep.test.ts` (Orientierung lesen, drehen, verkleinern, vorbereiten).

## Die Kästen sollen die Bücher zeigen (Julian, 2026-10-01)

Julian zu den Streifen: „i still want the overlay to be better portraying the books. they don't need to be parallel, they should just reflect the segmentation that had been used. is it a problem for it to be exact and show it exact?“ — und: „es gibt doch eine reihe von billigen segmentierungsalgorithmen? gar nicht mal llm-basiert“.

**Der Befund:** es gibt keine Segmentierung, die man zeigen könnte. Das Modell schneidet das Bild nirgends; es liest Schrift und schätzt je Buch eine Mitte, der Streifen zwischen den Nachbarn **ist** die ganze Einteilung. Genau zeigen heißt: erst segmentieren. Zwei weitere Heuristiken am Abend, beide lokal in Python (`docs/tests/2026-10-01-regalfoto-2-*.png`): (3) **lokale Kantensuche** um jede Mitte (stärkste senkrechte Farbkante links und rechts im Fenster ± halber Nachbarabstand): die Kästen sitzen jetzt auf echten Rückenkanten und sehen wie Bücher aus — aber ab Buch 6 auf dem **Nachbarn**, weil die Mitte des Modells um ein bis drei Rücken driftet; exakt und falsch ist schlechter als ehrlich ungenau. (4) **Umskalieren** der Mitten auf die gemessene Breite der Reihe (erste und letzte Mitte je einen halben Rücken innerhalb der Spannweite, die Drift ist eine Streckung um rund 7 %): rechnerisch landet damit fast jede Mitte auf ihrem Rücken — aber die Spannweite aus der Spaltenvarianz nahm die Seitenwand des Regals mit (0,004 statt 0,084), und alles rutschte nach links. Handgebaute Heuristiken scheitern an genau solchen Rändern; dafür gibt es gelernte Segmentierer.

**Der richtige Weg, ohne LLM:** ein **punktgesteuerter Segmentierer** — MobileSAM, EfficientSAM oder SlimSAM als ONNX — mit den Mitten, die das Modell ohnehin liefert, als Punktaufforderung: je Punkt eine Maske, also die wirkliche Umrisslinie des Rückens, auch schräg stehend („they don't need to be parallel“). Keine Token; Rechenzeit auf dem Server rund 1–3 s je Foto für den Encoder (ViT-tiny, CPU) plus wenige Millisekunden je Punkt; ein Modell von rund 40 MB im Funktionspaket (Vercel erlaubt heute 5 GB, `onnxruntime-node`); im Browser wäre es ein 40-MB-Download je Besucher, also nein. Die Maske korrigiert auch die Drift: ein Punkt auf dem Nachbarn liefert dessen Maske, aber zwei Punkte in einer Maske fallen auf — dann rückt die Zuordnung in Leserichtung nach. Klassische Alternativen (Canny + Hough-Linien für senkrechte Rückenstöße, Watershed) sind billiger, tragen aber nur auf geraden, gut beleuchteten Brettern, wie (3) und (4) zeigen.

**Nächster Schritt — ein Lab-Experiment `lab/shelf/segment/`** (ein halber Tag): MobileSAM als ONNX lokal unter `npx tsx` mit `onnxruntime-node`, die Mitten aus den gespeicherten Antworten der zwei Fotos als Punkte, Masken gezeichnet, gezählt: trifft die Maske den Rücken, dessen Titel sie trägt (Schwelle wie bisher 9 von 10 auf dem Brett, 7 von 10 auf der Wand), Dauer und Speicher auf dem Mac. Dann die Entscheidung Server-Funktion ja/nein (Paketgröße, Kaltstart, Speicher der Hobby-Funktion). **Julian entscheidet, ob das Experiment läuft.**

**Bis dahin: Pins statt Kästen** (gebaut 2026-10-01, nachdem ein einzelner Umschlag als schmaler Streifen über die ganze Bildhöhe erschien — Julian: „die cover-segmentierung sieht dann auch nicht so scheiße aus. entweder eine gute segmentierung oder eine grundsätzlich andere darstellung“). Gezeichnet wird nur noch ein nummerierter Pin am Mittelpunkt des berechneten Streifens: rund für einen Rücken, eckig für einen Umschlag, blass beim Lesen, Akzent beim Finden, grau wenn nicht. Ein Pin behauptet „etwa hier“ und sonst nichts; die Streifen bleiben im Datenmodell (`box`), damit eine spätere Segmentierung oder der Ausschnitt-Vergleich (Schritt 4) sie nutzen kann. Geprüft headless bei 1280 px (20 Pins auf dem Brett, 19 grau) und 390 px.

**Die Liste wächst mit** (gebaut 2026-10-01; Julian: „während die bücher nachgeschaut werden können die ersten ergebnisse auch schon angezeigt werden, dann kann der user schonmal cover auswählen etc“). `WallProposal` nimmt Zeilen mit `pending`; der Standard „vorgehakt“ ist eine Regel (gefunden, neu in der Sammlung, kein Rateversuch) und die Klicks des Lesers sind Ausnahmen (`flipped`), nicht mehr eine beim ersten Rendern gefüllte Menge — so bekommt eine Zeile, die während der Suche eintrifft, denselben Standard, und ein Häkchen, das der Leser während der Suche setzt, bleibt. Der Knopf sagt „(k still looking)“, solange Zeilen fehlen. Geprüft headless an der Galeriewand: ein Häkchen während „looking them up… 8 of 40“ entfernt, am Ende noch entfernt, die übrigen gesetzt.

## Stapel: ein Punkt je Buch statt Reihe und Mitte (2026-10-01)

Julian, mit einem Foto zweier Bücherstapel aus der Produktion: „Hier gibt es noch einen Bug bei der Darstellung der gefundenen Bücher wenn sie seitlich sind“ — fünfzehn gelesene Bücher, sechs sichtbare Pins. Der Fehler lag im Ansatz: der Prompt kannte nur Regalreihen mit einer waagrechten Mitte je Buch; in einem Stapel liegen alle Bücher an derselben waagrechten Stelle, und die senkrechte Mitte der „Reihe“ war für alle gleich.

**Gebaut:** der Prompt fragt je Buch `x` **und** `y` (ganze Prozent), keine Reihen mehr; `placeBooks`, `rows` und die Streifen sind aus `lib/recognize.ts` entfernt (`box` bleibt als leeres Feld für einen späteren Segmentierer). `PhotoRead.at` trägt den Punkt zur Seite. `lib/walls/pins.ts` (`spreadPins`, rein, getestet) rückt einen Pin, der einen früheren überdecken würde, quer zur Richtung seines Nachbarn: auf dem Brett auf und ab, im Stapel nach links und rechts; die Seite misst dafür die gezeigte Bildgröße beim Laden. Die Versetzung nur am Telefon (`max-sm`) entfällt.

**Gemessen** (lokal; `docs/tests/2026-10-01-regalfoto-stapel-punkte.png`, `…-pins-phone.png`): auf Julians Stapelfoto (als Bildschirmfoto, 739 × 1600) neun bis zehn Bücher, jedes mit eigenem Punkt in seinem Stapel; auf dem Brett 20–22 von 22, alle Pins am Telefon sichtbar. **effort wieder medium:** mit dem Punkt-Prompt denkt „high“ vor der Antwort nach — die Galeriewand kostete 3.131–5.241 Ausgabetoken und 24–40 s für 42–47 Bücher (5–9 ct), „medium“ liest 33–40 für 1.383–1.699 Token in 11–13 s (≈ 3 ct), das Brett 21–22 in 8 s. Am Vortag, mit dem Reihen-Prompt, war es umgekehrt (25–27 gegen 38–41): die Einstellung hängt am Prompt und gehört bei jeder Prompt-Änderung neu gemessen.

## Variante 3: ein zweiter Blick auf dichte Fotos (2026-10-03)

Julian nach der Frage, ob sich etwas vorschalten lässt, das Prompt und Denk-Einstellung wählt: „mach variante 3“ — das Ergebnis des ersten Lesens als Weiche. Vier Anläufe an der Galeriewand (1500 × 2000), jeder gemessen:

| Schnitt | Bücher | Zeit zweiter Blick | Kosten gesamt | Befund |
|---|---|---|---|---|
| nur ein Blick (Stand vorher) | 33–39 | — | ≈ 3 ct | viele ohne Autor |
| drei Bänder nach den y-Werten des Modells | 73 | 12 s | — | die y-Werte lagen einen halben Boden daneben, das oberste Band schnitt durch die Bücher (14 statt ~30 gelesen) |
| drei feste Streifen über die volle Breite (je halbe Höhe, ein Viertel versetzt) | 68–76 | 12–37 s | ≈ 11–20 ct | gute Lesung mit Autoren, aber das Modell **zählt** die waagrechte Lage bis „150 %“ — Punkte wertlos |
| sechs feste Stücke (3 × 2) | 95 | 12 s | ≈ 15 ct | Punkte im Bild, aber waagrechte Schnitte gehen durch die Rückentitel: „Edo to Performance“, „S Party“, „Tar“ |
| **je Boden, an den Brettern geschnitten, 2–3 Teile nebeneinander** | **97–100** | **9–10 s** | **≈ 13 ct** | saubere Titel, Autoren, Punkte im richtigen Boden |

**Gebaut:** `recognize(…, stopAt)` bricht den ersten Durchgang beim 30. Buch ab (`DENSE_AT`, `stream.abort()`); `lib/shelfrows.ts` findet die Bretter (mittlere Helligkeitsänderung je Pixelzeile, geglättet; ruhige Bänder unter 45 % des Medians und mindestens 1,2 % hoch sind Bretter; 6–8 ms je Foto; Wand: Böden bei 0,117 / 0,436 / 0,691, das Brett und der Stapel haben keine teilenden Bretter); `piecesOf` schneidet je Boden zwei Teile (0–0,6 und 0,4–1) oder drei, wenn der Boden mehr als viermal so breit wie hoch ist; `mergeReads` führt zusammen (gleiche Buchstaben, höchstens 15 % verlesen, oder ein Titel ab zwei Wörtern ganz in Titel und Autor des anderen; die vollere Lesung, der Punkt aus dem Stück); `settle` zieht Antworten, deren Lage über das Bild hinausgezählt wurde, proportional zurück. Die Route streamt `{"again": n, "done": k}`. Der Browser schickt 2000 statt 1600 px lange Kante, damit die Stücke mehr Pixel haben als der erste Blick; Grenze 100 statt 80 Bücher; ein dichtes Foto zählt mit jedem Teil auf die Tagesgrenze.

**Denken abgeschaltet** (`thinking: { type: 'disabled' }`), an drei Streifen der Wand gemessen: mit Denken 96 Bücher für 6.762 Ausgabetoken in 14–20 s je Streifen, ohne 95 für 4.133 in 10–13 s. Gilt für alle Aufrufe.

**Im Browser** (headless, 1280 px, `docs/tests/2026-10-03-regalfoto-wand-zweiter-blick.png`): erster Pin nach 5 s, „Many books — reading the photo again in 9 parts“ bei 12,8 s, 100 Bücher gelesen nach 22,6 s (14.592 / 6.069 Token ≈ 13,5 ct), die Suche nach 100 Titeln weitere 45 s — 6 gefunden, 42 „maybe“, 52 nicht im Katalog: es sind Galeriekataloge. Das Brett: unverändert ein Durchgang, 20 Bücher in 7,8 s. Julian hatte „nur die Wand zahlt doppelt“ gelesen — es ist das Vierfache; die Grenze `DENSE_AT` und die Zahl der Teile sind die Stellschrauben.

**Offen:** ein Testsatz von acht bis zehn Fotos mit gezählter Wahrheit, bevor an Prompt, Schwelle oder Schnitt weiter gedreht wird — alle Zahlen hier stammen von drei Fotos.

## Der Testsatz (2026-10-04)

Julian lieferte zwölf Fotos; mit den zwei ersten sind es vierzehn, je mit einer Wahrheitsliste (Entwurf, von Julian zu korrigieren) und einem Auswertungsskript, das den Lesecode der Website selbst benutzt (`lib/walls/readphoto.ts`, aus der Route herausgezogen). Erster Lauf: **292 von 322 Büchern der Listen gelesen (91 %)**, 94 % davon mit dem Autor, der auf dem Foto steht; auf den sieben vollzähligen Fotos ein einziger Fehler; Umschläge 1–2,4 ct und 2–7 s, dichte Regale 9–13 ct und 17–24 s; das verwackelte Regal 52 %. Bericht mit Tabelle, Fehlbildern und vier Vorschlägen: [docs/tests/2026-10-04-regalfoto-testsatz.md](../tests/2026-10-04-regalfoto-testsatz.md). Ab jetzt läuft jede Änderung an Prompt, Schwelle oder Schnitt zuerst gegen diesen Satz.

## Schwelle 40, Tagesbudget, Mail (2026-10-04)

Julian: „lass uns die grenze für die dichte hochsetzen, damit wir nicht aus versehen viel ausgeben. außerdem braucht die website einen stopp falls wir zu viel traffic oder verbrauch bekommen. zb eine email an mich als info.“

**Die Schwelle, am Testsatz gemessen** (`PHOTO_DENSE_AT=off`, Lauf `one-look`): ein einziger Blick liest auf den sechs dichten Fotos 35–55 Bücher, auf allen anderen höchstens 21, und über alle vierzehn **261 von 322 (81 %) für 38 ct** — gegen **292 von 322 (91 %) für 80 ct** mit dem zweiten Blick. `DENSE_AT` steht jetzt bei **40** statt 30: fünf der sechs dichten Fotos bekommen den zweiten Blick weiter, das sechste (die Schuber, 35 Bücher) hatte durch ihn nichts gewonnen. `PHOTO_DENSE_AT` überschreibt die Zahl ohne Deploy; `off` schaltet den zweiten Blick ab.

**Das Budget** (`lib/walls/photobudget.ts`, `WallStore.spendPhoto`): Kosten je Lesung aus den Token, auf den UTC-Tag summiert; Voreinstellung 200 ct am Tag (`PHOTO_BUDGET_CENTS`). Ab der Hälfte nur noch ein Blick, am Budget ist das Foto aus (429). Probelauf lokal mit 3 ct: Lesung 1 und 2 je 1,04 ct, Lesung 3 mit `oneLook: budget`, Lesung 4 abgewiesen mit `capped: budget`. Die Zahlgrenze von 300 Lesungen bleibt daneben.

**Die Mail** (`lib/alerts.ts`): je Schwelle und Tag eine, über Resend, Empfänger `ALERT_TO` → `WALLS_REPORT_TO` → Impressum; Dublettenschutz im Speicher (`alerts:<Schlüssel>`, zwei Tage). Dazu eine Mail, wenn Google das Tageskontingent als erschöpft meldet. Ohne `RESEND_API_KEY` geht nichts hinaus — **ob der Schlüssel in Produktion gesetzt ist, konnte diese Sitzung nicht prüfen** (`vercel env ls` gab im Worktree nichts aus).

## Meilenstein 2026-10-04 — Stand und Fortsetzung

**In Produktion seit 2026-10-04** (Julian: „make a milestone to continue from later, merge the earlier fixes and deploy“): ein Punkt je Buch statt Reihen (Stapel gehen), Pins statt Kästen, der zweite Blick auf dichte Fotos ab 40 Büchern mit Schnitt an den Regalbrettern, das Modell ohne Denken, 100 Bücher je Foto, das Tagesbudget mit Stopp und Mail, der Rückweg von der Buchseite zur Wand (6.89). Der Testsatz und sein Auswertungsskript liegen im Lab.

**Wo weitermachen — in dieser Reihenfolge:**

1. **Julian korrigiert die Wahrheitslisten** (`lab/shelf/testset/truth.json`, Fotos 04, 07, 09, 10, 12, 13): erst dann ist „darüber hinaus“ eine Fehlerzahl. Bis dahin sind die 91 % eine Trefferquote gegen Claudes eigenen Entwurf.
2. **Drei Ideen am Testsatz messen**, je ein Lauf (`npx tsx lab/shelf/evaluate.ts --label …`, 80 ct, drei Minuten), nie wieder an Einzelfotos: (a) Bruchstücke angeschnittener Bücher am Bildrand auslassen („GO“, „Self“, „SETH“ auf Foto 10) — per Prompt oder indem der angeschnittene Randstreifen beim zweiten Blick nicht gelesen wird; (b) ein Feld für Unsicheres, damit *Collected Novellas* und die vier Pettersons als „maybe“ kommen statt zu fehlen; (c) ein Hinweis bei Unschärfe statt eines halben Ergebnisses (Foto 05: 52 %), erkannt an der Kantenstärke ohne Modell.
3. **Schritt 4 des Plans, Umschlag → Ausgabe:** jetzt gibt es Umschlagfotos (01, 02, 03, 06, 08, 11). Der Ausschnitt braucht einen Umriss; den liefert das Modell nicht — entweder der Segmentierer (unten) oder, einfacher für frontale Umschläge, ein Zuschnitt um den Punkt mit fester Größe, an den sechs Fotos zu messen.
4. **Echte Umrisse** (MobileSAM mit den Punkten als Aufforderung, Lab-Experiment `lab/shelf/segment/`) — Julian hat noch nicht entschieden, ob es laufen soll.
5. **Von Julian zu setzen:** das Monatslimit in der Anthropic-Konsole; `RESEND_API_KEY` in Vercel prüfen, sonst kommen die Mails nicht; optional `ALERT_TO`, `PHOTO_BUDGET_CENTS`, `PHOTO_DENSE_AT`.

**Was man wissen muss, bevor man etwas anfasst:** die Denk-Einstellung hängt am Prompt (mit Reihen-Prompt las „high“ mehr, mit Punkt-Prompt „medium“ gleich viel für ein Drittel) — nach jeder Prompt-Änderung neu messen. Das Modell misst keine Lage, es zählt (in breiten Streifen bis „150 %“); `settle` fängt das ab, und geschnitten wird nur an Brettern und zwischen Rücken. LibreWolf, Firefox mit RFP und Tor geben ein Canvas nicht ehrlich zurück; der Server bereitet darum jedes Foto selbst auf. Die Route streamt JSON-Zeilen; die Liste im Browser wächst mit.

