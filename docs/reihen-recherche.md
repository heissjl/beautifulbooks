# Verlagsreihen mit einheitlichem Coverkonzept: wer als nächste Sammlung taugt

Stand: 2026-09-26. Claude hat das recherchiert, weil Julian gefragt hat:

> „start an agent to make deep research on publisher websites (german, english, french, uk) to find book series with a coherent cover concept"

Gehört zu ROADMAP **5.10j** (unter 5.10). Ich habe keinen Code geändert und keine Sammlung angelegt. Die Stichproben stehen auch in der [Historie](history.md). Diese Recherche setzt die Messung aus 5.10e fort (edition suhrkamp, Clothbound, Vintage, Reclam, NYRB, Bibliothek Suhrkamp). Nicht mehr betrachtet habe ich, was es schon gibt oder was gerade entsteht: SF Masterworks in allen Fassungen, edition suhrkamp, suhrkamp taschenbuch, BasisBibliothek, Bibliothek der Erinnerung, die Reihen mit Heinz Edelmann, Clothbound, Feminist Press, Tiptree und Hugo.

## 1. Das Ergebnis in sechs Sätzen

1. **Recherchiert habe ich 84 Reihen, 55 davon mit Stichprobe bei Open Library.** Davon sind 24 aus deutschen Verlagen, 34 aus britischen und US-amerikanischen und 26 aus französischen. Die Stichprobe hat 441 ISBNs, einzeln nacheinander abgefragt. **Die Cover habe ich mir angesehen**, auf Kontaktbögen aus den Open-Library-Bildern.
2. **Die gute Nachricht: Open Library hat bei den englischen Reihen oft die ISBN, und das Cover liegt dann fast immer im Reihendesign.** Bei 21 der 25 Reihen der Rangliste waren alle Cover, die ich sehen konnte, im Reihendesign. Bei den übrigen vier waren einzelne anders: bei der Library of America ein leeres Schwarz und zwei Leineneinbände, bei den NYRB Children's eine Textseite, bei Persephone ein Vorsatzpapier, bei den Rowohlts Monographien eine Titelseite.
3. **Die schlechte: Bekannte Titel verzerren die Stichprobe nach oben.** Wo ich zusätzlich zufällig gezogen habe, fiel die Abdeckung deutlich:
   - insel taschenbuch: 8 von 8 bekannten Titeln mit Cover, aber 2 von 12 zufälligen
   - Reclam UB: 7 von 10 gegen 2 von 12
   - Library of America: 8 von 8 gegen 7 von 12

   Eine Wand wird also lückenhafter, als die erste Zahl verspricht, außer bei Reihen, die auch zufällig gut abschneiden: Verso Radical Thinkers 11 von 12, Semiotext(e) 8 von 12, Rowohlts Monographien 6 von 12.
4. **Junge und kleine Verlage fehlen bei Open Library fast ganz**, so schön ihre Cover sind:
   - Fitzcarraldo 1 von 7
   - Pushkin Vertigo 0 von 6
   - Naturkunden 0 von 8
   - Friedenauer Presse 0 von 8
   - Wagenbach SALTO 1 von 8
   - Insel-Bücherei, neue Bände: 0 von 8
   - Notting Hill Editions 0 von 7
   - Faber Poetry 1 von 8

   Solche Reihen gingen nur mit hochgeladenen Covern, wie bei den 49 Relaunch-Covern (5.10c).
5. **Frankreich lohnt sich.** Der Katalog der BnF liefert über seine SRU-Schnittstelle zu jeder Verlagsreihe alle Bände mit Nummer und ISBN (Abschnitt 5). Das ist die beste Listenquelle der ganzen Recherche. Poésie/Gallimard (Massin) hatte 6 von 7 mit Cover, alle sechs im Design.
6. **Vorschlag für die nächsten fünf Entwürfe** (Abschnitt 6):
   - Library of America
   - Poésie/Gallimard
   - Penguin English Library
   - Ballantine Adult Fantasy
   - Verso Radical Thinkers

   Als kleiner schneller Ersatz: Penguin Drop Caps.

## 2. Wie gemessen wurde

- **Recherche:** drei Agenten, je einer für Deutschland, UK/USA und Frankreich. Quellen waren die Verlagsseiten, Wikipedia, der BnF-Katalog und die Designpresse (Creative Review, It's Nice That, Eye, Fonts In Use, Design Observer, Casual Optimist, Tombolo, Livres Hebdo). **robots.txt wurde beachtet:**
  - noosfere.org sperrt KI-Crawler; nach einer Seite haben wir dort aufgehört.
  - ISFDB antwortet mit 403.
  - mhpbooks.com (Melville House) sperrt alles.
  - Die BnF verlangt 5 s zwischen Abrufen.

  Logins gab es keine, Google Books wurde nie gefragt.
- **Die ISBNs** stammen aus den Quellen und sind nicht geraten. Ausnahmen sind Reihen, deren Bandnummer in der ISBN steckt: Reclam `3-15-0NNNNN`, dtv `3-423-0NNNN`, insel taschenbuch `3-458-317NN` (it N → 31700+N), Rowohlts Monographien `3-499-50NNN`, Ballantine Adult Fantasy `0-345-0NNNN` aus der Katalognummer. Dort habe ich die Prüfziffer gerechnet.
- **Open Library:** `openlibrary.org/isbn/<isbn>.json` wurde einzeln nacheinander abgefragt, mit 1,5 s Pause. „Mit Cover“ heißt: das Feld `covers` enthält eine positive ID. Die Cover habe ich danach in Größe M geladen und angesehen.
- **Zwei Arten von Stichprobe:**
  - *bekannt*: 2–9 ISBNs, die die Quelle nannte. Das sind meist berühmte Titel, die Zahl ist also optimistisch.
  - *zufällig*: 12 ISBNs, zufällig aus einer vollständigen Liste oder aus dem Nummernraum gezogen (Seed 20260926 bzw. 926).
- **Spalte „im Design“:** so viele der gefundenen Cover zeigen das Reihendesign, nach Augenschein.

## 3. Rangliste

Gewichtet habe ich so: Wie einheitlich und schön ist die Wand? Passt der Umfang (etwa 20–300)? Gibt es eine geordnete Liste mit ISBN? Wie viele Cover hat Open Library?

**Spalten:** OL = ISBN bei Open Library gefunden / mit Cover / davon im Reihendesign. **Liste:** ✔ = geordnete Liste mit ISBNs; (✔) = Liste mit Titeln, ISBN rechenbar oder aus einer zweiten Quelle; ✘ = keine.

| # | Reihe | Verlag, Land | Gestaltung | Konzept in einem Satz | Umfang | Liste | OL bekannt | OL zufällig |
|---|---|---|---|---|---|---|---|---|
| 1 | **Library of America** | LoA, USA, 1982– | Bruce Campbell | Schwarzer Schutzumschlag, Autorenporträt, Name in Schreibschrift, rot-weiß-blaues Band | 380+, nummeriert | ✔ [en.wikipedia](https://en.wikipedia.org/wiki/Library_of_America), 512 ISBNs im Wikitext; OL-Liste [OL232575L](https://openlibrary.org/people/brentjunger/lists/OL232575L) | 8/8, 8/8, 7/8 | 12/12, 7/12, 5/7 |
| 2 | **Poésie/Gallimard** | Gallimard, FR, 1966– | Robert Massin | Das Porträt des Dichters fünfmal in Farbvarianten als Band über Vorderseite und Rücken, sonst weiß mit NRF-Typografie | 744 Einträge bei der BnF, nummeriert | ✔ BnF-Reihe `cb342345069` | 7: 6/7, 6/7, 6/6 | — |
| 3 | **Penguin English Library** | Penguin, UK, 2012– | Coralie Bickford-Smith mit rund 20 Illustratoren | Rapportmuster aus Motiven des Romans, festes Typoband | 100 (2012), nicht nummeriert | ✔ [taleaway](https://taleaway.com/penguin-english-library-complete-list/), [penguin.co.uk](https://www.penguin.co.uk/series/PENENGLIB/the-penguin-english-library) | 9/9, 6/9, 6/6 | — |
| 4 | **Semiotext(e) Intervention Series** | Semiotext(e)/MIT, USA, 2009– | Hedi El Kholti | Einfarbige Fläche, kleine Groteskzeile oben, Reihenlogo unten; nach Nummer wechselt die Farbe | ~40, nummeriert | ✔ [en.wikipedia](https://en.wikipedia.org/wiki/Semiotext(e)) (30 ISBNs) | 8/8, 8/8, 8/8 | 12/12, 8/12, 8/8 |
| 5 | **Verso Radical Thinkers** | Verso, UK/USA, 2005– | Sets 1–3: Kraftpapier, großer Autorenname, „V“ mit Klammer; ab Set 4: Rumors (Andy Pressman), Strichzeichnung auf Weiß | Zwei klare Epochen, jede für sich streng | ~130 in Sets | ✔ [List of Radical Thinkers releases](https://en.wikipedia.org/wiki/List_of_Radical_Thinkers_releases), 81 ISBNs | 8/8, 8/8, 8/8 | 12/12, **11/12**, 11/11 |
| 6 | **Ballantine Adult Fantasy** | Ballantine, USA, 1969–74 | Hg. Lin Carter; meist Gervasio Gallardo, auch LoGrippo, Pepper | Psychedelisch-surreale Malerei, Einhorn-Kolophon | 65 (+18 Vorläufer) | (✔) [en.wikipedia](https://en.wikipedia.org/wiki/Ballantine_Adult_Fantasy_series) mit Katalognummern → SBN → ISBN | 4/5, 3/5, 3/3 | — |
| 7 | **Penguin Drop Caps** | Penguin US, 2012–14 | Jessica Hische | Ein gezeichneter Initialbuchstabe je Band, A–Z; die Farben laufen als Regenbogen | 26 | ✔ [beautifulbooks.info](https://beautifulbooks.info/penguin-drop-caps/) | 8/8, 7/8, 7/7 | — |
| 8 | **insel taschenbuch** (frühe Jahre) | Insel, DE, 1972– | Willy Fleckhaus | Pastellkarton in zehn Farben, klassizistische Typografie, Vignette aus alter Buchillustration | 3000+, nummeriert | (✔) ISBN aus it-Nummer; [BookBrainz](https://bookbrainz.org/series/81b89929-fb52-4841-84e7-0957ad47357d) teilweise | 8/8, 8/8, 8/8 | 6/12, **2/12**, 2/2 |
| 9 | **Penguin Great Ideas** | Penguin, UK, 2004–20 | David Pearson, Phil Baines, Catherine Dixon, Alistair Hall | Nur Typografie, jeweils im Stil der Entstehungszeit des Textes, geprägt, cremefarben | 120 in 6 Sets | ✔ Titel: [en.wikipedia](https://en.wikipedia.org/wiki/Penguin_Great_Ideas); ISBNs: [PRH BM5](https://www.penguinrandomhouse.com/series/BM5/penguin-great-ideas/) | 8/8, 5/8, 5/5 | — |
| 10 | **L'Imaginaire** | Gallimard, FR, 1977– | nicht belegt | Weiß, der Titel als eigene Bild-Typografie je Band, das Reihenlogo als Farbstreifen | 851 bei der BnF, nummeriert | ✔ BnF `cb34226014t` | 7: 4/7, 4/7, 4/4 | — |
| 11 | **Rowohlts Monographien** | Rowohlt, DE, 1958–2015 | erste Gestaltung Werner Rebhuhn | Porträtfoto mit Farbfeld und rororo-Kästchen; über die Jahrzehnte leicht verändert | 674, nummeriert | ✔ [de.wikipedia](https://de.wikipedia.org/wiki/Liste_von_Rowohlts_Monographien) mit ISBNs | 6/6, 4/6, 3/4 | 11/12, 6/12, 6/6 |
| 12 | **Penguin Orange Collection** | Penguin Classics US, 2016 | Penguin US, AIGA 50 Books | Das orange-weiße Dreiband von 1935, mit Illustration, französische Klappen | 12 | ✔ [PRH PNG](https://www.penguinrandomhouse.com/series/PNG/penguin-orange-collection/) | 8/8, 8/8, 8/8 | — |
| 13 | **Little Black Classics** | Penguin, UK, 2015–16 | Penguin UK | Schwarz, weiße Schrift, 64 Seiten, die Nummer groß | 128, nummeriert | ✔ [en.wikipedia](https://en.wikipedia.org/wiki/Little_Black_Classics), [penguin.co.uk LBC](https://www.penguin.co.uk/series/LBC/penguin-little-black-classics) | 8/8, 4/8, 4/4 | — |
| 14 | **Éditions de Minuit** (Nouveau Roman) | Minuit, FR, 1945– | Hausstil, Stern-m von Vercors | Weiß, blauer Rahmen, schwarz-blaue Schrift | Hausstil, keine Reihe; als Auswahl (Beckett, Robbe-Grillet, Duras, Simon) | ✘, Auswahl nötig | 6/6, 4/6, 4/4 | — |
| 15 | **Rivages/Noir** | Rivages, FR, 1986– | nicht belegt | Schwarz, Foto oder Filmstill, weiße Blockschrift | 1.355 bei der BnF, nummeriert | ✔ BnF `cb342436563` | 7/8, 5/8, 5/5 | — |
| 16 | **Diogenes detebe** | Diogenes, CH, 1971– | Typografie Tomi Ungerer; das Rahmenlayout von 1985 ist unbelegt | Weiß, Gemälde in dünnem Rahmen, Didot | Tausende, nummeriert ab 20001 | (✔) [buch-sammler.de](https://www.buch-sammler.de/verlagsreihe/diogenes-taschenbuch-detebe.7) | 4/6, 3/6, 3/3 | — |
| 17 | **Virago Modern Classics Designer Collection** | Virago, UK, 2008–23 | je Band ein Textil- oder Modedesigner (Orla Kiely, Cath Kidston …) | Stoffmuster über das ganze Cover, kleines Titelschild | ~28 | ✔ [beautifulbooks.info](https://beautifulbooks.info/virago-designer-collection/) | 8/8, 4/8, 4/4 | — |
| 18 | **Melville House – The Art of the Novella** | Melville House, USA, 2004– | Hausgestaltung | Nur Typografie auf einer satten Pantone-Fläche | ~56 | ✔ [PRH ATN](https://www.penguinrandomhouse.com/series/ATN/the-art-of-the-novella/) | 5/8, 4/8, 4/4 | — |
| 19 | **Découvertes Gallimard** | Gallimard, FR, 1986– | Pierre Marchand | Kleines Kunstbuchformat, randloses Bild, fester Titelblock | 588+, nummeriert | ✔ [fr.wikipedia](https://fr.wikipedia.org/wiki/Liste_des_volumes_de_%C2%AB_D%C3%A9couvertes_Gallimard_%C2%BB), BnF `cb342469648` | 6: 4/6, 4/6, 4/4 | — |
| 20 | **Persephone Books** | Persephone, UK, 1999– | Hausgestaltung | Taubengrauer Umschlag, Titelschild, Vorsatz aus zeitgenössischem Stoff | 155, nummeriert | ✔ Shop `products.json` (Nummer als SKU) | 4/6, 3/6, 2/3 | — |
| 21 | **Reclams Universal-Bibliothek** | Reclam, DE, gelb seit 1970 | Finsterer, Willberg, Forssman/Feyll | Gelb, Holzschnitt oder Foto, feste Kopfzeile | über 20.000 | (✔) ISBN aus UB-Nummer | 10/10, 7/10, 7/7 | 3/12, 2/12, 2/2 |
| 22 | **Présence du futur** | Denoël, FR, 1954–2000 | u. a. Florence Magnin | Bis 1975 typografisch, dann ein Bild im Kreis, später ganzseitig: drei Epochen | 666, nummeriert | ✔ [fr.wikipedia](https://fr.wikipedia.org/wiki/Pr%C3%A9sence_du_futur), BnF `cb34232115p` | 5/8, 3/8, 3/3 | — |
| 23 | **NYRB Children's Collection** | NYRB, USA, 2003– | Hausgestaltung | Farbiges Rückenband, Originalillustration | ~99–126 | ✔ nyrb.com `products.json` (`NYRB Kids`), [beautifulbooks.info](https://beautifulbooks.info/nyrb-childrens-collection/) | 8/8, 6/8, 5/6 | — |
| 24 | **Zulma** | Zulma, FR, 2006– | David Pearson | Weißes Dreieck mit Titel über einem handgemachten Muster je Buch | Hausstil, ~200 | ✘ (BnF nach Verlag) | 4/8, 2/8, 2/2 | — |
| 25 | **Heyne Bibliothek der Science Fiction Literatur** | Heyne, DE, 1981–2001 | Hg. Wolfgang Jeschke; Illustratoren nicht belegt | „Weiße Reihe“: weiß, Reihenkopf, quadratisches Farbbild | ~105, nummeriert | (✔) [de.wikipedia](https://de.wikipedia.org/wiki/Bibliothek_der_Science_Fiction_Literatur), ohne ISBNs | 2/3, 2/3, 2/2 | — |

### Zu einzelnen Plätzen

- **Library of America** steht vorn, obwohl nur 7 von 12 zufälligen Bänden ein Cover haben. Die Liste ist vollständig, nummeriert und hat ISBNs; die Wand ist einheitlich und doch nicht eintönig, weil jedes Porträt anders ist; und seit 5.10f gibt es dazu eine Open-Library-Liste. Zwei der sieben zufälligen Cover zeigen den Leineneinband statt des Umschlags. Die sortiert ein Mensch aus.
- **Poésie/Gallimard** wäre die erste französische Sammlung und das stärkste Design der Recherche. Die fünf farbigen Porträts ergeben auf einer Wand ein Band. Sinnvoll ist ein Ausschnitt: die Massin-Jahre bis Anfang der 1990er, nach eigener Angabe des Verlags danach gelockert.
- **Verso Radical Thinkers** hat die beste zufällige Abdeckung aller Reihen (11 von 12). Die zwei Designs würde ich als zwei Blöcke der Wand zeigen oder nur Sets 1–3 nehmen.
- **insel taschenbuch** ist das deutsche Gegenstück zur edition suhrkamp (Fleckhaus). Zufällig gezogen haben aber nur 2 von 12 ein Cover. Das geht nur mit einer kuratierten Auswahl bekannter Titel.
- **Penguin Orange Collection** (12) und **Drop Caps** (26) sind klein genug, um sie in einer Sitzung fertig zu machen.

## 4. Die längere Liste

Alle weiteren Reihen, mit Stichprobe, sofern es eine gab. „vor ISBN“ heißt: die Reihe erschien ganz oder im interessanten Teil ohne ISBN; für eine Wand müssten Ausgaben per Suche gefunden werden, nicht per ISBN.

### Deutsch

| Reihe | Gestaltung, Konzept | Umfang, Liste | OL |
|---|---|---|---|
| Bibliothek Suhrkamp | Fleckhaus ab 1959; weißer Umschlag, Farbband im Quadrat | 1.550, [Liste mit ISBNs](https://de.wikipedia.org/wiki/Liste_der_B%C3%A4nde_der_Bibliothek_Suhrkamp) | aus 5.10e: 6/20, 3/20 |
| Insel-Bücherei | Buntpapier und Titelschild seit 1912 | 1.569+, [Liste ohne ISBNs](https://de.wikipedia.org/wiki/Liste_der_Titel_der_Insel-B%C3%BCcherei) | neue Bände: 0/8; ältere vor ISBN |
| dtv, Piatti-Zeit (1961–90er) | Celestino Piatti: weiß, Akzidenz-Grotesk rechts, eine Zeichnung | nummeriert, keine Liste | dtv 1: 1/1 mit Cover; zufällig 6/12, 4/12, kaum Piatti (heutige Drucke tragen andere Cover) |
| Die Andere Bibliothek | Greno bis 2007 einheitlich, ab 2012 je Band anders | 485+, [Liste ohne ISBNs](https://de.wikipedia.org/wiki/Liste_von_Werken_in_der_Anderen_Bibliothek) | 2/2, 1/2 (Bild zeigt den Rücken) |
| Manesse Bibliothek der Weltliteratur | Duodez, Leinen, Goldprägung | 700+, Liste ohne ISBNs | 0/2 |
| Weiße Reihe – Lyrik international (Volk und Welt) | Horst Hussel, Lothar Reher; weiß mit Vignette | 113, [Liste mit ISBNs](https://de.wikipedia.org/wiki/Wei%C3%9Fe_Reihe_Lyrik_international) | 1/6, 1/6 |
| Spektrum, „die schwarze Reihe“ (Volk und Welt) | Lothar Reher; schwarz, Garamond, eine Collage je Band | 279, [Liste](https://de.wikipedia.org/wiki/Spektrum_(Buchreihe)) | nicht gemessen |
| Die Tollen Hefte | je Heft ein Illustrator, einheitliches Format | 50, [Liste mit ISBNs](https://de.wikipedia.org/wiki/Die_Tollen_Hefte) | 2/8, 1/8 |
| Poesiealbum (DDR) | Grundlayout Peter Nagengast, Grafik je Heft | 275, [Liste](https://de.wikipedia.org/wiki/Poesiealbum_(Lyrikreihe)) | nicht gemessen (Periodikum) |
| Bücherei Der jüngste Tag | Kurt Wolff, 1913–21, einheitliche Hefte | 86, [Liste](https://de.wikipedia.org/wiki/Liste_der_B%C3%A4nde_der_B%C3%BCcherei_Der_j%C3%BCngste_Tag) | vor ISBN |
| rororo, Gröning/Pferdmenges (1950er) | rund 350 Umschläge aus wiederkehrenden Motiven | nummeriert | vor ISBN |
| Wagenbach SALTO | rotes Leinen, Titelschild | unnummeriert, [Verlag](https://www.wagenbach.de/buecher/salto.html) | 1/8, 1/8 |
| Wagenbach Quarthefte | schwarz, nach dem Vorbild des Jüngsten Tags | nummeriert | vor ISBN |
| Merve IMD | Rhombus von Jochen Stankowski, Farbe nach Nummer | nummeriert, [isotype.ch](https://isotype.ch/home/imd/) | 2/3, 0/3 |
| Naturkunden (Matthes & Seitz) | Judith Schalansky; Leinen, Porträts | nummeriert | 1/8, 0/8 |
| Friedenauer Presse – Wolffs Broschur | typografische Broschuren | 53, [Verlag](https://www.matthes-seitz-berlin.de/friedenauer-presse/reihe/friedenauer-presse-wolffs-broschur.html) | 0/8 |
| Die Graphischen Bücher (Faber & Faber Leipzig) | je Band ein Künstler, Originalgrafik | 46 | nicht gemessen, keine Liste |
| Sammlung Luchterhand | Hannes Jähn; Franklin Gothic Extra Condensed | nummeriert | nicht gemessen, keine Liste |
| Spectaculum (Suhrkamp) | Fleckhaus/Staudt (unbelegt) | ~80, Anthologien | nicht gemessen |
| Rotbuch, Bücher der Neunzehn, Fischer Bücherei, Edition Akzente | Konzept unbelegt oder uneinheitlich | — | nicht gemessen |

### Englisch

| Reihe | Gestaltung, Konzept | Umfang, Liste | OL |
|---|---|---|---|
| Pelican Books (2014) | Jim Stoddart, Matthew Young; Pelican-Blau, nur Typografie | ~5 im Jahr, keine Liste | 2/2, 1/2 |
| Pelican (1937–84) | Dreiband in Blau | A1…, [penguinfirsteditions](http://www.penguinfirsteditions.com/index.php?cat=pelican001-099) | vor ISBN |
| Penguin Galaxy | schwarze Leinen, leuchtende Typo-Kunst (Trochut, unbelegt) | 6 | 2/2, 1/2 |
| Penguin 60s | Miniaturen, Sets | ~150, teilweise Liste | nicht gemessen |
| King Penguins | Buntpapier nach dem Insel-Vorbild, K1–K76 | 76, [Liste](http://www.penguinfirsteditions.com/index.php?cat=king_penguin) | vor ISBN |
| Penguin Crime, grün (Marber-Raster) | Romek Marber 1961 | keine Liste | vor ISBN |
| Penguin Science Fiction (Facetti, Pelham) | schwarz, Marber-Raster; später Pelham | keine Liste | nicht gemessen |
| NYRB Classics | Katy Homans; Bild mit Titelkasten | 713, Shop-Feed | aus 5.10e: effektiv 5/20 |
| NYRB Poets | einheitlich | 76 | 0/6 (neue 979-ISBNs) |
| New Directions, Alvin Lustig | modernistische Umschläge 1945–55 | 70+ | vor ISBN; Rechte beachten |
| Anchor Books, Edward Gorey | handgeschrieben, Schmuckfarbe, 1953–59 | ~50 | vor ISBN; Gorey Trust |
| Grove/Evergreen, Roy Kuhlman | abstrakt-expressionistisch | 700+ | vor ISBN |
| Ace Doubles (SF) | Kopf-an-Kopf-Format; Illustratoren wechseln | 221, [Liste](https://en.wikipedia.org/wiki/List_of_Ace_SF_double_titles) | vor ISBN |
| Fitzcarraldo Editions | Ray O'Meara; Kleinblau bzw. Weiß, nur Typo | ~210, Sitemap | **1/7**, 1/7 |
| Pushkin Vertigo | Jamie Keenan, Op-Art | PRH PKV | 3/6, **0/6** |
| Faber Poetry | Pentagram 2001, Wolpe früher | Kategorieseite | 8/8, **1/8** |
| Faber Finds | generierte Cover, jedes Exemplar anders | — | ungeeignet |
| Notting Hill Editions | Plain Creative; Leinen in 38 Farben | 51 | 2/7, 0/7 |
| Everyman's Library | einheitliche Umschläge | Hunderte | 7/7, 2/7 |
| Peirene Press | Sacha Davison Lunt; creme, Bildausschnitt | ~40 | nicht gemessen |
| Hogarth Press, Vanessa Bell | Künstlerin, keine Reihe | — | vor ISBN |
| Olympia Press, Traveller's Companion | grüne Typo-Umschläge | — | vor ISBN |
| Canongate Canons, Vintage Minimalist | kein durchgehendes System gefunden | — | — |

### Französisch

| Reihe | Gestaltung, Konzept | Umfang, Liste | OL |
|---|---|---|---|
| Série noire | Duhamel; schwarz-gelb, weißer Rand | 2.800+, [Liste](https://fr.wikipedia.org/wiki/Liste_des_ouvrages_publi%C3%A9s_dans_la_S%C3%A9rie_noire_(1945-2005)), BnF `cb34234637v` | 2/9, 2/9 — iconic, aber dünn |
| Folio | Massin 1972; weiß, Baskerville, Bild | 7.000+ | nicht gemessen (keine BnF-Reihe gefunden) |
| Folio SF | violett-silber bis 2015 | 836, BnF `cb37125486s` | 3/5, 3/5 |
| Du monde entier | NRF-Typografie | 2.269, BnF `cb342322943` | 2/5, 2/5 |
| Bibliothèque de la Pléiade | Leder, Farbe nach Jahrhundert | 1.743, BnF `cb34234526x` | 6/6, 5/6 (Umschläge), sehr eintönig |
| Ailleurs et Demain (Laffont) | silbernes Metallpapier, kinetische Muster | 263, BnF `cb34228102k` | 4/8, 2/8 |
| Fleuve Noir Anticipation | René Brantonne (1951–65) | ~2.000, BnF `cb34234750b` | 3/6, 1/6 (nicht Brantonne) |
| Le Rayon fantastique | Jean-Claude Forest | ~119 | vor ISBN |
| J'ai Lu SF | Caza, Siudmak | nummeriert | nicht gemessen |
| Le Livre de poche (1953–) | Raymond; ab 1963 Faucheux | — | vor ISBN |
| Club français du livre | Faucheux, Massin | — | vor ISBN |
| 10/18 | Pierre Bernard (laut Tombolo) | keine BnF-Reihe | nicht gemessen |
| P.O.L | geprägtes Weiß | Hausstil | 5/5, 1/5 |
| Monsieur Toussaint Louverture | Folienprägung, *Blackwater* I–VI | klein | 4/6, 3/6 |
| Actes Sud Babel | schmales Format, Bild | 2.510, BnF `cb34252526v` | 1/6, 1/6 |
| Les Cahiers rouges (Grasset) | einheitlich rot | 370+, BnF `cb34232845j` | 7/8, 1/8 |
| Terre humaine (Plon) | Fotos, kein strenges System | ~100, BnF `cb342320471` | 5/6, 4/6, Design uneinheitlich |
| Allia, Petite collection | Patrick Lébédeff | Katalog-PDF | 3/4, 2/4 |
| Titres, Bibliothèque cosmopolite, Libretto, Petite Bibliothèque Payot | einheitlich, Konzept nicht untersucht | BnF-Reihen vorhanden | nicht gemessen |

## 5. Listenquellen, die sich wiederverwenden lassen

- **BnF SRU** (Frankreich, am ergiebigsten). Die Reihe findet man mit `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&recordSchema=unimarcxchange&query=bib.serialtitle all "<Reihe>" and bib.recordtype any "col"`. Ihre Bände liefert `query=bib.col2bib all "<Ziffern der ark>"`; `cb34232115p` wird dabei zu `34232115`, mit der ganzen ark kommen 0 Treffer. Im UNIMARC stehen die Bandnummer in 225$v, die ISBN in 010$a und der Titel in 200$a. **5 s Pause** (robots.txt). Achtung: Die ISBN gehört manchmal zu einem Nachdruck.
- **Shopify-Feeds:**
  - `nyrb.com/products.json?limit=250&page=N`: 1.463 Produkte; `product_type` trennt NYRB Classics, Poets, Kids, Archipelago und Notting Hill Editions.
  - `persephonebooks.co.uk/products.json`: die SKU ist die Persephone-Nummer.
- **Penguin:** `penguin.co.uk/series/<CODE>/…` (ISBN in den Buch-URLs; Codes LBC, PENENGLIB, EVLC, EVLPP) und `penguinrandomhouse.com/series/<CODE>/` (JSON-LD mit `isbn`; Codes BM5, ATN, PNG, PKV). ISBNs mit 97811016… sind E-Books.
- **Wikipedia-Wikitext** (`index.php?title=…&action=raw`) mit ISBNs: Library of America, Radical Thinkers, Semiotext(e), Rowohlts Monographien, Bibliothek Suhrkamp, Die Tollen Hefte, Weiße Reihe.
- **ISBN aus der Bandnummer:** Reclam, dtv, insel taschenbuch, Rowohlts Monographien, Die Andere Bibliothek (Eichborn), Ballantine (SBN aus der Katalognummer).

## 6. Empfehlung: die nächsten fünf Entwürfe

1. **Library of America.** Die Liste ist vollständig und nummeriert, mit ISBNs; 12 von 12 zufälligen ISBNs kennt Open Library. Einheitlich und doch abwechslungsreich (Porträt und Schreibschrift). Vorschlag: Bände 1–100 als Wand, die Leineneinbände aussortieren.
2. **Poésie/Gallimard, Massin-Jahre.** Die erste französische Sammlung, das stärkste Design der Recherche; die Liste kommt über die BnF-SRU. 6 von 7 mit Cover, alle im Design. Vorher eine zufällige Stichprobe aus der BnF-Liste ziehen; hier gibt es nur die bekannte.
3. **Penguin English Library.** 100 Bände mit vollständiger ISBN-Liste, 6 von 9 mit Cover, alle in Bickford-Smiths Mustern. Die Muster-Schwester der Clothbound Classics; beide nebeneinander wären eine schöne Reihe auf `/collections`.
4. **Ballantine Adult Fantasy.** 65 Bände, die ISBNs lassen sich aus den Katalognummern der Wikipedia-Liste rechnen; 3 von 5 mit Cover, alle mit Einhorn-Kolophon. Passt zu den SF-Masterworks-Sammlungen und hat mit ISFDB eine Künstlerquelle, wenn sie wieder antwortet.
5. **Verso Radical Thinkers.** Die beste zufällige Abdeckung (11 von 12), 81 ISBNs aus Wikipedia. Zwei Designs; Julian entscheidet, ob beide oder nur Sets 1–3.

**Schnell dazwischen:** Penguin Drop Caps (26, eine Sitzung, Regenbogen wie die edition suhrkamp). **Deutsch** kommt in den ersten fünf nicht vor, weil die starken deutschen Konzepte bei Open Library schlecht abgedeckt sind: insel taschenbuch zufällig 2 von 12, Insel-Bücherei 0 von 8, Naturkunden 0 von 8. Am ehesten ginge insel taschenbuch als kuratierte Auswahl von 30–50 Klassikern. **Julian entscheidet.**

## 7. Rechte

Die Sammlungen zeigen Katalog-Cover von Open Library und verlinken sie; das ist derselbe Fall wie bei den bestehenden Sammlungen. Besonders geschützt sind nur Gorey (Edward Gorey Charitable Trust) und Lustig; beide Reihen sind ohnehin vor ISBN und nicht empfohlen. Die Titel- und ISBN-Listen aus Wikipedia, BnF und Verlagsseiten sind Fakten. Beschreibungstexte der Quellen übernehmen wir nicht.
