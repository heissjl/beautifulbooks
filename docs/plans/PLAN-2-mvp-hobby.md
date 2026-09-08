# PLAN 2.0 — Der Hobby-MVP: online ohne Kauf-Links, und die Shop-Variante daneben

Stand: 2026-09-08 abends. Roadmap-Punkt **2.0**; Branch `mvp-hobby` (von `main` bei `e5ca05f`, Tests 241/241, `tsc` und Lint grün).

## 1. Was Julian will

(Julian, 2026-09-08: „lass uns schnell zu einem deployten MVP kommen. Ich will das als affiliate-link-freie Hobby-Version hosten, damit ich ohne großes Impressum einen MVP starten kann und erste Real-Life-Effekte sehen kann und auch die Analytics bauen und testen kann. Einem guten Mindeststandard muss es aber genügen. In einem anderen Branch baue ich dann die Verbesserungen weiter und die Website-Variante mit Kauflinks oder Werbung; die muss dann erstmal lokal weiterlaufen oder in einem Dev-Bereich gehostet sein.“)

Daraus folgen zwei Produkte aus einem Code: eine **Hobby-Variante** mit neutralen Händler-Links, ohne Provision und ohne Werbung, öffentlich auf Vercel Hobby; und eine **Shop-Variante**, die alles behält, was heute in `main` steckt, und die nur lokal oder auf einer Preview-URL läuft, bis Phase 4 entschieden ist.

## 2. Die Entscheidung dahinter: ein Schalter, kein zweiter Branch

Julians Bild sind zwei Branches. Der Einwand: zwei Branches, die beide weiterentwickelt werden, laufen in Tagen auseinander — jede Reparatur an Suche, Wand oder Faltung müsste zweimal gemerged werden, und der Shop-Branch trüge bald Konflikte in `BookDetail.tsx`, der größten Datei der Seite. Die Alternative ist billiger und erfüllt denselben Zweck:

- **Ein Schalter `NEXT_PUBLIC_SITE_MODE`** mit den Werten `hobby` und `shop`. **Nicht gesetzt heißt `hobby`**, damit eine vergessene Variable die Kauf-Links nie versehentlich einschaltet. Eine Variable für Server und Client, weil beide dieselbe Antwort brauchen und zwei Variablen auseinanderlaufen könnten.
- **`main` ist die Produktion und läuft im Hobby-Modus.** Verbesserungen kommen als kurze Feature-Branches nach `main` und gehen mit dem nächsten Deploy live. Nichts muss zweimal gebaut werden.
- **Die Shop-Variante ist derselbe Code mit `NEXT_PUBLIC_SITE_MODE=shop`**: lokal in `.env.local`, gehostet als Vercel-Preview, weil Vercel Umgebungsvariablen getrennt für Production und Preview führt. Was nur die Shop-Variante betrifft (Provisionsparameter, Verfügbarkeits-Button, Affiliate-Hinweis), wird auf `main` gebaut, hinter dem Schalter, und ist in der Produktion unsichtbar, bis Julian den Wert ändert.
- **`mvp-hobby` lebt bis zum ersten Deploy** und wird dann nach `main` gemerged. Wer danach doch einen dauerhaften Branch `shop` will, kann ihn von `main` abzweigen; der Plan rät ab.

Vercel Hobby erlaubt laut Nutzungsbedingungen nur nicht-kommerzielle Nutzung (ROADMAP 0.6). Der Hobby-Modus erfüllt das. Eine Preview im Shop-Modus mit **neutralen** Links (ohne `AFFILIATE_*`) ist ebenfalls nicht kommerziell; **Affiliate-Variablen werden erst mit dem Pro-Plan gesetzt.**

## 3. Was der Hobby-Modus abschaltet

**Entschieden von Julian am 2026-09-08 abends:** „AbeBooks- und eBay-Suche und die anderen Händler können wir trotzdem drin lassen, solange es keine Affiliate-Links sind.“ Die Regel lautet damit nicht „kein Händler“, sondern: **kein Link trägt einen Provisionsparameter, und die Seite behauptet keinen.** Kauf-Links, Markt, Suchlinks und die Klickzählung bleiben, wie sie sind. Das ist heute schon das Verhalten ohne `AFFILIATE_*`-Variablen (SPEC §2.4); der Hobby-Modus macht daraus eine Garantie statt einer Konfigurationsfrage.

| Heute | Hobby-Modus | Wo |
|---|---|---|
| `buyLinksFor` liest `AFFILIATE_AMAZON_TAG_*` und `AFFILIATE_BOOKSHOP_ID_*` aus der Umgebung | **ignoriert die Variablen**, auch wenn eine gesetzt ist; ein Test belegt, dass im Hobby-Modus keine URL einen Partnerparameter trägt, egal was in der Umgebung steht | `lib/buylinks.ts` |
| Verfügbarkeits-Button und `/api/availability` (E12, ROADMAP 0.1) | Button weg, Route 404. Das ist keine Affiliate-Frage, sondern eine der robots.txt und der Amazon-Bedingungen; öffentlich trägt er das Risiko, das 0.1 beschreibt, ohne etwas zu sagen. **Damit ist 0.1 für den MVP mit Option (a) beantwortet**; für die Shop-Variante bleibt sie offen | `components/AvailabilityCheck.tsx`, `app/api/availability/route.ts` |
| Fußzeile „Purchase links may earn us a commission.“ | Satz weg, weil er im Hobby-Modus falsch wäre (N12); stattdessen Links auf Privacy und Contact | `components/SiteFooter.tsx` |
| About „Some links can earn a commission. The order of the shops is not sorted by what they pay…“ | „No link on this site earns anything“; der Satz zur Reihenfolge bleibt, die Klickzählung wird weiter erklärt | `app/about/page.tsx` |
| `rel="noopener noreferrer sponsored"` an den Kauf-Links | `sponsored` nur im Shop-Modus; ohne Provision ist das Attribut eine Behauptung | `components/BookDetail.tsx` |

**Unverändert im Hobby-Modus:** Kauf-Links je Markt, Markt-Umschalter und Cookie `market`, `/go/` mit der Klickzählung ohne Kennung (F5, E14), „Find this exact cover“ mit AbeBooks, eBay, Google Lens, TinEye, WorldCat und Open Library.

**Eine Entscheidung bleibt bei Julian:** das **Verdikt** (`/api/isbn`, eine Google-Anfrage pro ISBN des gewählten Covers, gemessen 2–5). Mit Kauf-Links hat es wieder seinen Zweck, denn es sagt, was ein Kauf über diese ISBN liefert (SPEC §9.2). Der Preis ist das Kontingent: eine Detailseite mit Auswahl kostet 3 bis 6 Anfragen statt 1, also rund 500 statt 1.000 kalte Seiten am Tag. **Empfehlung: an lassen.** *Julian am 2026-09-08 abends: „Verdikt dann drin.“ Entschieden.* Der MVP wird nicht an 500 Detailseiten am Tag scheitern, und ob das Kontingent bindet, ist genau die Zahl, die 3.2 messen soll; 1.1 (keine Vorauswahl) rückt dafür nach dem Deploy auf Platz eins, weil es die Anfrage bei jedem spart, der nur schaut.

**Rechtsseiten, Umfang und Sprache** — recherchiert am 2026-09-08 abends, Befunde mit Quellen in [docs/recht-hobbyseite.md](../recht-hobbyseite.md); keine Rechtsberatung. Das Ergebnis: **Name und ladungsfähige Anschrift sind Pflicht, sobald die Seite öffentlich ist** (§ 18 Abs. 1 MStV gilt für jedes Telemedium, das nicht ausschließlich persönlichen oder familiären Zwecken dient; „ohne großes Impressum“ heißt ohne Telefon, USt-ID und Register, nicht ohne Anschrift). Der Unterschied zum vollen Impressum nach § 5 DDG ist für eine Privatperson nur die E-Mail-Adresse; ob neutrale Händler-Links „geschäftsmäßig“ sind, ist eine Grauzone, die mit dieser einen Zeile erledigt ist. Eine Datenschutzerklärung ist unabhängig davon Pflicht (Art. 13 DSGVO); ein Cookie-Banner nicht, weil nichts auf der Seite eine Einwilligung braucht. **Der eigentliche Haken ist Vercel Hobby: der Auftragsverarbeitungsvertrag gilt nur für Pro und Enterprise** (Recherche §5, drei Wege mit Preis, Empfehlung: bewusst tragen und in 0.6 eintragen). Zu bauen: `/contact` (Impressum: Name, Anschrift, E-Mail) und `/privacy` nach der Tabelle in Recherche §3.2, beide Englisch, beide in der Fußzeile; `beforeSend` entfernt `q` aus den Analytics-URLs. *Entschieden am 2026-09-08 abends:* die Anschrift kommt aus `IMPRINT_NAME`, `IMPRINT_STREET`, `IMPRINT_CITY`, `IMPRINT_EMAIL` in `.env.local` (git-ignoriert; Vorlage `.env.example` im Repo; dieselben Werte in den Vercel-Projekteinstellungen), Julian füllt sie; ob privat oder c/o bleibt seine Sache und berührt den Code nicht. Vercel: erst einmal Hobby mit Restrisiko, die Frage steht als ROADMAP 0.12.

## 4. Der Mindeststandard

Was vor dem ersten Deploy wahr sein muss, in Reihenfolge der Prüfbarkeit:

1. `npm run build`, `npm run test:run`, `npm run lint`, `npx tsc --noEmit` grün — heute alle vier.
2. **Kein Link trägt einen Partnerparameter, kein Verfügbarkeits-Button** im Hobby-Modus; ein Test belegt beides (`buyLinksFor` mit gesetzten `AFFILIATE_*`-Variablen, Route `availability`).
3. **Die zwei falschen Antworten aus 1.7** sind repariert: unbekannte Work-ID antwortet 404 statt 200 (sonst indexiert Google den Soft-404 ab Tag 1), und `?offset=` jenseits der Kappung meldet, was geliefert wurde.
4. **Die Suche bricht nicht an der Laufzeitgrenze ab:** schlechtester Fall `/api/search` ist 20 s (1.10), eine Editions-Seite 12 s. `maxDuration = 30` auf beiden Routen, und die Grenze des Hobby-Plans im Dashboard **ablesen**, nicht annehmen (ROADMAP 2.1). Gibt der Plan keine 30 s, wird der Gesamtdeckel in `lib/search.ts` gesenkt, nicht die Grenze ignoriert.
5. **Enter im Suchfeld schickt ab** (0.8), Fokus-Ringe sichtbar, Enter auf einer Kachel öffnet sie. Claude prüft im Browser-Panel, Julian bestätigt am echten Gerät.
6. **6.15, Schritte 1 und 2** (Klammerzusätze normalisieren, Karten nach Autoren-Key zusammenfassen): laut Roadmap die einzigen Suchpunkte, die vor den MVP gehören, zwei Stunden. Böll darf nicht als fünf Karten desselben Romans erscheinen.
7. **Die fünf Akzeptanz-Queries aus SPEC §3 F1** im Browser, im Hobby-Modus, mit Blick auf jeden Satz, der von Provision spricht, und auf jede Händler-URL (kein `tag=`, keine Bookshop-ID).
8. **Privacy und Contact** stehen, mit Julians Angaben, in der Fußzeile verlinkt.
9. **Vercel Web Analytics** läuft (cookiefrei, paketiert als `@vercel/analytics`, `<Analytics />` im Layout, im Dashboard eingeschaltet) und steht in der Datenschutzerklärung. Das ist die Messung für die erste Woche; die eigene Analyse-Seite (3.1) kommt danach, weil sie auf `localhost` nur Julian misst.

**Ausdrücklich nicht vor dem MVP**, mit Grund:

| Punkt | Warum später |
|---|---|
| 1.1 kein vorgewähltes Cover | Eine Sitzung; nach dem Deploy als erster Punkt, weil es mit eingeschaltetem Verdikt die Google-Anfrage bei jedem spart, der nur schaut |
| 1.3 Bild-Cache | N8 verlangt ihn „vor dem Start mit Besuchern“, aber Vercels Bildoptimierung hat auf Hobby ein eigenes Kontingent, das eine Wand mit 300 Covern schnell leert. Erst messen, was ein Tag echter Besucher an Bildern lädt; bis dahin bleibt `unoptimized` |
| 1.9 Platz oben rechts | Gestaltung, kein Fehler |
| 1.11, 1.2, 1.8 | Kauf-Link-Qualität; betrifft beide Modi, aber keiner ist ein Fehler, der den Start verbietet. Auf `main` nach dem Deploy |
| 0.1 (c) | Nur die Shop-Variante |
| 6.6, 6.7, 6.13, 6.15 Schritt 3 | Messung, Geld, Stichprobe — wie in der Roadmap begründet |
| 0.5 Domain | Nicht nötig für den ersten Deploy: `*.vercel.app` genügt für erste Effekte. **Aber der erste Punkt danach** (Julian, 2026-09-08 abends): DNS, `NEXT_PUBLIC_SITE_URL` umstellen, neu bauen, Sitemap neu einreichen |

## 5. Die Schritte

### Sitzung 1 — Claude, ein halber bis ganzer Tag, auf `mvp-hobby`

1. `lib/sitemode.ts`: `siteMode()` liest `NEXT_PUBLIC_SITE_MODE`, kennt `hobby` und `shop`, Default `hobby`; alles andere ist ein Fehler beim Start, kein stilles `hobby`. Unit-Test.
2. `buyLinksFor` ignoriert `AFFILIATE_*` im Hobby-Modus; Test mit gesetzten Variablen in beiden Modi. `/api/availability` antwortet 404 im Hobby-Modus; `/go/` bleibt (es zählt ohne Kennung und leitet auf den neutralen Link).
3. Client: `AvailabilityCheck` nur im Shop-Modus; `rel="sponsored"` nur im Shop-Modus. Sonst bleibt die Seitenleiste, wie sie ist.
4. Fußzeile und About ohne Provisionssatz im Hobby-Modus; `robots.ts` sperrt `/go/` (in beiden Modi, jeder Aufruf ist ein Klick, den ein Crawler nicht tun soll); `lib/seo.ts`-Beschreibung prüfen.
5. 1.7 beheben (Soft-404, Offset), mit Tests.
6. `maxDuration = 30` in `/api/search` und `/api/works/[id]`.
7. `/privacy` und `/contact` mit Platzhaltern, die Julian füllt; Inhalt nach [docs/recht-hobbyseite.md](../recht-hobbyseite.md) §2.4 und §3.3, ohne Affiliate-Hinweis.
8. `@vercel/analytics` ins Layout, mit `beforeSend`, das `q` aus der URL streicht; README-Tabelle um `NEXT_PUBLIC_SITE_MODE` ergänzen.
9. 6.15 Schritte 1 und 2, wenn die Sitzung es hergibt; sonst Sitzung 2 davor.
10. Build, Tests, Lint, `tsc`; fünf Akzeptanz-Queries und 0.8 im Browser-Panel; Screenshots nach `docs/tests/`.
11. Spec nachziehen (§7 dieses Plans), Roadmap abhaken, Historie ergänzen. Ein Commit je Roadmap-Punkt (2.0, 1.7, 6.15).

### Parallel — Julian, eine halbe Stunde plus Wartezeit

- **0.2** zweiter Google-Schlüssel für die Entwicklung; der bisherige wird zum Produktionsschlüssel. Ohne das teilt sich der Betrieb das Kontingent mit jeder Entwicklungssitzung (305 von 1.000 am 2026-09-07).
- **2.1** Vercel-Konto, GitHub-Repo `heissjl/beautifulbooks` verbinden, Region `fra1`, Production = `main`. Variablen: `GOOGLE_BOOKS_API_KEY` (Pflicht), `NEXT_PUBLIC_SITE_URL` (erst die `*.vercel.app`-Adresse), `NEXT_PUBLIC_SITE_MODE` leer lassen oder `hobby`; für Preview optional `shop`. **Keine** `AFFILIATE_*`. Web Analytics im Dashboard einschalten. Die Laufzeitgrenze des Plans ablesen und in ROADMAP 2.1 eintragen.
- **0.4 in klein:** Name und E-Mail-Adresse für `/contact`, und die Entscheidungen 1–3 aus §3.
- **0.5 Domain**, wenn gewünscht; nicht blockierend.

### Sitzung 2 — beide, eine Stunde: online

1. `mvp-hobby` nach `main` mergen, Vercel baut.
2. **2.6 Abnahme live:** fünf Akzeptanz-Queries, eine kalte Detailseite mit Zähler, das OG-Bild in einem Messenger, Privacy und Contact erreichbar, kein Händler-Link auf der ganzen Seite. Abends den Google-Verbrauch in der Cloud-Konsole ablesen und in die Historie schreiben — die erste Zahl, die nicht aus der Entwicklung stammt.
3. **2.4** UptimeRobot auf `/api/search?q=1984`; **2.5** Search Console und Bing, Sitemap einreichen.

### Danach, in dieser Reihenfolge

0. **0.5 Domain, sofort nach dem ersten Deploy** (Julian, 2026-09-08 abends: „ich will auch die Hobby-MVP-Variante schnell auf eine eigene Domain bringen“). Julian kauft (Kandidaten und Registrar in ROADMAP 0.5), verbindet sie im Vercel-Projekt und setzt `NEXT_PUBLIC_SITE_URL` auf die neue Adresse; danach ein Deploy, weil die Variable zur Bauzeit in Canonical, Sitemap und OG-Bild wandert, und die Sitemap in der Search Console neu einreichen (2.2, 2.5). Die `*.vercel.app`-Adresse leitet Vercel von selbst auf die Domain um, alte Links bleiben gültig. Zwanzig Minuten plus DNS-Wartezeit; kein Code.

1. **3.1 Analyse-Seite** (zwei Tage), sobald es eine Woche Web-Analytics gibt, an denen sich die eigenen Zahlen prüfen lassen. Die Fragen aus der Roadmap-Tabelle gelten unverändert, nur die Händler-Zeilen entfallen im Hobby-Modus.
2. **3.2** Google-Verbrauch eine Woche ablesen; dann 0.7 — im Hobby-Modus ist die Frage kleiner, weil das Verdikt schon aus ist.
3. **1.1**, **1.9**, **1.3 mit Messung** — Phase 1 in der Roadmap-Reihenfolge, jetzt gegen echte Besucher.
4. **1.11, 1.2, 1.8** auf `main`, sichtbar in beiden Modi. **Die Shop-Variante** ist danach nur noch 0.1 (c) oder (a) endgültig und Phase 4: Pro-Plan, Impressum in voll (0.4), Affiliate-Hinweis (2.3), `AFFILIATE_*` setzen. Der Umschalttag ist der Tag, an dem `NEXT_PUBLIC_SITE_MODE=shop` in Production gesetzt wird — und er braucht das volle Impressum vorher.

## 6. Was in Spec, Roadmap und README landet

- **SPEC:** neue Entscheidung **E20** (Betriebsmodus: Hobby ohne Händler-Links als Default, Shop als Wert; `main` = Hobby in Production); §2.4 bekommt einen Absatz „im Hobby-Modus werden die Affiliate-Variablen ignoriert, die Links sind neutral“; F2.10 „nur im Shop-Modus“; F6 Fußzeile und About in beiden Fassungen, dazu `/privacy` und `/contact`. E12 verweist auf E20.
- **ROADMAP:** Punkt **2.0** (dieser Plan); 0.1 bekommt den Satz, dass der MVP Option (a) fährt und die Entscheidung nur noch die Shop-Variante betrifft; 0.6 ist mit Hobby beantwortet, bis zum Umschalttag; die Reihenfolgetabelle nennt den Plan.
- **README:** `NEXT_PUBLIC_SITE_MODE` in der Variablentabelle, ein Absatz „Hobby und Shop“.
- **docs/history.md:** die Messungen aus Sitzung 1 und 2 (Laufzeitgrenze, erster Tagesverbrauch, Bilder je Detailseite, sobald gemessen).
