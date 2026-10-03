# Plan 3.1: Kennzahlen und Analyse-Ansicht

Stand: 2026-10-03, **offen**, nichts gebaut. Julian: „mache erst einen plan was für kpis du bauen würdest und wie das analyse-dashboard aussieht". Ersetzt die Skizze in ROADMAP 3.1 und den Abschnitt nach B4 in [PLAN-B](PLAN-B.md). Mock-up mit **Beispieldaten**: [PLAN-3.1-analyse-mockup.html](PLAN-3.1-analyse-mockup.html) (im Browser öffnen; hell und dunkel).

## 1. Grundsatz

**Keine Kennzahl ohne die Entscheidung, die sie auslöst.** Absprungrate, Sitzungsdauer und Seiten je Besuch fehlen deshalb mit Absicht: keine davon ändert, was gebaut wird. Jede Zeile in §3 nennt die Entscheidung und eine Schwelle, ab der sie fällig wird.

**Nichts über den Leser** (E14, N11, F5): keine Kennung, kein Cookie, keine IP, kein User-Agent, kein Referrer im Speicher. Gespeichert werden **Summen je Tag**, keine Ereignisliste. Was nicht gespeichert wird, kann nicht verknüpft werden — darum trägt jedes Ereignis alles, was es braucht, selbst (§4).

## 2. Eine Korrektur vorweg: was der Server zählen kann

Am selben Tag in ROADMAP 3.1 stand, die Hälfte der Fragen brauche keinen Code im Browser. **Das stimmt nicht.** `/api/search`, `/api/works/[id]` und `/api/isbn/[isbn]` antworten mit `s-maxage=86400` (gelesen in den Routen), Vercels CDN beantwortet also jede Wiederholung derselben Anfrage einen Tag lang selbst; ein Zähler in der Route sähe nur die Fehltreffer des Caches — eine beliebte Suche zählte einmal am Tag. Die Buchseite selbst ist ISR (`revalidate = 86400`), dasselbe Problem. **Exakt zählt der Server nur `/go/`** (`no-store`, jede Weiterleitung läuft durch die Funktion). Alles andere kommt aus dem Browser.

Das ist kein Nachteil: ein Signal aus dem Browser braucht JavaScript, Crawler senden es fast nie, und der `/go/`-Zähler dient als Eichung — die Zahl der Buchseiten-Besuche „mit Kauf-Klick" aus dem Browser muss nahe an den Klicks aus `/go/` liegen; der Abstand ist der Verlust der Signale (§7).

## 3. Die Kennzahlen

Wöchentlich gelesen, Zeitraum wählbar (7 / 30 / 90 Tage), Vergleich mit dem Zeitraum davor.

| # | Kennzahl | Definition | Quelle | Entscheidung, die sie auslöst |
|---|---|---|---|---|
| **K1** | **Klickrate der Buchseite** (die Leitzahl) | Buchseiten-Besuche mit ≥ 1 Kauf-Klick ÷ Buchseiten-Besuche | Signal `book` | Trägt der Shop-Modus? Unter 2 % nach vier Wochen mit ≥ 500 Besuchen: Händlerliste und Verdikt ansehen, bevor Partnerprogramme beworben werden. Ist die Zahl, die eine Bewerbung bei Awin oder Amazon glaubwürdig macht |
| K2 | Buchseiten-Besuche | Anzahl Signale `book` | Signal `book` | Nenner von K1; Herkunft (K9) |
| K3 | Kauf-Klicks je Händler × Markt × Linkart | Zähler in `/go/` | Server, exakt | Reihenfolge der Händler (1.2, 3.3); welches Programm zuerst (4.1–4.3). Ein Händler unter 2 % Anteil nach 90 Tagen wandert hinter die Klappe |
| K4 | Weg zum Kauf | Besuch → Wand geladen (≥ 1 Seite) → Cover gewählt → Kauf-Klick, je als Anteil | Signal `book` | Wo der Weg bricht: vor „Cover gewählt" ist es die Wand (6.3 Laden, Faltung), danach die Händlerliste |
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
| `bought` | ≥ 1 Kauf-Klick: ja/nein |

**`search`** — die Startseite mit `?q=` oder `?author=`:

| Feld | Werte |
|---|---|
| `outcome` | `results`, `empty`, `failed` |
| `count` | `1`, `2–5`, `6–20`, `20+` |
| `clicked` | Position der angeklickten Karte: `1`, `2`, `3`, `4–10`, `11+`, `none` |
| `mode` | `title`, `author`, `isbn` |
| `q` | **nur bei `empty`**: die normalisierte Anfrage (Kleinbuchstaben, ≤ 80 Zeichen) |

**`/go/`** — der vorhandene `recordClick` zählt zusätzlich `provider|market|kind` in Redis; die Logzeile `bb.click` bleibt.

**Der Empfänger** `POST /api/seen` (bewusst kein Name wie `track`, `event`, `analytics`, den Werbeblocker-Listen sperren): nimmt nur JSON bis 1 KB, prüft jedes Feld gegen die feste Liste oben und verwirft alles andere stumm (204), Rate-Limit-Bucket `seen` (60/min je IP, wie die übrigen pro Instanz), antwortet immer 204 — auch wenn der Speicher schweigt, denn ein Leser darf nie merken, dass gezählt wird oder nicht. Nur in Production (`VERCEL_ENV`), nie unter `next dev` und nie in Previews; dort ein `DEBUG`-Log.

**Julians eigene Besuche:** die Analyse-Ansicht setzt beim Öffnen in Julians Browser `localStorage['bb.self'] = 1`; die Seite sendet dann nichts. Das ist ein Schalter auf Julians Gerät, keine Kennung eines Lesers.

## 5. Speicher

Die Redis des Spiels (F7.3), über `commandsFromEnv` aus `lib/hotornot/store.ts`; ein neues Modul `lib/insights/` mit reinem Teil (Prüfen der Felder, Schlüssel bauen; getestet) und Serverteil (Schreiben).

- Je Tag (UTC) ein Hash je Signal: `ins:<yyyy-mm-dd>:book`, Feld = die Kombination der Klassen (`from=search|pages=2|seen=13-40|picked=1|verdict=same|bought=0|market=de`), Wert = Anzahl, `HINCRBY`. Die Kombinationen sind endlich (einige Hundert), der Hash bleibt klein. Werk-IDs in einem eigenen Hash `ins:<tag>:works` (`<id>|bought`).
- `ins:<tag>:clicks` (`provider|market|kind`), `ins:<tag>:search`, `ins:<tag>:empty` (Anfrage → Anzahl), `ins:<tag>:ops` (`google-stop`, `ol-failed`).
- Aufbewahrung: `EXPIRE` 400 Tage auf jedem Tageshash, **90 Tage** auf `empty`.
- Je Signal ein Pipeline-Aufruf mit 2–3 Befehlen. Bei 1.000 Besuchen am Tag rund 3.000 Befehle und unter 1 MB im Jahr — vor dem Bau am Konto der Redis ablesen, welches Kontingent gilt (die Verbindung ist eine direkte `redis://`-Adresse, `STORAGE_REDIS_URL`).
- Ausgelesen wird nur über `GET /api/insights?from=&to=` mit `Authorization: Bearer <INSIGHTS_TOKEN>`, `no-store`; summiert die Tage auf dem Server und liefert fertige Kennzahlen.

## 6. Datenschutz

Was den Browser verlässt, steht vollständig in §4; nichts davon bezieht sich auf eine Person, und gespeichert wird nur die Summe. Die IP sieht die Funktion wie bei jeder Anfrage, sie wird weder gespeichert noch geloggt. Satz für die Datenschutzerklärung (Entwurf, Julian prüft):

> When you leave a book page or a search, your browser sends one anonymous summary — for example which book, how many covers came into view, whether a shop link was used — and the site adds it to daily totals. No identifier, cookie, IP address or referrer is stored, so a summary cannot be linked to you or to another visit. Searches that found nothing are kept as text for 90 days to improve the catalogue.

**Die Suchbegriffe ohne Ergebnis sind die einzige freie Eingabe**, die gespeichert wird; ein Leser könnte einen Namen eintippen. Deshalb nur bei `empty`, nur 90 Tage, und die Ansicht zeigt einen Begriff erst ab **zwei** gleichen Anfragen. Julian entscheidet, ob das bleibt (§9).

## 7. Grenzen, ehrlich

- **Verlust der Signale:** `sendBeacon` beim Verlassen geht auf Telefonen öfter verloren (Tab im Hintergrund getötet). Gemessen wird der Verlust, nicht geschätzt: `bought=1` aus den Signalen gegen die Klicks aus `/go/`. Die Ansicht zeigt den Abstand als „Signale erfasst: ~x %".
- **Werbeblocker** blockieren eine Anfrage an die eigene Domain mit neutralem Pfad selten; nicht null.
- **Bots** führen selten JavaScript aus; wer `/api/seen` gezielt füttert, verschiebt die Zahlen. Das Rate-Limit begrenzt es, ein Sprung über das Zehnfache des Wochenmittels wird in der Ansicht markiert statt verborgen.
- **Kleine Zahlen** sind keine Befunde: unter 100 Besuchen im Zeitraum zeigt die Ansicht Anteile grau und mit „zu wenig Daten" (N12 sinngemäß: ein Rauschen ist kein Ergebnis).

## 8. Die Ansicht

**Wo:** als Ansicht im **Cockpit** (`npm run cockpit`, 6.54) statt als Seite auf der öffentlichen Website. Das Cockpit fragt die Produktion schon jetzt einmal je Erzeugung mit Bearer-Token; es läuft nur auf Julians Rechner auf 127.0.0.1, braucht also keine Anmeldeseite, kein Cookie, keine Admin-Route mit HTML im Netz. Öffentlich ist nur der JSON-Endpunkt hinter dem Token. Nachteil: nicht vom Telefon aus. Alternative: `/admin/insights` mit Passwortformular — doppelter Aufwand für die Anmeldung.

**Aufbau** (Mock-up: [PLAN-3.1-analyse-mockup.html](PLAN-3.1-analyse-mockup.html)), von oben nach unten in der Reihenfolge, in der eine Woche gelesen wird:

1. **Filterzeile**: Zeitraum (7 / 30 / 90 Tage), Markt (alle / US / UK / DE). Gilt für alles darunter.
2. **Leitzahl K1** groß, mit Veränderung zum Vorzeitraum; daneben vier Kacheln: Buchseiten-Besuche, Kauf-Klicks, Suchen, Suche ohne Ergebnis — je mit Verlauf als kleine Linie.
3. **Verlauf je Tag**: Besuche und Kauf-Klicks als zwei Diagramme übereinander mit gemeinsamer Zeitachse (keine zweite y-Achse).
4. **Weg zum Kauf** (K4): vier Balken, Anteil je Stufe, der größte Abfall benannt.
5. **Händler** (K3): Tabelle mit Balken je Zeile — Händler, Markt, Klicks, Anteil, Produkt- vs. Suchlink; später „Provision je 100 Klicks".
6. **Suche** (K5, K6): Klickposition als Balken; leer und ausgefallen getrennt; Liste der Begriffe ohne Ergebnis.
7. **Wand und Verdikt** (K7, K8): Cover gesehen als Verteilung; Tabelle Verdikt → Auswahlen → Klickrate.
8. **Werke und Herkunft** (K9, K10).
9. **Betrieb und Gemeinschaft** (K11, K12): Statuszeilen mit Symbol und Wort, Link zur Cloud-Konsole für den Google-Verbrauch.

Unter jedem Abschnitt eine Zeile „gezählt wird …", damit niemand eine Zahl für mehr hält, als sie ist.

## 9. Was Julian entscheidet

1. **Ort**: Cockpit (Empfehlung) oder `/admin` auf der Website.
2. **Suchbegriffe ohne Ergebnis** speichern (90 Tage, ab zwei gleichen gezeigt) — ja oder nur die Anzahl.
3. **Der Satz** für die Datenschutzerklärung (§6).
4. Ein **`INSIGHTS_TOKEN`** in Vercel (Production).

## 10. Bau, Reihenfolge, Aufwand

| Schritt | Was | Aufwand | Wann |
|---|---|---|---|
| 3.1a | `/go/`-Zähler in Redis, `lib/insights/` (rein + Server, Tests), `/api/insights` mit Token, K3 und K11 in der Ansicht | ½ Tag | **sofort** — jeder Tag ohne ihn ist ein Tag ohne Klickzahlen; vor jeder Partnerbewerbung |
| 3.1b | `/api/seen`, die Signale `book` und `search`, K1, K2, K4–K10, Eichung gegen `/go/`, Datenschutzsatz | 1 Tag | nach Julians Entscheidungen §9; sinnvoll, sobald 2.5 Besucher bringt |
| 3.1c | Spalte Provision je 100 Klicks (von Hand), K12 aus den vorhandenen Beständen | 2 h | mit dem Shop-Modus |

Prüfen: Tests für Feldprüfung, Schlüssel und Summen (keine Netzaufrufe, Redis gemockt); unter `next dev` mit `DEBUG` die Signale sehen; nach dem Deploy **einmal** einen eigenen Besuch mit gelöschtem `bb.self` und einen `/go/`-Klick und in der Ansicht wiederfinden — nicht pollen.
