# Plan 2.18: Bereit für einen Ansturm

Stand: 2026-10-05 nachts. **Vorschlag, nichts gebaut.** Anlass: Julian, 2026-10-04: „i want to plan for virality and have everything either robust or prepared for quick change when it happens. this covers availability of the site, quotas, databases, etc". Während der Arbeit daran kam Vercels Mail: **90 % der 4 Stunden „Fluid Active CPU" sind verbraucht** — ohne dass es einen Ansturm gab. Der Plan beginnt deshalb mit dem, was diese Woche reißt (§0), und erst dann mit dem Ansturm.

Was hier „gelesen" heißt, stand am 2026-10-04/05 in der Doku des Anbieters (Quellen am Ende); „gemessen" ist am Code oder an den Produktions-Logs dieser Nacht abgelesen; alles andere ist als Überschlag gekennzeichnet.

## 0. Zuerst: die Seite steht vor der Pause

- **Gelesen:** Vercel Hobby schließt 4 CPU-Stunden ein. Die Mail sagt: bei 100 % „your projects will be automatically paused". Die Doku sagt für Hobby: „you will have to wait until 30 days have passed before you can use the feature again". Ob ein Wechsel auf Pro ein schon pausiertes Projekt sofort zurückholt, steht in keiner der gelesenen Seiten — **also vor den 100 % wechseln, nicht danach.**
- **Nicht gefunden: wohin die 3,6 Stunden gingen.** Die CLI liest CPU je Route auf Hobby nicht („Observability Plus is required"), `vercel usage` antwortet 404, und die Logs reichen eine Stunde zurück. In dieser Stunde war kaum Verkehr: 50 Anfragen in 13 Minuten, dann ein Besuch. Die Zahl steht nur im Dashboard (Usage → Fluid Active CPU je Tag; Observability → Vercel Functions je Route). **Julian liest sie ab, oder Claude liest sie in Julians Chrome.** Verdächtig, in dieser Reihenfolge: das Hashen von Covern in `/api/works?signatures=1` (jpeg-js, reines JavaScript), Lab-Läufe und die Calibre-App, die seit dem 2026-10-04 über die Website fragen, die Fotoroute (der Server bereitet das Foto auf), die Vorschaukarten (`opengraph-image`), und der Mechanismus der nächsten Zeile.
- **Gemessen, ein Verstärker:** ein einzelner Besuch von 81 Sekunden (2026-10-05, 00:09–00:11 UTC) erzeugte 139 Einträge im Laufzeit-Log, darunter 54 Bildabrufe ohne CDN-Treffer, **14 Buchseiten, die niemand geöffnet hat** (je einmal `MISS`, also neu gerendert, mit ihren Katalog-Anfragen), und je 4–6 Abrufe von `/`, `/create`, `/versus`, die bei jedem Aufruf in einer Funktion rendern. Ursache ist das Vorladen von `next/link`: jeder sichtbare Link wird geholt, in Next 16 in mehreren Teilen. 39 Dateien nutzen `<Link>`, nur `DecadeLink` schaltet es ab. Eine Sammlung mit 198 Büchern lädt beim Scrollen 198 Buchseiten vor.

**Heute zu tun:** (1) Julian liest die CPU je Tag und je Route ab. (2) Julian entscheidet J1 (§6) — bei 90 % ist die Empfehlung, **jetzt** auf Pro zu gehen. (3) Claude baut 2.18a (Vorladen aus), sobald der Stand von `origin/main` in einem Arbeitsbaum liegt.

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

Abgelesen am Code (Stand `origin/main` vom 2026-10-04); die Spalte Vercel ist ein Überschlag bis zur Messung 2.18b.

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
| **2.18f** | **Schalter, an einer Stelle beschrieben** (`.env.example`, dieser Plan §8): `WALLS=readonly` (ansehen ja, anlegen und ändern nein), `PHOTO=off`, `INSIGHTS=off`, `GOOGLE_TITLE_SEARCH=off` (die 1.000 gehören dann dem Verdikt), dazu das bestehende `HOTORNOT`. Gemessen wird, wie lange ein Schalter braucht (er wirkt erst mit einem Redeploy) und **ob ein Deploy den Bild-Cache des CDN leert** — einmal, nach einem ohnehin fälligen Deploy | ½ Tag | `WALLS=readonly` und `PHOTO=off` ändern, was K13 zählt — in der Ansicht benennen |
| **2.18g** | **Betriebsblock in `/admin/insights`:** aus `INFO` der Redis belegter Speicher, Verbindungen und Befehle je Sekunde, dazu Zahl der Sammlungen, Fotoausgaben heute, Google-Stopps heute, je mit der Grenze daneben. Nur auf Abruf, hinter dem Admin-Cookie | ½ Tag | neue Kacheln, keine neue Kennzahl über Leser |
| **2.18h** | **Fotos schließen, wenn der Speicher schweigt** — nach J3. Heute läuft ein Foto weiter, wenn Zähler und Budget nicht lesbar sind (`app/api/walls/photo/route.ts`: „a silent store does not stop a reader") | 1 h | K13 bekommt den Ausgang „store" |
| **2.18i** | **Probe unter Last, lokal:** 200 gleichzeitige Leser gegen `next start`, eine Redis mit `maxclients 30` und die Katalog-Attrappe aus 2.18b; bestanden, wenn die Seiten aus §2 ohne Fehler antworten, während Redis und Katalog abweisen. Nie gegen Produktion | ½ Tag | keine |
| **2.18j** | **Bilder länger im Browser:** `/img` antwortet mit `max-age=3600`; ein Cover unter einer Cover-ID ändert sich nicht, eine Woche spart jede Wiederkehr | 1 h | keine |
| dazu | Der Picker ohne Google (Vorschlag der Sitzung `claude/sleepy-wozniak-lodegp`, dort als 6.88 notiert — **die Nummer ist auf `main` schon vergeben**), 6.47 (Suche belastet den `google`-Eimer), **2.11** (Sicherung der Redis, vor jedem Tarifwechsel) | | |

## 5. Was Julian einrichtet

| Was | Wo | Dauer |
|---|---|---|
| CPU je Tag und je Route ablesen (§0), danach die vier Zähler aus 2.7 | Vercel → Usage, Observability | 10 min |
| **2.4**: Firewall-Entwurf veröffentlichen (Log), UptimeRobot als Keyword-Monitor mit Meldung aufs Telefon | Vercel, UptimeRobot | 20 min |
| **2.10**: Monatslimit im Anthropic-Konto — die einzige Grenze der Fotos, die nicht an der Redis hängt | Anthropic-Konsole | 5 min |
| **0.13** Google-Alarm und **0.3** (hebt ein Abrechnungskonto das Kontingent?) | Google Cloud | 20 min |
| Redis: Verdrängungsregel (eviction policy), Region, belegter Speicher ablesen; Preis und Weg des 250-MB-Tarifs (256 Verbindungen, 1.000 Befehle/s, 100 GB) notieren. **Bei einer Regel, die Schlüssel ohne Ablauf verdrängt, löscht ein voller Speicher Sammlungen der Leser** | Redis-Konsole über Vercel → Storage | 10 min |
| Vercel-Benachrichtigungen (Nutzung) auf eine Adresse, die das Telefon meldet | Vercel → Settings → Notifications | 5 min |

## 6. Was Julian entscheidet

| | Frage | Empfehlung |
|---|---|---|
| **J1** | **Wann Pro?** (a) jetzt, (b) vor jedem absichtlichen Anstoß (ein Post, „My favourite books" 5.18, Hacker News), (c) erst wenn ein Alarm kommt | **(a), wegen der 90 %.** Ohne die Mail wäre es (b) gewesen. (c) heißt: ein Ansturm in einer deutschen Nacht pausiert die Seite für bis zu 30 Tage |
| **J2** | Ausgabenlimit auf Pro: Summe, und ob bei der Summe pausiert wird | 100 USD, Pause an. Die Prüfung läuft „every few minutes", die Summe kann also leicht überschritten werden |
| **J3** | Fotos schließen, wenn die Redis schweigt (2.18h)? | Ja. Es ist das Einzige, was je Nutzung Geld kostet |
| **J4** | Redis auf den 250-MB-Tarif: mit Pro zusammen, oder erst bei einem Auslöser aus §7? | Bei einem Auslöser; nach 2.18c und 2.18d trägt der freie Tarif den Alltag |
| **J5** | Die Reihenfolge des Verzichts im Ernstfall (§8) | wie dort |
| **J6** | Ein Weg, ein Cover auf Zuruf auszublenden (offen seit dem Risikoregister, Abschnitt C) — mit Reichweite kommt die erste Anfrage eines Rechteinhabers | bauen, bevor absichtlich angestoßen wird |

## 7. Stufen und Auslöser

| Stufe | Auslöser | Was dann |
|---|---|---|
| **Ruhe** | kein Zähler über 30 % | einmal im Monat 2.7 ablesen |
| **Wachsam** | ein Hobby-Zähler über 50 %; Redis über 15 MB oder über 20 Verbindungen; mehr als 1.000 Besuche an einem Tag; ein geplanter Anstoß in den nächsten Tagen | Pro (falls noch Hobby), Sicherung der Redis (2.11), Redis-Tarif, andere Sitzungen deployen nur noch nach Absprache |
| **Ansturm** | UptimeRobot meldet; Vercel meldet 75 % des Limits; die Seite antwortet langsam | §8 |

## 8. Wenn es passiert

1. **Nicht deployen**, und den anderen Sitzungen sagen, dass nichts nach `origin/main` geht: ein Deploy rendert alle Seiten neu und leert vermutlich den Bild-Cache (Messung in 2.18f), mitten im Ansturm.
2. Falls noch Hobby: **auf Pro** (Settings → Billing, fünf Minuten), Ausgabenlimit nach J2.
3. **Redis auf 250 MB**, wenn der Betriebsblock (2.18g) Verbindungen oder Befehle an der Grenze zeigt.
4. Hinsehen: `/admin/insights`, `vercel logs --project beautifulbooks --follow`.
5. **Verzichten, in dieser Reihenfolge** — jeder Schalter ist eine Variable und ein Redeploy, also zusammen umlegen, nicht einzeln:

| Schalter | Was der Leser verliert | Was es spart |
|---|---|---|
| `INSIGHTS=off` | nichts | Redis-Befehle, Funktionsaufrufe |
| `PHOTO=off` | das Regalfoto | Geld, Funktionszeit |
| `GOOGLE_TITLE_SEARCH=off` | wenige zusätzliche Cover, Klappentexte kommen aus Open Library (6.46) | das Tageskontingent bleibt dem Verdikt |
| `HOTORNOT=off` | das Spiel | Redis |
| `WALLS=readonly` | neue Sammlungen; bestehende bleiben sichtbar | Redis-Speicher, Katalog-Anfragen |

6. Weist Open Library ab, tut der Automat aus 2.18e seine Arbeit; mehr ist nicht zu tun außer einer Mail an Open Library, wer wir sind und was gerade geschieht.
7. Danach: Zahlen in die Historie, Schalter zurück, J4 und der Tarif neu entscheiden.

## 9. Was der Plan nicht löst

- **Open Library bleibt die Lebensader.** Suche und neue Bücher brauchen den Katalog; 2.18e und 6.45 halten die Einstiegsseiten, nicht die Suche. Der Weg darüber hinaus ist ein eigener Bestand aus dem Dump (0.10, 0.14).
- **Inhalte von Lesern.** Sammlungen erscheinen ohne Durchsicht (5.13d); bei tausend neuen am Tag reicht Julians Seite zum Zurücknehmen nicht. `WALLS=readonly` ist die Notbremse, keine Moderation.
- **Recht.** Reichweite macht die Cover sichtbar für die, denen sie gehören (J6), und Hobby bleibt nicht-kommerziell.
- **Eine Person.** Kein Schalter legt sich selbst um; was nachts geschieht, wartet bis zum Morgen. Deshalb J1.

## 10. Messungen, die fehlen

Wohin die CPU ging (§0) · Kosten je Seitentyp (2.18b) · ob ein Deploy den Bild-Cache leert und wie lange ein Schalter braucht (2.18f) · ob Pro ein pausiertes Hobby-Projekt sofort zurückholt (Frage an Vercel, nicht ausprobieren) · Verdrängungsregel, Region und Füllstand der Redis (§5) · Größe von `collections:content` in Produktion · Resends Tagesgrenze (nicht nachgelesen).

## Quellen

Gelesen am 2026-10-04/05: [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Fair Use und Preise](https://vercel.com/docs/limits/fair-use-guidelines) · [Spend Management](https://vercel.com/docs/spend-management) · [CDN Cache](https://vercel.com/docs/caching/cdn-cache) (je Region, `stale-if-error` unterstützt) · [Flat Rate CDN auf Pro](https://vercel.com/changelog/flat-rate-cdn-is-now-ga-for-pro-teams) · [Redis Cloud Essentials](https://redis.io/docs/latest/operate/rc/subscriptions/view-essentials-subscription/essentials-plan-details/). Aus dem Repository: [Risikoregister](../risiken-2026-09-12.md), [Plan 2.4](PLAN-2.4-firewall.md), [Sicherheits-Durchsicht](../sicherheit-2026-10-02.md).
