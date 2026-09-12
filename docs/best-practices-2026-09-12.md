# Best Practices für Websites und für die Arbeit mit Claude Code — was davon auf uns passt

Stand: 2026-09-12. Julian: „recherchiere nochmal best practices für websites und für website-programmierung mit claude code und finde sachen, die auf unseren use case übertragbar sind." Gelesen wurden die offiziellen Claude-Code-Seiten (Best Practices, Hooks, Chrome) und ein Dutzend Artikel zu Core Web Vitals, programmatischem SEO und Browser-Verifikation; Quellen am Ende. Jeder Befund steht mit dem, was er bei uns bedeutet — **übertragbar**, **schon erfüllt** oder **nicht übertragbar** —, und was übertragbar ist, hat einen Roadmap-Punkt (6.39–6.44) oder eine Notiz an einem bestehenden.

Der Maßstab ist derselbe wie in der [Bewertung der offenen Punkte](../ROADMAP.md#bewertung-der-offenen-punkte-2026-09-12): eine Praxis ist übertragbar, wenn sie einen Fehler verhindert, den wir schon einmal gemacht haben, oder eine Arbeit spart, die wir wiederholt tun.

---

## A. Die Website

### A1. Core Web Vitals: ein einziges `priority`, und Felddaten statt Laborwerte

**Was die Quellen sagen.** Die Ziele bleiben LCP < 2,5 s, INP < 200 ms, CLS < 0,1; seit 2026 kommt „Engagement Reliability" dazu. Entscheidend sind **Felddaten aus dem Chrome-User-Experience-Report** (CrUX), nicht die Laborwerte von PageSpeed — die Search Console zeigt sie. Der häufigste Fehler bei bildlastigen Next.js-Seiten ist **„priority abuse"**: mehrere Bilder als `priority`, jedes davon erzeugt ein `<link rel="preload">`, und der Browser konkurriert um Bandbreite für Bilder, die er nicht alle sofort braucht. Regel: `priority` genau auf das eine Bild, das der LCP-Kandidat ist; alle anderen `loading="lazy"` mit korrekten `sizes`.

**Bei uns.** Übertragbar, und es korrigiert einen offenen Punkt: 6.5 nennt „`priority` auf den ersten Kacheln" — im Plural. Nach der Regel oben wäre das genau der Fehler. Auf der Werkseite ist der LCP-Kandidat das große Cover in der Seitenleiste (dort steht `priority` schon), auf der Startseite das erste Kachelbild oder das Rondell. **Notiz an 6.5:** höchstens ein `priority` je Seite, und erst nach Messung im Feld. **Notiz an 2.5:** mit der Search Console kommt der Core-Web-Vitals-Bericht — die erste Messung mit echten Geräten, die wir je hatten. Schon erfüllt: feste Seitenverhältnisse der Kacheln (`aspect-[2/3]`) gegen CLS, die Bildroute mit CDN-Cache (1.3), Server-Komponenten für Metadaten.

### A2. Programmatisches SEO: vorbauen, was gesucht wird, den Rest on demand — und keine dünnen Seiten

**Was die Quellen sagen.** Das Muster für hunderte Seiten aus Daten: `generateStaticParams` für die **vordersten 200–500**, der lange Schwanz per ISR beim ersten Abruf; `generateMetadata`, Canonical und Sitemap sauber; und seit Googles verschärften Spam-Regeln: **jede Seite braucht eigene Substanz** (echte Daten, Tabellen, Beobachtungen), sonst schadet die Menge der ganzen Domain. Long-Tail-Suchen konvertieren besser als Kopfbegriffe.

**Bei uns.** Schon erfüllt, und zwar bewusst: 5.1 beschreibt genau diese Aufteilung (18 vorgerendert, Rest ISR, Sitemap aus einer kuratierten Liste, nicht „alle Werke"), und die Jahrzehnte-Seite antwortet unter der Schwelle mit 404 statt mit einer dünnen Seite (5.4a). Eine Cover-Wand ist einzigartiger Inhalt im Sinne der Regel. Übertragbar ist die Schwelle für das Vorrendern: die Quellen nennen 200–500 als Zahl, bei der sich die Bauzeit noch lohnt; unser Argument dagegen (ein Build in einer stillen Katalog-Episode liefert hundert leere Seiten) ist spezifisch und stärker. Bleibt bei 5.1, wie es steht.

### A3. Überwachung gegen Bot-Abwehr

**Was die Quellen sagen** (und was wir selbst gemessen haben, 2.4): Uptime-Dienste, die eine Adresse in Schleife abrufen, laufen bei Vercel in die Bot-Abwehr und melden Ausfälle, die es nicht gibt.

**Bei uns.** Bekannt; der Firewall-Entwurf liegt auf `claude/firewall-2.4`. Nichts Neues, aber die Reihenfolge bestätigt sich: erst Attack Mode prüfen, dann Ausnahme, dann Monitor.

---

## B. Die Arbeit mit Claude Code

### B1. Der Kern der offiziellen Anleitung: eine Prüfung, die Claude selbst laufen lassen kann

**Was die Quelle sagt.** „Give Claude a check it can run: tests, a build, a screenshot to compare. It's the difference between a session you watch and one you walk away from." Ohne ein Pass/Fail-Signal ist „sieht fertig aus" das einzige Signal, und der Mensch wird zur Prüfschleife. Vier Stufen, je nach Aufwand: die Prüfung im Prompt, ein `/goal`, ein **Stop-Hook**, der den Turn nicht enden lässt, bis die Prüfung besteht (Deckel: acht Blockaden in Folge), oder ein Prüf-Subagent mit frischem Kontext, „so the agent doing the work isn't the one grading it." Und: **Beweise zeigen statt Erfolg behaupten** — die Testausgabe, den Screenshot.

**Bei uns.** Größtenteils erfüllt: Tests, Build, Lint, `tsc`, die Akzeptanz-Queries, die N14-Messung bei 390 und 1280 px, Screenshots nach `docs/tests/`. Übertragbar sind zwei Stufen, die wir nicht haben: **ein Stop-Hook**, der Lint und Tests vor dem Ende eines Turns verlangt, wenn Code geändert wurde (→ 6.39), und **ein Prüf-Subagent vor jedem Merge nach `main`** — die Anleitung nennt `/code-review` genau dafür. Am 2026-09-10 gingen sechs Commits nach `main`, ohne dass jemand außer dem Autor sie gelesen hatte.

### B2. Hooks: was jedes Mal gelten muss, gehört nicht in CLAUDE.md

**Was die Quelle sagt.** „Instructions in CLAUDE.md are advisory; hooks are deterministic." Ereignisse u. a. `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, `PreCompact`; ein `PreToolUse`-Hook mit Exit-Code 2 **blockt** die Aktion und gibt Claude die Begründung zurück; ein `PostToolUse`-Hook auf `Edit|Write` läuft nach jeder Änderung (Beispiel der Doku: Prettier). Konfiguriert in `.claude/settings.json`, Skripte unter `.claude/hooks/`.

**Bei uns.** Das ist der übertragbarste Befund der ganzen Recherche, weil vier unserer CLAUDE.md-Regeln genau solche „jedes Mal"-Regeln sind, die trotzdem schon gebrochen wurden:

| Regel in CLAUDE.md | Was passiert ist | Als Hook |
|---|---|---|
| `npm run worktrees -- --fetch` zu Sitzungsbeginn | am 2026-09-10 lag `main` sechs vor und fünfzehn hinter Produktion, ohne dass es jemand sah | `SessionStart` → das Skript läuft von selbst |
| `docs/worktrees.md`, `docs/kanban.html` werden nie von Hand bearbeitet | noch nicht passiert — aber nichts verhindert es | `PreToolUse` auf `Edit\|Write` blockt die erzeugten Dateien und `data/cover-index.json` |
| Das Brett ist eine Ansicht der Roadmap | ein Brett, das nach einer Roadmap-Änderung nicht neu erzeugt wird, ist nach einer Stunde falsch | `PostToolUse` auf `Edit\|Write` von `ROADMAP.md` → `npm run kanban` |
| Vor einem Push nach `main` die Übersicht lesen; `origin/main` ist Produktion | fünfzehn Commits gingen direkt nach Produktion | `PreToolUse` auf `Bash` mit `git push` → erst `worktrees --fetch`, und ein Push nach `main` fragt nach |

→ **6.39**, eine Stunde Claude. Dazu der Stop-Hook aus B1.

### B3. Skills: wiederholte Abläufe als `/befehl`

**Was die Quelle sagt.** „When a procedure repeats, write it as a skill" — eine `SKILL.md` unter `.claude/skills/` mit Schritten, Prüfungen und Abbruchbedingung; `disable-model-invocation: true` für Abläufe mit Nebenwirkungen, die man bewusst auslöst.

**Bei uns.** Übertragbar, mit einem konkreten Kandidaten: **das Abhaken eines Punkts** hat fünf Schritte (Kurzfassung in der Roadmap, Langtext ins Archiv, Zeile in `docs/features.md`, Messung in die Historie, Brett neu erzeugen), und drei Sitzungen haben Teile davon ausgelassen — 1.9 behielt zwei offene Kästchen im abgehakten Punkt, 5.8a kam nie in die Roadmap, 6.16 Schritt 1 wurde beim Umbau übersehen. Ein `/abhaken <Nr>` macht den Ablauf zu einem Befehl statt zu einer Erinnerung. Zweiter Kandidat: die N14-Messung bei 390 und 1280 px als `/messen`. → **6.40**.

### B4. Der Browser: echte Tastendrücke, Konsole, Screenshots auf Platte

**Was die Quellen sagen.** Zwei Wege: die **Claude-in-Chrome-Erweiterung** (aus der CLI mit `--chrome`, in VS Code automatisch, sobald installiert; Pro/Max-Plan und `/login` nötig) steuert einen sichtbaren Chrome mit Login-Zustand, liest Konsole und Netzwerk, tippt echte Tasten, speichert Screenshots und nimmt GIFs auf; **Playwright MCP** (`@playwright/mcp`, Microsoft) arbeitet über den Accessibility-Tree, ist token-sparsamer und eignet sich für Testsuiten. Empfehlung der Artikel: Chrome für die tägliche Entwicklung, Playwright für Tests.

**Bei uns.** Übertragbar, und es löst drei offene Punkte auf einmal, die heute an „das Browser-Panel kann es nicht" hängen: **0.8a** (Tab-Reihenfolge, Enter auf einer Kachel, Fokus-Ring — das Panel schickt Tastendrücke ohne Tastenwert), **1.8** (Hugendubel und genialokal rendern im Browser), **6.38** (beide Varianten ansehen). Dazu die N14-Messungen, die heute mit Headless-Chrome und `--screenshot` behelfsmäßig laufen. → **6.41**: Julian installiert die Erweiterung (fünf Minuten), Claude prüft.

### B5. CLAUDE.md: kurz, sonst gehen Regeln verloren

**Was die Quelle sagt.** „Keep it concise. For each line, ask: would removing this cause Claude to make mistakes? If not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" Hinein gehören Befehle, die Claude nicht raten kann, Stilregeln, die von Standards abweichen, Repository-Etikette, Architekturentscheidungen und Fallstricke; **nicht** hinein gehört, was sich aus dem Code lesen lässt, und nichts, was sich häufig ändert. `/doctor` schlägt Kürzungen vor.

**Bei uns.** Übertragbar und überfällig: **3.571 Wörter**, davon ein Abschnitt „Current state", der sich täglich ändert und in `docs/features.md` schon ein besseres Zuhause hat, und „Facts about the APIs", die eine Skill oder eine Doku-Seite sein könnten. Die Regeln selbst — Google an zwei Stellen, keine Vollständigkeit, kein Ausfall als Befund, erzeugte Dateien nie von Hand — sind das, was bleiben muss. → **6.44**, Claude kürzt, Julian liest gegen; die Messlatte ist, dass danach keine Regel verloren ist und `/doctor` nichts mehr vorschlägt.

### B6. Parallele Sitzungen: Worktrees, und die Rezension durch einen frischen Kontext

**Was die Quelle sagt.** Worktrees für parallele Sitzungen, „so edits don't collide"; ein Writer/Reviewer-Muster über zwei Sitzungen, weil ein frischer Kontext Code besser prüft als der, der ihn schrieb.

**Bei uns.** Worktrees sind seit dem 2026-09-10 Regel und funktionieren — die Kollisionen vom 2026-09-09 und -10 passierten ohne sie. Übertragbar bleibt die Rezension: **vor jedem Merge nach `main` ein `/code-review`** in frischem Kontext (siehe B1). Gehört zu 6.39 als Regel, nicht als Hook.

### B7. Plan-Modus, Kontext, Subagenten

**Was die Quelle sagt.** Erkunden, planen, bauen, committen; Plan-Modus, wenn mehrere Dateien betroffen sind oder der Weg unklar ist, sonst direkt; `/clear` zwischen Aufgaben; Recherche in Subagenten, damit der Hauptkontext sauber bleibt; nach zwei fehlgeschlagenen Korrekturen `/clear` und ein besserer Prompt.

**Bei uns.** Schon erfüllt: die Pläne in `docs/plans/` sind genau die Trennung von Planen und Bauen, und CLAUDE.md verlangt sie. Nicht übertragbar ohne Not: Subagenten für Recherche — unsere Sitzungen lesen die Roadmap ohnehin ganz, und das ist gewollt.

### B8. Nicht-interaktiver Betrieb für die Fabrik

**Was die Quelle sagt.** `claude -p "…" --output-format json` für Pipelines, `--allowedTools` zum Einschränken, erst an zwei, drei Fällen prüfen, dann auf alle.

**Bei uns.** Passt exakt auf 5.3 (Entwurf und gegnerische Prüfung als zwei Aufträge, ein Pull Request die Woche). Nichts zu ändern, aber der Plan kann sich darauf stützen, dass das Muster offiziell ist.

---

## C. Ein Befund, der keine Best Practice ist, sondern ein Fehler

**Das Repository liegt in iCloud Drive** (`~/Library/Mobile Documents/…`). iCloud synchronisiert `.next/` und `node_modules/` mit, legt beim Zusammenführen „… 2"-Doppeldateien und `.icloud`-Platzhalter an — am 2026-09-12 lagen acht davon in `.next/` —, und weil `tsconfig.json` `.next/types/**` einschließt, **bricht `npx tsc --noEmit` an Dateien, die kein Mensch geschrieben hat** (`routes.d 2.ts`). Ein Typecheck, der immer rot ist, ist keiner mehr. Dazu ist jeder Build ein Sync von tausenden Dateien. Empfehlung: die Arbeitskopie nach `~/Projects` (oder wohin auch immer, nur nicht in iCloud); Git ist die Sicherung, nicht die Cloud. Bis dahin ein `exclude` der Doppel in `tsconfig.json`. → **6.42**, Julian entscheidet den Ort, Claude baut den Ausschluss.

---

## Was daraus in die Roadmap kommt

| Punkt | Was | Wer | Aufwand |
|---|---|---|---|
| **6.39** | Hooks für die Regeln, die jedes Mal gelten: Worktree-Übersicht bei Sitzungsstart, erzeugte Dateien geschützt, Brett nach Roadmap-Änderung, Push-Wächter, Stop-Hook mit Lint und Tests; dazu die Regel „`/code-review` vor jedem Merge nach `main`" | Claude | 1 h |
| **6.40** | Skills `/abhaken <Nr>` und `/messen` | Claude | 1 h |
| **6.41** | Claude in Chrome einrichten; damit 0.8a, 1.8, 6.38 abarbeiten | Julian 5 min, Claude 1 h |
| **6.42** | Das Repo aus iCloud Drive holen, bis dahin die Doppel aus `tsc` ausschließen | Julian entscheidet, Claude baut | 30 min |
| **6.44** | CLAUDE.md auf ein Drittel kürzen, ohne eine Regel zu verlieren | Claude, Julian liest gegen | 1 h |
| Notiz an 6.5 | höchstens ein `priority` je Seite, nach Messung | — | — |
| Notiz an 2.5 | den Core-Web-Vitals-Bericht der Search Console lesen: erste Felddaten | Julian | — |

(6.43 ist derselbe Tag, aber aus der Bewertung, nicht aus der Recherche: der unvollständige Lauf der Jahrzehnte-Seite, der 24 Stunden gecacht wird.)

## Quellen

- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices) — offizielle Anleitung: Verifikation, Plan-Modus, CLAUDE.md, Hooks, Skills, Subagenten, Worktrees, `claude -p`
- [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide) — Ereignisse, `settings.json`, Blocken mit Exit-Code 2, Stop-Hook und sein Deckel
- [Use Claude Code with Chrome](https://code.claude.com/docs/en/chrome) — Fähigkeiten, Voraussetzungen, Grenzen der Browser-Erweiterung
- [How to Use Playwright MCP Server with Claude Code](https://www.builder.io/blog/playwright-mcp-server-claude-code) und [Playwright MCP vs Claude in Chrome](https://lalatenduswain.medium.com/playwright-mcp-vs-claude-in-chrome-which-browser-testing-tool-should-you-use-in-2026-e502bee0067a) — die zwei Wege in den Browser
- [Next.js SEO Best Practices for Core Web Vitals](https://johnkavanagh.co.uk/articles/seo-best-practices-in-next-js-improving-core-web-vitals/), [Next.js Core Web Vitals 2026: LCP Fixes](https://shubhamjha.com/blog/core-web-vitals-nextjs-optimization) (priority abuse), [Core Web Vitals 2026](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide) (Felddaten, Engagement Reliability)
- [How to Build Programmatic Pages in Next.js](https://seography.io/learn/programmatic-seo/programmatic-seo-next-js) und [Programmatic SEO: Hundreds of Pages Without Penalties](https://www.pragma-code.de/en/blog-programmatic-seo) — vorbauen vs. ISR, dünne Seiten
- [7 Claude Code best practices for 2026](https://www.eesel.ai/blog/claude-code-best-practices) und [Claude Code Advanced Best Practices](https://smartscope.blog/en/generative-ai/claude/claude-code-best-practices-advanced-2026/) — Hooks als Leitplanken, Worktrees, Writer/Reviewer
