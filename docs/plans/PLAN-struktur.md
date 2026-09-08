# Vorschlag: Ordnung des Projekts, bevor es weitergeht

Stand: 2026-09-08. Anlass: Julian will vor dem Weitermachen wissen, ob die Ordnerstruktur angepasst werden muss — auch, um Dinge wie einen automatisierten TikTok-Clip im selben Projekt zu erproben, „nicht zu sehr mit der Website vermischt, aber trotzdem hier im Kontext“. Die Entscheidung ist [ROADMAP](../../ROADMAP.md) 0.11: **Julian hat am 2026-09-08 Option A gewählt** und `lab/` ist angelegt (README mit den Regeln, Lint-Regel, `.gitignore`); der Clip aus §4 wartet auf sein Startzeichen. Nichts wurde verschoben.

---

## 1. Was heute da ist

- **Der Root ist eine Next-App:** `app/`, `components/`, `lib/`, `public/`, dazu `scripts/` (Fixtures aufnehmen, Kauf-Links prüfen, seit 2026-09-08 auch Indizes bauen) und seit 2026-09-08 `data/` für gebaute, nur lesbare Indizes nach E18.
- **`lib/` ist reines TypeScript ohne einen Import aus `next`** (geprüft 2026-09-08). Das ist die wichtigste Eigenschaft für alles Weitere: jedes Skript kann `lib/` per `npx tsx` benutzen, ohne dass Next läuft. `scripts/` tut das heute schon; die `next: { revalidate }`-Optionen an `fetch` sind außerhalb von Next wirkungslos und stören nicht.
- **Doku:** SPEC, ROADMAP, CLAUDE, README; `docs/history.md`, `docs/plans/` (acht Pläne, drei davon historisch), `docs/tests/`, `docs/spine-research.md`. Neu seit 2026-09-08: ein Index in [docs/plans/README.md](README.md), der sagt, welcher Plan offen und welcher Geschichte ist.
- **255 Pfadangaben** in den Dokumenten und 18 in Code-Kommentaren zeigen auf `lib/`, `app/`, `components/`, `scripts/`. Das ist der Preis jeder Verschiebung.
- **Was nicht hingehört:** zwei `scratch-*.ts` im Root (Arbeitsdateien einer laufenden Sitzung), `tsconfig.tsbuildinfo` (ignoriert), fünf unbenutzte Next-Boilerplate-SVGs in `public/` (gelöscht 2026-09-08).

---

## 2. Drei Möglichkeiten

| | A — so lassen, `lab/` dazu | B — Monorepo mit Workspaces | C — eigenes Repo je Experiment |
|---|---|---|---|
| Aufbau | Website bleibt im Root; Experimente in `lab/<name>/`, benutzen `lib/` direkt | `apps/web`, `packages/covers` (das heutige `lib/`), `lab/*`, `docs/`; npm-Workspaces | Website hier, jedes Experiment woanders |
| Aufwand | eine Stunde: Ordner, Regel, Lint-Regel | ein Tag: Verschieben, `tsconfig`-Pfade, Vitest-Alias, Next-Konfiguration, 273 Pfadangaben, CLAUDE.md-Layout | zehn Minuten je Repo |
| Vermischung | Eine Lint-Regel verhindert, dass die Website aus `lab/` importiert | Sauber getrennt durch Pakete | Vollständig getrennt |
| Kontext | Spec, Roadmap, Historie, Fixtures und `lib/` sind da | dito | weg — genau das, was Julian nicht will |
| Wann richtig | jetzt | wenn eine **zweite** ausgelieferte Anwendung entsteht oder `lib/` als eigenes Paket irgendwohin veröffentlicht wird | nie für dieses Projekt |

**Empfehlung: A.** B kauft eine Trennung, die A mit einer Lint-Regel auch hat, und bezahlt dafür mit einem Tag Umbau und dem Gedächtnis jeder Sitzung, die die heutigen Pfade kennt. Der Moment für B ist erkennbar: wenn ein Experiment so schwere Abhängigkeiten braucht (Remotion, Puppeteer), dass es ein eigenes `package.json` will. Dann wird der Root Workspace-Root, und nur dieses eine Experiment wird ein Paket — das ist ein Teil von B, nicht B.

---

## 3. Der Vorschlag im Einzelnen

```
beautifulbooks/
  app/  components/  lib/  public/   die Website — unverändert
  scripts/                           Werkzeuge, die die Website braucht: Fixtures, Indizes, Prüfungen
  data/                              gebaute, nur lesbare Indizes (E18), von scripts/ erzeugt, committet
  lab/                               Experimente neben der Website — neu
    video/                           der erste Bewohner, Abschnitt 4
  docs/                              history.md, plans/, tests/
```

**Regeln für `lab/`**, die nach der Entscheidung in CLAUDE.md gehören:

1. **Ein Ordner je Experiment**, mit einer `README.md`, die drei Dinge sagt: welche Frage es beantwortet, woran man Erfolg erkennt, und was der Stand ist.
2. **`lab/` darf aus `lib/` importieren. `app/`, `components/`, `lib/` und `scripts/` importieren nie aus `lab/`.** Das erzwingt eine `no-restricted-imports`-Regel in `eslint.config.mjs` (wenige Zeilen), nicht die Disziplin.
3. **Läuft mit `npx tsx lab/<name>/<skript>.ts`.** Abhängigkeiten stehen als `devDependencies` im Root, eine Lockdatei für alles. Erst ein Experiment mit schweren Abhängigkeiten bekommt ein eigenes `package.json` (siehe oben).
4. **Tests unter `lab/<name>/__tests__/`**; Vitest findet sie ohne Konfiguration. Wie überall: keine Netzaufrufe in Tests, Fixtures aus `lib/__fixtures__/`.
5. **`lab/` ist von der Phasenreihenfolge der Roadmap ausgenommen**, denn es ist nicht die Website. Aber jedes Experiment hat eine Zeile in der Roadmap, sonst wird es vergessen, und **nichts aus `lab/` erreicht die Website, ohne über die Roadmap zu gehen**: die Beförderung nach `scripts/` oder `app/` ist ein eigener Punkt mit Messung.
6. **Kein Google Books aus `lab/`** ohne Messung (E10): der Schlüssel ist derselbe wie der der Website, und die 1.000 am Tag sind gemeinsam. Skripte laufen mit `googleBooks: false`.
7. **Kein Scratch im Root.** Arbeitsdateien liegen in `lab/<name>/` oder im Scratchpad der Sitzung; `/scratch-*` kommt in `.gitignore`.

**Doku bleibt, wie sie ist.** Die drei historischen Pläne (PLAN-A, PLAN-B, PLAN-11) nicht verschieben: vier Dateien verlinken sie, und ihr Kopf sagt schon, dass sie Geschichte sind. Neue Pläne heißen `PLAN-<Roadmap-Nummer>-<slug>.md`; die alten Namen bleiben, der Index in `docs/plans/README.md` erklärt sie.

---

## 4. Der erste Bewohner: ein Clip aus einer Cover-Wand (Prototyp für ROADMAP 5.5)

**Was.** Ein Clip im Hochformat 1080 × 1920, rund 15 Sekunden: Titelkarte, dann ein Cover nach dem anderen („30 covers of *Dune*, 1965–2024“), Verlag und Jahr klein darunter, Schlusskarte mit der Adresse der Seite. Das Material fällt vollständig aus den Daten, die die Detailseite ohnehin lädt.

**Der Schnitt, der es testbar macht.** Zwei Dateien, weil nur eine davon einen Test verträgt:

- `lab/video/storyboard.ts` — **rein**, ohne I/O: aus einer geladenen Werkseite (`getWorkDetail` aus `lib/work.ts`, mit `googleBooks: false`) und Optionen (Sprache, Höchstzahl, Sekunden) entsteht ein Storyboard: eine Liste von Bildern mit Bild-URL, Verlag, Jahr und Dauer, dazu Titel- und Schlusstext. Die Regeln darin sind die der Wand: ein Cover je Motiv (`foldDuplicateCovers` aus `lib/works.ts`), gescannte Innenseiten aussortiert (`looksLikeScannedPage`), nach Jahr geordnet, gedeckelt. **Test:** `lab/video/__tests__/storyboard.test.ts` über die Gatsby-Fixtures, wie `lib/__tests__/integration.test.ts` sie einliest, mit `dedupeCovers: false` wie dort — prüft, dass kein Motiv zweimal vorkommt, keine Innenseite dabei ist, die Dauern sich zur Zielzeit summieren und die Reihenfolge stimmt. Kein Netz.
- `lab/video/render.ts` — **I/O**: lädt die Bilder (`fetchBytes` aus `lib/sources/http.ts`), schreibt sie als Einzelbilder in einen Arbeitsordner, ruft `ffmpeg` (concat-Demuxer, `scale`/`pad` auf 1080 × 1920, `drawtext` für die Unterzeile) und schreibt eine MP4. Nicht unit-getestet; der Test ist ein Lauf von Hand mit einem Werk und ein Blick auf das Ergebnis.

**Werkzeug.** `ffmpeg` ist auf Julians Rechner **nicht installiert** (geprüft 2026-09-08): `brew install ffmpeg`. Alternative wäre **Remotion** — Video als React-Komponenten, passt zum Stack und kann Typografie und Bewegung, die ffmpeg nur mühsam kann. Dagegen: schwere Abhängigkeiten (Chromium), und die Lizenz ist nur für Einzelpersonen und kleine Firmen frei — vor dem Einsatz prüfen. Empfehlung: ffmpeg zuerst, weil das Storyboard der Teil mit Wert ist und ffmpeg keine neue Abhängigkeit im Repo braucht; Remotion erst, wenn der Clip gut genug ist, um an der Gestaltung zu scheitern.

**Messlatte.** Ein Clip für *Dune* rendert in unter einer Minute, ist anzusehen, und der Storyboard-Test belegt: kein Motiv zweimal, keine Innenseite.

**Rechtefrage, bevor irgendetwas gepostet wird.** Auf der Website sind Cover Katalogbilder mit Quellenangabe. Ein Clip auf TikTok verbreitet dieselben Bilder in einem anderen Zusammenhang; die Roadmap sagt schon „erzeugen ja, posten von Hand“, aber Posten braucht eine Antwort auf die Rechtefrage, nicht nur Hände. Sie gehört zu 5.5, nicht zu diesem Prototyp.

**Aufwand.** Ein halber Tag für Storyboard und Test, ein halber für Render und README.

---

## 5. Was zu entscheiden ist (ROADMAP 0.11)

1. **A oder B.** Empfehlung A.
2. **Der Name:** `lab/` (Alternativen: `experiments/`, `sandbox/`). Kurz und nicht mit `scripts/` zu verwechseln.
3. **Ob der Clip jetzt gebaut werden darf**, obwohl Phase 1 offen ist. Nach Regel 5 ja; es kostet aber eine Sitzung, die Phase 1 nicht bekommt.

Nach der Entscheidung: `lab/` und `.gitignore`-Zeile anlegen, Lint-Regel, Regeln 1–7 in CLAUDE.md, Roadmap-Zeile für `lab/video` — eine Stunde, Claude.
