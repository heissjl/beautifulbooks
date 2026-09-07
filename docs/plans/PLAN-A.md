# Plan für Punkt A: bevor die Seite jemand sieht

> **A1 und A2 erledigt 2026-09-07.** Die Entscheidungen aus A3 stehen offen in [../../ROADMAP.md](../../ROADMAP.md), Phase 0 (0.1 Verfügbarkeits-Button, 4.1 Bookshop); das Kontingent aus A3.1 ist abgelesen (history, alte §8.7). Verweise auf `SPEC.md §…` meinen die Gliederung vor dem 2026-09-07 (Konkordanz in SPEC.md §8).

Detailplan zu SPEC.md §10 Abschnitt A, geschrieben 2026-09-07. Drei Teile, in dieser Reihenfolge: den Branch aufräumen und mergen, den falschen Claim entfernen, drei offene Entscheidungen fällen. Zusammen etwa zwei Stunden, davon eine für A2.

Danach ist die Seite in dem Zustand, in dem man sie jemandem zeigen kann: nichts darin behauptet mehr etwas, das die Messungen widerlegen. Erst dann lohnt Punkt B.

---

## A1 — PR #1 aktualisieren und mergen · *erledigt 2026-09-07, Merge-Commit `3e353b3`*

### Ausgangslage (geprüft 2026-09-07)

| | |
|---|---|
| PR | #1, `rewrite-data-layer` → `main`, Status MERGEABLE |
| Titel | „Rewrite data layer, cover model and design pass (SPEC steps 1-9, 8.1)" |
| Inhalt | 31 Commits, 97 Dateien, +31.527 / −3.556 |
| `origin/main` | steht auf `09e9a7f`, dem alten Stand mit dem kaputten Autorenfilter |
| Fast-Forward | möglich: `origin/main` ist Vorfahre von `main` |

Titel und Beschreibung nennen nur die Schritte 1–9. Tatsächlich enthält der PR inzwischen die Analyse §9 und die Schritte 10, 11, 12, 13, 13a und 16. Wer den PR in einem halben Jahr liest, findet den Umbau nicht.

### Schritte

1. **Titel ersetzen** durch: `Rewrite the data layer and make the search trustworthy (SPEC 1–9, steps 10–16)`.
2. **Beschreibung neu schreiben.** Aufbau: ein Absatz Problem, ein Absatz Lösung, dann eine Tabelle mit den gemessenen Vorher-Nachher-Zahlen (Gatsby 43 → 293 Cover, 1984 68 → 226, Ranking, Google-Anfragen 7–11 → 2), dann die Liste der Schritte mit je einer Zeile, zuletzt die offenen Punkte mit Verweis auf §8.7 und §10. Die Zeile `🤖 Generated with [Claude Code](https://claude.com/claude-code)` bleibt am Ende.
3. **Grün prüfen** vor dem Merge: `npm run test:run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
4. **Merge-Art: normaler Merge, kein Squash.** CLAUDE.md verlangt einen Commit pro Schritt, und die 31 Nachrichten tragen die Messungen und Begründungen. Ein Squash wirft genau das weg. Befehl: `gh pr merge 1 --merge`.
   *Alternative, falls eine lineare Historie lieber ist:* `gh pr merge 1 --rebase` behält die Einzel-Commits ebenfalls; nur `--squash` ist ausgeschlossen.
5. **Danach aufräumen:** `git checkout main && git pull`, Branch `rewrite-data-layer` auf GitHub löschen (die Historie steckt jetzt in `main`), lokal `git branch -d rewrite-data-layer` falls vorhanden.
6. **Prüfen**, dass `origin/main` auf dem neuen Stand steht und der Build von `main` grün ist. Das ist der Stand, den Vercel in Punkt B deployen wird.

### Fallstricke

- Nach dem Merge zeigt `main` auf GitHub 31 neue Commits. Falls eine Branch-Protection-Regel existiert, muss sie den Merge erlauben; heute gibt es keine.
- `PLAN-11.md` und `PLAN-A.md` liegen im Repo. Sie sind Arbeitsdokumente, keine Spezifikation. Entweder bleiben sie (mit einem Satz am Kopf, dass die SPEC führt) oder sie wandern nach dem Abschluss in einen Ordner `plans/`. Vorschlag: bleiben lassen, sie erklären die Messungen.

---

## A2 — Schritt 15: ehrliche Sprache · *erledigt 2026-09-07; als Überschrift wurde „Judge a book by its covers.“ gewählt*

### Der Befund

Die Seite behauptet an vier Stellen, alle Cover aller Ausgaben zu zeigen. §9.1 A hat gemessen, dass das nicht stimmt und nie stimmen wird: Open Library kennt für *The Great Gatsby* 379 Ausgaben mit Cover, wir zeigen 293 nach der Faltung, und beide Kataloge zusammen kennen nur einen Teil dessen, was je gedruckt wurde. Der Zähler auf der Detailseite sagt seit Schritt 11 die Wahrheit („293 covers from 1,180 editions"), der Header darüber widerspricht ihm.

### Jede betroffene Stelle

| Datei | Zeile | Heute | Vorschlag |
|---|---|---|---|
| `app/page.tsx` | 37 | „Every cover of every edition, *in one place.*" | „The covers a book *has had.*" |
| `app/page.tsx` | 40 | „Search a book, compare all the covers it has ever had, and find the edition you actually want to own." | „Search a book, see the covers two open catalogues know, and find the edition you actually want." |
| `components/SiteHeader.tsx` | 20 | „Every cover of every edition." | „Book covers, side by side." |
| `app/layout.tsx` | 28 | „Every cover of every edition of a book, in one place. Find the edition you actually want." | „See the covers a book has had, side by side, and find the edition you actually want. Data from Open Library and Google Books." |
| `README.md` | 3 | „Open a book to see every edition" | „Open a book to see the editions those catalogues have a cover for" |
| `components/CoverGallery.tsx` | 39 | `aria-label="All covers"` | `aria-label="Covers"` |

Der Fußzeilentext („Data from Open Library and Google Books. Cover images belong to their publishers." / „Purchase links may earn us a commission.") und die Fußnote unter der Wand aus Schritt 11 bleiben unverändert; beide sind bereits korrekt.

### Warum diese Formulierungen

- **„The covers a book has had"** verspricht eine Auswahl, keine Vollständigkeit, und benennt trotzdem, worum es geht. Der Einschub *has had* trägt die Zeitachse, die das Produkt ausmacht.
- **„two open catalogues"** nennt die Quelle im ersten Satz, den ein Besucher liest. Das ist dieselbe Ehrlichkeit, die §9.2 für die Kauf-Links verlangt, nur an der Eingangstür.
- **Nirgends „every" oder „all".** Als Regel in CLAUDE.md aufnehmen, damit es nicht zurückrutscht.

### Nicht Teil von A2

Die About-Seite steht in §9.3 Schritt 15 mit drin, gehört aber zu Punkt B: sie braucht die Fußzeilen-Links und entsteht zusammen mit Impressum und Datenschutz. In A2 bleibt es bei den sechs Zeilen oben.

### Prüfen

1. `grep -rniE "every cover|every edition|all the covers|in one place" app components README.md` findet außerhalb von Kommentaren nichts mehr.
2. Im sichtbaren Browser-Panel: Startseite (Hero und Wortmarke), eine Suche (Header sichtbar, Hero weg), eine Detailseite (Header über dem Zähler, beide müssen zusammenpassen).
3. Screenshot der Startseite für Julian.
4. `npm run build`, damit die Metadaten mitgehen.

### Aufwand

Eine Stunde, davon der größte Teil das Nachlesen im Browser. Keine Logik, keine Tests betroffen.

---

## A3 — Drei Entscheidungen aus §8.7

Alle drei brauchen Julian, keine kann ich allein treffen. Zusammen etwa 30 Minuten, plus Wartezeit bei der Bookshop-Bewerbung.

### A3.1 Google-Kontingent ablesen

**Warum jetzt:** §8.7 Punkt 1 steht ohne Zahl da, und die Zahl entscheidet, ob die Seite 90 oder 500 kalte Detailseiten am Tag verträgt. Ohne sie lässt sich Punkt B nicht seriös planen.

**Was Julian tut** (5 Minuten):
1. [console.cloud.google.com](https://console.cloud.google.com) öffnen, das Projekt wählen, in dem der `GOOGLE_BOOKS_API_KEY` liegt.
2. *APIs & Services* → *Enabled APIs & services* → *Books API* → Reiter *Quotas & System Limits*.
3. Den Wert für „Queries per day" ablesen, dazu den aktuellen Verbrauch der letzten Tage im Reiter *Metrics*.

**Was ich danach tue:** die Zahl in §8.7 eintragen und ausrechnen, wie viele kalte Seitenaufrufe pro Tag daraus folgen (heute 2 Anfragen pro Detailseite, 1 pro Suche). Liegt sie bei 1.000, gehört ein Tageszähler mit sauberem Abschalten in Punkt B (§8.7 Punkt 5); liegt sie bei 10.000, reicht das Rate-Limit.

### A3.2 Verfügbarkeits-Button

**Warum jetzt:** Der Button fragt bei jedem Klick Pfade ab, die vier von sechs Händlern in ihrer robots.txt verbieten (§8.7). Auf `localhost` schadet das niemandem, mit dem Deployment in Punkt B schon. Die Entscheidung muss also vor B fallen, nicht vor A.

**Die Optionen, mit Aufwand:**

| Option | Was passiert | Aufwand |
|---|---|---|
| a) Entfernen | Button und Route raus, `scripts/check-buylinks.ts` bleibt für die Prüfung vor dem Start | 20 Minuten |
| b) Beschränken | Nur Händler fragen, die es erlauben. Heute bleibt allein Hugendubel übrig, dessen Antwort nichts aussagt — der Button wäre faktisch leer | 30 Minuten, Ergebnis wertlos |
| c) Behalten | Risiko bewusst tragen, dazu Rate-Limit auf die Route und ein ehrlicher User-Agent mit Kontaktadresse statt des Browser-Strings | 30 Minuten |

**Meine Empfehlung: (a).** Der Nutzen ist auf zwei von sechs Händlern begrenzt, das Risiko trifft die Partnerbeziehungen, die in Punkt C Geld bringen sollen. Das Prüfskript deckt denselben Bedarf ab, nur zum richtigen Zeitpunkt: einmal vor dem Start, von Hand.

Julian hat am 2026-09-07 entschieden, den Button vorerst zu behalten. Diese Zeilen sind die Entscheidungsgrundlage für den zweiten Blick vor dem Deployment, nicht ein erneuter Widerspruch.

### A3.3 Bookshop.org-Partner-ID beantragen

**Warum jetzt und nicht in Punkt C:** Die Bewerbung dauert Tage. Wenn sie in A losgeht, liegt die ID vor, wenn Punkt B fertig ist. Und sie repariert nebenbei einen kaputten Link: Ohne ID zeigt Bookshop auf `/search`, was die robots.txt sperrt und was nichts einbringt; mit ID auf `/a/<id>/<isbn>`, eine Produktseite.

**Was Julian tut:** Bei [bookshop.org](https://bookshop.org) das Partnerprogramm beantragen, für US und, falls getrennt geführt, für UK. Die Bewerbung verlangt eine erreichbare Seite mit Inhalt — das spricht dafür, sie direkt nach Punkt B abzuschicken, oder mit der Vercel-Preview-URL zu versuchen.

**Was ich danach tue:** `AFFILIATE_BOOKSHOP_ID_US` und `_UK` in `.env.local` und später in Vercel eintragen. Mehr ist nicht nötig, die Tabelle in `lib/buylinks.ts` schaltet den Linktyp automatisch von `search` auf `product` um; ein Test deckt das bereits ab.

**Amazon bewusst noch nicht.** Drei qualifizierte Verkäufe in 180 Tagen, sonst wird das Konto geschlossen (§8.3). Erst mit Traffic, also nach Punkt D.

---

## Reihenfolge und Abschluss

1. A1 (Merge) zuerst, weil A2 sonst auf einem Branch landet, der gleich gemergt wird.
2. A2 danach, ein Commit `Step 15: say what the site actually shows`.
3. A3.1 und A3.3 können parallel laufen, sie warten auf Julian.
4. A3.2 wird vor dem Deployment in Punkt B entschieden, nicht in A.

Am Ende von A: `main` trägt den ganzen Umbau, die Seite verspricht nichts Falsches mehr, und die Zahl aus A3.1 steht in der SPEC. Punkt B kann beginnen.
