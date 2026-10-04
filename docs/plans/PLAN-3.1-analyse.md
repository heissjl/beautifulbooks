# Plan 3.1: Kennzahlen und Analyse-Ansicht

Stand: 2026-10-04, **gebaut** (3.1a, 3.1b und die Händlersuchen über `/go/`; Branch, nicht deployt). Abweichungen vom Plan stehen jeweils dabei. Ort entschieden 2026-10-04 (online, §8). Julian: „mache erst einen plan was für kpis du bauen würdest und wie das analyse-dashboard aussieht". Ersetzt die Skizze in ROADMAP 3.1 und den Abschnitt nach B4 in [PLAN-B](PLAN-B.md). Mock-up mit **Beispieldaten**: [PLAN-3.1-analyse-mockup.html](PLAN-3.1-analyse-mockup.html) (im Browser öffnen; hell und dunkel).

## 1. Grundsatz

**Keine Kennzahl ohne die Entscheidung, die sie auslöst.** Absprungrate, Sitzungsdauer und Seiten je Besuch fehlen deshalb mit Absicht: keine davon ändert, was gebaut wird. Jede Zeile in §3 nennt die Entscheidung und eine Schwelle, ab der sie fällig wird.

**Nichts über den Leser** (E14, N11, F5): keine Kennung, kein Cookie, keine IP, kein User-Agent, kein Referrer im Speicher. Gespeichert werden **Summen je Tag**, keine Ereignisliste. Was nicht gespeichert wird, kann nicht verknüpft werden — darum trägt jedes Ereignis alles, was es braucht, selbst (§4).

## 2. Eine Korrektur vorweg: was der Server zählen kann

Am selben Tag in ROADMAP 3.1 stand, die Hälfte der Fragen brauche keinen Code im Browser. **Das stimmt nicht.** `/api/search`, `/api/works/[id]` und `/api/isbn/[isbn]` antworten mit `s-maxage=86400` (gelesen in den Routen), Vercels CDN beantwortet also jede Wiederholung derselben Anfrage einen Tag lang selbst; ein Zähler in der Route sähe nur die Fehltreffer des Caches — eine beliebte Suche zählte einmal am Tag. Die Buchseite selbst ist ISR (`revalidate = 86400`), dasselbe Problem. **Exakt zählt der Server nur `/go/`** (`no-store`, jede Weiterleitung läuft durch die Funktion). Alles andere kommt aus dem Browser.

Das ist kein Nachteil: ein Signal aus dem Browser braucht JavaScript, Crawler senden es fast nie, und der `/go/`-Zähler dient als Eichung — die Zahl der Buchseiten-Besuche „mit Klick zum Händler" aus dem Browser muss nahe an den Klicks aus `/go/` liegen; der Abstand ist der Verlust der Signale (§7).

## 3. Die Kennzahlen

Wöchentlich gelesen, Zeitraum wählbar (7 / 30 / 90 Tage), Vergleich mit dem Zeitraum davor.

| # | Kennzahl | Definition | Quelle | Entscheidung, die sie auslöst |
|---|---|---|---|---|
| **K1** | **Klickrate der Buchseite** (die Leitzahl) | Buchseiten-Besuche mit ≥ 1 Klick zum Händler ÷ Buchseiten-Besuche | Signal `book` | Trägt der Shop-Modus? Unter 2 % nach vier Wochen mit ≥ 500 Besuchen: Händlerliste und Verdikt ansehen, bevor Partnerprogramme beworben werden. Ist die Zahl, die eine Bewerbung bei Awin oder Amazon glaubwürdig macht |
| K2 | Buchseiten-Besuche | Anzahl Signale `book` | Signal `book` | Nenner von K1; Herkunft (K9) |
| K3 | Klicks zum Händler je Händler × Markt × Linkart (Produkt, Suche nach ISBN, Titelsuche) | Zähler in `/go/` — nach dem Umbau in §4 auch für Titelsuchen | Server, exakt | Reihenfolge der Händler (1.2, 3.3); welches Programm zuerst (4.1–4.3). Ein Händler unter 2 % Anteil nach 90 Tagen wandert hinter die Klappe |
| K4 | Weg zum Kauf | Besuch → Wand geladen (≥ 1 Seite) → Cover gewählt → Klick zum Händler, je als Anteil | Signal `book` | Wo der Weg bricht: vor „Cover gewählt" ist es die Wand (6.3 Laden, Faltung), danach die Händlerliste |
| K5 | Suche ohne Ergebnis | Anteil Suchen mit 0 Treffern, **getrennt** von Suchen, deren Quelle ausfiel | Signal `search` | Leer → Kuratierung, Tippfehler (6.5); ausgefallen → Open Library (1.4, N12). Ausgefallen über 3 % an einem Tag ist ein Betriebsfehler |
| K6 | Klickposition in der Suche | Verteilung 1 / 2 / 3 / 4–10 / mehr / kein Klick | Signal `search` | Ranking (alte §9.3 Schritt 10): Liegt Position 1 unter 50 %, stimmt die Reihenfolge nicht |
| K7 | Cover gesehen vor dem Verlassen | Verteilung der im Bild gewesenen Kacheln je Besuch, in Klassen; dazu Anteil „nur Seite 0" | Signal `book` | Paging und Faltung (6.3, 6.4): Verlässt die Mehrheit nach unter 13 Covern, ist die erste Reihe die ganze Seite — dann zählt die erste Reihe (Startseite, 6.17), nicht die Vollständigkeit |
| K8 | Verdikt und Kauf | je Verdikt (`same`, `differs`, `unknown`, `unavailable`): Auswahlen und Klickrate danach | Signal `book` | Wird das Verdikt gelesen? Liegt die Klickrate nach `differs` nicht unter der nach `same`, wirkt der Satz nicht — Wortlaut (`lib/verdicts.ts`) überdenken |
| K9 | Herkunft der Buchseiten-Besuche | Startseite / Suche / Sammlung / andere Buchseite / Suchmaschine / sozial / andere / direkt | Signal `book`, im Browser zur Klasse verdichtet | Welche Gattung trägt (5.7); ob 2.5 wirkt |
| K10 | Werke | Top 20 nach Besuchen, mit K1 je Werk; dazu Suchbegriffe ohne Ergebnis (§6) | Signale `book`, `search` | Liste für die Kuratierung (5.1, 6.18) |
| K11 | Betrieb | Google-Tagesstopps (`dailyLimitExceeded`), Ausfälle Open Library je Tag | Server, exakt (zählt Ereignisse, nicht Anfragen) | 0.3, 0.7, 4.5. **Den Google-Verbrauch selbst kann der Code nicht zählen** (Datencache, CLAUDE.md) — er steht in der Cloud-Konsole (0.13); die Ansicht verlinkt dorthin, statt eine falsche Zahl zu zeigen |
| K12 | Gemeinschaft | Stimmen im Spiel, neue Sammlungen, Vorschläge je Tag | Bestand in Redis | 5.8b, das Tor aus 5.13a (30 Sammlungen mit ≥ 6 Covern in vier Wochen) |

**Nicht hier, mit Grund:** Aufrufe, Länder, Geräte, Referrer im Einzelnen — das zeigt Vercel Web Analytics schon (2.1), nachbauen wäre doppelt. Suchanfragen *bei Google* und Positionen dort — Search Console (2.5). **Umsatz** — nur die Partner-Dashboards kennen ihn; mit dem Shop-Modus kommt eine Spalte „Provision je 100 Klicks" je Händler dazu, monatlich von Hand übertragen (3.3), nicht im Repository.

## 4. Die Signale

Zwei Signale aus dem Browser, je **eines pro Seitenbesuch**, gesendet beim Verlassen (`visibilitychange` → `hidden`, einmal je Besuch, `navigator.sendBeacon`), plus der Zähler in `/go/`. Ein Signal fasst den Besuch zusammen; deshalb lassen sich K4, K7 und K8 ohne Kennung berechnen.

**`book`** — `components/BookDetail.tsx`, ein Besuch der Buchseite:

| Feld | Werte |
|---|---|
| `work` | Open-Library-Werk-ID (öffentlich, keine Person) |
| `from` | `home`, `search`, `collection`, `book`, `engine`, `social`, `other`, `direct` — im Browser aus `document.referrer` bestimmt; der Referrer selbst verlässt den Browser nicht |
| `market` | `us`, `uk`, `de` |
| `pages` | geladene Seiten der Wand: 1, 2, 3, 4+ |
| `seen` | Kacheln, die zu ≥ 50 % im Bild waren (IntersectionObserver): `0–12`, `13–40`, `41–100`, `101–250`, `250+` |
| `picked` | ein Cover gewählt: ja/nein |
| `verdict` | das letzte gezeigte Verdikt oder keins |
| `bought` | ≥ 1 Klick zum Händler: ja/nein |

**`search`** — die Startseite mit `?q=` oder `?author=`:

| Feld | Werte |
|---|---|
| `outcome` | `results`, `empty`, `failed` |
| `count` | `1`, `2–5`, `6–20`, `20+` |
| `clicked` | Position der angeklickten Karte: `1`, `2`, `3`, `4–10`, `11+`, `none` |
| `mode` | `title`, `author`, `isbn` |
| `q` | **nur bei `empty`**: die normalisierte Anfrage (Kleinbuchstaben, ≤ 80 Zeichen) |

**`/go/`** — der vorhandene `recordClick` zählt zusätzlich `provider|market|kind` in Redis; die Logzeile `bb.click` bleibt.

**Was als „Klick zum Händler" zählt, und wie** (Julian, 2026-10-04: „wie zählen wir den kaufklick"). Das Wort im Mock-up war falsch: **gezählt wird ein Klick auf einen Händler-Link, kein Kauf.** Ob gekauft wurde, weiß nur der Händler; im Shop-Modus steht es im Partner-Dashboard (3.3). Die Ansicht heißt die Stufe deshalb „Klick zum Händler".

Heute laufen **nur die Links, die aus einer ISBN gebaut sind,** über `/go/` (`ShopLink` in `components/BookDetail.tsx`, `counted`). Gelesen am 2026-10-04, **ungezählt** sind:
- die **Titelsuchen** bei Händlern (`searchLinksFor`, `-title`-Provider) — gerade für Drucke ohne ISBN, also die alten Ausgaben, und im Shop-Modus tragen sie die Partnerkennung mit (`searchUrl(query, affiliate)`): Klicks, die Geld bringen können, ohne gezählt zu werden;
- „Or read it in another edition" (`plan.anyEdition`);
- „Find this exact cover" (AbeBooks, eBay, Lens, TinEye, WorldCat), die lokalen Buchhandlungen (5.12) und Google-Vorschau.

Daraus zwei Wege, je nach Art des Links (Aufwand zusammen etwa zwei Stunden, ohne Entscheidung Julians; Vorschlag 2026-10-04: AbeBooks und eBay unter „Find this exact cover“ sind Händler und laufen wie Weg 1 über `/go/`, Lens, TinEye und WorldCat nicht):
1. **Händler-Links ohne ISBN durch `/go/` schicken** (Server, exakt): `/go/<provider>/title?q=<Titel Autor>&market=<m>`. Die Route baut das Ziel mit `searchUrl` aus der Tabelle — Host und Pfad kommen aus `lib/buylinks.ts`, aus der Anfrage nur der Suchtext, der als Parameter kodiert wird; damit bleibt es **keine offene Weiterleitung** (CLAUDE.md). Gezählt als `kind=title`. Ein Test: ein Suchtext mit `//`, `@` oder einer URL landet als Suchtext beim Händler, nie als Ziel.
2. **Alles, was kein Händler ist** (Find this cover, lokale Läden, Vorschau), zählt nur das Signal `book` im Browser, als eigenes Feld `found` (ja/nein), nicht als Klick zum Händler.

**Wie der Browser den Klick merkt:** ein Listener auf der Buchseite für `click` und `auxclick` (Mittelklick, „in neuem Tab öffnen" über Tastatur) auf Links, deren `href` mit `/go/` beginnt, setzt `bought=1` im Besuch; gesendet wird beim Verlassen wie alles andere. Ein Rechtsklick → „Link kopieren" zählt nicht, ein Doppelklick einmal im Signal, zweimal in `/go/` (zwei Weiterleitungen).

**Warum beide Zahlen, Server und Browser:** `/go/` zählt Klicks exakt, kennt aber den Besuch nicht (keine Kennung) — er sagt „287 Klicks", nicht „in wie vielen Besuchen". Das Signal kennt den Besuch, verliert aber Meldungen. Die Klickrate (K1) kommt aus dem Signal; der Abgleich beider ist die Erfassungsquote. Crawler fallen bei `/go/` fast ganz heraus (`robots.txt` sperrt `/go/`, `target=_blank`-Links werden nicht vorgeladen).

**Im Shop-Modus** kommt eine Herkunftsangabe *an den Händler* dazu, wo das Programm sie erlaubt (Awin `clickref`, Impact `subId`, Amazon eigene Tracking-IDs je Seitentyp): nur der **Seitentyp** (`book`, `collection`, `decades`), nie etwas über den Leser. Dann zeigt das Dashboard des Partners, welche Seitenart Käufe bringt, und 3.3 kann Klicks und Käufe je Händler und Seitentyp nebeneinanderlegen.

**Der Empfänger** `POST /api/seen` (bewusst kein Name wie `track`, `event`, `analytics`, den Werbeblocker-Listen sperren): nimmt nur JSON bis 1 KB, prüft jedes Feld gegen die feste Liste oben und verwirft alles andere stumm (204), Rate-Limit-Bucket `seen` (60/min je IP, wie die übrigen pro Instanz), antwortet immer 204 — auch wenn der Speicher schweigt, denn ein Leser darf nie merken, dass gezählt wird oder nicht. Nur in Production (`VERCEL_ENV`), nie unter `next dev` und nie in Previews; dort ein `DEBUG`-Log.

**Julians eigene Besuche** zählen nicht, solange sein Admin-Cookie `bb_admin` gilt: `/api/seen` und `/go/` prüfen es auf dem Server. *Gebaut anders als geplant (2026-10-04):* der Plan wollte einen Schalter `bb.self` in `localStorage` — aber dafür hätte die Seite auf **jedem** Gerät `localStorage` auslesen müssen, und genau das ist der Zugriff, den § 25 TDDDG meint. Das Cookie gibt es ohnehin nur auf Julians Geräten.

## 5. Speicher

Die Redis des Spiels (F7.3), über `commandsFromEnv` aus `lib/hotornot/store.ts`; ein neues Modul `lib/insights/` mit reinem Teil (Prüfen der Felder, Schlüssel bauen; getestet) und Serverteil (Schreiben).

- Je Tag (UTC) ein Hash je Signal: `ins:<yyyy-mm-dd>:book`, Feld = die Kombination der Klassen (`from=search|pages=2|seen=13-40|picked=1|verdict=same|bought=0|market=de`), Wert = Anzahl, `HINCRBY`. Die Kombinationen sind endlich (einige Hundert), der Hash bleibt klein. Werk-IDs in einem eigenen Hash `ins:<tag>:works` (`<id>|bought`).
- `ins:<tag>:clicks` (`provider|market|kind`), `ins:<tag>:search`, `ins:<tag>:empty` (Anfrage → Anzahl), `ins:<tag>:ops` (`google-stop`, `ol-failed`).
- Aufbewahrung: `EXPIRE` 400 Tage auf jedem Tageshash, **90 Tage** auf `empty`.
- Je Signal ein Pipeline-Aufruf mit 2–3 Befehlen. Bei 1.000 Besuchen am Tag rund 3.000 Befehle und unter 1 MB im Jahr — vor dem Bau am Konto der Redis ablesen, welches Kontingent gilt (die Verbindung ist eine direkte `redis://`-Adresse, `STORAGE_REDIS_URL`).
- Ausgelesen wird nur über `GET /api/insights?from=&to=` hinter dem Admin-Cookie `bb_admin` (die Seite) bzw. dem Admin-Passwort als Bearer (das Cockpit), `no-store`; summiert die Tage auf dem Server und liefert fertige Kennzahlen.

## 6. Datenschutz

Was den Browser verlässt, steht vollständig in §4; nichts davon bezieht sich auf eine Person, und gespeichert wird nur die Summe. Die IP sieht die Funktion wie bei jeder Anfrage, sie wird weder gespeichert noch geloggt. Satz für die Datenschutzerklärung (Entwurf, Julian prüft):

> When you leave a book page or a search, your browser sends one anonymous summary — for example which book, how many covers came into view, whether a shop link was used — and the site adds it to daily totals. No identifier, cookie, IP address or referrer is stored, so a summary cannot be linked to you or to another visit. Searches that found nothing are kept as text for 90 days to improve the catalogue.

**Kein Einwilligungsbanner, nach Claudes Einschätzung (2026-10-04, keine Rechtsberatung):** § 25 TDDDG verlangt eine Einwilligung, wenn auf dem Gerät des Lesers Informationen *gespeichert* oder dort gespeicherte *ausgelesen* werden. Das Signal speichert nichts auf dem Gerät (kein Cookie, kein localStorage) und liest nur, was die Seite ohnehin im Speicher hat (welche Kacheln im Bild waren, ob geklickt wurde); `document.referrer` wird im Browser zur Klasse verdichtet. Wer es strenger liest, könnte das Auslesen des Referrers als Zugriff werten; dann fiele die Herkunft (K9) weg, der Rest bliebe. Gegen [docs/recht-hobbyseite.md](../recht-hobbyseite.md) §4 gehalten (2026-10-04): dieselbe Begründung trägt dort Vercel Web Analytics, das den Referrer ebenfalls im Browser liest; das Signal steht dort jetzt als eigene Zeile.

**Der Satz auf Deutsch** (für `lib/i18n/de.ts`, Entwurf): „Wenn du eine Buchseite oder eine Suche verlässt, schickt dein Browser eine anonyme Zusammenfassung — etwa welches Buch, wie viele Cover zu sehen waren, ob ein Shop-Link benutzt wurde —, und die Seite zählt sie zu Tagessummen. Eine Kennung, ein Cookie, die IP-Adresse oder der Referrer werden nicht gespeichert; eine Zusammenfassung lässt sich also weder dir noch einem anderen Besuch zuordnen. Suchen ohne Ergebnis werden 90 Tage als Text aufbewahrt, um den Katalog zu verbessern."

**Die Suchbegriffe ohne Ergebnis sind die einzige freie Eingabe**, die gespeichert wird; ein Leser könnte einen Namen eintippen. Deshalb nur bei `empty`, nur 90 Tage, und die Ansicht zeigt einen Begriff erst ab **zwei** gleichen Anfragen. Julian entscheidet, ob das bleibt (§9).

## 7. Grenzen, ehrlich

- **Verlust der Signale:** `sendBeacon` beim Verlassen geht auf Telefonen öfter verloren (Tab im Hintergrund getötet). Gemessen wird der Verlust, nicht geschätzt: `bought=1` aus den Signalen gegen die Klicks aus `/go/`. Die Ansicht zeigt den Abstand als „Signale erfasst: ~x %".
- **Werbeblocker** blockieren eine Anfrage an die eigene Domain mit neutralem Pfad selten; nicht null.
- **Bots** führen selten JavaScript aus; wer `/api/seen` gezielt füttert, verschiebt die Zahlen. Das Rate-Limit begrenzt es, ein Sprung über das Zehnfache des Wochenmittels wird in der Ansicht markiert statt verborgen.
- **Kleine Zahlen** sind keine Befunde: unter 100 Besuchen im Zeitraum zeigt die Ansicht Anteile grau und mit „zu wenig Daten" (N12 sinngemäß: ein Rauschen ist kein Ergebnis).

## 8. Die Ansicht

**Wo: online, unter `/admin/insights`** (Julian, 2026-10-04: „ich glaub ich will es schon auch online" — die Empfehlung „nur im Cockpit" ist damit verworfen; Grund war das Telefon). Dafür ist fast alles schon da:
- **Anmeldung: der vorhandene Admin-Zugang.** `/curate` setzt nach dem Admin-Passwort (`SUGGEST_ADMIN_PASSWORD`) das Cookie `bb_admin`, sieben Tage gültig, HMAC über das Ablaufdatum, ohne Angabe über die Person (`lib/suggest/auth.ts`, `adminSignedIn()` in `session.ts`); `/create/review` (5.13d) und das Veröffentlichen aus `/curate` (5.10g) prüfen es schon. Die Analyse prüft dasselbe — **kein neues Passwort, kein `INSIGHTS_TOKEN`, keine neue Anmeldeseite.** Ohne gültiges Cookie antwortet die Seite **404**, nicht 401, damit sie sich nicht ankündigt; `noindex`, `force-dynamic`, `Cache-Control: no-store`, nicht in der Sitemap, `/admin/` in `robots.txt` gesperrt.
- **Eine Kopplung, die vorher zu lösen ist:** `adminSessionValid` verlangt heute zusätzlich `SUGGEST_PASSWORD` (das Passwort der Freunde) — ohne `/suggest` gäbe es also keine Analyse. Claude trennt das: eine Funktion `adminEnabled()` hängt nur an `SUGGEST_ADMIN_PASSWORD`; `/suggest` und `/curate` behalten ihre eigene Bedingung. Ein Test hält beides fest.
- **Daten:** die Seite ist eine Server-Komponente und liest Redis direkt (ein Pipeline-Aufruf mit `HGETALL` je Tag und Hash, bei 90 Tagen rund 500 Befehle je Aufruf; Ergebnis 5 Minuten im Speicher der Funktion). Der JSON-Endpunkt `/api/insights` bleibt für das Cockpit, mit dem Admin-Passwort als Bearer, wie das Cockpit die Produktion schon heute fragt.
- **Das Telefon** ist der Grund für online: die Ansicht folgt N14 (390 × 844 und 1280 × 800); das Mock-up ist bei beiden Breiten angesehen, ohne seitliches Scrollen.
- **Eigene Besuche:** zählen nicht, solange das Admin-Cookie gilt (sieben Tage nach der Anmeldung auf `/curate`); auf einem Gerät ohne Anmeldung zählt Julian wie ein Leser.
- **Was das Risiko ist:** die Analyse zeigt nur Summen und Suchbegriffe ohne Ergebnis, nichts über Leser; ein erratenes Admin-Passwort öffnete aber auch `/curate` und die Moderation — das gilt schon heute, die Analyse vergrößert es nicht. Das Passwort lang wählen; die Anmeldung läuft durch das Rate-Limit der Login-Route.

**Aufbau** (Mock-up: [PLAN-3.1-analyse-mockup.html](PLAN-3.1-analyse-mockup.html)), von oben nach unten in der Reihenfolge, in der eine Woche gelesen wird:

1. **Filterzeile**: Zeitraum (7 / 30 / 90 Tage), Markt (alle / US / UK / DE). Gilt für alles darunter.
2. **Leitzahl K1** groß, mit Veränderung zum Vorzeitraum; daneben vier Kacheln: Buchseiten-Besuche, Klicks zum Händler, Suchen, Suche ohne Ergebnis — je mit Verlauf als kleine Linie.
3. **Verlauf je Tag**: Besuche und Klicks zum Händler als zwei Diagramme übereinander mit gemeinsamer Zeitachse (keine zweite y-Achse).
4. **Weg zum Kauf** (K4): vier Balken, Anteil je Stufe, der größte Abfall benannt.
5. **Händler** (K3): Tabelle mit Balken je Zeile — Händler, Markt, Klicks, Anteil, Produkt- vs. Suchlink; später „Provision je 100 Klicks".
6. **Suche** (K5, K6): Klickposition als Balken; leer und ausgefallen getrennt; Liste der Begriffe ohne Ergebnis.
7. **Wand und Verdikt** (K7, K8): Cover gesehen als Verteilung; Tabelle Verdikt → Auswahlen → Klickrate.
8. **Werke und Herkunft** (K9, K10).
9. **Betrieb und Gemeinschaft** (K11, K12): Statuszeilen mit Symbol und Wort, Link zur Cloud-Konsole für den Google-Verbrauch.

Unter jedem Abschnitt eine Zeile „gezählt wird …", damit niemand eine Zahl für mehr hält, als sie ist.

## 9. Was Julian entscheidet

1. ~~**Ort**~~ — entschieden 2026-10-04: online unter `/admin/insights`, hinter dem vorhandenen Admin-Zugang; das Cockpit liest denselben Endpunkt.
2. ~~**Suchbegriffe ohne Ergebnis**~~ — entschieden 2026-10-04 (Julian: „ok“ auf die Empfehlung): **als Text speichern**, nur bei null Treffern, 90 Tage, gezeigt ab zwei gleichen Anfragen.
3. ~~**Der Satz**~~ — entschieden 2026-10-04 (Julian: „ok i guess“): der Entwurf aus §6, englisch und deutsch, so wie er steht. **Kein Einwilligungsbanner** (Julian: „erstmal keins“) — die Einschätzung zu § 25 TDDDG in §6 gilt, bis jemand fragt; dann fällt als Erstes die Herkunft (K9) weg.
4. ~~Ein `INSIGHTS_TOKEN`~~ — entfällt, der Admin-Zugang genügt. Zu prüfen ist nur, dass `SUGGEST_ADMIN_PASSWORD` in Production gesetzt und lang ist.

## 10. Bau, Reihenfolge, Aufwand

| Schritt | Was | Aufwand | Wann |
|---|---|---|---|
| 3.1a | `/go/`-Zähler in Redis, `lib/insights/` (rein + Server, Tests), `adminEnabled()` von `/suggest` getrennt, `/admin/insights` und `/api/insights`, K3 und K11 in der Ansicht | ¾ Tag | **sofort** — jeder Tag ohne ihn ist ein Tag ohne Klickzahlen; vor jeder Partnerbewerbung |
| 3.1b | `/api/seen`, die Signale `book` und `search`, K1, K2, K4–K10, Eichung gegen `/go/`, Datenschutzsatz | 1 Tag | nach Julians Entscheidungen §9; sinnvoll, sobald 2.5 Besucher bringt |
| 3.1c | Spalte Provision je 100 Klicks (von Hand), K12 aus den vorhandenen Beständen | 2 h | mit dem Shop-Modus |

Prüfen: Tests für Feldprüfung, Schlüssel und Summen (keine Netzaufrufe, Redis gemockt); unter `next dev` mit `DEBUG` die Signale sehen; nach dem Deploy **einmal** einen Besuch ohne Admin-Cookie (privates Fenster) mit einem `/go/`-Klick machen und in der Ansicht wiederfinden — nicht pollen.
