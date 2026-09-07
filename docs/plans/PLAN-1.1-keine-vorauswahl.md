# Plan für Roadmap 1.1: beim Öffnen eines Buchs kein Cover automatisch auswählen

Geschrieben 2026-09-07 für eine Sitzung, die den Code nicht kennt. Vorher lesen: [CLAUDE.md](../../CLAUDE.md), [SPEC.md](../../SPEC.md) §3 F2.6–F2.9 und §4 N9, sowie der Roadmap-Punkt [1.1](../../ROADMAP.md). Code und Kommentare Englisch (E7), dieser Plan Deutsch.

## 1. Ziel und Nicht-Ziel

**Ziel.** Wer ein Buch öffnet, landet auf einer Wand aus Covern und nicht auf einer Ausgabe, die niemand gewählt hat. Die zweite Spalte auf breiten Bildschirmen bleibt dabei nicht leer, und das Layout springt beim ersten Klick nicht.

**Messlatte.** Zwei Zahlen, beide nachprüfbar:

1. Eine kalt geöffnete Detailseite löst **null** Anfragen an `/api/isbn/…` aus, solange niemand ein Cover anklickt. Heute ist es mindestens eine, gemessen bis zu fünf (SPEC N9). Damit fällt eine kalte Detailseite von 2 auf **1** Google-Anfrage, ohne dass ein einziges Cover verschwindet.
2. Auf dem Telefon erscheint die Peek-Leiste erst nach einem Tippen. Heute steht sie sofort da und verdeckt eine Kachelreihe.

**Nicht-Ziel.** Keine Änderung an der Ladeszene, an der Faltung, an den Sprachreitern oder an der Telefon-Schublade selbst. Keine Kauf-Links-Umsortierung — das ist [1.2](../../ROADMAP.md) und kommt danach. Kein neues Datenfeld aus einer Quelle.

## 2. Befund im Code

Alles hängt an einer Zeile. `selectCoverFrom` in `components/BookDetail.tsx`:

```ts
function selectCoverFrom(wall, selectedId) {
  const byId = wall.coversById.get(selectedId ?? '');
  if (byId) return byId;
  const folded = wall.covers.find(c => c.similarIds?.includes(selectedId ?? ''));
  return folded ?? wall.groups[0]?.covers[0] ?? null;   // <- der Rückfall
}
```

Der Rückfall auf `groups[0].covers[0]` liefert das erste Cover der führenden Sprachgruppe, sortiert nach Jahr absteigend — also den **jüngsten Datensatz**, den Open Library kennt. Bei *The Great Gatsby* ist das eine Print-on-Demand-Ausgabe von „100 MustReads" 2026, und die Kauf-Links zeigen auf deren ISBN.

Von dieser einen Funktion hängen drei Dinge ab:

| Ort | Was daran hängt |
|---|---|
| `selected` (Zeile ~258) | die Seitenleiste auf breit, die Schublade auf schmal, der Auswahlring in der Wand |
| `lookupIsbns` (Zeile ~205) | **die Google-Anfrage**: die ISBNs des gewählten Covers gehen an `useIsbnCovers` |
| `CoverSheet` (Zeile ~358) | wird nur gerendert, wenn `selected` gesetzt ist — die Peek-Leiste |

Fällt der Rückfall weg, sind `selected` und `lookupIsbns` bis zum ersten Klick leer, die Google-Anfrage unterbleibt und die Peek-Leiste erscheint nicht. **Die zweite Spalte auf breiten Bildschirmen wäre dann leer**, und genau das ist zu gestalten.

## 3. Die Entscheidung: welche der drei Varianten

Die Roadmap hält drei Kandidaten fest, unentschieden. Beim Ansehen des Codes ist die Lage klarer geworden.

### Verworfen: die Wand läuft bis zur ersten Auswahl über die volle Breite (Kandidat 1)

Das Argument dafür ist gut — die Wand ist der Zweck der Seite und verdient die Breite. Der Preis ist zu hoch: das Raster hat bei *Gatsby* 293 Kacheln, und ein Wechsel von drei auf zwei Spalten sortiert **jede** davon um. Der Leser klickt eine Kachel an und sie springt unter dem Finger weg. Ein Umbruch von 300 Kacheln lässt sich auch nicht sinnvoll animieren.

### Verworfen als Standard: der Algorithmus für ein farbenfrohes Cover (Kandidat 3, Julian)

Zwei Befunde aus dem Code, die den Vorschlag anders aussehen lassen als beim Aufschreiben:

**Erstens gibt es das Farbmaß nicht.** `decodeToGray` in `lib/imagehash.ts` rechnet jedes Bild in der ersten Schleife auf Graustufen um; `signature()` liefert danach nur `hash`, `contrast` und `mean`, alle drei ohne Farbe. „Farbenfroh" ist aus dem, was gespeichert wird, **nicht ableitbar**. Nachrüstbar wäre es billig — ein zweiter Akkumulator für die Sättigung in derselben Schleife, und da die Signaturen ohnehin bei jeder Anfrage aus den 30 Tage lang gecachten Bytes neu berechnet werden, kostet es keine zusätzliche Ladung. Es ist trotzdem neuer Code und eine neue Zahl, die begründet sein will.

**Zweitens fällt der zweite Teil des Vorschlags von selbst weg.** Die Idee, das Google-Cover erst beim Scrollen der Seitenleiste zu laden, spart die Anfrage bei Lesern, die nicht bis zu den Kauf-Links kommen. Ohne automatische Auswahl wird **gar nichts** nachgeschlagen, bis jemand klickt — dieselbe Ersparnis, nur vollständig und ohne einen neuen Auslöser, der nach 1.2 ohnehin wackelig wäre: sind die Kauf-Links erst einmal ohne Scrollen sichtbar, löst „gescrollt" nicht mehr aus.

Bleibt das eigentliche Argument des Vorschlags: die Seitenleiste ist nie leer, und das Layout springt nicht. Das leistet Kandidat 2 auch, ohne dem Leser eine Wahl abzunehmen.

**Julians Idee behält trotzdem ihren Wert, nur woanders.** Für [1.9](../../ROADMAP.md), das Design-Element oben rechts auf der Startseite, braucht es genau das: ein Cover, das ins Auge fällt. Dort wählt der Algorithmus kein Buch für den Leser aus, sondern illustriert eines. Das Sättigungsmaß gehört dorthin, nicht hierher — als Notiz in 1.9 aufgenommen.

### Gewählt: die Spalte trägt bis zur Auswahl eine Werk-Ansicht (Kandidat 2)

Der Kandidat wird dabei größer, als die Roadmap ihn beschrieben hat („eine kurze Erklärung"), und das ist der Punkt: **die zweite Spalte hat zwei mögliche Aufgaben, und sie erfüllt heute nur eine.** Sie zeigt *eine Ausgabe*. Was sie nie zeigt, ist *das Buch* — es gibt auf der ganzen Seite keinen Ort, an dem steht, worum es in dem Buch geht. Die Trennung ist sauber und für den Leser sofort verständlich:

- **noch nichts gewählt** → die Spalte zeigt das Werk,
- **ein Cover gewählt** → die Spalte zeigt diese Ausgabe.

Damit ist die Spalte nie leer, das Layout springt nie, die Google-Anfrage unterbleibt bis zum Klick, und die Seite gewinnt eine Information, die ihr heute fehlt.

## 4. Entwurf

### 4.1 `lib/pages.ts`: die Auswahl wird rein und testbar

`selectCoverFrom` zieht aus `BookDetail.tsx` hierher um, ohne den Rückfall:

```ts
/**
 * The cover the URL points at, or null when the reader has not chosen one
 * (SPEC §3 F2.6). Falling back to the first cover of the first group used to
 * put an arbitrary edition — the newest record Open Library holds — in front
 * of a reader who had chosen nothing, and spent a Google request on it.
 */
export function coverForId(
  wall: { coversById: ReadonlyMap<string, Cover>; covers: readonly Cover[] },
  selectedId: string | null,
): Cover | null;
```

Verhalten: ohne `selectedId` null; bei Treffer das Cover; sonst das Cover, in das die ID hineingefaltet wurde (`similarIds`, damit geteilte Links weiter funktionieren, wenn ein Duplikat inzwischen gefaltet ist); sonst null.

`lib/pages.ts` ist der richtige Ort: rein, client-seitig, und hält bereits die Wand-Logik. **Nicht** nach `lib/works.ts`, das serverseitige Nachbarn hat.

### 4.2 `components/BookDetail.tsx`: zwei Stellen

1. `selectCoverFrom` löschen, beide Aufrufe (`lookupIsbns`, `selected`) auf `coverForId` umstellen. `lookupIsbns` gibt dann ohne Auswahl eine leere Liste zurück, `useIsbnCovers` fragt nichts — hier fällt die Google-Anfrage weg, mehr ist dafür nicht zu tun.
2. Die Seitenleiste bekommt einen Zweig:

```tsx
{isDesktop && (
  <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
    {details ?? <WorkPanel work={work} editions={merged.editions} language={lang || undefined} />}
  </aside>
)}
```

3. Kleinigkeit, die sonst auffällt: `pb-20` an der Wand schafft Platz für die Peek-Leiste. Ohne Auswahl gibt es keine Leiste, also auch keinen Platzbedarf — `pb-20` nur setzen, wenn `selected` da ist, sonst steht auf dem Telefon eine leere Fläche unter der letzten Kachelreihe.

### 4.3 `components/WorkPanel.tsx` (neu, Client)

**Was überhaupt zur Verfügung steht.** Gemessen am 2026-09-07 über alle geladenen Seiten von vier Werken, damit der Inhalt nicht erfunden wird:

| Werk | Ausgaben | mit Klappentext | Verlage | Jahre | mit Vorschau |
|---|---|---|---|---|---|
| Wolf Hall | 26 | 3 (2 en, 1 ohne Sprache), längster 927 Zeichen | 18 | 2009–2020 | 4 |
| Beloved | 51 | 5 (4 en, 1 de), längster 2.307 Zeichen | 37 | 1987–2025 | 7 |
| Mason & Dixon | 11 | 2 (1 en, 1 de), längster 920 Zeichen | 10 | 1997–2015 | 3 |
| Mumbo Jumbo | 10 | 2 | 8 | 1972–2017 | – |

Daraus folgt der Zuschnitt: **jedes** der vier Werke hat mindestens einen Klappentext, aber nur 10 bis 18 Prozent der Ausgaben tragen einen, und regelmäßig ist einer davon in einer anderen Sprache. Verlagszahl und Jahresspanne sind dagegen **immer** da. Seitenzahl und Format sind zu dünn (14 von 26, 40 von 51) und taugen nicht für eine Aussage über das Werk.

**Der Inhalt, in dieser Reihenfolge:**

1. **Ein Kicker** „This book", damit klar ist, dass die Spalte gerade nicht von einer Ausgabe spricht.
2. **Eine Zeile mit zwei Zahlen, die es sonst nirgends gibt:** „Editions here run from 1987 to 2025, from 37 publishers." Die Meta-Zeile oben nennt Cover und geprüfte Datensätze, nicht die Zeitachse und nicht die Streuung über Verlage — und genau das ist das Thema der Seite. Das „here" ist wörtlich zu nehmen und nötig: beide Zahlen beziehen sich auf die **geladenen** Ausgaben und wachsen, solange Seiten nachkommen. Deshalb erscheint die Zeile erst, wenn mindestens zwei Seiten geladen sind oder das Werk fertig ist; sonst behauptet sie bei *Wolf Hall* zuerst „2009 bis 2020" und korrigiert sich hinterher.
3. **Der Klappentext**, sprachbewusst gewählt (4.4), auf vier Zeilen beschnitten, mit Quelle: „Description from the Fourth Estate 2010 edition, via Google Books." Die Ausgabe zu nennen ist kein Schmuck — Klappentexte sind Verlagswerbung für **eine** Ausgabe, und wer das weiß, liest sie richtig. Ohne Klappentext entfällt der Block ersatzlos.
4. **Die Einladung**, leise und zum Schluss: „Pick a cover to see the edition it belongs to, its ISBN and where to find a copy." Sie steht nicht oben, weil ein Leser vor einer Wand aus Covern nicht erklärt bekommen muss, dass man Cover anklicken kann; sie beantwortet nur, was danach passiert.
5. **Ein kleiner Herkunftslink** „This work at Open Library". Das ist die Stelle, an der jemand die Daten nachsehen und **korrigieren** kann — Open Library ist ein Wiki, und die falsche Jahreszahl bei *Gatsby* (1920 statt 1925, SPEC N12) ist dort mit zwei Klicks zu reparieren. Der Link steht heute nur im JSON-LD als `sameAs` und ist für Leser unsichtbar.

**Nicht** hinein: Titel und Autor (stehen im `TitleBlock` darüber), Cover- und Ausgabenzahl (Meta-Zeile), die Sprachen (Reiter), Seitenzahl und Format (zu dünn). Doppelungen machen aus der Spalte Beiwerk.

**Der natürliche nächste Bewohner** ist [6.9](../../ROADMAP.md), „Mehr von diesem Autor": das ist eine Aussage über das Werk, nicht über eine Ausgabe, und hätte hier zum ersten Mal einen Platz. Nicht Teil dieses Punktes, aber der Grund, das Panel als Werk-Ansicht anzulegen und nicht als Erklärtext.

### 4.4 `lib/works.ts`: den Klappentext auswählen

Der Klappentext ist nicht einfach „der längste". Gemessen am 2026-09-07 an *Wolf Hall*, Seite 0: von 26 Ausgaben tragen **3** eine Beschreibung, und die längste (927 Zeichen) gehört zu Editorial Presença — sie ist **portugiesisch**. Ein englisches Buch bekäme also einen portugiesischen Klappentext.

```ts
/** The blurb of an edition in the wanted language, else any; longest wins. */
export function blurbFor(
  editions: readonly Edition[],
  language: string | undefined,
): { text: string; edition: Edition } | null;
```

Regel: zuerst nur Ausgaben in der gewünschten Sprache betrachten (fehlt sie, die häufigste Sprache des Werks); ist darunter keine mit Beschreibung, auf alle ausweichen — dann aber die Sprache im Panel nennen, damit niemand rätselt, warum der Text portugiesisch ist. Innerhalb der Auswahl gewinnt die längste Beschreibung.

## 5. Reihenfolge der Arbeit

1. `coverForId` nach `lib/pages.ts`, Unit-Tests (6.1), `BookDetail` umstellen. **Hier schon prüfen**, dass eine kalt geladene Seite keine `/api/isbn`-Anfrage stellt — das ist die halbe Messlatte und funktioniert bereits ohne das Panel.
2. `blurbFor` in `lib/works.ts` mit Tests (6.2).
3. `WorkPanel` bauen und einhängen.
4. `pb-20` an die Auswahl binden.
5. Browser-Prüfung (7), Doku (8), ein Commit.

Zwischendurch `npx tsc --noEmit`, `npm run lint`, `npm run test:run`.

## 6. Tests

### 6.1 `lib/__tests__/pages.test.ts`

- ohne `selectedId` → `null` (**der Kern des Punktes**: der Kommentar am Test nennt den Grund, damit der Rückfall nicht versehentlich zurückkommt),
- bekannte ID → das Cover,
- ID eines gefalteten Duplikats → das Cover, in das es hineingefaltet wurde (geteilte Links),
- unbekannte ID → `null`, **nicht** das erste Cover.

### 6.2 `lib/__tests__/works.test.ts`

- bevorzugt die gewünschte Sprache, auch wenn eine andere eine längere Beschreibung hat (der *Wolf Hall*-Fall),
- weicht auf jede Sprache aus, wenn in der gewünschten keine Beschreibung steht,
- `null`, wenn keine Ausgabe eine Beschreibung hat,
- nimmt unter gleichsprachigen die längste.

### 6.3 Was nicht getestet wird

Für React-Komponenten gibt es in diesem Repo keine Testumgebung, und dieser Punkt ist kein Anlass, eine einzuführen. Deshalb wandert die Logik in reine Funktionen, und das Zusammenspiel wird im Browser geprüft (7).

## 7. Verifikation

**Das Zählwerkzeug ist das Server-Log, nicht das Netzwerk-Panel.** Der Dev-Server schreibt jede Route mit; `/api/isbn/…` taucht dort auf, sobald eine Nachschau läuft. Das ist zuverlässiger, als im Browser Anfragen zu zählen, und überlebt einen Neustart des Panels.

| Prüfung | Erwartung |
|---|---|
| `/book/OL464512W` kalt öffnen, nichts anklicken | **keine** Zeile `GET /api/isbn/…` im Server-Log; die Seitenleiste zeigt das Werk-Panel; kein Cover trägt den Auswahlring |
| Dann ein Cover anklicken | `?cover=` steht in der URL, die Seitenleiste zeigt die Ausgabe, das Verdikt läuft durch `pending` in seinen Endzustand, im Log erscheinen so viele `/api/isbn`-Zeilen, wie das Cover ISBNs trägt |
| Geteilter Link `/book/OL464512W?cover=<id>` | Auswahl sofort da, kein Werk-Panel, eine Nachschau |
| Geteilter Link mit der ID eines inzwischen gefalteten Covers | die Auswahl landet auf dem Repräsentanten, nicht auf null |
| Telefon 375 × 812 | beim Laden **keine** Peek-Leiste und kein toter Rand unter der letzten Kachelreihe; nach einem Tippen Leiste und Schublade wie bisher |
| *Wolf Hall* auf breit | der Klappentext ist englisch oder fehlt, nicht portugiesisch |
| Ein Werk ohne jede Beschreibung, etwa *Mumbo Jumbo* | das Panel steht ohne Klappentext-Block und wirkt nicht abgeschnitten |
| Die fünf Akzeptanz-Queries aus SPEC §3 F1 | unverändert |

Zum Schluss ein Screenshot der breiten Ansicht mit Werk-Panel und einer mit gewählter Ausgabe, beide nach `docs/tests/`.

**Hinweis für die Sitzung:** das Browser-Panel war am 2026-09-07 abends nicht mehr verbunden. Ohne es geht die Prüfung mit `--headless=new --screenshot` von Chrome plus `curl` gegen den Dev-Server; die Telefon-Prüfung braucht allerdings ein echtes Panel oder eine Emulation.

## 8. Was in die Doku gehört

- **SPEC F2.6** umschreiben: heute steht dort „Beim Öffnen ist das erste Cover der ersten Gruppe ausgewählt; das ist ein offener Punkt". Danach: beim Öffnen ist **nichts** ausgewählt, die zweite Spalte zeigt bis zur ersten Auswahl das Werk. Dazu ein Satz zum Klappentext und seiner Quelle.
- **SPEC F2.7** kürzen: der Absatz, dass die automatische Vorauswahl nicht in der URL steht und ein geteilter Link deshalb etwas anderes zeigen kann, wird gegenstandslos.
- **SPEC N9**: die Tabelle nennt „Auswahl eines Covers: 1 pro ISBN". Ergänzen, dass ein Besuch ohne Auswahl **null** kostet, und die Rechnung für 0.7 nachziehen.
- **ROADMAP 1.1** abhaken mit dem Ergebnis, **0.7** um die neue Zahl ergänzen, **1.9** um die Notiz zum Sättigungsmaß.
- **docs/history.md**: die gemessenen Anfragen vorher und nachher.

## 9. Fallstricke

- `react-hooks/set-state-in-effect` ist in diesem Repo ein Fehler, und ein Ref darf im Render nicht gelesen werden. Das Panel braucht beides nicht — es ist eine reine Anzeige.
- `CoverGallery` nimmt `selectedCover: Cover | null` bereits an; dort ist nichts zu ändern. Vorher prüfen, dass ohne Auswahl auch kein `aria-pressed="true"` gesetzt wird.
- Die Ladeszene endet über `tabsSettled` und `scene.done`, nicht über die Auswahl. Sie bleibt unberührt — nach dem Umbau noch einmal kalt ansehen, weil sie leicht zu übersehen ist.
- **Der Rückfall darf nicht durch die Hintertür zurückkommen.** Wer später „das Panel wirkt leer" löst, indem er dort doch ein Cover auswählt, holt sich die Google-Anfrage zurück. Der Test aus 6.1 und der Kommentar an `coverForId` sind die Bremse.
- Nach diesem Punkt kommt [1.2](../../ROADMAP.md): die Kauf-Links in der Seitenleiste auffindbar machen. Beide betreffen dieselbe Spalte, und die dort gewählte Lösung — gedeckeltes Cover, festgeklebte Leiste — muss auch neben dem Werk-Panel bestehen. Reihenfolge einhalten: erst 1.1, dann 1.2.

## 10. Aufwand

Eine Sitzung, etwa drei bis vier Stunden: eine für Schritt 1 samt Messung, eine für Panel und Klappentext, eine für Prüfung und Doku.
