# first-years — ein geprüftes Erstausgabejahr für die kuratierten Werke

**Frage:** Bei welchen der kuratierten Werke weicht Open Librarys `first_publish_year` von Wikidatas Erscheinungsdatum ab, und welches Jahr soll die Seite zeigen? (ROADMAP 6.16 Schritt 2; der Anlass: Gatsby 1920, Lolita 1777.)

**Maß:** je Werk Open Librarys Jahr (wie beim Kuratieren festgehalten) neben dem frühesten P577-Datum des Wikidata-Eintrags, der über P648 (Open-Library-ID) am Werk hängt; eine Zeile `differs`, wenn beide ein Jahr haben und sie auseinanderliegen oder Wikidata keins hat.

**Status:** gelaufen 2026-10-18 über die 155 kuratierten Werke → [proposal.json](proposal.json); Zahlen in docs/history.md. Die Zeilen, bei denen beide Quellen einig sind, stehen in `data/first-years.json` (zwei Quellen, ein Jahr); die Abweichungen liest Julian und trägt ein, was er bestätigt. Die Seite nimmt das Jahr aus der Datei vor dem aus dem Katalog (`lib/firstyears.ts`) und sagt dann „First published in {year}.“ statt „Open Library dates the book to …“.

```
npx tsx lab/first-years/propose.ts
```

Einmalig, kein Laufzeit-Aufrufer, vier Anfragen an `query.wikidata.org` mit 2 s Pause (E10 unberührt). Wer eine Zeile in `data/first-years.json` ändert, nennt die Quelle in `source`.
