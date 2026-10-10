# PLAN 5.5b — Kurzvideo: die Goodreads-Liste hineinziehen, die Lieblingsausgabe finden

Julian, 2026-10-09: „können wir ein kurzvideo machen, dass zeigt, dass man seine goodreads to-read liste in unsere seite ziehen kann und damit einfach seine lieblingsedition findet und bestellen kann? mache erstmal nur einen plan dafür, wie du das lösen würdest“.

**Status:** Plan, nichts gebaut. Wartet auf Julians Entscheidungen in §7.

## 1. Was es schon gibt

- **Der Weg auf der Seite steht** (5.19). Auf `/create` heißt die Karte „From your library“ und schaltet zwischen Calibre und Goodreads um. Sie nimmt `goodreads_library_export.csv`, auch hineingezogen (`onDrop` in `components/WallLibrary.tsx`), gelesen im Browser (`lib/goodreads/export.ts`). Das Regal ist wählbar, auch „Want to read“. Daraus wird eine Sammlung, jede Kachel führt auf die Buchseite mit allen Covern, und ein gewähltes Cover zeigt die Kauflinks.
- **Die Seite fragt Goodreads nie.** Das Video darf deshalb auch nicht so tun, als hole es die Liste von dort: Gezeigt wird die Datei, nicht ein Login.
- **Ein Video-Lab gibt es** (`lab/video/`, 5.5): Einzelbilder, Schrift der Seite, Kompositing mit Pillow (`text.py`) und `encode.sh`. Es fehlt **ffmpeg** auf dem Rechner (`brew install ffmpeg`).
- **Die Rechtefrage aus 5.5 ist offen** (PLAN-5.5-5.6-kanaele §6, Frage 1): Cover in einem Clip auf einer fremden Plattform. Hier gilt: erzeugen ja, posten erst nach Julians Antwort, und dann von Hand.

## 2. Der Film (Entwurf, etwa 30 s, Hochformat 9:16, 1080 × 1920, ohne Ton, mit Texteinblendungen)

| Zeit | Bild | Einblendung |
|---|---|---|
| 0–3 s | Titelkarte in der Gestaltung der Seite | „Your Goodreads to-read list →“ / „the editions you actually want“ |
| 3–8 s | `/create`, Schalter auf Goodreads; eine Datei-Kachel `goodreads_library_export.csv` fliegt in das Feld | „Export your library, drop the file“ |
| 8–13 s | Regal „Want to read“ wird gewählt, die Wand füllt sich Kachel für Kachel | „Every book on your shelf“ (nicht „all your books“, wenn nicht jedes gefunden wird) |
| 13–21 s | Tipp auf ein Buch; die Buchseite mit der Cover-Wand, langsames Scrollen, Tipp auf ein Cover | „Pick the cover you love“ |
| 21–27 s | Die Seitenleiste bzw. das Telefonblatt: der Satz zum Verlagsbild, darunter die Kaufknöpfe; der Finger auf dem ersten | „…and order that edition“ |
| 27–30 s | Endkarte mit Wortmarke | „buyitscovers.com“ |

Den Shop selbst zeigt der Film nicht: Eine Aufnahme fremder Seiten ist weder nötig noch unsere.

## 3. Wie ich es aufnehmen würde

1. **Gegen `next dev`, nicht gegen die Produktion** (Regel seit 2026-09-09). Lokal mit `WALLS=on`. Die Sammlung wird nur im lokalen Speicher angelegt, nichts landet in der Produktion.
2. **Headless Chrome über das DevTools-Protokoll**, wie die Bildschirmfotos dieser Sitzungen: Telefon-Viewport 360 × 640 bei `deviceScaleFactor` 3, also genau 1080 × 1920. `Page.startScreencast` liefert Einzelbilder. Weil der Takt schwankt, würde ich lieber nach jedem Schritt eine feste Bildfolge mit `Page.captureScreenshot` abgreifen; das ergibt gleichmäßige 30 fps.
3. **Die Handlungen per Skript:**
   - Den Datei-Drop über ein synthetisches `drop`-Ereignis mit echtem `DataTransfer`, sodass genau der Code der Seite läuft.
   - Das Tippen über `Input.dispatchTouchEvent`.
   - Das Scrollen in kleinen Schritten.

   Der verborgene Browser-Bereich nimmt keine Eingaben an (Erfahrung dieser Sitzungen), deshalb headless.
4. **Was im Bild erscheint, aber nicht zur Seite gehört**: der Finger-Punkt, die fliegende Datei-Kachel und die Texte. Das wird erst beim Zusammensetzen mit Pillow über die Einzelbilder gelegt, in der Schrift der Seite (Weg aus `lab/video/`). Die Seite selbst bekommt dafür keinen Code.
5. **Wartezeiten werden geschnitten.** Der Abgleich mit Open Library dauert mehrere Sekunden je Buch. Ich würde den Daten-Cache vorher füllen, also einmal durchlaufen lassen, und die Aufnahme dann aus dem Cache machen; was trotzdem wartet, fällt im Schnitt heraus. Gekürzt wird nur Leerlauf, keine Antwort wird erfunden.
6. **Kodieren** mit ffmpeg (H.264, yuv420p), dazu eine WebP-Vorschau zum Ansehen im Browser. Ort: `lab/video/screen/` mit README (Frage, Messung, Status), Ausgabe git-ignoriert.

## 4. Die Beispieldaten

- **Nie Julians echter Export.** Ich schreibe eine erfundene `goodreads_library_export.csv` mit den Spalten des echten Exports (dieselben, die `lib/goodreads/export.ts` liest), etwa 12 Bücher auf „to-read“.
- **Welche Bücher:** Werke mit vielen gestalteten Covern, die die Wand sehenswert machen (*Dune*, *The Master and Margarita*, *Stoner*, *The Left Hand of Darkness*, *Pedro Páramo* …). Jede Zeile wird gegen Open Library geprüft, nicht aus dem Gedächtnis geschrieben, mit gemessenen Pausen zwischen den Abfragen.
- **Das Buch, das im Film gekauft wird,** braucht das Urteil `verified`: Das aktuelle Verlagsbild der ISBN ist genau das gewählte Cover. Nur dann stimmt „order that edition“. Bei jedem anderen Urteil liefert ein Shop womöglich ein anderes Cover unter derselben ISBN, und der Film würde etwas versprechen, das die Seite selbst nicht verspricht. Seit 6.100 steht in diesem Fall Bookshop.org vorn, das passt zu „order“.

## 5. Was der Film nicht behaupten darf

- **Keine Vollständigkeit:** nicht „every edition“, nicht „all covers“, „every book on your shelf“ nur, wenn die Wand tatsächlich jedes Buch der Datei gefunden hat. Sonst „your shelf“.
- **Kein Goodreads-Logo, keine Goodreads-Oberfläche:** Der Name steht nur im Text als Herkunft der Datei. Goodreads gehört Amazon, und am selben Konzern hängt 4.2.
- **Bestellen ohne Partnerlink:** Im Hobby-Modus bringt der Klick nichts ein. Das ist für den Film kein Problem, er muss es auch nicht sagen.

## 6. Aufwand und Reihenfolge

1. Beispieldatei und Prüfung gegen Open Library: etwa 30 Minuten.
2. Aufnahmeskript (CDP, Drop, Tippen, Bildfolge): etwa ein halber Tag.
3. Überlagerungen, Schnitt, Kodieren: etwa 2 Stunden. Vorher installiert Julian ffmpeg.
4. Julian sieht die WebP-Vorschau und das MP4 an, eine Runde Änderungen.
5. Posten erst nach der Rechte-Antwort, von Hand. Für die Analyse: Die Adresse auf der Endkarte bekommt einen Herkunftsvermerk (`?via=clip`), aber nur, wenn `originOf` (`lib/insights/signals.ts`) ihn klassieren kann. Das wird beim Bau geprüft, Analytik-Regel 3.

## 7. Julian entscheidet

1. Länge: 30 s wie oben, oder 15 s mit nur einem Buch?
2. Telefon-Ansicht (Hochformat, für Reels und TikTok) oder Desktop (Querformat, für X)?
3. Ton: nur Texteinblendungen, oder auch Musik? Musik bringt eine eigene Rechtefrage.
4. Welches Buch im Film gekauft wird; ich schlage eines mit `verified` vor.
5. Die Rechtefrage aus 5.5 vor dem Posten.
