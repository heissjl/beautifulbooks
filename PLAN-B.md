# Plan für Punkt B und die Arbeit, die keine Entscheidung braucht

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
