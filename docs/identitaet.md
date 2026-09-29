# Visuelle Identität: Schrift und Bildmarke

Angelegt 2026-09-28 (ROADMAP 6.61). Julian: „lass uns über ein visuelles Logo nachdenken, nicht an den Namen gebunden, weil der noch nicht feststeht. Können wir etwas mit dem Mosaik machen, gibt es rechtliche Probleme, können wir Cover nehmen, die selbst auf Wikimedia Commons liegen, und daraus ein Mosaik bauen?"

Heute: Fraunces für Titel und Wortmarke, Geist Sans für die Oberfläche, Geist Mono für ISBNs (SPEC §5). Eine Bildmarke gibt es nicht; das Favicon ist der Standard.

## 1. Schrift

Julian schickte am 2026-09-28 zwei Fotos als Kandidaten:

1. **Ein Kassenbon** (Adresse, darunter „(eavesdrop)" kursiv): **Xanh Mono** (Google Fonts, OFL, nur Gewicht 400, mit Kursive). Erst hatte Claude aus einem unscharfen Foto Courier Prime geraten; Julian fragte nach, und auf dem zweiten, scharfen Foto zeigen sich schmale, kontrastreiche Buchstaben, die geschwungene „2", der Fähnchen-„1" und eine kursive, fast handschriftliche Italic. Nebeneinander gesetzt (Xanh Mono, Cutive Mono, Courier Prime, Libertinus Mono) deckt sich nur Xanh Mono in allen diesen Zügen, auch in der Kursiven. Courier Prime ist zu breit und zu gleichmäßig im Strich.
2. **Ein T-Shirt von Frankel's Delicatessen** (Brooklyn): die Adresse in einer dünnen geometrischen Groteske in Versalien, Futura-Familie. Frei: **Jost** (eine Futura-Nachbildung, variabel, mit Kursive); Ersatz: Josefin Sans. Die Wortmarke „FRANKEL'S" selbst ist eine fette Art-déco-Schrift mit versetztem Schatten und nicht Teil des Vergleichs.

**Mockup, nur lokal im Worktree `loading-screen-mosaic-animation-72a738`, nicht committet und nicht in Produktion** (Julian: „mache es nur lokal"): `?font=` schaltet die echte Seite um und merkt sich die Wahl für den Tab, `?font=` ohne Wert schaltet zurück. Die Kandidaten werden mit `preload: false` geladen, damit ein Besucher ohne Schalter nichts extra lädt.

| `?font=` | Titel und Wortmarke | Oberfläche | ISBN |
|---|---|---|---|
| (keiner) | Fraunces | Geist | Geist Mono |
| `receipt` | Xanh Mono (Wortmarke kursiv wie „eavesdrop") | Geist | Xanh Mono |
| `receipt-all` | Xanh Mono | Xanh Mono | Xanh Mono |
| `deli` | Jost, H1 in Versalien, Light 300, gesperrt; Wortmarke Versalien 500 | Jost | Geist Mono |
| `both` | H1 wie `deli`, Wortmarke Xanh Mono kursiv | Jost | Xanh Mono |

**Gemessen bei 390 × 844 (Werkseite *Frankenstein*):** kein seitliches Scrollen in keiner Variante. Die Wortmarke brach in allen drei neuen Schriften auf zwei Zeilen um (Höhe 45–56 px statt 28), weil Courier Prime (die erste Vermutung) und gesperrte Versalien breiter laufen als Fraunces (bis 272 px statt 233 px rechter Rand); im Mockup mit `white-space: nowrap` behoben — beim echten Einbau mitnehmen. Der H1 läuft in allen neuen Varianten über drei statt zwei Zeilen (113 px statt 76 px). Die Versalien in `deli` und `both` machen lange Titel laut: „FRANKENSTEIN; OR, THE MODERN PROMETHEUS" füllt die Breite, Fraunces trägt denselben Titel ruhiger.

**Nachgemessen mit Xanh Mono (2026-09-28):** die Wortmarke passt in eine Zeile und endet bei 242 px statt 233 px (Fraunces) — Xanh Mono läuft so schmal wie Fraunces, das Umbruchproblem kam von Courier Prime und den gesperrten Versalien. Der H1 über *Frankenstein* läuft weiter über drei Zeilen (113 px statt 76 px). Kein seitliches Scrollen.

Entscheidung über die Schriftwahl insgesamt: **Julian.**

### 1.1 Julians Wahl vom 2026-09-28: `?font=xanh`

Julian: „nimm Xanh Mono für Überschrift und Texte, aber Jost für Pillen, in der Suchleiste, Fußleiste, auf den Links mit Text; Buchtitel und Autor unter einem Cover auch in Jost, aber nicht all caps. ‚Start with a classic' sieht in Jost besser aus als Xanh, aber z. B. der Detailtext besser in Xanh. Kannst du daraus eine Regel ableiten?" Und: der Wortabstand in „Judge a book" muss kleiner werden.

**Die Regel: Xanh Mono für Sätze, Jost für Wörter.**

- **Xanh Mono** bekommt, was man *liest*: die Überschrift einer Seite (das Versprechen der Startseite, der Buchtitel über der Wand), Fließtext (der Satz unter dem Versprechen, die Beschreibung eines Buchs), und Zahlen, die auf einem Beleg stünden (ISBN).
- **Jost** bekommt, was man *benennt, wählt oder anklickt*: Abschnittsüberschriften („Start with a classic", „This book"), Pillen, Suchfeld und Knöpfe, Links, Titel und Autor unter einem Cover, Metadaten, Quellenangaben, die Fußzeile. Normale Groß- und Kleinschreibung; Versalien bleiben den Kapitälchen-Labels (`.kicker`), die es heute schon gibt.
- **Titel und Autor des Buchs, um das es auf der Seite geht, sind die Überschrift** und stehen beide in Xanh Mono (Julian, 2026-09-28, an *Berlin Alexanderplatz*: „this should both be in xanh, no?"). Unter einem Cover in der Wand oder auf einer Karte sind dieselben zwei Angaben Bildunterschrift und bleiben Jost.
- **Leise Hinweise der Seite über sich selbst sind Jost**, auch wenn sie ganze Sätze sind (Julian, 2026-09-28, an der Seitenleiste): „Pick a cover to see the edition …", „Description from the Open Library record …", „This book at Open Library — where these records come from …". Xanh Mono bleibt dem, was über das Buch geschrieben steht: der Beschreibung. Auch die Spanne der Ausgaben („Editions here run from 1849 to 2026, from 121 publishers") ist Jost (Julian, 2026-09-28) — sie ist eine Zählung der Seite, kein Text über das Buch. Genauer also: **Xanh Mono spricht über das Buch (und das Versprechen der Startseite), Jost spricht über die Seite und ihre Bedienung.**
- Prüffrage für einen neuen Text: *Sagt es etwas über das Buch, das jemand lesen will, oder erklärt es die Seite, ihre Quellen oder ihre Bedienung?* Ein Link in einem Satz folgt dem Satz.

**Wortabstand:** Xanh Mono hat feste Breiten, ein Leerzeichen ist so breit wie ein Buchstabe. In der Überschrift `word-spacing: -0.3em` (bei 48 px also 14,4 px weniger). Im Fließtext bleibt der Abstand, dort liest er sich wie auf dem Bon.

**Wortmarke** heißt der Name der Seite als Schriftzug oben links in der Kopfzeile („Beautiful Books", der Link zur Startseite). Im Mockup ist sie Xanh Mono kursiv — als Name gilt sie weder als Satz noch als Etikett, sondern als Logo. Julian entscheidet, ob das so bleibt.

**Gemessen:** bei 390 × 844 kein seitliches Scrollen; der Buchtitel *Frankenstein* läuft über zwei Zeilen (76 px, wie mit Fraunces — Xanh Mono ist schmal genug, die dritte Zeile kam von den Versalien); die Wortmarke in einer Zeile; der Platzhalter des Suchfelds braucht in Jost 181 von 356 px. Umgesetzt ist das nur lokal (CSS unter `html[data-font="xanh"]` in `app/globals.css`, nicht committet), und die Auswahl der Fließtexte hängt dort an Klassen (`leading-relaxed`, `max-w-xl`) — beim echten Einbau bekommt jede Stelle die Schrift ausdrücklich.

### 1.3 Zweite Fassung: die alte Aufteilung mit den neuen Schriften (`?font=swap`)

Julian, 2026-09-28: „mach noch eine Mock-up-Version, in der du die Aufteilung zwischen Fraunces und Geist beibehältst, aber jetzt mit Xanh und Jost und ISBN wie eben gebaut."

**Die alte Aufteilung (SPEC §5):** Fraunces für jede Überschrift (h1, h2, h3) und für die Zeilen mit `font-display` — Wortmarke, „Book not found", „Nothing here", die Zeile über dem Lade-Mosaik; Geist für alles andere, auch jeden Fließtext; Geist Mono für die ISBN. Die Aufteilung folgt der **Form** (Überschrift oder nicht), nicht dem Inhalt.

**`swap`** tauscht nur die Schriften: Xanh Mono, wo Fraunces stand, Jost, wo Geist stand, die ISBN wie in `xanh` (Jost, Null und Striche aus Geist Mono, Striche nur in der Anzeige). Wortabstand: `-0.3em` im H1 wie in `xanh`, `-0.15em` in h2, h3 und den `font-display`-Zeilen — mit `-0.3em` liefen „Start with a classic" bei 24 px die Wörter fast zusammen.

**Wo `swap` und `xanh` sich unterscheiden:**

| Stelle | `swap` (nach Form) | `xanh` (nach Inhalt) |
|---|---|---|
| Abschnittsüberschriften (h2): „Start with a classic", „This book", Jahrzehnte, About, Privacy, Spiel | Xanh | Jost |
| Autor unter dem Buchtitel | Jost | Xanh |
| Satz unter „Judge a book …" | Jost | Xanh |
| Buchbeschreibung | Jost | Xanh |
| Fehler- und Leerzeilen („Book not found", „Nothing here") | Xanh | Xanh (nach der Regel eigentlich Jost, noch nicht umgebaut) |
| Seitenüberschrift, Wortmarke, ISBN, alles Übrige | gleich | gleich |

**Gemessen bei 390 × 844:** kein seitliches Scrollen; H1 der Startseite 79 px, Buchtitel *Frankenstein* 76 px (zwei Zeilen wie mit Fraunces), „Start with a classic" eine Zeile, Wortmarke eine Zeile.

**Entschieden am 2026-09-28: `swap`** (Julian: „lets go with the swap for now, but keep record of the other xanh option in the roadmap"). Gebaut ohne den Mockup-Schalter; `xanh` steht als ROADMAP 6.62 unter „Zurückgestellt".

## 2. Darf ein Logo aus echten Covern bestehen?

**Kurz: aus geschützten Covern nicht; aus gemeinfreien ja — aber „liegt auf Commons" heißt nicht „gemeinfrei in Deutschland".** Keine Rechtsberatung; vor der Eintragung einer Marke oder dem Druck einmal von jemandem mit Fach prüfen lassen.

### 2.1 Warum die Argumente der Wand hier nicht tragen

Die Wand zeigt fremde Cover, um ein bestimmtes Buch zu zeigen — das ist der Zweck der Seite, und das Argument im [Risikoregister](risiken-2026-09-12.md) lautet: klein, mit Quelle, wir bewerben das Buch. Ein Logo zeigt kein Buch. Es ist ein dauerhaftes Kennzeichen des Betreibers, und dafür gibt es im UrhG keine Schranke:

- **Zitat (§ 51 UrhG)** braucht einen Belegzweck — das zitierte Werk muss Gegenstand einer Auseinandersetzung sein. Ein Logo setzt sich mit nichts auseinander.
- **Unwesentliches Beiwerk (§ 57)** — das Cover wäre im Logo gerade das Wesentliche.
- **Pastiche (§ 51a, seit 2021)** — die Reichweite ist ungeklärt, der EuGH hat im Verfahren *Pelham II* (C-590/23) erst zu sagen, was ein Pastiche ist. Ein Firmenzeichen darauf zu bauen hieße, auf eine offene Rechtsfrage zu wetten.
- **Freie Benutzung / hinreichender Abstand (§ 23 Abs. 1 S. 2)** greift erst, wenn die Züge des Vorbilds im neuen Werk verblassen. Bei einem Mosaik, dessen Kacheln erkennbare Cover sind, verblasst nichts — jede Kachel ist eine Vervielfältigung.
- **Marke obendrauf:** viele Cover tragen ein lebendes Verlagszeichen (Pinguin, Insel-Schiff, Fischer-Fisch). Ein Logo, das so ein Zeichen enthält, ist Markenbenutzung im geschäftlichen Verkehr, sobald die Seite Geld verdient (Phase 4).

Bei 16 px (Favicon) ist keine Kachel mehr als Cover erkennbar; dort ist die Frage praktisch leer. Aber dieselbe Marke erscheint groß — OG-Bild, Kopfzeile, Pinterest — und dort nicht.

**Nebenbefund:** die Ladebilder aus 6.19a haben dieselbe Frage — gemeinfreie Porträts, aber aus urheberrechtlich geschützten Covern gelegt. Sie sind dort als Teil der Suche zu rechtfertigen (sie zeigen die Bücher des gesuchten Autors), als Logo oder Werbebild nicht. Das bleibt bei 5.5 / 6.19a offen und wird durch diese Notiz nicht entschieden.

### 2.2 Commons: was dort liegt, und warum das nicht reicht

Commons nimmt ein Bild nur, wenn es **in den USA und im Ursprungsland** frei ist. Genutzt wird unser Logo aber in Deutschland, und hier gilt deutsches Recht (Schutzlandprinzip):

- **70 Jahre nach dem Tod des Gestalters (§ 64).** Heute (2026) also frei, wer **vor 1956** gestorben ist.
- **Anonyme Werke: 70 Jahre nach Veröffentlichung (§ 66).** Viele alte Umschläge sind ungezeichnet — ein ungezeichneter Umschlag, **vor 1956 erschienen**, dessen Gestalter auch später nicht bekannt wurde, ist frei.
- **„PD-US" allein genügt nicht.** Ein US-Umschlag von 1925 ist in den USA seit 2021 frei (95 Jahre ab Erscheinen). In Deutschland greift bei US-Werken nach herrschender Meinung **kein Schutzfristenvergleich**, wegen des deutsch-amerikanischen Urheberrechtsabkommens von 1892 — es gilt die volle deutsche Frist. Beispiel: Francis Cugats Umschlag für *The Great Gatsby* (1925) liegt auf Commons, Cugat starb 1981, in Deutschland also geschützt bis Ende 2051. Genau das Cover, an das man zuerst denkt, fällt heraus.
- **„PD-textlogo"** (zu einfach für Schutz) ist in Deutschland meist auch frei, aber das sind typografische Umschläge — und die langweilen Julian (siehe Kuratierung: bildhafte Reihen bevorzugt).
- **Fotos der Umschläge:** ein flacher Scan eines gemeinfreien Umschlags ist seit 2021 selbst nicht geschützt (§ 68). Ein Foto eines Einbands als Gegenstand (Prägung, Buchrücken, Licht) kann eigenen Lichtbildschutz haben (§ 72) — dann braucht es die freie Lizenz des Fotografen und deren Namensnennung.

**Filter für Commons, in dieser Reihenfolge:** Vorlage `PD-old-70` oder höher (nicht nur `PD-US-*`); Erscheinungsjahr vor 1956; Gestalter tot vor 1956 oder unbekannt; kein lebendes Verlagszeichen im Bild; Scan statt Foto, sonst CC0/CC-BY mit Namensnennung im Impressum oder auf About.

**Was dabei übrig bleibt, ist nicht wenig und passt zum Geschmack:** verzierte Verlagseinbände 1870–1930 (Jugendstil, Goldprägung, Bildeinbände), frühe Taschenbuch-Umschläge aus den 1920ern und 30ern mit ungezeichneten Illustrationen, Groschenhefte und Pulp-Umschläge vor 1956 mit bekanntem, früh gestorbenem Illustrator. Das ist bildhaft, farbig, und es sieht nach Buchgeschichte aus statt nach Bestsellerliste.

### 2.3 Empfehlung

Zwei Ebenen trennen:

1. **Die Bildmarke selbst ist abstrakt**: Rechtecke im Buchformat 2:3, gesetzt wie eine Wand, Farben aus der eigenen Palette (oder gemittelt aus gemeinfreien Covern — eine Durchschnittsfarbe ist kein Werk). Sie muss bei 16 px funktionieren, und dort wird jedes echte Cover ohnehin zu Farbrauschen. Rechtlich null Risiko, als Marke eintragbar.
2. **Das Mosaik aus gemeinfreien Covern wird das Schaubild der Marke**, nicht die Marke: OG-Bild, About-Kopf, Pinterest, Plakat. Dort darf es groß und reich sein, und die Quellenliste steht auf About. Das ist dieselbe Maschine wie `lab/mosaic`, nur mit einem Korpus aus Commons statt aus Open Library.

## 3. Richtungen für die Bildmarke

Skizzen im Chat vom 2026-09-28; Julian entscheidet.

- **A. Die gewählte Kachel.** 3 × 3 Buchrechtecke, eines in der Akzentfarbe und leicht erhaben. Sagt: aus vielen Ausgaben die eine finden (SPEC §1).
- **B. Wand mit Lücke.** Dasselbe Raster, eine Kachel fehlt — das Buch, das man sucht.
- **C. Mosaik-Buch.** Die Silhouette eines aufrecht stehenden Buchs, aus kleinen 2:3-Kacheln gelegt: das Ladebild im Kleinen.
- **D. Fächer.** Drei versetzte Cover, das vordere in Akzent — das Rondell der Startseite als Zeichen.

- **A + C, Mischung** (Julian, 2026-09-29: „ist die Vorschaukarte nicht eher wie C?"). Die Website-Karte aus §4 hat die Idee von A (eine gewählte Kachel in Terrakotta, größer) und das Aussehen von C (viele Kacheln in verschiedenen Tönen), aber keine Buchform. Als Marke skizziert in zwei Größen: 3 × 3 und 5 × 5 Buchrechtecke in den sieben Tönen der Karte, die mittlere in Terrakotta und um 30 % vergrößert. Jeweils groß, in 32 und 16 px, auf hellem und dunklem Grund angesehen.

Offen: ob die Marke eine Farbe (Terrakotta) oder mehrere trägt; ob sie ohne Namen stehen muss, solange 0.5 offen ist (ja — das war die Vorgabe).

### 1.2 ISBN: Geist Mono, Jost oder Xanh Mono

Julian bat am 2026-09-28 um einen Vergleich der ISBN in den drei Schriften (Bild lokal, nicht im Repository). Befund beim Setzen: Jost hat Proportionalziffern, eine ISBN läuft darin dicht und die Bindestriche verschwinden fast; Geist Mono und Xanh Mono geben jeder Ziffer dieselbe Breite, was eine 13-stellige Zahl lesbar hält. Xanh Mono ist bei 13 px deutlich heller und schmaler als Geist Mono.

**Korrigiert (Julian, 2026-09-28): gemeint war Jost, mit der durchgestrichenen Null und den Bindestrichen aus Geist Mono.** (Claude hatte „ISBN in Geist Mono, aber mit Strich durch die 0" als Geist Mono gelesen; Geist Mono hat die durchgestrichene Null ohnehin als Standardzeichen.) Im Mockup:

- **Bindestriche nach der Bereichstabelle der ISBN-Agentur**, über das npm-Paket `isbn3` (MIT, 128 KB entpackt, bringt 8 Pakete mit; nur lokal installiert, `package.json` nicht committet). Beispiele: 978-0-14-143947-1, 978-3-596-90486-0, 978-1-5131-3739-1 — die Gruppen sind je nach Land und Verlag verschieden lang, darum keine eigene Regel. Kennt die Tabelle eine ISBN nicht, bleibt sie ohne Striche.
- **Die Striche gibt es nur in der Anzeige** (Julian: „falls das Probleme gibt, muss es ohne Striche weitergegeben werden"). `IsbnText` in `components/BookDetail.tsx` formatiert `edition.isbn13` beim Rendern; das Feld selbst bleibt unverändert, und daraus bauen `lib/buylinks.ts` und `/go/` ihre Adressen. **Geprüft im Browser** an *Frankenstein*, Long Bridge 2022: Anzeige „ISBN 978-0-578-28625-9", Kauf-Links `/go/abebooks/9780578286259?market=de` usw., ohne Striche. Kopiert jemand die angezeigte ISBN in das Suchfeld der Seite, entfernt `cleanIsbn` (`lib/normalize.ts`) die Striche wieder (`lib/queryshape.ts`).
- **Schrift:** die Ziffern in Jost, jede `0` und jeder `-` in Geist Mono (`.isbn-mark`). Die Geist-Null ist breiter und durchgestrichen und steht dadurch sichtbar zwischen den Jost-Ziffern; die Geist-Striche sind länger als die von Jost und trennen die Gruppen deutlich. Offen für den Einbau: ob `isbn3` die 60-plus KB Bereichsdaten im Browser wert ist, oder ob die Striche auf dem Server gesetzt und mitgeschickt werden.

## 4. Vorschaubilder (Open Graph)

Julian, 2026-09-28: „[die Schrift im OG-Bild] gehe das an. Außerdem ob wir ein Mosaik als Vorschaubild benutzen können, entweder mit echten Bildern oder welchen wie ganz oben in der Session entwickelt."

**Vorher:** eine Karte je Werk (vier Cover, Titel) und je geteiltem Cover (ein Cover groß), beide in der Voreinstellung von `next/og`. Startseite, About, Sammlungen und Impressum hatten keine Karte; Spiel, Rangliste und Sammlungen setzten `openGraph` selbst und verloren dadurch auch jedes geerbte Bild.

**Gebaut:**

- **Schrift:** Titel Xanh Mono, Autor und „One cover of" Jost, der Name kursiv in Xanh Mono. Statische WOFF-Dateien in `assets/og/` (je 8–16 KB, OFL-Lizenzen daneben), eingelesen in `app/og.tsx`; der Build nimmt sie in alle drei Kartenfunktionen auf (in den `.nft.json` geprüft). `word-spacing` übergeht der Generator, darum setzt `Display` jedes Wort als eigenes Kästchen, mit dem Rest-Abstand der Seite (0,2 em statt der vollen Zeichenbreite von 0,5 em).
- **Website-Karte** `app/opengraph-image.tsx`: links der Name und „Judge a book *by its covers.*", rechts eine Wand aus 9 × 7 Kacheln im Format 2:3 in sieben Tönen der Seite, zum Text hin blasser, eine Kachel in Terrakotta vergrößert — Richtung A der Bildmarke. Statisch gebaut, fragt keine Quelle.

**Nicht gebaut, als Vergleich gerendert:** dieselbe Karte mit dem Lade-Mosaik von Mary Shelley (ihr Porträt aus 179 Covern ihrer Bücher) auf der rechten Hälfte. Befund: in 600 × 630 und im Hochformat-Ausschnitt ist das Gesicht **kaum zu erkennen**, es liest sich als bunte Fläche aus Covern. Dazu die Rechtefrage: eine Karte für die ganze Seite zeigt kein bestimmtes Buch, also trägt sie das Argument der Wand nicht (§2.1), sie steht rechtlich neben dem Logo. Mit gemeinfreien Covern (§2.2) ginge es; dafür fehlt der Korpus.

**Werkseiten** bleiben bei vier Covern desselben Buchs. Ein dichteres Mosaik aus Covern *desselben* Buchs wäre rechtlich wie die Wand, kostet aber je Karte ein Mehrfaches an Bildabrufen bei Open Library (100 je IP und 5 Minuten, Risikoregister) — bei jedem Crawler, der die Sitemap abläuft. Nicht ohne Messung.

