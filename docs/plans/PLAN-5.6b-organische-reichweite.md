# Plan für 5.6b: organische Reichweite, mit einem Kalender zum Eingreifen

**Stand 2026-10-04: Strategie geschrieben, Kalender und Werkzeug gebaut** (`lab/kalender/`, 70 Einträge über neun Wochen, nichts davon gepostet; das Galerie-Format aus §4a kam am selben Tag dazu). Geschrieben auf Julians Bitte („starte von PLAN-5.5-5.6-kanaele.md und erstelle eine strategie für organische reichweite“), mit drei Wünschen von ihm:

1. ein Posting-Kalender für alle Kanäle, die wir haben werden, mit Vorschlägen, was er wann postet, und der Möglichkeit, zu kuratieren oder einzugreifen;
2. auf jedem Kanal ein Exposé-Post, der die Seite erklärt und früh oder als Erstes kommt;
3. ein Anfang mit ein paar der schönen Sammlungen.

Grundlage ist [PLAN-5.5-5.6-kanaele.md](PLAN-5.5-5.6-kanaele.md) (Kanäle, Messung 5.6a, Reihenfolge, Abbruchschwellen, Pinterest-Anleitung). **Dieser Plan wiederholt das nicht, er macht daraus einen Wochenplan.** Am 2026-10-04 liegt PLAN-5.5-5.6 samt 5.6a nur auf dem Branch `claude/gallant-davinci-qgndje`; die Links hierher gehen, sobald er in `main` ist.

**Die Grenze aus 5.6 gilt unverändert:** Claude schlägt Texte vor und baut Links. Jeder Post, jede Antwort und jede Nachricht geht von Julian von Hand hinaus. Das Werkzeug spricht mit keiner Plattform.

---

## 1. Die Strategie in fünf Sätzen

1. **Sammlungen sind das Gesicht der Seite nach außen.** Eine Sammlung ist ein Bild mit vielen Covern und einem Thema. Ihre Seite fragt Google nicht und ist vorgerendert, also kostet ein Ansturm dort nichts. Und sie ist das, was es sonst nirgends gibt: die SF Masterworks in Nummernfolge, die edition suhrkamp als Spektrum, mit den Covern, die zu einer Ausgabe führen.
2. **Auf jedem Kanal kommt zuerst ein Exposé**, angepinnt, das in zwei Sätzen sagt, was die Seite tut und was nicht. Jeder spätere Post kann darauf verweisen, und wer das Profil öffnet, versteht es sofort.
3. **Link-Kanäle zuerst, Bild-Kanäle nach der Rechte-Entscheidung.** Bluesky, Reddit, HN und Mail zeigen die Vorschaukarte, die die Plattform selbst von der Seite holt; Instagram, Pinterest und TikTok laden Cover hoch. Bis Julian Frage 1 aus PLAN-5.5-5.6 §6 beantwortet, gilt Weg (c), und der Kalender hält die Bild-Posts zurück (Voraussetzung `rechte`). Das Instagram-Exposé ist so gebaut, dass es keine Cover zeigt und deshalb trotzdem starten kann.
4. **Regelmäßig statt in Wellen, und nur so viel, wie ein Abend die Woche trägt.** Bluesky dreimal, Instagram zweimal, Pinterest fünf Pins als ein Stapel, TikTok einmal, Reddit höchstens drei Antworten. HN, r/InternetIsBeautiful und Product Hunt je einmal, mit mindestens einer Woche Abstand.
5. **Jeder Link trägt seinen Kanal (`?via=`), und nach acht Wochen entscheidet die Zahl.** Gezählt wird mit K14 aus 5.6a; was nach den Schwellen in PLAN-5.5-5.6 §5 nicht trägt, wird eingestellt, nicht verbessert.

## 2. Die Kanäle

| Kanal | Rolle | Rhythmus | Format | Wartet auf |
|---|---|---|---|---|
| **Bluesky** | Hauptkanal für Links; Buch-, Design- und SF-Leute sind dort | Mo, Mi, Fr | Text bis 300 Zeichen mit Link, Vorschaukarte kommt von selbst | Konto, 5.6a |
| **Instagram** | Bilder der Sammlungen, Karussells mit Künstlernennung | Di, Fr 18 Uhr | Karussell, Link nur im Profil | Konto; Cover-Posts zusätzlich `rechte` |
| **Pinterest** | Suchmaschine für Bilder: Jahrzehnte und Sammlungen | 5 Pins/Woche, an einem Abend angelegt, über die Woche verteilt | Pin 1000×1500 | `rechte`, 5.5a, Konto mit bestätigter Website |
| **TikTok** | Clips „ein Buch durch die Jahrzehnte“ | 1/Woche, sobald Clips da sind | Clip aus `lab/video` | `rechte`, ffmpeg, Konto |
| **Reddit** | Antworten, wo jemand nach einer Ausgabe fragt; ein Launch in r/InternetIsBeautiful | höchstens 3 Antworten/Woche; Launch einmal | Text, Link auf das passende Cover | 5.6a; Launch zusätzlich Kapazität |
| **Hacker News** | Ein Show HN | einmal | Titel bis 80 Zeichen, Text | 5.6a, Kapazität |
| **Product Hunt** | optional, zuletzt | einmal | Galerie aus Bildschirmfotos der Seite | HN und Reddit ausgewertet |
| **Mail / Blogs** | fünf Personen, deren Bücher in den Sammlungen stehen | einmal, dann je nach Antwort | Julians eigener Text, Claudes Linkliste | 5.6a |

**Bluesky-Handle:** die Domain selbst, `@buyitscovers.com`. Das kostet einen TXT-Eintrag bei INWX und ist der einzige Profilname, den niemand nachmachen kann. **Mastodon und Threads** stehen nicht in der Liste, weil 5.6a sie nicht als Klasse kennt; soll einer dazu, braucht `VIA` einen Eintrag (Analyse-Regel 6 in CLAUDE.md, Julian gibt den Satz frei).

## 3. Das Exposé

Ein Gedanke, je Kanal neu gesagt (Julians Regel vom 2026-10-02 für Übersetzungen gilt auch hier: der Satz tut seine Arbeit, er wiederholt keine Wörter):

> **Judge a book, buy its covers.** Type a title and see the covers it has been printed with, by language and year. Then find the edition you'd want on your shelf. From two open catalogues, Open Library and Google Books.

Was in jedem Exposé steht: was man tut (Titel eingeben), was man sieht (die Cover, nach Sprache und Jahr), was man davon hat (die Ausgabe finden), woher es kommt (zwei offene Kataloge). Was nie darin steht: „alle“, „jede“, „vollständig“, „die schönsten“. Das Werkzeug markiert diese Wörter.

| Kanal | Datum im Kalender | Form |
|---|---|---|
| Bluesky | Mo 12.10. | Text, Startseite als Karte, angepinnt |
| Instagram | Di 13.10. | Karussell aus fünf Schrift-Folien **ohne Cover**, angepinnt; braucht deshalb keine Rechte-Entscheidung |
| Pinterest | Sa 17.10. | Pin der Startseite, wartet auf `rechte` und 5.5a |
| Hacker News | Di 20.10., 15:30 | Show HN; der erste Satz ist ein Platzhalter für Julians eigenen Grund |
| TikTok | Do 29.10. | Clip „Dune durch die Jahrzehnte“ |
| Reddit | Di 3.11., 15:00 | r/InternetIsBeautiful, zwei Wochen nach HN |
| Product Hunt | Di 1.12. | optional |

Die Texte stehen vollständig in `lab/kalender/posts.json` und sind im Werkzeug zu ändern.

## 4. Die Sammlungen, in dieser Reihenfolge

**In `data/collections.json` veröffentlicht.** Online sind es mehr: 46 von 56, weil Julian Entwürfe über /curate ohne Deploy freischaltet (5.10g). Gelesen wurde das am 2026-10-04 mit einer Anfrage an `buyitscovers.com/collections`; die Datei allein führt hier in die Irre (Julian: „ich glaub du bist hier nicht auf dem neuesten stand“). Die Reihenfolge der ersten Wochen:

| Woche | Sammlung | Warum zuerst |
|---|---|---|
| 1 | **SF Masterworks** (73, Nummernfolge) | Die stärkste Wand: eine Reihe, ein Look, Künstler aus ISFDB genannt (Chris Moore, Jim Thiesen, John Harris, Fred Gambino) |
| 1 | **edition suhrkamp** (198) | Das Spektrum als Bild; das deutsche Publikum; gern zusätzlich auf Deutsch posten |
| 2 | **Feminist Press** (76) | Ein Verlag mit Haltung, andere Leserschaft als die SF |
| 3 | **Hugo Award, bester Roman** (75) | Ein Preis, den jeder SF-Leser kennt |
| 3 | **SF Masterworks, Relaunch 2010** (182) | Der zweite Look derselben Reihe, als Instagram-Karussell |
| 3 | **The Otherwise Award** (40) | Eigene Szene, eigene Gespräche |
| 4 | **SF Masterworks, runde Ecken 2006** (10) | Eine kleine Kuriosität, gut für einen leichten Post |

Dazwischen **Jahrzehnte-Seiten** (`/book/<id>/decades`): Gatsby, Nineteen Eighty-Four, Dune, The Hobbit, Pride and Prejudice, Alice, Der Steppenwolf. Sie sind das Format, nach dem auf Pinterest gesucht wird, und zeigen die Kernidee an einem Buch, das jeder kennt.

**Ab Woche 5 kommen die Gestalter- und Designreihen.** Online veröffentlicht sind davon Edelmann (Reihe Hanser, Tolkien), Piatti (dtv phantastica), Kurt Wirth, Heidelbach und Penguin Great Ideas; in `posts.json` sind sie unter `done` abgehakt. **Noch Entwurf sind Herder Bücherei/Grieder, Penguin Classics black band und Virago Modern Classics.** Der ursprüngliche Satz lautete: Heinz Edelmann (Reihe Hanser, Tolkien), Celestino Piatti (dtv phantastica), Penguin Classics mit schwarzem Band, Virago Modern Classics, Penguin Great Ideas. Jeder dieser Posts wartet auf `publish:<slug>`; welche erscheinen, entscheidet Julian (Setup-Eintrag am 9.10.). Bis dahin rückt der Kalender nicht von selbst nach, aber „Ab hier verschieben“ schiebt die Woche mit einem Klick.

**Inhaltsmischung über acht Wochen:** etwa die Hälfte Sammlungen, ein Drittel Jahrzehnte, der Rest die Seite selbst (das Exposé, das Cover-Spiel, die eigene Sammlung). Posts über die Mitmach-Teile warten auf `spiel` bzw. `walls`, weil der Kalender nicht weiß, ob sie in Produktion eingeschaltet sind.

**Was in Bildunterschriften steht:** Künstler, wo die Sammlung sie kennt (ISFDB bei den SF-Reihen, belegte Gemälde bei Virago und Penguin), und der Satz, dass die Cover aus offenen Katalogen kommen. Fakten, die nicht aus unseren Daten stammen (Fleckhaus 1963, Edelmann und Yellow Submarine), sind im Eintrag als „prüfen“ markiert.

## 4a. Format: die Gestalter-Galerie

(Julian, 2026-10-04, mit einem Beitrag von @luusssso auf X als Beispiel: „posts like this are an idea. just for covers“.) Der Beitrag: „The Italian Futurism of Campari advertisements by Fortunato Depero (1925–1933)“, **ein Satz und vier Bilder, kein Link**, am Tag des Ansehens rund 48.000 Aufrufe und 2.000 Likes.

Warum es zu uns passt: Unsere Sammlungen nach Gestaltern sind genau dieser Stoff. Ein Name, eine Reihe, ein Zeitraum, und die Bilder tragen den Rest. Es ist das Gegenteil eines Werbeposts, und genau deshalb wird er geteilt.

**Die Regeln für den Kalender (Art `galerie`):**

- **Ein Satz:** „<Gestalter>'s covers for <Reihe> (<Jahre>)“. Die Jahre nur, wenn sie belegt sind. Unsere Daten kennen den Zeitraum der SF Masterworks (1999–2007), nicht aber den der Edelmann-, Piatti-, Wirth-, Grieder- oder Heidelbach-Umschläge; dort fehlen sie, bis jemand sie belegt.
- **Vier Cover desselben Gestalters**, aus der Sammlung, in der Reihenfolge, die am besten aussieht.
- **Kein Link im Post.** Der Link kommt als erste Antwort, weil Plattformen Posts mit Link knapper ausspielen. „Kopieren“ gibt deshalb nur den Satz mit, und der Zeichenzähler zählt den Link nicht.
- **Eine Galerie lädt Cover hoch, auch auf Bluesky.** Sie wartet deshalb immer auf `rechte`, und das Werkzeug hält sie sonst an. Das ist die eine Ausnahme von „Bluesky ist ein Link-Kanal“ in §1.

**Im Kalender sonntags auf Bluesky**, sieben Galerien vom 18.10. bis 29.11.:

- Chris Moore für die SF Masterworks: ISFDB nennt ihn bei 40 der 73, veröffentlicht.
- Dominic Harman für den Relaunch: 22 der 182, veröffentlicht.
- Heinz Edelmann für die Reihe Hanser.
- Celestino Piatti für dtv phantastica.
- Kurt Wirth für die Fischer Bücherei.
- Walter Grieder für die Herder Bücherei.
- Nikolaus Heidelbach für Haffmans.

Nur die Grieder-Galerie wartet noch auf `publish:herder-bucherei-covers-by-walter-grieder`; die übrigen Sammlungen sind online veröffentlicht. Auf Instagram ist es dasselbe Format als Karussell.

**Wer die sieben Gestalter waren** und welche Jahre belegt sind: [research-gestalter-galerien.md](research-gestalter-galerien.md). Kurz: Heidelbach läuft als Kipling-Ausgabe (1987–1995), Wirth ohne Jahre, und Grieders Galerie wartet, weil seine Herder-Umschläge nirgends belegt sind.

**X ist der Kanal des Vorbilds, steht aber nicht im Kalender:** 5.6a kennt keine Klasse `x`, und ohne sie ist ein Besuch von dort „social“ oder „direkt“. Soll X dazukommen, braucht `VIA` den Eintrag (Analyse-Regel 6, Julian gibt den Satz frei), dann ist es ein weiterer Kanal im Werkzeug.

## 5. Der Kalender und wie man eingreift

**Wo:** `lab/kalender/posts.json` ist die einzige Liste. Das Werkzeug liest und schreibt nur diese Datei; man kann sie auch von Hand ändern.

```bash
npx tsx lab/kalender/serve.ts
```

dann `http://localhost:4325`.

**Was man sieht:** je Woche eine Tabelle, Tage als Zeilen, Kanäle als Spalten; jede Karte mit Art, Status und erster Zeile, rot „wartet: …“, wenn eine Voraussetzung fehlt, ein Fähnchen bei Hinweisen. Oben die Voraussetzungen als Schalter: Wer `konto:bluesky` oder `rechte` einschaltet, sieht die Wartehinweise verschwinden.

**Eingreifen:** eine Karte öffnen, dann

- **Text, Titel, Datum, Kanal, Bild, Notiz ändern**, mit Zeichenzähler gegen die Grenze der Plattform (Bluesky zählt den Link mit);
- **Freigeben** (Julian will es so posten), **Gepostet** (mit der Adresse, unter der es erschien), **Verwerfen** (bleibt sichtbar, durchgestrichen) oder **Löschen**;
- **Text + Link kopieren**: der Link trägt schon `?via=<kanal>`; bei Instagram und TikTok nur der Text, weil der Link ins Profil gehört;
- **Ab hier verschieben**: alles ab diesem Tag, was noch nicht gepostet ist, um n Tage, auf einem Kanal oder allen;
- **Neuer Post** oben oder mit dem Plus an einem Tag.

**Was das Werkzeug anmahnt** (`warnings` in `lab/kalender/model.ts`, getestet):

- überfällig, aber weder gepostet noch verworfen;
- freigegeben, aber eine Voraussetzung fehlt, wenn es in drei Tagen dran ist;
- als gepostet markiert, obwohl die Rechte-Entscheidung offen ist;
- zu lang für die Plattform;
- „all“, „every“, „complete“, „best“, „prettiest“ und Verwandte: ansehen, nicht automatisch falsch („best novel“ ist der Name des Preises);
- ein Post vor dem Exposé seines Kanals;
- zwei Launches (HN, Reddit, Product Hunt) weniger als sieben Tage auseinander;
- mehr als drei Reddit-Antworten in einer Woche;
- dieselbe Seite zweimal auf einem Kanal binnen zwei Wochen.

**Die Tests** prüfen zusätzlich die Datei selbst: jeder Kanal mit Posts hat ein Exposé, kein Cover-Post auf Instagram, Pinterest oder TikTok ohne `rechte`, jede verlinkte Sammlung existiert, und ein unveröffentlichter Entwurf steht als `publish:<slug>` in den Voraussetzungen.

**Was Claude weiter tut, auf Zuruf:** nach Woche 8 die nächsten acht Wochen planen, aus dem, was getragen hat; für ein Reddit-Fenster eine Suchliste passender Fragen; für TikTok die Liste der gezeigten Ausgaben als Quellenangabe; für die Mail-Runde die fünf Links mit geprüfter Vorschaukarte.

## 6. Messen

Ein Post ist erst ausgewertet, wenn er in K14 (Karte „Kanäle“ in `/admin/insights`, aus 5.6a) zu sehen ist. **Deshalb steht 5.6a als Voraussetzung an jedem Link-Post**; ohne den Deploy ist jeder Besuch aus einer App „direkt“. Einmal die Woche, fünfzehn Minuten: welche Posts Bücher geöffnet haben, nicht welche Likes hatten. Der Eintrag am 30.11. ist die Auswertung nach den Schwellen in PLAN-5.5-5.6 §5.

Die Analyse-Regel aus CLAUDE.md ist berührt, aber nicht verletzt: Der Kalender setzt nur `?via=`-Werte aus der Liste `VIA` (`bluesky`, `instagram`, `pinterest`, `tiktok`, `reddit`, `hn`, `producthunt`, `mail`; für Blogs `blog` von Hand im Pfad). Ein neuer Kanal braucht zuerst eine neue Klasse in 5.6a.

## 7. Offene Entscheidungen, alle Julians

1. **Die Rechte-Entscheidung** (PLAN-5.5-5.6 §6 Frage 1). Sie hält 30 der 70 Einträge zurück: alles auf Instagram außer dem Exposé, alles auf Pinterest und TikTok, und die sieben Galerien.
2. **Welche Kanäle es wirklich gibt.** Der Kalender plant acht; ein Kanal, den Julian nicht will, wird im Werkzeug ausgeblendet oder seine Einträge verworfen.
3. **Startdatum.** Der Kalender beginnt mit einer Einrichtungswoche ab Mo 5.10. und dem ersten Post am Mo 12.10. Wer später anfängt, schiebt mit „Ab hier verschieben“ alles in einem Schritt.
4. **Ob die drei restlichen Entwürfe erscheinen** (Grieder/Herder, Penguin black band, Virago); sonst werden ihre Posts verworfen.
5. **Englisch oder zweisprachig.** Die Vorschläge sind englisch, weil das Publikum der Kanäle es ist; bei edition suhrkamp und Edelmann bietet sich ein deutscher Post daneben an.
6. **Der erste Satz des Show HN**, Julians eigener Grund für die Seite.
7. **X als Kanal** für die Galerien (§4a): ja heißt eine neue `VIA`-Klasse in 5.6a.
