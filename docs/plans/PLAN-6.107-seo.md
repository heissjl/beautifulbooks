# PLAN 6.107 — Auffindbarkeit für eine junge Seite

Julian, 2026-10-10, zum Red-Team-Befund K4: „ok, mache einen plan zur umsetzung“, dann: „ich glaube man kann hier noch nicht viel messen, weil wir kaum traffic haben. eher nochmal eine webrecherche machen, was wichtig für kleine neue seiten ist“. **Neu gefasst nach der [Recherche vom 2026-10-10](../seo-recherche-2026-10-10.md)**, die erste Fassung (Messen zuerst, Autorenseiten, mehr Einstiege) ist überholt.

**Status (2026-10-31):** Schritt 0 gelesen (§ 0), Schritt 1 gebaut (2026-10-10), Schritt 6 gebaut (2026-10-14). Schritte 2, 3 und 8 kann Claude ohne Entscheidung bauen, Schritt 2 zuerst; Schritt 4 entscheidet Julian (die Zahlen sprechen für (a)); Schritt 5 ist zur Hälfte Julians Hand (Bing).

## 0. Was die Search Console nach vier Wochen sagt (Schritt 0, gelesen 2026-10-31)

Alle Zahlen mit Zeitraum in der [Historie](../history.md) (2026-10-31, „Vier Wochen Sitemap“). Die Kurzfassung, Leistung 3.–29.10.2026, Index Stand 23.10.: **5 Klicks, 116 Impressionen, Position 27,6**, 34 benannte Anfragen ohne einen Klick (die Klicks liegen auf anonymisierten), **208 indexiert, 201 nicht**. Von den 131 Adressen der Sitemap sind 71 indexiert — 65 von 68 Jahrzehnte-Seiten, aber nur **3 von 59 Sammlungen**; die anderen 56 und `/collections` stehen seit dem 10.10. auf „Discovered – currently not indexed“, **nie gecrawlt**. Daneben sind 136 Buchseiten indexiert, die in keiner Sitemap stehen (106 davon unter `?cover=`), gefunden über Links. Zwei externe Links auf die ganze Domain. Bing ließ sich nicht lesen (in Chrome nicht angemeldet).

Was das für jeden Schritt heißt:

- **Schritt 1 (Sitemap beschränkt, gebaut 10.10.) — bestätigt, aber nicht hinreichend.** Google liest die Sitemap (zuletzt 29.10.) und kennt jede Adresse; die Jahrzehnte-Seiten daraus sind zu 96 % im Index. Die Sammlungen aber hat die Sitemap nur *bekannt* gemacht — 27 Tage reichten nicht, dass Google eine einzige der 56 abruft. Eine Sitemap ist eine Bitte; abgerufen wird, was verlinkt ist. Nichts zurückdrehen.
- **Schritt 2 (Sammlungen als Hub-Seiten) — die Zahlen sprechen am stärksten dafür, mit einer Verschiebung des Schwerpunkts.** Die eine Sammlung im Index (SF Masterworks) ist mit 20 Impressionen und 1 Klick die zweitbeste Seite der Property und steht für „gollancz masterworks“ (1,0), „gollancz sf masterworks“ (4,0), „gollancz dune“ (4,0), „sf masterworks covers“ (10,3) auf Seite 1 — Reihen-Anfragen tragen. Der Engpass ist aber nicht Titel oder Text, sondern dass Google die anderen 58 Sammlungen nicht abruft. Darum zuerst **die Verlinkung**: jede Buchseite eines Sammlungs-Werks verlinkt ihre Sammlung (das war Teil 3 des Schritts, wird Teil 1), die Startseite und die Fußzeile verlinken `/collections` (unter den meistverlinkten internen Seiten stehen heute Start, About, Versus, Shelf-Portrait — keine Sammlung), und Julian beantragt in der Search Console die Indexierung der stärksten zehn Sammlungen von Hand (URL-Prüfung, ~10 am Tag). Dann Titel, `ItemList`, `related`.
- **Schritt 3 (Bild-SEO) — dafür.** 29 von 34 Anfragen heißen „<Titel> (book) cover(s)“: die Leute suchen das Bild. Die Buchseiten stehen für diese Anfragen auf Position 40–55, weil die Seite zu dem Wort „cover“ wenig Text hat; Alt-Texte mit Titel, Verlag, Jahr, Gestalter und Bildunterschriften geben ihr die Worte, die Bild-Sitemap zeigt Google die Cover (Googlebot-Image heute 4 % der Abrufe). „Suchdarstellung“ hat noch keine Daten.
- **Schritt 4 (Sprachfrage) — die Zahlen sprechen für (a).** Keine der 34 Anfragen ist deutsch; Deutschland hat 7 Impressionen und 2 Klicks bei Position 3,0 (Navigations- oder Bekannten-Suchen, nicht Themen-Suchen). Eine italienische Anfrage (copertine di lolita), 9 Impressionen aus Brasilien: fremdsprachige Nachfrage gibt es, klein, und nicht auf Deutsch. (b) würde die Sitemap verdoppeln, während die vorhandene nicht gecrawlt wird — nicht jetzt.
- **Schritt 5 (Anmelden, Indexquote) — Google-Hälfte erledigt, Bing offen.** Indexquote je Typ steht oben. Bing Webmaster Tools braucht Julians Anmeldung in seinem Chrome (zehn Minuten: Leistung, indexierte Seiten, Sitemap-Status, „AI Performance“); danach kann Claude dort lesen.
- **Schritt 6 (Crawler, gebaut 14.10.) — kein Befund dagegen.** 10,4 k Googlebot-Abrufe für ~400 bekannte Adressen (57 % Refresh), 138 ms Antwortzeit, 99 % 200 — Google crawlt reichlich, nur nicht die Sammlungen. Vercel-Challenges für Bing oder OAI-SearchBot (K14) nicht hier prüfbar.
- **Schritt 7 (Erwähnt werden) — die Zahlen zeigen den eigentlichen Engpass.** Zwei externe Links (bookshop.org, reddit.com) auf die ganze Domain. Ohne Links von außen bleibt der Crawl-Budget-Anteil der Sammlungen, was er ist; jede Erwähnung einer Sammlung ist zugleich ein Grund für Google, sie abzurufen.
- **Neu, Schritt 8: die `?cover=`-Adressen entscheiden (2 h, Claude; Richtung Julian).** 106 Adressen `/book/<id>?cover=…` sind trotz Canonical auf `/book/<id>` als eigene Seiten indexiert, 130 weitere derselben Form folgen der Canonical, 2 gelten als Duplikat ohne Canonical. Google wählt selbst, weil die Seite mit `?cover=` ein anderes Cover groß zeigt. Zwei Wege: **(a)** die Cover-Adresse wird eine echte Seite — Canonical auf sich selbst, Titel „<Werk> — the <Jahr> <Verlag> cover“, Beschreibung mit dem Credit, wo er gesichert ist; das trifft die Anfragen „<Titel> cover“ und macht aus jedem gesicherten Cover eine findbare Seite (aber viele dünne Seiten — die Recherche in § 1 warnt genau davor; also nur für Cover mit Credit oder in einer Sammlung); **(b)** das serverseitig gerenderte HTML wird für jedes `?cover=` gleich (das gewählte Cover erst im Browser groß), damit die Canonical hält und die Buchseite ihre Signale bündelt. Empfehlung: (b) jetzt, (a) als Teil von Schritt 2 nur für Sammlungs-Cover mit Credit.
- **5.2 (Seite 0 serverseitig rendern) — der Auslöser aus 2.16 ist nicht eingetreten:** eine einzige Buchseite steht auf „Crawled – currently not indexed“ (`/book/OL15587256W`), 136 sind indexiert. 5.2 bleibt zurückgestellt.
- **Nächstes Lesen:** Ende November 2026, dieselben Tabellen; dann zeigt sich, ob die Verlinkung (Schritt 2) die Sammlungen in den Crawl gebracht hat. Nicht öfter — die Zahlen sind klein, die Kurven wackeln.

## 1. Was die Recherche verschiebt

- **Google bewertet die ganze Seite.** Viele schwache, datengetriebene Seiten früh im Index können der jungen Domain schaden (Mueller, Sept. 2026: programmatische Seiten „often … spam, borderline spam, or low quality“, Erholung „takes time“). Die Sitemap listet heute **500 Buchseiten und 322 Jahrzehnte-Seiten** neben ~60 Sammlungen — die Gewichte stehen falsch herum.
- **Das Kapital sind die Sammlungen**: eigener Text, eigene Auswahl, Credits. Sie sind die Hub-Seiten; Buchseiten hängen darunter.
- **Messen geht noch nicht** (Julian): zu wenig Verkehr für Zahlen über Anfragen. Was trotzdem geht: die **Indexquote je Seitentyp** in der Search Console — ob Google die Seiten überhaupt aufnimmt, braucht keine Besucher.
- **Die deutsche Fassung ist für Google unsichtbar** (Cookie unter derselben Adresse); das ist eine Entscheidung, kein Fehler, solange sie bewusst ist.
- `lastmod: now` in der ganzen Sitemap ist wertlos (Google) und falsch (Bing).

## 2. Die Schritte

**1. Sitemap auf das Starke beschränken, mit echtem `lastmod` (2 h, Claude).**
- Drin: Start, About, `/collections`, jede veröffentlichte Sammlung, und **nur die Buchseiten der Werke, die in einer veröffentlichten Sammlung stehen** (die Sammlung verleiht ihnen Kontext). Jahrzehnte-Seiten nur für diese Werke.
- Draußen: die übrigen Index-Werke und ihre Jahrzehnte-Seiten (sie bleiben erreichbar und verlinkt — Google findet sie über Links, wenn es will; wir drängen sie nur nicht auf), das Spiel, Kontakt, Datenschutz.
- `lastmod`: für eine Sammlung das Datum ihrer letzten Änderung (der Entwurf trägt `updatedAt`; die Datei das Commit-Datum), für eine Buchseite das der Sammlung, für die festen Seiten das Datum der letzten Textänderung (eine Konstante im Code, die beim Ändern mitzieht). Nie „jetzt“.
- Nicht `noindex` auf die übrigen Buchseiten setzen: sie haben eigene Leistung (Faltung, Urteil) und sollen findbar bleiben, wenn jemand auf sie verlinkt. Die Recherche rät zu weniger *Drängen*, nicht zu Verstecken.

**2. Die Sammlungen als Hub-Seiten (halber Tag, Claude; Texte Julian).**
- `<title>` und `description` so, wie gesucht wird: Reihe, Zahl, Zeitraum, Gestalter („SF Masterworks: the 73 covers of the first run, 1999–2007“). Die Zahl ist die gezählte.
- Ein paar Sätze eigener Text oben — die meisten Sammlungen haben ihn schon (`intro`); wo er fehlt, schreibt Julian ihn (Liste der Sammlungen ohne Intro aus `data/collections.json`).
- Jede Buchseite eines Werks in einer Sammlung verlinkt zurück („In SF Masterworks, No. 12“) — 6.9, nur dieser Teil.
- Strukturierte Daten `CollectionPage` mit `ItemList`.
- „See also“ zu zwei, drei verwandten Sammlungen, aus einem Feld `related`, von Julian gesetzt.

**3. Bild-SEO für die Cover (2 h, Claude).**
- Alt-Text jedes Covers auf Sammlungs- und Buchseiten: Titel, Verlag, Jahr, Gestalter wo gesichert („The Forever War, Millennium 1999, cover by Chris Moore“). Heute prüfen, was `alt` trägt.
- Bildunterschrift mit dem Credit, wo er steht (Sammlungen haben `Cover: …` schon).
- Bild-Sitemap für die Sammlungsseiten (`image:image` mit den Cover-URLs; fremde Domains sind erlaubt).
- `ImageObject` mit `creditText` nur bei gesichertem Credit; **nie** `license` oder `acquireLicensePage` — die Seite hält keine Rechte.

**4. Die Sprachfrage (Julian entscheidet).**
- (a) **Bewusst nur Englisch im Index** — so wie heute; nichts zu tun außer es in SPEC E23 festzuhalten. Die deutschen Leser kommen über Links und Teilen, nicht über die Suche.
- (b) **`/de/…` öffentlich mit `hreflang`** — jede Seite hat eine deutsche Adresse, beide tragen `hreflang="en"`/`"de"` und `x-default`, das Cookie wählt nur noch, wohin der Sprachschalter führt; keine automatische Umleitung nach `Accept-Language`. Das ersetzt den Spiegelbaum nicht, sondern macht ihn sichtbar; Aufwand ein Tag, und die Sitemap verdoppelt sich (dann wieder Schritt 1 bedenken). Lohnt nur, wenn deutsche Suchen ein Ziel sind.
- Empfehlung: (a) jetzt, (b) wenn deutsche Sammlungen (edition suhrkamp, Insel) Leser bringen sollen.

**5. Anmelden und Indexquote ansehen (Julian, 20 min).**
- Search Console (schon verifiziert?) und **Bing Webmaster Tools** (Import aus der Search Console geht in einem Schritt) — Sitemap einreichen.
- In drei Wochen: Indexquote je Seitentyp (Sammlungen, Buchseiten, Jahrzehnte). Bleiben Sammlungen draußen, ist das ein Qualitätssignal für die ganze Seite.

**6. Crawler prüfen (1 h, Claude).**
- `OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot` stehen heute in `BOUNDED_CRAWLERS` (nur kuratierte Buchseiten, 10 s Abstand) — für die *Such*-Crawler (anders als `GPTBot`, `CCBot`, die trainieren) ist das zu eng, wenn die Seite in KI-Antworten zitiert werden soll: Such-Bots bekommen die allgemeinen Regeln, Trainings-Bots bleiben begrenzt. Julian entscheidet, ob Training ganz gesperrt wird.
- Prüfen (K14, `/admin/insights`), ob Bingbot oder OAI-SearchBot je eine Vercel-Challenge bekamen.

**7. Erwähnt werden (Julian, laufend).** Je Sammlung eine Gemeinschaft oder ein Blog, wo sie Thema ist; Gestalter und Verlage auf ihre Wand hinweisen. Kein Linktausch, keine Verzeichnisse, kein llms.txt.

## 3. Was nicht gemacht wird

Keine Schlagwort-Seiten, keine Autorenseiten mit eigener Adresse (vorerst — sie vervielfachen dünne Seiten), kein llms.txt, keine KI-Schema-Tricks, kein `license` an fremden Covern, kein Feinschliff an Core Web Vitals, keine Vollständigkeitsworte.

## 4. Julian entscheidet

1. Sprachfrage: (a) nur Englisch im Index, oder (b) `/de/` öffentlich mit `hreflang`?
2. Such-Crawler der KI-Dienste auf die allgemeinen Regeln heben, Trainings-Crawler begrenzt lassen oder sperren?
3. Bing Webmaster Tools anmelden?
4. `related` je Sammlung und die fehlenden Intros: wann?
5. Schritt 8: `?cover=`-Adressen bündeln (b) oder zu echten Seiten machen (a)? Empfehlung (b) jetzt. (2026-10-31)

## 5. Bauplan für Schritte 2, 3 und 8 (2026-10-31)

Julian, nach der Lesung in § 0: „mach einen genauen plan hierfür“. Drei Teile, in dieser Reihenfolge; jeder Teil ein eigener Commit und ein eigener Blick in die Search Console Ende November. **Was gemessen wurde, steht in § 0; was hier steht, ist der Bau.** Gegen den Code geprüft am 2026-10-31: die Buchseite setzt Canonical, Titel und Beschreibung ohne Blick auf `?cover=` (`app/book/[id]/page.tsx`, `generateMetadata`); die Sammlungskacheln verlinken trotzdem `?cover=` (`components/CoverWall.tsx` Zeile 62: `/book/<id>?cover=ol:<n>`), und die Cover-Seite `/book/<id>/cover/<coverId>` zeigt mit ihrer Canonical auf die Werkseite; eine Buchseite nennt heute **keine** Sammlung, in der ihr Werk steht; die Fußzeile verlinkt `/collections` nicht; `/collections` hat einen Satz Einleitung und je Sammlung zwei Zeilen Intro.

### Teil A — die Sammlungen in den Crawl bringen (Schritt 2, ein Tag Claude, zehn Minuten am Tag Julian)

**Gebaut 2026-10-31, A 1–4** (Historie; Julian: „bau Teil A“). Abweichungen vom Plan: A 2 war durch 6.110g schon da; die Gruppe ist ein eigenes Feld `group` (`series | designers | lists | publishers`) statt `kind`/Tags, weil `kind` die Grenze der Sammlung (Autoren oder Verlage) beschreibt, nicht ihren Platz auf dem Hub; der Block steht auch im Lade- und Fehlerzweig der Buchseite, damit der Server die Links liefert. A 5 und A 6 stehen aus.

Der Befund: Google kennt 59 Sammlungen aus der Sitemap und hat 56 nie abgerufen; abgerufen wird, was verlinkt ist. Heute führen zu einer Sammlung nur die Startseite (`SHELF_MAX` Kacheln) und `/collections`.

1. **„In these collections“ unter der Wand jeder Buchseite** — der Hebel, weil 136 Buchseiten im Index sind und jede davon Google zu ihren Sammlungen führt. Server: `collectionsOfWork(workId)` in `lib/collections-live.ts` (nur veröffentlichte, über `liveCollections()`, damit Entwürfe nicht verlinkt werden); die Buchseite reicht die Liste als Prop an `BookDetail` (wie `walls`; `lib/collections.ts` darf nicht in eine Client-Komponente, CLAUDE.md). Darstellung wie „More by …“ (6.53): Serifenüberschrift, je Sammlung Name und Zahl der Bücher, Link ohne Parameter. Bei null Sammlungen nichts. Jahrzehnte-Seite und Cover-Seite bekommen denselben Block.
2. **Die Fußzeile verlinkt `/collections`** (und `/about`, falls noch nicht) — heute keine Sammlung unter den meistverlinkten internen Seiten (§ 0).
3. **`/collections` wird eine Hub-Seite:** je Gruppe (Reihen, Gestalter, Preise und Listen, Verlage) eine Überschrift und drei Sätze eigener Text in der Stimme der Seite (keine Vollständigkeitsworte), darunter die Sammlungen der Gruppe; am Fuß ein Register aller veröffentlichten Sammlungen als schlichte Textliste (59 Links, für Google der sicherste Weg). Die Gruppen stehen im Datenfeld `kind`/Tags der Sammlungen — fehlt ein Feld, kommt es in `lab/collections/` dazu, nicht in den Code.
4. **Die Startseite** behält ihre Kacheln; die Überschrift „Collections“ bleibt der Link, dazu unter den Kacheln eine Zeile „59 collections“ als Link auf den Hub.
5. **Julian, Search Console:** URL-Prüfung → „Indexierung beantragen“ für `/collections` und die zehn Sammlungen mit den meisten Büchern (zehn Anträge am Tag sind das Limit), eine Woche lang. Das ist die einzige Hand, die Google direkt bewegt.
6. **Messen:** Ende November die Liste „Discovered – currently not indexed“: Ziel ist, dass die Sammlungen dort verschwinden und unter „Indexed“ auftauchen; dazu Impressionen je Sammlungsseite. Vorher keine Zahl deuten.

### Teil B — die `?cover=`-Adressen bündeln (Schritt 8, zwei Stunden, Richtung (b), Julians Ja)

Der Befund: 106 `?cover=`-Adressen im Index als eigene Seiten, obwohl die Canonical auf die Werkseite zeigt — Google folgt ihr nicht, weil die Seiten anders aussehen (ein anderes Cover groß) und weil die Sammlungskacheln genau diese Adressen verlinken.

1. **Interne Links tragen kein `?cover=` mehr.** `CoverWall.tsx`: eine Sammlungskachel verlinkt `/book/<id>/cover/<coverId>` (die Seite gibt es, mit eigener Vorschaukarte) statt `/book/<id>?cover=…`. Die Teilen-Links und die Shelf-Portrait-Kaufliste ebenso. `?cover=` bleibt als Zustand der Oberfläche (6.5, die URL als Quelle der Wahrheit) und in geteilten Links von Lesern — nur die Seite selbst setzt ihn nicht mehr in Links.
2. **Die Cover-Seite bekommt eine eigene Canonical nur, wo sie etwas Eigenes sagt:** steht das Cover in einer veröffentlichten Sammlung mit Credit (`withFileFacts`), ist `/book/<id>/cover/<coverId>` eine echte Seite — Canonical auf sich selbst, Titel „<Titel> — the <Jahr> <Verlag> cover by <Gestalter>“, Beschreibung mit dem Credit; sonst bleibt die Canonical auf der Werkseite (wie heute). Das ist (a) im kleinen, nur für Cover mit Beleg, und erfüllt § 1 (keine dünnen Seiten).
3. **Nichts an `?cover=` selbst**: kein `noindex` (widerspräche der Canonical), keine Weiterleitung (bräche jeden geteilten Link). Google konsolidiert, sobald die Links weg sind; das dauert Wochen.
4. **Test:** `lib/__tests__/seo.test.ts` prüft die Canonical der Cover-Seite in beiden Fällen; `go-words` unberührt. Analytik-Checkliste Punkt 4: die Signale lesen `/book/`-Links der Ergebniskarten — die ändern sich nicht; `originOf` kennt die Cover-Seite als Buchseite (prüfen, sonst `book`).

### Teil C — die Worte, nach denen gesucht wird (Schritt 3, ein halber Tag, Julian wählt den Titel)

Der Befund: 29 von 34 Anfragen heißen „<Titel> (book) cover(s)“; die Buchseiten stehen dafür auf Position 40–55, die Jahrzehnte-Seiten bei 22.

1. **Titel der Buchseite** (`workPageTitle` in `lib/seo.ts`, heute „The covers of <Titel> by <Autor>“): Vorschlag „<Titel> by <Autor> — book covers by language and year“; Titel voran, weil die Anfrage mit dem Titel beginnt, und „book covers“ wörtlich. Jahrzehnte-Seite: „<Titel> book covers by decade, <erstes> to <letztes>“ (die Pin-Liste 5.5a schreibt den Satz schon so). Sammlung: „<Name> — <n> book covers“. Ein Test in `seo.test.ts` hält die Form; die Vollständigkeitsworte bleiben verboten.
2. **Alt-Text je Kachel** (`CoverWall.tsx` Zeile 71 sagt heute „<Titel> by <Autor>“): „<Titel>, <Verlag> <Jahr> cover“ und, wo belegt, „by <Gestalter>“ — Verlag und Jahr hat jede Kachel aus ihrer Ausgabe. Bildunterschrift bleibt die Zeile unter der Kachel.
3. **Bild-Sitemap für die Sammlungen** (`app/sitemap.ts`, `images` je Sammlungsadresse mit den Cover-Adressen auf `covers.openlibrary.org`, Google erlaubt fremde Hosts): nur Sammlungen, nicht die Wände (Dünne-Seiten-Regel).
4. **Messen:** Position der Anfragen „<Titel> cover“ Ende November gegen § 0 (40–55); Googlebot-Image-Anteil in K14.

### Reihenfolge und Aufwand

| Teil | Wer | Aufwand | Blockiert durch |
|---|---|---|---|
| A 1–4 Verlinkung und Hub | Claude | 1 Tag | nichts |
| A 5 Indexierung beantragen | Julian | 10 min/Tag, eine Woche | A 1–4 deployt |
| B `?cover=` bündeln | Claude | 2 h | Julians Ja zu (b) mit (a)-klein |
| C Titel, Alt-Texte, Bild-Sitemap | Claude | ½ Tag | Julians Wort zum Titel |
| Lesen | Claude in Julians Chrome | 30 min | Ende November |

**Julian entscheidet:** (1) Teil B so, (b) mit der kleinen (a) für belegte Cover? (2) Der Titelsatz aus C 1 — oder seine Fassung. (3) Ob die Hub-Texte in § A 3 von ihm kommen (seine Stimme) oder von Claude mit seinem Strich.
