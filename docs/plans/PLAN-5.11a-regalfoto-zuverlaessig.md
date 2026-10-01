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

**Produktion** steht noch auf dem alten Stand; vor dem Deploy: Julians Blick auf den Strom und die „maybe“-Zeilen.

## Das „keine Ergebnisse“ — gelöst (2026-09-30, nachts)

Julian wiederholte den Versuch mit derselben Datei (ein JPEG vom Computer, am Desktop, in **LibreWolf**); die neue Logzeile sagte: 1.110.631 Bytes angekommen, Bild in voller Größe (3.267 Token), **0 Bücher, 20 Antworttoken**. Nachgestellt in einem headless LibreWolf über WebDriver BiDi mit demselben Canvas-Code wie `WallPhoto`: das Canvas liefert beim Auslesen (`toBlob`, `getImageData`) **ein blau-schwarzes Streifenmuster** statt des Fotos (`docs/tests/2026-09-30-regalfoto-librewolf-canvas.png`), 1.080.627 Bytes — der Fingerprinting-Schutz (`privacy.resistFingerprinting`), den LibreWolf, Firefox mit RFP und der Tor-Browser so einstellen. Genau dieses JPEG an das Modell geschickt: 0 Bücher, 20 Token, 3,3 s. Ein 8 × 8-Verlauf, gezeichnet und zurückgelesen, hat in LibreWolf 64 von 64 Pixeln falsch, in Chrome 0. HEIC war es nicht: das scheitert in Chrome schon beim Dekodieren („The source image could not be decoded“), jetzt mit eigenem Satz.

**Gebaut:** `canvasIsHonest()` im Browser (der Verlauf); ist das Canvas unehrlich, geht **das Original** (JPEG oder PNG bis 12 MB) hoch; `lib/photoprep.ts` auf dem Server dreht nach dem EXIF-Tag (eigener Parser, Tag 0x0112), verkleinert per Kastenmittel auf 1600 px und schreibt ein nacktes JPEG (Qualität 85) — **für jedes Foto**, also sieht das Modell nie EXIF und nie den GPS-Tag eines Telefons; `decode` in `lib/imagehash.ts` nimmt dafür 512 MB und 50 MP statt 64 MB und 20 MP. Die Logzeile trägt Bytes, gesendete Größe, Orientierung und ob verkleinert wurde. Gemessen: das Original mit 2000 × 1500 (380 KB) → 1600 × 1200, 20 Bücher; eine 12-Megapixel-Kopie (1,6 MB, 4032 × 3024) → erstes Buch nach 5,1 s, 19 Bücher nach 10,1 s; **in LibreWolf durchgespielt** (headless, `input.setFiles`): erstes Buch nach 2,5 s, 19 gelesen, 18 gefunden. Tests: `lib/__tests__/photoprep.test.ts` (Orientierung lesen, drehen, verkleinern, vorbereiten).

