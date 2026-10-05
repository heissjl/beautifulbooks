# Plan 2.18: Bereit für einen Ansturm

Stand: 2026-10-05 nachts. **Nichts gebaut; J1–J6 hat Julian am 2026-10-05 entschieden (§6).** Anlass: Julian, 2026-10-04: „i want to plan for virality and have everything either robust or prepared for quick change when it happens. this covers availability of the site, quotas, databases, etc". Während der Arbeit daran kam Vercels Mail: **90 % der 4 Stunden „Fluid Active CPU" sind verbraucht** — ohne dass es einen Ansturm gab. Der Plan beginnt deshalb mit dem, was diese Woche reißt (§0), und erst dann mit dem Ansturm.

Was hier „gelesen" heißt, stand am 2026-10-04/05 in der Doku des Anbieters (Quellen am Ende); „gemessen" ist am Code oder an den Produktions-Logs dieser Nacht abgelesen; alles andere ist als Überschlag gekennzeichnet.

## 0. Die CPU-Warnung vom 2026-10-04 — erledigt, Ursache gefunden

Vercel meldete 90 % der 4 CPU-Stunden des Hobby-Plans; bei 100 % wäre das Projekt pausiert worden, laut Doku bis zu 30 Tage. **Julian ist am 2026-10-05 auf Pro gewechselt** (J1). Auf Hobby las die CLI die CPU je Route nicht („Observability Plus is required"); seit Pro antwortet `vercel metrics`.

**Gemessen aus Vercels Zahlen, 2026-10-05:**

- 30 Tage: 2,14 CPU-Stunden in Funktionsaufrufen (die Differenz zu Vercels 3,6 ist nicht aufgeklärt — der Proxy läuft als eigene Funktion). **49 % Bildroute** `/img` (115.465 Läufe, 32 ms CPU je Bild), **25 % Buchseite** (17.253 Renderings, 106 ms), 7 % `/api/works`, 4 % Sammlungsseiten, 3 % Startseite.
- Je Tag lagen 20–270 CPU-Sekunden an, am 2026-09-26 994, am 2026-10-03 1.379, am 2026-10-04 1.187.
- **Wer:** in den zwei Tagen vor der Mail kamen **31.657 von 44.438 Bildabrufen und 6.776 von 8.281 Buchseiten von ClaudeBot**, Anthropics Crawler; dazu MJ12bot mit 719 Buchseiten. Er folgt den Links von Buch zu Buch, und jede Werk-ID ist eine Seite, die beim ersten Abruf gerendert wird. Seit **2.18n** hält `robots.txt` die benannten Crawler auf den Seiten der Sitemap.
- **Dazu der Verstärker im Browser:** ein einzelner Besuch von 81 Sekunden ließ 14 Buchseiten rendern, die niemand geöffnet hat (Vorladen von `next/link`) — abgestellt mit **2.18a**.

Damit die Frage nie wieder nur Vercel beantworten kann, misst die Seite seit **2.18l** selbst (CPU je Route und Abrufer-Klasse in `/admin/insights`), und **2.18m** rechnet daraus und aus den festen Kosten, was die Seite kostet.

## 1. Kurzfassung

Ein Ansturm trifft vier fremde Grenzen und eine eigene Bauweise. In der Reihenfolge, in der sie reißen:

| # | Grenze | Zahl (gelesen) | Was der Leser dann sieht | Wie lange |
|---|---|---|---|---|
| 1 | **Vercel Hobby** | 1 Mio. CDN-Anfragen, 1 Mio. Funktionsaufrufe, 4 CPU-Stunden, 10 GB Fast Origin Transfer, 100 GB Übertragung — je 30 Tage | **nichts mehr, die ganze Seite ist pausiert** | bis zu 30 Tage |
| 2 | **Redis Free** (`redis-pink-yacht`) | 30 MB, **30 Verbindungen, 100 Befehle je Sekunde, 5 GB Netz im Monat** | Sammlungen der Leser „down", Spiel 503, online veröffentlichte Sammlungen verschwinden von Startseite und `/collections`, Analyse zählt nicht, **Fotobudget bindet nicht** | bis der Tarif gewechselt ist |
| 3 | **Open Library** | 3 Anfragen je Sekunde mit Kennung; wer mehr fragt, wird abgewiesen (am 2026-10-04 an Julians Mac erlebt) | „The catalogue did not answer" für jede Suche und jedes Buch, das nicht im Cache liegt | Stunden, nicht beeinflussbar |
| 4 | **Google Books** | 1.000 am Tag | Verdikt „unavailable", sonst nichts — so gebaut (E11) | bis Mitternacht pazifisch |
| 5 | **Anthropic** (Regalfoto) | Tagesbudget 2 USD in der Redis | Fotos aus für den Tag — **solange die Redis antwortet** | bis Mitternacht UTC |

Nebenbei: Vercel Web Analytics zählt auf Hobby 50.000 Ereignisse im Monat und pausiert dann die Erfassung (die Seite läuft weiter); die Laufzeit-Logs reichen eine Stunde.

**Die drei Sätze, auf die es ankommt:**

1. **Mit Hobby ist ein Ansturm nicht zu überstehen, nur zu überleben, wenn vorher gewechselt wird.** Ein Besuch einer Wand sind rund 150 Anfragen (132 Bilder gemessen am 2026-09-11); 1 Mio. sind 6.500 Wände in 30 Tagen. Auf Pro (20 USD im Monat) sind CDN-Anfragen pauschal, Funktionen kosten 0,60 USD je Million Aufrufe und 0,128 USD je CPU-Stunde, und ein Ausgabenlimit pausiert bei einer gewählten Summe.
2. **Die Redis ist der zweite Engpass, und sie reißt früher, als ihr Speicher voll ist:** 100 Befehle je Sekunde und 30 Verbindungen, während heute Startseite, `/collections`, jede Sammlung eines Lesers und jedes Seitensignal bei jedem Aufruf fragen.
3. **Open Library lässt sich nicht kaufen.** Dort hilft nur, weniger zu fragen, früh aufzuhören, und die Wege, über die ein Ansturm kommt, ohne den Katalog tragen zu lassen.

## 2. Der Grundsatz

**Die Seiten, über die ein Ansturm ankommt, hängen nur an dem, was im Repository und im CDN liegt.** Das sind: die Startseite, `/collections` und jede Sammlung, eine geteilte Sammlung eines Lesers `/c/<id>` mit ihrer Vorschaukarte, `/versus`, und die Buchseiten der kuratierten Werke. Der Katalog, Google, die Redis und das Bildmodell sind Zugaben, die einzeln ausfallen oder abgeschaltet werden dürfen, ohne dass eine dieser Seiten leer bleibt. Heute gilt das für keine von ihnen ganz (§3).

## 3. Was ein Aufruf heute kostet

Abgelesen am Code (Stand `origin/main` vom 2026-10-04). **Gemessen am 2026-10-05 (2.18b)** — die Tabelle danach ersetzt die Überschläge dieser hier für die Seiten, die sie enthält.

| Aufruf | Funktion | Redis | Open Library | Google |
|---|---|---|---|---|
| Startseite | ja, jedes Mal (`searchParams`) | 3 `GET`, darunter `collections:content` mit ganzen Sammlungen (17–41 KB je Sammlung) | — | — |
| `/collections`, `/collections/<slug>` | ja, jedes Mal (`force-dynamic`) | dieselben 3 `GET` | — | — |
| `/c/<id>` | ja, jedes Mal | 2 `GET` + 1 `HINCRBY`, die Karte 1 `GET` je Stunde | — | — |
| `/versus`, ein Paar, eine Stimme | ja | Stand, Flaggen, Schreiben | — | — |
| Buchseite, kuratiert | einmal je 24 h und Deploy | — | Werk und Ausgaben, aus dem Datencache | — |
| Buchseite, sonst | wie oben, dazu bis 16 Wandseiten | — | Werk, bis 16 Ausgabenseiten, Geschwister | 1 auf Seite 0, je Werk und Tag |
| Suche | einmal je Anfrage und Tag | — | 1–2 | — |
| Ein Cover anklicken | ja | — | — | 2–5 |
| Jede verlassene Seite (`/api/seen`) | ja | 4 Befehle (2 × `HINCRBY` + `EXPIRE`) | — | — |
| **Jeder sichtbare Link** (Vorladen) | **ja, wie ein Aufruf des Ziels** | wie das Ziel | wie das Ziel | — |
| Ein Bild ohne CDN-Treffer | ja, 12–29 KB durch die Funktion | — | 1 Bild (nach Cover-ID nicht begrenzt) | — |
| Sammlung anlegen, Buch wählen | ja | Schreiben | Suche + Werk | **1 je Buch** (`WallPicker` lädt Seite 0) |
| Regalfoto | ja, bis 120 s | Budget | Suche je erkanntem Buch | — |

**Gemessen (2.18b, `lab/visitcost/`, 2026-10-05):** `next start` mit Attrappen für Katalog und Redis, kopfloses Chrome bei 1280 × 800, ein frisches Profil je Besuch, bis zum Seitenende gescrollt, Seite verlassen. „Funktion bei jedem Aufruf" und „CDN ab dem 2. Leser" sind das Modell aus dem README (vorgerendert oder statisch = CDN; `s-maxage` = CDN ab dem zweiten Leser; sonst Funktion). Katalogzahlen bei leerem Datencache; ein zweiter Besuch fragt den Katalog nicht mehr (die Suche zeigt 2, weil zwei Werke ohne Fixture leer antworten und Fehler nicht gecacht werden). Bilder liefen hier über `/img`, in Produktion seit 2.18o über die Bildoptimierung; ihre Bytes sind hier eine Attrappe (echte Cover 12–29 KB, die Startseite also rund 0,9 MB Bilder).

| Seite | Anfragen | davon Bilder | Funktion bei jedem Aufruf | CDN ab dem 2. Leser | Open Library (kalt) | Google (kalt) | Redis-Befehle | KB ohne Bilder |
|---|---|---|---|---|---|---|---|---|
| Startseite `/` | 83 | 61 | 1 (das Dokument) | 61 | 0 | 0 | 3 `GET` | 393 |
| Suche `/?q=the great gatsby` | 38 | 10 | 1 (das Dokument) | 14 (`/api/search`, 3 Mosaike, Bilder) | 7 | 0 | 2 (Signal) | 475 |
| Buchseite, kuratiert (Gatsby) | 66 | 35 | **0** (vorgerendert) | 41 (4 Ausgabenseiten, „More by", Bilder) | 5 | 1 | 4 (Signal) | 583 |
| Buchseite mit gewähltem Cover | 53 | 19 | 0 | 27 (dazu `/api/isbn`, `/api/similar`) | 0 | 1 | 4 (Signal) | 599 |
| Jahrzehnte-Seite | 43 | 21 | **1 (das Dokument, jedes Mal — Befund 2.18p)** | 22 | 6 | 0 | 0 | 335 |
| `/collections` | 135 | 117 | 1 | 117 | 0 | 0 | 6 (3 Sammlungen, 3 Leser-Wände) | 342 |
| `/collections/sf-masterworks` | 92 | 73 | 1 | 73 | 0 | 0 | **6 — dieselben 3 Schlüssel zweimal (Befund, → 2.18c)** | 329 |
| `/versus` | 25 | 6 | 1 | 6 | 0 | 0 | 0 beim Aufruf | 327 |
| `/about` | 17 | 0 | 0 | 0 | 0 | 0 | 0 | 291 |

Daraus: **Eine Seite kostet höchstens eine Funktion je Aufruf** — das Dokument der Startseite, der Sammlungen, des Spiels, der Suche und (Befund) der Jahrzehnte-Seite; alle API-Aufrufe der Buchseite tragen `s-maxage` und kosten den zweiten Leser nichts. **Redis:** 3 `GET` je Startseite, 6 je Sammlungsseite (doppelt gelesen), 6 je `/collections`, 2–4 für das Signal beim Verlassen einer Buch- oder Suchseite; **dazu schreibt die CPU-Messung (2.18l) höchstens alle 30 s je Instanz einen Stoß von 14–35 `HINCRBY`** (ein Befehl je Route × Abrufer × Maß) — bei 10 Instanzen ein bis zwölf Befehle je Sekunde, unabhängig von der Zahl der Leser. **JavaScript:** 290–470 KB je Seite, mehr als die Bilder einer Buchseite.

Was daraus folgt: bei 10 Seitenaufrufen je Sekunde — ein mittlerer Abend auf einer geteilten Seite — fallen ohne Änderung 40 Redis-Befehle allein für die Analyse an, dazu 30 für Startseite und Sammlungen, und das Vorladen vervielfacht beides. Die Grenze von 100 je Sekunde ist damit erreicht, bevor ein Leser etwas schreibt.

## 4. Was Claude baut

In dieser Reihenfolge. Jeder Schritt ist ein Roadmap-Punkt und ein Commit; „Analyse" sagt, ob 3.1 berührt ist.

| Punkt | Was | Aufwand | Analyse |
|---|---|---|---|
| **2.18a** | **Vorladen aus.** Ein eigener `Link` (oder `prefetch={false}`) für Buchlinks (`BookGrid`, `BookWorkCard`, `CollectionGrid`, `CoverWall`, `WallView`, `HeroFan`, „More by …") und für die Links in Kopf- und Fußzeile auf Seiten, die in einer Funktion rendern; vorladen nur beim Zeigen mit der Maus, wie `DecadeLink`. Vorher und nachher an einer Sammlung zählen: Funktionsaufrufe und Katalog-Anfragen je Besuch | 2 h | keine (K9 liest die Herkunft, nicht das Vorladen) |
| **2.18b** | **Messung: was ein Besuch kostet.** `next build && next start` lokal, Katalog und Redis als Attrappen, die mitzählen: Anfragen, Funktionsaufrufe, Redis-Befehle, Katalog-Anfragen und Bytes je Seitentyp. Ersetzt die Überschläge in §3; die Zahlen in die Historie | ½ Tag | keine |
| **2.18c** | **Die Redis vom heißen Pfad.** `liveRecords` hält die drei Antworten 60 s je Instanz und wird beim Veröffentlichen aus `/curate` verworfen; `/c/<id>` liest eine Sammlung für fremde Leser aus einem Cache mit Etikett (verworfen bei jeder Änderung), der Aufrufzähler sammelt und schreibt gebündelt; antwortet der Speicher mit „max clients" oder gar nicht, fragt die Instanz 30 s nicht mehr und rendert aus der Datei, statt je Aufruf 2 s zu warten | 1 Tag | Zähler „views" je Sammlung bleibt, wird aber gebündelt geschrieben |
| **2.18d** | **Analyse gebündelt.** `countSignal` und der `/go/`-Zähler sammeln je Instanz und schreiben höchstens alle 10 s die Summen (ein `EXPIRE` je Schlüssel und Stunde statt je Signal); Schalter `INSIGHTS=off` | ½ Tag | **ja**: Plan 3.1 §4 und der Summentest; bei einem Abbruch der Instanz gehen bis zu 10 s Zählung verloren — das steht dann in der Ansicht |
| **2.18e** | **Der Katalog wird geschont.** Je Instanz höchstens vier gleichzeitige Anfragen an `openlibrary.org` (Bilder ausgenommen); ein Automat wie `lib/googlequota.ts`: nach abgewiesenen Verbindungen oder 403/429 fragt die Instanz 60–120 s nicht und sagt „The catalogue is busy" (N12: kein „No books found"); `stale-if-error` an den Antworten von Suche, Werk und ISBN, damit das CDN bei einem Ausfall die alte Antwort gibt | 1 Tag | keine |
| **6.45** | **Kaltreserve** (steht schon in der Roadmap): die veröffentlichten Werke als gebaute Daten. Für den Ansturm erweitert um die Werke der veröffentlichten Sammlungen, damit jede Buchseite, die von einer Sammlung aus erreichbar ist, ohne Katalog rendert | 1–2 Tage | keine |
| **2.18f** | **Schalter, an einer Stelle beschrieben** (`.env.example`, dieser Plan §8): `PHOTO=off`, `INSIGHTS=off`, `GOOGLE_TITLE_SEARCH=off` (die 1.000 gehören dann dem Verdikt), dazu das bestehende `HOTORNOT`. Gemessen wird, wie lange ein Schalter braucht (er wirkt erst mit einem Redeploy) und **ob ein Deploy den Bild-Cache des CDN leert** — einmal, nach einem ohnehin fälligen Deploy | ½ Tag | `PHOTO=off` ändert, was K13 zählt — in der Ansicht benennen |
| **2.18g** | **Betriebsblock in `/admin/insights`:** aus `INFO` der Redis belegter Speicher, Verbindungen und Befehle je Sekunde, dazu Zahl der Sammlungen, Fotoausgaben heute, Google-Stopps heute, je mit der Grenze daneben. Nur auf Abruf, hinter dem Admin-Cookie | ½ Tag | neue Kacheln, keine neue Kennzahl über Leser |
| **2.18h** | **Fotos schließen, wenn der Speicher schweigt** — entschieden (J3). Heute läuft ein Foto weiter, wenn Zähler und Budget nicht lesbar sind (`app/api/walls/photo/route.ts`: „a silent store does not stop a reader") | 1 h | K13 bekommt den Ausgang „store" |
| **2.18i** | **Probe unter Last, lokal:** 200 gleichzeitige Leser gegen `next start`, eine Redis mit `maxclients 30` und die Katalog-Attrappe aus 2.18b; bestanden, wenn die Seiten aus §2 ohne Fehler antworten, während Redis und Katalog abweisen. Nie gegen Produktion | ½ Tag | keine |
| **2.18j** | **Bilder länger im Browser:** `/img` antwortet mit `max-age=3600`; ein Cover unter einer Cover-ID ändert sich nicht, eine Woche spart jede Wiederkehr | 1 h | keine |
| **2.18k** ✅ | **Ein Cover auf Zuruf ausblenden** (J6: „jetzt gleich", also nach 2.18a; gebaut 2026-10-05). Eine Liste von Cover-IDs im Repository (`data/hidden-covers.json`), die Wand, Mosaik, Sammlungen, Spiel, Vorschaukarten und `/img` auslassen; ein Satz auf About mit der Adresse, an die sich ein Rechteinhaber wendet; ein Test, dass eine ID der Liste auf keinem der Wege erscheint. Wirkt mit einem Deploy | ½ Tag | die Kacheln der Wand (`data-cover-id`) werden weniger — in der Historie nennen |
| **2.18l**, **2.18m** | gebaut 2026-10-05: Rechenzeit je Route und Abrufer (K14) und Kosten (K15) in `/admin/insights` | — | neue Kennzahlen, Plan 3.1 §3 |
| **2.18n** | gebaut 2026-10-05 (Julian: „ok"): benannte KI- und SEO-Crawler dürfen die Buchseiten der Sitemap lesen, nichts sonst unter `/book/`, keine Abfragen, keine Bilder (`lib/robots.ts`) | — | K14 zeigt die Wirkung |
| dazu | Der Picker ohne Google (Vorschlag der Sitzung `claude/sleepy-wozniak-lodegp`, dort als 6.88 notiert — **die Nummer ist auf `main` schon vergeben**), 6.47 (Suche belastet den `google`-Eimer), **2.11** (Sicherung der Redis, vor jedem Tarifwechsel) | | |

## 5. Was Julian einrichtet

| Was | Wo | Dauer |
|---|---|---|
| CPU je Tag und je Route ablesen (§0), danach die vier Zähler aus 2.7 | Vercel → Usage, Observability | 10 min |
| **2.4**: Firewall-Entwurf veröffentlichen (Log). ~~UptimeRobot~~ eingerichtet 2026-10-05 (zwei Monitore, Push aufs iPhone) | Vercel | 10 min |
| **2.10**: Monatslimit im Anthropic-Konto — die einzige Grenze der Fotos, die nicht an der Redis hängt | Anthropic-Konsole | 5 min |
| **0.13** Google-Alarm und **0.3** (hebt ein Abrechnungskonto das Kontingent?) | Google Cloud | 20 min |
| Redis: Verdrängungsregel (eviction policy), Region, belegter Speicher ablesen; Preis und Weg des 250-MB-Tarifs (256 Verbindungen, 1.000 Befehle/s, 100 GB) notieren. **Bei einer Regel, die Schlüssel ohne Ablauf verdrängt, löscht ein voller Speicher Sammlungen der Leser** | Redis-Konsole über Vercel → Storage | 10 min |
| Vercel-Benachrichtigungen (Nutzung) auf eine Adresse, die das Telefon meldet | Vercel → Settings → Notifications | 5 min |
| ✅ **Ausgabenlimit** (J2) gesetzt am 2026-10-05 von Claude in Julians Chrome: das Team-Budget stand schon auf 200 USD **ohne** Pause und steht jetzt auf **100 USD mit „Pause production deployments"**, Warnungen bei 50/75/100 %, kein Webhook. ✅ **Redis** (J4) **umgestellt am 2026-10-05** nach Julians Ja zum Preis: 250 MB für **8 USD im Monat** zzgl. Steuern (nicht die rund 5 USD aus redis.io), 1.000 Befehle/s, 256 Verbindungen, 100 GB Netz. Aus der Redis-Konsole abgelesen: Region AWS eu-central-1 (Frankfurt), Redis 8.6, **Persistenz: Append-only-Datei jede Sekunde, Remote backup an, alle 24 Stunden in ein Redis-managed repo** (kam mit dem Tarif, nichts zu schalten), **Verdrängungsregel `noeviction`** — ein voller Speicher lehnt Schreiben ab, statt Sammlungen zu löschen. Belegt 3,7 MB; Netz im Monat 1,7 GB (auf Free waren das 34 % von 5 GB). Kosten stehen in `FIXED_COSTS` | Vercel, Redis-Konsole | — |

## 6. Was Julian entschieden hat (2026-10-05)

| | Frage | Entscheidung |
|---|---|---|
| **J1** | Wann Pro? | **Jetzt.** Julian wechselt im Dashboard (Settings → Billing) |
| **J2** | Ausgabenlimit auf Pro | **100 USD, Pause an.** Davor seine Frage, was den Preis treibt — die Tabelle darunter |
| **J3** | Fotos schließen, wenn die Redis schweigt? | **Ja** (2.18h) |
| **J4** | Redis auf 250 MB | **Jetzt, mit Pro** (rund 5 USD im Monat nach Redis' Preisseite; der Preis über den Marketplace steht in der Konsole). Vorher einmal sichern (2.11), auch wenn ein Tarifwechsel die Daten nicht anfassen soll |
| **J5** | Reihenfolge des Verzichts | wie in §8, aber **Sammlungen werden nie gesperrt** — `WALLS=readonly` wird nicht gebaut. Die Bremsen für die Sammlungen sind damit das Rate-Limit beim Anlegen, der Betriebsblock (2.18g) und der größere Redis-Tarif |
| **J6** | Ein Cover auf Zuruf ausblenden | **Jetzt gleich** (2.18k, nach 2.18a) |

**Was auf Pro den Preis treibt** (Frankfurt, gelesen 2026-10-05; 20 USD Guthaben im Monat sind enthalten). Der Überschlag rechnet 100.000 Wand-Besuche an einem Tag:

| Posten | Preis | Überschlag |
|---|---|---|
| CDN-Anfragen | 2,60 USD je Million | 15 Mio. ≈ 39 USD — 0, wenn „Flat Rate CDN" gilt (nach dem Wechsel unter Billing nachsehen) |
| Fast Data Transfer | 0,15 USD je GB | 300 GB ≈ 45 USD — 0 innerhalb der Pauschale (1 TB) |
| **Fluid Active CPU** | 0,184 USD je Stunde | 5 USD bei 1 s je Besuch, **über 150 USD, wenn jede kalte Wand 30 s rechnet** — dieselbe unbekannte Zahl wie in §0 |
| Funktionsaufrufe | 0,60 USD je Million | rund 2 USD |
| Fluid Provisioned Memory | 0,0152 USD je GB-Stunde | einstellig |
| Fast Origin Transfer | 0,06 USD je GB | rund 6 USD |
| ISR | 5,20 USD je Mio. Schreib-, 0,52 je Mio. Leseeinheiten | unter 1 USD |

## 7. Stufen und Auslöser

| Stufe | Auslöser | Was dann |
|---|---|---|
| **Ruhe** | unter 30 % des Ausgabenlimits | einmal im Monat 2.7 ablesen |
| **Wachsam** | 50 % des Ausgabenlimits; Redis über 125 MB oder über 128 Verbindungen; mehr als 1.000 Besuche an einem Tag; ein geplanter Anstoß in den nächsten Tagen | Sicherung der Redis (2.11), nächster Redis-Tarif (1 GB: 1.024 Verbindungen, 2.000 Befehle/s), Ausgabenlimit prüfen, andere Sitzungen deployen nur noch nach Absprache |
| **Ansturm** | UptimeRobot meldet; Vercel meldet 75 % des Limits; die Seite antwortet langsam | §8 |

## 8. Wenn es passiert

1. **Nicht deployen**, und den anderen Sitzungen sagen, dass nichts nach `origin/main` geht: ein Deploy rendert alle Seiten neu und leert vermutlich den Bild-Cache (Messung in 2.18f), mitten im Ansturm.
2. Meldet Vercel 75 % des Ausgabenlimits: ansehen, was es treibt (Usage), dann das Limit heben oder verzichten (Schritt 5) — bei 100 % pausiert die Seite, und jedes Projekt wird von Hand fortgesetzt.
3. **Redis auf den nächsten Tarif**, wenn der Betriebsblock (2.18g) Verbindungen oder Befehle an der Grenze zeigt.
4. Hinsehen: `/admin/insights`, `vercel logs --project beautifulbooks --follow`.
5. **Verzichten, in dieser Reihenfolge** — jeder Schalter ist eine Variable und ein Redeploy, also zusammen umlegen, nicht einzeln:

| Schalter | Was der Leser verliert | Was es spart |
|---|---|---|
| `INSIGHTS=off` | nichts | Redis-Befehle, Funktionsaufrufe |
| `PHOTO=off` | das Regalfoto | Geld, Funktionszeit |
| `GOOGLE_TITLE_SEARCH=off` | wenige zusätzliche Cover, Klappentexte kommen aus Open Library (6.46) | das Tageskontingent bleibt dem Verdikt |
| `HOTORNOT=off` | das Spiel | Redis |

Sammlungen der Leser werden nicht gesperrt (J5).

6. Weist Open Library ab, tut der Automat aus 2.18e seine Arbeit; mehr ist nicht zu tun außer einer Mail an Open Library, wer wir sind und was gerade geschieht.
7. Danach: Zahlen in die Historie, Schalter zurück, J4 und der Tarif neu entscheiden.

## 9. Was der Plan nicht löst

- **Open Library bleibt die Lebensader.** Suche und neue Bücher brauchen den Katalog; 2.18e und 6.45 halten die Einstiegsseiten, nicht die Suche. Der Weg darüber hinaus ist ein eigener Bestand aus dem Dump (0.10, 0.14).
- **Inhalte von Lesern.** Sammlungen erscheinen ohne Durchsicht (5.13d); bei tausend neuen am Tag reicht Julians Seite zum Zurücknehmen nicht. Eine Notbremse dafür gibt es nach J5 nicht; es bleibt das Rate-Limit beim Anlegen.
- **Recht.** Reichweite macht die Cover sichtbar für die, denen sie gehören (J6), und Hobby bleibt nicht-kommerziell.
- **Eine Person.** Kein Schalter legt sich selbst um; was nachts geschieht, wartet bis zum Morgen. Auf Pro heißt das: schlimmstenfalls pausiert die Seite bei 100 USD, statt für 30 Tage.

## 10. Messungen, die fehlen

Wohin die CPU ging (§0, beantwortet) · Kosten je Seitentyp (2.18b) · ~~ob ein Deploy den Bild-Cache leert~~ **ja** für Funktionsantworten — seit 2.18o stehen die Cover hinter der Bildoptimierung, deren Cache einen Deploy übersteht · wie lange ein Schalter braucht (2.18f) · ob Pro ein pausiertes Hobby-Projekt sofort zurückholt (Frage an Vercel, nicht ausprobieren) · ~~Verdrängungsregel, Region und Füllstand der Redis~~ (`noeviction`, Frankfurt, 3,7 MB; §5) · Größe von `collections:content` in Produktion · Resends Tagesgrenze (nicht nachgelesen).

## Quellen

Gelesen am 2026-10-04/05: [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Fair Use und Preise](https://vercel.com/docs/limits/fair-use-guidelines) · [Spend Management](https://vercel.com/docs/spend-management) · [CDN Cache](https://vercel.com/docs/caching/cdn-cache) (je Region, `stale-if-error` unterstützt) · [Flat Rate CDN auf Pro](https://vercel.com/changelog/flat-rate-cdn-is-now-ga-for-pro-teams) · [Vercel-Preise Frankfurt](https://vercel.com/docs/pricing/regional-pricing/fra1) · [Redis-Preise](https://redis.io/pricing/) · [Redis Cloud Essentials](https://redis.io/docs/latest/operate/rc/subscriptions/view-essentials-subscription/essentials-plan-details/). Aus dem Repository: [Risikoregister](../risiken-2026-09-12.md), [Plan 2.4](PLAN-2.4-firewall.md), [Sicherheits-Durchsicht](../sicherheit-2026-10-02.md).
