# Umgang mit Werkzeugen und fremden Diensten

**Wozu diese Datei.** Julian, 2026-10-09: „wir wiederholen uns da mit manchen erkenntnissen und haben die best practices nicht durchgängig zentral aufgeschrieben.“ Viele Sitzungen arbeiten parallel in eigenen Worktrees, manche in der Cloud. Was eine Sitzung über ein Werkzeug oder eine fremde Seite gelernt hat, stand bisher an vier Orten: in CLAUDE.md (jede Sitzung liest es, es ist aber schon zu lang, ROADMAP 6.44), in `lab/README.md`, in `docs/history.md` (chronologisch, nicht nach Werkzeug) und im Gedächtnis des Claude-Code-Clients (nur auf Julians Mac, pro Nutzer, unsichtbar für das Repository und für Cloud-Sitzungen). **Diese Datei ist der eine Ort nach Werkzeug.** CLAUDE.md verweist mit einer Zeile hierher; was dort an Werkzeugregeln steht, wandert mit 6.44 hierher und bleibt dort nur als Verweis.

**Wie sie gepflegt wird.**
- Ein Abschnitt je Werkzeug oder Dienst. Jede Regel mit Datum und, wo es eine gab, der Messung oder dem Fehler, der sie begründet. Ohne Begründung wird eine Regel bei der nächsten Gelegenheit „vereinfacht“.
- Eine neue Erkenntnis kommt **in derselben Sitzung** in den Abschnitt, nicht in den Chat und nicht nur ins Client-Gedächtnis. Das Gedächtnis darf eine Kopie halten; die Quelle ist hier.
- Was in `docs/history.md` steht, wird hier nicht wiederholt, sondern verlinkt. Was eine Website-Regel ist (wie die Seite sich verhält), bleibt in SPEC.md und CLAUDE.md; hier steht, wie **wir** mit dem Werkzeug umgehen.
- Vor dem ersten Gebrauch eines Dienstes in einer Sitzung: den Abschnitt lesen. Das kostet eine Minute und erspart die Sperre, den Fehlkauf, den Deploy ins falsche Projekt.

Abläufe, die immer gleich laufen (ein Clip aufnehmen, ein Deploy prüfen), können später Skills werden (ROADMAP 6.40); die Regeln dazu bleiben trotzdem hier, damit ein Skill sie zitiert statt sie zu kopieren.

---

## 1. Open Library (Katalog, Cover-Host)

Die Quelle, von der die Seite lebt (SPEC §3 F3). Details zu Werken, Ausgaben und Covern als Fakten: [ausgaben-recherche.md](ausgaben-recherche.md) §2; was die alte Codebasis falsch verstand: CLAUDE.md „Facts about the APIs“.

- **Sie sperrt Adressen, die zu viel fragen** (2026-10-04, erneut 2026-10-08): `ECONNREFUSED` auf 80 und 443 binnen Millisekunden, während `covers.openlibrary.org`, `archive.org` und die Live-Seite weiter antworten. Es sieht aus wie ein Ausfall und ist eine Sperre von Julians Adresse; wie lange sie hält, ist unbekannt. Auslöser waren Lab-Läufe mit ~100–150 Anfragen in einer Stunde, auch mit 1,5 s Pause, plus eine zweite Sitzung und die Calibre-App. **Regeln:** ein Lab-Skript fragt mit Pause (mindestens 1,5 s, lieber mehr), läuft einmal, nie neben dem Bulk-Lauf einer anderen Sitzung, und **hält bei der ersten verweigerten Verbindung an** (`refusedConnection` in `lab/calibre/find.ts`). Erst `curl -s -o /dev/null -w '%{http_code}' 'https://openlibrary.org/search.json?q=x&limit=1'` prüfen, bevor Code verdächtigt wird: `000` in Millisekunden heißt gesperrt, und jede weitere Anfrage verlängert es womöglich.
- **Ausweg während einer Sperre:** die Suche der Live-Seite, `https://buyitscovers.com/api/search?q=<Titel Autor>`, fragt Open Library von Vercel aus — eine Anfrage alle 6 s, Eimer `search` 30/20 je Minute, bei einem Nicht-200 aufhören. Sie liefert Werk- und Cover-Ids, genug für einen Sammlungsentwurf.
- **Größe eines Scans ohne den Scan:** `https://covers.openlibrary.org/b/id/<n>.json` nennt Breite und Höhe in 0,08 s (2026-10-04, 39 von 40 stimmten). Originale (0,1–10 s, 600 KB) nie laden, um die Größe zu erfahren.
- **`search.json` und robots.txt:** `Disallow: /search` unter `*` trifft als Präfix auch `search.json`; Open Library dokumentiert den Endpunkt als öffentliche API. **Entschieden (Julian, 2026-10-09, 6.87 „A“):** so lassen — mit dem User-Agent der Seite (`userAgent` in `lib/seo.ts`, nennt Name und Adresse) und gezügelten Lab-Läufen; keine Nachfrage bei Open Library.
- **Schreiben in Open Library** (Cover hochladen oder entfernen): nur mit Julians Ja, unter seinem Konto, auf die Ausgabe, deren ISBN **und** Datum zum Druck passen; jede Änderung mit Ausgaben- und Cover-Ids in `docs/history.md` (CLAUDE.md „Editions, printings and covers“).
- **Testdaten aus dem Katalog, nicht aus dem Gedächtnis** (2026-09-28): eine erfundene dtv-ISBN gehörte zu einem Marías-Buch, und Julians Test landete beim falschen Buch. Jede Zeile einer Demo-Datei wird gegen `openlibrary.org/isbn/<isbn>.json` geprüft, mit Pause.
- **Autoren an Ausgaben sind Schlüssel, keine Namen**; `author_name` der Suche enthält Übersetzer; `covers` ist ein Array, alle Ids nehmen (CLAUDE.md, Fakten).
- Zeiten aus Deutschland: Suche 2–7 s, Ausgabenseite 3–10 s, gelegentlich viel länger. Jeder Aufruf mit Timeout und Cache (`OL_TIMEOUTS`).

## 2. Google Books

- **Genau zwei Aufrufer, und die Suche ist keiner:** die Titelsuche auf Seite 0 einer Buchseite und die ISBN-Abfrage beim Wählen eines Covers (CLAUDE.md). Kein dritter ohne Messung gegen die 1.000 Anfragen am Tag; kein Lab-Experiment fragt Google ohne Messung (E10). Eine kalte Buchseite kostet 2, ein Mosaik 0.
- **Die Feldsuche kann leer antworten, ohne Fehler** (1.13, 2026-10-09): `isbn:`, `intitle:`, `inauthor:` gaben für jede Anfrage `totalItems: 0`, dieselben Worte ohne Operator 355. Ursache bei Google, unbekannt; mit `country=`, kodiertem Doppelpunkt, Wort plus Operator ebenso. Die Seite prüft seither zwei Prüfstein-ISBNs (`lib/googlefields.ts`), bevor sie eine leere Antwort glaubt. **Beim Messen von Hand:** eine leere Google-Antwort erst gegen `isbn:9780061120084` prüfen, bevor man sie als Befund notiert — am 2026-10-09 kostete das sonst einen halben Tag Deutung (`lab/video/screen/verdicts.ts` hielt `pending` für bestätigt).
- **Ohne Schlüssel** ist die anonyme Tagesmenge dieser Adresse schnell verbraucht („Quota exceeded … Queries per day“); Messungen immer mit `GOOGLE_BOOKS_API_KEY` aus dem `.env.local` des Hauptordners (`set -a; source .env.local; set +a`). **Den Schlüssel nie ausgeben:** nicht in `printf`/`echo` der Kommandozeile, nicht in Dateien, nicht im Chat (am 2026-10-09 stand er einmal in einer Prüfausgabe, weil der ganze Query-String gedruckt wurde — Variablen mit Schlüssel nur in die URL, nie in die Ausgabe).
- Kontingent: `dailyLimitExceeded` öffnet den Schalter bis Mitternacht Pacific; ein 403 aus anderem Grund darf ihn nie öffnen; Tests mit 429 rufen `resetGoogleQuota()`. `zoom=1&fife=w800` für Bilder; `zoom=2` ist eine Scan-Seite.

## 3. Shops und Partnerprogramme (Bookshop.org, Amazon, AbeBooks, …)

- **Die Seite kontaktiert keinen Händler**; Kauflinks sind Vorlagen, das Urteil kommt vom Verlagsbild (CLAUDE.md). Die Verfügbarkeitsprüfung (`lib/availability.ts`) ist nicht für die Produktion freigegeben: vier von sechs Shops verbieten den Pfad in robots.txt, Amazons Bedingungen verbieten automatisierten Zugriff (SPEC §8.7).
- **Bei Messungen und Aufnahmen nie `/go/` klicken** — das zählt einen Klick in der Analyse (3.1). Der Clip-Rekorder lässt den Finger auf dem Shop-Knopf liegen und klickt nicht (`lab/video/screen/record.ts`).
- **bookshop.org weist ein headless Chrome ab** („Sorry, you have been blocked“, Cloudflare, 2026-10-09); ein echtes Chrome-Fenster außerhalb des Bildschirms (`launch(port, headed)` in `lab/video/screen/cdp.ts`) kommt durch. Die Seite zeigt zuerst ein Datenschutz-Banner — „Deny Non-Essential“ wählen. **Bookshop führt nur lieferbare Drucke:** die Penguin-1997-Ausgabe von *Wide Sargasso Sea* findet die ISBN-Suche nicht; von neun Demo-Büchern gab es vier in einer Ausgabe, die Bookshop führt und Open Library mit demselben Cover kennt ([Historie, Schnitt 5](history.md)). Deshalb zeigt der Clip keine Shop-Seite (Julian: „bookshop … nur neue cover“).
- **Partner-Links** (`/a/<id>/<isbn>`) brauchen die Kennung aus `AFFILIATE_*`; im Hobby-Modus ist keine gesetzt, der Link ist dann die ISBN-Suche. Partnerprogramme und ihre Bedingungen: [guides/affiliate-programme.md](guides/affiliate-programme.md), [guides/bookshop-affiliate.md](guides/bookshop-affiliate.md). Ein eigener Besuch eines Partner-Links zum Prüfen ist unschädlich, ein Lauf über viele nicht.

## 4. Die Produktion (buyitscovers.com, Vercel)

- **Prüfen gegen `next dev`, die Produktion einmal nach dem Deploy, nie in einer Schleife** (Julian, 2026-09-09): wiederholte automatische Anfragen lösen Vercels Bot-Abwehr aus, 403 mit `x-vercel-mitigated: challenge`, und das sieht aus wie ein Ausfall (2.4). Jede Anfrage an die Live-Seite kann außerdem Google-Kontingent kosten.
- **Auf den Deploy warten:** `until vercel ls beautifulbooks --prod 2>&1 | grep -m1 https | grep -q 'Ready\|Error'; do sleep 20; done` — die Tabelle kommt auf **stderr**, mit `2>/dev/null` läuft die Schleife ins Leere (dreimal am 2026-10-06). Erst starten, wenn die neue Zeile da ist, sonst passt die alte. **Derselbe SHA zweimal gepusht** (erst Branch, dann `main`) baut nur eine Preview; dann `vercel promote <preview-url> --yes`, oder gleich zuerst nach `main` pushen (2026-10-08). Die Git-Integration baute auch schon spät; ein manuelles `vercel deploy --prod` aus einer Claude-Sitzung wurde vom Berechtigungsfilter blockiert (2026-10-09) — warten, nicht umgehen.
- **Ein Worktree ist nicht verknüpft:** `vercel deploy` dort legte ein neues Projekt an (2026-10-05). Vorher `.vercel/project.json` prüfen, sonst `vercel link --project beautifulbooks --yes`. Lesende Befehle mit `--project beautifulbooks` sind unbetroffen.
- **Logs halten eine Stunde** (Hobby): `vercel logs --project beautifulbooks --follow` während des Fehlers oder binnen der Stunde; `--json` wiederholt Zeilen (nach `id` entdoppeln). Der Kontingent-Schalter und die CSP-Meldungen schreiben `bb.google`- und `bb.csp`-Zeilen (2.12).
- **Tests auf der Live-Seite als Test-Besucher:** `BB_TEST_VISITOR` aus dem `.env.local` des Hauptordners, nie Julians `BB_VISITOR`, keinen der Werte ausgeben (Julian, 2026-10-03).
- **Was die CLI kann und nicht** (2026-10-05, Pro): `vercel metrics` je Route (p75 aufwärts, kein p50), Marketplace-Pläne lesen (`vercel api …`, Preise sind je Region verschieden — fra1 kostet ein Drittel mehr als iad1); nicht: Ausgabenlimit setzen, Plan eines Stores ändern, Backup, Rechnung. `vercel env ls` nur Namen; Werte nie lesen oder ins Cockpit schreiben. Weder der Browser-Bereich noch Julians Chrome ist bei Vercel angemeldet.
- **Umgebungsvariablen:** die Produktion hat Werte, die kein Worktree hat (`INSPIRATION`, `HOTORNOT`, Affiliate-Kennungen). Ein Build im Worktree braucht `.env.local` des Hauptordners für `/contact` (Impressum) — nur für diesen Befehl sourcen; ein `next dev` mit diesen Werten zeigte auf die Produktions-Redis.

## 5. Der Browser-Bereich der Desktop-App (built-in browser)

- **Versteckt nimmt er keine Eingaben an** (2026-09-11): `computer`-Hover, Klick und Tippen erreichen die Seite nicht, `javascript_tool`, Screenshots und `requestAnimationFrame` gehen. Zeigerlogik mit `new PointerEvent(...)` auf dem Element auslösen, Formulare mit `form.requestSubmit()`, mit Frames warten statt mit Timern — und Julian sagen, dass die Interaktion synthetisch gemessen wurde. `scrollIntoView({behavior:'smooth'})` bewegt sich dann nicht.
- **Keine neuen Tabs aus Klicks, keine Downloads** (2026-10-05): `target="_blank"` öffnet nichts (Tab mit `tabs_create` + `navigate`), `<a download>` legt keine Datei ab (mit `curl` nach `docs/tests/` holen), `navigator.clipboard` und Web Share sind nicht prüfbar, `performance.getEntriesByType('resource')` endet bei 250.
- **Der Viewport ist geteilt:** eine andere Sitzung kann ihn umstellen; nach `resize_window` sofort messen, danach `desktop` zurücksetzen.
- **`preview_start` liest die `launch.json` des Hauptordners**, nicht die des Worktrees (2026-09-11): Lab-Server im Worktree mit Bash im Hintergrund starten (`npx tsx lab/<name>/serve.ts`) und mit `navigate` öffnen; nichts in die `launch.json` des Hauptordners schreiben.
- **Konsole lesen statt Screenshot deuten:** `read_console_messages`, `read_page`, `javascript_tool` für berechnete Stile; der Screenshot ist der Beleg am Ende.

## 6. Headless Chrome und das DevTools-Protokoll

- **Mindestbreite 500 px** (2026-09-12): `--window-size=390,844 --screenshot` layoutet bei 500 px und zeigt den linken Teil — es sah zweimal wie ein seitlich scrollendes Telefon aus. Für Telefonbreiten `Emulation.setDeviceMetricsOverride` (`mobile: true`), wie `lab/video/screen/record.ts`; vor dem „Beheben“ eines Überlaufs `innerWidth`/`scrollWidth` aus dem DOM lesen.
- **Cookie-Seiten** (Besitzer-Ansicht einer Sammlung): `Network.enable`, `Network.setCookie`, dann `Page.navigate` — Node 22 hat `WebSocket` eingebaut, kein Paket nötig (`lab/video/screen/cdp.ts` ist der Client dafür). Ein hohes Fenster (1280 × 12000) beweist Lazy Loading.
- **Screencast-Bilder kommen in CSS-Pixeln** (360 × 640, egal welcher Scale); für 1080 × 1920 eine Schleife aus `Page.captureScreenshot` (~62 ms je Bild, ≈16 fps, 2026-10-09).
- **Bot-Sperren:** headless wird von bookshop.org abgewiesen (§3); `launch(port, headed)` öffnet ein echtes Fenster bei `--window-position=-3000,0`.
- **Prozesse beenden, ohne die eigene Shell zu töten** (2026-09-14): `pkill -f muster` trifft jede Shell, in deren Befehlszeile das Muster steht. `pgrep -f headless""=new | xargs kill` — das Literal im Befehlstext teilen.
- Ein Klick vor der Hydration tut nichts: in einer Schleife klicken, bis das Ergebnis da ist (`record.ts`, 2026-10-09). Ein `span` in einem Knopf: den `span` klicken, der Klick steigt auf.

## 7. Clips und Bilder (lab/video, lab/video/screen)

- **Gegen `next dev` mit `WALLS=on`, nie gegen die Produktion**; Sammlungen entstehen nur im lokalen Speicher. Nie der Export eines echten Lesers — die Demo-Datei ist erfunden und gegen Open Library geprüft (§1). Kein Goodreads-Logo, keine Goodreads-Oberfläche (PLAN-5.5b §5).
- **Nichts wird in die Seite gezeichnet:** Finger, fliegende Datei, Worte, Karten kommen beim Zusammensetzen (`compose.py`, Pillow) über die Bilder; Wartezeiten werden geschnitten, nie Antworten erfunden.
- **Kodieren mit AVFoundation, nicht ffmpeg** (Julian, 2026-10-09): Homebrew hat für macOS 13 keine Pakete und baute über zehn Minuten aus dem Quellcode; `swift lab/video/screen/encode.swift <frames> <out.mp4> 30` braucht nichts Installiertes, ~10 s für 500 Bilder.
- **Schriften der Seite** aus den WOFF2-Dateien unter `.next/static/media/` (einmal `next dev`), konvertiert mit fontTools; `next/font` liefert sie sonst nirgends.
- **Keine Vollständigkeitsworte** in Einblendungen, kein „order that edition“ ohne `verified`. Ausgaben nach `docs/tests/` (git-ignoriert) und in den Hauptordner kopieren; die Textdatei im Bericht trägt alles, was die Bilder zeigen. **Posten erst nach der Rechtefrage aus 5.5, von Hand.**
- Schnittregeln, die Julian gesetzt hat (2026-10-09): Goodreads-Teil langsam, wenig Bewegung, je Schritt eine Überschrift mit Zeile darunter, kein unnötiges Scrollen (das Cover ist von der Kachel schon gewählt), der Abschluss ruhig auf dem gedrückten Knopf, keine Shop-Seite.

## 8. Recherche (Agenten, Web, fremde Datenbanken)

- **Fakten zu Ausgaben nach [ausgaben-recherche.md](ausgaben-recherche.md):** ISBN ist kein Druck und kein Cover; Reihe und Nummer am Druck lesen; Bilder durch Ansehen vergleichen, ein Hash sortiert nur; „nicht im Katalog“ erst nach allen Ausgaben eines Werks; ein Bericht nennt, **was** verglichen wurde („Bild gegen Erstdruck“), nie „alle geprüft“.
- **Reddit ist für Claude tabu** (Julian): nicht lesen, nicht zitieren; Launch-Momente dort macht Julian von Hand (5.6).
- **Recherche-Agenten dürfen Open Library nicht stürmen** (§1): die 150 Anfragen zweier Agenten am 2026-10-07 sperrten die Adresse am Morgen danach. Agenten bekommen die Pausenregel in den Auftrag und arbeiten nacheinander, nicht parallel gegen denselben Katalog.
- **Jede Recherche landet in `docs/*-recherche.md`** mit Quellen und Datum (Domain, Antiquariate, Reihen, Scudellari, …); eine Nummer aus dem Chat ist verloren (CLAUDE.md).
- **Websuche** (`WebSearch`/`WebFetch`): Standardmodus zuerst, erweitert nur bei dünnem Ergebnis; Preise, Verfügbarkeiten, Neues immer frisch suchen, nie aus dem Gedächtnis (Kosten von Modellen aus `lib/insights/prices.ts`).
- **Fremde Seiten mit Bot-Schutz** (bookshop.org, Amazon): nicht automatisiert abfragen; einmal ansehen ist in Ordnung, ein Lauf nicht (§3).

## 9. Gegenprüfen (double checking)

- **Vor „fertig“:** `npx tsc --noEmit`, `npm run test:run`, `npm run build` (mit dem `.env.local` des Hauptordners nur für diesen Befehl); UI an **390 × 844 und 1280 × 800** ansehen und **messen** (abgeschnittene Zeilen, Platzhalter gegen Feldbreite), nicht nur hinschauen (N14; 2026-09-11 waren 9 von 18 Titeln am Telefon abgeschnitten).
- **Ein Ausfall ist kein Befund** (N12): eine Quelle, die nicht antwortet, ist nicht „keine Ergebnisse“; eine ungefragte Frage ist nicht „nichts bekannt“ (siehe Google §2). Jede neue Textzeile fragt: Was hat die Seite tatsächlich gesehen?
- **Der i18n-Test** nennt jeden englischen Satz ohne deutsche Entsprechung; nie stummschalten. **Die Analytik-Checkliste** (CLAUDE.md, sieben Punkte) vor jedem Commit; die Antwort steht in der Commit-Nachricht.
- **Eine Korrektur von außen** wird in der Quelle geprüft, bevor sie beantwortet wird, und das Ergebnis geht so oder so in die Historie (2026-10-08, SF Masterworks).
- **Eine Messung an einem Foto ist keine** — Regalfoto-Änderungen nur gegen das Testset (`lab/shelf/evaluate.ts`); drei Fotos trugen zwei Tage eine falsche Erklärung.
- **`tsc` rot wegen iCloud:** „name 2.ts“-Kopien unter `.next` erzeugen doppelte Bezeichner; `rm -rf .next/dev` hilft (6.42). Nicht den Code verdächtigen.

## 10. Dev-Server und Caches

- **Turbopack liefert alte CSS** (2026-09-28): nach Änderungen an `app/globals.css` nur `.next/dev/cache/turbopack` löschen, **nie** `.next/dev/cache/fetch-cache` — der hält die Open-Library-Antworten, ohne die ein Dev-Server aus Bash heraus ohne Netz jede Werkseite als „unavailable“ zeigt. Gelieferte Regeln über `document.styleSheets` prüfen, nicht per grep.
- **Zwei `next dev` im selben Ordner** sperren sich; der Server im Worktree läuft auf seinem eigenen Port (2026-10-09: 3107). Wer auf welchem Port läuft: `lsof -nP -iTCP:<port> -sTCP:LISTEN`, dann `lsof -p <pid> | grep cwd`.
- `next dev` lädt `next.config.ts` bei Änderung selbst neu (2026-10-09, Header von 2.12 kamen ohne Neustart).

## 11. Git, Worktrees, Commits

- **Mehrere Sitzungen, eigene Worktrees, manche pushen direkt nach `origin/main`:** `npm run worktrees -- --fetch` am Anfang und vor jedem Merge; `origin/main` ist die Produktion, das lokale `main` nicht. Vor dem Entfernen eines Worktrees die git-ignorierten Dateien retten (Screenshots in `docs/tests/`, Lab-Caches nach `../bb-lab-cache/`).
- **Nie `git stash` ohne Namen** — der Stapel ist geteilt; WIP-Commit statt Stash. Ein Push, der an „sideband packet“ stirbt, ist Transport: `git -c http.postBuffer=524288000 push`.
- **Push nur, wenn Julian es sagt** („merge und push“); Doku-Commits fahren mit dem nächsten Push mit. Jede Commit-Nachricht nennt ihr Roadmap-Item, trägt die Antwort auf die Analytik-Checkliste und die `Co-Authored-By`-Zeile.
- **Screenshots und Videos bleiben lokal** in `docs/tests/` (git-ignoriert); der Bericht trägt alles im Text. Scratch-Dateien ins Scratchpad der Sitzung, nie in die Projektwurzel.

## 12. Gedächtnis des Clients und diese Datei

Das Gedächtnis des Claude-Code-Clients (`~/.claude/projects/…/memory/`) ist pro Rechner und Nutzer, Cloud-Sitzungen und andere Rechner sehen es nicht. Es darf Hinweise halten („lies docs/umgang.md §4 vor einem Deploy“); die Erkenntnis selbst steht hier. Wer eine Erkenntnis im Gedächtnis findet, die hier fehlt, trägt sie hier nach — mit dem Datum, an dem sie gemessen wurde, nicht mit dem heutigen.
