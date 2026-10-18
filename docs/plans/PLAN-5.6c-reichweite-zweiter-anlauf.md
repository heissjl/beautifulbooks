# Plan 5.6c: Reichweite, zweiter Anlauf — Gespräche statt Sendung, ein Kanal ohne Follower, Automatisierung mit Freigabe

Geschrieben 2026-10-17 auf Julians Bitte: „überarbeite die strategie um reichweite und traffic bekommen. bisher hat nur reddit und x ein bisschen was gebracht. die virale 3x3 grid welle ist an uns vorbei gegangen und langsam zu ende. überlege auch ob du automatisch meine accounts benutzen kannst um reichweite zu generieren? […] bisher haben deine vorschläge aus dem kalender nie ganz meine art des copywritings und des brandings getroffen, die mir vorschwebt. aber ich lasse mich auch mit vorschlägen umstimmen.“

**Was dieser Plan ist:** die Überarbeitung der Strategie aus [PLAN-5.6b](PLAN-5.6b-organische-reichweite.md) §1 nach zwölf Tagen Posten und mit den ersten Zahlen. Er ersetzt §1 und §6a dort als Richtung; **der Kalender (`lab/kalender/`) bleibt das Werkzeug**, die Kanäle, Schwellen und die Rechte-Frage aus [PLAN-5.5-5.6-kanaele.md](PLAN-5.5-5.6-kanaele.md) gelten weiter. Was aus dem alten Plan übernommen ist, steht hier nur als Verweis.

**Was er nicht ist:** keine Rechtsberatung (§6 fasst zusammen, was in [research-cover-prints.md](research-cover-prints.md) steht), und keine Prognose. Wo eine Zahl steht, ist sie gemessen und datiert; wo keine steht, gibt es keine.

---

## 0. Kurzfassung

1. **Die Zahlen sagen: bisher hat nichts getragen, und zwei Dinge haben ein bisschen getragen.** Alle Kanäle zusammen brachten seit dem 5.10. rund **30 Besucher** (X 16, Reddit 14, nach Vercels Verweisen); die eigenen Konten haben 3 bis 4 Follower; ein Beitrag auf X hat 15 bis 93 Aufrufe. Was vergleichsweise ging: **Antworten in fremden Threads** (69 und 93 Aufrufe) und **ein Bild in einem Forum, das Cover sammelt** (r/bookcoverporn, die meisten Reddit-Besucher).
2. **Die Welle ist vorbei, und sie wäre auch mit uns nicht zu uns gekommen:** ein Format verbreitet sich über Menschen mit Publikum, nicht über ein Werkzeug ohne Publikum. Seit dem 10.10. haben Besucher **2 Shelf-Portraits** gebaut.
3. **Die Besucherzahlen sind seit dem 13.10. von Bots geprägt** — Googles Renderer, dann ein Scraper mit echtem Browser, der auch Shop-Links klickt. Vercels Zahlen sind unbrauchbar, und die eigene Analyse zählt seit dem 16.10. Bot-Klicks mit (§1.3, Roadmap 3.1i).
4. **Die Strategie dreht sich:** weg vom Senden auf eigenen Konten, hin zu Antworten dort, wo Leser schon reden (X, Bluesky, Reddit); **eine Person statt einer Marke** als Absender der Geschichte; zwei Geschichten für zwei Publikümer (Leser, und Leute, die mit KI bauen); dazu **der eine Kanal, der ohne Follower wächst** (Pinterest, später die Suche) — der an der Rechte-Frage hängt, die §6 heute entscheidbar macht.
5. **Automatisch posten kann und darf ich nicht ohne dein Wort je Beitrag**, und auf X und in Antworten wäre es außerdem gegen die Regeln der Plattformen (§5). Was geht und viel bringt: ein **täglicher Antwortzettel** (Threads, in die eine Antwort mit Bild passt, fertig formuliert, Link gebaut; Bluesky ohne Login, geprüft heute), **Posten auf Zuruf** im Chat (wie am 5./6.10. auf Mastodon und X), und eine **Warteschlange, die du im Kalender freigibst** und die Buffer Free (von Bluesky empfohlen) oder ein eigenes Skript über die offiziellen Schnittstellen abschickt — auf Bluesky, Mastodon und Threads; **nicht auf X** (0,20 $ je Link-Post, Pflicht-Label „Automated“) und nicht auf Pinterest (jeder Pin muss von Hand gewählt sein).
6. **Die Stimme:** deine eigenen Zeilen sind Bildunterschriften mit trockenem Witz; meine waren Erklärungen mit Quellenangabe. §4 leitet aus deinen Zeilen ein Stilblatt ab und schreibt zwölf Beispiele — die du streichst oder behältst, bevor ich die 87 Kalendertexte anfasse.
7. **Zwölf Wochen in drei Schichten** (§7): täglich 15 Minuten Antworten; einmal die Woche eine Sammlung als Geschichte; einmalig die Baugeschichte (persönliches Konto, HN, r/ClaudeAI). Nach acht Wochen entscheidet die Zahl, mit den Schwellen aus PLAN-5.5-5.6 §5.

---

## 1. Lage am 2026-10-17, gemessen

### 1.1 Was gepostet wurde und was es brachte

Gelesen heute: Bluesky über die öffentliche API (`api.bsky.app`, ohne Login), X über das öffentliche Profil im Browser-Bereich (ohne Login lesbar, Aufrufe stehen unter jedem Beitrag), Mastodon über den RSS-Feed, der Kalender (`lab/kalender/posts.json`), Vercel Web Analytics (Verweise seit dem 8.9.) und `/admin/insights` (30 Tage, einmal aus der Produktion).

| Kanal | Konto | Gepostet | Reichweite | Besucher daraus |
|---|---|---|---|---|
| **X** | @buyitscovers, seit 4.10., **4 Follower** | Exposé (6.10.), Tom Adams (9.10., 93 Aufrufe), Goodreads-Export (9.10., 19 Aufrufe), drei Antworten in fremden Threads (TheStalwart 15, TeddyRookBook 69, Kulambq 15 Aufrufe) | 15–93 Aufrufe je Beitrag | **16** (t.co), davon 1 Klick zu einem Händler |
| **Bluesky** | @buyitscovers.com, seit 4.10., **3 Follower** | Exposé (2 Likes), Starter-Pack (1), Spiel (0), „Beautiful Sci-Fi covers“ (0) | 0–2 Likes | nicht messbar getrennt (`via=bluesky` 0 Einstiege) |
| **Mastodon** | @buyitscovers@mastodon.social | Exposé (5.10.) | — | unter `social`: 3 Einstiege |
| **Reddit** | u/buyitscovers (seit 7.10.) | r/bookcoverporn (SF Masterworks, 7.10., ohne Bildvorschau), r/coolscificovers (Bild wurde entfernt, falscher Host) | — | **14** (11 Web, 3 App), 10 Einstiege, 2 öffneten ein Buch |
| **Suchmaschinen** | — | Sitemap seit 4.10. in der Search Console | — | 14 (Bing 6, Google 6, DuckDuckGo 1, Yahoo 1) |
| **Hacker News** | neues Konto | Show HN seit 7.10. **gesperrt für neue Konten**; Text liegt im Formular | — | 0 |
| **Instagram, Pinterest, TikTok** | nicht angelegt | 30 Kalendereinträge warten auf die Rechte-Frage | — | 0 |

Kalender: 98 Einträge, 9 gepostet, 2 verworfen (Blogger-Mails wegen der Rechte-Frage; Starter-Pack auf Bluesky), 87 Vorschläge.

**Shelf-Portrait (5.18b):** seit der Zählung (K17, 10.10.) **2 Bretter von Besuchern** und 2 von Julian; `/shelfportrait` hatte in 30 Tagen 26 Einstiege. Die Welle „9 books I'll never forget“ lief auf X ab dem 5.10. (1.342 Posts am 7.10. unter „Today's News“) und auf Bluesky kleiner; am 16./17.10. trudeln dort noch Nachzügler ein, fast alle mit `myninebooks.com`-Link.

**Was vergleichsweise ging**, nach Aufrufen je Minute Arbeit: die Antwort unter einem Buch-Haul (69), der Bildpost Tom Adams (93) und das Bild in r/bookcoverporn (die meisten Besucher eines Kanals). Alle drei haben gemein: **ein Bild, ein Satz, fremdes oder thematisch versammeltes Publikum.** Das Exposé auf drei Kanälen brachte zusammen weniger als eine dieser Antworten.

### 1.2 Wie viele Menschen die Seite sehen

Die ehrliche Zahl ist klein und nicht genau zu haben: Vercel zählt Renderer und Scraper mit, die eigene Analyse schließt Julian aus, aber nicht Freunde und Claude-Sitzungen. Lesbar ist der Beacon `/api/seen` je Tag (`vercel metrics`, 14 Tage bis 17.10.): **2.280 Signale, davon rund 1.900 am 16./17.10. vom Scraper** (§1.3); die übrigen 13 Tage liegen bei **0 bis rund 40 Signalen am Tag**, also Dutzende Seitenbesuche, nicht Hunderte. Vercels Verweise seit dem 8.9.: ohne Verweis 3.091 „Besucher“ (fast alle Bots), t.co 16, reddit.com 11, bing 6, google 6, com.reddit.frontpage 3, ui.awin.com 3 (Julians Partnerkonto), je 1 DuckDuckGo, Yahoo, byitscovers.com, vercel.com. **Mehr als 30 Menschen haben die Seite über alle Kanäle zusammen gefunden; der Rest kam direkt** — Freunde, Julian, Claude.

### 1.3 Die Bots in den Zahlen — und ein Fehler in der eigenen Analyse

- **13.10.:** 17 „Besucher“, 4.331 Aufrufe — Googles Renderer ([Historie 2026-10-14](../history.md#2026-10-14--3942-seitenaufrufe-von-16-besuchern-googles-renderer-nicht-leser)).
- **16./17.10.:** 1.033 und 1.482 „Besucher“ mit je einem Aufruf, aus Brasilien (493), Argentinien, Bangladesch, Indien, Kolumbien, Mexiko, Venezuela, Pakistan … — der Scraper aus [2.18f](../history.md#2026-10-17--googles-80--alarm-ein-scraper-auf-apiworks-google-nur-noch-für-die-eigenen-seiten-roadmap-218f) läuft **mit echtem Browser**: dieselben zehn alten User-Agents (Firefox 120/121, Chrome 118–120, Edge 119/120) senden den Beacon `/api/seen` (974 am 17.10.) und **klicken `/go/`** — 81 Klicks am 16.10., **406 am 17.10.**, je User-Agent 27–78, dazu `Lightpanda/1.0` (ein Headless-Browser) 8; echte Browser in denselben drei Tagen: 4 Klicks von einem iPhone. **Die eigene Analyse zählt diese Klicks als Käufe (K1: 494 im Monat, 488 Markt US) und die Beacons als Einstiege (K16: 1.739 „direkt“).** Bis zum 15.10. war sie sauber (die Renderer senden keinen Beacon).
- **Folge:** ROADMAP **3.1i** (Claude): `/go/` und `/api/seen` zählen nur, was ein Mensch sein kann — Header einer echten Navigation (`Sec-Fetch-Mode: navigate`, `Sec-Fetch-User: ?1` beim Klick; `Sec-Fetch-Site: same-origin` beim Beacon) und ein User-Agent aus diesem Jahr; die zwei Tage werden in der Ansicht als Bot-Tage markiert, nicht gelöscht. Erst dann sind die Schwellen in §8 messbar. **Bis dahin gilt: eine Zahl aus `/admin/insights` ab dem 16.10. ist ohne Blick auf die User-Agents nichts wert.** **Gebaut 2026-10-18** ([Historie](../history.md#2026-10-18--nur-zählen-was-ein-mensch-sein-kann-die-wächter-regel-für-go-und-apiseen-bot-tage-markiert-roadmap-31i)); die Zahlen ab dem Deploy sind wieder Leser, die drei Tage davor stehen in der Ansicht als Bot-Tage.

---

## 2. Diagnose: warum der erste Anlauf nicht trug

1. **Sendung ohne Empfänger.** Ein Konto mit vier Followern erreicht vier Leute; X zeigt Link-Posts neuer Konten fast niemandem (nach dem Exposé-Post leitete X auf „graduated-access“ um). Der Kalender plante 70 Sendungen in diese Leere. Das stand schon in PLAN-5.6b §6a (7.10.), ist aber als Rhythmus im Kalender geblieben.
2. **Die Welle gehört denen, die vorher da waren.** my9albums zündete über eine Gemeinde, die sich kannte, und über einen Gründer mit Namen ([Recherche](../my9albums-viral-recherche.md) §3, §4.9). Unser Shelf-Portrait kam am 5.10. online, die englische Welle rollte da schon mit myninebooks und my9books; ein Werkzeug ohne Publikum springt nicht auf. Die zwei Bretter seit dem 10.10. sind die Zahl dazu.
3. **Die Rechte-Frage hält den halben Plan fest:** 30 Kalendereinträge, die Blogger-Mails, Pinterest, Instagram, TikTok, Galerien. Seit dem 4.10. offen, und solange offen, zählt (c) „nur Links“ — der Weg mit der geringsten Reichweite.
4. **Die Stimme.** Die Kalendertexte erklären die Seite und hängen die Quellen an („from two open catalogues, Open Library and Google Books“) — die Ehrlichkeitsregeln der Seite, in Posts übertragen. Deine Zeilen tun das nie (§4). Ein Post ist eine Bildunterschrift, keine About-Seite.
5. **Die Messung sah Bots als Leser** (§1.3), und das Vercel-Dashboard zeigte am 16./17.10. tausend Besucher, die es nicht gab.
6. **Zu viele Kanäle für einen Abend die Woche.** Zehn Kanäle, zwei davon mit Konto. Besser drei richtig: wo die Leser sind (X, Reddit, Bluesky als Nische), wo Bilder gesucht werden (Pinterest), wo gesucht wird (Google).

---

## 3. Die neue Strategie in sieben Sätzen

1. **Antworten statt senden.** Vier Fünftel der Zeit gehen in Antworten dort, wo jemand gerade über ein Buch, eine Ausgabe oder ein Raster aus neun Büchern spricht — mit einem Bild von der Seite und einem Satz. Das ist das Einzige, was bisher Aufrufe brachte, und es braucht keine Follower. Claude liefert dafür jeden Morgen den **Antwortzettel** (§5.2).
2. **Eine Person, nicht eine Marke, erzählt die Geschichte.** my9albums war „die App von nays“. Dein persönliches Konto (der 13-teilige Thread-Entwurf vom 7.10. liegt bereit) trägt die Baugeschichte; @buyitscovers ist das Schaufenster, das jemand findet, der dem Link folgt. **Deine Entscheidung** (§9.2), und sie entscheidet mehr als jeder Kalendereintrag.
3. **Zwei Geschichten, zwei Publikümer.** Für Leser: die Cover (Sammlungen, Wände, das Shelf-Portrait als Pointe). Für Leute, die mit KI bauen: wie die Seite in drei Wochen Urlaub mit Claude entstand, 1.080 Commits, 150 $ — Show HN, r/ClaudeAI, r/vibecoding, der X-Thread. Die zweite Geschichte ist der einmalige große Stoß, und diese Leute lesen auch.
4. **Ein Kanal, der ohne Follower wächst.** Pinterest ist eine Bildersuche, ein Pin lebt Monate, und niemand fragt dort nach Followern. Dazu die Suche (6.107, läuft). Beides hängt an der Rechte-Frage (§6) und an Geduld: acht Wochen, dann die Zahl.
5. **Sammlungen bleiben der Inhalt, aber als Geschichte, nicht als Katalogkarte.** Eine Sammlung die Woche, ein Bild, ein Satz in deiner Stimme (§4), auf allen Kanälen dasselbe; der Link in der Antwort darunter.
6. **Das Shelf-Portrait ist nicht mehr die Wette, sondern der Haken.** Als Antwort unter jedes Neuner-Raster („same nine, in the editions you actually read“), als das eine Bild, das auf Instagram ohne Link funktioniert, und als **die deutsche Chance**: die Welle lief spanisch und englisch, **eine deutsche gab es nicht** — die Seite spricht Deutsch, das Shelf-Portrait noch nicht (5.18b, offen 1). Wenn du es in deinem deutschen Umfeld anstoßen willst, kommt die Übersetzung zuerst.
7. **Messen ohne Bots, und nach acht Wochen entscheiden.** Die Schwellen aus PLAN-5.5-5.6 §5 bleiben; 3.1i macht die Zahlen wieder brauchbar. Was nicht trägt, wird eingestellt, nicht verbessert.

---

## 4. Stilblatt: wie du schreibst, und wie die Posts klingen sollen

**Deine Zeilen** (X, 7.–9.10.; HN-Entwurf 6.10.; Spiel-Post 6.10.):

- „Tom Adams' Agatha Christie covers for Fontana, 1963–1979“ — eine Bildunterschrift, sonst nichts. 93 Aufrufe, der beste Post des Kontos.
- „We recommend reading it in a nice edition“ — unter Hemingways Leseliste.
- „If you want these *exact* editions, check the link“ — unter einem Buch-Haul.
- „We will do the best and most aesthetic analysis of all the shelf portraits on our website“ — Hyperbel mit Augenzwinkern, als Antwort auf „It's a sin to let good data go to waste“.
- „Drop your Goodreads export on buyitscovers.com/create: your to-read shelf as a wall of covers, and the edition you want to read next just a click away to order“ — ein Atemzug, kein Punkt.
- „May be interesting to some performative readers out there.“ — der Schluss deines HN-Absatzes; „performative reader“ ist seitdem die Figur der Seite.
- „Which cover would you rather be seen reading on the train?“ — das Spiel in einer Frage.

**Was daran die Regel ist:**

| # | Regel | Woran man sie erkennt |
|---|---|---|
| S1 | **Bildunterschrift, nicht Erklärung.** Das Bild ist der Post; der Satz ordnet es ein. | „Tom Adams' … 1963–1979“. Kein „Type a title and see …“. |
| S2 | **Ein Gedanke, eine Zeile.** Kein zweiter Absatz, der die Seite erklärt. | Alle oben. Die Erklärung steht im Profil und auf der Seite. |
| S3 | **Trockener Witz über die Lesekultur, nie über das Buch.** Der performative reader, der Zug, „a nice edition“. | „be seen reading on the train“, „in a nice edition“. |
| S4 | **„We“ als kleiner Laden mit Meinung.** Die Seite empfiehlt im Post, was sie auf der Seite nicht tut. | „We recommend reading it in a nice edition“. Ein Witz ist keine Behauptung — die Ehrlichkeitsregel (N12) bindet die Seite, nicht die Pointe. |
| S5 | **Keine Quellenangabe, kein Disclaimer im Post.** „From two open catalogues“ gehört auf /about. | Deine Zeilen haben keinen einzigen. Meine hatten ihn in jedem Exposé. |
| S6 | **Hyperbel darf sein, wenn sie sich selbst verrät.** | „the best and most aesthetic analysis“. |
| S7 | **Der Link zuletzt oder in der Antwort darunter; auf X nie im ersten Post mit Bild.** | Aufrufe: Antwort mit Link 15, Bildpost ohne Link 93. |
| S8 | **Englisch, Satzzeichen locker, Betonung mit Sternchen, keine Hashtags auf X und Bluesky**; auf Instagram höchstens drei. | „*exact*“. |

**Was bleibt, auch im Witz:** nichts, was die Kataloge nicht halten — kein „every cover“, keine erfundene Jahreszahl, kein Gestaltername ohne Beleg (PLAN-5 §2, R5, R7). Zahlen im Post kommen von der Seite, mit Datum in der Kalendernotiz.

### 4.1 Drei Kalendertexte, vorher und nachher

| Eintrag | Vorher (Kalender) | Nachher (Vorschlag) |
|---|---|---|
| `bsky-sf-masterworks` | „The first, numbered run of the SF Masterworks (1999–2007): seventy-three classics that Millennium and Gollancz reprinted, in the order of their numbers. Behind each cover is a wall of the other faces the book has worn.“ | **„SF Masterworks 1 to 73, in order. The spines don't match. They never did.“** |
| `bsky-edition-suhrkamp` | (Katalogkarte mit Fleckhaus und Regenbogen) | **„edition suhrkamp: one typeface, one layout, and a rainbow that took sixty years to finish.“** |
| `bsky-gatsby-decades` | „The Great Gatsby, decade by decade …“ | **„The Great Gatsby since 1925. The eyes keep coming back. So do the flappers.“** |

### 4.2 Zwölf Zeilen für die nächsten Wochen — streichen oder behalten

Posts (Bild = Vorschaukarte der Seite oder Bildschirmfoto der Wand, Link in der Antwort):

1. *1984, Jahrzehnte:* „Nineteen Eighty-Four has 343 covers with a year on them. 93 are from this decade. The eye is doing fine.“ (Zahlen von /book/OL1168083W/decades, 7.10.)
2. *Penguin Great Ideas:* „Penguin Great Ideas: nothing but type, and no two alike.“
3. *Virago:* „Virago Modern Classics. Green spines, borrowed paintings, best-dressed shelf in the shop.“
4. *Feminist Press:* „Feminist Press, fifty years of covers. The 70s ones are not subtle. Good.“
5. *Spiel:* „Two covers. One of them is wrong. You decide.“
6. *Shelf-Portrait:* „Your nine books, but in the editions you actually own. Yes, that one with the coffee stain counts.“
7. *Eigene Sammlung / Goodreads:* „Your to-read shelf is 212 books long. At least make it look good.“
8. *Startseite, Gatsby-Wand:* „One book. 251 covers. Pick the one you'd be seen with.“ (Zahl von der Buchseite, am Tag des Posts ablesen.)

Antworten (das Hauptinstrument; je Thread angepasst, nie kopiert):

9. Unter ein Neuner-Raster: „Good nine. Which editions, though?“ — und als zweite Antwort das eigene Brett mit Link.
10. Unter „which edition should I buy“: Bild der Wand, „Here's what it's been printed with, by year. The [Verlag] is the one for the shelf, the [Verlag] is the one for the bath.“
11. Unter einen Buch-Haul mit erkennbaren Ausgaben: „Nice haul. The [Titel] is the 20XX [Verlag] printing — the one before it had the better spine.“ (nur, wenn die Wand das zeigt)
12. Unter einen Post über eine Reihe (SF Masterworks, Clothbound, NYRB): die Sammlung als Bild, „All of them in order, if you need to check a gap.“ — mit „in order“, nicht „all of them“, wenn die Sammlung nicht komplett ist.

Deutsch, für den Fall §3.6 (dein Umfeld): „Dasselbe Buch, dreißig Gesichter. Welches steht bei dir?“ · „Deine neun Bücher — aber in den Ausgaben, die du wirklich gelesen hast.“ · „Ein Buch nach dem Cover beurteilen? Unbedingt.“ (steht so auf der deutschen Startseite).

**Vorgehen:** du streichst und änderst hier im Dokument oder im Chat; dann gehe ich die 87 Vorschläge des Kalenders in dieser Stimme durch — nicht vorher, sonst sind es noch einmal 87 Texte in der falschen.

---

## 5. Automatisierung: was geht, was nicht, was ich vorschlage

### 5.1 Die Antwort auf „kannst du automatisch meine Accounts benutzen?“

**Nein, nicht ohne dein Wort je Beitrag — und das aus drei Gründen, die unabhängig voneinander gelten:**

1. **Meine eigenen Regeln:** Ein Beitrag auf deinem Konto ist eine Veröffentlichung in deinem Namen; dafür brauche ich jedes Mal dein Ja im Chat. Ein „ja“ für einen Beitrag gilt nicht für den nächsten. Das ist kein Hindernis für Tempo: am 5./6.10. hast du „post the same expose … on mastodon“ und „poste auf X so wie auf bluesky“ gesagt, und ich habe es in deinem Chrome getan. So geht es weiter: du sagst „post 3 und 7“, ich poste 3 und 7.
2. **Die Regeln der Plattformen** (Einzelheiten in §5.4, aus der Recherche von heute): X erlaubt Automatisierung nur über die bezahlte API (0,20 $ je Link-Post), verlangt dafür das Label „Automated“ am Konto und nennt für Skripte oder Agenten an der Weboberfläche die dauerhafte Sperre. Reddit kennzeichnet automatisierte Konten als App und nimmt sie aus den Empfehlungen, und es ist für mich ohnehin tabu. Bluesky und Mastodon erlauben automatisches Posten über ihre API offen; Bluesky empfiehlt ein Bot-Label, mastodon.social verlangt, dass der Einsatz generativer KI offengelegt wird. Hacker News bittet, weder das Posten zu automatisieren noch KI-geschriebenen Text zu posten.
3. **Es brächte nichts.** Automatisierung vervielfacht Ausstoß; der Engpass ist nicht Ausstoß, sondern Publikum (§2.1). Hundert automatische Posts an vier Follower sind hundert Posts an vier Follower. Und eine automatische Antwort in einem menschlichen Gespräch erkennt jeder nach zwei Sätzen — dann ist nicht nur der Post verloren, sondern der Ruf der Seite, die von Vertrauen lebt (SPEC §9.2).

**Was geht, und was ich dir vorschlage, in dieser Reihenfolge:**

### 5.2 Der Antwortzettel (täglich, Claude; sofort möglich)

Jeden Morgen eine Liste: fünf bis acht Threads der letzten 24 Stunden, in die eine Antwort mit Bild von der Seite passt — ein Neuner-Raster, eine Frage nach einer Ausgabe, ein Buch-Haul, ein Post über eine Reihe. Je Thread: Link, worum es geht, der Antwortentwurf in deiner Stimme (§4), das Bild (Wand, Cover oder Sammlung als Datei), der gebaute Link mit `?via=`. Du liest, änderst, postest — zehn bis fünfzehn Minuten.

- **Bluesky:** die Suche der öffentlichen API antwortet ohne Login (`api.bsky.app/xrpc/app.bsky.feed.searchPosts`, heute geprüft; `public.api.bsky.app` gibt für die Suche 403). Die Probe heute fand unter „nine books“ noch Nachzügler der Welle vom 16./17.10., unter „book covers“ einen Gestalter-Post („Three book covers by Gian Calvi (1967-68)“, 5 Likes). Zu wenig für jeden Tag — Bluesky ist die Nische, nicht der Markt.
- **X:** die Suche braucht ein eingeloggtes Konto. **Dafür brauche ich dein Chrome mit X-Login** (du hast es angeboten) — oder ich lese einmal am Tag, wenn du am Rechner bist. X ist der Kanal mit Publikum; hier lohnt die Liste am meisten.
- **Reddit:** für mich tabu, also kein Lesen. Du nennst mir den Thread (Thema, Buch), ich baue Bild und Satz; den Rest machst du.
- **Als Routine:** Bluesky-Suche und Zettel kann ein geplanter Agent ohne dein Konto jeden Morgen schreiben (`/schedule`, Cloud); X nur lokal mit deinem Chrome. Der Zettel landet als Datei unter `docs/antwortzettel/<datum>.md` (git-ignoriert) oder als Einträge `kind: answer` im Kalender.
- **Grenzen:** keine Antwort an Rechteinhaber (Gestalter, Verlage — deine Regel vom 7.10.), höchstens fünf bis zehn Antworten am Tag, nie derselbe Satz zweimal, kein Link in der ersten Antwort auf X.

### 5.3 Posten auf Zuruf, und die freigegebene Warteschlange

- **Auf Zuruf** (heute möglich): ein Eintrag im Kalender steht auf `freigegeben`, du sagst im Chat „post bsky-sf-masterworks“, ich poste ihn über dein Chrome auf dem Kanal des Eintrags und setze `gepostet` und `postedUrl`. Für Bluesky geht es auch ohne Chrome über die API mit einem **App-Passwort** deines Kontos (du legst es an, es steht in `.env.local`, nie im Repository).
- **Als Skript** (zwei Tage Claude, wenn du es willst): `lab/kalender/post.ts` liest `freigegeben`-Einträge, deren Datum erreicht ist, und postet sie über die offiziellen Schnittstellen — Bluesky (frei), Mastodon (frei, kann auch `scheduled_at`), Threads (das eigene Konto ohne Prüfung). **Nicht X** (0,20 $ je Link-Post und das Pflicht-Label „Automated“, §5.4) und **nicht Pinterest** (Standard-Zugang mit Videoprüfung, und jeder Pin muss vom Menschen gewählt sein). **Das Skript startest du** (`npx tsx lab/kalender/post.ts`), oder ein Cron auf deinem Mac; es postet nur, was du im Werkzeug freigegeben hast, und schreibt `postedUrl` zurück. **Ohne Antworten, ohne Erwähnungen, ohne Suche** — nur die eigenen Beiträge.
- **Oder Buffer Free statt eines Skripts:** von Bluesky offiziell empfohlen, drei Kanäle (Bluesky, Mastodon, Threads), zehn geplante Posts je Kanal, keine Zeile Code. Du gibst im Kalender frei, ich stelle die Posts in Buffer ein (oder du), Buffer schickt sie. Für drei Posts die Woche reicht das, und es ist in einer Stunde eingerichtet. **Mein Vorschlag** (§5.4, Folge 2).
- **Nicht bauen, bevor es sich lohnt:** bei drei Posts die Woche ist Zuruf schneller als ein Skript, und Buffer schneller als beides.

### 5.4 Die Plattformen, Stand 2026-10-17 (Recherche eines Agenten, offizielle Quellen; Einzelheiten in [reichweite-recherche-2026-10-17.md](../reichweite-recherche-2026-10-17.md) §F)

| Plattform | Posten über die API, Hobby-Konto | Kosten | Freigabe | Kennzeichnung | Browser-Automatisierung |
|---|---|---|---|---|---|
| **X** | ja, aber **keine kostenlose Stufe mehr** (seit 2026-02-06 nur noch „Public Utility Apps“ frei; Basic seit 2026-06-01 abgeschafft) | **0,015 $ je Post, 0,20 $ je Post mit Link**; Lesen 0,005 $ | keine, Selbstbedienung | **Pflicht:** Label „Automated“ im Profil, Hinweis, wer das Konto betreibt, Link auf ein menschlich geführtes Konto | **Verstoß** gegen die AGB (2026-10-09): „permanent suspension“ |
| **Bluesky** | ja, offen | frei (5.000 Punkte/h, ein Post 3 Punkte) | keine | Bot-Label **freiwillig**, empfohlen; Interaktionen von Bots nur auf Einladung, sonst Spam | nicht geregelt (und unnötig, die API ist offen). **Buffer ist von Bluesky offiziell empfohlen** (Blog 2024-07-30); Buffer Free: 3 Kanäle, 10 geplante Posts je Kanal |
| **Mastodon** (mastodon.social) | ja, App ohne Prüfung; `scheduled_at` eingebaut | frei (300 Anfragen/5 min) | keine | Bot-Flag optional. **Regel 6 der Instanz: der Einsatz generativer KI muss offengelegt werden, Konten dürfen nicht nur KI-Erzeugtes posten** — ein von mir geschriebener Post dort sagt es, oder du schreibst ihn | nicht geregelt |
| **Threads** | ja, das eigene Konto als „Tester“ ohne App-Review | frei (250 Posts/Tag) | nur für fremde Konten | keine | Verstoß gegen Metas Nutzungsbedingungen. Eigene Planung in der App vorhanden |
| **Instagram** | ja, Creator- oder Business-Konto (100 Posts/Tag über die API) | frei | nur für fremde Konten | keine | Verstoß gegen Metas Bedingungen. Planung über die Meta Business Suite |
| **Pinterest** | **nur mit Standard-Zugang**: der Probezugang legt Pins nur in einer Sandbox an, die niemand sieht; Standard braucht einen Antrag mit Video des Anmeldeflusses, „even if you're the only user“ | frei | ja, ohne Frist | keine; **Richtlinie: „the end user must choose each Pin to be published“** — ein Skript, das Pins ohne menschliche Wahl setzt, verstößt | Verstoß. Eigene Planung: bis 30 Tage voraus, 10 in der Warteschlange |
| **TikTok** | praktisch nein: ungeprüfte Apps posten nur privat; die Prüfung erwartet eine App „for a wide audience“ | frei | Audit | keine | Scraping verboten, Posten per Oberfläche nicht genannt. Eigene Planung mit Business-Konto |
| **Reddit** | ja, nach Registrierung (100 Anfragen/min) | frei | Registrierung, „explicit approval“ | **Pflicht:** Konto als App gekennzeichnet; seit 2026-09-10 fallen unregistrierte Automaten aus den Empfehlungen | Verifizierungs-Aufforderungen, Label, Beschränkungen. **Für mich ohnehin tabu** |
| **LinkedIn** | Mitgliedsposts ja (150/Tag); Seiten nur für eingetragene Unternehmen | frei | keine | keine | Verstoß gegen die Nutzungsvereinbarung |
| **Tumblr** | ja, mit Warteschlange und `publish_on` | frei (250 Posts/Tag) | keine | keine | Verstoß |
| **Hacker News** | **keine Schreib-API**; „please don't automate posting“, „please don't use HN primarily for promotion“, **„Don't post generated text or AI-edited text“** | — | — | — | gegen die Regeln |

**Was daraus für uns folgt:**

1. **Auf X postet ein Mensch**, auf Zuruf oder selbst. Die API kostet 0,20 $ je Link-Post und verlangt das Label „Automated“ am Konto — das Schaufenster der Seite soll nicht „Automated“ heißen. Browser-Automatisierung ist dort die eine Sache, die das Konto kostet.
2. **Bluesky und Mastodon sind die Kanäle für eine Warteschlange**, ob als Skript (§5.3) oder über Buffer Free, das Bluesky selbst empfiehlt (3 Kanäle: Bluesky, Mastodon, Threads; 10 geplante Posts je Kanal — für drei Posts die Woche reicht das, ohne eine Zeile Code). Du gibst im Kalender frei, ich stelle ein, Buffer schickt. **Mein Vorschlag statt des Skripts, solange Pinterest nicht läuft.**
3. **Pinterest bleibt Handarbeit mit eingebauter Planung** (30 Tage voraus, 10 in der Warteschlange): zwei Pins am Tag heißt zweimal die Woche zehn Pins einstellen, aus einer Liste, die ich liefere. Ein Skript lohnt dort erst mit Standard-Zugang und wäre an der Richtlinie „jeder Pin vom Menschen gewählt“ ohnehin zu messen.
4. **Für HN, Web Curios und Lit Hub schreibst du den Text selbst.** Alle drei sagen es ausdrücklich; ich liefere Zahlen, Fakten und Links, keinen Satz. Das gilt auch für den Show-HN-Text im Formular, der zur Hälfte von mir ist. Auf Mastodon sagt ein Post, den ich geschrieben habe, dass ich es war — oder du schreibst ihn.
5. **TikTok und Reddit laufen nicht über eine Automatisierung**, aus verschiedenen Gründen: TikTok lässt eine Hobby-App nicht durch, Reddit kennzeichnet sie als App und ist für mich tabu.

---

## 6. Die Rechte-Frage, so dass sie heute entscheidbar ist

Die Frage steht seit dem 4.10. (PLAN-5.5-5.6 §6 Frage 1) und hält 30 Einträge, Pinterest, Instagram, TikTok und jede Ansprache fest. Sie ist deine. Hier nur, was jede Antwort freigibt und was sie kostet — nach [research-cover-prints.md](research-cover-prints.md), keine Rechtsberatung:

| Weg | Gibt frei | Was es kostet oder riskiert |
|---|---|---|
| **(a) Cover auf fremden Plattformen, mit Quellenangabe** | Pinterest (der einzige Kanal ohne Follower-Problem), Instagram, TikTok, Galerien, Antworten mit Bild — 30 Einträge | Eine neue Vervielfältigung je Bild; Risiko einer Abmahnung, bei Hobby-Reichweite gering, nicht null. Ein Wettbewerber-Vergleich: Verlage selbst pinnen ihre Cover zu Tausenden; Pinterest lebt davon. |
| **(a′) gebunden: Bilder der Seite, nicht der Cover** | Dasselbe wie (a), nur sind Pins und Posts **Bildschirmfotos einer Seite** (Sammlung, Wand, Jahrzehnte), also Cover im Kontext des Nachweises, wie auf der Seite selbst; ein einzelnes Cover nur als Antwort in einem Thread, der genau dieses Buch behandelt | Dasselbe Recht, aber derselbe Zusammenhang wie auf der Seite — die Begründung, die die Seite ohnehin für sich beansprucht (Nachweis der Ausgabe neben dem Weg zu ihr). **Mein Vorschlag.** Dazu: Credits, wo sie belegt sind; die Hinweisadresse der Seite auf jedem Profil; keine Ansprache von Gestaltern und Verlagen (deine Regel). |
| **(b) nur gemeinfreie Cover** | Das Instagram-Exposé (liegt fertig, fünf Cover vor 1931) und wenig sonst | Die Datenlage fehlt (Gestalter, Sterbejahr); [research-gemeinfreie-cover.md](research-gemeinfreie-cover.md): 7 frei, 15 unklar. Kein Kanal lässt sich damit füllen. |
| **(c) nur Links mit Vorschaukarte** | X, Bluesky, Mastodon, Reddit, HN — was heute läuft | Gilt seit dem 4.10. ohne Entscheidung. **Merke:** jede Vorschaukarte zeigt bereits Cover (die Karte der Startseite, der Sammlungen, des Shelf-Portraits) — die Plattform holt sie von der Seite, aber sichtbar sind sie dort seit dem 5.10. (c) ist also kein Zustand ohne Cover auf fremden Plattformen, nur einer ohne Pinterest. |

**Eine Zeile genügt:** „a“, „a′“, „b“ oder „c“. Bei (a) oder (a′) kommen 5.5a (Pin-Format, ein halber Tag) und das Pinterest-Konto (20 Minuten, PLAN-5.5-5.6 §7) als Erstes.

---

## 7. Zwölf Wochen, drei Schichten

**Schicht 1 — täglich, 15 Minuten (Julian), der Zettel (Claude):** Antworten nach §5.2. Beginn: sobald du §9.3 beantwortet hast (Bluesky allein geht ab morgen).

**Schicht 2 — wöchentlich, ein Abend (Julian), Material (Claude):** eine Sammlung als Geschichte — Bild, ein Satz (§4), auf X, Bluesky, Mastodon derselbe; bei (a)/(a′) dazu Instagram und fünf Pins. Reihenfolge der Sammlungen aus PLAN-5.6b §4, Texte neu nach §4.2.

**Schicht 3 — einmalig, die Baugeschichte:**

| Wann | Was | Wer | Voraussetzung |
|---|---|---|---|
| Woche 1 (bis 24.10.) | **Entscheidungen §9**; 3.1i (Bot-Filter); erster Antwortzettel; **X-Thread (13 Teile) vom persönlichen Konto**, am Ende das Shelf-Portrait und die Seite; derselbe Text als Kommentar im „Built with Claude“-Megathread von r/ClaudeAI (`reddit-claudeai`, liegt fertig) | Julian; Claude 3.1i und Zettel | §9.2; Reddit-Konto hat zehn Tage |
| Woche 1–2 | **Vier Mails und ein Formular, an Leute, die keine Rechteinhaber sind** (§11, Recherche A–C): **Open Library** (openlibrary@archive.org — „Friends using Open Library APIs“ auf ihrer Entwicklerseite, dazu drei Minuten „Open Mic“ im Community Call dienstags 9 Uhr Pacific; ihr Konto @archive.org hat 435.000 Follower), **Web Curios** (matt@webcurios.co.uk, bittet Macher ausdrücklich um Links; will keinen KI-Text — dein Text), **Kottke** („send it along“), **Shelf Awareness „Book Candy“** (575.000 Leser; Adresse noch zu finden), **MetaFilter Projects** (5 $, der eine Ort, an dem Selbstlinks erlaubt sind). Claude baut je Empfänger das Dossier: welche Seite, zwei Sätze in deiner Stimme, die Zahlen vom Tag | Julian schreibt und schickt; Claude Dossiers | §9.5 |
| Woche 2–3 | **Show HN**, sobald das Konto darf (Karma aus Kommentaren; sonst reicht jemand mit älterem Konto den Link ein — erlaubt, Stimmen organisieren nicht); **mit Daten-Winkel im Titel** (HN gab Cover-Galerien 1–3 Punkte, „HN's favorite books mapped“ 285, §11), **in deinen eigenen Worten** (HN: „Don't post generated text or AI-edited text“ — der Text im Formular ist zur Hälfte meiner, §5.4), am selben Tag nichts sonst. r/SideProject und r/vibecoding (`reddit-vibecoding`) in der Woche danach. **Vorher:** ein Titelseitentag sind 700–12.000 Besucher; 500 kalte Buchseiten leeren das Google-Kontingent (1.000 am Tag) bis Mittag — danach gilt der Katalog-Fall (1.12), der hält; ob Open Library die Vercel-Adresse bei Hunderten Anfragen je Stunde sperrt, ist **nicht geprobt** (2.18e/i) | Julian | HN-Konto; 2.18 |
| Woche 2–4 | **Pinterest-Start** bei (a)/(a′): Konto, Website bestätigen, 5.5a, zwei Pins am Tag aus Sammlungen und Jahrzehnten; die OG-Angaben der Seiten ergeben ohne Code „Article Rich Pins“ (§11 E, am ersten Pin prüfen) | Julian 20 min + Pins; Claude 5.5a und Pin-Liste | §6 |
| Woche 3–6 | **Deutsch:** 5.18b durch `t()`, dann das Shelf-Portrait in deinem Umfeld (WhatsApp, Freunde, deutsches Bookstagram/BookTok, wenn du dort jemanden kennst) — zehn Leute, die eins bauen und selbst posten | Claude Übersetzung; Julian | §9.8 |
| Woche 8 (≈ 12.12.) | **Auswertung** nach §8; was nicht trägt, fällt | beide | 3.1i |
| Woche 9–12 | Weiter nur mit dem, was trägt; 6.107 (Suche) läuft nebenher | | |

**Gestrichen oder geparkt:** Product Hunt (dein „kann weg“), TikTok-Clips (erst wenn Pinterest und Instagram tragen; Clips liegen), Blogger-Mails an Gestalter und Verlage (deine Regel), MetaFilter Projects (ein Konto, ein Post im Monat — möglich, klein; bei Gelegenheit).

---

## 8. Messen

- **Was zählt:** Einstiege je Kanal (K16, nach 3.1i), ob ein Buch geöffnet und ein Händler besucht wurde; für Antworten die Aufrufe unter dem Beitrag (öffentlich lesbar) und `via=x`/`via=bluesky`.
- **Schwellen** aus PLAN-5.5-5.6 §5 unverändert (Pinterest 80 Pins, 8 Wochen, ≥ 50 Besuche/Woche; Reddit ≥ 1 Händlerklick je 3 Antworten; HN ≥ 10 % öffnen ein Buch). **Neu, für Antworten:** nach vier Wochen ≥ 5 Besuche je zehn Antworten (`via` oder Referrer), sonst andere Threads, nicht mehr Antworten.
- **Was nicht zählt:** Follower, Likes, Vercels Besucherzahl.
- **Bot-Tage** stehen in der Ansicht als solche (3.1i); bis dahin je Zahl der Blick auf `vercel metrics … --group-by clientUserAgent`.

---

## 9. Entscheidungen, alle deine — eine Zeile je Punkt

1. **Rechte:** a, a′, b oder c (§6).
2. **Persönliches Konto** als Absender der Baugeschichte (X-Thread, HN, r/ClaudeAI): ja/nein; wenn ja, welches Konto, und ob @buyitscovers den Thread zitiert.
3. **Antwortzettel:** Bluesky allein (ohne Login, ab morgen) oder auch X (dein Chrome mit X-Login, oder du bist am Rechner, wenn ich suche)?
4. **Posten:** auf Zuruf im Chat (jetzt) — und für die geplanten Posts auf Bluesky, Mastodon und Threads: Buffer Free (eine Stunde, kein Code; mein Vorschlag) oder das eigene Skript (zwei Tage)?
5. **Ansprache außerhalb deiner Regel vom 7.10.** — Open Library („Friends using Open Library APIs“, Open Mic), Web Curios, Kottke, Shelf Awareness, MetaFilter Projects: alles Leser- oder Partner-Adressen, keine Gestalter, Verlage oder Design-Blogs. Ja/nein, und welche. (Casual Optimist, Spine, Fonts In Use, Slanted sind Design-Adressen und warten auf §9.1.)
6. **Show HN:** darf dein Konto inzwischen posten? Falls nein: Karma sammeln oder einreichen lassen?
7. **Stilblatt §4:** welche der zwölf Zeilen gehen, welche nicht — danach die 87 Kalendertexte.
8. **Deutsch zuerst** fürs Shelf-Portrait (Voraussetzung für §3.6)?

Ohne Antwort gilt: (c), kein persönliches Konto, Zettel nur Bluesky, Zuruf, keine Mail, HN wartet, Kalendertexte bleiben, Englisch.

**Entschieden am 2026-10-17 abends (Julian, im Chat durchgegangen):**
1. **Rechte: (a)** — Cover auf fremden Plattformen mit Quellenangabe. Damit sind Pinterest, Instagram, TikTok, die Galerien und die 30 Kalendereinträge frei; 5.5a (Pin-Format) und das Pinterest-Konto kommen als Erstes; `rechte` steht im Kalender unter „Erfüllt“.
2. **Persönliches Konto: ja** — die Baugeschichte (X-Thread, r/ClaudeAI, Show HN) kommt von Julians eigenem Konto, @buyitscovers zitiert.
3. **Antwortzettel: nur auf Zuruf**, nicht täglich; Bluesky über die API, X über Julians Chrome, wenn er es sagt.
4. **Posten: Zuruf + Buffer Free** für die geplanten Beiträge auf Bluesky, Mastodon und Threads; kein eigenes Skript.
5. **Ansprache:** Julian wollte zuerst die Links sehen (geschickt am 2026-10-17: Open Library Entwicklerseite und Community Call, Web Curios Kontakt, Kottke About, Shelf Awareness, MetaFilter Projects); Entscheidung offen.
6. **Show HN: erst Karma sammeln**, dann mit Daten-Winkel und eigenem Text.
7. **Stilblatt: Claude schreibt die 87 Kalendertexte neu**, in der Stimme von „don't gatekeep the editions“ (Historie 2026-10-17), in Zehnerpaketen; Julian streicht.
8. **Deutsch fürs Shelf-Portrait: ja**, Übersetzung vorziehen (5.18b, offen 1).


---

## 10. Was aus dem Kalender wird

Das Werkzeug bleibt; `posts.json` ist weiter die eine Liste. Nach §9: die 87 Vorschläge in der Stimme aus §4 neu geschrieben, die Daten an den Start der Schichten angepasst, Antworten als `kind: answer` je Tag statt „Antwort-Fenster, höchstens drei“ je Woche, Product Hunt gestrichen, `mastodon` bekommt eine eigene Klasse in `VIA` (offen seit 5.6b). Die Hinweise des Werkzeugs (zu lang, Vollständigkeitswörter, Exposé zuerst) bleiben; neu: ein Hinweis auf Quellenangaben und Erklärsätze im Post (S5).

---

## 11. Was die Recherche von heute ergab

Vollständig mit Quellen und Datum in [docs/reichweite-recherche-2026-10-17.md](../reichweite-recherche-2026-10-17.md); hier, was die Strategie oben trägt.

- **Die Cover-Gemeinde ist klein und sitzt bei wenigen Leuten:** The Casual Optimist (monatliche „Book Covers of Note“, Bluesky 179 Follower), Spine (nimmt Artikelvorschläge), Lit Hub (Emily Temples Monatsliste, Pitches ohne KI-Text), Fonts In Use (Beiträge mit Quelle, dauerhafte Links), Penguin Collectors Society (400–500 Mitglieder), auf Bluesky die Vintage-Konten Pulp Librarian (11.845) und 70s Sci-Fi Art (22.190) — **ein Cover, eine Zeile, täglich, über Jahre**. Book Cover Archive und 50 Watts ruhen. Tumblr und Discord: nichts. Casual Optimist, Spine, Fonts In Use und Slanted sind Design-Adressen und fallen unter deine Regel vom 7.10.; die Antwort unter einen Pulp-Librarian-Thread mit der passenden Wand fällt nicht darunter.
- **Open Library ist der eine Partner, den niemand sonst hat:** die Entwicklerseite führt „Services using Open Library APIs“ („Are you using the Open Library APIs? We'd love to hear about it! Please email us at openlibrary@archive.org“) und einen Link, um den eigenen Use-Case zu registrieren; der wöchentliche Community Call endet mit „Open Mic“, und @archive.org hat auf Bluesky 435.000 Follower. **Ihre Usage Guidelines, am 2026-10-17 im Wortlaut gelesen** (Julian: „verstoßen wir gegen ihre regel?“): die APIs sind „not intended to serve as a data backend for third-party services“ und nicht für „bulk data backend or high-traffic commercial infrastructure“; bevorzugt werden u. a. „Book tools & services that facilitate lookup for humans“; erbeten sind Anfragen „on behalf of human users“, Caching und ein User-Agent mit E-Mail; 3 Anfragen je Sekunde für identifizierte Apps, 1 für anonyme; „Violations may result in aggressive rate limiting or blocking.“ **Die Seite erfüllt die drei Bitten** (jede Anfrage folgt einem Leser, Next-Cache, `userAgent` in `lib/seo.ts` mit Adresse und Kontakt) und ist die bevorzugte Art von Dienst. **Eine Lücke:** über die offene Route `/api/works` hat der Scraper am 16./17.10. fast 10.000 Mal Ausgabendaten geholt, jede Anfrage ging von unserem Server an Open Library — in diesen Stunden waren wir unfreiwillig das „backend for a third party“ und sicher über 3 je Sekunde. 2.18f hält seitdem nur Google zurück; **die Daten-Routen sollten Abrufen, die nicht von einer eigenen Seite kommen, auch die Katalog-Antwort verweigern** (Ergänzung zu 2.18f), und 2.18e (Drossel in Richtung Katalog) rückt vor. Google Books hat nichts dergleichen.
- **Die Link-Kuratoren laden ein:** Web Curios („especially if you've made something you'd like me to feature“, kein KI-Text), Kottke („send it along“), MetaFilter Projects (Selbstlinks erlaubt, moderiert, 5 $). Shelf Awareness erreicht 575.000 Leser, der Weg ist ungeprüft. Dense Discovery (38.000) und Sidebar (60.000) haben keinen offenen Einreichweg.
- **Show HN** bringt 700–12.000 Besucher an einem Titelseitentag, aber Cover-Galerien bekamen dort 1–3 Punkte, Daten-Visualisierungen zu Büchern bis 285; die Behauptung „2,3 % erreichen die Titelseite“ ist unbelegt. Also ein Daten-Winkel im Titel und die Kontingent-Frage vorher (§7). **Product Hunt**: 1–3 k Besuche für einen Top-3-Tag, braucht mobilisierbares Publikum — bleibt gestrichen.
- **Was Vergleichbare gewachsen hat:** my9albums (387.929 Poster am 17.10., kein HN, nur soziale Netze und persönliche Posts, dann Presse); StoryGraph von 1 k auf 20 k Nutzer in drei Tagen durch Tweets einer Verlagsfigur und eine Leserin — **ein nutzergemachtes, teilbares Artefakt plus eine Geschichte**; Bookshop.org über 50.000 Partner — **die Partner waren die Verbreitung**; Shelfie (Regalfoto-App) blieb unter 50.000 Downloads — ein Regalfoto allein trägt keine App. Das Shelf-Portrait hat zwei generische Rivalen (9things.me mit Open Library, pi.fyi); sein Unterschied bleibt die Ausgabe.
- **Pinterest:** jeder Pin trägt seit 2023 einen Link; die OG-Angaben der Seiten ergeben ohne Code Article Rich Pins; keine Verlagszahlen 2026 zu ausgehenden Klicks, der Suchraum ist ohne Konto nicht messbar. Also: anfangen und nach acht Wochen messen, wie PLAN-5.5-5.6 §5 es vorsieht — nicht vorher einschätzen.
