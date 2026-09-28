# Edelmann: Vorbilder auf der Seite der Sammlung Keller?

Frage (Julian, 2026-09-28): Auf https://www.sammlungkeller.ch/edelmann-heinz.html sind
einige Umschläge als *Inspiration* für Heinz Edelmann gezeigt, nicht als seine eigenen
Entwürfe. Welche sind es, und steckt darunter eine Verlagsreihe mit Bild auf jedem Umschlag,
aus der eine Sammlungswand (20+) werden könnte?

Stand: recherchiert 2026-09-28, nichts hochgeladen, nichts an `data/collections.json` geändert.

## Ergebnis: Die Seite zeigt keine Vorbild-Umschläge

Gemessen, nicht geschätzt:

- **Die Seite hat keine Unterseiten.** Die Rubriken „Fischer Bücherei, Reihe Hanser,
  J.R.R. Tolkien, Bilderbücher, Magazine, Tonträger, Ausstellungskataloge“ sind Anker auf
  derselben Seite. Die einzigen weiteren `.html`-Links sind Navigation (Künstler-Index,
  Preview, Philosophie, Kontakt). `robots.txt` gibt es nicht (404), also keine Sperre.
- **212 Bilder, 207 Vollbild-Links, jede Bildunterschrift nennt Edelmann** (als Urheber,
  „zugeschrieben“ oder als Gestalter der Reihe). Geprüft einmal im statischen HTML und einmal
  in der gerenderten Seite im Browser (dieselben 212 Bilder, keine iframes, nichts
  nachgeladen). Die vier Kopfbilder des Sliders (`edelmann_header_1/3/5/6_web.jpg`) sind
  Ausschnitte aus Edelmanns eigenen Bilderbüchern und Umschlägen.
- **Kein Text spricht von Vorbild, Inspiration, Anregung oder Hommage.** Der einzige Treffer
  für „Einfluss“ ist die Kurzbiographie: Edelmann habe „stilbildende Einflüsse auf das
  Design der 1960er und 1970er Jahre“ gehabt — also Einfluss *von* ihm, nicht *auf* ihn.
- **Keine andere Künstlerseite der Sammlung erwähnt Edelmann** (alle 33 Seiten des
  Künstler-Index einzeln abgerufen, je 2 s Pause, auf „Edelmann“ durchsucht: 0 Treffer).
- **Keine ältere Fassung der Seite im Internet Archive** (CDX-Abfrage für
  `sammlungkeller.ch/edelmann-heinz.html`, mit und ohne `www`: leer). Ob die Seite früher
  einen solchen Abschnitt hatte, lässt sich also nicht prüfen.

Also: Liste (1) ist leer. Es gibt auf der Seite keine Vorbild-Umschläge mit Bildunterschrift.

### Was vermutlich gemeint war (drei Kandidaten für die Verwechslung)

| Was | Wo | Warum es wie „Inspiration“ aussehen kann |
|---|---|---|
| **Horst Bienek: Die Zelle** (Hanser 1968) | [Vollbild](https://www.sammlungkeller.ch/media/images/wirth_hanser_bienek-zelle_web-large.jpg); Unterschrift „Heinz Edelmann, Gestaltung des Schutzumschlags für den Carl Hanser Verlag, 1968.“ | Das einzige Bild der Seite, dessen Dateiname nicht mit `edelmann_` beginnt, sondern mit `wirth_` (Kurt Wirth, Berner Grafiker, auch in der Sammlung). Die Unterschrift nennt trotzdem Edelmann; auf Wirths Seite ist der Umschlag nicht. Schon in `heinz-edelmann-various-publishers/manifest.json` (Nr. 7) mit diesem Vorbehalt vermerkt. |
| **Jules Verne, Werke in 20 Bänden** (Fischer-Bücherei JV, um 1970) | z. B. [Bd. 3](https://www.sammlungkeller.ch/media/images/edelmann_jv03_web-large.jpg), [Bd. 5](https://www.sammlungkeller.ch/media/images/edelmann_jv05_web-large.jpg), [Bd. 9](https://www.sammlungkeller.ch/media/images/edelmann_jv09_web-large.jpg) | Edelmanns Collagen verwenden die Holzstiche der französischen Hetzel-Ausgaben (19. Jh.) als Material — sichtbar etwa bei „Die Kinder des Kapitäns Grant“. Das ist Zitat *in* Edelmanns Entwurf, kein eigener Umschlag eines anderen; Keller nennt die Stecher nicht. Schon gestagt in `jules-verne-covers-by-heinz-edelmann/`. |
| **Fischer Bücherei vor Edelmann: Kurt Wirth** | Nicht auf Edelmanns Seite, sondern auf https://www.sammlungkeller.ch/wirth-kurt.html | Die Fischer-Bücherei-Umschläge, die Edelmann 1966–68 zeichnete (Keller: „stilbildende Umschläge für das Serienlayout“), stehen im selben Reihenlayout (Farbband, Fischer-Signet, weisses Bildfeld), das Kurt Wirth in den 1950er/60er Jahren mit Dutzenden Umschlägen geprägt hat. Wer beide Seiten nacheinander ansieht, kann Wirth leicht für Edelmanns Vorbild halten — Keller sagt das aber nirgends. |

## (2) Reihen-Kandidat — nicht aus der Frage, sondern daneben: Fischer Bücherei, Umschläge von Kurt Wirth

Weil (1) leer ist, gibt es streng genommen keinen Kandidaten. Der naheliegende Ersatz, und der
einzige, der Julians Vorliebe (jeder Umschlag ein eigenes Bild) trifft:

- **Reihe:** Fischer Bücherei (Taschenbuchreihe), Reihenlayout mit farbigem Kopfband und Bildfeld
- **Verlag:** Fischer Bücherei / S. Fischer, Frankfurt am Main
- **Jahre:** laut Keller „ca. 1950er bis 1960er-Jahre“; Nummern 1 bis ca. 830
- **Gestalter:** Kurt Wirth (1917–1996, Bern) — Pinselzeichnung, Collage, Aquarell; kleine Signatur „wirth“ am Bildrand
- **Umfang:** Keller zeigt **84** Wirth-Umschläge der Fischer Bücherei (Nr. 1, 5, 19, 45 … 831), dazu 18 „Fischer doppelpunkt“ und 11 S.-Fischer-Hardcover. Wie viele Wirth insgesamt gezeichnet hat, ist nicht ermittelt; die Reihe hatte andere Gestalter daneben (Edelmann, u. a.).
- **Kellers Bildunterschrift:** „Kurt Wirth, Umschlaggestaltung für den Fischer Taschenbuch-Verlag ca. 1950er bis 1960er-Jahre, Nr. …“ — nur Nummer, **kein Titel**; Titel und Autor stehen nur auf dem Umschlagbild.
- **Open Library, gemessen an einer Stichprobe von 12** (jedes siebte Wirth-Bild bei Keller;
  je eine Abfrage `search.json?q=title:"…" publisher:fischer` mit Editionsfeldern, dann die
  gefundenen Umschläge angesehen):
  - mit **Wirths Umschlag** bei Open Library: **2 von 12** — Rochefort, *Das Ruhekissen* (OL50033163M, 1962, cover 14548849) und Castonier, *Das vergessene Cottage* (OL61490102M, 1969, cover 15204615)
  - Fischer-Ausgabe der Zeit vorhanden, aber **ohne Umschlag** oder mit einem anderen: 5 (Zuckmayer *Engele von Loewen* 1963/65, Jünger *Zwei Schwestern* 1966, Th. Mann *Felix Krull* 1954 = Leinen, Wilder *San Luis Rey* 1952 = älterer Fischer-Umschlag, Saint-Exupéry nur spätere Ausgaben)
  - **keine** Fischer-Ausgabe gefunden: 5 (Gorki, Benaya, Faulkner, Pérez de Ayala; Colette nur spätere)
  - Hochgerechnet: etwa jeder sechste Wirth-Umschlag liegt bei Open Library, also grob 10–20 der 84 bei Keller. Eine Wand mit 20+ braucht dieselbe Arbeit wie Edelmanns Reihe Hanser: Bilder von Keller, Titel vom Umschlag abschreiben, Ausgaben anlegen, von Hand hochladen.
- **Beispielbilder** (Vollbild bei Keller, Titel vom Umschlag gelesen):
  - Nr. 1 Thornton Wilder, *Die Brücke von San Luis Rey* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0001_web-large.jpg
  - Nr. 234 Saint-Exupéry, *Südkurier / Frühe Schriften* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0234_web-large.jpg
  - Nr. 407 Colette, *Eifersucht* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0407_eifersucht-large.jpg
  - Nr. 479 Christiane Rochefort, *Das Ruhekissen* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0479_ruhekissen-large.jpg
  - Nr. 539 Maxim Gorki, *Unter fremden Menschen* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0539_web-large.jpg
  - Nr. 594 Margaret Benaya, *Der brennende Wind* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0594_web-large.jpg
  - Nr. 626 William Faulkner, *Das verworfene Erbe* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0626_web-large.jpg
  - Nr. 639 Thomas Mann, *Bekenntnisse des Hochstaplers Felix Krull* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0639_web-large.jpg
  - Nr. 654 Carl Zuckmayer, *Engele von Loewen* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0654_web-large.jpg
  - Nr. 740 Friedrich Georg Jünger, *Zwei Schwestern* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0740_web-large.jpg
  - Nr. 773 Ramón Pérez de Ayala, *Tiger Juan* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0773_web-large.jpg
  - Nr. 831 Elisabeth Castonier, *Das vergessene Cottage* — https://www.sammlungkeller.ch/media/images/wirth_fischer-buecherei_0831_web-large.jpg

Nebenbei gesehen, nicht gemessen: Celestino Piattis Seite (https://www.sammlungkeller.ch/piatti-celestino.html)
zeigt 99 Umschläge der *dtv sonderreihe* und 36 von *dtv phantastica*, ebenfalls je ein eigenes Bild.
Mit Edelmann hat das nichts zu tun; nur als weitere Reihe aus derselben Sammlung.

## (3) Empfehlung

**Aus der gestellten Frage: keine Reihe** — die Seite zeigt keine Vorbild-Umschläge, also
kann daraus auch keine Sammlung werden. Bevor weiter gesucht wird, sollte Julian sagen, wo er
die „Inspiration“ gesehen hat (anderes Buch, Katalog „Die 51 schönsten Buchumschläge“, eine
andere Website?).

**Falls eine Fischer-Wand gewollt ist: Kurt Wirths Fischer Bücherei** ist der beste Kandidat
in der Nähe — bildhaft, jeder Umschlag anders, 84 Vorlagen bei Keller, und sie stünde als
Vorgänger neben Edelmanns zehn Fischer-Bücherei-Umschlägen. Dagegen spricht der Aufwand: bei
Keller keine Titel, bei Open Library nur etwa jeder sechste Umschlag. Sie wäre eine neue
Gestalter-Sammlung (Kurt Wirth), keine Edelmann-Sammlung; ob sie auf die Roadmap kommt, ist
Julians Entscheidung.

## Wie gemessen

Alles einmal abgerufen, eine Anfrage nach der anderen mit 1,5–2 s Pause; kein Google Books.
Kontaktbogen der zwölf Wirth-Beispiele (nicht im Repository): im Scratchpad der Sitzung,
`insp/wirth_fischer_sample.jpg`. Einen Kontaktbogen der Vorbild-Umschläge gibt es nicht,
weil es keine gibt.
