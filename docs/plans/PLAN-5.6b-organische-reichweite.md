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

**Bluesky-Handle:** die Domain selbst, `@buyitscovers.com`. Das kostet einen TXT-Eintrag bei INWX und ist der einzige Profilname, den niemand nachmachen kann. **Mastodon und Threads** standen zuerst nicht in der Liste, weil 5.6a sie nicht als Klasse kennt. **Mastodon ist seit dem 2026-10-05 trotzdem ein Kanal** (Julian: „post the same expose as on x and bsky on mastodon“): das Exposé liegt im Konto `@buyitscovers` auf `mastodon.social`, der Link ohne `?via=` im Text. Gemessen am Post: Mastodon setzt `rel="nofollow noopener"` ohne `noreferrer`, der Referrer `mastodon.social` kommt also an und der Besuch zählt als `social` — aber nicht als eigener Kanal, und eine fremde Instanz zählt als `direct`. Soll `mastodon` eine Klasse werden wie `x`, braucht `VIA` einen Eintrag (Analyse-Regel 6 in CLAUDE.md, Julian gibt den Satz frei). **Threads** bleibt draußen.

## 3. Das Exposé

Ein Gedanke, je Kanal neu gesagt (Julians Regel vom 2026-10-02 für Übersetzungen gilt auch hier: der Satz tut seine Arbeit, er wiederholt keine Wörter):

> **Judge a book, buy its covers.** Type a title and see the covers it has been printed with, by language and year. Then find the edition you'd want on your shelf. From two open catalogues, Open Library and Google Books.

Was in jedem Exposé steht: was man tut (Titel eingeben), was man sieht (die Cover, nach Sprache und Jahr), was man davon hat (die Ausgabe finden), woher es kommt (zwei offene Kataloge). Was nie darin steht: „alle“, „jede“, „vollständig“, „die schönsten“. Das Werkzeug markiert diese Wörter.

| Kanal | Datum im Kalender | Form |
|---|---|---|
| Bluesky | Mo 12.10. | Text, Startseite als Karte, angepinnt |
| Mastodon | **gepostet am 5.10.** | Text mit Adresse, Karte holt Mastodon selbst |
| Instagram | Di 13.10. | Karussell aus fünf Schrift-Folien **ohne Cover**, angepinnt; braucht deshalb keine Rechte-Entscheidung |
| Pinterest | Sa 17.10. | Pin der Startseite, wartet auf `rechte` und 5.5a |
| Hacker News | Di 20.10., 15:30 | Show HN; der erste Satz ist ein Platzhalter für Julians eigenen Grund |
| TikTok | Do 29.10. | Clip „Dune durch die Jahrzehnte“ |
| Reddit | Di 3.11., 15:00 | r/InternetIsBeautiful, zwei Wochen nach HN |
| Product Hunt | Di 1.12. | optional |

Die Texte stehen vollständig in `lab/kalender/posts.json` und sind im Werkzeug zu ändern.

**Als Ansicht, wie es auf jeder Plattform aussähe:** das private Artefakt [Buy Its Covers Exposés](https://claude.ai/artifact/YGoSUegNAdyytMeCuwXobQ) (2026-10-04). Es zeigt Mock-ups je Kanal, Link, Voraussetzungen und einen Kopierknopf und ist aus `posts.json` erzeugt, zusammen mit der Vorschaukarte der Startseite, einmal von der Produktion geholt. Die Karte zeigt nur Farbflächen, keine Cover: Deshalb brauchen Bluesky, HN, Reddit und Product Hunt für das Exposé keine Rechte-Entscheidung.

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

## 4b. Kampagne „performative readers“

(Julian, 2026-10-06: „ich würde sogar eine kleine kampagne um das thema performative readers herum bauen“, nachdem er den Begriff in seinen Show-HN-Text geschrieben hatte.) „Performative reader“ ist ein Spottwort für Leute, die Bücher lesen oder tragen, um gesehen zu werden.

**Die Haltung:** Die Kampagne nimmt das Wort selbstironisch an und spottet über niemanden. Der Satz, der sie trägt: Das Cover ist der Teil eines Buches, den alle anderen sehen. Genau dafür ist die Seite da, denn sie zeigt die Cover und führt zur Ausgabe dahinter. Ein Post darf nie Leser auslachen, auch nicht die, die das Wort meint.

**Eine Woche, im Kalender vom 21. bis 25.10., direkt nach dem Show HN:**

| Tag | Kanal | Post | Wartet auf |
|---|---|---|---|
| Di 21.10. | Bluesky, X | „A note for the performative readers: the cover is the part of a book everyone else sees.“, Link auf die Startseite | Konto, 5.6a |
| Mi 22.10. | Pinterest | Julians gerahmte Wand aus 110 Rowohlts Monographien: „A hundred and ten lives, one wall.“, verlinkt auf die Sammlung | Konto |
| Do 23.10. | Bluesky | Das Cover-Spiel: „Which cover would you rather be seen reading on the train?“ | Konto |
| Fr 24.10. | Instagram | „The performative reader's starter pack“ als Shelf-Portrait mit neun Covern | Konto, **Rechte-Entscheidung** (einzelne Cover) |
| Sa 25.10. | Bluesky | Shelf-Portrait: „Performative reading, done properly“ | Konto |

**Zwei Posts für alle Plattformen** (Julian, 2026-10-06):

- **Der Zug-Witz am 23.10.** auf Bluesky, X, Instagram und Pinterest.
  - Infinite Jest (das Wolken-Cover, OL 191075) gegen Fifty Shades of Grey (die Filmausgabe, 15163071), beide aus dem Pool des Spiels. Unter der Frage stehen der Slogan der Startseite, „Judge a book, buy its covers.“ (Julian, 2026-10-06), und `buyitscovers.com/versus`.
  - Bilder: `lab/kalender/out/zug-1080x1350.jpg` und `pinterest-zug.jpg`.
- **Das Starter-Pack am 24.10.** auf Bluesky, X, Instagram und Pinterest, als Shelf-Portrait.
  - Claudes Vorschlag für neun Bücher: Infinite Jest, Ulysses (Penguin Clothbound), The Secret History, Norwegian Wood, L'étranger, Crime and Punishment (Penguin Clothbound), The Bell Jar, Meditations (Great Ideas) und A Little Life.
  - Julian bearbeitet das Brett im Editor; der Link steht im Kalender beim Eintrag `pr-ig-starter`. Das Bild ist danach das Poster des Shelf-Portraits.
- **Zug-Witz, zweite Fassung** (Julian, 2026-10-06, aus einer Runde des Spiels): The Gruffalo (OL 15154344) gegen Merritts *Le visage dans l’abîme* bei J’ai Lu (10215294), ein Akt von Boris Vallejo.
  - Dateien: `zug2-1080x1350.jpg` und `pinterest-zug2.jpg`.
  - Instagram und Pinterest entfernen nackte Brüste oft oder schränken solche Posts ein. Diese Fassung eignet sich eher für Bluesky und X, dort mit Inhaltswarnung.
  - Noch nicht im Kalender; Julian wählt zwischen Fassung 1 und 2.
- **Alle Bilder auf einer Seite:** das private Artefakt [Post-Galerie](https://claude.ai/artifact/MPXdmUDTpTspQvQYRxV9bW), erzeugt von `lab/kalender/galerie.py`, je Post alle Fassungen mit Stand.
- **Julians fertiges Starter-Pack** (2026-10-06): Infinite Jest, Ulysses, Norwegian Wood, Odyssee, Meditations, Crime and Punishment, Stoner, El extranjero und East of Eden.
  - Als Sharepic ist die zweite Zeile die einzige Überschrift: „The performative reader starter pack“ (Julian, ohne Apostroph) in der proportionalen Xanh der Seite. Der Kopf ist aus dem Mosaik des Posters neu gesetzt (`lab/kalender/sharepic_starterpack.py`).
  - Das Poster der Website bleibt, wie es ist.
  - **Am selben Tag neu gewählt:** [shelfportrait/tvujl2pk](https://buyitscovers.com/shelfportrait/tvujl2pk), vorher mzyjqzbo.
  - archive.org, wo Open Library die großen Cover ablegt, antwortete stundenlang mit 502/503, und das Poster der Seite kam zweimal mit sechs leeren Kacheln zurück. `lab/kalender/sharepic_starterpack.py` setzt das Bild deshalb selbst aus den neun Covern im Stil des Posters und bricht ab, statt eine Lücke zu zeichnen; vier Kacheln wurden aus Julians eigenem Sharepic geschnitten.
  - **Auf Bluesky gepostet** (2026-10-06, [Post](https://bsky.app/profile/buyitscovers.com/post/3mxb22vjfys26)) mit diesem Bild und nur `buyitscovers.com/shelfportrait` als Link (Julian: „als link im post nur buyitscovers.com/shelfportrait“). Eine erste Fassung mit Julians Sharepic und dem Link auf tvujl2pk hat Julian gelöscht; Bluesky-Posts lassen sich nicht bearbeiten.
- Beide zeigen geschützte einzelne Cover und **warten auf die Rechte-Entscheidung** (PLAN-5.5-5.6 §6 Frage 1).

**Das Bild der Wand** ist Julians eigenes Foto. Es liegt nur lokal unter `lab/kalender/out/cache/`, wie seine anderen Fotos auch, und wird von `render_gemeinfrei.py` zum Pin gesetzt.
- Gezählt sind es 110 Bände, zehn mal elf, nicht 120.
- Im Glas spiegelt sich in der Mitte schwach eine Person. Wer das nicht will, fotografiert schräg oder ohne Licht von vorn.
- Rechtlich sind es wie bei einem Mosaik viele kleine Cover, die Mosaike hat Julian freigegeben. Ob das Foto genauso behandelt wird, ist Julians Entscheidung; er hat den Pin gewollt.

**Gemessen** wird mit K16 wie alles andere. Die Kampagne trägt, wenn in der Woche mehr Besuche von Bluesky und X ein Buch öffnen als in der Woche davor.

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

## 6a. Lage nach zwei Tagen (2026-10-07) und was daraus folgt

Julian: „i can't get any traffic whatsoever, even with posting on x and bluesky for two days. how can i get any visibility/traction?“

**Befund:** Das ist kein Fehler der Posts, sondern die Lage neuer Konten. Bluesky `@buyitscovers.com` hatte am 2026-10-06 zwei Follower, X und Mastodon ähnlich; ein Post erreicht dort fast nur die eigenen Follower, und X zeigt Posts mit Link neuer Konten kaum jemandem. Eigene Kanäle tragen erst nach Monaten. Reichweite am Anfang kommt nur von **fremden Publikum**: Orte, an denen schon Leute sind, und Menschen, die schon gehört werden.

**Neue Reihenfolge**, vor dem Kalender aus §5:
1. **Show HN vorziehen.** Die größte einzelne Chance; 0.13 und 2.4 sind erledigt, das Formular ist vorbereitet. Werktag, 15:30 deutscher Zeit, Julian den Tag über in den Kommentaren.
2. **Reddit als Beitrag, nicht als Link-Abwurf:** je Unterforum ein Bild oder eine Sammlung, die dort von sich aus interessiert (SF Masterworks in einem SF-Forum, eine Gestalter-Galerie in einem Design-Forum), mit einem Satz, dass Julian die Seite gebaut hat. Vorher die Regeln des Forums lesen; r/InternetIsBeautiful einmal.
3. **Die Menschen hinter den Covern ansprechen:** lebende Gestalter aus [research-gestalter-galerien.md](research-gestalter-galerien.md) in der Galerie nennen und markieren, dazu die fünf Mails aus §2 (Blogs und Newsletter zu Buchgestaltung). Ein Repost von dort erreicht mehr als jeder eigene Post.
4. **Das Shelf-Portrait als Schleife:** zehn Freunde bitten, ihres zu bauen und auf ihren eigenen Konten zu teilen; jedes trägt die Adresse. Das Produkt hat damit seine eigene Verbreitung, die eigenen Konten nicht.
5. **Auf Bluesky antworten statt nur posten:** in Buch- und Design-Threads (BookSky) mitreden, wo ein Cover-Vergleich passt; Hashtags für die Buch-Feeds. Wenige echte Antworten am Tag.
6. **Geduld bei Suche und Pinterest:** 875 Seiten in der Sitemap, die Werkseiten bringen Besucher über Wochen, nicht Tage.

**Nachtrag 2026-10-07: Show HN geht noch nicht.** Julian: „show hn lässt mich noch nicht posten als neuling auf dem forum“. HN drosselt Show HN neuer Konten seit der Debatte im März 2026 („Ask HN: Please restrict new accounts from posting“). Wege: (a) Karma sammeln, ehrliche Kommentare über ein, zwei Wochen, dann erneut; (b) jemand mit älterem Konto reicht den Link ein — erlaubt, Stimmen organisieren nicht; (c) ein gewöhnlicher Link ohne „Show HN:“ unterliegt vielleicht nicht derselben Sperre, ungeprüft. **Ähnliche Orte** statt dessen: MetaFilter Projects (projects.metafilter.com; Selbstlinks ausdrücklich erlaubt, braucht ein MetaFilter-Konto, jeder Post geht durch die Moderation, einer im Monat; gute Projekte holt die Gemeinschaft auf die Startseite), Reddit r/InternetIsBeautiful und r/SideProject, Lobsters und Tildes (nur mit Einladung, eher Technik), Indie Hackers, Product Hunt (§2, zuletzt). Für Buchgestaltung eher Menschen als Foren: Blogs und Newsletter aus §2.

Was weiterläuft: die eigenen Kanäle als Schaufenster für die, die über 1–5 kommen. Was gemessen wird: K16 nach Herkunft, je Schritt eine Woche.

## 7. Offene Entscheidungen, alle Julians

1. **Die Rechte-Entscheidung** (PLAN-5.5-5.6 §6 Frage 1). Sie hält 30 der 70 Einträge zurück: alles auf Instagram außer dem Exposé, alles auf Pinterest und TikTok, und die sieben Galerien.
   - *Cover im Instagram-Exposé* (Julian, 2026-10-05, als Kommentar im Artefakt: „ich würde gerne hier cover zeigen. mit welchen wäre das möglich?“). Die Antwort stützt sich auf research-cover-prints.md:
     - **Gemeinfreie Cover:** Gestalter vor 1956 gestorben; ein Scan begründet keinen neuen Schutz (§ 68 UrhG). Kandidaten sind Pride and Prejudice mit Hugh Thomson (1894) und Alice mit Tenniel. Das ist der sicherste Weg.
     - **Reine Schriftcover**, etwa die edition suhrkamp: „typischerweise“ nicht geschützt, ein Restrisiko bleibt.
     - **Mit Erlaubnis lebender Gestalter**, etwa Harman oder Heidelbach; das Anschreiben ist Julians.
     - **Ein Foto des eigenen Exemplars hilft nicht.**
     - Vorschlag: Folie 1 mit einer gemeinfreien Ausgabe. Gestalter und Sterbejahr sind je Cover zu belegen; Claude bietet das an.
     - **Gesucht 2026-10-05, auf Julians Wunsch abgebrochen:** [research-gemeinfreie-cover.md](research-gemeinfreie-cover.md).
       - Fünf Cover taugen: Peter and Wendy 1911 (Bedford †1954), The Jungle Book 1894 (J. L. Kipling †1911), Pinocchio 1902 (Chiostri †1939), Alice 1928 (W. H. Walker †1938), La guerre des mondes 1906 (Alvim Corrêa †1910).
       - Dazu zwei schlichte Leinen und 15 unklare oder nicht freie.
       - Gebaut am 2026-10-05: das Instagram-Exposé als Karussell mit diesen fünf Einbänden und der erste Pin (Peter and Wendy, 1911, verlinkt auf die Jahrzehnte-Seite von Peter Pan). Beide brauchen damit keine Rechte-Entscheidung mehr, nur Konto und 5.6a. Die Bilder rendert `lab/kalender/render_gemeinfrei.py`.
   - **Mosaike sind freigegeben** (Julian, 2026-10-05: „arbeite noch mit mosaiken der cover, die nicht gemeinfrei sind. das sollte pragmatisch keine rechteprobleme auslösen“). Damit ist Frage 1 für Mosaike beantwortet: Weg (a), mit Quellenangabe. Für einzelne Cover, Galerien und Clips bleibt sie offen.
     - Gebaut am selben Tag: ein Instagram-Karussell mit vier Autorenporträts aus den Covern ihrer meistgedruckten Bücher (Twain, Austen, Poe, Dickens; Porträts gemeinfrei, aus `lab/loading/templates.json`) und ein Pin (Twain, verlinkt auf `/?author=mark%20twain`). Im Kalender am 16.10. und 19.10.
     - Nicht gelesen haben sich: Wilde und Woolf, deren Gesichter im Mosaik nicht erkennbar werden, und die gemeinfreien Ersteinbände als Motiv (Peter and Wendy, Pinocchio). Feine Goldprägung auf dunklem Leinen wird zu einer bunten Wand ohne Motiv, auch mit 25 % Überblendung. **Ein Mosaik braucht ein Foto mit Hell und Dunkel, keinen Einband**; das stand schon in lab/mosaic für Jacken.
   - **Nachgebessert am 2026-10-05** (Julian: „bereite mosaike mit nur frauen vor“, „weniger kacheln in der story“, „anderes copywriting auf der ersten kachel“, „die überblendung sollte möglichst 0 sein“):
     - Die Instagram-Story hat jetzt nur Frauen und vier Folien statt sechs. Folie 1 sagt „The women behind the covers.“, dann folgen Austen, Alcott und Wharton bei 45 Spalten ohne Überblendung. Kalender-Eintrag `ig-mosaik-frauen`, 16.10.
     - **Neun Autorinnen versucht:** Eliot, Shelley und Cather wurden zu weich; bei Montgomery, Brontë und Burnett war das Gesicht unscharf oder abgeschnitten.
     - **Weniger Kacheln im Mosaik** (26 bis 28 Spalten statt 45) lesen sich schlechter; mit 20 % Überblendung ginge es, aber Julian will keine.
   - **Das Pinterest-Exposé zeigt das Cover-Spiel** (Julian, 2026-10-05: „bereite ein pinterest expose der website vor, dass das versus spiel zeigt“).
     - Frage und Zeile kommen aus dem Spiel: „Which cover would you rather look at?“; die Zeile darunter war „Judge the cover, not the book.“ aus dem Spiel und hieß am 2026-10-06 kurz „Judge a book by its cover.“ und ist seitdem auf allen Bildern der Slogan der Startseite, „Judge a book, buy its covers.“ (Julian: „besser doch unseren hero slogan von der startseite“)
     - Gezeigt mit zwei gemeinfreien Covern: Peter and Wendy 1911 und La guerre des mondes 1906, verlinkt auf `/versus`. Zuerst waren es Pinocchio und das Jungle Book; Julian wollte zwei andere, weil diese schon im Instagram-Exposé stehen. /versus läuft in Produktion, einmal geprüft am 2026-10-05.
     - Der Peter-and-Wendy-Pin ist damit der zweite Pin (21.10.).
     - **Entwurf ohne die Gemeinfreiheits-Grenze** (Julian, 2026-10-05: „mache mal einen entwurf, wenn gemeinfrei nicht relevant wäre“): `lab/kalender/out/pinterest-versus-entwurf.jpg` zeigt The Great Gatsby (OL-Cover 12547003) gegen Dune in den SF Masterworks (380097), beide aus dem Pool des Spiels (`data/versus-pool.json`). **Nicht zum Posten freigegeben**, solange die Rechte-Frage für einzelne Cover offen ist. Im Kalender steht weiter die gemeinfreie Fassung.
2. **Welche Kanäle es wirklich gibt.** Der Kalender plant acht; ein Kanal, den Julian nicht will, wird im Werkzeug ausgeblendet oder seine Einträge verworfen.
3. **Startdatum.** Der Kalender beginnt mit einer Einrichtungswoche ab Mo 5.10. und dem ersten Post am Mo 12.10. Wer später anfängt, schiebt mit „Ab hier verschieben“ alles in einem Schritt.
4. **Ob die drei restlichen Entwürfe erscheinen** (Grieder/Herder, Penguin black band, Virago); sonst werden ihre Posts verworfen.
5. **Englisch oder zweisprachig.** Die Vorschläge sind englisch, weil das Publikum der Kanäle es ist; bei edition suhrkamp und Edelmann bietet sich ein deutscher Post daneben an.
6. **Der erste Satz des Show HN**, Julians eigener Grund für die Seite.
7. **X als Kanal** für die Galerien (§4a): ja heißt eine neue `VIA`-Klasse in 5.6a.
