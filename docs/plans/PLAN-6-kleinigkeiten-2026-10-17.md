# Plan: dreizehn kurze Punkte aus Phase 6 (2026-10-17/18)

**Anlass:** Julian (2026-10-17) zur Liste „Bis eine Stunde“ aus der Durchsicht aller offenen Kästchen: „mach einen plan hierfür und führ mich durch“. Die Punkte: **6.106, 6.11, 6.42, 6.63, 6.7 Schritt 2, 6.5, 6.72 (2)–(4), 6.39, 6.40, 6.44, 6.16 Schritt 2, 6.26, 6.94.** Jeder wurde am 2026-10-17/18 am Code und im git log nachgesehen (zwei Lese-Durchgänge, nichts gebaut); was hier steht, ist der Stand an `54d3244`, Branch `worktree-2.18-betrieb`.

**Wie der Plan benutzt wird:** Claude führt Julian Punkt für Punkt durch; vor jedem Punkt stellt er die Entscheidungen aus §1, die noch offen sind, dann baut er, dann der nächste. Ein Punkt gilt als abgehakt nach den fünf Schritten aus CLAUDE.md (Roadmap kürzen, Archiv, features, Historie, Spec). Reihenfolge in §2, die Punkte selbst in §3.

**Was sich seit der Liste geändert hat:** 6.39 und 6.40 sind keine UI-Punkte, sondern Claude-Code-Hooks und -Skills; 6.44 war gegen 3.571 Wörter geschrieben, CLAUDE.md hat heute 6.999; 6.72 (2) widerspricht, wörtlich genommen, einer Entscheidung Julians vom 2026-09-09; 6.5 besteht nur noch aus einem lebenden Teil; 6.63 ist eine Messung, kein Bau.

## 1. Julians Entscheidungen, gesammelt

Ohne Entscheidung baubar: **6.42, 6.63, 6.7 (2), 6.106, 6.72 (4), 6.94 Schritt 1–3.** Alle anderen brauchen vorher ein Wort. Empfehlung jeweils zuerst.

| Punkt | Frage | Vorschlag |
|---|---|---|
| 6.11 | Beschriftung des Knopfs: „Goodreads“ oder „Reviews at Goodreads“? Darf „8,491 readers at Open Library“ auf die Karte? | „Goodreads“; Leserzahl nein |
| 6.5 | Blättern im Telefon-Blatt: Pfeile „Previous/Next cover“ mit „3 of 41“; stumme Pfeile; oder ein Knopf „Back to the covers“, der schließt und zur Kachel springt? | Pfeile mit Zähler |
| 6.72 (2) | Die Regel vom 2026-09-09 behalten (Titel-Suchzeile nur bei fremder oder fehlender ISBN) oder „Any edition“ immer zeigen? | behalten, Punkt als „schon wahr“ schließen |
| 6.72 (3) | „Add to collection“ im Spiel: auf dem ausfahrenden Paar während der Animation, oder in einer Leiste „letztes Paar“, die bis zur nächsten Stimme bleibt? | Leiste „letztes Paar“ |
| 6.39 | Welche erzeugten Dateien blockt der Hook — nur `docs/worktrees.md`, `docs/cockpit.html`, `data/cover-index.json`, oder auch `hero-rings`, `popular-works`, `versus-pool`, `decade-pages`, `hero-ring-signatures`? Fragt ein Push nach `main` jedes Mal, auch nach „merge und push“? Darf ein SessionStart-Hook in jeder Sitzung `git fetch` machen? Stop-Hook mit vollem `test:run` oder nur bei `lib/`? | alle `scripts/build-*`-Ausgaben blocken; Push nach main fragt immer; fetch ja; Stop-Hook voll, Deckel 8 |
| 6.40 | `/messen` als committetes Skript (`lab/n14/`) oder Schnipsel im Skill? Deutsche Skill-Namen (`abhaken`, `messen`)? | Skript in `lab/n14/`; deutsche Namen |
| 6.44 | Ein Drittel wovon — 3.571 → ~1.200 oder 6.999 → ~2.300 Wörter? Name und Ort der API-Fakten-Seite? Darf „Layout“ ganz weg? Wer führt `/doctor` aus, und ist es die Messlatte? | ~2.300; `docs/api-fakten.md`; Layout auf fünf Zeilen; Julian führt `/doctor` aus |
| 6.16 (2) | Welche Werke: 155 kuratierte, veröffentlichte Sammlungen oder 500 Index-Werke? Der Satz für ein geprüftes Jahr („First published in {year}.“?), auf Englisch und Deutsch. Liest er jede Zeile oder nur die Abweichungen? Ein Einmal-Skript gegen Wikidata unter E10 in Ordnung? | 155 kuratierte; „First published in {year}.“ / „Erstausgabe {year}.“; nur Abweichungen; ja |
| 6.26 | Längerer Build mit dem Risiko von Ersatz-Metadaten bei einem Open-Library-Ausfall, um alle 155 vorzurendern? Messen gegen lokalen `next start` oder einmal gegen Produktion? | erst messen, lokal |
| 6.94 | Wenn ein getipptes Wort in Titeln oder Autoren einer schwachen Antwort vorkommt: Korrektur nur anbieten, nie anwenden? (ändert SPEC F1.9) | ja |
| 6.42 | Zieht die Arbeitskopie aus iCloud Drive aus? (Der tsc-Behelf kommt so oder so.) | ja, aber nicht in diesem Plan |

## 2. Reihenfolge

Zuerst, was ohne Entscheidung geht und am wenigsten Risiko trägt; die Werkzeug-Punkte (6.39 → 6.40 → 6.44) am Stück, weil 6.44 streicht, was die beiden vorher zu Mechanismen machen; die Messungen zum Schluss, weil sie Open Library brauchen, das diesen Mac am 2026-10-18 abwies.

| # | Punkt | Aufwand Claude | Braucht |
|---|---|---|---|
| 1 | 6.42 tsc-Ausschluss | 40 min | nichts |
| 2 | 6.106 Sprachschalter als Link | 75 min | nichts |
| 3 | 6.72 (4) Pfeiltasten auf der Wand | 30 min | nichts |
| 4 | 6.11 Goodreads-Link | 45 min | Beschriftung |
| 5 | 6.5 Weg aus der Schublade | 90 min | Form des Blätterns |
| 6 | 6.72 (2) schließen oder umbauen; 6.72 (3) Spiel | 15–45 min; 60 min | zwei Antworten |
| 7 | 6.39 Hooks | 90–120 min | vier Antworten |
| 8 | 6.40 Skills | 60–90 min | zwei Antworten |
| 9 | 6.44 CLAUDE.md kürzen | 2–3 h, Julian liest gegen | vier Antworten, nach 7 und 8 |
| 10 | 6.63 zwei Klickfehler nachstellen | 60 min | Dev-Server mit Fetch-Cache |
| 11 | 6.7 (2) Imprint-Familien | 90 min | Open Library antwortet |
| 12 | 6.94 zwei Bücher | 90–120 min | ein Live-Aufruf, eine Antwort |
| 13 | 6.16 (2) geprüfte Jahre | 2 h + Julians Lesen | vier Antworten, Wikidata |
| 14 | 6.26 kuratierte Liste messen | 2–3 h | Open Library, zwei Antworten |

Summe gut zwei Arbeitstage Claude; Julians Anteil sind die Antworten aus §1, das Gegenlesen bei 6.44 und die Zeilen bei 6.16.

## 3. Die Punkte

### 6.42 Repository in iCloud, tsc rot — der Behelf

**Stand:** nichts gebaut; `tsconfig.json` schließt nur `node_modules` aus, `include` nimmt inzwischen auch `.next-visitcost/types/**`. Die Prämisse „immer rot“ gilt wörtlich nicht mehr: am 2026-10-17 fand `grep` **keine** Doppeldatei „… 2.ts“ in `.next/`, `node_modules/` oder neben den Quellen, und kein `.icloud`-Platzhalter. Der Behelf kostet zwei Zeilen und schützt jede künftige Kopie auf einer synchronisierten Platte; die Historie muss sagen, dass er heute nichts zu heilen hatte.

**Schritte:** (1) feststellen, wo die Arbeitskopie liegt (`ls -la`, `df -h`, `readlink -f`), mit Datum in die Historie; (2) `exclude` auf `["node_modules", "**/* ?.*"]` (`?`, nicht `[0-9]`: TypeScript kennt nur `*` und `?`; am 2026-09-18 hieß die Datei `routes.d 3.ts`); (3) Beleg: `routes.d.ts` als `routes.d 2.ts` kopieren, `tsc` rot, mit Ausschluss still, Kopie löschen, beide Ausgaben in die Historie; (4) `npm run build` und `git diff tsconfig.json` leer — Next darf den Eintrag nicht überschreiben; (5) umgang.md §10: der Ausschluss steht, `rm -rf .next/dev/types` bleibt für gelöschte Routen (6.51), bei `tsc`-Fehlern in erzeugten Dateien zuerst `find … -name '* [0-9].*'`.

**Risiken:** das Muster schlösse eine echte Quelldatei mit Leerzeichen und einem Zeichen vor der Endung aus (heute gibt es keine); vitest und eslint heilt es nicht. **Fertig:** `tsc` mit absichtlicher Doppeldatei still, Build durch, Historie mit beiden Ausgaben.

### 6.106 Der Sprachschalter als Link

**Stand:** `components/LocaleSwitcher.tsx` ist ein `<button onClick>`, der `document.cookie` schreibt und `router.refresh()` ruft — vor der Hydration tut er nichts (Befund 2026-10-09: erster Klick nach 3 s nichts, zweiter nach 10 s schaltete). Kein Commit dazu; keine Zeile in der Bewertungstabelle.

**Schritte:** (1) einmal nachstellen (`npm run dev`, `/about` ohne JavaScript, Klick tut nichts); (2) `lib/i18n/locale.ts`: `LOCALE_COOKIE_MAX_AGE`, `localeCookieAttributes()` und die reine Funktion `backTarget(referer, back, origin)` — gleich-originärer Referer (mit Query) zuerst, sonst ein `back` mit genau einem führenden `/` (kein `//`, kein `\`, kein Schema), sonst `/`; (3) `lib/__tests__/locale-back.test.ts`: Referer gewinnt, fremder Referer ignoriert, `//evil.com`, `https://evil.com`, `/\evil.com` → `/`, `/de/about` bleibt; (4) Eimer `locale` in `lib/ratelimit.ts`; (5) `app/api/locale/[locale]/route.ts`: GET, Rate-Limit, unbekanntes Locale → 303 ohne Cookie, sonst Cookie setzen und 303 auf `backTarget`; (6) der Schalter wird ein `<a href="/api/locale/<other>?back=<pathname>" rel="nofollow" lang>` mit `usePathname()` (nie `useSearchParams`: macht jede statische Seite dynamisch), gleiche Klassen inklusive `hit`, `inline-flex items-center`; hydriert behält ein `onClick` den Weg ohne Neuladen; (7) curl: `/api/locale/de?back=/about` 303 mit `Set-Cookie`, `?back=//evil.com` → `/`, Referer `/?q=gatsby` gewinnt, `/api/locale/fr` ohne Cookie; (8) Browser bei 390×844 und 1280×800, Wort in der Kopfzeile vertikal mittig messen (6.84); (9) SPEC.md:153 „ein kleiner Knopf“ → Link mit Server-Antwort, Bewertungszeile nachtragen.

**Analyse (CLAUDE.md-Liste):** ein Klick vor der Hydration lädt neu und zählt in `entryOf` eine Landing-Seite doppelt — selten, hingenommen; `/api/locale` wird nie Referrer (303). **Fertig:** Link schaltet ohne JavaScript über den 303, hydriert ohne Neuladen; Tests grün.

### 6.72 (4) ←/→ auf den Kacheln der Wand

**Stand:** Kacheln sind `<button>`s (`components/CoverGallery.tsx:214–250`), **Enter funktioniert schon** nativ; nichts behandelt Pfeiltasten. `CoverGallery` wird auch von `WallPicker` benutzt.

**Schritte:** `onKeyDown` auf dem Raster: ←/→ setzt den Fokus auf die vorige/nächste Kachel des gezeigten Reiters (`shown`, Lookup über `data-cover-id`), kein `preventDefault` für andere Tasten; optional rovendes `tabIndex`. **Fertig:** Tab auf eine Kachel, →/← bewegt den Fokusring, Enter öffnet die Spalte; auch im `WallPicker`.

### 6.11 Goodreads: ein Link neben WorldCat

**Stand:** Recherche vom 2026-09-07 fertig (keine API, Verlinken erlaubt, Goodreads gehört Amazon); nichts gebaut. `searchLinksFor` (`lib/buylinks.ts:421–473`) baut WorldCat und Open Library; `linkPlan` nimmt jeden Nicht-Shop ohne weiteres Rendering mit.

**Schritte:** (1) Handprobe einmal im Browser: `https://www.goodreads.com/search?q=9780141036144` — Trefferliste oder Buchseite? (ein Aufruf, kein Skript); (2) `lib/buylinks.ts` nach dem WorldCat-Push `{ provider: 'goodreads', label: 'Goodreads', url }`: mit ISBN `search?q=<isbn13>`, ohne `q=<Titel Autor>`; (3) Tests: `buylinks.test.ts` Provider-Listen und ein Goodreads-Test, `go-words.test.ts` Nicht-Shop-Listen; (4) `components/useInsights.tsx:155` `goodreads\.com` in `FINDERS` (Analyse-Regel 1: kein Händler, zählt als `found`), Kommentare in `lib/insights/signals.ts:89`, `app/admin/insights/page.tsx:212` und `lib/linkplan.ts` nachziehen; (5) SPEC.md:116 und :301 um Goodreads; features-Zeile neben WorldCat; (6) Browser: Falte „Other ways to find it (n)“ bei 390 und 1280, n steigt um eins.

**Fertig:** Knopf unter der Falte, Klick zählt `found`, Tests grün, Spec und Admin-Seite nennen Goodreads.

### 6.5 Der lebende Teil: ein Weg aus der Telefon-Schublade

**Stand:** von sechs Teilen sind vier erledigt oder gegenstandslos (Mosaik-Ausfall e9b8a6e; Tippfehler in 6.60; Label in 6.81; Verlaufskante seit 6.8 ohne Gegenstand — nur streichen). Offen: (5) der Weg zurück — `components/CoverSheet.tsx` kennt nur Close, Hintergrund-Klick und Escape; (6) `priority` gehört zur Messung in 6.73.

**Schritte:** (1) `components/BookDetail.tsx`: aus `view.groups` die Sprachgruppe des gewählten Covers (Rückfall `view.all`), daraus Vorgänger, Nachfolger, Position, Gesamtzahl als Props an `CoverSheet`; (2) im Blatt eine schmale Zeile nur fürs Telefon: Pfeil zurück, „{n} of {total}“, Pfeil vor (an den Enden `disabled`, `aria-label`, Unterschrift als `title`), im Handler `bodyScroller.current?.scrollTo(0, 0)`; (3) Schließen-Pfade: liegt `[data-cover-id=<selected>]` nicht im Sichtfeld, `scrollIntoView({ block: 'center' })` im Handler — nie im Effekt; (4) `lib/i18n/de.ts`: „Previous cover“/„Voriges Cover“, „Next cover“/„Nächstes Cover“, „{n} of {total}“/„{n} von {total}“; (5) Browser 390×844: zehn Schritte, dabei die `/api/isbn`-Anfragen zählen — jeder Schritt wählt ein Cover und kann eine Google-Anfrage kosten; mehr als eine je Schritt → erst bremsen; messen, ob die erste Laden-Reihe noch ohne Scrollen im Bild ist (die Zeile kostet ~36 px, 6.77 wollte das vermeiden); (6) Roadmap 6.5 abhaken: Verlaufskante gestrichen, Weg gebaut, `priority` nach 6.73 verwiesen.

**Analyse:** `picked` bleibt wahr, `data-cover-id` unverändert, kein neuer Pfad. **Fertig:** blättern wechselt Bild, Unterschrift, Druck-Reihe und Läden; Close landet auf dem erreichten Cover; i18n-Test grün.

### 6.72 (2) und (3)

**(2) Stand:** die Zeile „any edition“ (`anyEdition`, `lib/linkplan.ts:161–162`) wird **nur** bei fremder oder fehlender ISBN gebaut — Julians Entscheidung vom 2026-09-09 (Kommentar `BookDetail.tsx:1094–1097`), und `linkplan.test.ts:149–153` erzwingt sie. Eine Titelsuche steht trotzdem immer da: die Druck-Suchen je Händler hinter der Falte. Wörtlich genommen widerspricht (2) der Entscheidung. **Schritte:** Befund in die Historie; dann entweder schließen („schon wahr“) oder, wenn Julian es will, `anyEdition` auch im Heimatfall zeigen, den Test umdrehen, neue Sätze in `BookDetail.tsx` und `de.ts`.

**(3) Stand:** `components/Versus.tsx:400–432` zeigt unter jedem Cover `ShareMenu` und „Find all covers“, schon vor der Stimme; `Versus` hat keinen `walls`-Prop (`app/versus/page.tsx:77` liest `wallsEnabled()` nur für `WhatIsThisSite`). `AddToWall` braucht ein `Cover` (aus `id`, `src`, `title` zu bauen, `editions: []`); `storedCoverId` nimmt nur OL-Nummern, ein Pool-Cover mit eigenem Bild rendert dann nichts — richtig. Der i18n-Schlüssel „+ Add to collection“ existiert. **Schritte:** `walls: boolean` an `Versus`, aus `page.tsx` durchreichen; `AddToWall compact` neben `ShareMenu` nur für das eben bewertete Paar (Zustand „letztes Paar“ nach Julians Antwort), vorher versteckt, mit `WALLS` aus nichts; bei 390 px messen (Hälfte 173 px breit, Deutsch bricht schon dreizeilig). **Fertig:** unter `WALLS=on` erscheint der Knopf unter beiden Covern erst nach der Stimme und fügt das Cover hinzu; ohne WALLS fehlt er; 390 und 1280 gemessen.

### 6.39 Hooks für die Jedes-Mal-Regeln

**Stand:** kein `.claude/settings.json`, kein `.claude/hooks/`; nur `launch.json` ist versioniert, `.gitignore` ignoriert nur `settings.local.json` — Hooks würden committet und gälten in jedem Worktree. `docs/kanban.html` in der Roadmap-Zeile ist ein veralteter Name: das Cockpit schreibt `docs/cockpit.html`. Weitere erzeugte Dateien: `data/hero-rings.json`, `popular-works.json`, `versus-pool.json`, `hero-ring-signatures.json`, `decade-pages.json` (je ein `scripts/build-*.ts`); `data/collections.json` ist kuratierte Daten, kein Kandidat. Worktree-Sitzungen haben schon einen Bash-Hook des Harness (umgang §11): Repo-Hooks als `node`/`sh` ohne `source`, ohne Kollision.

**Schritte:** (1) `.claude/settings.json` mit `hooks`: `SessionStart` → `hooks/session-start.sh` (`npm run worktrees -- --fetch`, eine Zeile Zusammenfassung); `PreToolUse` `Edit|Write` → `hooks/block-generated.mjs` (liest `tool_input.file_path` aus stdin, Exit 2 mit Satz für die Blockliste); `PostToolUse` `Edit|Write` auf `ROADMAP.md` → `npm run kanban`; `PreToolUse` `Bash` mit `git push` → erst Worktrees, Ziel `main` → `permissionDecision: "ask"`; `Stop` → `hooks/stop-check.mjs`: berührt `git diff --name-only` seit dem Sitzungs-SHA (von SessionStart in eine git-ignorierte Datei geschrieben) `app|components|lib|scripts`, verlangt er Lint und Tests; `stop_hook_active` beachten, Deckel 8 über eine Zählerdatei; (2) Regel „vor jedem Merge nach `main` ein `/code-review` in frischem Kontext“ nach umgang §11; (3) jeden Hook einmal auslösen, Ergebnis in Roadmap und Historie, `kanban.html` → `cockpit.html` korrigieren; (4) aus CLAUDE.md streichen, was die Hooks nun erzwingen (→ 6.44).

**Fertig:** fünf Hooks committet, jeder einmal gefeuert mit Ausgabe in der Historie; der Block auf erzeugte Dateien antwortet Exit 2 mit Satz; der Push nach main fragt.

### 6.40 Skills `/abhaken` und `/messen`

**Stand:** kein `.claude/skills/`. Die fünf Schritte des Abhakens stehen in CLAUDE.md:9; `npm run kanban` = `scripts/cockpit/main.ts --build --board` → `docs/cockpit.html`. Für N14 gibt es kein Skript, nur die Prosa in `docs/history.md:1900` (6.30: je Zeile `scrollHeight > clientHeight || scrollWidth > clientWidth`, Platzhalter per Canvas gegen das Feld, Seitenbreite = Fensterbreite). 6.30a wäre der erste Nutzer. `lab/video/screen/cdp.ts` treibt headless Chrome (unter 500 px nur mit `Emulation.setDeviceMetricsOverride`, umgang §6).

**Schritte:** (1) `.claude/skills/abhaken/SKILL.md`: `name`, `description`, `disable-model-invocation: true`, Argument `<Nr>`; die fünf Schritte mit Dateien und Formaten (Beispielzeilen ROADMAP.md:890, features-Tabelle, Archiv-Anker `#671b`), Prüfung `grep '- [ ]'` im Block, dann `npm run kanban`, Verweis auf umgang §11; (2) `.claude/skills/messen/SKILL.md` plus `lab/n14/measure.ts` auf `cdp.ts` (nach Julians Antwort): für eine URL bei 390×844 und 1280×800 abgeschnittene Zeilen, Platzhalter gegen Feld, `scrollWidth` gegen `innerWidth`; (3) je einmal laufen lassen: `/abhaken` an einem echten Punkt, `/messen` auf `/` (soll 6.30s 0/18 reproduzieren); (4) CLAUDE.md:9 auf einen Verweis kürzen (→ 6.44).

**Fertig:** beide Skills gelistet und ausgelöst; ein echtes Abhaken darüber; `/messen` auf `/` stimmt mit 6.30 überein.

### 6.44 CLAUDE.md kürzen, ohne eine Regel zu verlieren

**Stand:** 6.999 Wörter (165 Zeilen): „Current state“ 3.434, „Working rules“ 1.857, „Facts about the APIs“ 432. CLAUDE.md:131 verweist schon auf umgang.md und kündigt den Umzug an. **Schon in umgang.md** (werden in CLAUDE.md zu Verweisen): Prüfen gegen `next dev` (§4), Screenshots lokal (§11), N14 (§9), Ausfall ≠ Befund (§9), Open Library sperrt Adressen und Cover-`.json` (§1), Autorenschlüssel, `covers`, `zoom=1&fife` (§1, §2), Google zwei Aufrufer und Kontingent (§2), Shops (§3), Regal-Testset (§9), Korrektur von außen, Schreiben bei Open Library (§9, §1), Scratch-Dateien (§11), Worktrees-Kern (§11), Sicherungen (§4). **Noch nicht in umgang.md (Umzugsliste):** `vercel logs` Flags, 400 nach einer Stunde, `--limit`, `--until`; Worktrees-Rest (`docs/worktrees.md`, `git worktree remove` behält den Branch, `origin/main` vor dem Merge hereinholen, Screenshots in den Hauptordner, Lab-Cache-Beispiele); der ganze Cockpit-Absatz (127.0.0.1, nur Katalogeinträge, kein Geheimnis in die Datei, Produktion einmal je Erzeugung, `Thema:`, Ansicht „Sammlungen & Synchronisation“); Live-Snapshot `scripts/live-collections.ts` und `COLLECTIONS_FILE`; Sammlungen ohne Deploy (`push-draft.ts`, Credits, `clearDraft`); Fixtures aufnehmen; die fünf Abnahme-Suchen; ein Commit je Punkt; Recherche-Reihenfolge Ausgabe → Druck → Bild. Zwei Dinge dazu: umgang.md zeigt in §1 L17, L23, L25, §2 L30, §3 L37 zurück auf CLAUDE.md-Abschnitte (umzeigen, wenn „Facts“ eine Doku-Seite wird); „erzeugte Dateien nie von Hand“ steht nirgends als Satz (nur `.gitignore:61`, `scripts/worktrees.ts:181`) — ein Satz, oder der Hook aus 6.39. „Current state“ ist zu ~70 % Nie-Regeln (L23, 24, 29, 32, 36, 41, 44, 45, 47, 48): nur das Beschreibende nach features.md, jede Nie-Regel bleibt als eine Zeile. „Layout“ (L77–118) ist veraltet (nennt zwei Skripte, `scripts/` hat 25).

**Schritte:** (1) Umzugsliste nach umgang §4, §11, neues §13 „Cockpit“, §7/§9, §8, je mit Ursprungsdatum; (2) `docs/api-fakten.md` aus L52–61, umgang L17 und L25 umzeigen; (3) Beschreibendes aus „Current state“ nach features.md, Nie-Regeln je eine Zeile mit Link auf SPEC oder features; (4) doppelte Working-rules-Punkte zu Einzeilern mit Verweis; der Satz zu erzeugten Dateien; (5) „Layout“ auf fünf Zeilen oder weg; (6) streichen, was 6.39 und 6.40 übernommen haben; (7) Checkliste alte Zeile → neuer Ort in die Historie; Julian liest gegen; `/doctor`.

**Fertig:** Zielwortzahl erreicht, jede Regel in der Checkliste wiedergefunden, Julian hat gegengelesen, `/doctor` schlägt nichts vor.

### 6.63 Zwei Klickfehler aus der Durchsicht von außen: erst nachstellen

**Stand:** offen seit 2026-09-28, nie gemessen. (a) Der Startseiten-Link trägt seit 6.92 die Klasse `hit` (unsichtbare `::after`-Schicht 4 px unter `pointer: coarse`); „Standings“ (`components/Versus.tsx:314`) ist unverändert, `text-sm`, ~20 px hoch, und mit der Maus greift `hit` nicht. (b) Die Peek-Leiste der Buchseite erscheint aus `searchParams` — zwischen Tipp und Leiste könnten Frames liegen. Der Bericht klickte nach Koordinaten auf verkleinerten Fotos; wahrscheinlich lässt sich nichts nachstellen — dann keinen Fix erfinden.

**Schritte:** (1) Dev-Server des Worktrees (Fetch-Cache behalten), `/`, `/versus`, `/book/OL468431W` im Browser-Bereich, Viewport 455×844 und 390×844 (Preset mobile = Touch); (2) (a) `getBoundingClientRect` und `elementFromPoint` an Textmitte, Unterstrich, 2 px darüber/darunter, je mit Maus und Touch; (3) (b) Kachel synthetisch klicken (versteckter Bereich, umgang §5) und je Frame festhalten, ob `.fixed.bottom-0` da ist und was `elementFromPoint` an „Details“ liefert; (4) Messung in die Historie; lässt sich nichts nachstellen, 6.63 abhaken ohne Code; (5) nur bei Bestätigung (a): `hit inline-flex items-center py-1` an „Standings“; (b): die Leiste aus einem im Render abgeleiteten „zuletzt gewählt“ zeigen (kein setState im Effekt), der verfällt, wenn `searchParams` nachgezogen hat — und nicht die Quelle des Verdict-Signals werden.

**Fertig:** Messung vor (und ggf. nach) in der Historie; 390×844 und 1280×800 geprüft.

### 6.7 Schritt 2: `samePublisher` um Imprint-Familien erweitern

**Stand:** gemessen 2026-09-07, nicht gebaut: *Mason & Dixon* 16 roh, 12 gefaltet, 7 Kacheln dasselbe Motiv; Holt Paperbacks 1998 gegen Henry Holt 1997 bei Distanz 10 bleibt stehen, weil `samePublisher` (`lib/works.ts:625–632`) Teilmenge verlangt — {holt, paperbacks} gegen {henry, holt}. `PUBLISHER_NOISE` kennt paperbacks, taschenbuch, house, university, classics, library, international, new, and/the/of **nicht**. Zweite Funktion gleichen Namens mit anderer Regel in `lab/shelf/edition.ts` — im Docblock nennen.

**Schritte:** (1) vorher messen: `scripts/measure-fold-effect.ts` über die Index-Werke und OL2636672W live gehasht (`getWorkDetail(id, { dedupeCovers: false, googleBooks: false })`, `hashCovers`); (2) Kandidatenpaare: Variante von `scripts/measure-publisher-fold.ts` für Distanz 9–16, Jahr ± 1, ohne gemeinsame ISBN, ohne Sprachkonflikt, `samePublisher` heute falsch, ein gemeinsames Nicht-Rausch-Wort ≥ 3 Zeichen — 20 Index-Werke, als Kontaktbogen ansehen; (3) `PUBLISHER_NOISE` um die Allerweltswörter, die der Bogen zeigt; (4) `samePublisher`: Teilmenge wie bisher, **oder** ein gemeinsames Wort ≥ 3 Buchstaben außerhalb der Rauschliste; (5) Tests in `works.test.ts`: Holt Paperbacks/Henry Holt wahr; Oxford UP/Cambridge UP, Random House/House of Anansi, Penguin Paperbacks/Holt Paperbacks falsch; ein Falt-Test; (6) nachher messen, Mason & Dixon erwartet 12 → 11; faltet der Bogen ein Paar verschiedener Gestaltung, die Regel enger; (7) SPEC.md:98 und :525, features.md:46, Roadmap mit Zahlen, Historie mit Tabelle vorher/nachher.

**Analyse:** die Klasse `seen` kann an Klassengrenzen um eine Stufe rutschen — in die Commit-Nachricht. Das Verdikt nutzt dieselbe Faltung (F2.9): Imprint-Geschwister im selben Jahr werden `verified` statt `differs`, gewollt, an einem Fall prüfen. Open Library eine Anfrage nach der anderen (umgang §1). **Fertig:** Kachelzahl 11 bei `/book/OL2636672W`, Holt-Kachel zeigt beide Drucke; Tests grün.

### 6.94 Zwei Bücher, die die Suche nicht findet

**Stand:** Hypothese am Code (ungeprüft, braucht Netz): **die Tippfehler-Korrektur** (`lib/spelling.ts`) hat mindestens zwei der vier Fälle gemacht. „judt“ (4 Buchstaben, eine Änderung erlaubt) → „jude“ steht im Lexikon („Jude the Obscure“ in `data/collections.json`); Judts Werke haben wenige Ausgaben, die Antwort gilt als schwach, „jude“ gewinnt — genau *Jude the Obscure* und Jude Deveraux. „chalet“ (6, zwei Änderungen) → „charles“ (Charles Dickens im Index) — *A Christmas Carol*. Kyrillisch bleibt unberührt (`\p{L}`); „Клуб убийц букв“ null und „krzhizhanovsky“ → *Seven Stories* sind womöglich einfach Open Librarys Bestand. SPEC F1.9 sagt nur „ein unbekanntes Wort neben einer starken Antwort bleibt“, nichts über eine schwache, aber treffende. Kein Fixture für die drei Anfragen.

**Schritte:** (1) einmal, mit Pause: `buyitscovers.com/api/search?q=judt` und `&exact=1`, `the memory chalet` und `&exact=1`, `the letter killers club` — zeigt das Feld `correction` die Umschreibung, und was Open Library führt; in Roadmap und Historie; (2) offline Test in `spelling.test.ts`: `correctQuery('judt', …)` und `('the memory chalet', …)` bestätigen die Hypothese; (3) Fixtures mit `scripts/record-search-fixtures.ts`, sobald Open Library antwortet; (4) `lib/spelling.ts` / `lib/search.ts`: kommt ein zu korrigierendes Wort normalisiert in Titel oder Autor der ersten Antwort vor, war sie ein Treffer — behalten, Korrektur höchstens anbieten („Did you mean …“, nicht angewandt); `correctionIsBetter` erweitern oder `merged` hineinreichen; (5) Tests: judt behält Judt, Tolkein → Tolkien, gatsbee und die fünf Abnahme-Suchen unverändert; (6) SPEC F1.9 um die Regel; führt Open Library ein Werk nicht, ist „No books found“ die ehrliche Antwort statt Fremdtreffern.

**Fertig:** „judt“ liefert Judt oder nichts, nie *Jude the Obscure*; „the memory chalet“ wird nicht still umgeschrieben; alte Tippfehler-Tests grün; Spec nachgezogen.

### 6.16 Schritt 2: ein geprüftes Erstausgabejahr

**Stand:** Schritt 1 gebaut (`lib/firstyear.ts`, Lolita 1954 statt 1777; Gatsby bleibt 1920, Ulysses 1914, Vom Kriege 1835). Nichts für Schritt 2: keine `data/first-years.json`, kein Lader, kein Vorschlagsskript. Das Jahr erreicht den Leser in `BookDetail.tsx:443` („Open Library dates the book to {year}.“), `BookWorkCard.tsx:86`, `lib/seo.ts:199` (JSON-LD), `InspirationEditor.tsx:656`. Falle: `lib/works.ts:104` merged Dubletten mit `minDefined`, ein früheres falsches Jahr gewinnt — der Override gehört **nach** dem Merge, auf den Server-Pfad (Client-Komponenten dürfen die Datei nicht importieren). Wiederverwendbar: Wikidata-SPARQL-Helfer `wd()` in `lab/international-covers/lookup.ts:147` (Open-Library-ID P648, Datum P577). Kandidaten: 155 kuratierte (`data/curated.json`), veröffentlichte Sammlungen (Live-Stand nur per Snapshot), 500 Index-Werke.

**Schritte:** (1) `lab/first-years/propose.ts` mit README: je Werk OL-Jahr, Wikidata-Jahr (frühestes P577), QID, Abweichungs-Flag → `lab/first-years/out/proposal.json`; Pause zwischen Anfragen, ein Lauf; (2) Julian liest die Abweichungen, die bestätigten nach `data/first-years.json` (`{ "OL…W": { "year": 1925, "source": "wikidata Q…/checked 2026-…" } }`); (3) `lib/firstyears.ts` (server only): `checkedFirstYear(workId)`, angewandt nach `mergeWorks` in `lib/search.ts` (`finish`) und beim Bau des `Work` in `lib/work.ts`; `openlibrary.ts:273` über denselben Pfad; Test: Gatsby → 1925, Lolita → 1955, unbekannt unverändert; (4) Wortlaut: Feld `firstPublishYearSource: 'checked' | 'openlibrary'` in `lib/model.ts`, zweiter Satz in `BookDetail.tsx` und `de.ts`; (5) features.md, SPEC, Analyse unberührt (kein Signal liest das Jahr).

**Fertig:** Gatsby 1925, Lolita 1955, Ulysses 1922, Vom Kriege 1832 auf Buchseite und Karte mit dem neuen Satz; `data/first-years.json` committet mit Quelle je Zeile; Tests grün.

### 6.26 Die kuratierte Liste muss sich perfekt anfühlen — erst messen

**Stand:** die Voraussetzung ist eingetreten: 6.25 und 6.25a sind abgehakt. `generateStaticParams` rendert die 18 Startseiten-Werke vor (`lib/curated.ts:59`), `CURATED_LIST` hat heute **155** Werke, nicht hundert; **alle 155 stehen im gebauten Index** (500 Werke, 2026-09-26). Kein Werkzeug misst Zeit bis zur ersten Kachel oder bis die Wand steht; `lab/video/screen/cdp.ts` kann headless Chrome treiben; `scripts/` darf nicht aus `lab/` importieren, das Messskript gehört nach `lab/`. 6.73 (Wand auf dem Telefon) braucht dasselbe Instrument.

**Schritte:** (1) `lab/curated-ux/` mit README und `measure.ts` auf `cdp.ts`: `/book/<id>` kalt und warm gegen `next build && next start`; t(erste Kachel geladen), t(Wand steht: keine offenen `/img`, Kachelzahl stabil), Kacheln ohne Bild nach N s; 10 kuratierte (5 vorgerendert, 5 nicht) und 10 nicht kuratierte aus `data/popular-works.json`; 390×844 und 1280×800; Open Library eine Anfrage nach der anderen; (2) Zahlen in Historie und Roadmap; (3) sind nicht vorgerenderte kuratierte Werke kalt messbar langsamer: `generateStaticParams` über `CURATED_LIST` versuchen, Bauzeit und Fehlerfall messen (ein Build während eines Open-Library-Ausfalls rendert 155 Seiten mit Ersatz-Metadaten — 5.1 nennt das als Grund dagegen); Mittelweg: nur vorrendern, was der Index hat, oder nach dem Deploy einmal durchwärmen; (4) kein Unterschied → 6.26 in 6.25/6.73 auflösen, wie die Zeile es selbst sagt.

**Fertig:** Tabelle kuratiert × vorgerendert × Telefon/Desktop in der Historie, dazu entweder eine nachgemessene Änderung oder der Punkt mit Grund geschlossen.

## 4. Was dieser Plan nicht enthält

Den Umzug der Arbeitskopie aus iCloud (6.42, Julians Hand), Nonces für die CSP (2.12b), die Messung in 6.73 (nur das Instrument wird mit 6.26 geteilt), und alles aus der Liste „Bis eine Stunde“, was Julian am 2026-10-17 nicht genannt hat.
