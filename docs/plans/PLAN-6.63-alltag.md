# Plan 6.63–6.81 (ohne 6.74), 5.8c, 0.15: Alltagstauglichkeit

Stand: 2026-09-29, **offen**; 6.75, 6.76 und 6.79 gebaut am 2026-09-29, 6.77 als Mockup, 6.81 mit gemessenem Vorschlag. Quelle sind **zwei Durchsichten vom 2026-09-28**, seit dem 2026-09-29 in einer Datei ([Bericht](../tests/2026-09-28-alltagstauglichkeit.md)): **Teil A** aus der Sitzung `interface-usability-improvements` unter `npm run dev` (Befunde A1–A7 und ein zweiter Durchgang in Julians Chrome), **Teil B** eine Durchsicht von außen gegen Produktion (Chrome, ~455 px, Dunkelmodus), die Julian mit „use this report to make a plan to fix ux and bugs“ gab. Julian am 2026-09-29: „füge beide berichte zusammen“. Geschrieben für eine Sitzung, die den Code nicht kennt. Nichts davon ist gebaut.

Die Nummern: 6.63–6.73 kamen am 2026-09-28 aus Teil B, 6.75–6.81 am 2026-09-29 aus Teil A. **6.74 ist nicht dieser Plan** — sie ist auf `claude/adoring-volhard-3f8ef6` vergeben (HEIC beim Foto-Import). Vor dem Anlegen weiterer Nummern `npm run worktrees -- --fetch` lesen.

## 1. Was die Berichte richtig sehen, was schon da ist, was einer Entscheidung widerspricht

Jeder Befund wurde gegen den Code gelesen (Teil B am 2026-09-28, Teil A am 2026-09-29), nicht im Browser nachgestellt — das ist jeweils der erste Schritt unten.

### 1a. Teil B, die Durchsicht von außen

| Befund (Teil B) | Stand im Code | Folge |
|---|---|---|
| §1 Eine Stimme bekommt keine Rückmeldung | Stimmt teilweise: F7.8 hebt das gewählte Cover mit einem Ring und zeigt den letzten Pick mit Link — aber keine Zahl, kein Zähler | **6.66** |
| §1 Serie, „your votes so far“ | Nicht vorhanden. Server darf nichts über den Spieler speichern (N11, F7.3); der Browser darf | **6.66**, nur localStorage |
| §1 Cover des Tages, zuletzt angesehen, Neuigkeiten | Nicht vorhanden; die Startseite rotiert nur die Ringe (6.59), die 18 Klassiker stehen fest (6.17 offen) | **5.8c**, Julian entscheidet |
| §2 Anmeldung statt ID zum Kopieren | Die ID ist **bewusst** so gebaut (E22, F9.1, F9.14, Julian 2026-09-28); dass sie Schreibrecht gibt, sagt `components/WallIdField.tsx:35` schon | **0.15**, Entscheidung, nicht jetzt bauen |
| §3 Suchfeld verschwindet hinter einer Lupe | Stimmt unter 640 px: `components/HeaderSearch.tsx:96–97` zeigt das Feld erst ab `sm`, darunter die Lupe — bewusst aus 6.28, weil Zurück-Link, Wortmarke und Feld bei 390 px nicht in eine Zeile passen. Ein `/`-Kürzel gibt es nicht | **6.68** |
| §3 Keine Sortierung/Filter der Treffer | Stimmt. Die Sprach-Pillen wurden am 2026-09-27 auf Julians Entscheidung entfernt (6.60) | nicht eingeplant — erst mit 3.1 (was Leser tun) |
| §3 Vorschlagsliste zeigt einen Treffer | Es gibt keine Autovervollständigung: „Popular“ ist die feste Liste `POPULAR_SEARCHES`, nach dem Getippten gefiltert, höchstens 4 (`components/SearchBar.tsx:86–89`) | **6.69** |
| §3 Sekundärliteratur neben dem Roman | Bekannt, der Label-Teil von **6.5**; Teil A zählt 10 von 15 Karten bei Gatsby | **6.81** |
| §4 Gatsby „1920“ | `lib/firstyear.ts` verwirft ein führendes Jahr nur, wenn es mehr als 50 Jahre vor dem nächsten liegt; 1920 → 1925 fällt nicht darunter. Gatsby ist kuratiert (`lib/curated.ts:39`) | **6.16 Schritt 2**, abgekoppelt von 6.18 (§3 unten) |
| §4 293 / 291 / 162 Cover | 293 → 291 ist die bekannte Faltung beim zweiten Besuch (SPEC §7, 6.12). **162 aus 181 Datensätzen** auf der Jahrzehnte-Seite passt nicht zu 1.180 Datensätzen der Wand bei einer Obergrenze von 600 (`app/book/[id]/decades/page.tsx:60`) — Verdacht auf den abgebrochenen Lauf aus **6.43** | **6.71** |
| §4 Nicht-Cover im Mosaik der Karte | Stimmt im Code: der Mosaik-Pfad (`?summary=1`) holt keine Signaturen (`app/api/works/[id]/route.ts:115`), `looksLikeScannedPage` greift dort nie | **6.70** |
| §4 „Two covers of two books“ | Der Satz steht in `app/versus/page.tsx:67`; F7.9 stellt **absichtlich** in 15 % der Paare zwei Cover eines Buchs gegeneinander. Der Text ist falsch, nicht das Spiel | **6.66** (Textzeile) |
| §5 Elo oder Bradley–Terry einführen | **Ist schon so** (F7.5): Elo paart, Bradley–Terry ordnet, jedes Cover trägt seine Unsicherheit. Die Rangliste *zeigt* aber „won 3 of 3“ (`app/versus/board/page.tsx:64`), und das liest sich wie die Ordnung | **6.67** |
| §5 Die Krone kommt nie | Stimmt: eine Runde sind so viele Stimmen wie Cover (`lib/hotornot/rating.ts:350`), drei Runden bei 3.335 Covern sind rund 10.000 Stimmen in Folge | **6.67**, Julian entscheidet |
| §6 Wand in 36er-Seiten | Widerspricht dem Produkt (die Wand *ist* der Vergleich, §1) und ist in Teilen schon da: seitenweises Laden (Schritt 11), Bilder lazy | nicht so — stattdessen **6.73** messen |
| §6 Nächstes Paar vorladen | **Ist schon so** (F7.8: die nächsten zwei Paare samt Bildern; F7.10: drei Paare mit der Seite) | nichts |
| §6 Lauf je Werk cachen | 24 h Datencache je Seite ist da (N4); Signaturen je Instanz sind 6.12 | nichts Neues |
| §7 Unterstrichene Links reagieren nicht | Nicht bestätigt. „Standings“ und die Einladung sind schlichte `Link`s (`components/Versus.tsx:283`, `app/page.tsx:89`). Kann ein Artefakt des Werkzeugs sein, mit dem geklickt wurde | **6.63**, erst nachstellen |
| §7 Leiste „Selected cover“ lässt Klick durch | Die Leiste ist `fixed z-40` ohne Einblend-Animation (`components/CoverSheet.tsx:117`); die Ursache liegt woanders oder im Werkzeug | **6.63**, erst nachstellen |
| §7 Reihenfolge der Wand wechselt | Plausibel: gefaltet wird im Browser über die Signaturen, die gerade da sind; beim zweiten Besuch sind es mehr, ein anderer Vertreter führt | **6.65** |
| §7 Drei verschiedene Zurück-Links | Stimmt: `BackLink` mit Chevron in `components/BookDetail.tsx:61`, „← The wall“ als Text in `app/book/[id]/decades/page.tsx:123` | **6.64** |
| §8 Alle 30 Sammlungen auf der Startseite | Bewusst zwei Reihen (`components/CollectionsShelf.tsx:6`), `/collections` zeigt alle | nichts |
| §8 „Impressum“ in der Fußzeile | Stimmt (`components/SiteFooter.tsx:32`). Das Wort ist in Deutschland die sichere Kennzeichnung (§ 5 DDG: „leicht erkennbar“) | **6.72**, Julian entscheidet das Wort |
| §8 Link „any edition“ | Titel-Suchlinks gibt es (`searchLinksFor`, `components/BookDetail.tsx:732`), nur nicht immer sichtbar (Zone B aus 1.11) | **6.72**, prüfen |
| §8 „Save to collection“ auf der Buchseite | **Ist da** (F9.3, „Add to collection“), hinter `WALLS`. Auf den Spielkarten nicht | **6.72** (Spiel) |
| §8 Tastaturhinweis unter der Falte, Pfeile auf der Wand | Hinweis steht unter dem Paar (`components/Versus.tsx:433`); die Wand kennt Tab und Enter (0.8a), keine Pfeile | **6.72** |

### 1b. Teil A, der Durchklick unter `npm run dev`

| Befund (Teil A) | Stand im Code | Folge |
|---|---|---|
| A1 Kalte Suche 19 s, Werkseite 503 nach 20,9 s, die Fehlseite hat nur „Back to search“ | Stimmt: `components/BookDetail.tsx` kennt kein „Try again“, die Suche schon (1.4). Die Wartezeit selbst ist Open Library (CLAUDE.md: 2–7 s Suche, 3–10 s Ausgaben, gelegentlich viel länger) | **6.75**; der Wartesatz gehört zu **6.3** |
| A1c Sofort-Treffer aus dem Index, während Open Library sucht | Die Liste aus 6.69 trägt genau das | **6.69** |
| A2 Auf dem Telefon beginnt das Suchfeld der Startseite bei ~540 von 812 px | Über dem Feld stehen Überschrift, Versprechen und zwei Einladungen (`app/page.tsx:80–97`) | **6.76**, Julians Blick |
| A2 Zuletzt gesucht / angesehen als erste Reihe | `useRecentSearches` gibt es; angesehene Bücher nicht | **5.8c** |
| A3 Sekundärliteratur, rohe Titel („The great Gatsby“) | Das Ranking schiebt nach hinten (6.1), die Karte kennzeichnet nichts | **6.81** |
| A4 Zähler und Reiterzahlen laufen beim Nachladen | Ehrlich nach Schritt 15, liest sich aber wie ein Fehler | **6.71** Teil b |
| A5 Kaufen unter der Falte: Bild, „Add to collection“, Scan-Streifen, Druck-Chips vor der ersten Laden-Reihe | Reihenfolge der Spalte aus 1.2/1.11 plus F9.3; „Add to collection“ kam am 2026-09-28 dazu | **6.77**, Julians Blick |
| A6 Keine Navigation außer auf der Startseite | `SiteHeader` hat Zurück, Wortmarke, Suchfeld; Sammlungen und Spiel nur über Startseite und Fuß | **6.68** Teil 2 |
| A7 Reiter „Unknown“ als zweitgrößter | Bewusst nie eingeklappt (Julian 2026-09-11, `components/CoverGallery.tsx:108`); das Wort ist offen | **6.72** (nur das Wort) |
| A7 Kachel „Audible 2013“ in der Wand | Gefiltert wird nach `physical_format` mit „audio“ und nach Titelwörtern (`lib/sources/openlibrary-parse.ts:120`, `lib/normalize.ts:234`); ein Datensatz mit Verlag Audible und leerem Format kommt durch | **6.80** |
| A7 „Titles & authors / Author only“ ist unklar | Umschalter aus 6.60 | **6.72** |
| A7 Die Wand beginnt mit dem neuesten Druck | Open Library ordnet nach Alter des Datensatzes; E17 regelt die Reiter, 6.31 verbietet Nachrücken. Eine Produktfrage, kein Fehler | §4, Frage an Julian |
| A7 Sammlungen am Telefon erst nach sechs Reihen | Folgt aus der Startseite | **6.76** |
| 2. Durchgang: leere Kacheln bei warmem Cache, Bilder nach ~16 s | Die Daten sind da, die Bilder nicht — `/img` kalt oder archive.org langsam | **6.73** (messen), Platzhalter dort |
| 2. Durchgang: der Vertreter von „+22“ ist Perma-Bound 1981 ohne ISBN, die Knöpfe sind nur Titelsuchen | Die Regel aus 6.14 (der Druck des gezeigten Scans führt) ist richtig für die Herkunft, falsch fürs Kaufen | **6.78** |
| 2. Durchgang: nach Enter liegt das Suchfeld halb unter der Kopfzeile | Nicht im Code nachgesehen | **6.79**, erst nachstellen |
| 2. Durchgang: Markt US in Deutschland | **Artefakt des Dev-Servers:** `detectMarket` (`lib/market.ts:49`) nimmt zuerst das Land aus `x-vercel-ip-country`, und diesen Kopf gibt es lokal nicht. In Produktion bekommt ein Leser in Deutschland DE. Richtig ist nur: Accept-Language zählt allein mit dem ersten Eintrag | kein Punkt |
| 2. Durchgang: Dunkelmodus fehlt in features.md | Stimmt | am 2026-09-29 nachgetragen |
| 2. Durchgang: die Seitenleiste scrollt für sich, „More ↓“ sieht wie ein Knopf der Wand aus | Folgt aus A5 | **6.77** |
| 2. Durchgang: „George Orwell, George Orwel“ auf einer Karte | Autoren kommen roh aus der Suchantwort | **6.81** |

## 2. Reihenfolge

Anders als Teil B vorschlägt: erst was ein Leser als **Fehler** sieht und was sich in einer Stunde schließen lässt, dann die Rückmeldung im Spiel, dann Messungen, zuletzt die Entscheidungen. Jede Zeile ein Commit, der die Nummer nennt.

| # | Punkt | Wer | Aufwand | hängt an |
|---|---|---|---|---|
| 1 | 6.63 Zwei Klickfehler nachstellen | Claude | 1 h | — |
| 2 | 6.79 Suchfeld unter der Kopfzeile nachstellen | Claude | 30 min | — |
| 3 | 6.80 Hörbücher in der Wand | Claude | 1 h | — |
| 4 | 6.75 Die Werkseite nach einem Ausfall | Claude | 1–2 h | 6.3 |
| 5 | 6.64 Ein Zurück-Link | Claude | 30 min | — |
| 6 | 6.71 Zahlen: Jahrzehnte 181 von 1.180, Zähler beim Nachladen | Claude | ½ Tag | berührt 6.43 |
| 7 | 6.78 Kaufen über den Druck mit ISBN | Claude | 1–2 h | 6.14 |
| 8 | 6.66 Das Spiel antwortet (inkl. Textzeile F7.9) | Claude | ½ Tag | N11 für Teil 2 |
| 9 | 6.70 Keine Nicht-Cover im Mosaik | Claude | ½ Tag | — |
| 10 | 6.81 Die Trefferkarte: Sekundärliteratur, Titel, Autoren | Claude | ½ Tag | 6.5 |
| 11 | 6.65 Dieselbe Wand, dieselbe Reihenfolge | Claude | ½ Tag | E17, 6.31 |
| 12 | 6.69 Vorschläge und Sofort-Treffer aus dem Index | Claude | ½ Tag | 6.81 |
| 13 | 6.72 Kleinigkeiten | Claude, Julian (Wörter) | je 30 min | — |
| 14 | 6.73 Die Wand am Telefon messen | Claude | 2 h | 6.26, 6.5 `priority` |
| 15 | 6.77 Die Seitenleiste: Kaufen vor Sammeln | Claude baut, Julian sieht an | ½ Tag + Blick | 1.2, 1.11 |
| 16 | 6.76 Die Startseite: Suchfeld zuerst | Claude baut, Julian sieht an | 2 h + Blick | — |
| 17 | 6.68 `/`, das Feld am Telefon, Navigation | Claude, dann Julian | 1 h + Blick | — |
| 18 | 6.16 Schritt 2 ohne 6.18 | Claude, Julian prüft Jahre | 1 h + Liste | — |
| 19 | 6.67 Rangliste und Krone | Claude simuliert, Julian entscheidet | ½ Tag | — |
| 20 | 5.8c Ein Grund wiederzukommen | Julian entscheidet | — | 5.8b, 6.17 |
| 21 | 0.15 Anmeldung | Julian entscheidet | — | Tor aus 5.13a |

Jede UI-Änderung wird bei 390 × 844 und 1280 × 800 angesehen (N14), gegen `npm run dev`, nie gegen Produktion.

## 3. Die Punkte

### 6.63 Zwei Klickfehler: erst nachstellen, dann beheben

**Befund:** (a) Ein Klick auf den Text von „Help us find the prettiest cover of all time!“ und von „Standings“ tat zweimal nichts, ein Klick auf das Element selbst schon. (b) Direkt nach dem Wählen eines Covers traf ein Klick auf „Details“ in der unteren Leiste das Cover dahinter.

**Zuerst nachstellen**, im echten Chrome bei 455 px und bei 390 px: `document.elementFromPoint` an der Stelle des Texts und der Knopfmitte, jeweils sofort und 300 ms nach dem Wählen. Für (b) auch die Reihenfolge der Ereignisse: öffnet der Klick auf die Kachel etwas (Fokus, Scroll-Anker, `scrollIntoView`), das die Leiste für einen Frame verschiebt? Der Bericht klickte mit einem Automationswerkzeug nach Koordinaten; bei verkleinerten Bildschirmfotos treffen solche Klicks oft wenige Pixel daneben. **Lässt sich nichts nachstellen, wird der Punkt mit der Messung geschlossen, ohne Code.**

**Wenn es sich bestätigt:** (a) Trefferfläche: `inline-flex` mit `py-1` am Link, nicht am umgebenden `<p>`; (b) wer über der Leiste liegt, zeigt `elementFromPoint`, und die Leiste bekommt die Klicks, sobald sie im DOM ist. Abnahme: die Messung vorher und nachher in der Historie.

### 6.64 Ein Zurück-Link

`BackLink` aus `components/BookDetail.tsx` in eine eigene Komponente (`components/BackLink.tsx`), mit Chevron und Text; die Jahrzehnte-Seite benutzt sie („The wall“ statt „← The wall“). Das Ziel bleibt je Seite verschieden — das ist richtig, der Text sagt es ja —, nur Zeichen, Abstand und Trefferfläche werden gleich. Alle `SiteHeader left=` durchsuchen, ob es weitere gibt.

### 6.65 Dieselbe Wand, dieselbe Reihenfolge

**Befund:** das erste Cover der Wand war beim zweiten Laden ein anderes.

**Zuerst messen:** Gatsby zweimal mit warmem Cache laden, die ersten 20 Kachel-IDs je Reiter vergleichen; dasselbe nach Neustart des Dev-Servers (kalte Signaturen). **Verdacht:** `foldDuplicateCovers` wählt den Vertreter einer Gruppe nach dem, was gerade da ist; beim zweiten Besuch liegen mehr Signaturen vor (SPEC §7), eine Gruppe wird größer, ein anderer Vertreter führt, die Kachel wandert. **Zu bauen, wenn bestätigt:** der Vertreter und die Stellung einer gefalteten Gruppe hängen nur von der Gruppe ab (erste Ausgabe in der Reihenfolge der Seite, bei Gleichstand die kleinere Cover-ID), nicht davon, welche Signatur zuerst kam; ein Test in `lib/__tests__/` mit zwei Signatur-Teilmengen derselben Ausgaben. **Nicht** die Ordnung der Wand ändern („Jahr absteigend, dann Verlag“ wie vorgeschlagen): die Reihenfolge der Reiter ist E17, das „nichts rückt nach“ ist 6.31; das wäre eine Produktfrage, und Teil A (A7) stellt sie: häufigstes oder ältestes Cover zuerst statt des neuesten Datensatzes. Sie steht in §4.

### 6.66 Das Spiel antwortet auf eine Stimme

Drei Teile, alle ohne ein Byte mehr über den Spieler auf dem Server (N11, F7.3):

1. **Eine Zahl nach dem Pick.** Der laufende Zwischenstand kennt je Cover Elo-Wertung und Zahl der Spiele (`TallyEntry`, `lib/hotornot/game.ts:137`), aber **keine Siege**. Aus zwei Wertungen folgt die erwartete Wahl: „Voters so far would pick this one 3 times in 4“. Das sagt die Rückmeldung nur, **wenn beide Cover mindestens 10 Spiele haben**; sonst „One of the first votes on this cover“ (N12: nichts sagen, was die Stimmen nicht tragen). Kein Satz der Art „71 % picked this“ für genau dieses Paar: bei 3.335 Covern hat fast kein Paar je gegeneinander gespielt. Die Wertungen kommen mit dem Paar (die Paarung hat sie ohnehin), die Seite zeigt sie erst nach der Stimme. Zu prüfen, dass das die Stimme nicht beeinflusst: nichts davon ist vor dem Klick im DOM.
2. **Ein Zähler im Browser.** localStorage: Stimmen heute, Tage in Folge, Stimmen insgesamt; eine Zeile über dem Paar („12 today · 3 days in a row“). Keine eigene Seite „your votes“, solange niemand danach fragt. **SPEC N11 muss erweitert werden** — sie zählt auf, was im Browser liegen darf; das ist Julians Wort (§4).
3. **Texte.** „Two covers of two books“ (`app/versus/page.tsx:67`) wird zu einem Satz, der F7.9 einschließt („Two covers, side by side — sometimes of the same book“). Der Tastaturhinweis rückt vom Fuß des Spiels direkt unter das Paar, bleibt aber nur für Geräte mit Hover.

Abnahme: zehn Stimmen im Dev-Speicher, die Zahl erscheint erst ab 10 Spielen, localStorage leer → Seite ohne Fehler (try/catch), 390 und 1280 px.

### 6.67 Rangliste und Krone — Julian entscheidet, Claude simuliert

**Was der Bericht missversteht:** das Modell ist schon Elo plus Bradley–Terry mit Unsicherheit (F7.5). **Was er richtig sieht:** (a) die Rangliste zeigt je Cover „won 3 of 3“, und das liest sich wie die Ordnung; (b) eine Runde ist so lang wie der Vorrat (3.335 Stimmen), drei gehaltene Runden sind ~10.000 Stimmen, bei heutigem Tempo Monate.

**Vorschlag, in `lab/hotornot/` zu simulieren, bevor jemand entscheidet:** (1) Rundenlänge fest statt Vorratsgröße (500 oder 1.000 Stimmen), gemessen an der Fehlerquote der Krone, die F7.5 für die heutige Regel nennt (6 %); (2) statt „won 3 of 3“ die Stellung mit Band („likely between 3rd and 12th“), aus den plausiblen Ranglisten, die ohnehin gezogen werden; (3) die Zeile „stayed in front for 3 rounds of 3335 votes“ sagt dann, wie weit es noch ist. Julian wählt nach der Tabelle. Kein Umbau ohne diese Zahlen.

### 6.68 Suche von jeder Seite: `/` und das Feld am Telefon

1. **`/` fokussiert das Suchfeld** — auf der Startseite das große, sonst das der Kopfzeile (am Telefon öffnet es sich). Nicht, wenn der Fokus in einem Eingabefeld liegt oder eine Taste mit Modifikator gedrückt ist; nicht auf `/versus`, wo Pfeiltasten spielen (dort `/` trotzdem erlauben, es kollidiert nicht). Eine halbe Stunde.
2. **Das Feld am Telefon:** 6.28 hat unter 640 px bewusst eine Lupe gewählt. Claude baut die Alternative hinter einem Dev-Schalter — auf Buch- und Spielseiten ersetzt das Feld am Telefon die Wortmarke, der Zurück-Link bleibt — und legt Julian beide bei 390 × 844 als Bild vor (lokal, `docs/tests/`). **Julian entscheidet.** Teil A (A6) schlägt für dieselbe Zeile „Collections“ und „Game“ vor, dazu „Your collections“, sobald `bb_visitor` gesetzt ist; Feld und zwei Wörter passen bei 390 px nicht zusammen in eine Zeile, also **eine** Entscheidung mit drei Bildern: Lupe wie heute plus Wörter, Feld ohne Wörter, Wörter in einer zweiten Zeile nur auf der Startseite.

### 6.69 Vorschläge beim Tippen: aus dem Index, das Werk vor dem Buch über das Werk

Heute gibt es keine Autovervollständigung, nur `POPULAR_SEARCHES`. Eine echte fragt Open Library bei jedem Tastendruck — 2–7 s und das Rate-Limit, also nicht. **Vorschlag:** Vorschläge aus einer kleinen, gebauten Liste im Browser: Titel, Autorin, Werk-ID und ein Cover der **veröffentlichten Werke** (`lib/published.ts`, heute ~500) — dieselben, für die die Seite ohnehin einen Index hat. Nicht `data/cover-index.json` selbst (410 KB+, server only, CLAUDE.md), sondern ein eigenes, von `scripts/build-cover-index.ts` mitgeschriebenes JSON mit nur diesen vier Feldern; Größe messen (Ziel unter 40 KB gzip), sonst per Route. Bis zu 6 Treffer mit Miniatur, ein Klick öffnet die Wand direkt. Treffer außerhalb der Liste findet weiter die Suche. **Sofort-Treffer** (Teil A, A1c): dieselbe Liste zeigt, während Open Library noch sucht, die passenden veröffentlichten Werke als eine Zeile über der Ladeszene („Right away“); die Karten der Suche ersetzen sie, wenn sie kommen. Für die Klassiker, die die meisten suchen, ist die Suche damit sofort da. **Sekundärliteratur:** Vorschlag und Karte treffen dieselbe Unterscheidung, gebaut in 6.81.

### 6.70 Keine Nicht-Cover im Mosaik einer Karte

Der Mosaik-Pfad nimmt die ersten vier Cover ohne jede Prüfung. Zwei Stufen, beide ohne neue externe Anfrage:
1. **Werke im Index:** die Signaturen liegen auf der Platte (`indexSignatures`, wie auf der Jahrzehnte-Seite); `looksLikeScannedPage` sortiert dort nach hinten, bevor die vier gewählt werden. Das ist die Regel der Wand, keine neue — gelöscht wird nichts (CLAUDE.md: „Never delete a cover for looking blank“).
2. **Alle anderen:** im Browser nach dem Laden das Seitenverhältnis prüfen (`naturalWidth / naturalHeight` außerhalb 0,5–0,85 — die Grenze aus F7.2) und die Kachel mit dem nächsten Kandidaten füllen; dazu liefert `?summary=1` sechs statt vier IDs. Buchrücken und Querformat-Scans fallen so heraus, weiße Vorsatzblätter nicht — dafür bräuchte es die Signatur.

Messen an „the great gatsby“ und „pynchon“: wie viele Mosaik-Kacheln vorher und nachher Nicht-Cover sind (von Auge, Liste in der Historie).

### 6.71 Zahlen, die einander widersprechen oder beim Hinsehen laufen

**(a) Die Jahrzehnte-Seite zählt 181 von 1.180 Datensätzen** (Teil B §4).

**Zuerst messen:** Gatsby-Jahrzehnte lokal kalt rendern, `detail.editions.length` und `truncated` loggen. Drei mögliche Ursachen: (a) der Lauf brach ab (6.43 — dann ist dies derselbe Fehler, sichtbar, und 6.43 wird zuerst gebaut); (b) `assembleEditions` fasst gleiche ISBN zusammen und die 181 sind zusammengeführte Ausgaben (dann stimmt die Zahl, und der Satz muss sagen, was sie zählt); (c) nur Ausgaben mit Jahr zählen. **In jedem Fall** sagt der Satz unter dem Titel, dass nur Ausgaben mit bekanntem Jahr eingehen, und nennt nie eine Zahl, die neben der der Wand wie ein Widerspruch steht. Die Zählung der Wand selbst (293 → 291) bleibt, wie sie ist: sie sagt, was gesehen wurde (Schritt 15).

**(b) Der Zähler der Wand läuft beim Nachladen** (Teil A, A4: „254 covers · 1,100 of 1,180 editions checked“ → 283 → 287, die Reiter zählen mit). Solange Seiten nachkommen, sagt der Zähler „254 covers so far“ und die Reiter tragen noch keine Zahl; beides steht erst nach der letzten Seite fest da. Keine Zahl wird dabei geschönt, sie wird nur erst als Endzahl gezeigt, wenn sie eine ist (N12). Prüfen, dass die Reiter dabei nicht springen (E17: eingefroren nach dem ersten Auftauchen). Aufwand für (b) ein bis zwei Stunden.

### 6.72 Kleinigkeiten

- **Fußzeile:** „Impressum“ → Julian wählt: „Imprint“, „Contact & imprint“ oder so lassen. § 5 DDG verlangt, dass die Angaben leicht erkennbar sind; „Impressum“ ist die gebräuchlichste Bezeichnung, der BGH hat auch „Kontakt“ genügen lassen (I ZR 228/03, 2006) — vor dem Ändern in [docs/recht-hobbyseite.md](../recht-hobbyseite.md) nachsehen. Empfehlung: „Imprint & contact“, das ein englischer Leser versteht und das Wort behält.
- **Jede Ausgabe mit diesem Titel:** prüfen, ob im Hobby-Modus unter den ISBN-Knöpfen immer ein Titel-Suchlink steht; wenn nicht, einen („Any edition: search by title“). Die Wortwahl darf nichts über Bestand behaupten (E12).
- **Zur Sammlung aus dem Spiel:** unter jedem Cover des Paars neben „Share“ ein „Add to collection“ — nur mit `WALLS` an, und nur nach der Stimme, damit es die Wahl nicht stört. Wiederverwendet `components/AddToWall.tsx`.
- **„Unknown“ als Reiter** (Teil A, A7): bleibt sichtbar (Julian 2026-09-11), aber das Wort sagt einem Leser nichts. Vorschlag „Language not recorded“ oder „No language on record“ — **Julian wählt**, zusammen mit dem Wort der Fußzeile.
- **„Author only“** (Teil A, A7): beim Umschalten sagt der Platzhalter, was jetzt gesucht wird („Author’s name, e.g. Ursula K. Le Guin“); Breite gegen das Feld messen (N14).
- **Pfeile auf der Wand:** ←/→ wandern durch die Kacheln eines Reiters, Enter wählt (öffnet die Seitenleiste). Nur wenn der Fokus auf einer Kachel liegt, damit die Seite weiter scrollt. Fokus-Ringe wie 6.55.

### 6.73 Die Wand am Telefon: messen, bevor gebaut wird

Der Bericht empfiehlt Seiten zu 36 Kacheln; das widerspricht §1 (die Wand ist der Vergleich) und E17/6.31. Erst messen, was ein Telefon tatsächlich tut: bei 390 × 844 und gedrosseltem Netz (Fast 4G) auf dem Dev-Server die Zeit bis zur ersten vollen Bildschirmseite Kacheln, die Zahl der Bildanfragen vor dem ersten Scrollen, und ob `loading="lazy"` greift (Erinnerung: das Browser-Panel lädt verborgen alles; mit Headless-Chrome und hohem Fenster gegenprüfen). Dazu der zweite Durchgang aus Teil A: bei **warmem** Cache trug nach 13 s nur eine von fünf Karten ein Mosaik, die Wand zeigte nach 11 s noch zehn graue Platzhalter. Messen, ob die Zeit in `/img` (kalt beim CDN), bei archive.org oder im Browser liegt (Wasserfall der ersten 20 Bildanfragen). Gehört zu 6.26 und zum `priority`-Teil von 6.5; erst mit den Zahlen entscheiden, ob etwas zu bauen ist (weniger Bilder vor dem Scrollen, kleinere Bildgröße `S` für die hinteren Reihen, ein Platzhalter, der sichtbar atmet — wie die Startwand seit 6.33 —, damit Warten nicht wie „kaputt“ aussieht).

### 6.75 Die Werkseite nach einem Ausfall (Teil A, A1)

Antwortet `/api/works/<id>` mit 503, zeigt die Werkseite „Back to search“ und sonst nichts — für jemanden, der über einen Link oder eine Suchmaschine kommt, eine Sackgasse. Zu bauen: (1) **ein zweiter Versuch im Browser** nach 1,5 s bei 5xx oder Netzfehler, bevor die Seite etwas sagt — dasselbe Muster wie das Mosaik (`components/useCardCovers.ts`, 6.5) und die Suche (1.10); nicht bei 404 oder 429; (2) **„Try again“** auf der Fehlseite wie in der Suche (1.4); (3) der Satz sagt, dass der Katalog nicht antwortete, nicht dass es das Buch nicht gibt (N12, F3.3). Der Wartesatz ab etwa 8 s („Open Library is slow right now …“) ist schon Kandidat 3 von **6.3** und wird dort gebaut, nicht hier. Abnahme: 503 im Dev-Server erzwingen (Umgebungsschalter oder gemocktes Fetch im Test), einmal mit Erfolg im zweiten Versuch, einmal mit zweitem Ausfall. Ein bis zwei Stunden, Claude.

### 6.76 Die Startseite: das Suchfeld zuerst (Teil A, A2 und A7)

Auf dem Telefon beginnt das Feld bei etwa 540 von 812 px; Überschrift, Versprechen und die zwei Einladungen (Spiel, eigene Sammlung) stehen davor, die Sammlungen erst nach sechs Reihen Wand. Vorschlag: Feld direkt unter das Versprechen, die Einladungen als **eine** Zeile darunter; die Sammlungsreihe über die zweite Hälfte der Wand, nicht dahinter. **Julian sieht an**: er hat die Einladungen am 2026-09-28 selbst umformuliert, die Reihenfolge ist Gestaltung. Claude baut hinter einem Dev-Schalter und legt beide Fassungen bei 390 × 844 und 1280 × 800 als Bild vor (lokal, `docs/tests/`), gemessen: Oberkante des Felds in px, Zahl der Sammlungskarten im ersten und zweiten Bildschirm. Zwei Stunden.

### 6.77 Die Seitenleiste: Kaufen vor Sammeln (Teil A, A5 und zweiter Durchgang)

**Wortwahl, von Julian am 2026-09-29 gefragt** („was ist der unterschied zwischen printing und scan“, am Bild der eingeklappten Zeilen „29 printings with this cover“ und „30 scans of this cover“): die zwei Zeilen stehen im Mockup direkt untereinander und erklären sich nicht. Ein *Druck* (printing) ist ein Ausgabe-Datensatz — Verlag, Jahr, ISBN —, ein *Scan* ist ein Bild in einem Katalog. Die Kachel faltet Scans desselben Entwurfs; jeder Scan hängt an einem oder mehreren Drucken. Wird B gewählt, brauchen die Zeilen Wörter, die das sagen (etwa „Printed by 29 editions“ und „30 photos of this cover“) oder nur eine der beiden Zeilen.

**Variante C, gebaut 2026-09-29** (Julian: „ja, baue das. mit scan leading over printing“), unter `next dev` mit `?panel=c`: wie B, aber statt zweier eingeklappter Zeilen **eine** — „30 scans of this cover, on 29 printings ▸“. Aufgeklappt ist jede Zeile ein Scan, links das kleine Bild, daneben die Drucke, die ihn tragen („Scribner · 2003 · ISBN“, bis drei, dann „and n more“). Ein Klick auf das Bild zeigt es oben groß und gibt die Knöpfe einem Druck, der es trägt; ein Klick auf einen Druck gibt sie genau diesem. Das große Cover bleibt groß (Julian: „das normale coverbild soll aber groß bleiben“). Reihenfolge fest, damit nichts unter dem Zeiger springt: der Scan der Wand, dann Scans auf einem Druck mit ISBN, dann der Rest. Ein Druck ohne eigenen Scan bekäme eine letzte Zeile mit gestricheltem Platzhalter. Gemessen an Gatsby, Cover `ol:14811162`: 30 Zeilen mit je einem Druck (der eine Druck mit zwei Scans steht also in zwei Zeilen, die Idee „zwei Bilder nebeneinander“ wurde nicht gebraucht), erste Laden-Reihe wie bei B (565 px am Telefon, 801 am Desktop). Aufgeklappt ist die Liste lang, rund 30 × 72 px.

**D, zweite Fassung, 2026-09-29** (Julian: „mach bei D die scans kleiner, und setze sie doch nochmal über die kauflinks. add to collection kann beim handy neben den close button“): Kacheln 56 × 84 px, Beschriftung 10 px; die Reihe steht jetzt **zwischen Cover und Druck**, also über den Kauf-Links; am Telefon sitzt „Add to collection“ im Kopf des Blatts an Stelle von „Selected cover“, neben „Close“ (`CoverSheet` `headerAction`), am Desktop bleibt es in der Zeile mit „Share“. Gemessen: Reihe 176 px hoch; erste Laden-Reihe am Telefon bei 757 px (im ersten Bildschirm von 844), am Desktop bei 993 px (unter der Falte, solange die Seite oben steht; in B 801). Kopf des Blatts ohne Sammlung eine Zeile, 55 px; **mit** Sammlung kommen Auswahlliste und „Open“ dazu, „Open“ bricht in eine zweite Zeile, der Kopf wird 75 px hoch.

**Variante D, gebaut 2026-09-29** (Julian nach C: „die version die wir haben mit einem seitlichen scrollen finde ich viel besser. können wir die verbessern“), `?panel=d`: wie B die Läden zuerst, dann **offen** die seitliche Reihe der Scans aus A, verbessert: Kacheln 72 × 108 statt 44 × 64 px; unter jeder Verlag und Jahr des Drucks, der sie trägt, „no ISBN“, wo keine ist — die eigene Reihe der Druck-Knöpfe entfällt; ein Scan auf mehreren Drucken sagt „+n more“ und schaltet weiter; Pfeile ‹ › und Verlaufskanten an beiden Enden auf Geräten mit Zeiger (`useOverflowsX` meldet dafür jetzt auch `atStart`); feste Reihenfolge wie C. Gemessen an Gatsby: 30 Kacheln, Reihe 224 px hoch; der Pfeil rechts schob sie um 336 px, dann erschien der linke; die dritte Kachel wählte Bild `ol:14811170` und „Charles Scribner's Sons · 1953“; erste Laden-Reihe wie B.

**Stand 2026-09-29: Mockup gebaut** — Variante B unter `next dev` mit `?panel=b` an jeder Buchseite mit gewähltem Cover (`components/BookDetail.tsx`, `CoverDetails` `layout`, `EditionBlock` `afterLead`). Erste Laden-Reihe am Telefon bei 565 statt 1.174 px, am Desktop bei 801 statt 1.338 px ([Historie](../history.md#2026-09-29--seitenleiste-mit-den-läden-zuerst-als-mockup-roadmap-677)). Wird B gewählt, fällt der Schalter und die doppelte Scan-Zeile weg; wird A behalten, fliegt das Mockup vor dem Merge nach `main` wieder heraus.


Nach der Wahl eines Covers stehen in Seitenleiste und Telefon-Blatt: Bild, „Image from Open Library · on 29 editions“, „+ Add to collection“, der Streifen „30 scans of this cover“, ein Erklärsatz, rund fünfzehn Druck-Chips mit „More ↓“ — die erste Laden-Reihe liegt bei 800 × 600 unter der Falte, im Blatt ebenso. Das Versprechen der Seite (§1: die Ausgabe finden, die man im Regal haben will) endet damit erst nach zwei Bildschirmen. Vorschlag: **Bild → Urteil und erste Laden-Reihe → „Add to collection“ → Scans und Drucke eingeklappt** („29 printings with this cover ▸“). Die Seitenleiste scrollt für sich; unter dem Bild ein Hinweis, dass darunter mehr kommt, statt „More ↓“ am Rand, das wie ein Knopf der Wand aussieht. **Gegen 1.2 und 1.11 prüfen** (fünf sichtbare Bedienelemente, Zone A/B) und die 0 px aus F9.3 nicht verlieren. Julian sieht an, beide Fassungen bei 390 und 1280 px. Ein halber Tag.

### 6.78 Kaufen über den Druck mit ISBN, nicht über den Scan-Träger (Teil A, zweiter Durchgang)

Beim Cover „+22“ von *Nineteen Eighty-Four* führt „Perma-Bound · 1981“ (Schulbindung, keine ISBN): die Leiste sagt, dass kein Laden danach suchen kann, und bietet nur Titelsuchen — obwohl 22 weitere Drucke mit demselben Bild dahinterstehen, davon welche mit ISBN. Die Regel aus 6.14 (der Druck, der den gezeigten Scan trägt, führt) bleibt für die **Herkunft** richtig; für die **Kauf-Knöpfe** führt der erste Druck mit ISBN in der Reihenfolge des Markts, und der Scan-Träger wird als Quelle des Bilds genannt. Ort: `orderEditionsForMarket` (`lib/linkplan.ts:357`) bzw. die Stelle, die den führenden Druck an die Knöpfe gibt. **Das Urteil (`verifyIsbnCover`) prüft dann die ISBN, deren Knöpfe gezeigt werden** — nie eine andere; ein Test, der das festhält. Ein bis zwei Stunden, Claude.

### 6.79 Nach Enter liegt das Suchfeld halb unter der Kopfzeile (Teil A, zweiter Durchgang)

Nach dem Abschicken scrollt die Ergebnisseite so, dass Unterkante des Felds und „Search“ hinter der festen Kopfzeile liegen; wer korrigieren will, scrollt erst hoch. Erst nachstellen (1512 × 790 und 390 × 844, „nineteen eighty four“ + Enter), dann das Ziel des Scrollens suchen; vermutlich fehlt `scroll-margin-top` in Höhe der Kopfzeile (56 px). Eine halbe Stunde, Claude.

### 6.80 Hörbücher in der Wand (Teil A, A7)

„Audible 2013“ steht als Kachel in der englischen Wand von Gatsby, obwohl Hörbücher ganz wegfallen sollen (F3.4, features.md). Gefiltert wird heute nach `physical_format` mit „audio“ und nach Titelwörtern; ein Datensatz mit Verlag „Audible“ und leerem Format kommt durch. Zu bauen: Verlage, die nur Hörbücher machen (Audible, Brilliance Audio, Tantor, Blackstone Audio, Recorded Books, Naxos AudioBooks — Liste gegen die Fixtures prüfen, nicht raten), als Nicht-Buch; ein Test mit dem Gatsby-Datensatz. Das Cover bleibt, wenn ein anderer Druck es trägt (E8: nie ein Cover löschen, nur den Datensatz). Eine Stunde, Claude.

### 6.81 Die Trefferkarte: Sekundärliteratur, Titel, Autoren (Teil A, A3; Teil B §3) — **Vorschlag vom 2026-09-29**

Bei „the great gatsby“ sind 10 von 15 Karten Sekundärliteratur, drei heißen wörtlich „The Great Gatsby“ (Matterson, Lehan, Parkinson); bei „nineteen eighty four“ 11 von 17. **Gemessen am 2026-09-29** an zehn Suchen ([Historie](../history.md#2026-09-29--sekundärliteratur-auf-den-trefferkarten-was-sich-sicher-sagen-lässt-roadmap-681-vorschlag)): ein Etikett „about this book“ lässt sich für die meisten dieser Karten **nicht ehrlich** vergeben. Die Gatsby-Sekundärliteratur trägt kein Titelwort, das sie verrät, und die vorhandene Ableitungsregel (`derivativeIds`) erfasst auch Bücher, die nur den Titel teilen („Flora & Ulysses“, „H.M.S. Ulysses“) — fürs Ranking harmlos, als Etikett eine falsche Behauptung (N12). Der Vorschlag sagt deshalb nur, was sicher stimmt:

1. **Gruppieren statt raten.** Oben die Werke des Erstautors der ersten Karte (Namensschlüssel oder Open-Library-Key) und Werke anderer Autoren mit mindestens einem Zehntel ihrer Ausgaben; darunter ein Abschnitt **„By other authors (12)“**. Das ist in jedem Fall wahr, auch für *Careless People* und Burgess' *1985*, die keine Sekundärliteratur sind. Gemessen: Hauptliste 1–5 Karten, andere Autoren 9–15. Bei *Mumbo Jumbo* stehen damit die gleichnamigen Bücher anderer Autoren als eigene Karten darunter, wie SPEC F1 verlangt. **Nicht** im Autor-Modus (`?author=`), dort ist jede Karte vom selben Autor.
2. **Offen oder eingeklappt — Julian entscheidet.** Vorschlag: bis vier Karten offen unter der Überschrift, darüber eingeklappt als „12 more books by other authors ▸“, mit der Zahl, damit nichts still verschwindet. Die Zahl der Karten oben über der Liste bleibt die ganze.
3. **Ein Etikett nur, wo der Titel es selbst sagt:** „About the book“ für `looksLikeSecondaryLiterature` (SparkNotes, CliffsNotes, notes, companion, reader's guide), „Adaptation“ für `MARKED_DERIVATIVE` ([adaptation], a play, in five acts). Gemessen 0–4 je Suche, 21 insgesamt, keine falsch. **Nie** aus `derivativeIds`.
4. **Autoren entdoppeln:** gleiche Initiale, Nachname eine Änderung entfernt — „George Orwell, George Orwel“, „John D. Simons, John D. Simmons“. Zwei Treffer in zehn Suchen, keiner falsch. Gezeigt wird der erste Name.
5. **Title Case — optional, Julian entscheidet.** Nur wenn der Titel in Satzschreibung steht (ab dem zweiten Wort alles klein), nur ASCII, und kein Artikel oder Bindewort aus dem Italienischen, Spanischen, Französischen oder Deutschen darin (`la, le, les, el, los, de, del, dei, della, degli, delle, e, et, y, und, der, die, das`). Die naive Fassung hätte „Dei Delitte E Delle Pene“ und „La Casa Degli Specchi“ geschrieben. Betroffen in der Stichprobe: 17 Titel, darunter „Careless People“, „The Last Tycoon“, vier Mal „Mumbo Jumbo“. Dagegen spricht: der Katalog schreibt sie so, und Satzschreibung ist in vielen Bibliotheken die Regel, nicht der Fehler.

**Stand 2026-09-29: Teil 1 und 2 gebaut** (Julian: „das klingt gut“ zur Gruppierung), als `groupByAuthor` in `lib/searchgroups.ts` mit Tests an den Fixtures der Abnahmesuchen; Teil 2 wie vorgeschlagen (bis vier offen). Teil 3–5 warten.

**Bau, wie ursprünglich vorgeschlagen:** eine reine Funktion `groupSearchResults(works, mode)` in `lib/searchgroups.ts` (Hauptliste, andere Autoren, Etikett je Karte, entdoppelte Autoren), getestet an den zehn aufgezeichneten Suchen als Fixtures; `BookGrid` zeigt die zwei Abschnitte. **Kein Eingriff ins Ranking**, die Abnahmesuchen aus SPEC F1 bleiben, wie sie sind („genau ein Fitzgerald-Work, zuerst“). 6.69 übernimmt die Unterscheidung für die Vorschläge. Ein halber Tag, nachdem Julian zu 2, 5 und dem Wort der Überschrift entschieden hat.

### 6.16 Schritt 2 ohne 6.18

Das geprüfte Erstausgabejahr hängt heute an Julians Kuratierung (6.18). Vorschlag: eine eigene kleine Datei `data/first-years.json` (Werk-ID → Jahr, Quelle), von Claude für die veröffentlichten Werke aus Wikidata **einmal im Skript** vorgeschlagen (kein Laufzeit-Aufrufer, E10 bleibt unberührt), Julian liest die Liste gegen. Die Seite nimmt das Jahr aus der Datei vor `lib/firstyear.ts`. Gatsby wird 1925. Der Bericht schlägt „~1.600 Bücher im Spiel“ vor; die veröffentlichten Werke zuerst, das Spiel nennt kein Jahr.

### 5.8c Ein Grund wiederzukommen — Julian entscheidet

Drei Ideen aus dem Bericht, jede mit dem, was sie voraussetzt:
- **Cover des Tages** oben auf der Startseite: aus den gekrönten und den oberen 10 % des Spiels plus den kuratierten Covern, täglich per ISR gewechselt. Setzt den Export aus 5.8b voraus (`data/cover-ranking.json`, damit die Produktion nie den Speicher fragt) und passt zur Rotation 6.17.
- **Zuletzt gesucht und zuletzt angesehen** als erste Reihe der Startseite (Teil A, A2), statt der immer gleichen 18 Klassiker: localStorage, nichts auf dem Server; die Suchen liegen schon dort (`useRecentSearches`), angesehene Bücher erweitern N11 wie der Zähler aus 6.66. Billig.
- **Neu gewählt / neu hinzugekommen**: liest den Speicher bei jedem Besuch der Startseite — **zurückstellen**, bis es Besucher gibt, die das füllen.

### 0.15 Anmeldung ohne Passwort — Julian entscheidet, nicht jetzt

Der Bericht will Magic Link oder Passkey statt der ID. Dagegen steht E22 vom selben Tag (Julian: wie taketest.xyz, keine Konten), eine Mail-Adresse wäre das erste personenbezogene Datum der Seite (Datenschutzerklärung, 0.12), und Resend ist erst für Meldungen vorgesehen. **Empfehlung: zurückstellen, Auslöser ist das Tor aus 5.13a** (30 Sammlungen mit ≥ 6 Covern in vier Wochen). Bis dahin genügt, was schon steht: der Satz in `WallIdField.tsx`, dass die ID Schreibrecht gibt; zu prüfen ist nur, ob „Copy link“ (F9.14) denselben Satz direkt neben sich trägt.

## 4. Was Julian entscheiden muss

1. N11 erweitern um zwei localStorage-Einträge: Spielzähler (6.66) und zuletzt angesehen (5.8c)?
2. Rundenlänge der Krone und Anzeige der Rangliste (6.67), nach der Simulation.
3. Suchfeld statt Lupe am Telefon (6.68), nach zwei Bildern.
4. Das Wort in der Fußzeile (6.72).
5. Cover des Tages (5.8c) und Anmeldung (0.15): ob überhaupt.
6. Das Wort für den Reiter „Unknown“ (6.72).
7. Reihenfolge von Startseite (6.76) und Seitenleiste (6.77), nach Bildern.
8. Die erste Reihe der Wand (Teil A, A7): bleibt der neueste Datensatz vorn, oder das häufigste bzw. älteste Cover? Die Faltungszahl („+28“) ist da; 6.31 (nichts rückt nach) gilt so oder so.

## 5. Was nicht gebaut wird, mit Grund

- **Markt aus Accept-Language stärker gewichten** (Teil A): der Befund „US in Deutschland“ kam vom Dev-Server, dem das Land aus `x-vercel-ip-country` fehlt; in Produktion entscheidet es. Allenfalls, wenn 3.1 zeigt, dass Leser den Markt umstellen.

- **Wand in 36er-Seiten mit „show more“:** widerspricht §1; ersetzt durch die Messung 6.73.
- **Nächstes Paar vorladen, Elo/Bradley–Terry:** schon da (F7.8, F7.10, F7.5).
- **Alle Sammlungen auf der Startseite:** `/collections` zeigt sie; die Startseite bleibt bei zwei Reihen.
- **Sortieren und Filtern der Treffer:** nach 6.60 auf Julians Entscheidung ohne Pillen; neu erst mit Zahlen aus 3.1.
- **Vorab berechnete Mosaikbilder:** die vier Kacheln kommen über `/img` aus dem CDN; ein zusammengesetztes Bild spart eine Anfrage je Karte, kostet aber eine Bildroute mehr und passt nicht zu 6.70 (Kachel tauschen). Erst, wenn 6.73 zeigt, dass die Mosaike der Engpass sind.
