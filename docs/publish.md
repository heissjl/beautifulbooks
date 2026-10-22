# Vor dem Veröffentlichen — Checkliste in der Reihenfolge

> **Entwurf zu ROADMAP 6.51 (2026-10-22), Julian entscheidet noch die Form.** Der Inhalt ist einmal geschrieben; die Form ist offen:
>
> - **Datei (`docs/publish.md`, hier).** Von CLAUDE.md oben verlinkt; eine Sitzung liest sie, weil CLAUDE.md es sagt — und vergisst es, wenn sie CLAUDE.md überfliegt. Kostet nichts, ist für Menschen lesbar, wird nie „ausgelöst“.
> - **Projekt-Skill (`.claude/skills/publish/SKILL.md`).** Claude lädt ihn von selbst, sobald die Beschreibung („Veröffentlichen, Push nach main, Deploy“) zum Auftrag passt; mit `disable-model-invocation: true` wie `/abhaken` und `/messen` (`.claude/skills/`) nur auf `/publish`. Der Skill würde diesen Inhalt tragen (Kopf mit Front­matter statt dieser Notiz), die Datei entfiele oder bliebe als Verweis. Preis: einmal anlegen, und ein von selbst geladener Skill kostet bei jedem Treffer Kontext.
> - **Beides** (Skill als dünner Einstieg, der auf diese Datei zeigt) ist möglich. CLAUDE.md wird erst nach Julians Wahl angepasst.
>
> Jeder Schritt nennt seine Quelle in eckigen Klammern. Wo zwei Quellen sich widersprechen, steht beides, und am Ende sammelt „Offen“ die Stellen.

**Grundsatz:** `origin/main` ist die Produktion; ein Push dorthin ist ein Deploy. Gepusht wird nur auf Julians Wort („merge und push“) [CLAUDE.md, Working rules; umgang §11]. Der Hook `guard-push` lässt jeden Push nach `main` nachfragen [.claude/hooks/guard-push.mjs; umgang §11, Punkt „Fünf Hooks“, 6.39].

## 0. Gibt es überhaupt etwas zu deployen?

- [ ] **Nur Doku geändert?** Dann nicht eigens pushen; der Commit fährt mit dem nächsten Inhalts-Commit mit (Julian, 2026-09-09: „kann warten, pushe beim nächsten commit mit“) [Gedächtnis `docs-only-commits-ride-along`; umgang §11 „Doku-Commits fahren mit dem nächsten Push mit“]. Ausnahme: Julian sagt ausdrücklich Push.
- [ ] **Liegt das lokale `main` weiter vorn als das, was raus soll?** Dann nur diesen einen Commit deployen: Worktree auf `origin/main`, `git cherry-pick`, eigenes `npm ci` (ein verlinktes `node_modules` bricht `next build` ab), Prüfungen dort, `git push origin HEAD:main`; danach `origin/main` ins lokale `main` mergen [umgang §11, erster Punkt].

## 1. Abgeleitete Dateien

- [ ] **Berührt die Änderung eine Quelle, aus der Dateien gebaut werden?** Dann das Skript laufen lassen und das Ergebnis committen — erzeugte Dateien nie von Hand ändern (der Hook `block-generated` weist es mit Exit 2 ab und nennt das Skript) [.claude/hooks/block-generated.mjs; CLAUDE.md Code rules]:

  | Quelle geändert | Skript | Erzeugt |
  |---|---|---|
  | `data/curated.json` | `npx tsx scripts/build-hero-rings.ts` | `data/hero-rings.json`, `hero-ring-signatures.json` [ROADMAP 6.51; Hook-Liste] |
  | Index-Werke | `scripts/build-cover-index.ts`, dann `find-decade-pages.ts`, dann `build-hero-rings.ts` | `data/cover-index.json`, `decade-pages.json`, Ringe [ROADMAP 6.51] |
  | Spielvorrat | `scripts/build-versus-pool.ts` | `versus-pool.json`, `cover-measures.json` [Hook-Liste] |
  | beliebte / vorgeschlagene Werke | `build-popular-works.ts`, `build-suggest-works.ts` | `popular-works.json`, `suggest-works.json` [Hook-Liste] |
  | Ladebilder | `scripts/build-loading-assets.ts` | `public/loading/` [Hook-Liste] |
  | Sammlungen | nichts zu bauen — **aber** die Datei ist nicht, was die Seite zeigt (Entwürfe und Schalter liegen online darüber); vor dem Deploy von `data/collections.json` die Cockpit-Ansicht „Sammlungen & Synchronisation“ ansehen [CLAUDE.md Rules that hold; umgang §12/§13] |

  Die Schritte aus ROADMAP 6.51 (Index-Werke, Ringe) und die Hook-Liste decken sich nicht ganz — die Tabelle vereint beide; die Hook-Liste ist die vollständigere.
- [ ] **Der Test auf `hero-rings.json`** fällt, wenn ein getauschtes Werk nicht in den Ringen steht — das war der Anlass zu 6.51 (Tausch *To the Lighthouse* → *Mrs Dalloway*) [ROADMAP 6.51].

## 2. Prüfen: Tests, Typen, Lint, Build

- [ ] `npm run test:run`, `npx tsc --noEmit`, `npx eslint .` [umgang §9; ROADMAP 6.51 Schritt 2]. Der Stop-Hook verlangt Lint und Tests ohnehin, sobald in `app/`, `components/`, `lib/`, `scripts/`, `proxy.ts`, `next.config.ts` oder `package.json` etwas geändert wurde — höchstens achtmal je Sitzung, ein grüner Baum wird gemerkt; er ersetzt nicht den Build [.claude/hooks/stop-check.mjs].
- [ ] **`tsc` rot in `.next/**/types`?** Erst `find . -path ./node_modules -prune -o -name '* [0-9].*' -print` (Doppeldateien), dann an gelöschte Routen denken: `rm -rf .next/dev/types`. Nicht den Code verdächtigen [umgang §9; ROADMAP 6.51]. vitest und eslint kennen den `tsconfig`-Ausschluss nicht [umgang §9].
- [ ] **`npm run build` muss durchlaufen**, im Worktree mit dem `.env.local` des Hauptordners **nur für diesen Befehl** (Impressum auf `/contact`; ein `next dev` mit diesen Werten zeigte schon auf die Produktions-Redis) [CLAUDE.md Working rules; umgang §4; Gedächtnis `worktree-build-needs-env`]. ROADMAP 6.51 nennt dafür die Variablen `IMPRINT_*`, umgang §4 nur „`.env.local` für `/contact`“ — gemeint ist dasselbe.
- [ ] **Der Build prüft sich selbst:** `package.json` hängt `node scripts/check-prerender.mjs` an `next build`. Es liest die vorgerenderten Buchseiten (`OL…W.html`) und lässt den Build scheitern, wenn mehr als 10 % ohne die JSON-LD-Daten des Werks sind (Open Library schwieg oder wies ab) — dann bleibt die laufende Version stehen [scripts/check-prerender.mjs; ROADMAP 2.18e]. Scheitert der Build daran: **nicht umgehen**, später neu bauen; vorher `curl openlibrary.org` einmal von Hand — Exit 7 heißt, Open Library weist diesen Mac ab, nicht der Code ist kaputt [umgang §1, §10]. Ein Lauf ohne vorgerenderte Seiten meldet „nothing to check“ und besteht.
- [ ] **Kein `next start`/`next dev` aus der Bash gegen den Katalog**, wenn die Antwort zählt: dort fehlt in der Sandbox das Netz („The catalogue did not answer“) [umgang §10].

## 3. Ansehen — gegen `npm run dev`, nicht gegen die Produktion

- [ ] Was sich geändert hat, bei **390 × 844 und 1280 × 800** ansehen und **messen** (`/messen <url>`: abgeschnittene Zeilen, Platzhalter gegen Feld, Seitenbreite, leere Bilder); wo Text oder Kacheln sich ändern, Messung statt Blick [CLAUDE.md Working rules (N14); umgang §9; `.claude/skills/messen`].
- [ ] Bei UI-Änderungen die **fünf Abnahme-Suchen** aus SPEC §3 F1 (mumbo jumbo, 1984, gravity's rainbow, the great gatsby, pride and prejudice) [umgang §9; CLAUDE.md].
- [ ] **Jede neue Textzeile:** Was hat die Seite tatsächlich gesehen? (Ein Ausfall ist kein Befund, N12.) Kein „every / all / complete“ über Cover oder Ausgaben [umgang §9; CLAUDE.md Rules that hold].
- [ ] **Der i18n-Test** nennt jeden englischen Satz ohne deutsche Entsprechung — nie stummschalten; neue Seite ⇒ Spiegeldatei in `app/de/` [umgang §9; CLAUDE.md].
- [ ] Neue Seiten mit Dev-Server: Turbopack liefert gelegentlich alte CSS (`.next/dev/cache/turbopack` löschen, **nie** `fetch-cache`); zwei `next dev` im selben Ordner sperren sich [umgang §10].
- [ ] Änderung an einer Quelle mit Wahrheitsanspruch (Ausgaben, Druck, Cover): erst Ausgabe, dann Druck, dann Bild prüfen; Etiketten wie „erster Druck“ nur mit datiertem Beleg; die Prüfung nennt, was verglichen wurde [CLAUDE.md Rules that hold; umgang §8].

## 4. Die Analytik-Frage

- [ ] **Bewegt die Änderung eine Zahl in `/admin/insights`?** Die sieben Punkte der Liste in CLAUDE.md durchgehen (Shop-Link über `/go/`, bezahlter Aufruf in `prices.ts`, neuer Pfad in `originOf`, was Buchseite/Ergebnisliste rendern, Caching einer Route, neu Gespeichertes samt Datenschutztext, neue Kennzahl). Entweder die Analytik im selben Commit anpassen oder in die Commit-Nachricht schreiben, warum nichts betroffen ist [CLAUDE.md „Every change asks…“; umgang §9].

## 5. Git: Stand, Merge, Commit

- [ ] **`npm run worktrees -- --fetch`** — am Anfang der Sitzung und vor jedem Merge nach `main`; `origin/main` ist die Produktion, das lokale `main` nicht [CLAUDE.md Working rules; umgang §11; Hook `session-start`, `guard-push`].
- [ ] **`origin/main` in den eigenen Branch holen**, bevor nach `main` gemerged wird; im Worktree dafür das Host-Werkzeug `sync_with_base_branch` benutzen, wo es verfügbar ist [umgang §11]. Konflikte in `docs/history.md`: beide Seiten haben ans Ende angehängt — beide behalten [umgang §11, Umzug].
- [ ] **Vor dem Merge nach `main` ein `/code-review` in frischem Kontext** (Regel ohne Hook) [umgang §11, Punkt „Fünf Hooks“].
- [ ] **Ein Commit je Roadmap-Punkt**, der Betreff nennt den Punkt, die Nachricht beantwortet die Analytik-Liste [CLAUDE.md Working rules; umgang §11].
- [ ] Nie `git stash` ohne Namen — WIP-Commit statt Stash [umgang §11].

## 6. Push

- [ ] **Nur auf Julians Wort.** Der Hook fragt bei jedem Push nach `main` nach [guard-push].
- [ ] **Reihenfolge: zuerst `main`, danach der Branch.** Derselbe SHA zuerst als Branch und dann nach `main` gepusht baute am 2026-10-08 nur eine Preview (Produktion blieb alt) [Gedächtnis `same-sha-push-skips-production`; umgang §4].
- [ ] Ein Push, der an „sideband packet“ stirbt oder hängt, ist Transport, nicht Zugang: `git -c http.postBuffer=524288000 push` [umgang §11; Gedächtnis `push-large-packs-postbuffer`].
- [ ] Aus einem **unverknüpften Worktree** nie `vercel deploy` (legte ein neues Projekt an); vorher `.vercel/project.json` prüfen, sonst `vercel link --project beautifulbooks --yes`. Ein manuelles `vercel deploy --prod` aus einer Claude-Sitzung blockt der Berechtigungsfilter — warten, nicht umgehen [umgang §4].

## 7. Auf den Deploy warten

- [ ] `until vercel ls beautifulbooks --prod 2>&1 | grep -m1 https | grep -q 'Ready\|Error'; do sleep 20; done` — die Tabelle kommt auf **stderr**; mit `2>/dev/null` läuft die Schleife ins Leere. Erst starten, wenn die **neue** Zeile da ist, sonst passt die alte [umgang §4; Gedächtnis `wait-for-deploy-via-vercel-ls-stderr`]. Nie warten, indem man die Live-Seite anfragt.
- [ ] **Nach dem Push `vercel ls --prod` ansehen, nicht annehmen:** erscheint keine neue Production-Zeile, aber eine Preview desselben SHA, dann `vercel promote <preview-url> --yes` [Gedächtnis; umgang §4].
- [ ] Endete der Build mit `check-prerender` rot (Schritt 2), blieb die alte Version live — das ist gewollt; später neu bauen.

## 8. Einmal in Produktion prüfen

- [ ] **Genau einmal**: die eine Seite, die eine Suche, die geänderte Sache gegen `https://buyitscovers.com` — nie in einer Schleife, nie als Messreihe; das löst Vercels Bot-Abwehr aus (403, `x-vercel-mitigated: challenge`, sieht aus wie ein Ausfall) und kann Google-Kontingent kosten [CLAUDE.md Working rules/Rules that hold; umgang §4; Gedächtnis `test-on-localhost-not-production`]. Produktionsversuche mit Schreiben nur als `BB_TEST_VISITOR`, nie unter Julians Kennung [Gedächtnis `production-tests-use-test-visitor`].
- [ ] **Fehler lesen, solange er geschieht:** `vercel logs --project beautifulbooks --follow` oder binnen der Stunde (Hobby); `--json` wiederholt Zeilen (nach `id` entdoppeln) [umgang §4].
- [ ] **`npm run backup`** (fragt die Produktion einmal, Admin-Passwort aus dem `.env.local` des Hauptordners, schreibt nach `../bb-backups/`; Datei nie ins Repo, nie in einen Chat) nach einem Deploy, der Speicher oder die Export-Route berührt [umgang §4, 2.11]. *Siehe „Offen“: ob nach jedem Deploy.*

## 9. Festhalten — nichts ist im Chat fertig

- [ ] **Historie** (Messung, was geprüft werden konnte und was nicht), **Roadmap** (Haken, kurz), **docs/roadmap-archive.md**, **docs/features.md**, **SPEC.md** wenn sich Verhalten ändert — `/abhaken <Nr>` führt die fünf Schritte [CLAUDE.md „Read this first“; `.claude/skills/abhaken`].
- [ ] Was Julian nebenbei gesagt hat und aufbewahrenswert ist, in eine Datei, mit Hinweis wohin [CLAUDE.md „Nothing is finished in the chat“].
- [ ] **Vor dem Entfernen eines Worktrees** die git-ignorierten Dateien retten (Screenshots → `docs/tests/` des Hauptordners, teure Lab-Ausgaben → `../bb-lab-cache/<lab>/`, Redis-Kopien → `../bb-backups/`) [umgang §11].

## Fallen, die schon getroffen haben

| Falle | Quelle |
|---|---|
| Alter Typ-Cache in `.next` lässt `tsc` über gelöschte Routen stolpern | umgang §9; ROADMAP 6.51 |
| Zweites `next dev` im selben Ordner sperrt | umgang §10; ROADMAP 6.51 |
| Test auf `hero-rings.json` fällt nach einem Werktausch | ROADMAP 6.51 |
| Gleicher SHA erst als Branch, dann `main`: nur Preview | umgang §4 |
| `vercel ls` schreibt auf stderr | umgang §4 |
| Build im Worktree ohne `.env.local` bricht an `/contact`; mit ihm im Dev-Server: Produktions-Redis | umgang §4 |
| Lokales `main` ≠ Produktion | CLAUDE.md; umgang §11 |
| Open Library weist ab: sieht aus wie ein Fehler im Code / im Build | umgang §1, §10; ROADMAP 2.18e |
| Wiederholte Anfragen an die Live-Seite: Bot-Abwehr, sieht aus wie ein Ausfall | CLAUDE.md; umgang §4 |

## Offen (Quellen, die sich nicht einig sind, und was ich nicht belegen konnte)

1. **Derselbe SHA zweimal:** umgang §4 nennt zwei Beobachtungen — 2026-10-08 nur Preview, 2026-10-18 (cea48d8) Preview und Production zugleich. Die Checkliste folgt der vorsichtigen Reihenfolge (erst `main`) und verlangt den Blick auf `vercel ls --prod`.
2. **Commit-Nachricht und Mitautor-Zeile:** umgang §11 verlangt eine `Co-Authored-By`-Zeile; die aktuelle Sitzungsvorgabe des Harness untersagt Zusatzzeilen. Hier nicht als Schritt aufgenommen — Julian entscheidet, welche Regel gilt.
3. **`npm run backup`:** umgang §4 beschreibt es als einmalig fragende Kopie; dass es **nach jedem** Deploy zu laufen hat, steht in keiner Quelle, die ich gefunden habe (Auftrag nennt es so). Als „nach einem Deploy, der Speicher/Export berührt“ eingetragen; ob nach jedem, entscheidet Julian. Außerdem: der Mac erreicht die Produktions-Redis nicht direkt, die Kopie geht über die Export-Route (umgang §4).
4. **Build-Variablen:** ROADMAP 6.51 nennt `IMPRINT_*`, umgang §4 und CLAUDE.md sagen „`.env.local` des Hauptordners“. `.env.example` führt `IMPRINT_NAME`, `IMPRINT_STREET`, `IMPRINT_CITY` … — kein echter Widerspruch.
5. **`/code-review` vor dem Merge** steht nur als „Regel ohne Hook“ in umgang; ob sie auch bei reinen Doku-Commits gilt, sagt keine Quelle.
6. **Reine Datenänderungen an Sammlungen** (`lab/collections/push-draft.ts … --publish`) deployen nicht; welche Schritte dafür vor dem Veröffentlichen gelten, steht in umgang §13 und gehört vermutlich in einen eigenen Abschnitt, falls Julian die Checkliste darauf ausdehnen will.
