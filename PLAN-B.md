# Plan für Punkt B und die Arbeit, die keine Entscheidung braucht

Detailplan zu SPEC.md §10, geschrieben 2026-09-07, während A3 auf Julian wartet. Jeder Abschnitt wird einzeln geplant, umgesetzt und committet; die Reihenfolge folgt dem Risiko, nicht dem Aufwand.

| | Was | Warum jetzt |
|---|---|---|
| B0 | Sprachwahl schlägt auf die Detailseite durch | Gemeldeter Fehler, klein, betrifft das Kernversprechen |
| B1 | Rate-Limit auf den vier API-Routen | Muss vor dem Deployment stehen (§8.7) |
| B2 | SEO-Grundlage: ISR, Titel, Schema.org, OG-Bild | Größter Hebel aus §10 D |
| B3 | Detailseite mobil | §10 E13, erster Punkt |
| B4 | Klick-Tracking `/go/…` plus Plan für eine Analyse-Seite | §10 C9 |
| B5 | About-Seite | §10 B4, der Teil, der ohne Julian geht |

---

## B0 — die gewählte Sprache schlägt auf die Anzeige durch

### Befund (gemessen 2026-09-07)

Suche `1984` mit Filter *German*, dann *Nineteen Eighty-Four* geöffnet. Die URL trägt die Sprache mit, die Anzeige ignoriert sie:

```
/book/OL1168083W?q=1984&lang=de
Tabs: English 18 (aktiv) · Spanish 6 · Portuguese 3 · Catalan 1 · … · Unknown 36
```

Kein deutscher Tab, obwohl deutsch gefiltert wurde, und das ausgewählte Cover ist englisch. Drei Ursachen, alle in derselben Kette:

1. **`orderGroups` in `lib/pages.ts` verwirft genau die beiden häufigsten Wünsche.** `wanted` wird nur gesetzt, wenn die gewünschte Sprache *nicht* in `LEAD_LANGUAGES` steht. Englisch und Deutsch sind aber die beiden Einträge dieser Liste — und die beiden Sprachen, die im Suchfilter am ehesten gewählt werden. Wer Deutsch wählt, bekommt Englisch zuerst. Ein Test hält das heute sogar fest („Searching a lead language does not duplicate its position"). Die Absicht war richtig (die Position nicht doppelt vergeben), die Folge falsch.
2. **`leadLanguagesSettled` wartet auf Englisch, nicht auf die gewünschte Sprache.** Die Ladeszene endet, sobald eine englische Gruppe da ist. Deutsch liegt bei Open Library oft erst auf Seite 2 oder 3, weil die Ausgaben nach Datensatzalter kommen. Der Leser sieht also erst eine englische Wand, und der deutsche Tab schiebt sich später dazwischen — genau das Umsortieren, das Julian am 2026-09-07 abgestellt haben wollte.
3. **Das ausgewählte Cover ist `groups[0].covers[0]`** (`selectCoverFrom`). Es folgt der Tab-Reihenfolge und ist damit von 1 automatisch mitbehoben.

### Änderungen

| Datei | Änderung |
|---|---|
| `lib/pages.ts` | `orderGroups`: die gewünschte Sprache führt **immer**, danach die restlichen Lead-Sprachen. Aus `lead = [wanted?, 'en', 'de']` wird `lead = [preferred, ...LEAD_LANGUAGES ohne preferred]`. |
| `lib/pages.ts` | `leadLanguagesSettled(groups, done, preferred?)`: wartet auf die gewünschte Sprache, sonst wie bisher auf Englisch. |
| `app/book/[id]/page.tsx` | `preferred` an `leadLanguagesSettled` durchreichen. |
| `lib/__tests__/pages.test.ts` | Der Fall `orderGroups(groups, 'de')` kehrt sich um: erwartet `['de','en','fr',undefined]`. Neue Fälle für `'en'` (bleibt vorn, Deutsch zweiter) und für `leadLanguagesSettled` mit `preferred`. |

Die Obergrenze der Wartezeit bleibt unverändert (`done || checked >= 300`, also höchstens drei Seiten): eine Sprache, die es in dem Werk gar nicht gibt, darf die Szene nicht anhalten.

### Bewusst nicht Teil von B0

Das **Mosaik auf den Suchkarten** richtet sich nicht nach der Sprache: die Kachel zeigt das Buch, nicht die Ausgabe, und die Kurzantwort kennt die Sprache nicht. Ich messe nach der Umsetzung, wie oft ein deutscher Filter englische Kacheln zeigt, und entscheide danach — die Änderung wäre eine Sortierung in `route.ts` plus ein Cache-Key pro Sprache, also billig, aber sie kostet einen zusätzlichen Eintrag im geteilten Cache.

### Prüfen

1. `npm run test:run` — die vier Fälle in `pages.test.ts`.
2. Im Browser: `/?q=1984&lang=de` → Detailseite. Erwartet: deutscher Tab führt, ein deutsches Cover ist ausgewählt, die Szene endet nicht vor dem deutschen Tab.
3. Gegenprobe ohne Filter: `/?q=1984` → Englisch führt wie bisher.
4. Gegenprobe mit einer Sprache, die das Werk nicht hat (`lang=ja` auf einem rein englischen Werk): die Szene endet trotzdem nach spätestens drei Seiten.
