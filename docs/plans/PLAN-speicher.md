# Ein pragmatisches Speichermodell für dieses Projekt

> **Stand 2026-09-08.** Die Entscheidung aus §6 ist als **E18** in der Spec (ROADMAP 0.9 erledigt). Offen und weiter gültig: §3 als Bauanleitung für den Index (ROADMAP 6.10, in Arbeit: `data/`, `scripts/build-cover-index.ts`), §4 für die Zähler (3.1), §5 als eigener Punkt **6.12**.

Geschrieben 2026-09-07 auf Julians Frage nach „einem pragmatischen Datenbank-Modell oder Server-side-File-Ansatz, das im Scope dieses Projektes gilt". Betrifft [ROADMAP](../../ROADMAP.md) 6.10 (ähnliche Cover), 6.9 (interne Verlinkung), 5.1 (Sitemap), 3.1 (Analyse-Seite) und die Entscheidung E6.

## 1. Die Frage, richtig gestellt

E6 behandelt „brauchen wir einen Speicher?" als **eine** Frage und stellt sie bis zu einem Auslöser zurück. Beim Durchgehen der offenen Punkte zerfällt sie in **zwei**, und sie haben fast nichts miteinander zu tun:

| | **A — der Index** | **B — die Zähler** |
|---|---|---|
| Inhalt | Cover-Signaturen, Werke, Autoren, Verlage | Klicks, Ereignisse, Kontingentverbrauch |
| Geschrieben | einmal, von einem Skript, vor dem Deploy | ständig, von jeder Anfrage |
| Gelesen | bei jeder Anfrage | selten, von einer Seite |
| Muss ein Deploy überleben? | nein — er *kommt* mit dem Deploy | **ja**, sonst ist er wertlos |
| Konsistenz | egal, er ist ohnehin eine Momentaufnahme | zählt, sonst stimmen die Zahlen nicht |
| Braucht Infrastruktur | **nein** | ja |

**Daraus folgt das ganze Modell:** A ist eine Datei im Repo und kein Speicher im Sinne von E6. B ist ein echter Speicher und bleibt zurückgestellt. Was heute blockiert wirkt — ähnliche Cover, „mehr von diesem Autor", die kuratierten 500 — hängt ausschließlich an A und kann sofort gebaut werden.

## 2. Was heute tatsächlich passiert

Damit der Entwurf auf dem Ist steht:

- **Bilder** liegen im Next-Datencache, 30 Tage (`IMAGE_REVALIDATE` in `lib/coverhash.ts`).
- **Signaturen** liegen in einer `Map` im Modul (`memo` in `coverhash.ts`). Die ist **pro Serverinstanz** und stirbt mit ihr. Eine kalte Instanz dekodiert also neu — billig, weil die Bytes gecacht sind, aber nicht umsonst, und das 4-Sekunden-Budget kappt, was nicht rechtzeitig fertig wird. Genau daher kommt die Beobachtung aus SPEC §7, dass die Cover-Zahl beim zweiten Besuch sinkt.
- `memo` hat **keine Obergrenze**. Bei den heutigen Zahlen ist das harmlos (25.000 Signaturen wären wenige Megabyte), bei einer lange laufenden Instanz mit viel Verkehr wäre es ein Leck. Beim Umbau mitnehmen.
- **Nichts** überlebt einen Deploy außer dem, was im Repo liegt.

## 3. Speicher A: der gebaute Index

### 3.1 Was hinein muss

Zwei Tabellen, mehr nicht:

```jsonc
{
  "builtAt": "2026-09-07",
  "works":  [["OL468431W", "The Great Gatsby", "F. Scott Fitzgerald", 1925], …],
  "covers": [[0, "ol:13550503", "3f1a...c8", 41, 212, 18, "AAgTBQ…"], …]
  //          ^Werk  ^Cover-ID   ^dHash hex  ^Kontrast ^Helligkeit ^Sättigung ^Farbhistogramm
}
```

Arrays statt Objekte, weil 25.000 Objekte mit Schlüsseln ein Mehrfaches wiegen. Das Werk steht als **Index** in `works`, nicht als wiederholte Zeichenkette.

Die drei letzten Felder sind neu und der eigentliche Grund, warum 6.10 heute nicht geht: der dHash ist ein Strukturhash auf Graustufen, „sieht aus wie" braucht Farbe. Sättigung und ein 16-Eimer-Histogramm über den Farbton entstehen im selben Durchlauf, in dem `decodeToGray` heute die Helligkeit rechnet.

### 3.2 Die Größenrechnung

| | |
|---|---|
| Ein Cover-Eintrag | ~70 Byte als JSON (Hash 16 Zeichen hex, Histogramm 24 Zeichen base64, Rest Zahlen) |
| 12 kuratierte Werke, ~600 Cover | **42 KB** |
| 500 Werke, ~25.000 Cover | **1,8 MB** JSON, gzip etwa die Hälfte |
| Dieselben Hashes als `BigUint64Array` | **200 KB** im Speicher |

Der letzte Wert ist der wichtige. Die Datei wird **einmal beim Modulstart** eingelesen und in typisierte Arrays entpackt: ein `BigUint64Array` für die Hashes, ein `Uint8Array` je Farbwert, ein `Uint16Array` für den Werkindex. Danach ist eine Ähnlichkeitssuche eine Schleife über 25.000 XOR-Operationen — **Mikrosekunden**, ohne Index, ohne Baum, ohne Datenbank. Als JS-Objekte belassen wären es dagegen fünf bis acht Megabyte Heap für nichts.

### 3.3 Wo die Datei liegt und wie sie geladen wird

`data/cover-index.json`, im Repo, per statischem `import` in ein Modul `lib/coverindex.ts`, das beim ersten Zugriff entpackt und die typisierten Arrays hält. Statischer Import, damit der Bundler die Datei sicher mitnimmt — `fs.readFileSync` auf einen relativen Pfad ist auf Vercel die klassische Fehlerquelle.

`lib/coverindex.ts` ist **serverseitig**. Der Client bekommt nie die Datei, sondern fragt `/api/similar/<coverId>` und erhält sechs Treffer. Die Größe der Datei ist damit eine Frage des Funktionsbündels, nicht des Browsers.

### 3.4 Wie sie gebaut wird

`scripts/build-cover-index.ts`, von Hand ausgeführt, Ergebnis committet — dasselbe Muster wie `scripts/record-fixtures.ts` und `lib/__fixtures__/`, es gibt also einen Präzedenzfall im Projekt.

Drei Eigenschaften, ohne die das Skript nicht taugt:

1. **Kein Google.** `getWorkPage(id, { googleBooks: false })`. Ein Indexlauf über 500 Werke würde sonst 500 der 1.000 Tagesanfragen verbrennen (E10).
2. **Höflich.** Open Library braucht 3 bis 10 Sekunden pro Ausgabenseite; 500 Werke mit bis zu 15 Seiten sind mehrere tausend Anfragen. Mit gedeckelter Nebenläufigkeit läuft das **eine bis mehrere Stunden**. Das ist in Ordnung für einen Lauf pro Monat, aber es muss gedrosselt sein, nicht geflutet.
3. **Fortsetzbar.** Nach jedem Werk anhängen, nicht am Ende alles schreiben. Ein Abbruch nach vier Stunden darf nicht bei null enden. Ein Werk, das schon im Index steht, wird übersprungen, solange kein `--force` gesetzt ist.

**Klein anfangen:** erst die zwölf kuratierten Werke, rund 600 Cover, 42 KB, ein Lauf von wenigen Minuten. Damit ist die ganze Kette geprüft — Farbmaß, Format, Suche, Anzeige —, bevor irgendjemand eine Stunde wartet. Auf die 500 wächst er, wenn 5.1 die Liste definiert hat.

### 3.5 Frische und Irrtum

Der Index ist eine **Momentaufnahme** und veraltet, sobald ein Katalog sich ändert. Das ist hinnehmbar, weil er nichts trägt, was stimmen muss: er beantwortet „was sieht ähnlich aus", nicht „welche Ausgabe kaufe ich". Zwei Regeln halten ihn ehrlich:

- `builtAt` steht in der Datei und wird auf der About-Seite genannt, wenn ähnliche Cover angezeigt werden.
- Kennt der Index eine Cover-ID nicht, wird **nichts** gezeigt — kein Rückfall auf irgendetwas.

### 3.6 Wo die Datei aufhört zu genügen

Bei etwa fünf Megabyte oder wenn geschrieben werden muss, während die Seite läuft. Dann wäre SQLite der nächste Schritt, und zwar lesend aus dem Bündel. Für den jetzigen Zweck wäre es Aufwand ohne Gewinn: die Suche ist ein linearer Scan über typisierte Arrays, dafür gibt es keine Abfragesprache, die schneller wäre.

## 4. Speicher B: die Zähler, weiterhin zurückgestellt

Klicks, Ereignisse und der tatsächliche Kontingentverbrauch müssen einen Deploy überleben und ständig geschrieben werden. Das ist eine Datenbank, und dafür gilt E6 unverändert: **Upstash Redis über HTTP**, wenn [3.1](../../ROADMAP.md) kommt, und keinen Tag früher. Der vorläufige Plan dafür steht in [PLAN-B](PLAN-B.md).

Zwei Dinge, die dann dazugehören und heute schon feststehen: der geteilte Zähler fürs Rate-Limit (`lib/ratelimit.ts` zählt pro Instanz, das ist dokumentiert und gewollt, bis es geteilt sein muss), und **keine Kennung des Lesers** (E14).

## 5. Der dritte Weg, der gar keinen Speicher braucht

Unabhängig von A und B: die Signaturen können in den **Next-Datencache** statt in eine Modul-`Map`. Next 16 kennt dafür die `use cache`-Direktive mit `cacheLife`; die ältere `unstable_cache` gibt es weiterhin. Welche von beiden bei der aktuellen Konfiguration greift, ist vor dem Bauen zu prüfen — `cacheComponents` ist in `next.config.ts` nicht gesetzt.

Der Gewinn wäre spürbar und kostet keine Datei: Signaturen überlebten den Instanzwechsel, und **der erste Besucher sähe, was heute erst der zweite sieht** (SPEC §7, „Kaltes Hashing"). Das ist die billigste Verbesserung von allen und gehört unabhängig von 6.10 gemacht.

## 6. Was das für E6 heißt

E6 lautet „Next-`fetch`-Cache, kein KV, bis ein Auslöser eintritt". Der Entwurf **widerspricht dem nicht**, sondern präzisiert ihn: eine beim Build erzeugte Datei ist keine Infrastruktur, sie wird nicht betrieben, nicht überwacht und nicht bezahlt. Trotzdem sollte es dastehen, sonst liest die nächste Sitzung E6 als „gar kein Speicher" und baut 6.10 nicht.

**Vorschlag zur Entscheidung (Julian):** E6 um einen Satz ergänzen, oder als E18 aufnehmen —

> *Gebaute, nur lesbare Daten im Repo sind kein Speicher im Sinne von E6. Ein Index, den ein Skript vor dem Deploy erzeugt und der mit dem Deploy ausgeliefert wird, ist erlaubt; ein Speicher, in den die laufende Seite schreibt, bleibt zurückgestellt.*

## 7. Was welcher offene Punkt davon bekommt

| Punkt | Was A liefert |
|---|---|
| **6.10** ähnliche Cover | Der Index selbst — Signaturen mit Farbe über alle indizierten Werke |
| **6.9** „Mehr von diesem Autor", „Anderes von diesem Verlag" | Aus `works` und den Ausgaben fällt eine Autor- und Verlagszuordnung ohne eine einzige Anfrage ab |
| **5.1** Sitemap über ~500 Werke | Der Index **ist** diese Liste, mitsamt der Cover-Zahl, nach der man sie auswählt |
| **5.4** redaktionelle Seiten | „Fünfzig Cover mit einem Gesicht darauf" ist eine Abfrage auf denselben Index statt Handarbeit |
| **1.9** Design-Element Startseite | Das farbenfrohste Cover zu finden ist eine Zeile, wenn Sättigung im Index steht |
| **SPEC §7** kaltes Hashing | Indizierte Werke zeigen ihre Wand sofort vollständig gefaltet, ohne Zeitbudget |

Sechs offene Punkte an einer Datei. Das ist das Argument.

## 8. Reihenfolge und Aufwand

1. **Farbe in die Signatur** (`lib/imagehash.ts`): Sättigung und 16-Eimer-Farbhistogramm im vorhandenen Durchlauf. Halber Tag mit Tests.
2. **`scripts/build-cover-index.ts`** über die zwölf kuratierten Werke, `data/cover-index.json` committen. Halber Tag.
3. **`lib/coverindex.ts`**: laden, in typisierte Arrays entpacken, `similarTo(coverId, limit)`. Ein Tag mit Tests und einer geprüften Schwelle.
4. **`/api/similar/[coverId]`** und die Reihe unter dem gewählten Cover. Halber Tag.
5. Erst danach 6.9 und 5.1, die denselben Index nur anders lesen.

**Nicht** in dieser Reihenfolge enthalten: der Lauf über 500 Werke. Der kommt, wenn die Liste steht, und braucht nur Zeit, keine Arbeit.

## 9. Fallstricke

- **Der Indexlauf darf nie in die Anfrage-Verarbeitung wandern.** Er dauert Stunden und ruft Open Library tausendfach. Ein Skript, kein Route-Handler, kein Cron.
- **`memo` in `coverhash.ts` braucht eine Obergrenze**, wenn Signaturen künftig auch aus dem Index kommen — sonst liegen dieselben Werte zweimal im Speicher.
- **Kein Bild wird gespeichert**, nur abgeleitete Zahlen. Das ist rechtlich der Unterschied zwischen einem Index und einem Archiv, und er soll auch im Kommentar stehen.
- **Die Datei nicht in den Client-Bundle ziehen.** `lib/coverindex.ts` importiert `data/cover-index.json`; wer es aus einer Client-Komponente importiert, schickt 1,8 MB an den Browser. Dieselbe Falle wie bei `lib/imagehash.ts`, und sie gehört in CLAUDE.md.
