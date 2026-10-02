# lab/vinyl — dieselbe Wand für Schallplatten

Roadmap 5.16. Julian, 2026-09-29: „lab idee: exakt das gleiche aber für vinyl alben. zu bedenken: vorder und rückseite und vielleicht farbe oder print auf vinylplatte selbst".

## Die Frage

Hat eine offene Quelle genug Bilder, um für ein Album dieselbe Wand zu bauen wie für ein Buch — jede Pressung mit ihrem Cover —, und dazu die Rückseite und die Platte selbst (Farbe, Picture Disc, Etikett)?

## Das Modell passt fast eins zu eins

| Seite heute (SPEC §2) | Schallplatte | Quelle |
|---|---|---|
| Work | Album = MusicBrainz *release group* | `musicbrainz.org/ws/2/release-group` |
| Edition | Pressung = MusicBrainz *release* (Land, Jahr, Label, Katalognummer, Barcode, Format `12" Vinyl`) | `…/ws/2/release?release-group=…&inc=media` |
| Cover | Bild im Cover Art Archive, **mit Typ**: `Front`, `Back`, `Medium` (die Platte selbst oder ihr Etikett), `Spine`, `Obi`, `Booklet`, `Sticker`, `Poster`, `Matrix/Runout`, … | `coverartarchive.org/release/<mbid>` |
| ISBN | Barcode (EAN/UPC) und Katalognummer — erst ab etwa 1980 auf Platten, davor nur Katalognummer | release |

Was anders ist:

- **Seiten.** Ein Buchcover ist ein Bild; eine Pressung hat Vorder- und Rückseite und die Platte. Die Wand zeigt die Vorderseiten und faltet nach ihnen (dieselbe Faltung, `lib/works.ts`); Rückseite und Platte gehören in die Seitenleiste des gewählten Covers, als Umdrehen oder als zweite und dritte Kachel. Ein Rückseitenbild darf nie auf der Wand der Vorderseiten landen — dafür ist der Bildtyp da.
- **Farbe der Platte.** MusicBrainz hat dafür kein Feld; Bearbeiter schreiben es in die Disambiguierung („red vinyl", „picture disc"). `vinylColourNote` liest das, und kein Eintrag heißt „nicht notiert", nie „schwarz" (N12). Discogs führt die Farbe strukturierter (Formatbeschreibung „Red, Translucent"), braucht aber einen Token, und seine Bilder tragen keinen Seitentyp (nur „primary"/„secondary").
- **Gleiche Vorderseite, andere Platte.** Viele Neuauflagen unterscheiden sich nur in der Plattenfarbe. Die gefaltete Wand würde sie zu einer Kachel machen — richtig für die Wand, aber die Farbvarianten wären dann das, was man im gefalteten Stapel sucht.
- **Kaufen.** Kein Buchhandel, sondern Discogs-Marktplatz, eBay, Plattenläden; die Frage aus 5.14 stellt sich neu.

## Wie gemessen wird

`measure.ts` fragt für acht Alben aus sechs Jahrzehnten alle Releases ab, zählt die Vinyl-Pressungen, wie viele davon Vorder- und Rückseite haben (aus der Zusammenfassung, die MusicBrainz mitliefert), und fragt für bis zu 40 Vinyl-Pressungen mit Bild je Album das Cover Art Archive nach den Bildtypen — vor allem `Medium`. Eine Anfrage pro Sekunde an MusicBrainz, Antworten in `cache.json` (git-ignoriert), Fehlschläge als Fehlschläge. Kein Google Books.

```bash
npx tsx lab/vinyl/measure.ts
npx tsx lab/vinyl/discogs.ts     # danach; Discogs drosselt ohne Token stark (2 h für acht Alben)
npx tsx lab/vinyl/labels.ts      # Wand der Etiketten nach out/labels.html, nur aus cache.json
npx tsx lab/vinyl/mockup.ts      # Mockup der Albumseite nach out/mockup.html (holt Labels, Katalognummern, alle Bilder, dHash)
npx tsx lab/vinyl/story.ts       # Zeitleiste, Credits, Anmerkungen je Hülle nach out/story.json
# mit ANTHROPIC_API_KEY aus der .env.local des Hauptordners, nur für diesen Befehl:
npx tsx lab/vinyl/live-story.ts  # Wikipedia + Claude, gemessen, nach out/live-story.json; danach mockup.ts erneut
npx tsx lab/vinyl/wiki-only.ts   # Wikipedia-Auszug + gesetzte Zeilen, ohne Modell, gemessen, nach out/wiki-only.json
npx vitest run lab/vinyl
```

Die Wand ansehen: `out/` mit einem beliebigen statischen Server ausliefern, z. B. `cd lab/vinyl/out && python3 -m http.server 4341 --bind 127.0.0.1` (4330 belegt ein anderes Lab-Werkzeug).

## Fork, eigene App oder Teil der Buchseite?

Julian, 2026-10-02: „would it make more sense to try out this idea as a fork of the project or can it live within the same structures?" Einschätzung (Claude), Grundlage für die offene Frage (3) in ROADMAP 5.16:

- **Kein Fork.** Geteilt wird genau das, was am meisten Messung gekostet hat: Bildsignaturen (`lib/imagehash.ts`, `lib/imagesig.ts`), die Faltmechanik, Rate-Limits, der Redis-Zugang, die Gestaltung, die Doku-Ordnung (SPEC, ROADMAP, Historie je einmal). Ein Fork verdoppelt all das, und die Kopien laufen auseinander — derselbe Grund, aus dem E20 einen Schalter statt zweier Branches wählte. Dazu entstünden zwei ROADMAPs, was die Regel „jedes Element genau einmal" bricht.
- **Nicht in dieselbe App, jedenfalls nicht ohne Umbau.** Der Kern ist buchtypisiert: 26 von 49 Dateien in `lib/` sprechen von ISBN, Open Library oder Google Books; `Edition` trägt `isbn13`/`isbn10`; die Faltstufen hängen an ISBN und Sprache („nie über bekannte Sprachen"), während die Platten nach Land gruppieren und mit einfacher Verkettung bei ≤ 20 falten (Julians Wahl) — ein anderer Algorithmus, kein anderer Parameter. Urteil (`lib/verdicts.ts`, Google-ISBN-Abfrage), Kauf-Links je ISBN, E21 und die Wortregeln in `lib/seo.ts` haben bei Platten kein Gegenstück; Discogs-CC0, CAA und Wikipedia-CC-BY-SA bringen eigene Lizenzpflichten. Eine Medienweiche quer durch `lib/` würde jede Buchregel um einen Fall erweitern, den sie nie gemessen hat.
- **Empfehlung: bis zur Entscheidung (3) in `lab/vinyl/` bleiben** — die Lab-Regeln tragen das schon (darf `lib/` importieren, wird nie importiert). Heute importiert `lab/vinyl` aus `lib/` nur `imagehash`; die tatsächlich geteilte Fläche ist also klein und bekannt. **Fällt (3) auf „eigene Seite"**, dann im selben Repository als zweite App (Workspace: `apps/books`, `apps/records`, ein gemeinsames Paket mit Signaturen, Faltmechanik, Rate-Limit, Store, Gestaltung), eigenes Vercel-Projekt und eigene Domain; der erste Schritt wäre, die medienneutralen Teile aus `lib/` herauszulösen, gemessen daran, dass die Buchtests unverändert grün bleiben. **Fällt (3) auf „Teil von beautifulcovers"**, ist der Preis eine Verallgemeinerung von Work/Edition/Cover (Kennungsart statt ISBN, Gruppierung statt Sprache, Faltregel je Medium) — eigener Roadmap-Punkt, nicht nebenbei.

## Status

**Gemessen am 2026-09-29** an acht Alben; die Tabellen stehen in der [Historie](../../docs/history.md#2026-09-29--schallplatten-statt-bücher-erste-messung-roadmap-516). Kurz:

1. **Vorder- und Rückseite gibt es getrennt und benannt:** 138 von 181 Vinyl-Pressungen bei MusicBrainz haben eine Vorderseite, 113 eine Rückseite. Die Seite müsste nie raten, welche Seite ein Bild zeigt.
2. **Aber dünn:** 4 bis 57 Pressungen mit Bild je Album — eine Reihe, keine Wand. Discogs kennt 2- bis 20-mal so viele Vinyl-Versionen (*Rumours* 492 statt 24) und liefert ohne Token ein 150-px-Vorschaubild je Version; große Bilder brauchen einen Token, und ihre Bilder tragen keinen Seitentyp.
3. **`Medium` zeigt das Etikett, nicht die Platte:** 11 von 12 zufällig angesehenen Bildern sind Mittenetiketten (Columbia, CBS, Harvest, Geffen), eins eine CD aus einer Box. Eine Wand der Etiketten wäre eine eigene Idee.
4. **Die Plattenfarbe steht nur als Freitext** — bei MusicBrainz in 4 von 181 Disambiguierungen, bei Discogs im Formattext der Pressung, dort aber vermischt mit Etikett- und Hüllenfarbe („Green WB Labels", „Yellow Cover", „Green Obi"). Ein Farbwort allein heißt also noch nicht, dass die Platte so aussieht; ein Parser müsste „Labels", „Cover", „Obi", „Sleeve" ausschließen.

5. **Die Wand der Etiketten** (`labels.ts`, Julian: „zeig mir eine wand der etiketten"): 103 Pressungen, je eine runde Kachel, älteste zuerst. Angesehen am 2026-09-29: sie trägt — *Kind of Blue* allein zeigt Columbias „Six Eye", Fontana in drei Farben, Coronet, CBS orange; *Dark Side* wandert von Harvest grün über schwarz zum Prisma. Unter 21 angesehenen *Kind of Blue*-Kacheln sind zwei kein Etikett (1959 JP zeigt ein Foto der Hülle, 1959 CA ist fast ganz schwarz); `Medium` allein reicht also nicht als Filter, es bräuchte einen Blick oder eine Kreis-Erkennung.

6. **Andere Quellen:** Recherche vom 2026-09-29 in [quellen.md](quellen.md). Kein offener Katalog führt die Plattenfarbe als Feld; am besten wäre der **Discogs-Dump (CC0, 10,5 GB)** für Pressungen und Farbtext, verbunden über die Discogs-Links in MusicBrainz mit den Bildern des Cover Art Archive. Discogs-Bilder sind nach den API-Bedingungen (kein kommerzieller Gebrauch, 6-Stunden-Regel, kein Cache) für eine Seite mit Affiliate-Links vermutlich nicht nutzbar. TheAudioDB und fanart.tv haben Rückseite und Disc-Motiv nur je Album.

7. **Mockup der Albumseite** (`mockup.ts` + Vorlage `mockup.html` → `out/mockup.html`; Julian: „kannst du ein mock up erstellen wie die seite aussehen könnte für vinyl. gleiches konzept wie für bücher aber entsprechend abgeändert?"): Farben, Schriften und Aufbau der Buchseite, mit echten Daten der acht Alben. Was sich ändert:
   - **quadratische Kacheln**, Wortmarke „Beautiful Records", Zählzeile „23 sleeves from 57 of 63 vinyl pressings with a photo";
   - **Länder statt Sprachen** als Reiter (US, UK, Japan, Europe …), gezählt in gefalteten Hüllen;
   - ein Umschalter **Front · Back · Label** über der Wand: Vorder- und Rückseite gefaltet in derselben Ordnung, Etiketten eines je Pressung, rund;
   - **Faltung in den Stufen der Buchwand** mit dem dHash der Seite (`lib/dhash.ts`): ≤ 8 immer, ≤ 20 bei gleicher Katalognummer (die ISBN der Platte), ≤ 16 bei gleichem Label im selben oder nächsten Jahr. Ein fester Abstand ≤ 10 faltete zu wenig, weil Hüllen fotografiert statt gescannt sind; mit den Stufen wird bei *Kind of Blue* die Columbia-Hülle zu einer Kachel mit 27 Pressungen, 23 Hüllen statt 37;
   - die Seitenleiste zeigt die **Pressung**: großes Bild mit Vorder-, Rückseite, Etikett A und B zum Umschalten, darunter „27 pressings with this sleeve" als Reihe ihrer Etiketten (die Pressungen gleicher Hülle unterscheidet das Etikett), Katalognummer, Barcode, Format, Plattenfarbe („Not recorded", nie „black"), Links zu Discogs und eBay über die Katalognummer und der Hinweis, dass eine Neuauflage unter derselben Nummer anders aussehen kann;
   - auf dem Telefon wird die Seitenleiste zum Blatt von unten, wie `CoverSheet` bei Büchern.
   Angesehen bei 1280 × 800 und 390 × 844 (kein seitliches Scrollen). Befunde: archive.org verliert gelegentlich ein Bild, darum lädt die Seite zweimal neu und sagt dann „Image did not load"; die 500-px-Fassung fehlt bei kleinen Originalen, die Seite fällt auf das Original zurück. Bei *folklore* haben die beiden farbigen Pressungen (rot, gold) keine Vorderseite im Archiv und fehlen deshalb auf der Wand — gerade die Farbvarianten sind am schlechtesten belegt.

8. **Strengere Faltung** (Julian: „die faltung müsste viel strenger sein, es gibt weniger cover von einem album. spätere pressungen haben oft das selbe cover."): die 57 Vorderseiten von *Kind of Blue* von Hand in 8 Gestaltungen eingeteilt (Columbia-Porträt auf rund 40 Pressungen, Fontana, grün-gelber Kopf, blau eingefärbtes Porträt, UHQR-Box, drei Einzelstücke) und dagegen gemessen. Fotos derselben Hülle liegen beim dHash der Seite im Median bei 18 (90 % bis 24), verschiedene Gestaltungen ab 21, meist über 27 — die Stufen der Buchwand (≤ 8 / 16 / 20) waren viel zu vorsichtig. **Einfache Verkettung bei ≤ 18** ergibt 10 Kacheln (vorher 23) und wirft nichts zusammen. Weder ein Kontrast-Tor noch der Farbabstand der Seite halfen: fotografierte Hüllen streuen im Licht so weit wie verschiedene Gestaltungen (Farbabstand gleicher Hüllen im Median 0,43, verschiedener 0,47). Der Umschalter in der Mockup-Leiste zeigt 16, 18, 20 und 22:

   | ≤ | Rumours (wahr 1) | Dark Side (2) | Kind of Blue (8) | Autobahn (3) | Nevermind (1) | OK Computer (1) | RAM (2) | folklore (7) |
   |---|---|---|---|---|---|---|---|---|
   | 16 | 2 | 5 | 11 | 3 | 3 | 1 | 1 | 7 |
   | 18 | 2 | 5 | 10 | 3 | 2 | 1 | 1 | 7 |
   | **20** | 1 | 2 | 9 | 3 | 1 | 1 | 1 | 6 |
   | 22 | 1 | 1 | 5 | 3 | 1 | 1 | 1 | 6 |

   Bei 20 fällt die schwarze UHQR-Box ins Prisma und zwei verschiedene *folklore*-Fotos (Baum, Feld) werden eins; bei 22 mischt *Kind of Blue* Gestaltungen. Silberner und goldener Helm (*Random Access Memories*, 10th anniversary) liegen bei 9 und fallen immer zusammen — gleiche Komposition, der Hash sieht nur Hell und Dunkel. Die Vorderseiten liegen jetzt lokal in `out/thumbs/` (git-ignoriert), das Mockup lädt sie von dort; archive.org verlor bei jedem Neumessen einige Bilder, und eine Hülle ohne Hash faltet nie.
9. **Markt:** Recherche vom 2026-09-29 in [markt.md](markt.md). Händler verkaufen je Variante und zeigen fast nur die Vorderseite; Sammlerstücke laufen über Discogs, eBay, CDandLP, Popsike, Record Store Day und audiophile Reihen; niemand zeigt die Hüllen eines Albums als Wand. Vorschlag des Agenten: „die Hüllengeschichte eines Albums" als Kern, dazu ein schmaler Streifen „heute erhältlich als …" aus Händlerfeeds (HHV mit Webgains-Feed, Amazon, Juno).

10. **Discogs-Dump gemessen** (Julian: „lade den discogs dump herunter und mach die messung"; `dump-measure.ts`, `dump-report.ts`, `dump-link.ts`, Leser in `dump.ts`): 11,25 GB als Datenstrom gelesen, nicht gespeichert (15 GB frei), 8 Minuten. 8,05 Mio. Vinyl-Einträge, 7,5 % mit Plattenfarbe im Text — 2010er 28,5 %, 2020er 41,3 %, davor um 1 %. **Der Dump hat keine Bildangaben**, nicht einmal deren Zahl. Farberkennung von Hand geprüft: 57 von 60 richtig, 1 von 40 übersehen. Die acht Alben haben bei Discogs 282 farbige Pressungen (*Nevermind* 90, *Dark Side* 65, *Kind of Blue* 56 — fast alle blau); über den Discogs-Link in MusicBrainz bekommen aber nur 10 der 138 Pressungen mit Foto eine Farbe. Tabellen in der [Historie](../../docs/history.md#2026-09-29--der-discogs-dump-gemessen-roadmap-516).

11. **Geschichte je Hülle** (Julian: „aber woher bekommen wir die geschichte zu jeder hülle"; `story.ts`, Befund in [geschichte.md](geschichte.md)): vier Schichten — Zeitleiste aus unseren Daten (24 von 24 Hüllen), Credits aus MusicBrainz und Discogs (15 von 24, CC0), Discogs-Anmerkungen (21 von 24, CC0, meist Herstellungsangaben), Erzählung aus Wikipedia (6 von 8 Alben, fast nur zum Original, CC BY-SA). Die Geschichte der Varianten gibt es nirgends fertig; sie müsste geschrieben werden.

12. **Geschichte live geschrieben** (Julian: „mach mal einen mockup mit den wikipedia-daten und miss wie lange die ad-hoc erstellung dafür dauert"; `wiki.ts`, `live-story.ts`): Wikipedia-Artworktext in 1,3 s (Median), dann ein Aufruf an Claude Opus 5.5 (Aufwand `low`) für Albumtext und Beschriftung je Hülle in 5,5 s — zusammen 7,3 s (5,4–11,3 s), 0,022 $ je Album. Nicht für die Suche; auf der Albumseite nachgeladen und danach gespeichert schon. Im Mockup mit nachgespielter Wartezeit („live timing"). Tabellen in der [Historie](../../docs/history.md).

13. **Ohne Sprachmodell** (Julian: „ist es einfacher nur den text aus wikipedia zu finden und darzustellen, statt zusammenzufassen?"; `wiki-only.ts`, `captions.ts`): Wikipedia-Auszug mit Link und Lizenz fürs Album, je Hülle eine gesetzte Zeile aus unseren Daten und höchstens eine Discogs-Anmerkung wörtlich. 1,0 s (Median) mit gespeicherter Wikidata-ID, höchstens 1,9 s, kostenlos. Im Mockup die Voreinstellung.

**Entschieden 2026-09-29: Wikipedia-Auszug statt Zusammenfassung** (Julian: „der wikipedia-auszug reicht, nimm den") — die Geschichte einer Hülle ist der Wikipedia-Auszug mit Link und Lizenz, dazu je Hülle die gesetzte Zeile und höchstens eine Discogs-Anmerkung (Punkt 13). `live-story.ts` bleibt als Messung im Labor; im Mockup ist die Claude-Fassung nur noch zum Vergleich umschaltbar.

**Entschieden 2026-09-29: Schwelle 20** (Julian: „für das hashing nimm die 20er schwelle“) — weniger Kacheln, die UHQR-Box und das zweite *folklore*-Foto verschwinden dabei im Stapel. Das Mockup steht auf 20, der Umschalter bleibt.

**Offen, Julian:** welche Positionierung (Hüllengeschichte, Neuerscheinungen oder Sammlerbestimmung); Discogs-Token beantragen und die Bildrechte dort prüfen, oder bei MusicBrainz bleiben; wo Rückseite und Etikett erscheinen (auf der Wand oder erst beim gewählten Cover); eigene Seite oder Teil von beautifulcovers.
