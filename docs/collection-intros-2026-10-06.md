# Sammlungstexte: Durchsicht und Entwürfe (ROADMAP 5.10n, 2026-10-06)

Julian: „double checke die beschreibungen der collections und entwirf welche, wo noch eine fehlt, aber lass sie mich abnehmen".

**Grundlage:** der Live-Stand, einmal aus Produktion gelesen (`scripts/live-collections.ts`): 56 Sammlungen, 48 veröffentlicht, 26 davon mit dem Inhalt eines Online-Entwurfs. Die Texte unten sind Englisch wie alle Sammlungsdaten. **Nichts davon ist eingetragen.** Was Julian abnimmt, kommt in die Online-Entwürfe (/curate) oder in `data/collections.json` — je nachdem, wo die Sammlung heute ihren Inhalt hat.

## A. Sieben veröffentlichte Sammlungen ohne Text

Fünf haben gar keinen Text, zwei nur einen Link als Text (Feminist Press, Otherwise Award). Alle Entwürfe folgen den vorhandenen Texten: Was die Reihe ist, wie die Umschläge aussehen, was die Wand zeigt. Keine Vollständigkeitsbehauptung.

### feminist-press — Feminist Press (76 Werke, Cover aus dem Katalog)
heute: `https://feministpress.org/`

> The Feminist Press was founded in New York in 1970 by Florence Howe to bring writing by women back into print — Charlotte Perkins Gilman's The Yellow Wallpaper, Agnes Smedley's Daughter of Earth — and went on to publish new writers and women writing in translation. These are books from its list, gathered from a reader's list on Open Library; the cover shown is not always the Feminist Press printing.

Belege: Gründung 1970 durch Florence Howe, *The Yellow Wallpaper* und *Daughter of Earth* (1973) als frühe Nachdrucke (Wikipedia, feministpress.org). Der letzte Halbsatz ist nötig, weil die Wand Katalog-Cover zeigt (z. B. *Native Tongue* in der DAW-Ausgabe).

### hugo-award-novel — Hugo Award — best novel (75)
heute: leer

> The Hugo Award for best novel, voted each year since 1953 by the members of the World Science Fiction Convention. One cover per winning novel, from The Demolished Man, the first winner, to Dune, The Left Hand of Darkness, Neuromancer and the three books of N. K. Jemisin's Broken Earth, which won three years running.

### sf-masterworks-relaunch-international — SF Masterworks — international relaunch covers (165)
heute: leer

> The books of the SF Masterworks relaunch, in other languages: each tile is the cover of a translation, as a French, German, Spanish, Russian, Italian, Polish or Japanese publisher dressed the same novel. In the order of the relaunch list, where Open Library holds a translated edition with a cover. Where ISFDB names the cover artist, the name is under the tile.

Belege: `lab/international-covers/README.md` (Auswahl je Sprache, Reihenfolge entlang der Relaunch-Liste).

### sf-masterworks-rounded — SF Masterworks — the rounded-corner editions (2006) (10)
heute: leer

> In 2006 Gollancz reissued ten of the SF Masterworks with rounded corners and new covers, all ten by Marc Adams as ISFDB credits them.

**Zu prüfen:** Dass die Ausgaben 2006 erschienen und zehn waren, steht im Titel und in der ISBN-Liste aus Wikipedia (history.md, 2026-09-26); warum Gollancz sie so gemacht hat, weiß ich nicht und schreibe es deshalb nicht. Wenn Julian mehr weiß, gehört das hier hin.

### tiptree-award — The Otherwise Award (40)
heute: `https://otherwiseaward.org/`

> The Otherwise Award, founded in 1991 by Pat Murphy and Karen Joy Fowler as the James Tiptree, Jr. Award and renamed in 2019, goes each year to science fiction and fantasy that explores and expands our understanding of gender. One cover per winning book, from China Mountain Zhang to Rakesfall.

### edition-suhrkamp — edition suhrkamp (198)
heute: leer

> Suhrkamp's edition suhrkamp, begun in 1963 in Willy Fleckhaus's design: a plain cover set only in type, the colour changing from volume to volume through the spectrum, so that the series stands on a shelf as a rainbow. The wall shows volumes from the 1970s and 1980s in number order, where Open Library has the cover.

Belege für die Wand: die Cover-ISBNs laufen aufsteigend von es 591 bis etwa es 1473. Das Regenbogen-Prinzip ist bekannt und gut belegt. Die genaue Zahl der Farben (48) lasse ich weg.

### penguin-clothbound-classics — Penguin Clothbound Classics (63)
heute: leer

> From 2008 Coralie Bickford-Smith dressed Penguin's classics in cloth: a pattern taken from a motif of the book, stamped in foil and repeated across coloured cloth.

(Keine Aussage zur Reihenfolge: Julian hat sie online von Hand gesetzt.)

## B. Vorhandene Texte: ein Fehler, drei unbelegte Angaben

**Library of America — Fehler.** Der Text sagt „in Bruce Campbell's jacket design". Laut Library of America selbst stammt der Schutzumschlag von **Robert Scudellari** (frühe 1980er), der Autorenname ist von der schwedischen Kalligrafin **Gun Larson** von Hand geschrieben. Bruce Campbell wird im AIGA-Archiv für die Gestaltung der Reihe 1982 genannt — also das Buch selbst, nicht der Umschlag. Vorschlag:

> Volumes of the Library of America in the jacket Robert Scudellari designed in the early 1980s: black, with a small portrait of the author, the name lettered by hand by Gun Larson, and a red, white and blue band.

**Nicht belegt in einer kurzen Suche** (nicht falsch, nur ohne Quelle gefunden):
- *Spektrum — Volk und Welt:* „1968 to 1993, 279 titles". Gefunden: Die Reihe lief ab 1968 und verkaufte bis 1989 fast fünf Millionen Exemplare. Das Ende 1993 und die Zahl 279 habe ich nicht gefunden.
- *Reihe Hanser:* „begun in 1967 with Canetti's Die Stimmen von Marrakesch". Belegt ist nur, dass das Buch 1967 bei Hanser erschien, nicht, dass es Band 1 der Reihe war.
- *dtv phantastica:* „From 1979". Kein Beleg gefunden.

**Bestätigt:** Heyne Bibliothek der SF Literatur 1981–2001 (101 Bände), Bibliothek der Erinnerung seit 1997 bei Metropol. Die übrigen Angaben (Folio 1972 mit Malraux und Camus als Nr. 1 und 2, J'ai Lu SF 1970 mit Sadoul, Présence du futur 1954–2000, Ballantine Adult Fantasy 1969–1974, Penguin Drop Caps, Great Ideas 2004, Nebula seit 1966, National Book Award seit 1950, Deutscher Buchpreis seit 2005) stimmen mit dem, was ich weiß, überein; nicht einzeln nachgeschlagen.

## C. Nebenbei gefunden

- **Feminist Press:** *The Living Is Easy* von Dorothy West steht zweimal auf der Wand (`OL7105290W` und ein zweiter Datensatz „The living is easy").
- **Hugo:** „Hyperion" und „Hyperion [2/2]" stehen beide da. Den Hugo hat nur *Hyperion* (1990) gewonnen; der zweite Eintrag ist vermutlich *The Fall of Hyperion*. Außerdem ist die Reihenfolge nicht durchgehend nach Jahr (*Startide Rising*, 1984, steht vor *Rendezvous with Rama*, 1974; *Foundation's Edge* nach *Where Late the Sweet Birds Sang*). Der Entwurf oben behauptet deshalb keine Reihenfolge.
