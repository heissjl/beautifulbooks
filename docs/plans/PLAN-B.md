# Plan für Punkt B und die Arbeit, die keine Entscheidung braucht

> **B0 bis B8 erledigt 2026-09-07.** Historisches Arbeitsdokument mit den Messungen. Weiterhin gültig als Vorlage: der **vorläufige Plan für die Analyse-Seite** nach B4, siehe [../../ROADMAP.md](../../ROADMAP.md) Phase 3. Verweise auf `SPEC.md §…` meinen die Gliederung vor dem 2026-09-07 (Konkordanz in SPEC.md §8).

Detailplan zu SPEC.md §10, geschrieben 2026-09-07, während A3 auf Julian wartet. Jeder Abschnitt wird einzeln geplant, umgesetzt und committet; die Reihenfolge folgt dem Risiko, nicht dem Aufwand.

| | Was | Warum jetzt |
|---|---|---|
| B0 | Sprachwahl schlägt auf die Detailseite durch | Gemeldeter Fehler, klein, betrifft das Kernversprechen |
| B1 | Rate-Limit auf den vier API-Routen | Muss vor dem Deployment stehen (§8.7) |
| B2 | SEO-Grundlage: ISR, Titel, Schema.org, OG-Bild | Größter Hebel aus §10 D |
| B3 | Detailseite mobil | §10 E13, erster Punkt |
| B4 | Klick-Tracking `/go/…` plus Plan für eine Analyse-Seite | §10 C9 |
| B5 | About-Seite | §10 B4, der Teil, der ohne Julian geht |

---

## B0 — die gewählte Sprache schlägt auf die Anzeige durch

### Befund (gemessen 2026-09-07)

Suche `1984` mit Filter *German*, dann *Nineteen Eighty-Four* geöffnet. Die URL trägt die Sprache mit, die Anzeige ignoriert sie:

```
/book/OL1168083W?q=1984&lang=de
Tabs: English 18 (aktiv) · Spanish 6 · Portuguese 3 · Catalan 1 · … · Unknown 36
```

Kein deutscher Tab, obwohl deutsch gefiltert wurde, und das ausgewählte Cover ist englisch. Drei Ursachen, alle in derselben Kette:

1. **`orderGroups` in `lib/pages.ts` verwirft genau die beiden häufigsten Wünsche.** `wanted` wird nur gesetzt, wenn die gewünschte Sprache *nicht* in `LEAD_LANGUAGES` steht. Englisch und Deutsch sind aber die beiden Einträge dieser Liste — und die beiden Sprachen, die im Suchfilter am ehesten gewählt werden. Wer Deutsch wählt, bekommt Englisch zuerst. Ein Test hält das heute sogar fest („Searching a lead language does not duplicate its position"). Die Absicht war richtig (die Position nicht doppelt vergeben), die Folge falsch.
2. **`leadLanguagesSettled` wartet auf Englisch, nicht auf die gewünschte Sprache.** Die Ladeszene endet, sobald eine englische Gruppe da ist. Deutsch liegt bei Open Library oft erst auf Seite 2 oder 3, weil die Ausgaben nach Datensatzalter kommen. Der Leser sieht also erst eine englische Wand, und der deutsche Tab schiebt sich später dazwischen — genau das Umsortieren, das Julian am 2026-09-07 abgestellt haben wollte.
3. **Das ausgewählte Cover ist `groups[0].covers[0]`** (`selectCoverFrom`). Es folgt der Tab-Reihenfolge und ist damit von 1 automatisch mitbehoben.

### Änderungen

| Datei | Änderung |
|---|---|
| `lib/pages.ts` | `orderGroups`: die gewünschte Sprache führt **immer**, danach die restlichen Lead-Sprachen. Aus `lead = [wanted?, 'en', 'de']` wird `lead = [preferred, ...LEAD_LANGUAGES ohne preferred]`. |
| `lib/pages.ts` | `leadLanguagesSettled(groups, done, preferred?)`: wartet auf die gewünschte Sprache, sonst wie bisher auf Englisch. |
| `app/book/[id]/page.tsx` | `preferred` an `leadLanguagesSettled` durchreichen. |
| `lib/__tests__/pages.test.ts` | Der Fall `orderGroups(groups, 'de')` kehrt sich um: erwartet `['de','en','fr',undefined]`. Neue Fälle für `'en'` (bleibt vorn, Deutsch zweiter) und für `leadLanguagesSettled` mit `preferred`. |

Die Obergrenze der Wartezeit bleibt unverändert (`done || checked >= 300`, also höchstens drei Seiten): eine Sprache, die es in dem Werk gar nicht gibt, darf die Szene nicht anhalten.

### Bewusst nicht Teil von B0

Das **Mosaik auf den Suchkarten** richtet sich nicht nach der Sprache: die Kachel zeigt das Buch, nicht die Ausgabe, und die Kurzantwort kennt die Sprache nicht. Ich messe nach der Umsetzung, wie oft ein deutscher Filter englische Kacheln zeigt, und entscheide danach — die Änderung wäre eine Sortierung in `route.ts` plus ein Cache-Key pro Sprache, also billig, aber sie kostet einen zusätzlichen Eintrag im geteilten Cache.

### Prüfen

1. `npm run test:run` — die vier Fälle in `pages.test.ts`.
2. Im Browser: `/?q=1984&lang=de` → Detailseite. Erwartet: deutscher Tab führt, ein deutsches Cover ist ausgewählt, die Szene endet nicht vor dem deutschen Tab.
3. Gegenprobe ohne Filter: `/?q=1984` → Englisch führt wie bisher.
4. Gegenprobe mit einer Sprache, die das Werk nicht hat (`lang=ja` auf einem rein englischen Werk): die Szene endet trotzdem nach spätestens drei Seiten.

---

## B1 — Rate-Limit auf den API-Routen

### B1a zuerst: das Mosaik kostet ein Google-Kontingent, das es nicht braucht

Beim Planen des Limits gemessen, ein Befund aus Schritt 14: `?summary=1` ruft `getWorkPage(offset 0)` auf, und Seite 0 startet **immer** die Google-Titelsuche. Eine Trefferliste mit zwanzig Karten kostet damit bei kaltem Cache **1 + 20 = 21 Google-Anfragen** statt einer. Bei einem Tageskontingent von 1.000 sind das 47 Trefferlisten pro Tag — die Zahl aus §8.7 wäre um den Faktor 20 falsch.

Google trägt zum Mosaik nichts bei, was Open Library nicht auch hätte. Gemessen am 2026-09-07, Seite 0, vier Kacheln pro Karte:

| Werk | Cover auf Seite 0 | davon von Google | gefüllte Kacheln | gefüllte Kacheln ohne Google |
|---|---|---|---|---|
| Nineteen Eighty-Four | 24 | 2 | 4 | 4 |
| Frankenstein | 22 | 6 | 4 | 4 |
| The Lord of the Rings | 62 | 5 | 4 | 4 |
| The Great Gatsby | 12 | 5 | 4 | 4 |
| Wuthering Heights | 48 | 1 | 4 | 4 |

**Änderung:** `WorkPageOptions` bekommt `googleBooks?: boolean` (Vorgabe `true`); der Zweig `summary=1` setzt es auf `false`. Damit kostet eine Trefferliste wieder genau eine Google-Anfrage, und die Detailseite bleibt unverändert bei zwei.

### Warum überhaupt ein Limit

§8.7: *„Rate-Limit auf den API-Routen, sonst zahlen Bots dein Google-Kontingent leer."* Nach B1a kostet nur noch dreierlei ein Kontingent: eine Suche, Seite 0 einer Detailseite und eine ISBN-Nachschau. Genau diese drei bekommen deshalb **zusätzlich zum Routenlimit ein gemeinsames Budget**: Es hat keinen Zweck, jede Route einzeln großzügig zu bemessen, wenn die knappe Ressource dieselbe ist.

### Aufbau

`lib/ratelimit.ts`, ohne Abhängigkeit, ohne Redis (§8.6 stellt Redis bis zu einem Auslöser zurück):

- **Token-Bucket** je Schlüssel: `capacity` (Stoß) und `refillPerMinute` (Dauerlast). Reine Funktion `take(bucket, rule, now)` — testbar ohne Uhr und ohne Netz.
- **Speicher** eine `Map` im Modul, mit Obergrenze: bei mehr als 10.000 Schlüsseln fallen die vollen (also untätigen) Eimer heraus. Ein Prozess, der nichts mehr tut, hält kein Gedächtnis.
- **Schlüssel** ist die erste IP aus `x-forwarded-for`, sonst `x-real-ip`, sonst `unknown`. Alle Anfragen ohne erkennbare IP teilen sich einen Eimer; das ist die konservative Richtung.
- **Antwort** bei Erschöpfung: `429` mit `Retry-After` in Sekunden und einer Fehlermeldung im gleichen Format wie die übrigen Routen (`{ error }`).

### Werte

| Eimer | Kapazität | Nachfüllung | Überlegung |
|---|---|---|---|
| `search` | 30 | 20/min | Eine Suche = eine Anfrage. |
| `works` | 120 | 60/min | Eine Trefferliste löst bis zu 20 Kurzanfragen aus, eine Detailseite bis zu 16 Seiten. Zwei Trefferlisten plus zwei Bücher liegen im Stoß. |
| `isbn` | 40 | 20/min | Eine pro ausgewähltem Cover. |
| `availability` | 6 | 3/min | Teuerste Route: jeder Klick fragt jeden Händler zweimal an (ISBN und Kontroll-ISBN). |
| `google` (quer) | 20 | 5/min | Gilt zusätzlich für Suche, Detailseite Seite 0 und ISBN-Nachschau. Ein Mensch verbraucht pro Buch zwei, pro Suche eine. |

### Was das Limit nicht ist

**Kein Sicherheitsmerkmal.** Der Zähler lebt im Speicher einer Instanz; Vercel startet mehrere, also ist die tatsächliche Grenze das Vielfache. Gegen einen verteilten Angriff hilft das nicht, gegen einen einzelnen Crawler, der eine Sitemap durchgeht, schon — und das ist der Fall aus §8.7. Redis kommt, wenn die Zahlen es verlangen (§8.6).

Die CDN-Antworten (`s-maxage`) erreichen die Funktion gar nicht erst; das Limit greift also nur bei kalten Anfragen, und genau die kosten.

### Prüfen

1. Unit-Tests für `take`: Stoß, Nachfüllung über die Zeit, `retryAfter` korrekt, Eimer wird nicht größer als die Kapazität, Pruning.
2. Im Browser eine Suche und eine Detailseite: keine 429 im Normalbetrieb (Netzwerk-Panel).
3. Von Hand: 40 schnelle Anfragen an `/api/search` → die letzten kommen als 429 mit `Retry-After`.
4. `npm run build`.

---

## B2 — SEO-Grundlage: die Detailseite wird auffindbar und teilbar

### Ausgangslage

`app/book/[id]/page.tsx` ist eine reine Client-Komponente. Daraus folgt dreierlei: es gibt **kein `generateMetadata`**, also trägt jede Buchseite denselben Titel „Beautiful Books" und dieselbe Beschreibung; es gibt **keine strukturierten Daten**; und ein geteilter Link zeigt in Slack, WhatsApp oder Mastodon **keine Vorschau**. Genau das ist §10 D10: „der größte Hebel und fast geschenkt".

### Umbau

| Datei | Was |
|---|---|
| `components/BookDetail.tsx` | **neu**: der heutige Inhalt von `page.tsx`, unverändert, weiterhin `'use client'`. |
| `app/book/[id]/page.tsx` | **wird Server-Komponente**: `generateMetadata`, JSON-LD, `revalidate = 86400`, `generateStaticParams` über die kuratierten Werke. Rendert `<BookDetail />`. |
| `app/book/[id]/opengraph-image.tsx` | **neu**: 1200×630, Mosaik aus bis zu vier Covern plus Titel und Autor, via `next/og`. |
| `lib/seo.ts` | **neu**: reine Funktionen `workPageTitle`, `workDescription`, `bookJsonLd`, mit Unit-Tests. |
| `app/sitemap.ts`, `app/robots.ts` | **neu**: Startseite plus die kuratierten Werke; `/api/` gesperrt. |
| `app/layout.tsx` | `metadataBase` aus `NEXT_PUBLIC_SITE_URL`, damit Bild- und Canonical-URLs absolut werden. |

### Texte

Titelmuster: **„The covers of *Nineteen Eighty-Four* by George Orwell"**, durch die Vorlage in `layout.tsx` zu „… · Beautiful Books". Kein „all", kein „every" — die Regel aus CLAUDE.md gilt auch für Meta-Tags, die niemand liest, weil sonst genau dort der falsche Anspruch überlebt.

Beschreibung: **„Open Library lists 1,180 edition records for Nineteen Eighty-Four. See the ones that carry a cover side by side, by language and year, with the publisher of each."** Die Zahl kommt aus dem Datensatz und ist damit nachprüfbar; die Formulierung sagt zugleich, dass nicht jeder Datensatz ein Bild hat.

### Strukturierte Daten

`Book` nach schema.org, bewusst knapp: `name`, `author` (`Person`), `datePublished` (Erstveröffentlichung), `image` (bis zu vier Cover), `url`, `sameAs` (Open-Library-Werkseite), `inLanguage` weggelassen — ein Werk hat viele. Keine `aggregateRating`, keine `offers`: wir haben weder Bewertungen noch eigene Preise, und erfundene Auszeichnungen sind ein Verstoß gegen Googles Richtlinien und gegen §9.2.

### Was das kostet

`generateMetadata` und das OG-Bild brauchen den Werkdatensatz und Seite 0 — zwei Open-Library-Anfragen, beide im Next-Cache, **keine Google-Anfrage** (`googleBooks: false` aus B1a). Mit `revalidate = 86400` zahlt das nur der erste Besucher eines Buches pro Tag.

### Bekannte Grenze, die dokumentiert wird

Der sichtbare Text bleibt clientseitig: die Wand lädt ihre Seiten weiter im Browser. Google rendert JavaScript, und die maschinenlesbaren Angaben (Titel, JSON-LD, OG-Bild) stehen im HTML. Sollte die Indexierung schwach bleiben, ist der nächste Schritt, Seite 0 serverseitig mitzurendern — das ist ein eigener Schritt, kein Nebenbei.

Die Sitemap enthält vorerst die zwölf kuratierten Werke, nicht die 500 aus §10 D11: die Liste gibt es noch nicht, und erfundene IDs wären schlechter als eine kurze Sitemap.

### Prüfen

1. `curl` auf eine Buchseite: `<title>`, `og:title`, `og:image`, JSON-LD im HTML.
2. Das OG-Bild im Browser öffnen und ansehen.
3. `/sitemap.xml` und `/robots.txt`.
4. Unit-Tests für `lib/seo.ts`, `npm run build`, Sichtprüfung der Detailseite.

---

## B3 — die Detailseite auf dem Telefon

### Befund (Emulation 375×812, *The Great Gatsby*, 2026-09-07)

| Beobachtung | Folge |
|---|---|
| 17 Sprach-Pillen brechen in **sechs Zeilen** um | Vor dem ersten Cover steht ein halber Bildschirm Navigation. |
| Die Seitenleiste liegt **unter** der Wand | Bei 329 Covern in drei Spalten sind das rund 110 Zeilen Bildlauf bis zu den Kauf-Links. Auf dem Telefon ist die Auswahl eines Covers damit folgenlos: man sieht nie, was man ausgewählt hat. |
| Kein Hinweis, dass eine Auswahl etwas bewirkt hat | Der Ring um die Kachel ist der einzige Rückmeldung. |

Das ist dieselbe Sache, die Julian am 2026-09-07 auf dem Desktop gemeldet hat („man muss erst zum Ende der Cover kommen"), auf dem Telefon nur unlösbar: eine eigene Scrollfläche wie in der Desktop-Seitenleiste gibt es hier nicht, weil es keine zweite Spalte gibt.

### Lösung: Peek-Leiste und Schublade

1. **Peek-Leiste**, fest am unteren Rand, sobald ein Cover ausgewählt ist: Miniatur, Verlag und Jahr, ein „Details"-Knopf. Sie beantwortet die Frage „habe ich gerade etwas ausgewählt?" ohne einen einzigen Bildlauf und ist gleichzeitig der Griff der Schublade.
2. **Schublade** (Bottom Sheet) über die volle Höhe, geöffnet über die Peek-Leiste: darin unverändert `CoverDetails` mit Metadaten, Kauf-Links, Suchlinks und dem Verfügbarkeits-Knopf. Schließen über Kreuz, Rückwärtswischen im Verlauf ist nicht nötig, weil sich die Auswahl weiterhin nur in der URL ändert.
3. **Sprach-Pillen in einer Zeile**, seitlich scrollbar (`overflow-x-auto`, `flex-nowrap`) unterhalb von `sm`. Die Reihenfolge bleibt wie in B0 und Julians Entscheidung vom 2026-09-07; nur der Umbruch entfällt. Die aktive Pille wird beim Wechsel in den Blick gescrollt.

Ab `lg` ändert sich nichts: dort bleibt die Seitenleiste mit ihrer eigenen Scrollfläche.

### Bewusste Abweichung von §10 E13

Dort steht „Cover-Wand horizontal". Ich baue sie **vertikal weiter**. Eine horizontale Wand zeigt auf 375 px zwei Cover nebeneinander, das dreispaltige Raster neun bis zwölf gleichzeitig — auf einer Seite, deren einziger Zweck der Vergleich vieler Cover ist, wäre das ein Rückschritt. Der Grund, aus dem die horizontale Wand geplant war, ist die unerreichbare Seitenleiste, und den löst die Schublade direkter. Julian kann das umstoßen, dann ist es eine Stunde Arbeit.

### Barrierefreiheit und Technik

- Schublade als `role="dialog" aria-modal="true"`, Escape schließt, Klick auf den Hintergrund schließt, der Schließen-Knopf bekommt beim Öffnen den Fokus.
- Bildlauf des Hintergrunds wird gesperrt, solange die Schublade offen ist (Klasse am `body`, in einem Effekt, kein `setState` — die Regel `react-hooks/set-state-in-effect` ist in diesem Repo ein Fehler).
- Die Peek-Leiste liegt über der Wand, deshalb bekommt die Wand unten Platz (`pb`), damit die letzte Kachelreihe nicht darunter verschwindet.

### Prüfen

1. Emulation 375×812: Cover antippen → Peek-Leiste; „Details" → Schublade; Kauf-Link sichtbar ohne Bildlauf durch die Wand.
2. Escape und Hintergrundklick schließen; der Bildlauf steht dahinter still.
3. Sprach-Pillen: eine Zeile, seitlich scrollbar, aktive Pille sichtbar.
4. Desktop 1440: unverändert.
5. `npm run build`, `npm run lint`.

---

## B4 — Klick-Tracking, und was daraus eine Analyse-Seite bräuchte

### Warum

§10 C9: die Reihenfolge der Händler ist der einzige Hebel, den wir selbst in der Hand haben, und ohne Zahlen lässt sie sich nicht begründen. Heute wissen wir von elf Kauf-Links nur, dass neun nichts verdienen (§8.7) — nicht, welche überhaupt jemand anklickt.

### Aufbau

- **`/go/[provider]/[isbn]?market=<us|uk|de>`**, eine Route, die den Klick festhält und weiterleitet.
- Die Ziel-URL wird **serverseitig neu gebaut** aus `buyLinksFor`, nicht aus der Anfrage übernommen. Damit ist die Route **kein offener Redirect**: sie kann nur auf Adressen zeigen, die in unserer eigenen Tabelle stehen. Ein unbekannter Anbieter oder eine kaputte ISBN führt zurück auf die Startseite, nicht irgendwohin.
- **Nur die Kauf-Links** laufen darüber. Die Suchlinks („Find this exact cover") bleiben direkt: ihre Ziele hängen an Titel, Verlag und Jahr, die müssten alle durch die URL, und Google Lens misst man ohnehin nicht.
- **Aufgezeichnet wird**: Anbieter, Markt, ISBN, Linkart (`product`/`search`), Zeitstempel. **Nicht**: IP, Cookie, User-Agent, Referrer, irgendeine Kennung des Lesers. Es gibt nichts zu pseudonymisieren, weil nichts Personenbezogenes entsteht — das ist auch der Satz, der so in die Datenschutzerklärung kann.
- **Wohin**: vorerst eine strukturierte Zeile auf stdout (`bb.click {...}`), die Vercel in seinen Logs sammelt. Kein Speicher, keine Datenbank, keine Abhängigkeit. `lib/clicks.ts` ist damit die einzige Stelle in `lib/`, die absichtlich schreibt, ohne unter `DEBUG` zu stehen; der Kommentar dort sagt, warum.

### Grenze, die dabei bleibt

Vercel-Logs sind kurzlebig und nicht auswertbar. Das reicht, um zu sehen, *dass* geklickt wird, und um die Route zu prüfen. Für „welcher Händler trägt" braucht es einen Speicher — und den beschreibt der folgende Plan, der bewusst noch nichts baut.

---

## Vorläufiger Plan: eine Analyse-Seite für *diese* Website

Nicht Teil von B4, sondern die Vorlage für die Entscheidung danach. Geschrieben, nachdem das Tracking stand.

### Warum ein fertiges Werkzeug nicht reicht

Vercel Analytics oder Plausible beantworten „wie viele Besucher, woher, welche Seite". Die Fragen dieser Seite sind andere, und keine davon ist eine Seitenzahl:

| Frage | Warum sie hier zählt | Woher die Daten kämen |
|---|---|---|
| **Wie viele Cover hat ein Leser tatsächlich gesehen, bevor er wegging?** | Das ganze Produkt ist die Wand. Eine Detailseite, die nach Seite 0 verlassen wird, hat versagt, auch wenn sie als Aufruf zählt. | Client: geladene Seiten pro Besuch, letzter sichtbarer Kachelindex. |
| **Wie oft endet eine Suche ohne Klick?** | Das ist das Vertrauensversprechen aus §9.2, direkt gemessen: Ranking gut heißt, der erste Treffer wird geöffnet. | Position des geöffneten Treffers, oder „keiner". |
| **Welcher Händler wird geklickt, je Markt und Linkart?** | Der einzige Hebel für die Reihenfolge, und die Grundlage jeder Partnerbewerbung. | `/go/…` aus B4. |
| **Wie oft wird ein Cover ausgewählt, dessen ISBN der Handel anders zeigt?** | Misst, ob Schritt 13 überhaupt gelesen wird — und ob „differs" Leute abschreckt oder erst recht neugierig macht. | Verdikt zum ausgewählten Cover. |
| **Wie viele Google-Anfragen kostet ein Tag wirklich?** | §8.7 Punkt 5. Ohne diese Zahl bleibt der Tageszähler eine Schätzung. | Serverseitiger Zähler pro Tag und Quelle. |
| **Welche Werke werden gesucht, die wir schlecht bedienen?** | Suchen ohne Treffer oder ohne Cover sind die Liste der nächsten Verbesserungen — und die Grundlage für die kuratierten 500 aus §10 D11. | Suchbegriff, Trefferzahl, Coverzahl. |

Kein Produkt von der Stange kennt „Cover", „Ausgabe" oder „Händler". Deshalb eine eigene Seite, nicht ein weiteres Dashboard.

### Was die Seite wäre

Eine Seite unter `/admin/insights`, hinter einem einfachen Schutz (ein Token in der URL oder Basic Auth über eine Umgebungsvariable — kein Login, kein Konto, es gibt genau einen Leser). Darauf sechs Blöcke, in der Reihenfolge der Tabelle oben, jeder mit einer Zahl, einem Verlauf über 30 Tage und einem Satz, was zu tun wäre, wenn die Zahl schlecht ist.

### Was sie an Technik braucht

1. **Ein Speicher.** Kandidaten in dieser Reihenfolge: Vercel KV / Upstash Redis (Zähler, billig, passt zum ohnehin vorgesehenen Redis aus §8.6), Vercel Postgres (Ereignisse einzeln, erlaubt spätere Fragen, mehr Aufwand), oder eine Datei im Blob-Speicher pro Tag (billigst, unbequem). **Empfehlung: Zähler in KV.** Die sechs Fragen oben brauchen Aggregate, keine Einzelereignisse.
2. **Ein Ereignis-Endpunkt** `/api/event`, `POST`, mit einer knappen Liste erlaubter Ereignistypen. Alles andere wird verworfen — ein offener Zähler-Endpunkt wird sonst zum Spielzeug.
3. **Ein Client-Sender**, der `navigator.sendBeacon` benutzt und beim Verlassen der Seite genau einmal feuert, nicht bei jedem Bildlauf.
4. **Keine Kennung des Lesers.** Alle sechs Fragen lassen sich mit Aggregaten beantworten. Sobald eine Sitzungskennung dazukäme, bräuchte es Einwilligung, Cookie-Banner und einen Absatz Datenschutzerklärung — für Erkenntnisse, die wir nicht brauchen.

### Aufwand und Reihenfolge

Ein Tag für Speicher, Endpunkt und die drei serverseitigen Zahlen (Händlerklicks, Google-Anfragen, Suchen ohne Treffer); ein zweiter für die drei clientseitigen (gesehene Cover, geöffnete Trefferposition, Verdikt). **Sinnvoll erst nach dem Deployment (§10 B6)** — auf `localhost` misst man sich selbst.

---

## B5 — die About-Seite

### Warum sie zu diesem Projekt gehört

§10 B4 nennt sie neben Impressum und Datenschutz, aber sie ist nicht Beiwerk: §9.2 verspricht eine Suche, der man vertrauen kann, und Vertrauen entsteht dadurch, dass jemand sagt, **was er nicht weiß**. Die Detailseite tut das in Fußnoten („Most edition records carry no scan"), aber es gibt keinen Ort, an dem das im Zusammenhang steht. Genau das ist die About-Seite: Quellen, Lücken, und was die Urteile an den Kauf-Links bedeuten.

### Inhalt, fünf Abschnitte

1. **Was die Seite tut** — drei Sätze, dieselbe Sprache wie der Hero.
2. **Woher die Bilder kommen** — Open Library und Google Books, was jedes beisteuert, mit den gemessenen Zahlen aus §8.7 (bei *1984* vier von 282 Covern von Google). Und der Satz, der nirgends fehlen darf: beide Kataloge zusammen kennen nur einen Teil dessen, was je gedruckt wurde.
3. **Was fehlt und warum** — Ausgaben ohne Scan, Ausgaben ohne ISBN, doppelte Scans desselben Covers, die Obergrenze von 1.500 geprüften Datensätzen. Jede Lücke mit ihrem Grund, keine Entschuldigung.
4. **Was „shows this cover / shows a different one / nothing known" heißt** — die drei Urteile aus Schritt 13 in Worten, samt der Klarstellung, dass **kein Händler gefragt wird**: verglichen wird mit dem Bild, das der Verlag bei Google hinterlegt hat.
5. **Kauf-Links und Provision** — dass Links Provision bringen können, dass die Reihenfolge nicht danach sortiert ist, und dass ein Klick gezählt wird, ohne dass etwas über den Leser gespeichert wird (B4).

Kein „Team", keine Entstehungsgeschichte, kein Kontaktformular. Was fehlt, gehört ins Impressum, und das braucht Julians Angaben.

### Technik

- `app/about/page.tsx`, Server-Komponente, statisch, mit eigenem `metadata`.
- Fußzeile aus `app/page.tsx` wird zu `components/SiteFooter.tsx` und bekommt Links auf About (und später Impressum/Datenschutz); die Detailseite bekommt dieselbe Fußzeile, die sie heute gar nicht hat.
- `/about` kommt in `app/sitemap.ts`.

### Prüfen

`npm run build`, Sichtprüfung auf 375 und 1440, `grep` auf „every/all/complete", Links in der Fußzeile auf beiden Seitentypen.

---

## B6 — das Kontingent ist abgelesen, und es ist klein

### Der Befund (Google-Cloud-Konsole, Projekt `beautifulbooks`, 2026-09-07)

| | |
|---|---|
| **Queries per day** | **1.000**, anpassbar |
| Queries per minute per user | 100, anpassbar |
| Verbrauch heute | 298 (29,8 %) |
| Sieben-Tage-Spitze über 90 % | keine |
| Antworten in den letzten 30 Tagen | 200 bei 0,0075/s, **503 bei 0,001/s** |

Damit ist die untere Schätzung aus §8.7 die richtige. Nach dem heutigen Fix kostet eine Suche 1 Anfrage und eine kalte Detailseite 2, also **500 kalte Detailseiten pro Tag** oder rund **200 Besuche** aus einer Suche und zwei geöffneten Büchern. Vor dem Fix wären es 47 Trefferlisten gewesen.

Zwei Nebenbefunde: die 503-Kurve bestätigt, dass Google regelmäßig grundlos ablehnt — der Retry aus Schritt 13 war keine Vorsicht, sondern nötig. Und die 298 von heute stammen **allein aus der Entwicklung**: derselbe Schlüssel bedient Arbeit und Betrieb. Ein zweiter Schlüssel für die Entwicklung gehört auf die Liste.

### Was daraus folgt: §8.7 Punkt 5, aber anders gebaut als geplant

Geplant war ein **Tageszähler**. Der geht nicht sauber: dank des Next-Datencaches (Titelsuche 1 h, ISBN-Nachschau 24 h) weiß unser Code nicht, welche seiner Aufrufe das Haus überhaupt verlassen haben. Ein Zähler würde Treffer aus dem Cache mitzählen und die Seite lange vor dem echten Limit drosseln — bei einem Kontingent von 1.000 ein teurer Irrtum in die falsche Richtung.

**Stattdessen ein Sicherungsautomat auf Googles eigener Fehlermeldung.** Google sagt selbst, wann Schluss ist; das ist genau, kostenlos und braucht kein Zählen.

- **403 oder 429 mit `dailyLimitExceeded` / `quotaExceeded`** → Google wird bis zur nächsten Kontingent-Zurücksetzung nicht mehr gefragt. Die liegt bei Mitternacht **pazifischer Zeit**, nicht bei unserer.
- **403 mit `rateLimitExceeded` / `userRateLimitExceeded`** → 60 Sekunden Pause, kein ganzer Tag.
- **403 aus einem anderen Grund** (falscher Schlüssel, gesperrter Referrer) → **kein** Automat. Sonst legt eine Fehlkonfiguration Google für einen Tag still, und niemand fände heraus, warum.

Dafür muss `HttpError` den Antworttext mitführen; heute wirft es nur den Status, und aus „403" allein lässt sich das nicht auseinanderhalten.

Während der Automat offen ist, liefert die Titelsuche eine leere Liste (F3.3, die Seite läuft auf Open Library weiter) und die ISBN-Nachschau meldet `unavailable` — den Zustand gibt es schon, seit Google 503er wirft.

### Dabei aufgefallen: der Leser bekommt heute eine falsche Aussage

`VerdictNote` behandelt alles, was nicht `verified` oder `differs` ist, gleich — auch `pending`. Wer ein Cover auswählt, liest also für ein bis zwei Sekunden **„No current publisher image is on record for this ISBN"**, obwohl noch gar nicht gefragt wurde. Bei leerem Kontingent stünde dieser Satz den ganzen Tag da, und er wäre den ganzen Tag falsch. Das verstößt gegen §9.2 an genau der Stelle, an der es weh tut.

Deshalb gehört zu B6:

- `IsbnVerdict` bekommt den Status `unavailable`.
- `VerdictNote` bekommt eigene Sätze für „wird gerade geprüft" und für „die Quelle hat nicht geantwortet".
- `useIsbnCovers` merkt sich die ISBNs, bei denen die Quelle ausfiel, statt sie nur zu verwerfen.

### Prüfen

1. Unit-Tests: Fehlerklassifikation (drei Fälle plus der Nicht-Fall), `pacificMsUntilReset`, und dass ein offener Automat keine Anfrage stellt.
2. Ein Test, der belegt: offener Automat ⇒ `getIsbnCovers` meldet `unavailable`, nicht „keine Cover".
3. Im Browser: Verdikt beim Auswählen — kein falscher Satz mehr in der Wartezeit.
4. `npm run build`.

---

## B7 — die 1.000 haltbarer machen, nachdem der Erhöhungsweg tot ist

### Befund

Die Konsole führt „Queries per day" als **anpassbar**, aber der Weg dorthin endet in der Hilfe für die **Google-Suche** (`support.google.com/websearch`, Thema 3378866) — mit dem Books-API hat die Seite nichts zu tun (geprüft 2026-09-07). Es gibt also keinen Selbstbedienungsweg zu mehr als 1.000 Anfragen pro Tag. Damit ist §8.7 Frage 2 beantwortet, nur nicht so, wie man es sich wünscht.

Nebenbefund aus derselben Sitzung: der Verbrauch stieg während der Prüfung von 298 auf 305. Jede Testsitzung geht vom selben Budget ab wie die Besucher.

Was bleibt, sind drei Hebel. Zwei davon kann ich ziehen, einer ist eine Entscheidung.

### B7.1 — Cache verlängern (kostet nichts, verliert nichts)

Heute lebt die **Titelsuche** eine Stunde im Next-Datencache, die **ISBN-Nachschau** einen Tag. Eine Stunde ist für Buchmetadaten absurd kurz: der Titel eines 1949 erschienenen Romans ändert sich nicht stündlich. Ein Werk, das an einem Tag zwölfmal geöffnet wird, kostet damit heute bis zu zwölf Anfragen statt einer.

- **Titelsuche (Detailseite und Suche): 1 Stunde → 7 Tage.** Rein ergänzende Cover und Beschreibungen; eine neue Ausgabe darf eine Woche brauchen, bis sie auftaucht.
- **ISBN-Nachschau: bleibt bei 24 Stunden.** Sie beantwortet „welches Cover liefert der Handel *heute*" — das ist die eine Google-Antwort, die frisch sein muss.

Kein Verlust, keine Entscheidung nötig.

### B7.2 — ein zweiter Schlüssel für die Entwicklung (Julians drei Minuten)

Derselbe Schlüssel bedient Arbeit und Betrieb. Solange das so ist, nimmt jede Testsitzung den Besuchern Anfragen weg — heute 305 von 1.000. Ein zweiter Schlüssel in einem zweiten Cloud-Projekt trennt das sauber und verdoppelt faktisch das Budget des Betriebs. Codeseitig ist nichts zu tun, nur ein anderer Wert in `.env.local`.

### B7.3 — die Entscheidung: kostet eine Detailseite eine oder zwei Anfragen?

Eine kalte Detailseite kostet heute zwei: die **Titelsuche** auf Seite 0 und die **ISBN-Nachschau** beim Auswählen eines Covers. Fiele die Titelsuche weg, verdoppelte sich die Kapazität von rund 500 auf rund 1.000 Detailseiten pro Tag.

Was das kosten würde, gemessen (§8.7, ganzes Werk, vor der Faltung):

| Werk | Cover gesamt | davon nur von Google | Anteil | Beschreibungen | Vorschau-Links |
|---|---|---|---|---|---|
| 1984 | 282 | 4 | 1,4 % | 4 | 4 |
| Mumbo Jumbo | 13 | 3 | 23 % | 2 | 3 |
| Beloved | 72 | 12 | 17 % | 9 | 11 |

Bei *1984* wäre es ein Rundungsfehler, bei *Beloved* jedes sechste Cover. **Das ist eine Produktentscheidung, keine technische**, deshalb baue ich sie nicht von mir aus: Der Schalter (`WorkPageOptions.googleBooks`) existiert seit B1a, das Umlegen ist eine Zeile. Meine Neigung: erst B7.1 und B7.2 wirken lassen und den Verbrauch mit echten Besuchern ansehen, bevor Cover geopfert werden.

### Nicht empfohlen, aber der Vollständigkeit halber

Im Projekt ist **keine Abrechnung aktiviert** (die Konsole wirbt noch mit dem Startguthaben). Ob eine aktivierte Abrechnung das Tageskontingent anhebt, ist für die Books API unbelegt — bei anderen Google-APIs ist es so. Das wäre ein Versuch mit hinterlegter Zahlungsmethode, und den entscheidet Julian, nicht ich.

### Prüfen

`GB_REVALIDATE` in den Tests, `npm run test:run`, `npm run build`, und eine Detailseite zweimal laden: der zweite Aufruf darf keine Google-Anfrage auslösen.

---

## B8 — die Google-Anfrage aus der Suche entfernen

### Der Grund

Gemessen am 2026-09-07 über fünf Suchen und 82 Werke: Google steuerte Covern zu sechs Karten bei — und für **jede** dieser Karten füllt Open Library allein bereits alle vier Kacheln, seit Schritt 14 jede Karte ihr Mosaik selbst nachlädt.

```
The Great Gatsby   google +4  | Kacheln ohne Google 4/4
Dune               google +1  | Kacheln ohne Google 4/4
Children of Dune   google +1  | Kacheln ohne Google 4/4
Dune (zweites)     google +10 | Kacheln ohne Google 4/4
```

Übrig bleibt **eine gewonnene Sprache pro fünf Suchen** (bei *Dune* Schwedisch), die über `filterWorksByLanguage` beeinflusst, ob ein Werk unter einem Sprachfilter erscheint. Dafür eine Anfrage pro kalter Suche, bei einem Kontingent von 1.000 am Tag.

Der Aufruf hat sich damit überlebt: Entscheidung E4 („Editions-Call für die ersten Treffer") wurde in §9.3 Schritt 14 zugunsten der nachgeladenen Seite 0 entschieden, und dieser Rest ist der letzte Teil davon, den niemand mehr braucht.

**Die Titelsuche auf der Detailseite bleibt.** Sie bringt bei *Beloved* jedes sechste Cover und überall die Klappentexte; die wird erst geopfert, wenn echte Besucher zeigen, dass es nötig ist.

### Änderungen

| Datei | Was |
|---|---|
| `lib/search.ts` | Nur noch **ein** externer Aufruf: Open Library. `attachCandidates` fällt aus der Kette. |
| `lib/sources/googlebooks.ts` | `searchVolumes` entfernen (danach ohne Aufrufer) und `lookupByIsbns`, das seit Schritt 13a toter Code ist. Übrig bleiben `searchEditionCandidates` und `lookupIsbnOrThrow`. |
| `lib/works.ts` | `attachCandidates` entfernen; `candidatesToSourceEditions` bleibt, das ist der Weg der Detailseite. |
| Tests | Die drei Integrationstests zur Google-Anreicherung der Suche werden zu einem Test, der belegt, dass eine Suche **keine** Google-Anfrage mehr stellt. `attachCandidates`-Unit-Tests entfallen. |
| SPEC | §3 F1.1 und F1.3, §4 N2 und E4 nachziehen: eine Suche ist jetzt ein externer Aufruf, und die Mosaik-Cover kommen aus Open Library. |

### Was das bringt

Ein Besuch aus einer Suche und zwei geöffneten Büchern kostet **4 statt 5** Google-Anfragen, ohne dass ein Cover verschwindet. Eine reine Suchsitzung ohne geöffnetes Buch kostet **null**.

### Prüfen

1. Ein Integrationstest, der zählt: `search()` löst keine Anfrage an `googleapis.com` aus.
2. Die fünf Akzeptanz-Queries aus §3 F1 liefern dieselbe erste Position wie vorher.
3. Im Browser: Trefferliste mit Mosaiken unverändert.
