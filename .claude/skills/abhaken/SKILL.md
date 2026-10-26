---
name: abhaken
description: Einen Roadmap-Punkt abhaken — alle fünf Schritte (Roadmap kürzen, Archiv, features, Historie, Spec), mit Prüfung und Cockpit. Nur bewusst auslösen: /abhaken <Nr>.
disable-model-invocation: true
---

# /abhaken <Nr>

Der Punkt `$ARGUMENTS` ist gebaut, geprüft und soll als erledigt eingetragen werden. Das Abhaken hat fünf Schritte (CLAUDE.md, „Read this first“), und drei Sitzungen haben Teile ausgelassen (1.9 behielt zwei offene Kästchen, 5.8a kam nie in die Roadmap, 6.16 Schritt 1 wurde übersehen) — darum dieser Befehl (ROADMAP 6.40). Alle fünf, in dieser Reihenfolge, nichts auslassen:

1. **ROADMAP.md.** Die Zeile `- [ ] **<Nr> …**` finden (`grep -n '^- \[ \] \*\*<Nr> ' ROADMAP.md`). Den vollen Text kopieren (für Schritt 2), dann die Zeile auf `- [x]` setzen und auf wenige Zeilen kürzen: Datum, was daraus wurde, Julians Entscheidung mit Zitat, wenn es eine gab, und am Ende `→ [Historie](docs/history.md#<anker>) · [Archiv](docs/roadmap-archive.md#<nr-ohne-punkt>)`. Steht der Punkt in der Tabelle „Bewertung der offenen Punkte“ (`grep -n '^| <Nr> |' ROADMAP.md`), die Zeile auf `erledigt | — | <Datum>: …` setzen. Nennt eine Zeile unter „Nächste Schritte“ nur noch diesen Punkt, raus damit.
2. **docs/roadmap-archive.md.** Am Ende der Datei `## <Nr>` (ohne Punkt in der Überschrift, z. B. `## 6.72`) und darunter den **vollen alten Text** aus Schritt 1 unverändert, Links von `docs/…` auf `…` relativ gesetzt; darunter `**Erledigt <Datum>.** → [Historie](history.md#<anker>)`.
3. **docs/features.md.** Eine Zeile in der passenden Tabelle: `| Was die Seite jetzt kann (ein Satz, Zahlen, Grenzen) | <Datum> | <Spec-Abschnitt oder —> | <Nr> | \`datei\`, \`datei\` |`. Hat der Punkt kein Feature hervorgebracht (Werkzeug, Doku), eine Zeile in der Tabelle „Werkzeuge“ oder keine — dann im Commit sagen, warum.
4. **docs/history.md.** Am Ende ein Abschnitt `## <Datum> — <Titel> (ROADMAP <Nr>)` mit dem, was gebaut und **gemessen** wurde: Zahlen, Dateien, Julians Worte im Zitat, was nicht geprüft werden konnte und warum (N12). Der Anker für die Links: Datum und Titel kleingeschrieben, Leerzeichen zu `-`, Satzzeichen weg, `(ROADMAP 6.72)` wird `roadmap-672`.
5. **SPEC.md**, wenn sich das Verhalten der Seite geändert hat: den Satz anpassen, mit Datum und Nummer. Sonst nichts.

Dann die Prüfung: `grep -n '^- \[ \] \*\*<Nr>' ROADMAP.md` darf nichts mehr finden, und im gekürzten Block darf kein `- [ ]` mehr stehen (ein Sammelpunkt mit offenen Teilen bleibt `- [ ]` und bekommt nur die Teile markiert). `npm run cockpit -- --build --offline` — der Hook aus 6.39 tut das bei jedem Edit an ROADMAP.md schon; ist er aus, von Hand.

Zum Schluss ein Commit mit Betreff `<Nr>: …`, der die Analyse-Liste aus CLAUDE.md beantwortet (umgang.md §11). Kein Push: der ist Julians Wort.
