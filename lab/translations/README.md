# translations — wie oft zeigt die Suche eine Übersetzung als eigene Karte?

**Frage (ROADMAP 6.15 Schritt 3):** Open Library führt manche Übersetzungen als eigenes Werk („The clown“ neben „Ansichten eines Clowns“). SPEC §2.1 sagt, Sprache gehöre nicht zur Identität eines Werks. Wie oft widerspricht die Suche dem, und ist die Antwort eine dritte Identitätsregel oder ein ehrlich umgeschriebener §2.1?

**Maß:** 18 feste Suchen (`QUERIES` in `sample.ts`: Kafka, Hesse, Camus, Tolstoi, Dostojewski, García Márquez, Eco, Bulgakow, Flaubert, Saint-Exupéry, Böll — Originale in fünf Sprachen, die Suche mal im Original, mal englisch). `sample.ts` fragt `/api/search` einmal je Suche, 7 s Pause, bricht beim ersten Nicht-200 ab und legt die Antwort unter `out/` ab. `labels.json` ist das Urteil eines Menschen über jede Karte je Suche: `same` (das gesuchte Buch selbst, in beliebiger Sprache), `about` (Sekundärliteratur, Lektürehilfe), `other` (ein anderes Buch, Sammlung, Bearbeitung). `--report` zählt: Karten desselben Buchs, überzählige Karten (alle außer der mit den meisten Ausgaben), und ob die überzähligen in einer anderen Sprache als dem Original erscheinen (Übersetzung), in derselben (Dublette) oder ohne Sprachangabe.

**Status:** Messung gelaufen 2026-10-22 gegen die Live-Suche (umgang §1, Ausweg während einer Sperre: `openlibrary.org` wies den Mac an dem Tag ab); Zahlen in docs/history.md. **Nicht gemessen:** ob LCC-Cutter oder `id_librarything` Original und Übersetzung zuverlässig verbinden — dafür braucht es Open Librarys Werk-Datensätze (Schritt 3b in der Roadmap).

```
npx tsx lab/translations/sample.ts [--base https://buyitscovers.com] [--pause 7000]
npx tsx lab/translations/sample.ts --report
```
