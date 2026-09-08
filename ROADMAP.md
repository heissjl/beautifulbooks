# Beautiful Books – Roadmap

Stand: 2026-09-08, nach dem Durchgang durch Pläne, Spec und Code (unten); davor der [Durchklick als Nutzer](docs/tests/2026-09-07-durchklick.md) vom 2026-09-07. **Jeder offene Punkt steht hier genau einmal.** Was die Seite ist, steht in [SPEC.md](SPEC.md); was schon gebaut und gemessen wurde, in [docs/history.md](docs/history.md). Ein erledigter Punkt **bleibt stehen und wird abgehakt**, mit einer Zeile, was dabei herauskam; die ausführliche Fassung steht in der Historie. So bleibt an einem Ort sichtbar, was offen ist und was schon erledigt wurde.

Punkte mit **[T*n*]** kommen aus dem Testbericht und nennen dessen Nummer.

Die Phasen folgen Abhängigkeiten, nicht Aufwand: Provision braucht eine öffentliche Seite, Reichweite braucht Inhalte, Messen braucht Besucher. Innerhalb einer Phase gilt die Reihenfolge der Liste. *Wer* steht bei jedem Punkt: **Julian** (Konten, Geld, Recht, Produktentscheidungen), **Claude** (Code, Messung, Text) oder beide.

## Wo das Projekt steht

**Stand nach dem [Testbericht](docs/tests/2026-09-07-durchklick.md), 2026-09-07 abends.** Was daraus geworden ist, Punkt für Punkt:

| Aus dem Bericht | Erledigt | Offen |
|---|---|---|
| Sechs Fehler (T1–T6) | T1, T2, T5 → 1.4 und 1.5 | T4, T6 → 1.7. T3 war keine Reparatur, sondern eine Messung; sie geht in Entscheidung 0.7 ein |
| Zehn Qualitätsfunde (T7–T16) | T7, T14, und T8 zum Teil → 1.5 und 1.6 | T9 → 6.4, T10 → 1.2, T11 → 1.1, T12 → 6.1, T13 → 6.2, T15 → 6.3, T16 → 1.3 |

Vor dem Deployment stehen damit noch 1.1, 1.2, 1.3, 1.7, 1.8 und 1.9, dazu Julians Phase 0.

**Dazugekommen am 2026-09-07 abends** (Julian beim Ansehen der eigenen Seite): der leere Platz oben rechts auf der Startseite (**1.9**, mit vier Vorschlägen), eine Prüfung anderer Datenbanken, bevor weiter an der Faltung geschraubt wird (**6.6**), die gemessenen Dubletten bei *Mason & Dixon* und in den Mosaiken (**6.7**), und eine „All languages"-Pille hinter „Unknown" auf der Detailseite (**6.8**). 6.6 steht ausdrücklich **vor** 6.7 und 6.4: löst eine andere Quelle die Dubletten an der Wurzel, ist jede Schwellenwert-Arbeit davor verschwendet.

**Zwei Ideen vom 2026-09-07 abends** (Julian): **6.10** „Cover, die so aussehen wie dieses" — machbar, braucht aber einen kleinen Index (wenige hundert Kilobyte) und vor allem ein Farbmaß, denn der heutige Hash ist blind für Farbe; und **6.11** Goodreads, wo die Recherche eindeutig ausfällt: keine API mehr, die Nutzungsbedingungen verbieten die Übernahme von Daten, und Goodreads gehört Amazon, dessen Konto 4.2 braucht. Bleibt: verlinken — und die Leserzahlen von Open Library zeigen, die wir längst holen und bisher nur fürs Ranking benutzen.

**Einnahmen jenseits der Affiliate-Links** (Julian, 2026-09-07: „Geld verdienen, ohne komplett seine Ehre aufzugeben“): Analyse in [docs/plans/PLAN-4-einnahmen.md](docs/plans/PLAN-4-einnahmen.md). Affiliate bleibt die Hauptquelle und ist pro Aufruf mindestens so ergiebig wie jede Werbung, die mit N11 (kein Tracking, kein Cookie-Banner) vereinbar ist; Programmatic Display fällt deshalb weg. **Entschieden am 2026-09-08** (Julian): ein von Hand verkaufter oder belegter Platz ist zu viel Arbeit; ein Platz ist nur in Ordnung, wenn ein Marktplatz ihn automatisch füllt. Die Regeln dazu sind **E19**; offen bleiben 4.7 (Netzwerk anfragen, sobald es Reichweite gibt) und 4.8 (messen), dazu buch7 in 4.3.

**Durchgang durch Pläne, Spec und Code am 2026-09-08** (Julian: „vergleiche Pläne mit Umgesetztem und dem Spec, räume auf“). Ergebnis: die drei historischen Pläne stimmen mit Historie und Code überein; die offenen Pläne hatten vier Stellen, die die Entscheidung E18 noch nicht kannten (6.9, 6.10, PLAN-speicher) oder andere Buchstaben als die Roadmap benutzten (PLAN-5, 5.4a–e). Ein Fund aus PLAN-speicher stand in keinem Punkt: das Signatur-Memo lebt je Serverinstanz, was die sinkende Cover-Zahl beim zweiten Besuch erklärt und billig zu beheben ist — jetzt **6.12**. Das README versprach ein Kontingent „auf Anfrage mehr“, das es nicht gibt. Neu: ein Index der Pläne in [docs/plans/README.md](docs/plans/README.md) und der Vorschlag zur Ordnerstruktur in [docs/plans/PLAN-struktur.md](docs/plans/PLAN-struktur.md), Entscheidung **0.11**. Parallel dazu in Arbeit, nicht committet: das Farbmaß und der Cover-Index für 6.10 (`data/`, `scripts/build-cover-index.ts`).

**Phase 5 neu gefasst am 2026-09-07** (Julian): ausführlicher Plan in [docs/plans/PLAN-5-reichweite.md](docs/plans/PLAN-5-reichweite.md), mit den Seitengattungen, der Kette aus Claude-Agenten, die sie herstellt, und den zehn Regeln gegen Slop. Der Newsletter ist gestrichen, die interne Verlinkung nach **6.9** gewandert, weil sie zuerst der Seite selbst nützt und einen Index braucht, den es noch nicht gibt.

---

## Empfohlene Reihenfolge der nächsten Sitzungen

| # | Was | Wer | Aufwand |
|---|---|---|---|
| 1 | Phase 0, Punkte 0.1–0.4 und 0.8: Verfügbarkeits-Button, zweiter Google-Schlüssel, Abrechnungsversuch, Angaben fürs Impressum, Enter im Suchfeld | Julian | eine halbe Stunde plus Wartezeit |
| 2 | Phase 1, Punkte 1.1 und 1.2: kein automatisch gewähltes Cover, auffindbare Kauf-Links | Claude | eine Sitzung |
| 3 | Phase 1, Punkt 1.3: Bild-Cache vor Open Library und Google | Claude | eine Sitzung, mit Messung |
| 4 | Phase 1, Punkt 1.7: die zwei Antworten, die nicht stimmen | Claude | eine Stunde |
| 5 | Phase 2: Vercel, Domain, Impressum und Datenschutz, Search Console | beide | eine Sitzung |
| 6 | Phase 4, Punkt 4.1: Bookshop.org beantragen, sobald die Seite erreichbar ist | Julian | zehn Minuten plus Tage Wartezeit |
| 7 | Phase 6, Punkt 6.6: andere Datenbanken messen, danach 6.7 (Dubletten) | Claude | zwei Tage, ~15 USD |
| 8 | Phase 3: Analyse-Seite, nach einer Woche echter Besucher | Claude | zwei Tage |

Die Ranking-Punkte aus Phase 6 stehen bewusst nicht in dieser Liste: sie sind Qualität, kein Fehler, und sie brauchen mehr Messung als eine Sitzung hergibt.

Danach entscheidet sich anhand der Zahlen aus Phase 3, ob Phase 4 (Geld) oder Phase 5 (Reichweite) zuerst weitergeht. Ohne Besucher bringen Kauf-Links nichts, ohne Kauf-Links kostet Reichweite nur.

---

## Phase 0 — Entscheidungen, die nur Julian treffen kann

Keine davon ist Code. 0.1 bis 0.4 und 0.8 stehen vor dem Deployment; 0.5 bis 0.7 gehören dazu, dulden aber Aufschub. **0.10 ist ausdrücklich nicht jetzt zu entscheiden** — der Punkt sammelt nur die Argumente und nennt, welche Messungen die Frage später beantworten.

- [ ] **0.1 Verfügbarkeits-Button** (SPEC F2.10, E12). Vor dem ersten Deployment entscheiden, denn auf `localhost` schadet er niemandem, öffentlich schon: vier von sechs Händlern verbieten den abgefragten Pfad in ihrer robots.txt, Amazons Partnerbedingungen untersagen automatisierte Zugriffe, und er sagt nur für etwa zwei von sechs Händlern überhaupt etwas.

  | Option | Was passiert | Aufwand |
  |---|---|---|
  | (a) Entfernen | Button und Route raus, `scripts/check-buylinks.ts` bleibt für die Prüfung vor dem Start | 20 Minuten |
  | (b) Beschränken | Nur Händler, die den Pfad erlauben: heute allein Hugendubel, dessen Antwort nichts aussagt. Der Button wäre leer | 30 Minuten, wertlos |
  | (c) Behalten | Risiko bewusst tragen; dazu ein ehrlicher User-Agent mit Kontaktadresse statt des Browser-Strings | 30 Minuten |

  Empfehlung: (a). Das Risiko trifft die Partnerbeziehungen, die in Phase 4 Geld bringen sollen. Julian hat am 2026-09-07 entschieden, ihn vorerst zu behalten; das hier ist die Grundlage für den zweiten Blick vor dem Deployment.

- [ ] **0.2 Zweiter Google-Schlüssel für die Entwicklung.** Heute bedient ein Schlüssel Arbeit und Betrieb; am 2026-09-07 kamen 305 von 1.000 Anfragen allein aus der Entwicklung. Ein zweites Cloud-Projekt mit eigenem Schlüssel verdoppelt faktisch das Budget des Betriebs. Codeseitig nichts zu tun, nur ein anderer Wert in `.env.local`. Anleitung im [README](README.md). Drei Minuten.

- [ ] **0.3 Abrechnung im Cloud-Projekt aktivieren und das Kontingent erneut ablesen.** Der einzige unerprobte Weg über 1.000 Anfragen pro Tag: der Selbstbedienungsweg („anpassbar“) endet in der Hilfe für die Google-Suche, und die Books API wird nicht pro Anfrage verkauft. Bei anderen Google-APIs hängt das höhere Kontingent an aktivierter Abrechnung, für die Books API ist es unbelegt. Ein Abrechnungskonto allein löst für diese API keine Gebühr aus; das Risiko ist die hinterlegte Zahlungsmethode. Vorgehen: Konto verknüpfen, Kontingentseite neu laden, Zahl hier eintragen, so oder so. Ändert sich nichts, kann die Verknüpfung bleiben oder wieder gelöst werden. Bleibt es bei 1.000, gilt Punkt 4.5.

- [ ] **0.4 Angaben für Impressum und Datenschutzerklärung:** Name, Anschrift, Kontakt (§ 5 DDG, Pflicht für jede nicht rein private Seite, mit Affiliate-Links ohnehin). Privatadresse vermeidbar über einen Impressum-Service mit c/o-Adresse (5–10 EUR/Monat). Die Texte selbst baut Claude in Phase 2.

- [ ] **0.5 Domain.** Namen wählen und kaufen (Kandidaten: beautifulbooks.*, coverwall.*; `.com` bevorzugt, `.app` oder `.io` als Ausweichlösung). Registrar: Cloudflare Registrar (Einkaufspreis) oder INWX. DNS bei Cloudflare, Proxy **aus** für Vercel-Records.

- [ ] **0.6 Vercel-Plan.** Hobby ist laut Nutzungsbedingungen nur für nicht-kommerzielle Nutzung. Vorschlag: Hobby bis zum ersten Affiliate-Link, dann Pro (20 USD/Monat) oder Cloudflare Pages (kostenlos, kommerziell erlaubt, Next.js über OpenNext) oder ein Hetzner-VPS mit Coolify. Serverstandort ändert an Impressum und Datenschutz nichts (Betreiber in Deutschland, EU-Nutzer); Frankfurt hält nur den Drittland-Absatz kürzer.

- [ ] **0.7 Produktentscheidung, erst mit echten Besuchern: kostet eine Detailseite eine oder zwei Google-Anfragen?** Fiele die Titelsuche auf Seite 0 weg (`WorkPageOptions.googleBooks`, eine Zeile), verdoppelte sich die Kapazität von rund 500 auf rund 1.000 kalte Detailseiten pro Tag.

  **Die Rechnung ist enger, als sie aussah [T3].** Am 2026-09-07 gemessen: ein Klick auf ein Cover kostet **eine Anfrage pro ISBN, die dieses Cover trägt** — bei einem Cover mit vier Ausgaben waren es fünf, bei einem anderen zwei. Ein Besuch, der bis zu den Kauf-Links führt, kostet also 3 bis 6 Anfragen, nicht 2. Die „500 kalten Detailseiten“ gelten für reines Stöbern. Zwei Hebel entschärfen das, bevor Cover geopfert werden: Punkt 1.1 (keine automatische Auswahl) spart die Anfrage bei jedem, der nur schaut, und eine Deckelung auf die erste ISBN eines gefalteten Covers spart den Rest — zum Preis, dass das Verdikt für die übrigen ISBNs desselben Covers unbekannt bleibt. Beides ist billiger als der Verzicht auf die Titelsuche, denn deren Preis wären Cover: gemessen über das ganze Werk bei *1984* 4 von 282 (1,4 %), bei *Beloved* 12 von 72 (17 %), dazu die Beschreibungen und Vorschau-Links überall.

  **Empfehlung:** erst 0.2 und 1.1 wirken lassen, dann den Verbrauch aus Phase 3 ansehen, und erst danach entscheiden.

- [ ] **0.8 Zwei Minuten von Hand: geht Enter im Suchfeld?** Der Durchklick konnte es nicht prüfen — das Automatisierungs-Panel schickt Tastendrücke ohne Tastenwert, deshalb löste weder Enter noch ein Zeilenumbruch ein Absenden aus. Das Formular hat `onSubmit` und einen `type="submit"`-Knopf, im echten Browser sollte es also gehen. Es ist der häufigste Weg, eine Suche abzuschicken, deshalb gehört es geprüft und nicht angenommen. Gleich mitprüfen: Tab-Reihenfolge, Enter auf einer Cover-Kachel, Sichtbarkeit der Fokus-Ringe. Kommt dabei etwas heraus, wird daraus ein Punkt in Phase 1.

- [x] **0.9 Speichermodell: eine Präzisierung von E6 abnicken.** *Erledigt 2026-09-07: als **E18** in SPEC §6 aufgenommen, E6 verweist darauf, und §1 sagt jetzt ausdrücklich, dass ein Index abgeleiteter Werte nicht die ausgeschlossene „eigene Buchdatenbank“ ist.* (Vorschlag aus [PLAN-speicher.md](docs/plans/PLAN-speicher.md), 2026-09-07.) Beim Durchdenken von 6.10 zerfiel „brauchen wir einen Speicher?" in zwei Fragen, die fast nichts miteinander zu tun haben: ein **Index**, den ein Skript vor dem Deploy baut und der als Datei im Repo mitkommt, und **Zähler**, in die die laufende Seite schreibt. Nur das Zweite ist Infrastruktur.

  E6 sagt heute „Next-`fetch`-Cache, kein KV, bis ein Auslöser eintritt", und das liest sich als „gar kein Speicher". Damit blieben sechs Punkte liegen, die an nichts als einer Datei hängen (6.10, 6.9, 5.1, 5.4, 1.9 und das kalte Hashing aus SPEC §7). Vorschlag, als Satz an E6 oder als E18:

  > Gebaute, nur lesbare Daten im Repo sind kein Speicher im Sinne von E6. Ein Index, den ein Skript vor dem Deploy erzeugt und der mit dem Deploy ausgeliefert wird, ist erlaubt; ein Speicher, in den die laufende Seite schreibt, bleibt zurückgestellt.

  Zwei Minuten, aber es ist eine Entscheidung und keine Umsetzung.

- [ ] **0.10 Die Grundsatzfrage: hat das Projekt seinen eigenen Zuschnitt überholt?** (Julian, 2026-09-07, beim Abnicken von E18: „nimm auf, ob diese Frage nicht grundsätzlich überdacht werden muss mit dem Scope.") **Jetzt nicht entscheiden** — hier stehen die Argumente, damit die Entscheidung später billig ist.

  E6 und der Ausschluss der „eigenen Buchdatenbank" in §1 stammen vom 2026-09-06, als das Produkt eine Suchmaske über zwei fremde Kataloge war. Seitdem ist einiges dazugekommen, das in dieselbe Richtung zeigt: ein Index über Cover-Signaturen (6.10), Autoren- und Verlagsregister (6.9), eine kuratierte Liste von 500 Werken (5.1), redaktionelle Seiten, die daraus schöpfen (5.4), Zähler für die Analyse (3.1) und ein Bild-Cache (1.3). E18 hält davon ein Stück auf Distanz — ein gebauter Index ist keine Datenbank —, aber die Frage dahinter ist damit nicht beantwortet, sondern vertagt.

  **Was für einen eigenen Datenbestand spricht**, alles gemessen und nicht vermutet:
  - **Die Quellen sind unzuverlässig.** Vier von rund vierzehn kalten Suchen liefen in den Timeout; ein Abruf von *Mumbo Jumbo* kam leer zurück und beim nächsten Versuch vollständig. Ein eigener Bestand wäre schnell und immer da.
  - **Das Google-Kontingent ist die harte Grenze vor dem Start** — 1.000 am Tag, nicht erhöhbar, rund 500 kalte Detailseiten (N9).
  - **Die Faltung scheitert an fremden Metadaten.** „Henry Holt" gegen „Holt Paperbacks" ist für uns nicht dasselbe Haus, weil die Verlagsnamen so ankommen, wie sie ankommen (6.7). Mit eigener Normalisierung wäre es lösbar.
  - **Sechs offene Punkte hängen an einem Index**, der ohne Traffic-Argument nicht zu rechtfertigen war und mit E18 nun doch geht.

  **Was dagegen spricht:**
  - **Jede Kopie muss frisch gehalten werden**, und Veralten ist für diese Seite eine Form von Unehrlichkeit (N12). Der Zähler auf der Detailseite lebt davon, dass er den heutigen Stand der Quelle nennt.
  - **Die Lizenzen sind nicht gleich.** Open-Library-Daten sind offen, **Google-Books-Inhalte sind nicht weitergabefähig**. Ein eigener Bestand müsste sauber trennen, was gespeichert werden darf und was nur durchgereicht werden darf — sonst entsteht genau das Problem, das 6.11 bei Goodreads schon beantwortet hat.
  - **Betrieb kostet.** Ein Bestand, den niemand pflegt, ist schlechter als eine langsame Quelle. Solange es keine Besucher gibt, gäbe es auch niemanden, für den sich der Aufwand lohnt.
  - **Das Produktversprechen hängt nicht daran.** „Judge a book by its covers" braucht keine eigene Datenbank, sondern gute Cover und ehrliche Texte.

  **Wann die Frage sinnvoll zu entscheiden ist — und nicht früher:**
  1. **Nach 6.6**, wenn gemessen ist, was andere Quellen leisten. Löst eine davon Dubletten und Abdeckung, erübrigt sich die Frage weitgehend.
  2. **Nach Phase 3**, wenn Zahlen zeigen, wie viele Besucher es überhaupt gibt und was ein Tag an Kontingent wirklich kostet.
  3. **Sofort dagegen**, wenn keine der beiden Messungen Not zeigt. Dann bleibt es bei zwei fremden Katalogen plus dem Index aus E18, und das ist die richtige Größe für dieses Projekt.

  **Wonach zu entscheiden wäre**, wenn es so weit ist: nicht „hätten wir gern", sondern ob eine dieser drei Zahlen es verlangt — Ausfallquote der Quellen über eine Woche, tatsächlicher Kontingentverbrauch, und wie viele Leser eine Seite verlassen, bevor die Wand steht.

- [x] **0.11 Ordnerstruktur, bevor es weitergeht.** *Erledigt 2026-09-08: Julian hat Option A gewählt — Website im Root, Experimente in `lab/`, der Clip noch nicht. Angelegt: `lab/README.md` mit den sieben Regeln, Lint-Regel in `eslint.config.mjs`, `/scratch-*` in `.gitignore`, Regeln in CLAUDE.md.* (Julian, 2026-09-08: „mache einen Vorschlag für meine Neuordnung, bevor wir das Projekt weitermachen“ — auch für Dinge wie einen automatisierten TikTok-Clip, die nicht mit der Website vermischt, aber im selben Kontext sein sollen.) Vorschlag in [docs/plans/PLAN-struktur.md](docs/plans/PLAN-struktur.md): **die Website bleibt im Root, Experimente kommen nach `lab/<name>/`**, dürfen `lib/` benutzen (das keinen Import aus `next` hat, geprüft) und werden von einer Lint-Regel daran gehindert, in die Website zu wandern; `lab/` ist von der Phasenreihenfolge ausgenommen, aber jedes Experiment hat eine Roadmap-Zeile, und nichts erreicht die Website ohne einen eigenen Punkt. Ein Monorepo mit Workspaces (`apps/web`, `packages/covers`) wäre ein Tag Umbau mit 273 Pfadangaben in Doku und Kommentaren, für eine Trennung, die die Lint-Regel auch leistet — erst, wenn eine zweite ausgelieferte Anwendung entsteht. Zu entscheiden: A oder B, der Name, und ob der Clip (PLAN-struktur §4, Prototyp für 5.5) jetzt gebaut werden darf, obwohl Phase 1 offen ist. Nach der Entscheidung eine Stunde, Claude.

---

## Phase 1 — Vor dem Deployment bauen

Braucht keine Entscheidung von Julian; jeder Punkt ist ein eigener Commit mit Messung.

- [ ] **1.1 Beim Öffnen eines Buchs kein Cover automatisch auswählen.** (Julian, 2026-09-07.) *Umsetzungsplan: [docs/plans/PLAN-1.1-keine-vorauswahl.md](docs/plans/PLAN-1.1-keine-vorauswahl.md).* Heute fällt `selectCoverFrom` auf das erste Cover der ersten Gruppe zurück: der neueste Datensatz der führenden Sprache, nicht das schönste und nicht das bekannteste. Zwei Gründe: das Produkt („Judge a book by its covers“ heißt, auf einer Wand zu landen, nicht auf einer getroffenen Entscheidung) und das Kontingent (die Auswahl löst die ISBN-Nachschau aus, **eine Google-Anfrage pro geöffnetem Buch**, ob jemand die Seitenleiste ansieht oder nicht; eine kalte Detailseite fiele von 2 auf 1, ohne ein einziges Cover zu kosten).

  **Wie beliebig, im Durchklick gesehen [T11]:** *The Great Gatsby* öffnet mit einer Ausgabe von „100 MustReads“, 2026, unter ISBN 9789388843089 — eine indische Print-on-Demand-Ausgabe, auf die dann auch die Kauf-Links zeigen. Auf dem Telefon steht die Peek-Leiste dadurch **sofort beim Laden** am unteren Rand und verdeckt eine Kachelreihe, ohne dass jemand etwas ausgewählt hat.

  Unberührt: geteilte Links mit `?cover=`, die Peek-Leiste auf dem Telefon, die Ladeszene. Zu gestalten ist die breite Ansicht, denn eine leere zweite Spalte wäre schlechter als das Problem. Drei Kandidaten, unentschieden:
  1. Die Wand läuft bis zur ersten Auswahl über die volle Breite und rückt dann zusammen. Ehrlich zur Sache, kostet ein Umspringen des Layouts.
  2. Die Spalte trägt bis zur Auswahl eine kurze Erklärung, was ein Klick bringt.
  3. **Julians Vorschlag:** ein Algorithmus wählt ein **farbenfrohes** Cover automatisch, und das kleine Google-Cover darunter lädt erst, **wenn die Seitenleiste gescrollt wurde**.

  **Der Plan entscheidet sich für Kandidat 2**, größer gefasst als hier beschrieben: die Spalte zeigt bis zur ersten Auswahl *das Werk* statt *einer Ausgabe* — einen Ort, den die Seite bisher gar nicht hat. Kandidat 1 fällt weg, weil ein Umbruch des Rasters bei *Gatsby* alle 293 Kacheln unter dem Finger wegsortiert.

  **Kandidat 3 ist beim Planen geprüft und als Standard verworfen**, aus zwei Gründen, die vorher nicht sichtbar waren. Erstens **gibt es das Farbmaß nicht**: `decodeToGray` rechnet jedes Bild in der ersten Schleife auf Graustufen um, die Signatur trägt nur Hash, Kontrast und Helligkeit. „Farbenfroh" müsste als Sättigungsmaß nachgerüstet werden. Zweitens fällt der zweite Teil von selbst weg: ohne automatische Auswahl wird gar nichts nachgeschlagen, bis jemand klickt — dieselbe Ersparnis, vollständig und ohne einen neuen Auslöser, der nach 1.2 ohnehin wackelig wäre. **Die Idee behält ihren Wert für 1.9**, wo ein auffälliges Cover gesucht wird, ohne dem Leser eine Wahl abzunehmen; dort ist sie notiert.

- [ ] **1.2 Die Kauf-Links sind in der Seitenleiste nicht auffindbar.** (Julian, 2026-09-07: „man weiß erst gar nicht, dass man scrollen muss“.) Gemessen auf 1440 × 900 bei *Beloved*: sichtbare Höhe der Seitenleiste 804 px, Inhalt 2.351 px, davon das Cover allein 554 px; „Buy this ISBN“ liegt 437 px unter dem Fensterrand, ohne sichtbaren Hinweis, dass unterhalb des Covers etwas kommt.

  **Im Durchklick am 2026-09-07 auf einem frischen Buch bestätigt [T10]:** *Wolf Hall*, dieselbe Auflösung, Seitenleiste 804 px sichtbar bei 1.256 px Inhalt, „Buy this ISBN“ bei y = 1.051, also 151 px unter der Kante. Am Fenster sieht man das große Cover und darunter „Title“ und „Published“, sonst nichts ([Bild](docs/tests/2026-09-07-seitenleiste.png)). Der Abstand hängt an der Zahl der Metadatenzeilen — 437 px bei *Beloved*, 151 px hier — das Fehlen jedes Hinweises nicht.

  Kandidaten: (a) Kauf-Links **über** das Cover; (b) das Cover in der Höhe deckeln, wie es die Telefon-Schublade schon tut (180 px), damit Bild und Links zusammen ins Fenster passen; (c) eine festgeklebte Leiste am unteren Rand der Seitenleiste mit den ersten Links, analog zur Peek-Leiste; (d) eine Verlaufskante als Hinweis, das Billigste und Schwächste.

  **Julians Zusatzidee, nur die zwei provisionsfähigen Links hochzuziehen, hat heute zwei Haken:** beide (Amazon, Bookshop) sind unkonfiguriert, es gibt also null Links zum Nudgen (Phase 4); und die About-Seite sagt „The order of the shops is not sorted by what they pay“. Vertretbar wäre eine Ordnung nach `BuyLink.kind` (Buchseite vor Trefferliste), die zufällig dieselben Links begünstigt und dem Leser nachweisbar nützt; oder der Satz auf About wird geändert. Unausgesprochen geht es nicht.

- [ ] **1.3 Bild-Cache vor Open Library und Google** (SPEC N8). Cover laden heute direkt von `covers.openlibrary.org`, das auf archive.org weiterleitet und unter Last langsam oder gar nicht liefert (bei 18 gleichzeitigen Anfragen kamen nach 15 s nur die Google-Bilder); Open Library dokumentiert außerdem Rate-Limits für Cover. Optionen: `next/image` ohne `unoptimized` mit `remotePatterns` (Vercels Bildoptimierung, Kontingent des Plans prüfen) oder eine eigene Proxy-Route mit CDN-Cache. Vorher messen, wie viele verschiedene Bilder eine Detailseite lädt, damit das Kontingent der Optimierung nicht die nächste Grenze wird. *Im Durchklick bestätigt [T16]: die Konsole meldet auf jeder Seite mehrfach LCP-Warnungen zu `covers.openlibrary.org`; das `priority` auf den ersten Kacheln gehört mit dazu (6.5).* Verwandt, aber getrennt: 6.12 (Signaturen überleben eine Instanz nicht).

- [x] **1.4 Ein Ausfall der Suche heißt nicht mehr „No books found“. [T1, T2]** *Erledigt 2026-09-07, Commit `0991444`.*

  Der schwerste Fund des Testberichts. `searchWorks` verschluckte jeden Fehler in eine leere Liste, die Route antwortete 200, und der Leser las, es gebe das Buch nicht — bei vier von rund vierzehn kalten Suchen, zweimal davon für *Norwegian Wood*, das Open Library mit 124 Werken führt.

  **Ergebnis:** `SourceUnavailableError` trennt Schweigen von Leere; die Route antwortet 503 ohne Cache-Header, und nur die 200 trägt noch `s-maxage`. Der Deckel für die Suche steht auf 12 s statt 8, weil von zwölf ungedeckelt gemessenen Suchen drei zwischen 9 und 10 s antworteten. Die Oberfläche zeigt „The catalogue did not answer“ mit einem Knopf „Try again“; der Leerzustand nennt den Sprachfilter nur noch, wenn einer gesetzt ist. Mitgefunden und behoben: Suchen unter drei Zeichen (Open Library lehnt sie mit 422 ab) hießen ebenfalls „nichts gefunden“. Live belegt, `austerlitz sebald` antwortete während der Prüfung mit 503 nach 10,5 s.

- [x] **1.5 Die Sätze, die etwas Falsches sagten. [T5, T14, T2, T11]** *Erledigt 2026-09-07, Commit `48a493a`.*

  **Ergebnis:** Die Verdikte stehen nur noch an einer Stelle (`lib/verdicts.ts`); Seitenleiste und About-Seite lesen daraus, ein Auseinanderlaufen ist ausgeschlossen. Die About-Seite zeigt jetzt alle fünf Zustände im Wortlaut der Oberfläche statt drei in der zurückgezogenen Fassung „Shops show this cover“. Fünf Tests halten fest, was diese Sätze nicht sagen dürfen. Das Erscheinungsjahr ist ein Zitat geworden: „Open Library dates it to 1920“ statt „first published 1920“ — eine zweite Quelle zum Gegenprüfen gibt es nicht, weil die Wand den jüngsten Datensatz zuerst lädt. Der Punkt zum geteilten Link erledigt sich mit 1.1 und steht dort.

- [x] **1.6 Die zwei Bilder, die nach einem Fehler aussahen. [T7, T8]** *Erledigt 2026-09-07, Commit `48a493a`.*

  **Ergebnis:** Die hohen Kacheln passen das ganze Cover ein, statt die Hälfte wegzuschneiden ([vorher](docs/tests/2026-09-07-mosaik.png), [nachher](docs/tests/2026-09-07-mosaik-behoben.png)). Betroffen war auch die linke Spalte des Drei-Cover-Mosaiks, was der Bericht nicht gesehen hatte; das Vier-Cover-Raster blieb unangetastet. Karte und Teilbild wählen jetzt ein Cover je Druck, erkannt an Verlag und Jahr: das [Teilbild von *Wolf Hall*](docs/tests/2026-09-07-teilbild-behoben.png) zeigt vier verschiedene Cover statt zweimal derselben spanischen Ausgabe.

  **Was dabei nicht zu lösen war:** Zwei Verlage, die dieselbe Gestaltung lizenzieren (Granta 2021 und Catapult 2021 bei *The Manningtree Witches*), stehen weiter nebeneinander. Das erkennt nur ein Bildvergleich, und der bräuchte Signaturen, die der Server erst holen und hashen müsste — mehrere Sekunden auf einer Route, auf die der Vorschau-Dienst eines Messengers nicht wartet. Die Wand faltet sie, die Karte nicht.

- [ ] **1.7 Zwei Antworten, die nicht stimmen. [T4, T6]** Beides klein, beides sauber prüfbar.
  - Eine unbekannte, aber wohlgeformte Work-ID (`/book/OL99999999W`) antwortet mit **200** statt 404; `notFound()` läuft nur für ein kaputtes ID-Muster. Vor Phase 5 beheben, sonst indexiert Google den Soft-404.
  - `?offset=1500` liefert die Seite 1400 und meldet 1400. Die Route soll den Offset melden, den sie geliefert hat, und jenseits der Kappung eine leere Seite geben.

- [ ] **1.8 Händler-URLs Hugendubel und genialokal von Hand im Browser prüfen.** Beide antworten dem Skript mit 200 und rendern die Treffer erst im Browser; ihre URL-Muster sind weder bestätigt noch widerlegt. Zehn Minuten, beim Prüfen im sichtbaren Browser-Panel.

- [ ] **1.9 Der leere Platz oben rechts auf der Startseite.** (Julian, 2026-09-07, nach einem Blick auf die eigene Startseite: „der Platz oben rechts ist perfekt für noch ein Design-Element".) Heute steht die Überschrift „Judge a book by its covers." links, daneben nichts; die rechte Hälfte über dem Suchfeld ist leer ([Startseite auf 1440 × 860](docs/tests/2026-09-07-startseite.png)). Das ist der erste Bildschirm, den ein Besucher sieht, und er zeigt gerade nichts von dem, was die Seite kann.

  **Vorschläge, von stärkstem Argument zu billigstem:**

  1. **Ein Fächer aus drei bis vier Covern *desselben* Buchs**, leicht gedreht und überlappt, mit einer kleinen Zeile darunter („Nineteen Eighty-Four · vier von 226 Covern"). Das ist das Produktversprechen als Bild statt als Satz: ein Buch, viele Gesichter. Die visuelle Sprache gibt es schon in `LoadingStage` und `flyCovers`, sie wäre also wiedererkennbar und nicht neu zu erfinden. Kostet nichts an Anfragen, wenn die Cover-IDs wie bei `lib/curated.ts` fest hinterlegt sind.
  2. **Cover der Woche**, ein einzelnes großes Cover mit Verlag, Jahr und einem Satz, warum es bemerkenswert ist, verlinkt auf sein Buch. Ruhiger als Vorschlag 1 und der natürliche Anfang der redaktionellen Seiten aus 5.4; der Preis ist, dass jemand es pflegen muss.
  3. **Zwei Cover desselben Buchs nebeneinander, mit Jahreszahlen** („1949 / 2021"). Zeigt die Zeitachse, die das Produkt eigentlich ausmacht, und braucht am wenigsten Platz.
  4. **„Zuletzt gesucht"** aus dem localStorage (`useRecentSearches` gibt es bereits) als kleine Cover-Reihe. Nützlich für Wiederkehrer, aber **beim ersten Besuch leer** — und das ist der Besuch, der zählt. Nur als Ergänzung zu einem der ersten drei, nie allein.

  **Empfehlung: Vorschlag 1**, mit 3 als Rückfallposition, wenn der Fächer auf 1.280 px zu laut wirkt. Vorschlag 4 später dazu, wenn es Wiederkehrer gibt.

  **Julians Algorithmus für ein farbenfrohes Cover gehört hierher**, nicht zu 1.1: hier wählt er kein Buch für den Leser aus, sondern illustriert eines. Zu bauen wäre ein Sättigungsmaß — die Signaturen sind heute reine Graustufen (`decodeToGray` in `lib/imagehash.ts` verwirft die Farbe in der ersten Schleife), ein zweiter Akkumulator in derselben Schleife genügt, und da Signaturen ohnehin bei jeder Anfrage aus den 30 Tage gecachten Bytes neu gerechnet werden, kostet es keine zusätzliche Ladung. Begründung in [PLAN-1.1](docs/plans/PLAN-1.1-keine-vorauswahl.md) §3.

  **Bedingungen, die für jede Variante gelten:** keine Google-Anfrage und kein Nachladen beim ersten Rendern (die Cover-IDs stehen fest, wie in `lib/curated.ts`); auf schmalen Bildschirmen darf das Element das Suchfeld nicht unter die Kante schieben, dort entfällt es oder rückt unter die Wand; und es darf nichts behaupten, was §1 verbietet — „vier von 226 Covern" ist erlaubt, „alle Cover" nicht.

---

## Phase 2 — Online gehen

- [ ] **2.1 Vercel-Projekt.** GitHub-Repo verbinden, `main` = Production, jeder Branch eine Preview-URL, Region `fra1`. Umgebungsvariablen: `GOOGLE_BOOKS_API_KEY` (**Pflicht**, sonst teilt sich die Seite das anonyme Kontingent, das fast immer erschöpft ist), `NEXT_PUBLIC_SITE_URL` (absolute URLs für Canonical und Open-Graph-Bild), `AFFILIATE_*` sobald vorhanden. Vercel Analytics (cookiefrei) und Speed Insights einschalten.
- [ ] **2.2 Domain und DNS** aus 0.5 verbinden.
- [ ] **2.3 Impressum, Datenschutzerklärung, Affiliate-Hinweis** als Seiten mit Links in der Fußzeile (Angaben aus 0.4). Inhalt der Datenschutzerklärung: Hosting und IP-Adressen, Vercel Analytics, Cover-Bilder von Drittservern (Open Library, Google), localStorage und Cookie `market`, die Klickzählung ohne jede Kennung (SPEC F5), ggf. Drittlandtransfer (Vercel ist im EU-US Data Privacy Framework). Generator: e-recht24 oder IHK. Kein Cookie-Banner nötig, solange nur Vercel Analytics läuft. Amazon verlangt für den Affiliate-Hinweis einen konkreten Wortlaut (Phase 4).
- [ ] **2.4 Betrieb.** UptimeRobot (kostenlos) auf `/api/search?q=1984`; Fehler vorerst über die Vercel-Logs, Sentry erst bei Bedarf.
- [ ] **2.5 Search Console und Bing Webmaster Tools ab Tag 1**, Sitemap einreichen.
- [ ] **2.6 Abnahme nach dem ersten Deployment:** die fünf Akzeptanz-Queries live, eine kalte Detailseite mit Zähler, ein Kauf-Link über `/go/`, das OG-Bild in einem Messenger, und am Abend den Google-Verbrauch in der Konsole ablesen und hier notieren.

---

## Phase 3 — Messen (nach dem Deployment)

- [ ] **3.1 Eine Analyse-Seite für diese Website.** (Julian, 2026-09-07.) Vorläufiger Plan in [docs/plans/PLAN-B.md](docs/plans/PLAN-B.md), Abschnitt nach B4. Die Klick-Logs zeigen nur, *dass* geklickt wird; sie sind kurzlebig und nicht auswertbar. Fertige Werkzeuge beantworten „wie viele Besucher, woher, welche Seite“; die Fragen dieser Seite sind andere, und keine ist eine Seitenzahl:

  | Frage | Warum |
  |---|---|
  | Wie viele Cover hat ein Leser gesehen, bevor er ging? | Eine nach Seite 0 verlassene Detailseite hat versagt, zählt aber als Aufruf |
  | Wie oft endet eine Suche ohne Klick, und auf welcher Position wird geklickt? | Das Vertrauensversprechen, direkt gemessen |
  | Welcher Händler wird geklickt, je Markt und Linkart? | Der einzige Hebel für die Reihenfolge, Grundlage jeder Partnerbewerbung |
  | Wie oft wird ein Cover gewählt, dessen ISBN der Verlag anders zeigt? | Wird das Verdikt gelesen, schreckt `differs` ab? |
  | Wie viele Google-Anfragen kostet ein Tag wirklich? | Entscheidet 0.7 |
  | Welche Werke werden gesucht, die wir schlecht bedienen? | Die Liste der nächsten Verbesserungen und der kuratierten 500 (5.1) |

  Technik: Zähler in einem Schlüssel-Wert-Speicher (Vercel KV / Upstash), ein enger Endpunkt `/api/event` mit fester Liste erlaubter Typen, ein Sender über `navigator.sendBeacon`, der beim Verlassen genau einmal feuert, eine Seite `/admin/insights` hinter einem Token. **Keine Kennung des Lesers** (E14). Ein Tag für Speicher, Endpunkt und die drei serverseitigen Zahlen, ein zweiter für die drei clientseitigen. Auf `localhost` misst man sich selbst, deshalb erst nach Phase 2.
- [ ] **3.2 Google-Verbrauch mit echten Besuchern** eine Woche lang ablesen; danach 0.7 entscheiden.
- [ ] **3.3 Conversion** aus den Partner-Dashboards monatlich in eine Tabelle; nach drei Monaten Händler ohne Conversion nach hinten sortieren, sofern das mit dem Satz auf der About-Seite vereinbar bleibt (1.2).

---

## Phase 4 — Geld

Prinzip (SPEC 2.4): Affiliate-Parameter aus Umgebungsvariablen pro Markt; ohne Variable der neutrale Link. Reihenfolge der Beantragung: erst US, dann UK, dann DE.

- [ ] **4.1 Bookshop.org zuerst** (US, und UK falls getrennt geführt). Höchste Provision (~10 %), passt zur Zielgruppe, und die ID repariert nebenbei einen kaputten Link: ohne sie zeigt Bookshop auf eine Suchseite, die per robots.txt gesperrt ist und nichts einbringt; mit ID auf eine Produktseite. Die Bewerbung verlangt eine erreichbare Seite, also nach Phase 2 (oder mit der Preview-URL versuchen). Danach `AFFILIATE_BOOKSHOP_ID_US|UK` in Vercel eintragen; die Tabelle schaltet den Linktyp von selbst um, ein Test deckt das ab.
- [ ] **4.2 Amazon Associates (US) / PartnerNet (DE) / UK erst mit etwas Traffic.** Drei qualifizierte Verkäufe in 180 Tagen, sonst wird das Konto geschlossen. Pro Marktplatz ein Konto. Zweiter Grund: die **Product Advertising API** liefert zur ISBN das Bild, das der Handel wirklich ausliefert, und würde das Verdikt bei den heute 12 von 20 unbekannten ISBNs von „unknown“ auf eine Aussage heben. Pflichten: Hinweis-Wortlaut, keine Preise ohne deren API, keine Links in E-Mails.
- [ ] **4.3 Weitere Programme:** AbeBooks (über Impact; wichtig für vergriffene Ausgaben, also die mit den interessanten Covern), Thalia / Hugendubel / genialokal über Awin oder Adcell, eBay Partner Network für Sammlerausgaben. Dazu die Händler, die selbst spenden und Provision zahlen (PLAN-4-einnahmen, Abschnitt 3 D): **buch7.de** (75 % des Gewinns an soziale Projekte; Partnerprogramm existiert, Satz nicht veröffentlicht, anfragen; robots.txt des Zielpfads vorher prüfen, das Problem aus 4.1 nicht wiederholen) und **Better World Books** (über Impact prüfen). Für den DE-Markt wäre buch7 der einzige Link, der Provision bringt und dem Leser zugleich etwas Gutes tut.
- [ ] **4.4 Steuer und Gewerbe.** Affiliate-Einnahmen sind Einkünfte aus Gewerbebetrieb; ab Absicht Gewerbeanmeldung, Kleinunternehmerregelung prüfen.
- [ ] **4.5 Falls das Google-Kontingent nicht trägt** (nach 0.3 und 3.2): Ersatz für die ISBN-Nachschau, in dieser Reihenfolge: **ISBNdb** (ab ~15 USD/Monat, ersetzt sie eins zu eins), **Amazon PA-API** (kostenlos, aber erst nach 4.2), oder **Verzicht**, dann zeigt das Verdikt nur noch „unknown“ und die Seite funktioniert mit kleinerem Versprechen.
- [x] **4.6 Werberegeln in die Spec.** *Erledigt 2026-09-08 als **E19**, nach Julians Entscheidung: kein von Hand verkaufter oder belegter Platz; ein Platz nur, wenn ein Marktplatz ihn automatisch füllt.* Die Regeln: höchstens ein Platz je Seite, außerhalb von Wand, Ergebnis und Händlerliste; automatisch gefüllt; keine Kennung des Lesers, sonst kein Platz; gekennzeichnet; Kategorien ausschließbar; niemand zahlt mit Funktion. Ausführlich in [PLAN-4-einnahmen.md](docs/plans/PLAN-4-einnahmen.md) §4.
- [ ] **4.7 Ein Werbenetzwerk ohne Kennung anfragen, sobald es Reichweite gibt** (fünfstellige Impressionen in der Search Console, aus 3.1 / Phase 3). Kandidaten: Carbon Ads, EthicalAds, BuySellAds. **Vorher die entscheidende Frage klären** (PLAN-4-einnahmen, Frage 6.4): liefert das Netzwerk ohne Cookie und ohne Wiedererkennung, was verlässt den Browser des Lesers, reicht ein Satz in der Datenschutzerklärung, lassen sich Kategorien ausschließen? Fällt eine Antwort negativ aus, gibt es den Platz nicht (E19). Bei Zusage baut Claude Komponente, Platz (unterhalb der Seitenleiste und in der Fußzeilen-Zone der Startseite, nie in der Schublade, **nicht** der Platz aus 1.9), Datenschutztext und About-Satz; ein halber Tag. Dazu, mit 2.3 und je zwei Minuten: ob die Fußzeile einen Satz mit Spendenlink zu Open Library bekommt, und ob eine Spendenzeile für die Seite selbst (Ko-fi, Liberapay) mitläuft. Julian fragt an, Claude baut.
- [ ] **4.8 Den Platz messen** (drei Monate nach 4.7). Auszahlung und Klickrate; bringt der Platz weniger, als er an Aufmerksamkeit kostet, wird er entfernt, nicht die Regeln. Die Spendenzeile im selben Zeitraum behalten oder streichen. **Programmatic Display, Direktvermarktung, Bezahlfunktionen mit Google-Daten und Merch aus Cover-Wänden bleiben ausgeschlossen**, solange N11, E19, die Google-Bedingungen und die Bildrechte gelten; die Begründung steht im Plan.

---

## Phase 5 — Reichweite

Eine Suchseite ohne eigene Inhalte bekommt keinen organischen Traffic. Die Grundlage (statische Work-Seiten, Titel, Schema.org, OG-Bild, Sitemap, robots) steht seit 2026-09-07; die Inhalte fehlen.

**Detailplan: [docs/plans/PLAN-5-reichweite.md](docs/plans/PLAN-5-reichweite.md).** Dort steht, welche Seitengattungen aus welchen Daten entstehen, die sechsstufige Kette, mit der Claude-Agenten sie herstellen, und vor allem die **zehn Regeln gegen Slop** — ohne die wäre die Automatisierung nicht zu verantworten. Kurzfassung des Grundsatzes: auf einer Seite über Buchcover ist der Text die Bildunterschrift, nicht der Inhalt; die Maschine schreibt keine Artikel, sie stellt Belege zusammen.

- [ ] **5.1 Die Liste der ~500 Werke.** Eine schlichte Liste von Open-Library-Work-IDs, wie `lib/curated.ts` sie heute mit zwölf Einträgen führt — nur eben mit rund 500.

  **Wozu.** Die Sitemap enthält heute **14 Adressen**: Startseite, About und die zwölf kuratierten Werke. Mehr kann Google nicht indexieren, denn eine Suche ist kein Dokument (`/?q=…` steht bewusst nicht drin) und eine Werkseite existiert für einen Crawler erst, wenn ihn jemand auf sie hinweist. Jede Werkseite ist aber echter eigener Inhalt: eine Wand von Covern, die es so nirgends gibt, mit einem Titel, den Leute wirklich eingeben („1984 book covers", „gatsby editions"). 500 Werke sind also 500 Chancen zu ranken statt zwölf.

  **Warum nicht einfach alle.** Open Library kennt Millionen Werke, und für die meisten wäre unsere Seite schlecht: ein Datensatz mit einer Ausgabe und einem Cover ergibt eine leere Wand. Eine Sitemap voller solcher Seiten ist schlimmer als eine kurze — sie führt einen Crawler auf dünne Seiten und beschädigt das Urteil über die ganze Domain. Die Liste muss deshalb aus Werken bestehen, bei denen **unsere** Seite gut ist.

  **Das Auswahlkriterium fällt damit aus dem Produkt:** viele Ausgaben, viele davon mit Cover, und genug Bekanntheit, dass überhaupt jemand danach sucht. Konkret als Skript: Open Library nach `readinglog_count` absteigend, gefiltert auf `edition_count` über einer Schwelle, je Autor gedeckelt (sonst stehen vierzig Agatha Christies drin), Sekundärliteratur und Ableitungen raus über die Regeln aus 6.1. Danach einmal von Hand durchsehen. Später kommen die Suchen dazu, die auf unserer eigenen Seite ohne guten Treffer endeten (3.1) — das ist die ehrlichste Quelle, aber sie braucht erst Besucher.

  **Drei Verwendungen, die nicht dasselbe sind** und im alten Eintrag durcheinandergingen:
  1. **Sitemap** — alle 500. Kostet nichts, es sind nur URLs.
  2. **Beim Build vorrendern** (`generateStaticParams`) — **nicht** alle 500. Jede Seite kostet zwei Open-Library-Anfragen, und Open Library braucht 2 bis 7 Sekunden pro Anfrage; 500 Seiten wären rund 1.000 Anfragen und ein Build von zehn Minuten aufwärts. Vorrendern lohnt für die vordersten 30 bis 50; der Rest entsteht beim ersten Besuch und liegt danach 24 Stunden im ISR-Cache. **Keine Google-Anfrage**, weil die Metadaten mit `googleBooks: false` laufen.
  3. **Kandidaten für die Inhalte** aus 5.4 — dieselbe Liste, andere Schwelle: dort zählt nicht Bekanntheit, sondern ob genug Cover für eine Beobachtung da sind.

  **Getrennt halten von der Startseiten-Wand.** Die zwölf Werke in `lib/curated.ts` sind von Hand nach Aussehen gewählt und bleiben zwölf; die 500 sind eine andere Liste mit einem anderen Zweck und gehören in eine eigene Datei.

- [ ] **5.2 Seite 0 serverseitig rendern**, falls die Indexierung schwach bleibt. Heute stehen Titel, JSON-LD und OG-Bild im HTML, die Wand lädt im Browser; Google rendert JavaScript, aber nicht garantiert. **Nicht auf Verdacht bauen** — erst wenn die Search Console zeigt, dass die Cover nicht ankommen.

- [ ] **5.3 Die Fabrik: Kandidaten, Faktenblatt, Entwurf, Prüfung, Freigabe.** Die Kette aus Abschnitt 4 des Plans, an der ersten Gattung (5.4a) gebaut und dort gemessen. Zwei Skripte (`find-candidates.ts`, `factsheet.ts`, beide ohne Modell), zwei Agenten-Aufträge (Entwurf und gegnerische Prüfung), ein Pull Request je Woche. **Die Prüfstufe ist der Kern**, nicht die Entwurfsstufe: mehr als zwei unbelegte Sätze, oder ein unbelegter Satz mit einer Zahl darin, und der Entwurf wird verworfen statt repariert.

- [ ] **5.4 Die Seitengattungen**, in dieser Reihenfolge. Schwellen und Datenlage je Gattung im Plan.
  - **(a) Ein Buch durch die Jahrzehnte** `/book/<id>/jahrzehnte` — vollständig aus vorhandenen Daten, ohne Google-Aufruf und ohne Modell. Deshalb die erste: daran lässt sich die Kette bauen, bevor Prosa ins Spiel kommt. Ab 20 Covern über vier Jahrzehnte.
  - **(b) Reihen-Seiten** `/reihe/<slug>` — der stärkste Hebel bei der Suche. Möglich ohne eigenen Index, weil Open Librarys Verlagsfacette trägt (geprüft 2026-09-07: Penguin Classics 2.239 Werke, Folio Society 2.227, Manesse 705). Je Reihe braucht es eine kurze, von Julian bestätigte Liste von Verlagsschreibweisen; „Penguin Clothbound Classics" etwa findet der Katalog nicht, weil es ein Reihen- und kein Verlagsname ist. **Möglicher Ausweg, in 6.6 mitzuprüfen:** die Deutsche Nationalbibliothek führt Reihe und Nummer als eigenes Feld (bei Arno Schmidt Fischer-Taschenbücher 1926), wo Open Library nur den Verlagsnamen hat.
  - **(c) Sprachvergleich** `/book/<id>/sprachen` — ein Cover je Sprache. Vollständig automatisch, ab sechs Sprachen.
  - **(d) „Welche Ausgabe soll ich kaufen?"** `/kaufen/<slug>` — die Frage, für die es die Seite gibt, und die einzige Gattung, die auf Phase 4 einzahlt. **Erst nach Phase 4**, sonst zeigt sie Kauf-Links ohne Provision. Einzige Gattung, die das Google-Kontingent belastet (eine Anfrage je geprüfter ISBN), deshalb mit Wochenobergrenze.
  - **(e) Gleiches Motiv, verschiedene Bücher** — die eine Idee, die sonst niemand hat: dasselbe Public-Domain-Gemälde auf den Covern verschiedener Bücher, gefunden über unsere Signaturen. Braucht einen Signatur-Index über Werke hinweg, den es nicht gibt. **Ganz zuletzt.**

  Bewusst gestrichen: Verlagsporträts und Gestalter-Seiten (keine Daten, also reine Modellprosa) und „Die 10 schönsten Cover von X" (ein erfundenes Ranking ist die reinste Form von Slop). Kuratiert Julian selbst, gern.

- [ ] **5.5 Pinterest, und Bewegtbild von Hand.** Der einzige Kanal, dessen Material vollständig aus den Daten fällt: ein zweites Format 1000×1500 aus derselben Maschinerie, die das OG-Bild erzeugt, ergibt einen Pin je Werk. Pins leben Monate, das passt zum langsamen Aufbau. Vor dem automatischen Hochladen prüfen, ob Pinterests Bedingungen das erlauben. Clips für Instagram und TikTok („30 Cover von Dune in 15 Sekunden") lassen sich mit ffmpeg aus der Coverliste bauen; **erzeugen ja, posten von Hand.** Ein Prototyp des Clips ist als erstes Experiment in [docs/plans/PLAN-struktur.md](docs/plans/PLAN-struktur.md) §4 beschrieben (Storyboard rein und getestet, Render über ffmpeg); sein Platz ist seit 0.11 `lab/video/` (2026-09-08: angelegt ist nur `lab/`, der Clip wartet auf Julians Startzeichen). Die Rechtefrage — Cover in einem Clip auf einer fremden Plattform — ist vor dem ersten Posten zu beantworten und gehört hierher.

- [ ] **5.6 Launch-Momente und Reddit, beides von Hand.** Show HN, Product Hunt, r/InternetIsBeautiful; Book-Blogger und BookTok-Accounts mit einem vorbereiteten Link auf „ihr" Buch. Bei Reddit liegt der Nutzen darin, bei „welche Ausgabe soll ich kaufen?"-Fragen die passende Seite zu verlinken — willkommen ist das nur, wenn ein Mensch es tut. **Kein Kommentar, kein Beitrag, keine E-Mail und keine Antwort an einen Menschen kommt aus einer Maschine.** Das ist keine Frage der Qualität, sondern des Anstands, und es ist die Grenze, an der Plattformen sperren.

- [ ] **5.7 Messen, und Gattungen einstellen.** Nach acht Wochen je Seitengattung Impressionen, Klicks und mittlere Position in der Search Console, dazu Referrer pro Kanal. **Eine Gattung unter 50 Impressionen pro Woche wird eingestellt, nicht verbessert.** Dazu die Ablehnungsquote aus der Freigabe: über ein Drittel abgelehnt heißt, die Schwellen sind zu weich. Und die Frage über allem, die 3.1 ohnehin misst: bringt eine erzeugte Seite jemanden dazu, ein Buch zu öffnen?

## Phase 6 — Qualität, jederzeit dazwischen

Kleine Punkte aus dem Design-Durchgang und dem Durchklick, jeder eine Stunde bis einen halben Tag, ohne Abhängigkeit. Die ersten vier sind Qualität, kein Fehler: die Seite tut, was sie soll, nur nicht gut genug.

- [ ] **6.1 Gleichnamige Ableitungen und Sekundärliteratur nach hinten. [T12]** Die Regel aus Schritt 10 greift nicht, wenn eine Ableitung denselben Titel trägt und einen eigenen Erstautor hat. Gemessen: `alice in wonderland` liefert „Alice in Wonderland in Five Acts“ (eine Ausgabe, Bühnenfassung) vor Carrolls Original mit 3.547 Ausgaben; bei `the great gatsby` sind elf von fünfzehn Karten Bücher über Gatsby, auf Platz 2 eine Penguin-Critical-Study von Stephen Matterson; `klara and the sun` hat auf Platz 2 „Alice's Adventures in Wonderland“. Zehn andere Suchen lagen richtig, das Ranking ist also nicht kaputt, nur blind für diesen Fall.

  Der entscheidende Vergleich liegt im `RankContext` schon vor: gleicher normalisierter Titel, **anderer** Erstautor, ein Bruchteil der Ausgaben des größten Werks im selben Ergebnis. `MARKED_DERIVATIVE` um „in N acts“, „a play“, „an opera“ ergänzen. Vorsicht bei echten Namensgleichheiten (Lars Myttings *Norwegian Wood* ist ein eigenes Buch, kein Ableger von Murakami) — deshalb muss die Ausgabenzahl mit hineinspielen, nicht nur der Titel. Vorher die zehn Suchen aus dem Durchklick als Regressionsschutz festhalten.

- [ ] **6.2 Den Titel zeigen, nach dem gesucht wurde. [T13]** `crime and punishment` zeigt «Преступление и наказание» von „Fiódor Dostoievski“, `die verwandlung` zeigt „Metamorphosis“, `the master and margarita` zeigt «Мастер и Маргарита». Jeweils das richtige Werk, aber in einer Sprache, die der Leser nicht gesucht hat, und bei Dostojewski steht auf Platz 2 ein Übersetzer als Autor. Billigste Lösung ohne Eingriff ins Ranking: die Karte zeigt den Katalogtitel und darunter den Titel der Ausgabe, die zur Suchsprache passt („Metamorphosis · Die Verwandlung“). Die Ausgabentitel liegen auf der Detailseite ohnehin vor; für die Karte wären sie neu und müssten aus der ohnehin geladenen Seite 0 kommen.

- [ ] **6.3 Die Ladeszene endet zu spät, wenn ein Sprachfilter gesetzt ist. [T15]** *1984* mit `lang=de`: über 20 Sekunden Bühne, weil `leadLanguagesSettled` auf die deutsche Gruppe wartet und deutsche Ausgaben bei Open Library erst auf Seite 3 bis 4 liegen; ohne Filter war dieselbe Seite nach 8 Sekunden da. Die Obergrenze greift, aber 20 Sekunden fühlen sich wie ein Hänger an. Kandidaten: die Wand früher zeigen und den gewünschten Reiter nachrücken lassen, sobald er da ist (das war genau das, was 2026-09-07 abgestellt wurde, also nur mit ruhigem Übergang); oder die Grenze von 300 geprüften Ausgaben auf 200 senken; oder während der Wartezeit sagen, worauf gewartet wird.

- [ ] **6.4 Wiederholungen in der Wand kennzeichnen. [T9]** *Wolf Hall* zeigt im englischen Reiter dreimal dasselbe rote Rosen-Cover und zweimal dasselbe weiße ([Bild](docs/tests/2026-09-07-seitenleiste.png)). Das ist die Regel aus Schritt 12 — über Verlagsgrenzen wird oberhalb Distanz 8 nie gefaltet — und sie ist gut begründet. Für den Leser sieht es trotzdem nach einem Fehler aus. Ein Hinweis an der Kachel („anderer Verlag, gleiches Motiv“) wäre ehrlicher als beides: als stilles Falten und als stilles Wiederholen. Kein Eingriff in die Schwellen.

- [ ] **6.5 Kleinigkeiten aus dem Durchklick.** Tippfehler-Toleranz (`gatsbee` liefert null Treffer ohne Vorschlag; ein Abgleich gegen die kuratierten Titel und die letzten Suchen wäre billig). Ein sichtbares Label „about this book“ auf Karten mit Sekundärliteratur, statt sie nur nach hinten zu rechnen. Eine Verlaufskante an der seitlich scrollbaren Reiterzeile auf dem Telefon. Ein Weg von der Telefon-Schublade zurück zur Wand, ohne zu schließen, zu scrollen und neu zu tippen. `priority` auf den ersten Kacheln, die Konsole meldet auf jeder Seite LCP-Warnungen.

- [ ] **6.6 Andere Datenbanken prüfen, bevor wir weiter an der Faltung schrauben.** (Julian, 2026-09-07: „ich denke wir sollten nochmal andere Databases testen, vielleicht lösen sich damit viele probleme".) **Dieser Punkt steht vor 6.7 und 6.4**: wenn eine zweite Quelle die Dubletten an der Wurzel wegnimmt oder die fehlenden Cover liefert, ist jede weitere Schwellenwert-Arbeit verlorene Mühe.

  **Was heute weh tut, und wer es lösen könnte:**

  | Problem | Heutiger Stand | Was eine andere Quelle beitragen könnte |
  |---|---|---|
  | Dubletten desselben Motivs | Mason & Dixon: 12 Kacheln, 6 Motive (6.7) | Eine Quelle mit *einem* kuratierten Bild je ISBN statt mehrerer Scans |
  | Fehlende Cover | Gatsby: 379 von 1.180 Datensätzen tragen ein Bild | Ein zweiter Bilderpool mit anderer Herkunft |
  | Verlagsnamen unbrauchbar für den Vergleich | „Henry Holt" gegen „Holt Paperbacks" (6.7) | Normdaten mit Verlag und Imprint |
  | Google-Kontingent 1.000/Tag | Bindet die ISBN-Nachschau (0.7, 4.5) | Eine Quelle ohne Tageslimit oder mit bezahlbarem |
  | Latenz und Ausfälle von Open Library | 4 von 14 kalten Suchen im Timeout | Eine schnellere Suchquelle |

  **Kandidaten, mit dem, was die Recherche vom 2026-09-07 ergeben hat:**

  - **ISBNdb** — rund 110 Millionen Titel, ein kuratiertes Cover je ISBN aus Verlagsdaten, Bulk-Abfrage von 100 bis 1.000 ISBNs pro Aufruf. Ab 14,99 USD im Monat, gestaffelt bis 299,99. Träfe drei Probleme auf einmal: ein Bild je ISBN statt mehrerer Scans, kein Tageslimit von 1.000, und die Bulk-Abfrage passt zur Wand, die ohnehin ISBN-weise fragt. Der Haken: ISBNdb kennt kein Werk und liefert **weniger** Cover je Buch, nicht mehr — es wäre die bessere Quelle für „welches Bild gehört zu dieser ISBN", nicht für „welche Gesichter hatte dieses Buch".
  - **Hardcover.app** — GraphQL unter `api.hardcover.app/v1/graphql`, Token aus den Kontoeinstellungen, dieselbe Schnittstelle, die deren eigene Apps benutzen. Kennt Werke **und** Ausgaben mit Verlag, ISBN-13, Format und Cover, ist also modellseitig das nächste Verwandte zu dem, was wir bauen. Nur lesend, keine Textsuche-Operatoren. Zu prüfen: Rate-Limit, Lizenz der Bilder und ob kommerzielle Nutzung erlaubt ist (die Doku war am 2026-09-07 nicht abrufbar, HTTP 403).
  - **LibraryThing Covers** — Mitglieder-Cover, per Entwicklerschlüssel unter `covers.librarything.com/devkey/KEY/large/isbn/…`, **1.000 Cover am Tag** und höchstens eines je Sekunde bei automatischem Abruf. Anderer Bilderpool als Open Library, also echter Zugewinn an Motiven; dasselbe Tageslimit wie Google, also keine Entlastung beim Kontingent. Fehlt ein Bild, kommt ein transparentes 1×1-GIF — das muss der Code erkennen, sonst zeigt die Wand leere Kacheln.
  - **K10plus / Deutsche Nationalbibliothek** — SRU unter `sru.k10plus.de/opac-de-627`, rund 80 Millionen Titel aus über 1.000 Bibliotheken; die DNB gibt ihre Titeldaten unter CC0 frei. **Keine Schutzumschläge**, aber die sauberste Quelle für Verlag, Imprint, Auflage und Jahr, die es umsonst gibt — genau die Felder, an denen unsere Faltung heute scheitert. Kandidat für das Problem in Zeile 3, nicht für die Bilder.
  - **Open-Library-Dumps** — monatlich, Editions-Datei 45 GB entpackt, rund 250 GB für einen vollständigen Import; **für Cover gibt es keinen laufenden Dump**. Würde Paging, Latenz und Ratenbegrenzung auf einen Schlag erledigen und Dubletten offline vorrechnen lassen, verlangt aber eine echte Datenbank und damit eine Infrastruktur, die dieses Projekt bisher bewusst nicht hat (E6). Nur interessant, wenn die Seite Traffic hat.
  - **Amazon Product Advertising API** — inhaltlich die beste Antwort auf „welches Bild bekommt der Käufer", aber erst nach drei qualifizierten Verkäufen freigeschaltet (4.2). Bleibt ein Henne-Ei-Problem.

  **Der Testfall, an dem sich eine Quelle beweisen muss: Arno Schmidt, *Aus julianischen Tagen*.** (Julian, 2026-09-07: „es hat ein wunderschönes cover und wir sollten eine seite bauen, die das auch findet.") Fischer Taschenbuch 1979, ISBN 9783596219261, seit rund 45 Jahren vergriffen. Der Umschlag existiert — Julian kennt ihn —, aber **keine der Quellen, die wir heute befragen, hat ihn.**

  Am 2026-09-07 abgefragt:

  | Quelle | Datensatz | Bild |
  |---|---|---|
  | Open Library (Werk und ISBN) | ja, **eine** Ausgabe | Scan der **Impressumsseite**, mitsamt Bibliotheksstempel |
  | Google Books | ja | Scan des **Schmutztitels** |
  | DNB über SRU (ohne Schlüssel, CC0) | ja, vollständig: Reihe „Fischer-Taschenbücher" Nr. 1926, beide ISBNs, 256 Seiten, Ladenpreis DM 7,80 | **keines**, kein 856-Feld |

  **Warum dieser eine Titel mehr aussagt als die acht oben.** Die acht messen Breite bei bekannten Büchern; dieser misst, ob eine Quelle den **langen Schwanz** kennt. Und er trennt die Kandidaten sauber in zwei Lager: Handelsdaten (ISBNdb, VLB, Amazon) führen, was verkauft wird oder wurde — ein Taschenbuch, das seit 1980 nicht mehr lieferbar ist, steht dort vermutlich gar nicht. Wer den Umschlag hat, sind eher **Leser und Sammler** (LibraryThing, wo Mitglieder ihr eigenes Exemplar fotografieren) oder antiquarische Marktplätze, die wir bewusst nicht abfragen (dieselbe Überlegung wie beim Verfügbarkeits-Button, 0.1). **Die naheliegende teure Antwort ISBNdb ist für diesen Fall vermutlich die falsche** — das zu wissen, bevor ein Abo läuft, ist der halbe Zweck der Prüfung.

  **Bestanden heißt:** eine Quelle liefert zu dieser ISBN den echten Umschlag, nicht wieder eine Innenseite. **Nicht bestanden ist auch ein Ergebnis** — dann ist belegt, dass der lange Schwanz mit keiner bezahlbaren Quelle zu holen ist, und die ehrliche Antwort der Seite bleibt, den Scan zu zeigen und ihn ans Ende zu sortieren, statt ihn zu löschen (E16).

  **Nebenbefund, der zu Phase 5 gehört:** die DNB führt die **Reihe samt Nummer** („Fischer-Taschenbücher 1926"), ein Feld, das Open Library nicht hat. Genau das brauchen die Reihen-Seiten aus 5.4b, die heute auf die unsaubere Verlagsfacette angewiesen sind. Wer 6.6 misst, prüft diese Spalte gleich mit.

  **Wie geprüft wird — Messung, nicht Lektüre.** Ein Skript unter `scripts/`, dieselben acht Werke für jede Quelle, damit die Zahlen vergleichbar sind: *The Great Gatsby*, *Nineteen Eighty-Four*, *Beloved*, *Mason & Dixon*, *Wolf Hall*, *Norwegian Wood*, *Die Verwandlung*, *Half of a Yellow Sun* — Klassiker und Neueres, englisch und deutsch, mit und ohne Übersetzungen — **und dazu der Testfall aus dem langen Schwanz oben.** Je Quelle und Werk wird festgehalten:

  1. **Wie viele Cover** kommen zurück, und wie viele **Motive** sind es nach unserer eigenen Hashing-Faltung (`lib/imagehash.ts`)? Das ist die entscheidende Zahl: viele Bilder mit wenigen Motiven ist der heutige Zustand und kein Fortschritt.
  2. **Auflösung** der Bilder, und wie viele davon Scans statt Verlagsbilder sind (`looksLikeScannedPage`).
  3. **ISBN-Abdeckung** und wie viele Ausgaben Verlag *und* Jahr tragen — das entscheidet, ob 6.7 lösbar wird.
  4. **Antwortzeit** im Median und im schlechtesten von zehn Versuchen, plus die Fehlerquote (gegen die 12 s aus F3.3).
  5. **Grenzen und Recht:** Tageslimit, Anfragen je Sekunde, Preis, Lizenz der Bilder, ob kommerzielle Nutzung und Zwischenspeichern erlaubt sind. Ohne diese Zeile ist eine Quelle nicht bewertet, sondern nur ausprobiert.

  **Was dabei herauskommen soll:** je Quelle ein Satz „nimmt uns Problem X ab, kostet Y" — und die Entscheidung, ob eine davon als **dritte** Quelle dazukommt, ob eine Google Books für die ISBN-Nachschau **ersetzt** (das entschärft 0.7 und 4.5), oder ob keine trägt und wir bei zwei Katalogen bleiben. Ein neuer Aufrufer kommt nur mit Zahlen hinein, wie E10 es für Google verlangt.

  **Aufwand:** ein Tag für Skript und Zugänge, ein zweiter für die Messung und die Auswertung. Kosten für den Versuch: der ISBNdb-Tarif für einen Monat, rund 15 USD, plus kostenlose Schlüssel bei Hardcover und LibraryThing.

- [ ] **6.7 Dubletten analysieren und beheben.** (Julian, 2026-09-07: „bei mason & dixon von pynchon waren noch einige dubletten-fehler" und „wenn ich nur nach pynchon gesucht hab, habe ich auch in den mosaiks dubletten gesehen".) Gemessen am selben Tag, und der Befund ist deutlicher als erwartet.

  **Auf der Wand.** *Mason & Dixon* (OL2636672W): 16 Cover roh, 12 nach dem Falten, alle 16 mit Signatur — es fehlten also keine Hashes, die Regeln selbst greifen nicht. Von den **12 gezeigten Kacheln sind 7 dasselbe Motiv**, der bekannte Schutzumschlag in verschiedenen Scans. Die zehn Paare, die stehen bleiben, zeigen drei verschiedene Ursachen:

  | Paar | Distanz | Warum es nicht gefaltet wurde |
  |---|---|---|
  | Henry Holt 1997 gegen Henry Holt 1997, **gleiche ISBN** 9780805037586 | 22 | Die ISBN-Stufe faltet bis 20. Zwei Scans **derselben Ausgabe** stehen nebeneinander |
  | Holt Paperbacks 1998 gegen Henry Holt 1997 | 10 | `samePublisher` vergleicht Wortmengen; {holt, paperbacks} und {henry, holt} ist keine Teilmenge der anderen, also greift die Verlagsstufe nicht — obwohl es dasselbe Haus ist |
  | Vintage 1998 (Sprache unbekannt) gegen Henry Holt 1997 | 11 | Verschiedene Verlage, also nur die Stufe bis 8; die fehlende Sprachangabe hilft auch nicht |

  Der vierte Fall ist **kein** Fehler und muss so bleiben: Rowohlt 1999 gegen Henry Holt 1997 bei Distanz 16 wird über die Sprachgrenze hinweg nie gefaltet, und das ist richtig so.

  **In den Mosaiken.** Suche `pynchon`, sechs Karten mit je vier Kacheln, die Kacheln nachträglich gehasht: bei *Inherent Vice* liegen Kachel 1 und 2 bei Distanz 13, bei *V.* liegen 1 und 4 bei 10 und zwei weitere Paare bei 20. **Zwei von sechs Karten** zeigen also sichtbar dasselbe Motiv zweimal. Das ist die in 1.6 dokumentierte Grenze: der Kurzpfad hasht nicht und kann nur Verlag und Jahr vergleichen.

  **Was zu tun ist, in dieser Reihenfolge:**
  1. **Erst 6.6.** Wenn eine Quelle ein Bild je ISBN liefert, verschwindet der erste Fall von selbst.
  2. **`samePublisher` um Imprint-Familien erweitern:** ein gemeinsames, nicht generisches Wort („Holt") sollte reichen, wenn Jahr und Sprache passen. Vorsicht bei Allerweltswörtern — „Books", „Verlag", „Press", „Editions" dürfen nie allein matchen.
  3. **Die ISBN-Stufe von 20 auf etwa 24 anheben** — aber nur belegt: §9.1 B hat gemessen, dass verschiedene türkische Verlage Layouts bei Distanz 17 bis 22 teilen. Bei **gleicher ISBN** ist dieses Risiko klein, weil es dieselbe Ausgabe ist; die Stufe über verschiedene Verlage hinweg bleibt bei 8. Vor und nach der Änderung dieselben acht Werke messen und die Zahlen hier eintragen.
  4. **Für die Mosaike** entweder Signaturen im Kurzpfad in Kauf nehmen (Kosten messen, es sind bis zu 20 Karten je Trefferliste) oder es bei der Metadaten-Regel belassen und die Grenze wie in 1.6 offen benennen. Nicht raten: erst die Kosten messen, dann entscheiden.

  Verwandt, aber nicht dasselbe: **6.4** kennzeichnet Wiederholungen, die bewusst stehen bleiben. Hier geht es um Wiederholungen, die nicht stehen bleiben sollten.

- [ ] **6.8 Eine „All languages"-Pille am Ende der Sprachreiter.** (Julian, 2026-09-07.) Die Detailseite gruppiert Cover heute nach Sprache und hat keinen Weg, alle zusammen zu sehen; wer die Wand als Ganzes betrachten will, muss sich durch die Reiter klicken. Die Pille steht **am Ende, hinter „Unknown"** — vorne wäre sie die Vorauswahl und würde die Sprachordnung aus F2.4 aushebeln, die genau deshalb existiert, weil die gesuchte Sprache zuerst kommen soll.

  Zu klären beim Bauen: die Sortierung innerhalb der Gesamtansicht (Jahr absteigend über alle Sprachen hinweg, wie in F2.5, ist der naheliegende Weg), ob die Auswahl in die URL gehört (`?lang=all` neben dem bestehenden `?lang=`), und dass die Ladeszene aus F2.4 weiterhin auf die gewünschte Sprache wartet und nicht auf diese Pille.

- [ ] **6.9 Interne Verlinkung: „Mehr von diesem Autor", „Andere Ausgaben dieses Verlags".** *Stand bis 2026-09-07 als 5.3 in der Reichweiten-Phase; hierher verschoben, weil es zuerst der Seite selbst nützt und erst in zweiter Linie der Auffindbarkeit.* Wer eine Cover-Wand ansieht, will oft von dort weiter — zum nächsten Buch desselben Autors, oder zu dem, was derselbe Verlag im selben Jahr gestaltet hat. Heute endet jede Werkseite in einer Sackgasse.

  **Die Abhängigkeit, wegen der es hier und nicht weiter vorn steht:** beide Links brauchen einen Index, den es nicht gibt. Wir laden Daten je Werk und wissen nichts über „alle Werke dieses Autors" oder „alle Ausgaben dieses Verlags". Zwei Wege: Open Librarys Facetten (`author_key:` und `publisher:`, beide geprüft ergiebig — siehe 5.4b) kosten je Seite eine zusätzliche Anfrage, sind aber sofort verfügbar; ein eigener Index über die kuratierten Werke ist schneller und teurer zu bauen; seit E18 ist er als gebaute Datei erlaubt und für 6.10 in Arbeit.

  **Wer den Index baut, baut beides:** die Reihen-Seiten aus 5.4b brauchen genau dieselbe Verlagsabfrage. Deshalb diese beiden Punkte zusammen angehen, egal in welcher Phase sie stehen.

- [ ] Cover-Vergleich: zwei Ausgaben nebeneinander.
- [ ] View Transitions zwischen Karte und Detailseite (das Cover „fliegt“ mit).
- [ ] Sticky-Suchfeld auf dem Telefon.
- [ ] Ladeszene: sanfter Übergang, wenn das Falten Kacheln umsortiert, sobald Signaturen eintreffen.
- [ ] Feinjustierung nach Nutzung: Größe der Kacheln auf der Detailseite, Kontrast der Chips im Dark Mode.
- [ ] Mosaik: gescannte Textseiten erkennen (bei *Dune* zwei von achtzig Bildern), nur wenn es sichtbar stört; die Kurzantwort hasht absichtlich nicht.

---

- [ ] **6.10 „Cover, die so aussehen wie dieses".** (Julian, 2026-09-07: „zeige ähnliche cover, ähnlich wie ‚mehr von diesem Autor', aber für ähnliche Bilder. Vielleicht geht das über einen smart aufgebauten Cache oder eine smarte kleine Datenbank.") Der Instinkt mit der kleinen Datenbank ist richtig, und die Größenordnung ist freundlicher, als sie klingt.

  **Was schon da ist.** Jedes Cover bekommt serverseitig eine Signatur (`lib/imagehash.ts`): 64-Bit-dHash, Kontrast, mittlere Helligkeit. Der Vergleich zweier Cover ist ein XOR und ein Bitzähler — das ist die Faltung auf der Wand, und sie funktioniert.

  *Speichermodell und Größenrechnung dazu: [docs/plans/PLAN-speicher.md](docs/plans/PLAN-speicher.md); 0.9 ist mit E18 entschieden: der Index ist eine gebaute Datei im Repo.*

  **Was fehlt, erstens: ein Gedächtnis.** Signaturen werden heute bei jeder Anfrage neu gerechnet und nirgends aufbewahrt; gecacht sind nur die Bildbytes (30 Tage). „Ähnlich" über Werke hinweg braucht einen Index über viele Cover. Der ist klein: eine Signatur sind 8 Byte, bei 500 kuratierten Werken à 50 Covern etwa 25.000 Einträge, also **wenige hundert Kilobyte**. Ein linearer Durchlauf über 25.000 XOR-Vergleiche dauert Mikrosekunden — es braucht keinen ausgefeilten Index, eine beim Build erzeugte Datei oder ein KV-Eintrag genügt. Das ist deutlich billiger als der Redis-Punkt, den die zurückgestellten Sachen unten führen.

  **Was fehlt, zweitens und wichtiger: ein Ähnlichkeitsmaß, das zu „sieht aus wie" passt.** Der dHash ist ein **Struktur**hash auf **Graustufen** (`decodeToGray` verwirft die Farbe in der ersten Schleife). Er findet dasselbe Bild wieder, und das soll er auch. „Ähnlich aussehend" heißt für einen Leser aber zuerst: ähnliche Farbe, ähnliche Stimmung. Zwei Cover mit gleichem Aufbau, eines rot und eines blau, sind für den dHash **identisch**. Ohne Farbe zeigte die Funktion also etwas anderes, als ihr Name verspricht — genau die Art Behauptung, die N12 verbietet.

  **Vorgehen:**
  1. Die Signatur um Farbe erweitern: mittlere Sättigung und ein grobes Histogramm (etwa 4×4×4 RGB-Eimer, ein paar hundert Byte), berechnet im selben Durchlauf, in dem heute die Graustufen entstehen. Es ist dasselbe Maß, das 1.9 für ein farbenfrohes Cover braucht — einmal bauen, zweimal nutzen.
  2. Index über die kuratierten Werke beim Build erzeugen, als Datei im Repo. Erst wenn das trägt, über einen Speicher zur Laufzeit nachdenken.
  3. Eine Reihe „Covers that look like this" unter dem gewählten Cover, drei bis sechs Kacheln, jede mit Buch und Jahr. Ohne Distanzangabe: die Zahl gehört uns, nicht dem Leser.
  4. Eine Schwelle festlegen und **an echten Beispielen prüfen**, bevor es live geht. Visuelle Ähnlichkeit über fremde Bücher hinweg ist eine Fundgrube für peinliche Treffer; lieber wenige und gute als viele.

  **Warum es sich lohnt:** das ist die Funktion, die es sonst nirgends gibt, und sie füttert Phase 5 direkt — „fünfzig Cover mit einem einzelnen Gesicht darauf" ist eine redaktionelle Seite, die aus demselben Index fällt.

  **Mit E18 beantwortet:** der Index geht über eine feste Liste von Werken und wird vor dem Deploy gebaut. Die Frage dahinter bleibt: ob er über die kuratierten Werke bleibt oder über alles wachsen soll. Über alles hieße, jedes je angesehene Cover zu speichern — das ist eine eigene Datenbank und widerspricht E6, solange kein Traffic da ist.

- [ ] **6.11 Goodreads: was geht, was nicht.** (Julian, 2026-09-07: bessere Anbindung, Editionsdaten, Rezensionen, Bewertungen.) Recherchiert am selben Tag, und die Antwort fällt klarer aus als erhofft.

  **Eine Schnittstelle gibt es nicht mehr.** Goodreads gibt seit dem 8. Dezember 2020 keine neuen Entwicklerschlüssel aus und hat die öffentliche API zurückgezogen. Was es gibt, sind Scraper von Dritten — die aber genau das tun, was die Nutzungsbedingungen untersagen.

  **Die Daten sind nicht frei.** Die Nutzungsbedingungen verbieten ausdrücklich, Inhalte des Dienstes zu kopieren, zu vervielfältigen, öffentlich anzuzeigen, zu verbreiten oder daraus Abgeleitetes herzustellen. Rezensionen gehören zwar ihren Verfassern, sind aber an Goodreads lizenziert und nicht freigegeben; der Weitergabe-Kanal für Dritte ist ein **bezahltes Abonnement** des Rezensions-Feeds, das etwa Google Play und Bibliotheken nutzen. Für uns heißt das: **Editionsdaten, Rezensionstexte und Bewertungszahlen von dort zu übernehmen, ist keine Option** — weder von Hand noch über den Scraper eines Dritten.

  **Der zusätzliche Grund, es nicht zu versuchen:** Goodreads gehört Amazon. Ein Verstoß gegen deren Bedingungen gefährdet dasselbe Konto, an dem 4.2 hängt — Amazon Associates und die Product Advertising API, die das beste Handelsbild liefern würde. Ein paar Bewertungssterne sind das nicht wert.

  **Was erlaubt ist und trotzdem etwas bringt: verlinken.** Ein Link auf die Goodreads-Seite eines Buchs ist gewöhnliche Verlinkung und kein Kopieren. Er passt zu den „Find this exact cover"-Links, die es schon gibt: eine Zeile „Reviews at Goodreads" neben WorldCat und Open Library, gebaut aus der ISBN (`goodreads.com/search?q=<isbn>`), ohne dass ein einziges Datum von dort bei uns landet.

  **Und die Bewertungen, die wir längst haben.** Open Library liefert bei jeder Suche `ratings_count`, `readinglog_count` und `want_to_read_count` mit — wir holen sie heute schon und benutzen sie **nur** fürs Ranking (F1.4), zeigen sie aber nie an. Das ist eine offene, frei nutzbare Quelle, die nichts kostet und keine zusätzliche Anfrage braucht. „8.491 Leser bei Open Library" auf einer Karte wäre dieselbe Information, um die es geht, nur ohne Rechtsproblem.

  **Zu entscheiden, bevor gebaut wird:** SPEC §1 schließt „Bewertungen" ausdrücklich aus dem Produkt aus. Gemeint sind erkennbar **eigene** Bewertungen — Leser, die bei uns Sterne vergeben — und nicht das Anzeigen einer fremden, benannten Zahl. Der Satz ist trotzdem zu schärfen, bevor irgendwo eine Zahl erscheint. Zwei Dinge stehen dabei fest: die Quelle wird genannt, und **im JSON-LD hat eine fremde Bewertung nichts zu suchen** — `aggregateRating` gilt dort als Aussage der Seite über sich selbst, und `bookJsonLd` lässt es aus genau diesem Grund weg (F2.13).

- [ ] **6.12 Signaturen überleben eine Serverinstanz nicht.** (Aus [PLAN-speicher.md](docs/plans/PLAN-speicher.md) §2 und §5, beim Durchgang am 2026-09-08 als eigener Punkt festgehalten.) `lib/coverhash.ts` merkt sich Signaturen in einer Modul-`Map`: sie lebt je Instanz, stirbt mit ihr und hat keine Obergrenze. Das ist die Ursache der in SPEC §7 hingenommenen Beobachtung, dass die Cover-Zahl erst beim zweiten Besuch sinkt — eine kalte Instanz hasht neu, und das 4-Sekunden-Budget reicht dann nicht für alle Bilder. **Der billigste Gewinn braucht keine Datei:** Signaturen in den Next-Datencache statt in die `Map` (`use cache` mit `cacheLife` in Next 16, sonst `unstable_cache`; welche greift, ist bei der Konfiguration ohne `cacheComponents` vorher zu prüfen). Dann sieht der erste Besucher, was heute erst der zweite sieht. Messen: dieselbe Wand kalt vor und nach der Änderung, Cover-Zahl auf Seite 0 und nach allen Seiten. Ein halber Tag. Für die kuratierten Werke erledigt es der gebaute Index aus 6.10 ohnehin; dieser Punkt gilt für alle anderen.

---

## Zurückgestellt, mit Auslöser

Nichts davon wird begonnen, bevor sein Auslöser eintritt.

| Punkt | Auslöser |
|---|---|
| **F1.8 Query-Parsing** in Titel + Autor (E3) | Eine Akzeptanz-Query ist mit reinem Ranking nicht stabil |
| **Alternativtitel desselben Works** (*1984* vs. *Nineteen Eighty-Four*): Google-Ausgaben mit anderem Titel werden dem Work nicht zugeordnet; Lösung wäre eine Alias-Liste aus den Titeln der OL-Ausgaben | Auf Detailseiten fehlen sichtbar Google-Cover |
| **Weitere Cover-Quellen:** ISBNdb, Amazon PA-API, Community-Upload mit Moderation | 4.5, oder die Mehrheit „unknown“ im Verdikt stört |
| **Filter auf der Detailseite:** Format, Jahrzehnt, Verlag | Nutzer fragen danach, oder Werke mit über 300 Covern sind unübersichtlich |
| **Goodreads-CSV-Import** („Meine Bibliothek in allen Covern“) | Keiner bisher |
| **Redis / KV** für geteilten Cache, Hashes und Rate-Limit (E6) | Ein Deploy löscht spürbar den Cache, oder das Rate-Limit muss über Instanzen hinweg gelten |
| **Mehrere ISBN-13 pro Datensatz** („also as ISBN …“) | Betrifft 1 von 300 Datensätzen; keiner |
| **Cover-Wand horizontal auf dem Telefon** (E13) | Julian stößt E13 um; eine Stunde |
