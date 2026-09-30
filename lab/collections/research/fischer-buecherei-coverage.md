# Fischer Bücherei 1952–1970: Bandliste und Abdeckung bei Open Library

Stand 2026-09-28 (ROADMAP 5.10, „Fischer Bücherei als Ganzes"). Liste: [`lists/fischer-buecherei.json`](../lists/fischer-buecherei.json), eine Zeile je Nummer 1–1100, in Nummernfolge. Die Wirth- und die Edelmann-Wand bleiben davon unberührt. Die Gestalter-Recherche liegt nicht hier.

## Ergebnis in Zahlen

| | Anzahl |
|---|---|
| Nummern in der Liste (1–1100) | **1100** |
| Titel ermittelt (DNB, sechs Nummern über K10plus) | **1079** |
| zweite oder dritte Nummer eines Doppel- oder Dreifachbands (z. B. 240/241, 587/588/589) | 20 |
| nicht ermittelt | 1 (Nr. **1057**) |
| Band hat eine passende Ausgabe bei Open Library | **549** von 1079 |
| davon mit brauchbarem Reihencover (angesehen) | **115** (52 im Layout „unten", 63 im Layout „oben") |
| Ausgabe vorhanden, aber ohne Cover | 395 |
| Ausgabe vorhanden, Cover zeigt einen anderen Druck oder eine andere Gestaltung | 28 |
| Ausgabe vorhanden, das Bild ist kein Cover (leerer Einband, Titelseite, falsches Foto) | 6 |
| Ausgabe vorhanden, Cover unsicher, bitte ansehen | 5 (Nr. 18, 140, 322, 457, 738) |
| **keine Ausgabe bei Open Library** | **530** |

Für eine vollständige Wand fehlen also **964 Cover**: 530 Bände brauchen eine neue Ausgabe und ein Cover, 434 brauchen nur ein Cover auf einer vorhandenen Ausgabe. Das sind Titel mit einem `skip` in der Liste; der Text nennt jeweils den Grund. Keiner der Drucke von 1952 bis 1969 hat eine ISBN, deshalb ist `isbn` überall leer und `edition` ist der Schlüssel (wie in `fischer-buecherei-edelmann.json`). Wo ein Reihencover gewählt ist, steht seine Id in `cover`, damit `from-isbns.ts` nicht das erste Bild einer Ausgabe nimmt.

Von den 85 Wirth-Nummern in `for-openlibrary/fischer-buecherei-wirth/` haben 16 schon ein Reihencover bei Open Library (1, 5, 19, 45, 54, 412, 450, 479, 596, 785, 820, 829, 838, 842, 847, 998) und 47 keine Ausgabe. Bei Nr. 1, 5, 19, 45 und 54 zeigt Open Library den Erstdruck mit dem älteren Layout, Keller zeigt Wirths spätere Band-Umschläge. Welcher Druck auf die große Wand kommt, entscheidet Julian. Die zehn Edelmann-Bände sind alle drin, mit denselben Ausgaben wie in der Edelmann-Liste.

## Zwei Layouts, nicht eines

Beim Ansehen der 226 Bilder fiel auf, dass „das Band-Layout" zwei Reihengestaltungen sind:

- **„unten", 1952 bis 1962:** ein Bild über den ganzen Umschlag, darüber oft eine kleine Zeile, und unten ein Farbstreifen mit „FISCHER ✱ BÜCHEREI". Beispiele: Nr. 1, 5, 19, 45, 212, 350. Bis etwa Nr. 465 (1962).
- **„oben", 1962 bis 1969/70:** oben ein Farbband mit „Fischer Bücherei" und dem Fischsignet, darunter ein weißes Feld mit Autor und Titel und ein Strich, darunter das Bild. Das früheste gesehene Beispiel ist Nr. 479 von 1962. Dazu gehören die Edelmann-Bände und die meisten Wirth-Bilder bei Keller. Unterreihen tragen einen zweiten Namen im Band („Bücher des Wissens", „Informationen zur Zeit", „Fischer Handbücher").

Die Grenze liegt zwischen Nr. 465 (unten) und 479 (oben); Nr. 458 und 465 von 1962 zeigen noch „unten". Ältere Nummern bekamen bei Nachdrucken ab 1962 das neue Layout. Nr. 1 gibt es in beiden Layouts: den Erstdruck von 1952 bei Open Library und Wirths spätere Fassung bei Keller. In der Liste steht das Layout des gewählten Covers im Feld `layout`. Ob beide Layouts auf eine Wand gehören, entscheidet Julian. Sieht man nur „oben" als Band-Layout, beginnt die Wand praktisch bei Nr. ~470 (1962); die früheren Nummern hätten dann nur Nachdrucke.

## Wo das Band-Layout endet, und warum Nr. 1100

- **In der DNB** heißt die Reihe bis etwa Nr. 1200 (1971) „Fischer-Bücherei", danach „Fischer-Taschenbücher". Der Fischer Taschenbuch Verlag erschien laut Verlag erst ab der zweiten Hälfte 1971 unter eigenem Namen.
- **An den Umschlägen** endet das Layout früher. Das letzte gesehene Band-Cover eines Erstdrucks ist Nr. 1095 (Trotzki, 1969, Bücher des Wissens). Nr. 1078 (Kafka, 1970) und Nr. 1086 (Capote, Nachdruck 1973 mit dem Kopf „Fischer Taschenbuch Verlag") tragen es noch. Nr. 1088 (Hoyle, 1970) und jeder gesehene Erstdruck ab Nr. 1110 (1970) sind dagegen vollflächige Bild- oder Schriftumschläge ohne Band. Die Erstdrucke von 1970 beginnen um Nr. 1075.
- **Entscheidung:** Die Liste geht bis **Nr. 1100**. Der Übergang fällt in das erste Halbjahr 1970 und verläuft nicht streng nach Nummern: Die Unterreihen behielten das Band länger. **Nr. 1075–1100 sind Grenzbereich.** Wo dort kein Cover gesehen wurde, ist das Layout nicht belegt.
- Die Sonderzählungen von 1970 an (6000er „Bücher des Wissens", 7000er) und die Jules-Verne-Reihe „JV" haben eigene Nummern und sind nicht in der Liste.

## So wurde die Liste gebaut

1. **DNB SRU** (MARC21-xml): `tit=Fischer-Bücherei` (1825 Sätze) und `vlg=Fischer and jhr=<J>` für jedes Jahr 1952–1975 (zusammen 11 658 Sätze). Aus Feld 490/830 die Reihe („Fischer-Bücherei", „Fischer Bücherei", „Fischer-Taschenbücher", bis 1971 auch nur „Fischer") und die Nummer aus `$v` („Bd. 29", „473/474", „1052"). Für jede Nummer gilt der früheste Satz ab 1952: Autor (100, sonst 245 $c), Titel, Jahr und DNB-Id.
2. **Lücken** über K10plus SRU (`pica.all="Fischer-Bücherei <n>"`): 105 Giono *Das Lied der Welt* (1955), 455 und 543 *Das Atelier* 1 und 2 (Wagenbach, 1962/63), 461 Leonhard *Sowjetideologie heute II* (1962), 525 Ott *Die Männer und die Seejungfrau* (1963), 848 *Neue Sammlung alter Complimente* (1967), 974 *Gablers Wirtschafts-Lexikon* (1969). 474, 588 und 589 sind Teil von 473/474 (*Blechtrommel*) und 587/588/589 (*Doktor Schiwago*). **Nr. 1057** fand keine der beiden Quellen.
3. **Doppelnummern:** 20 Bände tragen zwei oder drei Nummern, z. B. 240/241, 408/409, 428/429, 583/584 und 585/586 (Bullock, *Hitler*), 661/662, 696/697. Die zweite Nummer steht mit `skip` „Doppelband" in der Liste. **Zweimal vergebene Nummern:** 113–120 tragen 1968 in der DNB ein „[a]" (Thomas Mann, Moderne Klassiker). Das ist eine eigene Zählung und nicht in der Liste; die Liste folgt der Belegung von 1956. Mehrbändige Werke haben eigene Nummern je Band (z. B. 1050/1051 Störig, 1052/1053 Höhne, 876–878 Hegel).
4. **Sieben Bände**, deren frühester DNB-Satz zwei oder mehr Jahre nach ihren Nachbarn liegt (301, 415, 459, 956, 988, 995, 1070): Hier fehlt der DNB wohl der Erstdruck, und `year` ist ein späterer Druck.
5. **Open Library:** `search.json` mit `publisher:fischer AND publish_year:[1950 TO 1975]` (5059 Werke), dazu je Band zwei Suchen: Titelwörter und Nachname, einmal mit und einmal ohne `publisher:fischer`. Von jedem passenden Werk wurden alle Ausgaben gelesen (`/works/<id>/editions.json`). Als Fischer-Bücherei-Druck zählt eine Ausgabe, wenn `series` die Nummer nennt oder Verlag bzw. Reihe „Bücherei" enthält, oder wenn der Verlag nur „Fischer" heißt und das Jahr passt. Eine Ausgabe, die an mehreren Bänden hing, wurde nach der Nummer in `series` zugeordnet, sonst nach dem Jahr.
6. **Cover:** alle 226 Bilder dieser Ausgaben (215 verschiedene) in Größe M heruntergeladen, auf sechs Kontaktbögen gelegt und jedes einzeln angesehen: Reihencover unten oder oben, anderer Druck oder andere Gestaltung, kein Cover, unsicher.

Rund 5000 Anfragen an Open Library, dazu etwa 150 an die DNB und 30 an K10plus. Google Books wurde nicht gefragt, bei Open Library wurde nichts angelegt oder geändert. Skripte, Zwischenstände und Bilder liegen im Scratchpad der Sitzung und sind nicht im Repository.

## Auffälliges bei Open Library (für einen Bibliothekar oder zum Aufräumen)

- **Falsche Bilder:** OL47773898M (Broch, *Esch*, Nr. 57) hat als zweites Bild den rororo-Umschlag von Elaine Dundy, *Ein Abend zu zweit*. OL27668351M (Nr. 158, 1957) zeigt einen UTB-Band *Wilhelm von Humboldt* (Haupt). OL5647171M (Nr. 850) zeigt ein Foto eines Mädchens mit Luftballons. OL28403541M (Hegel-Studienausgabe 876–878) zeigt nur Band 3.
- **Falsches Jahr:** OL16924762M (Kafka, *Das Urteil*, Nr. 19) ist auf 1952 datiert, trägt aber das Layout „oben" von 1962 oder später.
- **Mehrbändige Werke als eine Ausgabe:** *Zeichen der Zeit* (243/276/347/441; OL24988190M nennt in `series` Nr. 243, zeigt aber Band 4 — in der Liste deshalb bei Nr. 441), Hegel 876–878, Nietzsche 927–930 (OL5507506M), *Mythen der Völker* 789/799/805 (OL13549695M, OL17109237M), *Historisches Lesebuch* 776/834/852 (OL5673125M), *Interpretationen* 695/699/716/721, *Deutschland erzählt* (500/711/738). Für eine Wand braucht jeder Band seine eigene Ausgabe.
- **Doppelte Ausgaben desselben Drucks:** Nr. 2 *Königliche Hoheit* 1952 fünfmal (OL13550011M, OL18194880M, OL16077026M, OL13818434M, OL13770326M), Nr. 19 1952 dreimal (OL16924762M, OL16201838M, OL58794275M), Nr. 211 (OL14829723M, OL45645586M), Nr. 650 (OL24927941M, OL24870014M), Nr. 830 dreimal 1967–69 (OL5647250M, OL18432759M, OL23720232M, vielleicht drei Drucke), Nr. 4 zweimal und Nr. 9 dreimal 1952. Viele davon sind alte MARC-Importe mit zerlegten Umlauten („Bu cherei", „Ko nigliche").

## Offen

- Nr. 1057 bestimmen (Katalog eines Antiquariats oder ein Exemplar).
- Grenzbereich 1075–1100 ansehen, wenn Bilder da sind: Welche Erstdrucke von 1970 tragen noch das Band?
- Julian entscheidet: beide Layouts oder nur „oben"; welcher Druck je Nummer (Erstdruck oder Band-Nachdruck); fünf unsichere Cover.
- 964 Cover beschaffen und hochladen (530 davon mit neuer Ausgabe). Die Wirth-Arbeit deckt davon bis zu 69 ab.
