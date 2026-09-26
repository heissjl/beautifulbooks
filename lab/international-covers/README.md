# lab/international-covers — eine Reihe mit Umschlägen aus anderen Sprachen

Julian, 2026-09-26: „start also a draft for the books of the sf relaunch series but with international covers. try all russian covers first", dann am selben Tag: „ok instead of russian, let's just aim for international covers of the works within the relaunch series".

```bash
npx tsx lab/international-covers/international.ts   # schreibt lab/collections/lists/sf-relaunch-international.json
npx tsx lab/collections/from-candidates.ts lab/collections/lists/sf-relaunch-international.json \
  sf-masterworks-relaunch-international "SF Masterworks, the relaunch — international covers" openlibrary
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
