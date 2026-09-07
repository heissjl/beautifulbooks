# Beautiful Books – Roadmap

Stand: 2026-09-07. **Jeder offene Punkt steht hier genau einmal.** Was die Seite ist, steht in [SPEC.md](SPEC.md); was schon gebaut und gemessen wurde, in [docs/history.md](docs/history.md). Ein erledigter Punkt verschwindet von hier und bekommt seinen Eintrag in der Historie.

Die Phasen folgen Abhängigkeiten, nicht Aufwand: Provision braucht eine öffentliche Seite, Reichweite braucht Inhalte, Messen braucht Besucher. Innerhalb einer Phase gilt die Reihenfolge der Liste. *Wer* steht bei jedem Punkt: **Julian** (Konten, Geld, Recht, Produktentscheidungen), **Claude** (Code, Messung, Text) oder beide.

## Empfohlene Reihenfolge der nächsten Sitzungen

| # | Was | Wer | Aufwand |
|---|---|---|---|
| 1 | Phase 0, Punkte 0.1–0.4: Verfügbarkeits-Button, zweiter Google-Schlüssel, Abrechnungsversuch, Angaben fürs Impressum | Julian | eine halbe Stunde plus Wartezeit |
| 2 | Phase 1, Punkte 1.1 und 1.2: kein automatisch gewähltes Cover, auffindbare Kauf-Links | Claude | eine Sitzung |
| 3 | Phase 1, Punkt 1.3: Bild-Cache vor Open Library und Google | Claude | eine Sitzung, mit Messung |
| 4 | Phase 2: Vercel, Domain, Impressum und Datenschutz, Search Console | beide | eine Sitzung |
| 5 | Phase 4, Punkt 4.1: Bookshop.org beantragen, sobald die Seite erreichbar ist | Julian | zehn Minuten plus Tage Wartezeit |
| 6 | Phase 3: Analyse-Seite, nach einer Woche echter Besucher | Claude | zwei Tage |

Danach entscheidet sich anhand der Zahlen aus Phase 3, ob Phase 4 (Geld) oder Phase 5 (Reichweite) zuerst weitergeht. Ohne Besucher bringen Kauf-Links nichts, ohne Kauf-Links kostet Reichweite nur.

---

## Phase 0 — Entscheidungen, die nur Julian treffen kann

Keine davon ist Code. Alle vier ersten stehen vor dem Deployment.

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

- [ ] **0.7 Produktentscheidung, erst mit echten Besuchern: kostet eine Detailseite eine oder zwei Google-Anfragen?** Fiele die Titelsuche auf Seite 0 weg (`WorkPageOptions.googleBooks`, eine Zeile), verdoppelte sich die Kapazität von rund 500 auf rund 1.000 kalte Detailseiten pro Tag. Preis, gemessen über das ganze Werk: bei *1984* 4 von 282 Covern (1,4 %), bei *Beloved* 12 von 72 (17 %), dazu Beschreibungen und Vorschau-Links überall. Empfehlung: erst 0.2, 1.1 und die Cache-Verlängerung wirken lassen und den Verbrauch aus Phase 3 ansehen, bevor Cover geopfert werden.

---

## Phase 1 — Vor dem Deployment bauen

Braucht keine Entscheidung von Julian; jeder Punkt ist ein eigener Commit mit Messung.

- [ ] **1.1 Beim Öffnen eines Buchs kein Cover automatisch auswählen.** (Julian, 2026-09-07.) Heute fällt `selectCoverFrom` auf das erste Cover der ersten Gruppe zurück: der neueste Datensatz der führenden Sprache, nicht das schönste und nicht das bekannteste. Zwei Gründe: das Produkt („Judge a book by its covers“ heißt, auf einer Wand zu landen, nicht auf einer getroffenen Entscheidung) und das Kontingent (die Auswahl löst die ISBN-Nachschau aus, **eine Google-Anfrage pro geöffnetem Buch**, ob jemand die Seitenleiste ansieht oder nicht; eine kalte Detailseite fiele von 2 auf 1, ohne ein einziges Cover zu kosten).

  Unberührt: geteilte Links mit `?cover=`, die Peek-Leiste auf dem Telefon, die Ladeszene. Zu gestalten ist die breite Ansicht, denn eine leere zweite Spalte wäre schlechter als das Problem. Drei Kandidaten, unentschieden:
  1. Die Wand läuft bis zur ersten Auswahl über die volle Breite und rückt dann zusammen. Ehrlich zur Sache, kostet ein Umspringen des Layouts.
  2. Die Spalte trägt bis zur Auswahl eine kurze Erklärung, was ein Klick bringt.
  3. **Julians Vorschlag:** ein Algorithmus wählt ein **farbenfrohes** Cover automatisch, und das kleine Google-Cover darunter lädt erst, **wenn die Seitenleiste gescrollt wurde**. Die Auswahl bliebe automatisch, wäre aber nicht mehr willkürlich, und die Google-Anfrage fiele erst an, wenn jemand in Richtung der Kauf-Links liest. Unbewertet festgehalten; die Signaturen (Kontrast, Helligkeit) liegen für ein Farbmaß bereits pro Cover vor.

- [ ] **1.2 Die Kauf-Links sind in der Seitenleiste nicht auffindbar.** (Julian, 2026-09-07: „man weiß erst gar nicht, dass man scrollen muss“.) Gemessen auf 1440 × 900 bei *Beloved*: sichtbare Höhe der Seitenleiste 804 px, Inhalt 2.351 px, davon das Cover allein 554 px; „Buy this ISBN“ liegt 437 px unter dem Fensterrand, ohne sichtbaren Hinweis, dass unterhalb des Covers etwas kommt.

  Kandidaten: (a) Kauf-Links **über** das Cover; (b) das Cover in der Höhe deckeln, wie es die Telefon-Schublade schon tut (180 px), damit Bild und Links zusammen ins Fenster passen; (c) eine festgeklebte Leiste am unteren Rand der Seitenleiste mit den ersten Links, analog zur Peek-Leiste; (d) eine Verlaufskante als Hinweis, das Billigste und Schwächste.

  **Julians Zusatzidee, nur die zwei provisionsfähigen Links hochzuziehen, hat heute zwei Haken:** beide (Amazon, Bookshop) sind unkonfiguriert, es gibt also null Links zum Nudgen (Phase 4); und die About-Seite sagt „The order of the shops is not sorted by what they pay“. Vertretbar wäre eine Ordnung nach `BuyLink.kind` (Buchseite vor Trefferliste), die zufällig dieselben Links begünstigt und dem Leser nachweisbar nützt; oder der Satz auf About wird geändert. Unausgesprochen geht es nicht.

- [ ] **1.3 Bild-Cache vor Open Library und Google** (SPEC N8). Cover laden heute direkt von `covers.openlibrary.org`, das auf archive.org weiterleitet und unter Last langsam oder gar nicht liefert (bei 18 gleichzeitigen Anfragen kamen nach 15 s nur die Google-Bilder); Open Library dokumentiert außerdem Rate-Limits für Cover. Optionen: `next/image` ohne `unoptimized` mit `remotePatterns` (Vercels Bildoptimierung, Kontingent des Plans prüfen) oder eine eigene Proxy-Route mit CDN-Cache. Vorher messen, wie viele verschiedene Bilder eine Detailseite lädt, damit das Kontingent der Optimierung nicht die nächste Grenze wird.

- [ ] **1.4 Händler-URLs Hugendubel und genialokal von Hand im Browser prüfen.** Beide antworten dem Skript mit 200 und rendern die Treffer erst im Browser; ihre URL-Muster sind weder bestätigt noch widerlegt. Zehn Minuten, beim Prüfen im sichtbaren Browser-Panel.

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
- [ ] **4.3 Weitere Programme:** AbeBooks (über Impact; wichtig für vergriffene Ausgaben, also die mit den interessanten Covern), Thalia / Hugendubel / genialokal über Awin oder Adcell, eBay Partner Network für Sammlerausgaben.
- [ ] **4.4 Steuer und Gewerbe.** Affiliate-Einnahmen sind Einkünfte aus Gewerbebetrieb; ab Absicht Gewerbeanmeldung, Kleinunternehmerregelung prüfen.
- [ ] **4.5 Falls das Google-Kontingent nicht trägt** (nach 0.3 und 3.2): Ersatz für die ISBN-Nachschau, in dieser Reihenfolge: **ISBNdb** (ab ~15 USD/Monat, ersetzt sie eins zu eins), **Amazon PA-API** (kostenlos, aber erst nach 4.2), oder **Verzicht**, dann zeigt das Verdikt nur noch „unknown“ und die Seite funktioniert mit kleinerem Versprechen.

---

## Phase 5 — Reichweite

Eine Suchseite ohne eigene Inhalte bekommt keinen organischen Traffic. Die Grundlage (statische Work-Seiten, Titel, Schema.org, OG-Bild, Sitemap, robots) steht seit 2026-09-07.

- [ ] **5.1 Sitemap auf ~500 kuratierte Werke** (Klassiker, Bestseller, Bücher mit vielen Ausgaben). Die Liste gibt es noch nicht; erfundene IDs wären schlechter als die heutigen zwölf. Quelle für die Liste: die Suchen ohne guten Treffer aus 3.1.
- [ ] **5.2 Seite 0 serverseitig rendern**, falls die Indexierung schwach bleibt. Heute stehen Titel, JSON-LD und OG-Bild im HTML, die Wand lädt im Browser; Google rendert JavaScript, aber nicht garantiert. Eigener Schritt, kein Nebenbei.
- [ ] **5.3 Interne Verlinkung:** „Weitere Bücher von …“, „Andere Ausgaben dieses Verlags“.
- [ ] **5.4 Redaktionelle Seiten**, eine pro Woche: Listen („Die schönsten Ausgaben von Pride and Prejudice“), eine Seite pro Reihe (Penguin Clothbound, Everyman's Library, Folio Society, Suhrkamp Bibliothek, Manesse). Reihen haben Sammler, Sammler suchen.
- [ ] **5.5 Visuelle Plattformen:** Pinterest (Cover-Mosaike als Pins, jeder Pin auf die Work-Seite; Pins leben Monate), Instagram / TikTok („30 Cover von Dune in 15 Sekunden“, aus den Daten automatisierbar), Reddit (r/bookcovers, r/books; nicht spammen, bei „welche Ausgabe?“-Fragen die Vergleichsseite verlinken).
- [ ] **5.6 Launch-Momente:** Show HN, Product Hunt, r/InternetIsBeautiful; Book-Blogger und BookTok-Accounts mit vorbereitetem Link zu „ihrem“ Buch.
- [ ] **5.7 Bindung:** Newsletter „Cover der Woche“ (Buttondown oder Resend), „Benachrichtige mich bei neuer Ausgabe“ pro Werk.
- [ ] **5.8 Messen:** Referrer pro Kanal in Vercel Analytics; nach acht Wochen entscheiden, welche zwei Kanäle bleiben.

---

## Phase 6 — Qualität, jederzeit dazwischen

Kleine Punkte aus dem Design-Durchgang, jeder eine Stunde bis einen halben Tag, ohne Abhängigkeit.

- [ ] Cover-Vergleich: zwei Ausgaben nebeneinander.
- [ ] View Transitions zwischen Karte und Detailseite (das Cover „fliegt“ mit).
- [ ] Sticky-Suchfeld auf dem Telefon.
- [ ] Ladeszene: sanfter Übergang, wenn das Falten Kacheln umsortiert, sobald Signaturen eintreffen.
- [ ] Feinjustierung nach Nutzung: Größe der Kacheln auf der Detailseite, Kontrast der Chips im Dark Mode.
- [ ] Mosaik: gescannte Textseiten erkennen (bei *Dune* zwei von achtzig Bildern), nur wenn es sichtbar stört; die Kurzantwort hasht absichtlich nicht.

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
