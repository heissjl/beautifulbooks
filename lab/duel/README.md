# lab/duel — zwei Menschen, ein Link, dieselben Cover

Roadmap 5.8, Spielart 2. Julian, 2026-09-08: „Vergleich mit einem Freund (beide klicken auf den gleichen generierten Link, bekommen die gleiche Auswahl und am Ende einen Vergleich)."

```bash
npx tsx lab/duel/serve.ts
# beide öffnen http://localhost:4322/?seed=paperwhite&me=<name>
```

## Die Frage

Nicht „lässt sich das bauen" — das ist offensichtlich. Die Frage ist, **ob genug Uneinigkeit entsteht, damit es ein Spiel ist.** Wählen zwei Menschen bei zehn Büchern achtmal dasselbe Cover, gibt es nichts zu vergleichen; treffen sie sich nie, ist es Rauschen. Interessant ist der Abstand zum Zufall, nicht die Quote selbst.

## Das Maß

Bei zehn Büchern mit je sechs Covern liegt der **Zufall bei 17 %** (einer von sechs). Die App rechnet das jedes Mal mit und zeigt es neben dem Ergebnis, damit „30 %" nicht nach viel aussieht, wenn es wenig ist.

- **Unter 25 %** — die Cover sagen den Leuten nichts, die Spielart ist tot.
- **25 bis 50 %** — der interessante Bereich: erkennbarer Geschmack, genug Streit.
- **Über 70 %** — es gibt eine offensichtlich „beste" Wahl je Buch, dann ist der Vergleich langweilig und die Spielart wäre eher eine Abstimmung.

Zweites Maß, ohne das keine Zahl zählt: **beenden beide die zehn Bücher?** Ein Vergleich, den nur einer erreicht, ist kein Spiel.

## Wie es funktioniert

- **Der Startwert im Link bestimmt alles**: welche Bücher, in welcher Reihenfolge, welche sechs Cover je Buch (`seed.ts`, rein und getestet). Zwei Menschen sehen dasselbe, **ohne dass etwas gespeichert werden muss** — das ist der Punkt, der die Spielart billig macht.
- Der Generator ist festgenagelt: ein Test prüft drei feste Zahlen, damit eine Änderung daran als roter Test auffällt und nicht als zwei Freunde, die verschiedene Runden sehen.
- **Der Vorrat kommt aus `data/cover-index.json`** — 100 Werke, 10.362 Cover, offline. Für eine Runde verlässt keine Anfrage den Rechner, nur die Bilder kommen vom CDN.
- Bücher mit weniger als sechs Covern fallen raus statt aufgefüllt zu werden: eine Frage mit zwei Antworten ist ein anderes Spiel als eine mit sechs, und gemischt wäre die Quote bedeutungslos.

## Was das Experiment offenlässt

**Die Antworten liegen in `rounds.json`**, und genau das ist die Stelle, an der aus dem Prototyp Infrastruktur würde: die Website hat keinen Speicher (E6, E18). Ob das Spiel einen verdient, entscheidet die Messung oben — nicht der Prototyp. Solange die Zahl unbekannt ist, gehört das hier ins `lab/` und nirgendwo sonst.

Ebenfalls offen: ob der Startwert im Link etwas über die Spieler verrät (er verrät nichts, er ist ein Wort), und ob eine Runde ohne Namen auskommt.

## Stand

Gebaut am 2026-09-09, spielbar. **Noch nicht mit zwei echten Menschen gemessen** — die simulierte Probe war nur eine Kontrolle der Rechnung: zwei erfundene Spieler, von denen einer in einem Drittel der Fälle zustimmt, ergaben 30 % gegen 17 % Zufall, also genau das, was die Simulation vorgab. Die Zahl, auf die es ankommt, kann nur Julian mit jemandem erspielen.
