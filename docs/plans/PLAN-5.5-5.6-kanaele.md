# Plan für 5.5 und 5.6: Reichweite außerhalb der Suche

**Stand 2026-10-04: 5.6a gebaut** (auf dem Branch, nicht deployt; der Satz der Datenschutzerklärung wartet auf Julian). Geschrieben am 2026-10-04 auf Julians Bitte („mach dafür einen plan"), nachdem die Domain steht (2.2) und geteilte Links eine Vorschaukarte zeigen. Ergänzt [PLAN-5-reichweite.md](PLAN-5-reichweite.md) §5, der die Kanäle nur nennt. Die Roadmap-Punkte sind 5.5 (Pinterest, Clips), 5.6 (Launch, Reddit, Blogger) und die beiden neuen Claude-Punkte **5.5a** (Pin-Format) und **5.6a** (Kanäle messen).

**Die Grenze aus 5.6 gilt für jeden Schritt:** Die Maschine erzeugt Material und Links. Jeder Beitrag, Kommentar, jede Antwort und jede Nachricht an einen Menschen kommt von Julian, von Hand.

---

## 1. Was es schon gibt, und was fehlt

**Material, fertig:**

| Was | Wo | Teilbar als |
|---|---|---|
| Vorschaukarte 1200×630 je Buch, je Cover, je Sammlung, je Leser-Wand, Startseite | `app/**/opengraph-image.tsx` (fünf Stück) | Link in Messenger, Reddit, HN, Bluesky |
| Thematische Sammlungen (SF Masterworks u. a.) | `/collections/<slug>` | Link; die Seite fragt Google nicht |
| Leser-Wände | `/c/<id>`, `noindex` | Link, vom Leser selbst geteilt |
| Clip „30 Cover in 20 s" | `lab/video/`, 600 Einzelbilder je Buch, **keine MP4** (ffmpeg fehlt) | Instagram/TikTok, sobald kodiert |
| Riesenmosaik (Porträt aus Covern) | `lab/mosaic/` | Bild für Instagram/Pinterest |

**Was fehlt, in der Reihenfolge, in der es blockiert:**

1. **Die Messung sieht die Kanäle nicht.** `originOf` (`lib/insights/signals.ts`) kennt nur `engine`, `social`, `other`, `direct`. Damit gilt:
   - Reddit, Pinterest, Instagram und Bluesky fallen alle in `social`.
   - Hacker News und Product Hunt landen in `other`.
   - In-App-Browser (Instagram, TikTok, oft auch die Reddit-App) senden meist keinen Referrer, ihre Besuche erscheinen als `direct`.
   - Sammlungs- und Wandseiten senden **gar kein Signal**: Wer von Pinterest auf eine Sammlung kommt und kein Buch öffnet, ist unsichtbar.

   Ohne 5.6a kann 5.7 („Referrer pro Kanal") nicht beantwortet werden, und jeder Launch ist eine einmalige Gelegenheit, die ungemessen verpufft.
2. **Die Rechtefrage aus 5.5 ist offen.** Auf der eigenen Seite zeigt die Seite Cover als Nachweis einer Ausgabe neben dem Kauflink. Ein Pin, ein Clip oder ein Mosaik ist eine neue Vervielfältigung auf einer fremden Plattform, oft ohne diesen Zusammenhang. Ein Link mit Vorschaukarte ist dagegen weniger heikel, weil die Plattform das Bild selbst von der Seite holt. **Julian entscheidet** (siehe §6), bevor irgendetwas mit Covern hochgeladen wird; bis dahin sind nur Link-Kanäle frei.
3. **Kapazität für einen Ansturm.**
   - Das Google-Kontingent beträgt 1.000 Anfragen am Tag, rund 500 kalte Buchseiten.
   - Eine HN-Titelseite bringt nach allgemeiner Erfahrung eine Größenordnung mehr Besucher (gemessen ist das hier nicht).
   - Ist das Kontingent leer, fällt die Seite nicht aus: `googlequota` stoppt, und das Urteil zum gewählten Cover lautet dann `unavailable`. Das passiert aber genau an dem Tag, an dem die meisten zum ersten Mal hinsehen.
   - Davor fällig: **0.2** (eigener Schlüssel für den Betrieb), **0.13** (Kontingent-Alarm), **2.4** (Firewall auf *Log*, damit Vercels Abwehr echte Besucher nicht mit einer Challenge abweist).
   - Dazu das Fotobudget der Leser-Wände: 2 USD am Tag, `PHOTO_BUDGET_CENTS`; bei einem Ansturm ist es nach etwa 130 Fotos aus. Das ist gewollt. Die Seite muss es nur verständlich sagen, was sie schon tut.
4. **Hobby-Modus.** Solange E20 `hobby` gilt, gibt es keine Affiliate-Links. Ein Launch vor Phase 4 bringt Reichweite, aber keine Provision. Das ist **kein Grund zu warten**: Ein Launch lässt sich nicht wiederholen, und die Seite sollte vorher stabil laufen. Die Reihenfolge lautet deshalb erst messen, dann Kapazität, dann Launch. Ob vor oder nach dem Umschalttag, entscheidet Julian (§6).

---

## 2. Die Kanäle, je mit Material, Aufwand, Messung und Abbruch

### 2.1 Link-Kanäle (frei, sobald 5.6a steht)

**Show HN.**
- Ein Beitrag, Titel ohne Superlativ, etwa „Show HN: Buy Its Covers – find and buy a specific cover of a book". Der Text sagt, was die Seite nicht kann: zwei offene Kataloge, keine Bestandsprüfung.
- Ziel des Links ist **die Startseite**, nicht eine Suche. Die Startseite ist vorgerendert und gecacht und kostet kein Kontingent.
- Julian bleibt den ersten Tag in den Kommentaren. Die meisten Fragen werden nach den Quellen fragen; die Antworten stehen in `/about`.
- Wochentag und Uhrzeit: werktags, US-Vormittag.

**r/InternetIsBeautiful.**
- Vorher die aktuellen Regeln der Community lesen (Selbstwerbung, Mindestalter des Kontos, Pflichtangaben).
- Ziel ist die Startseite oder eine Sammlung.
- **Nicht am selben Tag wie HN**, sonst trennt die Messung die beiden nur über den Referrer, und Reddit-Apps senden oft keinen.

**Product Hunt.**
- Zuletzt und optional. Product Hunt lohnt sich mit Vorbereitung (Galerie, Maker-Kommentar, Unterstützer am Starttag), sonst verpufft es.
- Die Galerie besteht aus Screenshots der eigenen Seite; das ist unbedenklicher als Pins, weil es Bilder der Seite sind, nicht der Cover allein (siehe §6).

**Reddit-Antworten** (r/books, r/printSF, r/suggestmeabook, Sammler-Subs wie r/bookshelf):
- Nur dort, wo jemand nach einer Ausgabe oder einem Cover fragt („which edition of Dune has …").
- Die Antwort hilft auch ohne den Link; der Link führt auf das passende Cover (`/book/<id>/cover/<coverId>`, eine eigene Seite mit eigener Vorschaukarte, die genau dieses Cover zeigt).
- **Höchstens ein paar Antworten pro Woche, nie kopiert**, sonst gilt es als Spam und das Konto wird gesperrt.
- Claude kann eine **Suchliste** pflegen (Fragen der letzten Tage mit „edition" oder „cover" in Buch-Subs). Lesen ist erlaubt, schreiben nicht (Grenze oben).

**Blogger und BookTok.**
- Für jede angeschriebene Person ein vorbereiteter Link auf „ihr" Buch, gern auf ein bestimmtes Cover, dazu eine Zeile Kontext.
- Claude erzeugt die Liste der Links: Buch, Cover, Vorschaukarte geprüft. Das Anschreiben schreibt Julian.
- Anfangen mit fünf Personen, deren Bücher in den Sammlungen oder unter den kuratierten Werken stehen. Dort ist die Wand am vollsten.

**Sammlungen und Leser-Wände als Teilobjekt.**
- Eine Sammlung ist das bessere Ziel für einen geteilten Link: ein Bild mit vielen Covern, ein Thema, kein Kontingent.
- Eine Leser-Wand teilt der Leser selbst. Das ist der einzige Kanal, der ohne Julian wächst.
- Was hier fehlt, ist nicht mehr Material, sondern **die Zahl**: Wie viele Wände entstehen, und wie viele Besuche kommen über einen geteilten Wandlink? Das gehört in 5.6a (Landing-Signal auf `/c/<id>` und `/collections/<slug>`).

### 2.2 Bild-Kanäle (erst nach Julians Rechte-Entscheidung, §6)

**Pinterest (5.5, 5.5a).**
- Format 1000×1500 je Werk und je Sammlung, aus derselben Maschinerie wie die Vorschaukarte. Das ist eine weitere `ImageResponse`-Route oder ein Skript, das die Pins als Dateien schreibt. Kein Google-Aufruf; Titel, Autor und vier bis neun Cover.
- **Hochladen von Hand in Stapeln**: zehn Pins die Woche, auf Boards nach Gattung bzw. Reihe.
- Automatisches Posten über die Pinterest-API erst nach Prüfung ihrer Bedingungen und Freigabe der App. Das lohnt erst, wenn Hand-Pins tragen (Abbruch unten).
- Pins verlinken auf die Buch- oder Sammlungsseite mit Kanal-Marke (§3).

**Instagram und TikTok, Clips (5.5).**
- `lab/video/` ist fertig bis auf die Kodierung: `brew install ffmpeg`, dann `encode.sh`.
- Erst *Dune* und *Gatsby*, je ein Clip. Julian postet, Claude schreibt die Liste der gezeigten Ausgaben als Quellenangabe für die Bildunterschrift.
- Instagram erlaubt keinen Link im Beitrag; der Link steht im Profil, mit Kanal-Marke.

**Mosaik.** Erst, wenn Clips oder Pins tragen. Es ist das aufwendigste Bild und hat die engste Rechtefrage (gemeinfreies Porträt plus fremde Cover).

### 2.3 Messbar machen (5.6a, Claude)

Siehe §3. Ohne diesen Schritt startet keiner der Kanäle oben.

---

## 3. Messung: 5.6a

Zwei Ergänzungen der Signale aus 3.1b. Beides sind feste Klassen, keine Werte und keine Kennung. Sie fallen unter Punkt 6 der Analyse-Regel in CLAUDE.md: Die Datenschutzerklärung (EN und DE), `docs/recht-hobbyseite.md` §4 und Plan 3.1 §6 werden angepasst, und **Julian gibt den Satz frei**.

1. **Herkunft nach Plattform statt `social`/`other`.**
   - `ORIGINS` wird um `reddit`, `pinterest`, `hn`, `instagram`, `tiktok`, `bluesky`, `producthunt` erweitert; der Rest bleibt `social` bzw. `other`.
   - Erkannt wird am Host des Referrers, wie heute.
   - Klassen statt Hosts, damit kein freier Text in den Speicher kommt.
2. **Kanal-Marke für die Links, die wir selbst setzen: `?via=<klasse>`.**
   - Die Klassen sind fest und heißen wie die Herkunftsklassen (`VIA` in `lib/insights/signals.ts`): `pinterest`, `hn`, `reddit`, `producthunt`, `instagram`, `tiktok`, `bluesky`, `blog`, `mail`. Ein Clip trägt die Plattform, auf der er läuft (`instagram`, `tiktok`), nicht `clip`.
   - Die Marke wird im Browser beim Ankommen gelesen und geht ins Signal (`from` wird zu der Klasse, wenn `via` gültig ist). Sie gewinnt über den Referrer, weil In-App-Browser keinen senden.
   - Unbekannte Werte werden verworfen. Kanonische URL und ISR bleiben unberührt; die Seite liest `via` nur im Client.
   - Geteilte Links tragen die Marke weiter. Das ist gewollt, denn der Besuch kam über diesen Kanal.
3. **Landing-Signal für Sammlungs- und Wandseiten.**
   - Ein Signal `t: 'landing'` mit `page` (`home` | `search` | `collections` | `collection` | `wall`), `entry` (Kanal des Besuchs), `first` (erste Seite des Tabs) und `opened` (ob von dort ein Buch geöffnet wurde), wie die anderen per `sendBeacon` beim Verlassen; gesendet von `NavMemory` im Wurzel-Layout, also ohne Eingriff in die Seiten.
   - Das Buchsignal trägt zusätzlich `entry`. So lässt sich ein Kauf dem Kanal zuordnen, auch wenn der Leser über eine Sammlung zum Buch kam. Der Kanal liegt im Modulspeicher des Tabs; ein Neuladen fragt den Referrer neu.
   - Eine Seite der Site, die keine Einstiegsseite ist (About, Anlegen), heißt als Herkunft jetzt `page` statt `other`: `other` ist seitdem nur noch eine fremde Website.
   - Keine Sammlungs- oder Wand-ID, nur die Seitenart. Eine Wand-ID wäre einer Person zuzuordnen.
4. **Ansicht:** In `/admin/insights` eine Tabelle „Kanäle": je Herkunft Besuche, Anteil mit geöffnetem Buch, Anteil mit Klick zu einem Händler. Dazu ein Tagesverlauf, an dem man einen Launch-Tag erkennt.
5. **Tests:** `parseSignal` für die neuen Klassen und für verworfene `via`-Werte, `originOf` je Plattform, die Summen in `insights-signals.test.ts`.

Aufwand: ein Tag Claude, plus Julians Freigabe des Satzes in der Datenschutzerklärung.

**Gebaut 2026-10-04** wie beschrieben; Tests in `lib/__tests__/insights-signals.test.ts` (Plattformen, `via` nur auf der ersten Seite und nur aus der Liste, Einstiegsseiten, `landing` ohne ID, Summen je Kanal, Bericht). Der Satz, der in Erklärung und `de.ts` steht und Julians Freigabe braucht: „When you leave a book page, a search, the home page or a collection, your browser sends one anonymous summary … The summary also names the kind of site your visit began on, as one word from a fixed list (a search engine, Reddit, Pinterest, Hacker News and the like), or the word in the “via” part of a link this site posted itself. No identifier, cookie, IP address or address you came from is stored …"

**Was die Zählung nicht sieht:** einen Einstieg auf einer Seite, die keine Einstiegsseite ist (About, `/create`, das Spiel), und Leser, deren Browser `sendBeacon` blockiert. Die Einstiege sind deshalb eine Untergrenze.

---

## 4. Reihenfolge

| # | Schritt | Wer | Voraussetzung |
|---|---|---|---|
| 1 | **2.5** Search Console und Bing ([Prompt](../prompt-search-console.md)) | Julian | — |
| 2 | **5.6a** Kanäle messen (§3) | Claude, Freigabe Julian | — |
| 3 | **0.2, 0.13, 2.4** Kapazität | Julian | — |
| 4 | Rechte-Entscheidung (§6, Frage 1) | Julian | — |
| 5 | Reddit-Antworten und fünf Blogger-Links, leise | Julian, Linkliste Claude | 2 |
| 6 | **Show HN** | Julian | 2, 3; eine Woche ohne offene Fehler auf der Startseite |
| 7 | r/InternetIsBeautiful, ein bis zwei Wochen nach HN | Julian | 6 |
| 8 | **5.5a** Pin-Format, dann zehn Pins die Woche von Hand | Claude / Julian | 4 |
| 9 | Clips *Dune*, *Gatsby* | Julian (ffmpeg, posten) | 4 |
| 10 | Product Hunt, optional | Julian | 6, 7 ausgewertet |

Schritte 1–5 kosten zusammen etwa zwei Abende von Julian und einen Tag Claude.

---

## 5. Woran wir merken, ob es trägt

Die Schwellen sind Vorschläge; **Julian bestätigt oder ändert sie**. Sie gelten nach der jeweiligen Frist, gemessen mit 5.6a:

| Kanal | Frist | Trägt, wenn … | sonst |
|---|---|---|---|
| Show HN / r/InternetIsBeautiful | 7 Tage nach Beitrag | ≥ 10 % der Besuche öffnen ein Buch | Einmalig ohnehin; Lehre für den Text des nächsten |
| Reddit-Antworten | 6 Wochen | ≥ 1 Klick zu einem Händler je 3 Antworten | einstellen |
| Blogger/BookTok | 6 Wochen nach dem Anschreiben | ≥ 1 von 5 verlinkt | Ansprache ändern, einmal; dann einstellen |
| Pinterest | 8 Wochen, 80 Pins | ≥ 50 Besuche/Woche mit `via=pin` | einstellen, nicht automatisieren |
| Clips | 4 Clips | ≥ 1 Profil-Klick je 1.000 Aufrufe | einstellen |
| Leser-Wände | laufend | Besuche über Wandlinks steigen mit der Zahl der Wände | Teilen-Knopf prüfen (5.13b) |

Die Frage über allem ist dieselbe wie in 5.7: **Bringt ein Kanal Leute dazu, ein Buch zu öffnen und einen Händler zu besuchen?** Besucher ohne geöffnetes Buch sind Lärm.

---

## 6. Offene Entscheidungen, alle Julians

1. **Cover auf fremden Plattformen.** Dürfen Pins, Clips und Mosaike Cover zeigen? Drei Wege:
   - (a) Ja, als Zusammenstellung mit Quellenangabe. Das ist das Risiko einer Abmahnung, gering bei Hobby-Reichweite, aber nicht null.
   - (b) Nur gemeinfreie Cover (vor 1955 gestaltet, Gestalter seit 70 Jahren tot). Dafür fehlt die Datenlage: Wir kennen das Jahr der Ausgabe, nicht den Gestalter.
   - (c) Keine Bild-Kanäle, nur Links mit Vorschaukarte.

   Ohne Antwort gilt (c).
2. **Launch vor oder nach dem Umschalttag (E20 → `shop`)?**
   - Davor: Die Seite ist ruhiger zu betreiben, aber Besucher bringen keine Provision.
   - Danach: Vercel Pro (0.6/0.12), Impressum und Affiliate-Freigaben müssen stehen. Amazon prüft nach den ersten Verkäufen, ein Ansturm kann helfen.
   - Empfehlung: **HN vor dem Umschalttag**, weil HN-Leser eher die Idee als den Kauf testen, und Product Hunt danach.
3. **Die Schwellen in §5.**
4. **Der Satz in der Datenschutzerklärung für 5.6a.** Entwurf: „We note which kind of site sent you here (a search engine, Reddit, Pinterest, Hacker News, …) and, on a link we posted ourselves, which channel it was — a fixed word, never the address you came from."

---

## 7. Wie auf Pinterest posten (Julian, 2026-10-04: „wie sollte ich auf pinterest posten?")

**Vorweg die Grenze:** Auf Pinterest gibt es keinen Beitrag ohne Bild. Jeder Pin ist ein Bild, auch einer, den Pinterest per „Merken" von unserer Seite holt. Weg (c) aus §6 („nur Links") schließt Pinterest damit aus. Pinterest braucht Weg (a), oder Pins ohne Cover, und die verfehlen den Zweck. **Erst die Entscheidung, dann der erste Pin.**

**Einrichten, einmal (Julian, etwa 20 Minuten):**
1. **Unternehmenskonto** anlegen oder ein privates umstellen (kostenlos). Nur damit gibt es Statistiken und die Bestätigung der Website.
2. **Website bestätigen** („Claim"): `buyitscovers.com`, per DNS-TXT bei INWX. Das geht wie bei der Search Console: ein neuer Eintrag, `v=spf1` nicht anfassen. Die Alternative per Meta-Tag wäre eine Codeänderung, die TXT-Variante ist keine. Danach zeigen Pins von der Seite den Namen der Website, und die Statistik trennt eigene Pins von denen, die andere von der Seite merken.
3. **Rich Pins** sind kein eigener Schritt mehr nötig: Pinterest liest Titel und Beschreibung aus den Open-Graph-Angaben, die jede Buch-, Sammlungs- und Jahrzehnte-Seite schon hat. Ob sie greifen, zeigt der erste Pin; das ist ungeprüft.

**Welche Seiten, in dieser Reihenfolge.** Pinterest ist eine Suchmaschine für Bilder und belohnt Sammlungen und Vergleiche, nicht Einzelstücke:
1. **Jahrzehnte-Seiten** (`/book/<id>/decades`, 90 Werke tragen eine). „Dune covers through the decades" ist genau das, wonach dort gesucht wird.
2. **Sammlungen** (`/collections/<slug>`), je eine Pinnwand pro Sammlung.
3. **Buchseiten mit vielen Covern**, die meistbesuchten zuerst (Tabelle „Werke" in `/admin/insights`).

**Das Bild:** Hochformat 2:3 (1000×1500); Querformate werden im Feed klein. Bis 5.5a das Format liefert, gibt es kein gutes Pin-Bild. Die Vorschaukarte 1200×630 ist quer und deshalb ein schlechter Ersatz. **5.5a (ein halber Tag Claude) kommt also vor dem ersten Pin**, nach der Rechte-Entscheidung.

**Ein Pin:**
- **Titel** sachlich, mit den Wörtern, die gesucht werden: „Dune by Frank Herbert — 60 years of covers". Kein „the most beautiful", keine Rangliste (Regel aus PLAN-5 §2).
- **Beschreibung** in zwei Sätzen: was zu sehen ist, wie viele Ausgaben, welche Verlage. Dazu die Wörter „book cover", „edition", der Reihen- oder Verlagsname. Höchstens zwei, drei Hashtags; Pinterest wertet sie kaum noch.
- **Link** mit Marke: `https://buyitscovers.com/book/OL…/decades?via=pinterest`. Ohne die Marke landet ein Besuch aus der Pinterest-App meist unter „direkt".
- **Pinnwand** nach Thema: eine je Sammlung, dazu „Covers through the decades", „Science fiction covers", „Penguin Classics covers" usw. Gruppen-Pinnwände bringen erfahrungsgemäß wenig und kosten Pflege.

**Rhythmus:** lieber regelmäßig als in Wellen, etwa zwei Pins am Tag statt zehn am Sonntag. Pinterests eigene Planungsfunktion verteilt einen Stapel, den Julian an einem Abend anlegt; das ist kein automatisches Posten, denn jeder Pin ist von Hand gemacht. Nie dasselbe Bild zweimal auf dieselbe Pinnwand.

**Was Claude dafür liefert:** eine Liste je Woche mit Seite, Bild (sobald 5.5a steht), Titel, Beschreibung und markiertem Link, als Datei unter `docs/`. Hochladen und Posten bleibt bei Julian (Grenze oben).

**Messen:** Pinterests Statistik (Impressionen, ausgehende Klicks; erst nach der Bestätigung der Website) und K14 mit `via=pinterest` in `/admin/insights`. Abbruch nach §5: 80 Pins, 8 Wochen, unter 50 Besuchen pro Woche → einstellen, nicht automatisieren.
