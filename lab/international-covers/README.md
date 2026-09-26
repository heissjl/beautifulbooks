# lab/international-covers — eine Reihe mit Umschlägen aus anderen Sprachen

Julian, 2026-09-26: „start also a draft for the books of the sf relaunch series but with international covers. try all russian covers first", dann am selben Tag: „ok instead of russian, let's just aim for international covers of the works within the relaunch series".

```bash
npx tsx lab/international-covers/international.ts   # schreibt lab/collections/lists/sf-relaunch-international.json
npx tsx lab/international-covers/translated-titles.ts  # übersetzte Titel aus Wikipedia/Wikidata → translations.json
npx tsx lab/international-covers/international.ts      # noch einmal, mit den neuen Einträgen
npx tsx lab/collections/from-candidates.ts lab/collections/lists/sf-relaunch-international.json \
  sf-masterworks-relaunch-international "SF Masterworks, the relaunch — international covers" openlibrary \
  --titles-from=sf-masterworks-relaunch
npx tsx lab/isfdb/credit-collections.ts sf-masterworks-relaunch-international
```

(`russian.ts` ist der erste Versuch, nur Russisch; seine Liste `lists/sf-relaunch-russian.json` bleibt stehen.)

## Die Frage

Wie viele Werke einer Reihe (hier die SF-Masterworks-Neuauflage) haben bei Open Library eine nicht-englische Ausgabe mit Umschlagbild — genug für eine eigene, bunte Wand?

## Wie es funktioniert

- Je Werk alle Seiten von `/works/<id>/editions.json` (`ol.ts`). Kandidat ist jedes Cover einer nicht-englischen Ausgabe, mit Beleg (`via`) je Kandidat (`foreignCandidates` in `pick.ts`, getestet):
  - `tag`: die Ausgabe trägt eine Sprache und nicht Englisch; zweisprachig mit Englisch nicht (meist englischer Umschlag), `und`/`mul`/`zxx` auch nicht.
  - `isbn-group`, dann `publisher`: nur für Ausgaben **ohne** Sprachfeld — die ISBN-Registrierungsgruppe (978-2 fr, 978-3 de, 978-84 es …; 0/1/979-8 und gemischte Gruppen zählen nicht) oder ein Verlag, der praktisch nur in einer Sprache druckt (Heyne, Denoël, Minotauro, Urania, Hayakawa, АСТ …), `evidence.ts`.
  - `separate-work`: für ein Werk ohne Kandidaten die anderen Werk-Datensätze derselben Autorin (`search.json?q=author_key:…`, höchstens 60 fremdsprachige je Autorin). Ein Datensatz nur in anderen Sprachen ist eine nicht zusammengeführte Übersetzung; übernommen, wenn sein Titel der des Buchs ist oder eine Ausgabe `translation_of` ihn nennt, oder wenn `translations.json` ihn nennt — **von Hand**, nach bekanntem übersetztem Titel („Der brennende Mann" = The Stars My Destination), Kandidat dann `byHand`. Englisch getaggte Ausgaben in so einem Datensatz zählen nicht. Alles Übrige steht in `unmatched.json` zum Nachsehen.
- Ein Cover je Werk, die Wand in Reihenfolge entlang: gibt es eine getaggte Ausgabe, wird eine solche genommen (die weiteren Belege füllen nur Lücken, die schon angesehenen Cover bleiben); darunter die Sprache, die bisher am seltensten gewählt ist, dann die jüngste Ausgabe (`chooseVaried`). Cover in `rejected.json` (angesehen und verworfen, mit Grund) werden nie gewählt. Alle Kandidaten stehen mit Sprache, Ausgabe, Datum und ISBN in der Liste; die ISBN der gewählten Ausgabe wird im Entwurf `coverIsbn`, für die ISFDB-Künstlersuche (6.52).
- Nur Open Library (lab-Regel 6), eine Anfrage nach der anderen, 0,7 s Pause, 40 s Timeout, drei Versuche; Antworten in `cache.json` (git-ignoriert). Eine gescheiterte Anfrage wird `failed`, am Ende noch einmal versucht, und nie als „kein Cover" gezählt.
- `data/collections.json` wird hier nur gelesen. Den Entwurf schreibt `lab/collections/from-candidates.ts`: Reihe ohne Verlagsgrenze (`publishers: []`, die Umschläge sind Übersetzungen anderer Verlage), `coverSource: 'catalogue'`, `published: false`, `from` = `openlibrary:<sprache>:<ausgabe>`. Liest die Datei unmittelbar vor dem Schreiben und ersetzt nur den einen Slug.

## Messung 2026-09-26

**Russisch allein:** 10 von 150 (damals so viele Werke in der Reihe), 140 ohne, 0 gescheitert; die Suche mit `language=rus` brachte nichts dazu. Alle zehn angesehen, alle echt.

**Alle Sprachen außer Englisch:** die Reihe hatte inzwischen **182** Werke (eine andere Sitzung ergänzt sie). **79 mit internationalem Cover, 103 ohne, 0 gescheitert.** 73 der 79 gewählten Ausgaben haben eine ISBN.

- Gewählt je Sprache: fre 18, ger 16, spa 12, rus 5, por 5, ita 4, pol 4, dut 4, tur 3, cat 3, jpn 2, chi 1, heb 1, ind 1 (14 Sprachen).
- Werke mit mindestens einem Kandidaten je Sprache: fre 54, ger 43, spa 39, por 20, ita 19, pol 11, rus 10, dut 7, tur 6, cat 5, heb 3, jpn 3, chi 3, gre 2, je 1: hrv, ind, ukr, dan, lit, srp, rum, swe.
- 32 gewählte Cover über alle Sprachen angesehen: alle sind Umschläge einer Übersetzung des richtigen Buchs, keine falsch getaggte englische Ausgabe. Zweifel:
  - *Frankenstein* (65, dut, ol:15165840): „verteld door Maria Postema" — vermutlich eine Nacherzählung, nicht Shelleys Text.
  - *Swastika Night* (121, fre, ol:13482981): der Titel steht englisch auf dem Umschlag; ob die Ausgabe französisch ist, nicht geprüft.
  - *Where Late the Sweet Birds Sang* (59, ger, ol:7268608): Umschlag deutsch (Heyne, „Hier sangen früher Vögel"), aber die ISBN 4453307909 ist ein Tippfehler im Datensatz (japanischer Bereich; gemeint wohl 3453307909) — nicht für ISFDB verwenden.
  - *Flowers for Algernon* (67, jpn, ol:8434998): Bibliotheksexemplar mit Aufkleber.
  - *The Time Machine* (131, rus): Sammelband mit Krieg der Welten auf dem Umschlag (schon beim Russisch-Lauf bemerkt).
- Werke, die erst nach dem Lauf in die Reihe kommen, fehlen; ein zweiter Lauf fragt nur sie (Cache).

**Erweitert (Julian: „you can't find an international cover for each book? seems unlikely"):** **121 von 182 mit internationalem Cover, 61 ohne, 0 gescheitert.**

- Gewählt je Beleg: tag 79, separate-work 33 (davon 26 über `translations.json` von Hand, 7 über Titel oder `translation_of`), isbn-group 8, publisher 1.
- Gewählt je Sprache: fre 28, ger 25, spa 22, rus 10, por 6, ita 6, pol 5, dut 5, tur 5, cat 3, chi 2, jpn 2, heb 1, ind 1. 113 der 121 gewählten Ausgaben haben eine ISBN.
- Alle 42 neuen Cover (nicht `tag`) angesehen. Zwei verworfen (`rejected.json`): *The Gate to Women's Country* war ein englisches Hörbuch-Cover in einem französisch getaggten Werk (ersetzt durch J'ai lu „Un monde de femmes"), *The Food of the Gods* ein englischer Text aus türkischem Verlag (Karbon; ersetzt durch „Tanrıların Tohumu"). Teilbände statt Sammelband, bewusst genommen: *Helliconia* (nl. „Helliconia Zomer"), *Norstrilia* („Le sous-peuple"), *Shadow* (poln. „Pazur Łagodziciela"), *Second Chronicles of Amber* (russ. „Рыцарь теней / Принц Хаоса"), *The Complete Roderick* (dt. „Roderick"), *Dangerous Visions* (frz. Band 2). Zweifel: *Best of Greg Egan* (chin., Band 3 einer Sammlung — ob dieselbe Auswahl, offen).
- Entwurf geschrieben (121 Werke), ISFDB-Künstler danach: 49 genannt, 3 mehrere, 61 ohne Namen, 8 Druck nicht gefunden, 0 gescheitert.
- Noch ohne: 61 Werke, meist Sammelbände, „Best of"-Bände und spätere britische Titel ohne Übersetzung im Katalog. `unmatched.json` hält 213 fremdsprachige Werk-Datensätze dieser Autorinnen, die keinem Buch sicher zugeordnet sind. `Body Snatchers` hängt bei Open Library an einem falschen ersten Autor („George Finney"), die Autorensuche findet deshalb nichts.

## Gezielte Suche über übersetzte Titel, 2026-09-26

Julian sagte ja zu „a targeted lookup". `translated-titles.ts` nimmt für jedes Werk ohne Cover den englischen Wikipedia-Artikel (nur eine Seite, die die Autorin in der Einleitung nennt und nicht ihr eigener Artikel ist — „Floating Worlds" leitet auf Cecelia Holland um), dessen Sprachlinks und die Wikidata-Bezeichnungen; ohne Artikel ein Wikidata-Eintrag, dessen Beschreibung die Autorin nennt. Jeder fremdsprachige Titel wird bei Open Library gesucht (`title=` + Nachname, dann `q=`), genommen nur bei passendem Nachnamen und gleichem Titel (`sameTitle`), und nur Ausgaben, die nicht englisch getaggt sind und keine englische ISBN tragen. Treffer stehen in `translations.json` mit `via: wikipedia-langlink | wikidata` und Sprache; was je Buch gesucht wurde, in `translated-titles.json`. Eigenes Wissen ist dabei nur Hinweis, nie Beleg.

**Ergebnis: 135 von 182 (vorher 121), 47 ohne, 0 gescheitert.** 14 neue Cover, alle angesehen: *The Rediscovery of Man* (frz. „Tu seras un autre", Bd. 1 der Gesamtausgabe), *Body Snatchers* (ital. „L'invasione degli ultracorpi"), *Doomsday Book* (frz. „Le Grand Livre", Sammelband mit „Sans parler du chien"), *The Sea and Summer* (kat. „Les torres de l'oblit"), *The Deep* (frz. „L'Abîme"), *No Enemy But Time* (span.), *Random Acts of Senseless Violence* (frz. „Journal de nuit"), *The Godwhale* (frz. „Le Dieu Baleine"), *Mockingbird* (frz. „L'oiseau d'Amérique"), *Life During Wartime* (dt. „Das Leben im Krieg"), *Fairyland* (frz. „Féerie"), *The Embedding* (span. „Empotrados"), *Native Tongue* (span. „Lengua materna"), *The Chronicles of Amber* (poln. „Kroniki Amberu", Bd. 2). Verworfen (`rejected.json`), alle bei *The Rediscovery of Man*: „La quête des trois mondes" (enthält Quest of the Three Worlds, nicht diese Erzählungen), „Le sous-peuple" (Norstrilia) und zwei Bilder, die keine Umschläge sind — eines ist Marilynne Robinsons *Gilead* auf einem französischen Datensatz.

- Gewählt je Beleg: tag 79, separate-work 47 (26 von Hand, 14 über Wikipedia/Wikidata, 7 über Titel oder `translation_of`), isbn-group 8, publisher 1. Je Sprache: fre 34, ger 27, spa 25, rus 10, pol 7, por 6, ita 6, dut 5, tur 5, cat 4, chi 2, jpn 2, heb 1, ind 1.
- Weil die Wahl die Wand in Reihenfolge entlanggeht, haben zwei frühere Werke eine andere getaggte Ausgabe bekommen (*Hyperion* poln., *Ringworld* dt. „Ringwelt"); beide angesehen, richtig.
- Entwurf neu geschrieben (Titel aus der Relaunch-Wand, „Odd John" bleibt), ISFDB danach: 55 genannt, 4 mehrere, 68 ohne Namen, 8 Druck nicht gefunden, 0 gescheitert.
- Die 213 Einträge in `unmatched.json` sind fast alle andere Bücher und Anthologien; nicht darauf bauen.

Je Buch, das noch ohne ist:

- 25 Arslan (SF Masterworks): kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 38 Of Men and Monsters: übersetzt, nicht bei Open Library — gesucht: fre „Des hommes et des monstres", ita „Gli uomini nei muri", ukr „Про людей і чудовиськ", rus „Обитатели стен"
- 44 The Affirmation: übersetzt, nicht bei Open Library — gesucht: fre „La Fontaine pétrifiante", ukr „Підтвердження", rus „Лотерея"
- 49 Floating Worlds: keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 50 Blood Music: übersetzt, nicht bei Open Library — gesucht: bul „Кървава музика", spa „Música en la sangre", fre „La Musique du sang", hun „A vér zenéje", ita „La musica del sangue", jpn „ブラッド・ミュージック", chi „血音乐", rus „Музыка, звучащая в крови"
- 55 Odd John: übersetzt, nicht bei Open Library — gesucht: fre „Rien qu'un surhomme", ukr „Дивний Джон", spa „Juan Raro", kor „이상한 존"
- 63 Sarah Canary: keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 64 The Continuous Katherine Mortenhoe (SF Masterworks): übersetzt, nicht bei Open Library — gesucht: ukr „Тривала Кетрін Мортенгоу", dut „The Unsleeping Eye", fre „L'Incurable"
- 68 The Caltraps of Time (S.F. Masterworks): kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 69 Unquenchable fire: keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 70 Engine Summer: übersetzt, nicht bei Open Library — gesucht: fre „L'Été-machine"
- 78 This Is the Way the World Ends (S.F. Masterworks): übersetzt, nicht bei Open Library — gesucht: fre „Ainsi finit le monde", pol „Tak oto kończy się świat"
- 81 Time Is the Fire: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 88 Transfigurations (S.F. Masterworks): keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 91 Half Past Human: übersetzt, nicht bei Open Library — gesucht: ger „Die Ameisenkultur", ukr „Наполовину надлюдина", ukr „Напівлюдина"
- 95 Shrinking Man: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 97 Her Smoke Rose Up Forever: übersetzt, nicht bei Open Library — gesucht: kor „그녀의 연기는 언제까지나 올라갔다", cze „Žena, kterou muži neviděli"
- 100 The Child Garden: übersetzt, nicht bei Open Library — gesucht: pol „Dziecięcy ogród", spa „El jardín de infancia", ukr „Дитсадок", rus „Детский сад"
- 101 Mission Of Gravity: Mesklinite Book 1 (S.F. Masterworks): übersetzt, nicht bei Open Library — gesucht: fre „Question de poids", ita „Stella doppia 61 Cygni", rus „Экспедиция «Тяготение»", ukr „Експедиція «Тяжіння»", chi „重力使命", spa „Misión de gravedad", kor „중력의 임무", jpn „重力の使命"
- 109 Dark Benediction: übersetzt, nicht bei Open Library — gesucht: ita „Benedizione oscura", rus „Тёмное благословение"
- 118 Fairyland (S.F. Masterworks): **fre**, ol:3110137
- 122 China Mountain Zhang: übersetzt, nicht bei Open Library — gesucht: ukr „Китайська гора Чжан", spa „China montaña Zhang", ukr „Китайська гора Джан"
- 124 Sword & citadel: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 130 The Shape of Things to Come: übersetzt, nicht bei Open Library — gesucht: ukr „Форма прийдешнього", cze „Podoba toho, co přijde", epo „La formo de estontaĵoj", rum „Înfățișarea viitorului", chi „未来互联网纾", jpn „世界はこうなる"
- 135 Raising the stones: keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 136 The embedding: **spa**, ol:8666867
- 138 Land Under England: keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 139 Raft: übersetzt, nicht bei Open Library — gesucht: fre „Gravité", jpn „天の筏", pol „Tratwa", ukr „Пліт"
- 140 Dreaming In Smoke (Gateway Essentials,S.F. MASTERWORKS): keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 142 The Best of R. A. Lafferty: keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 143 Light: übersetzt, nicht bei Open Library — gesucht: fin „Valo", ita „Luce dell'universo", jpn „光", pol „Światło", rus „Свет"
- 151 Bold As Love: übersetzt, nicht bei Open Library — gesucht: ukr „Зухвалий немов кохання"
- 152 Desolation Road: übersetzt, nicht bei Open Library — gesucht: pol „Droga bez znaczenia", spa „Camino Desolación", jpn „火星夜想曲", rus „Дорога запустения"
- 153 Castles Made of Sand: keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 157 Needle in a timestack: übersetzt, nicht bei Open Library — gesucht: ukr „Голка в копиці часу", chi „時光的指針", rus „Иголка в стогу времени", hun „Időtlen szerelem", rum „Amintirile și timpul", por „Agulha no Palheiro Temporal"
- 159 Kairos: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 161 Life: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 164 Growing up Weightless: keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 165 Secret of Life: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 169 The Best of Roger Zelazny: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 170 Hiero's Journey: übersetzt, nicht bei Open Library — gesucht: ukr „Подорож Єро", rus „Путешествие Иеро"
- 171 First Born: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 172 The Unforsaken Hiero: keine Übersetzung bekannt (Artikel/Wikidata ohne fremdsprachigen Titel)
- 173 Barefoot in the Head: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 175 Beginning Operations: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 177 Distraction: übersetzt, nicht bei Open Library — gesucht: ita „Caos USA", spa „Distracción", rus „Распад", ukr „Розпад"
- 178 Nova Swing: übersetzt, nicht bei Open Library — gesucht: rus „Нова Свинг"
- 179 Thirteen: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin
- 181 Alien Emergencies: kein Wikipedia-Artikel und kein Wikidata-Eintrag mit Autorin

Zwei Werke hängen bei Open Library am falschen Autor (*Shrinking Man* an „Ted Adams", *Body Snatchers* an „George Finney"); *Body Snatchers* fand sein Cover trotzdem über den italienischen Titel.
