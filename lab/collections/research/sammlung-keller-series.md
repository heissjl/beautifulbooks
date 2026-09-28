# Sammlung Keller: weitere Künstler-Reihen für Sammlungswände

Frage (Julian, 2026-09-28): „find other artist series on Sammlung Keller that we don't have yet“ —
Umschläge eines Künstlers für eine Verlagsreihe, wie „Reihe Hanser — covers by Heinz Edelmann“.

Gemessen 2026-09-28. Quelle: https://www.sammlungkeller.ch/kuenstler-innen.html, 34 Künstlerseiten
nacheinander geladen (je 2 s Pause), dazu 580 Vorschaubilder der Kandidaten (je ~1 s Pause).
Open Library per `search.json` (Ausgabensuche mit `publisher:`), `/isbn/<isbn>.json` und
`covers.openlibrary.org`; Google Books nicht gefragt. „Dasselbe Cover" heisst: dHash-Abstand ≤ 12
zwischen Kellers Vorschaubild und dem Open-Library-Bild **und** von Auge bestätigt (Vergleichsbogen).

Ausgelassen, weil vorhanden oder in Arbeit: Edelmann (alle Reihen), Kurt Wirth Fischer Bücherei,
Fischer Bücherei als ganze Reihe. Keine der unten genannten Reihen steht in `data/collections.json`.

## Alle Künstlerseiten (34)

Buchumschläge in Reihe gibt es nur bei wenigen; die meisten Seiten zeigen Bilderbücher (Innenseiten),
Plakate, Schallplatten, Nebelspalter-Titel oder freie Arbeiten.

| Seite | Bilder | Buchreihen (Überschrift bei Keller → Anzahl) |
|---|---:|---|
| piatti-celestino | 406 | sonderreihe dtv 100 · dtv phantastica 37 · Steinbeck-Reihe im dtv 23 · Bücher/Hefte 25 (gemischt) · Bilderbücher 24 · Nebelspalter 89 |
| heidelbach-nikolaus | 283 | Haffmans Verlag 92 (davon ~60 Haffmans-Krimis/Romane, 10 Kipling-Werkausgabe, 5 „Der Rabe“, 4 Niebelschütz) · Bilderbücher 73 · Beltz & Gelberg |
| grieder-walter | 393 | Herder Bücherei 54 (45 Reihen-Umschläge Nr. 50–411) · Ravensburger Taschenbücher 38 (17 Umschläge, Rest Innenseiten) · de Cesco (aare) 12 · Bilderbücher 110 |
| wyss-hanspeter | 205 | Bücher 77 (davon 53 Schutzumschläge für Ex Libris 1961–1982, 6 „Dominik Dachs“) · LPs · Nebelspalter |
| maurer-werner | 156 | Reihenlayout Zytglogge 24 (1970er) · Kandelaber 7 · Bilderbücher 37 · gemischte Buchgestaltung 54 |
| wirth-kurt | 220 | Fischer Bücherei 85 (in Arbeit) · Fischer doppelpunkt 21 (+1 Sammelbild) · S. Fischer Hardcover 13 |
| schindler-edith | 377 | Umschläge 193 (meist Innenseiten, viele Verlage) · Taschenbücher 32 (Ravensburger 13, dtv junior 8, Benziger 5) · Kochbücher 53 |
| stieger-heinz | 410 | Buchgestaltung 64 (~35 Umschläge, viele Verlage, keine Reihe) · Schallplatten/MC ~300 |
| delessert-etienne | 223 | Yok-Yok 38 (Bilderbücher) · Bücher 17 (Folio/Folio junior ~9) · The Atlantic 27 |
| schmid-eleonore | 78 | Bilderbücher 63 · Buchumschläge 11 |
| roelli-margrit | 94 | Bilderbücher 57 · Umschläge 9 |
| roeckener-andreas | 126 | Bilderbücher 55 · Pixi 16 (8 Hefte, je vorn/hinten) |
| binder-hannes | 28 | Buchgestaltung 25 (gemischt) |
| hunziker-max, loosli-arthur, tanner-paul, farner-chrigel, gilsi-fritz, gilsi-rene, carmi-karl-mietlich, moos-max-von, moos-joseph-von, mueller-lina, mueller-josef-felix, nussbaumer-paul, schenardi-luca, schmidt-georg, steffen-walter-arnold, winter-langhagen-melchior, fedullo-nelida-zulema, imanjama-francis-patrick-tanzania, matindiko-sayuki-tan, unbekannter-meister | je 1–228 | keine Buchreihe mit ≥ 10 Umschlägen (Grafik, Plakate, Zeitschriften, Einzelbücher) |
| edelmann-heinz | 207 | vorhanden |

## Rangliste

„OL-Stichprobe“: 10 Titel je Reihe (bei Steinbeck und phantastica zusätzlich **alle** Nummern über die
aus der dtv-Nummer berechnete ISBN). Erste Zahl: Ausgaben dieses Verlags bei Open Library gefunden;
zweite: davon mit **genau diesem** Umschlag.

| # | Künstler | Reihe | Verlag | Jahre | bei Keller | bildhaft | OL | Aufwand |
|---|---|---|---|---|---:|---|---|---|
| 1 | Celestino Piatti | dtv phantastica | dtv | 1979–Mitte 1980er | **37** (Nr. 1850–1886, Keller: vollständig bis 1885) | ja, stark — farbige Zeichnung auf Schwarz, jedes Motiv anders | alle 37 per ISBN: 8 Ausgaben, **0** mit diesem Umschlag (3 tragen Piattis Bild im älteren weissen dtv-Rahmen) | mittel: ISBN = 3-423-0<Nr>, also `from-isbns`-fähig; ~29 Ausgaben anlegen, 37 Bilder hochladen |
| 2 | Celestino Piatti | Steinbeck-Gesamtausgabe | dtv | 1985–1988 | **23 von 23** (Keller: „total 23 Bände“) | ja — Linienzeichnung auf Farbfeld, je Band anders | alle 23 per ISBN: 15 Ausgaben, **3** mit diesem Umschlag (Ölsardinen, Perle, Tagebuch eines Romans) | klein: ISBN = 3-423-<Nr>; 8 Ausgaben anlegen, 20 Bilder hochladen; eine abgeschlossene, vollständige Reihe |
| 3 | Nikolaus Heidelbach | Haffmans Kriminalromane / Taschenbücher (+ Kipling-Werkausgabe) | Haffmans, Zürich | ca. 1988–1998 | ~60 Krimis/Romane + 10 Kipling | ja, sehr — surreale Einzelbilder auf Schwarz | 10er-Stichprobe: 1 Ausgabe, **0** mit diesem Umschlag (Kavanagh „Vor die Hunde gehen“ ist bei OL, aber unter „Duffy“ gesucht) | mittel–hoch: ISBN-Zeit, aber Keller nennt weder Titel noch ISBN (Titel vom Bild, ISBN über DNB); ~65 Ausgaben anlegen |
| 4 | Walter Grieder | Herder Bücherei | Herder, Freiburg | ca. 1958–1971 (Keller nennt nur Nummern) | **45** (Nr. 50–411) | ja — bunte Zeichnungen; ab ~Nr. 228 weisses Layout mit Bild unten, dort teils ornamental | 10er-Stichprobe: 1 Ausgabe, **0** Umschläge | hoch: meist vor der ISBN, Titel nur auf dem Bild; wie Wirth/Fischer Bücherei |
| 5 | Hanspeter Wyss | Schutzumschläge für Ex Libris | Ex Libris (Buchclub), Zürich | 1961–1982 | **53** (+ 6 „Dominik Dachs“, Benziger) | überwiegend ja; ~10 typografisch (Frisch, Dürrenmatt, Marti) | 10er-Stichprobe: 0 Ausgaben | hoch: Buchclub-Lizenzausgaben, keine Nummern, Keller nennt nur Autor und Jahr; keine Reihe im engen Sinn, sondern „ein Verlag“ |
| 6 | Werner Maurer | Zytglogge-Reihe Schweizer Autoren | Zytglogge, Bern | 1970er | 24 (21 + 3 „Schwarze Reihe“) | halb: festes Layout, ein kleines Motiv im Farbfeld; „Schwarze Reihe“ rein typografisch | 10er-Stichprobe: **9** Ausgaben (LoC-Datensätze), **0** Umschläge | klein: fast nur Bilder hochladen |
| 7 | Walter Grieder | Ravensburger Taschenbücher | Ravensburger | 1973–1979 | 17 Umschläge (+ 21 Innenseiten) | ja | nicht gemessen | zu klein für eine eigene Wand; zusammen mit Schindlers 13 Ravensburger-Umschlägen denkbar |
| — | Celestino Piatti | sonderreihe dtv | dtv | 1962–1979 | 100 | **nein** — dasselbe Quadrat, nur die Farbe wechselt | nicht gemessen | ausgeschieden (abstrakt) |
| — | Kurt Wirth | Fischer doppelpunkt | S. Fischer | frühe 1960er | 20 | **nein** — zwei Farbkreise | nicht gemessen | ausgeschieden (typografisch) |
| — | Stieger, Schindler, Delessert, Schmid, Binder | diverse | viele | — | je < 15 pro Verlag | ja | — | keine Reihe mit genug Umschlägen |

Hochrechnung aus den Stichproben: Open Library hat von diesen Reihen fast nichts im Originalumschlag
(0–13 %). Jede Wand heisst also: Bilder von Keller, Ausgaben anlegen, von Hand hochladen — wie bei
Edelmanns Reihe Hanser. Der Unterschied liegt darin, ob die ISBN aus der Reihennummer folgt (dtv) oder
vom Umschlag abgeschrieben und nachgeschlagen werden muss (Haffmans, Herder, Ex Libris).

**Befund zur dtv-Nummer:** dtv-Bände der 1980er tragen die ISBN 3-423-&lt;Bandnummer fünfstellig&gt;-&lt;Prüfziffer&gt;.
Für Steinbeck ergab die aus Kellers Dateinamen berechnete ISBN 15 von 23 Treffern, alle richtig
zugeordnet (Stichprobe von Auge); eine Ausnahme: 3-423-10490-2 liefert bei OL Frischmuths „Amy“, nicht
„König Artus“ — Kellers Nummer oder der OL-Datensatz ist dort falsch, vor einem Upload prüfen.

## Beispielbilder (Vorschaubilder bei Keller)

**1 · Piatti, dtv phantastica** (Stoker *Dracula* 1851, *Luzifer läßt grüßen* 1856, Shelley *Frankenstein* 1860, *Das Monster im Park* 1866, Bulgakow *Der Meister und Margarita* 1872, King *Brennen muß Salem* 1878)
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv-phantastica_1851_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv-phantastica_1856_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv-phantastica_1860_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv-phantastica_1866_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv-phantastica_1872_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv-phantastica_1878_web-180x303.jpg

**2 · Piatti, Steinbeck bei dtv** (*Früchte des Zorns*, *Die wilde Flamme*, *Die Straße der Ölsardinen*, *Stürmische Ernte*, *Von Mäusen und Menschen*, *Meine Reise mit Charley*)
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv_steinbeck_10474_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv_steinbeck_10521_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv_steinbeck_10625_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv_steinbeck_10734_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv_steinbeck_10797_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/piatti_dtv_steinbeck_10879_web-180x303.jpg

**3 · Heidelbach, Haffmans** (Kipling *Dschungelbuch*, P. K. Dick *Zur Zeit der Perky Pat*, Karr & Wehner *Geierfrühling*, Pierce *Rosen lieben Sonne*, Kneifel *Das brennende Labyrinth*, Mensching *Rotkäppchen und der Schwan*)
- https://www.sammlungkeller.ch/media/images/thumbnails/heidelbach_haffmans_kipling_dschungel_1_web-192x317.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/heidelbach_haffmans_perky_web-180x303.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/heidelbach_karr_geier_web-180x290.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/heidelbach_pierce_rosen_web-180x290.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/heidelbach_kneifel_labyrinth_web-180x297.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/heidelbach_mensching_rotkaeppchen_web-180x297.jpg

**4 · Grieder, Herder Bücherei** (Nr. 50 Marshall *Die rote Donau*, 78 Tschechow *Rotschilds Geige*, 119 *Gespenstergeschichten*, 127 *Kriminalgeschichten*, 275 Waugh *Tod in Hollywood*, 346 Basset *Wir Glaubenszweifler*)
- https://www.sammlungkeller.ch/media/images/thumbnails/grieder_herder_050-180x295.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/grieder_herder_078_web-180x300.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/grieder_herder_119-179x295.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/grieder_herder_127_web-180x293.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/grieder_herder_275_web-180x299.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/grieder_herder_346-180x303.jpg

**5 · Wyss, Ex Libris** (Solschenizyn *Der erste Kreis der Hölle* 1968, West *Harlekin* 1976, Guggenheim *Das Ende von Seldwyla* 1976, Crichton *Andromeda* 1969, Federspiel *In den Wäldern des Herzens*, Chessex *Leben und Sterben im Waadtland* 1974)
- https://www.sammlungkeller.ch/media/images/thumbnails/wyss_hoelle-160x246.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/wyss_harlekin_web-160x238.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/wyss_seldwyla_web-160x260.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/wyss_andromeda-160x243.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/wyss_waeldern-160x250.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/wyss_waadtland_3_web-160x230.jpg

**6 · Maurer, Zytglogge** (Burren *Dr Schtammgascht*, Meier *Papierrosen*, Meier *Der Besuch*, Betts *Anpassungsversuche*, Widmer *Ds fromme Ross*, Mühlethaler *Die Fowlersche Lösung*)
- https://www.sammlungkeller.ch/media/images/thumbnails/maurer_zyt_schtammgascht_web-200x321.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/maurer_zyt_papierrosen_web-200x321.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/maurer_zyt_besuch_web-200x321.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/maurer_zyt_anpassungsversuche_web-200x321.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/maurer_zyt_ross_web-200x321.jpg
- https://www.sammlungkeller.ch/media/images/thumbnails/maurer_zyt_fowlersche_web-200x306.jpg

Die Bildunterschriften bei Keller nennen für Piatti und Grieder/Herder nur die Nummer, für Heidelbach
nur „Umschlaggestaltung für Haffmans Verlag“, für Wyss Autor und Jahr; Titel stehen auf dem Bild.
Die Titel oben sind vom Umschlag gelesen.

## Empfehlung

1. **Piatti — Steinbeck bei dtv (23).** Kleinster Aufwand, abgeschlossen und bei Keller vollständig;
   ISBN aus der Bandnummer, 15 Ausgaben schon da, 3 schon mit dem Umschlag. Ein guter erster Versuch
   für eine Piatti-Wand.
2. **Piatti — dtv phantastica (37).** Die stärkste Wand im Sinne von „jedes Cover ein anderes Bild“,
   einheitlicher schwarzer Rahmen; ISBN aus der Nummer, aber fast alles muss angelegt werden.
3. **Heidelbach — Haffmans (~60 + 10 Kipling).** Die eindrücklichste Bildsprache der Sammlung,
   aber am meisten Handarbeit (Titel abschreiben, ISBN über DNB). Möglich als zwei Wände: Krimis und
   Kipling-Werkausgabe.
4. **Grieder — Herder Bücherei (45).** Bildhaft und bunt, frühe Nummern besonders; Arbeit wie bei
   Wirths Fischer Bücherei (vor der ISBN, Titel vom Bild).
5. **Wyss — Ex Libris (53).** Nur, wenn „ein Künstler, ein Verlag“ als Grenze reicht; keine
   nummerierte Reihe, etwa jeder fünfte Umschlag typografisch.

Nicht empfohlen: Piattis sonderreihe dtv (100, abstrakt) und Wirths Fischer doppelpunkt (typografisch) —
beides Reihen, bei denen sich nur die Farbe ändert. Maurers Zytglogge-Reihe ist billig (Ausgaben
vorhanden, nur Bilder fehlen), aber das Motiv ist klein und das Layout überall gleich.

Kontaktbögen (nur Vorschaubilder, lokal, nicht im Repository): im Scratchpad der Sitzung vom
2026-09-28 unter `keller/sheets/` (`piatti_dtv_phantastica.jpg`, `piatti_dtv_steinbeck.jpg`,
`heidelbach_haffmans.jpg`, `grieder_herder_buecherei.jpg`, `wyss_ex_libris.jpg`, `maurer_zytglogge.jpg`
sowie die ausgeschiedenen Reihen). Der Scratchpad ist flüchtig; wer die Bögen braucht, baut sie aus den
URLs oben neu.
