# Plan 6.63–6.73, 5.8c, 0.15: Alltagstauglichkeit nach der Durchsicht von außen

Stand: 2026-09-28, **offen**. Quelle ist die [UX-Durchsicht von außen](../tests/2026-09-28-ux-review-extern.md) (Chrome, ~455 px, Dunkelmodus, gegen Produktion), die Julian am selben Tag mit „use this report to make a plan to fix ux and bugs“ in die Sitzung gab. Geschrieben für eine Sitzung, die den Code nicht kennt. Nichts davon ist gebaut.

**Überschneidung:** Am selben Tag schrieb die Sitzung `interface-usability-improvements` einen eigenen Bericht, *docs/tests/2026-09-28-alltagstauglichkeit.md*, beim Schreiben dieses Plans **nicht committet** (nur in ihrem Worktree). Wo beide dasselbe sehen, steht es unten dabei; ihre übrigen Befunde (Kaufen unter der Falte, Navigation in der Kopfzeile, „Unknown“-Reiter, Vertreter ohne ISBN, Markt US in Deutschland) sind hier **nicht** eingeplant — sie gehören in die Punkte, die jene Sitzung anlegt. Vor dem Anlegen weiterer Nummern `npm run worktrees -- --fetch` lesen.

## 1. Was der Bericht richtig sieht, was schon da ist, was einer Entscheidung widerspricht

Jeder Befund wurde am 2026-09-28 gegen den Code gelesen, nicht im Browser nachgestellt (das ist jeweils der erste Schritt unten).

| Befund des Berichts | Stand im Code | Folge |
|---|---|---|
| §1 Eine Stimme bekommt keine Rückmeldung | Stimmt teilweise: F7.8 hebt das gewählte Cover mit einem Ring und zeigt den letzten Pick mit Link — aber keine Zahl, kein Zähler | **6.66** |
| §1 Serie, „your votes so far“ | Nicht vorhanden. Server darf nichts über den Spieler speichern (N11, F7.3); der Browser darf | **6.66**, nur localStorage |
| §1 Cover des Tages, zuletzt angesehen, Neuigkeiten | Nicht vorhanden; die Startseite rotiert nur die Ringe (6.59), die 18 Klassiker stehen fest (6.17 offen) | **5.8c**, Julian entscheidet |
| §2 Anmeldung statt ID zum Kopieren | Die ID ist **bewusst** so gebaut (E22, F9.1, F9.14, Julian 2026-09-28); dass sie Schreibrecht gibt, sagt `components/WallIdField.tsx:35` schon | **0.15**, Entscheidung, nicht jetzt bauen |
| §3 Suchfeld verschwindet hinter einer Lupe | Stimmt unter 640 px: `components/HeaderSearch.tsx:96–97` zeigt das Feld erst ab `sm`, darunter die Lupe — bewusst aus 6.28, weil Zurück-Link, Wortmarke und Feld bei 390 px nicht in eine Zeile passen. Ein `/`-Kürzel gibt es nicht | **6.68** |
| §3 Keine Sortierung/Filter der Treffer | Stimmt. Die Sprach-Pillen wurden am 2026-09-27 auf Julians Entscheidung entfernt (6.60) | nicht eingeplant — erst mit 3.1 (was Leser tun) |
| §3 Vorschlagsliste zeigt einen Treffer | Es gibt keine Autovervollständigung: „Popular“ ist die feste Liste `POPULAR_SEARCHES`, nach dem Getippten gefiltert, höchstens 4 (`components/SearchBar.tsx:86–89`) | **6.69** |
| §3 Sekundärliteratur neben dem Roman | Bekannt, der Label-Teil von **6.5**; der andere Bericht zählt 10 von 15 Karten bei Gatsby | in 6.69 mitgenommen |
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

## 2. Reihenfolge

Anders als der Bericht vorschlägt: erst was ein Leser als **Fehler** sieht und was sich in einer Stunde schließen lässt, dann die Rückmeldung im Spiel, dann Messungen, zuletzt die Entscheidungen. Jede Zeile ein Commit, der die Nummer nennt.

| # | Punkt | Wer | Aufwand | hängt an |
|---|---|---|---|---|
| 1 | 6.63 Zwei Klickfehler nachstellen | Claude | 1 h | — |
| 2 | 6.64 Ein Zurück-Link | Claude | 30 min | — |
| 3 | 6.66 Das Spiel antwortet (inkl. Textzeile F7.9) | Claude | ½ Tag | — |
| 4 | 6.71 Jahrzehnte: 181 von 1.180 | Claude | 1–2 h | berührt 6.43 |
| 5 | 6.70 Keine Nicht-Cover im Mosaik | Claude | ½ Tag | — |
| 6 | 6.65 Dieselbe Wand, dieselbe Reihenfolge | Claude | ½ Tag | E17, 6.31 |
| 7 | 6.68 `/` und das Feld am Telefon | Claude, dann Julian | 1 h + Blick | — |
| 8 | 6.69 Vorschläge aus dem Index | Claude | ½ Tag | berührt 6.5 |
| 9 | 6.72 Kleinigkeiten | Claude, Julian (ein Wort) | je 30 min | — |
| 10 | 6.73 Die Wand am Telefon messen | Claude | 2 h | 6.26, 6.5 `priority` |
| 11 | 6.16 Schritt 2 ohne 6.18 | Claude, Julian prüft Jahre | 1 h + Liste | — |
| 12 | 6.67 Rangliste und Krone | Claude simuliert, Julian entscheidet | ½ Tag | — |
| 13 | 5.8c Ein Grund wiederzukommen | Julian entscheidet | — | 5.8b, 6.17 |
| 14 | 0.15 Anmeldung | Julian entscheidet | — | Tor aus 5.13a |

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

**Zuerst messen:** Gatsby zweimal mit warmem Cache laden, die ersten 20 Kachel-IDs je Reiter vergleichen; dasselbe nach Neustart des Dev-Servers (kalte Signaturen). **Verdacht:** `foldDuplicateCovers` wählt den Vertreter einer Gruppe nach dem, was gerade da ist; beim zweiten Besuch liegen mehr Signaturen vor (SPEC §7), eine Gruppe wird größer, ein anderer Vertreter führt, die Kachel wandert. **Zu bauen, wenn bestätigt:** der Vertreter und die Stellung einer gefalteten Gruppe hängen nur von der Gruppe ab (erste Ausgabe in der Reihenfolge der Seite, bei Gleichstand die kleinere Cover-ID), nicht davon, welche Signatur zuerst kam; ein Test in `lib/__tests__/` mit zwei Signatur-Teilmengen derselben Ausgaben. **Nicht** die Ordnung der Wand ändern („Jahr absteigend, dann Verlag“ wie vorgeschlagen): die Reihenfolge der Reiter ist E17, das „nichts rückt nach“ ist 6.31; das wäre eine Produktfrage, und der andere Bericht fragt sie schon (häufigstes oder ältestes zuerst).

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
2. **Das Feld am Telefon:** 6.28 hat unter 640 px bewusst eine Lupe gewählt. Claude baut die Alternative hinter einem Dev-Schalter — auf Buch- und Spielseiten ersetzt das Feld am Telefon die Wortmarke, der Zurück-Link bleibt — und legt Julian beide bei 390 × 844 als Bild vor (lokal, `docs/tests/`). **Julian entscheidet.** Der andere Bericht schlägt für dieselbe Zeile „Collections“ und „Game“ vor; beides zusammen passt bei 390 px nicht, also in einer Entscheidung.

### 6.69 Vorschläge beim Tippen: aus dem Index, das Werk vor dem Buch über das Werk

Heute gibt es keine Autovervollständigung, nur `POPULAR_SEARCHES`. Eine echte fragt Open Library bei jedem Tastendruck — 2–7 s und das Rate-Limit, also nicht. **Vorschlag:** Vorschläge aus einer kleinen, gebauten Liste im Browser: Titel, Autorin, Werk-ID und ein Cover der **veröffentlichten Werke** (`lib/published.ts`, heute ~500) — dieselben, für die die Seite ohnehin einen Index hat. Nicht `data/cover-index.json` selbst (410 KB+, server only, CLAUDE.md), sondern ein eigenes, von `scripts/build-cover-index.ts` mitgeschriebenes JSON mit nur diesen vier Feldern; Größe messen (Ziel unter 40 KB gzip), sonst per Route. Bis zu 6 Treffer mit Miniatur, ein Klick öffnet die Wand direkt. Treffer außerhalb der Liste findet weiter die Suche. **Sekundärliteratur:** der offene Teil von 6.5 („about this book“ an der Karte) wird hier mitgebaut, damit Vorschlag und Karte dieselbe Unterscheidung treffen; ob Karten ohne Cover eingeklappt werden (der andere Bericht, Befund 3), bleibt dessen Punkt.

### 6.70 Keine Nicht-Cover im Mosaik einer Karte

Der Mosaik-Pfad nimmt die ersten vier Cover ohne jede Prüfung. Zwei Stufen, beide ohne neue externe Anfrage:
1. **Werke im Index:** die Signaturen liegen auf der Platte (`indexSignatures`, wie auf der Jahrzehnte-Seite); `looksLikeScannedPage` sortiert dort nach hinten, bevor die vier gewählt werden. Das ist die Regel der Wand, keine neue — gelöscht wird nichts (CLAUDE.md: „Never delete a cover for looking blank“).
2. **Alle anderen:** im Browser nach dem Laden das Seitenverhältnis prüfen (`naturalWidth / naturalHeight` außerhalb 0,5–0,85 — die Grenze aus F7.2) und die Kachel mit dem nächsten Kandidaten füllen; dazu liefert `?summary=1` sechs statt vier IDs. Buchrücken und Querformat-Scans fallen so heraus, weiße Vorsatzblätter nicht — dafür bräuchte es die Signatur.

Messen an „the great gatsby“ und „pynchon“: wie viele Mosaik-Kacheln vorher und nachher Nicht-Cover sind (von Auge, Liste in der Historie).

### 6.71 Die Jahrzehnte-Seite zählt 181 von 1.180 Datensätzen

**Zuerst messen:** Gatsby-Jahrzehnte lokal kalt rendern, `detail.editions.length` und `truncated` loggen. Drei mögliche Ursachen: (a) der Lauf brach ab (6.43 — dann ist dies derselbe Fehler, sichtbar, und 6.43 wird zuerst gebaut); (b) `assembleEditions` fasst gleiche ISBN zusammen und die 181 sind zusammengeführte Ausgaben (dann stimmt die Zahl, und der Satz muss sagen, was sie zählt); (c) nur Ausgaben mit Jahr zählen. **In jedem Fall** sagt der Satz unter dem Titel, dass nur Ausgaben mit bekanntem Jahr eingehen, und nennt nie eine Zahl, die neben der der Wand wie ein Widerspruch steht. Die Zählung der Wand selbst (293 → 291) bleibt, wie sie ist: sie sagt, was gesehen wurde (Schritt 15); ob sie während des Nachladens ruhiger wird, ist Befund 4 des anderen Berichts.

### 6.72 Kleinigkeiten

- **Fußzeile:** „Impressum“ → Julian wählt: „Imprint“, „Contact & imprint“ oder so lassen. § 5 DDG verlangt, dass die Angaben leicht erkennbar sind; „Impressum“ ist die gebräuchlichste Bezeichnung, der BGH hat auch „Kontakt“ genügen lassen (I ZR 228/03, 2006) — vor dem Ändern in [docs/recht-hobbyseite.md](../recht-hobbyseite.md) nachsehen. Empfehlung: „Imprint & contact“, das ein englischer Leser versteht und das Wort behält.
- **Jede Ausgabe mit diesem Titel:** prüfen, ob im Hobby-Modus unter den ISBN-Knöpfen immer ein Titel-Suchlink steht; wenn nicht, einen („Any edition: search by title“). Die Wortwahl darf nichts über Bestand behaupten (E12).
- **Zur Sammlung aus dem Spiel:** unter jedem Cover des Paars neben „Share“ ein „Add to collection“ — nur mit `WALLS` an, und nur nach der Stimme, damit es die Wahl nicht stört. Wiederverwendet `components/AddToWall.tsx`.
- **Pfeile auf der Wand:** ←/→ wandern durch die Kacheln eines Reiters, Enter wählt (öffnet die Seitenleiste). Nur wenn der Fokus auf einer Kachel liegt, damit die Seite weiter scrollt. Fokus-Ringe wie 6.55.

### 6.73 Die Wand am Telefon: messen, bevor gebaut wird

Der Bericht empfiehlt Seiten zu 36 Kacheln; das widerspricht §1 (die Wand ist der Vergleich) und E17/6.31. Erst messen, was ein Telefon tatsächlich tut: bei 390 × 844 und gedrosseltem Netz (Fast 4G) auf dem Dev-Server die Zeit bis zur ersten vollen Bildschirmseite Kacheln, die Zahl der Bildanfragen vor dem ersten Scrollen, und ob `loading="lazy"` greift (Erinnerung: das Browser-Panel lädt verborgen alles; mit Headless-Chrome und hohem Fenster gegenprüfen). Gehört zu 6.26 und zum `priority`-Teil von 6.5; erst mit den Zahlen entscheiden, ob etwas zu bauen ist (weniger Bilder vor dem Scrollen, kleinere Bildgröße `S` für die hinteren Reihen, ein Platzhalter, der atmet).

### 6.16 Schritt 2 ohne 6.18

Das geprüfte Erstausgabejahr hängt heute an Julians Kuratierung (6.18). Vorschlag: eine eigene kleine Datei `data/first-years.json` (Werk-ID → Jahr, Quelle), von Claude für die veröffentlichten Werke aus Wikidata **einmal im Skript** vorgeschlagen (kein Laufzeit-Aufrufer, E10 bleibt unberührt), Julian liest die Liste gegen. Die Seite nimmt das Jahr aus der Datei vor `lib/firstyear.ts`. Gatsby wird 1925. Der Bericht schlägt „~1.600 Bücher im Spiel“ vor; die veröffentlichten Werke zuerst, das Spiel nennt kein Jahr.

### 5.8c Ein Grund wiederzukommen — Julian entscheidet

Drei Ideen aus dem Bericht, jede mit dem, was sie voraussetzt:
- **Cover des Tages** oben auf der Startseite: aus den gekrönten und den oberen 10 % des Spiels plus den kuratierten Covern, täglich per ISR gewechselt. Setzt den Export aus 5.8b voraus (`data/cover-ranking.json`, damit die Produktion nie den Speicher fragt) und passt zur Rotation 6.17.
- **Zuletzt angesehen** auf der Startseite: localStorage, nichts auf dem Server — erweitert N11 wie der Zähler aus 6.66. Billig.
- **Neu gewählt / neu hinzugekommen**: liest den Speicher bei jedem Besuch der Startseite — **zurückstellen**, bis es Besucher gibt, die das füllen.

### 0.15 Anmeldung ohne Passwort — Julian entscheidet, nicht jetzt

Der Bericht will Magic Link oder Passkey statt der ID. Dagegen steht E22 vom selben Tag (Julian: wie taketest.xyz, keine Konten), eine Mail-Adresse wäre das erste personenbezogene Datum der Seite (Datenschutzerklärung, 0.12), und Resend ist erst für Meldungen vorgesehen. **Empfehlung: zurückstellen, Auslöser ist das Tor aus 5.13a** (30 Sammlungen mit ≥ 6 Covern in vier Wochen). Bis dahin genügt, was schon steht: der Satz in `WallIdField.tsx`, dass die ID Schreibrecht gibt; zu prüfen ist nur, ob „Copy link“ (F9.14) denselben Satz direkt neben sich trägt.

## 4. Was Julian entscheiden muss

1. N11 erweitern um zwei localStorage-Einträge: Spielzähler (6.66) und zuletzt angesehen (5.8c)?
2. Rundenlänge der Krone und Anzeige der Rangliste (6.67), nach der Simulation.
3. Suchfeld statt Lupe am Telefon (6.68), nach zwei Bildern.
4. Das Wort in der Fußzeile (6.72).
5. Cover des Tages (5.8c) und Anmeldung (0.15): ob überhaupt.

## 5. Was nicht gebaut wird, mit Grund

- **Wand in 36er-Seiten mit „show more“:** widerspricht §1; ersetzt durch die Messung 6.73.
- **Nächstes Paar vorladen, Elo/Bradley–Terry:** schon da (F7.8, F7.10, F7.5).
- **Alle Sammlungen auf der Startseite:** `/collections` zeigt sie; die Startseite bleibt bei zwei Reihen.
- **Sortieren und Filtern der Treffer:** nach 6.60 auf Julians Entscheidung ohne Pillen; neu erst mit Zahlen aus 3.1.
- **Vorab berechnete Mosaikbilder:** die vier Kacheln kommen über `/img` aus dem CDN; ein zusammengesetztes Bild spart eine Anfrage je Karte, kostet aber eine Bildroute mehr und passt nicht zu 6.70 (Kachel tauschen). Erst, wenn 6.73 zeigt, dass die Mosaike der Engpass sind.
