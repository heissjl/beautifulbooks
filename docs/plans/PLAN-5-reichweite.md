# Plan für Phase 5: Reichweite, und wie viel davon eine Maschine machen kann

Detailplan zu [ROADMAP.md](../../ROADMAP.md) Phase 5, geschrieben 2026-09-07 auf Julians Bitte. Die Roadmap führt die Punkte 5.1 bis 5.8 knapp; hier steht, was dahinter steckt, welche Daten es dafür gibt und **wie sich das mit Claude-Agenten herstellen lässt, ohne dass Slop entsteht**.

Die kurze Fassung: die Seite hat einen Datenschatz, den sonst niemand so ausspielt — viele Cover **eines** Buchs mit Verlag, Jahr und Sprache. Daraus lassen sich Seiten erzeugen, deren Wert im Bild liegt und nicht im Text. Genau deshalb ist die Automatisierung hier vertretbar: **die Maschine schreibt keine Artikel, sie stellt Belege zusammen.** Der Text ist die kürzeste Zeile, die das Bild einordnet.

---

## 1. Ausgangslage

Eine Suchseite ohne eigene Inhalte bekommt keinen organischen Traffic: Google hat nichts zu indexieren außer der Startseite. Die technische Grundlage steht seit dem 2026-09-07 (Server-Komponente, Titelmuster, Schema.org, OG-Bild, Sitemap, robots), die Inhalte fehlen.

**Was die Seite als einzige hat**, und woraus deshalb alles Weitere folgt:

| Datum | Woher | Wofür brauchbar |
|---|---|---|
| Cover eines Werks mit Verlag, Jahr, Sprache, ISBN | `/api/works/[id]`, seitenweise | Zeitleisten, Sprachvergleiche, Kaufberatung |
| Perzeptuelle Signatur pro Cover | `?signatures=1` | Gleiches Motiv erkennen, auch über Werke hinweg |
| Verlagsfacette bei Open Library | `search.json?q=publisher:"…"` | **Reihen-Seiten ohne eigenen Index** |
| Leserzahlen je Werk | `readinglog_count` u. a. | Kandidatenauswahl, Reihenfolge |
| Urteil zum Handelsbild je ISBN | `/api/isbn/<isbn>` | „Welche Ausgabe bekomme ich?" |

**Am 2026-09-07 geprüft:** die Verlagsfacette funktioniert und ist ergiebig.

```
publisher:"Penguin Classics"   → 2.239 Werke
publisher:"Folio Society"      → 2.227 Werke
publisher:Manesse              →   705 Werke
publisher:"Penguin Clothbound Classics" → 0   (Reihenname, kein Verlagsfeld)
```

Das heißt zweierlei. Reihen-Seiten sind ohne eigene Datenbank möglich, und die Reihen, die Sammler suchen, heißen im Katalog oft anders als im Buchhandel — für jede Reihe braucht es eine kleine, von Hand bestätigte Liste von Verlagsschreibweisen.

---

## 2. Die Messlatte gegen Slop

Das ist der wichtigste Abschnitt. Ohne diese Regeln entsteht in zwei Wochen eine Halde aus Text, die niemand liest und die der Seite schadet, weil sie das Vertrauensversprechen aus SPEC §9.2 aushöhlt.

**Der Grundsatz:** Auf einer Seite über Buchcover ist der Text die Bildunterschrift, nicht der Inhalt. Eine erzeugte Seite darf nur entstehen, wenn sie **eine Beobachtung enthält, die aus unseren Daten folgt und auf der Werkseite nicht steht**.

| # | Regel | Warum |
|---|---|---|
| R1 | **Zahlen kommen nie aus dem Modell.** Das Skript setzt sie ein, der Entwurf bekommt Platzhalter, die er nicht verändern darf. | Ein Modell, das Zahlen schreibt, erfindet sie irgendwann. |
| R2 | **Jeder Satz braucht einen Beleg.** Ein Feld im Faktenblatt oder eine URL, die der Prüfer abrufen kann. Unbelegte Sätze fallen ersatzlos. | Das ist die Grenze zwischen Beleg und Geschwätz. |
| R3 | **Wortbudget 120 bis 250.** Wer mehr braucht, hat keine Beobachtung, sondern Füllung. | Slop ist meistens Länge ohne Gehalt. |
| R4 | **Kein Adjektiv ohne Zahl dahinter.** „Beliebt" nur mit Leserzahl, „selten" nur mit Ausgabenzahl. | „Ikonisch", „zeitlos", „fesselnd" sind die Vokabeln der Halde. |
| R5 | **Keine erfundene Geschichte.** Namen von Gestaltern, Auflagenhöhen, Anekdoten nur mit Quelle, die der Prüfer öffnet. | Genau hier halluzinieren Modelle am liebsten, und genau hier merkt es der Leser. |
| R6 | **Dünne Daten ergeben keine Seite.** Eine Schwelle entscheidet, nicht die Lust am Veröffentlichen. | Die Versuchung, die Woche zu füllen, ist die Ursache von Slop. |
| R7 | **Die Ehrlichkeitsregeln der Seite gelten.** Nie „alle", „jede", „vollständig" (SPEC §1, N12). | Sonst bricht die erzeugte Seite das Versprechen, das die Hauptseite hält. |
| R8 | **Eine Seite sagt etwas, das die Werkseite nicht sagt.** Sonst ist sie ein Duplikat und schadet der Indexierung. | Google bestraft Near-Duplicates, Leser auch. |
| R9 | **Ein Mensch gibt frei.** Ohne Julians Freigabe geht nichts online. | Die einzige Bremse, die nicht selbst automatisiert ist. |
| R10 | **Die Seite sagt, dass sie erzeugt wurde**, und woraus. Ein Satz am Fuß, wie die Fußnote unter der Cover-Wand. | Dieselbe Ehrlichkeit wie überall sonst; sie kostet nichts und schützt alles. |

**Die Prüffrage vor jeder neuen Seitengattung:** Könnte ein Mensch mit denselben Daten in zehn Minuten dasselbe schreiben, nur langsamer? Wenn ja, ist die Automatisierung gerechtfertigt. Wenn die Maschine etwas *hinzuerfinden* müsste, damit die Seite trägt, gehört die Gattung gestrichen.

---

## 3. Die Inhalte, nach Nutzen pro Aufwand

### 5.4a Reihen-Seiten `/reihe/<slug>` — der stärkste Hebel

**Was:** Eine Seite pro Buchreihe mit einer Wand aller Cover, die wir dazu kennen, gruppiert nach Werk, dazu drei Sätze und eine Tabelle (Werke, Cover, Jahre, Sprachen).

**Warum das trägt:** Reihen haben Sammler, und Sammler suchen mit genau diesen Worten („penguin clothbound classics list", „manesse bibliothek übersicht", „folio society editions"). Es gibt dafür bis heute keine gute visuelle Übersicht — Verlagsseiten zeigen nur das lieferbare Programm, nicht die Geschichte der Reihe.

**Daten:** die Verlagsfacette oben. Pro Reihe eine Liste von Verlagsschreibweisen, weil der Katalog uneinheitlich ist.

**Automatisierbar:** ja, bis auf die Aliasliste (einmal je Reihe, Julian bestätigt).

**Kandidaten für den Anfang:** Penguin Classics, Penguin Modern Classics, Everyman's Library, Folio Society, Vintage Classics, Oxford World's Classics, Suhrkamp Bibliothek, Insel-Bücherei, Manesse Bibliothek, Reclam Universal-Bibliothek, dtv, Pelican, New York Review Books Classics, Nabu/Dover.

**Warum kein Slop:** Der Wert ist die Wand. Der Text sagt: wann die Reihe beginnt, wie viele Werke wir davon kennen, was ihr Gestaltungsmuster ist (nur, wenn es sich aus den Bildern zeigen lässt — sonst weg).

### 5.4b Ein Buch durch die Jahrzehnte `/book/<id>/jahrzehnte`

**Was:** Dieselben Cover wie auf der Werkseite, aber nach Jahrzehnt gruppiert statt nach Sprache, mit einer Zeile je Jahrzehnt.

**Warum das trägt:** Das ist das Produktversprechen als Bild, und es ist das, was Leute teilen: „So sah *Der große Gatsby* in acht Jahrzehnten aus." Sucht wird es als „gatsby book covers over time", „1984 cover history".

**Daten:** vollständig vorhanden (Jahr je Ausgabe). **Kein einziger Google-Aufruf.**

**Automatisierbar:** vollständig, ohne Modell. Ein Skript reicht; ein Modell schreibt höchstens die Zeile je Jahrzehnt, und auch die nur, wenn sie etwas Belegtes sagt („in den 1970ern führen Taschenbuchverlage, sechs von sieben Covern sind Paperbacks").

**Schwelle:** mindestens 20 Cover über mindestens vier Jahrzehnte.

### 5.4c „Welche Ausgabe soll ich kaufen?" `/kaufen/<slug>`

**Was:** Pro bekanntem Buch ein Vergleich der Ausgaben, die heute im Handel sind: Cover, Verlag, Jahr, Format, Seitenzahl, und das Urteil aus F2.9 — zeigt der Verlag zu dieser ISBN dieses Cover oder ein anderes.

**Warum das trägt:** Es ist die Frage, die Leute wirklich stellen („which edition of moby dick should i buy"), es ist die Frage, für die es die Seite gibt, und es ist die Seite, an deren Ende ein Kauf-Link steht. Von allen Gattungen die einzige, die direkt auf Phase 4 einzahlt.

**Daten:** vorhanden, aber sie kostet Google-Anfragen (eine je geprüfter ISBN). Bei sechs Ausgaben also sechs — einmalig beim Erzeugen, danach steht die Seite. **Das ist der einzige Inhalt, der das Kontingent belastet, und deshalb der einzige, bei dem eine Obergrenze pro Woche nötig ist.**

**Automatisierbar:** der Datenteil ja, die Empfehlung nein. Eine Maschine soll nicht sagen, welche Ausgabe schöner ist. Sie stellt die Fakten nebeneinander, Julian schreibt zwei Sätze Urteil oder lässt sie weg.

### 5.4d Sprachvergleich `/book/<id>/sprachen`

**Was:** Ein Cover je Sprache, nebeneinander, mit Titel in der jeweiligen Sprache.

**Warum das trägt:** Visuell stark, teilbar, und es zeigt etwas, das nirgends sonst zu sehen ist. Nebenbei ist es die ehrlichste Werbung für die Suche.

**Automatisierbar:** vollständig, ohne Modell. **Schwelle:** mindestens sechs Sprachen.

### 5.4e Gleiches Motiv, verschiedene Bücher — die eine Idee, die sonst niemand hat

**Was:** Public-Domain-Gemälde und Fotos, die auf den Covern **verschiedener** Bücher auftauchen. In §9.1 B ist das schon einmal aufgefallen („Celestial Eyes" bei zwei Verlagen); mit Signaturen über viele Werke hinweg wird daraus eine Sammlung.

**Warum das trägt:** Das ist ein echter Fund, kein aufbereitetes Allgemeinwissen. Solche Seiten werden verlinkt, nicht nur besucht.

**Daten:** braucht einen **Index der Signaturen über Werke hinweg**, den es nicht gibt. Das ist der teuerste Punkt der Phase und hängt an dem Speicher aus Phase 3.

**Automatisierbar:** die Suche vollständig (reine Rechnung), die Zuschreibung des Motivs nicht — welches Gemälde das ist, muss belegt werden (Wikidata, Wikimedia Commons) oder es bleibt bei „dasselbe Bild auf N Covern", was für sich schon interessant ist.

**Einordnung:** erst nach dem Index. Bis dahin nicht anfangen.

### Gestrichen, bevor jemand es vorschlägt

- **Verlagsporträts.** Wir haben keine Daten über Verlage, nur ihre Namen. Eine Seite darüber wäre reine Modellprosa, also genau das, was nicht entstehen soll.
- **Gestalter-Seiten.** Open Library führt den Cover-Designer praktisch nie. Ohne Quelle keine Seite (R5).
- **„Die 10 schönsten Cover von X".** Ein Ranking ist ein Urteil; ein Modell hat dazu keine Grundlage, und ein erfundenes Ranking ist die reinste Form von Slop. Wenn Julian es selbst kuratiert, gern.

---

## 4. Die Fabrik: wie Claude-Agenten das herstellen

Sechs Stufen. **Die Modelle sehen nur das Faktenblatt, nie die Rohdaten und nie das Netz** — außer der Prüfer, der Quellen öffnen darf.

```
0  Kandidaten finden     Skript, kein Modell      → Warteschlange mit Datenlage
1  Faktenblatt bauen     Skript, kein Modell      → JSON: nur Zahlen und Listen
2  Entwurf               Claude-Agent             → Prosa mit Platzhaltern
3  Prüfung               zweiter Claude-Agent     → Satz für Satz belegt / nicht belegt
4  Freigabe              Julian                   → Pull Request zumachen oder nicht
5  Veröffentlichen       Skript                   → Datei im Repo, Route rendert
```

### Stufe 0 — Kandidaten finden (deterministisch)

Ein Skript `scripts/find-candidates.ts` geht die kuratierten Werke (5.1) durch und prüft die Schwellen je Gattung: Jahrzehnte-Seite ab 20 Covern und vier Jahrzehnten, Sprachseite ab sechs Sprachen, Reihenseite ab zwölf Werken. Es schreibt eine Warteschlange als JSON, sortiert nach Leserzahl.

**Kein Modell.** Wer aussucht, entscheidet über den Inhalt; das soll eine nachvollziehbare Schwelle tun und keine Vorliebe.

### Stufe 1 — Faktenblatt (deterministisch)

`scripts/factsheet.ts <kandidat>` erzeugt genau die Zahlen, die auf der Seite stehen dürfen:

```json
{
  "typ": "jahrzehnte", "werk": "OL468431W", "titel": "The Great Gatsby",
  "autor": "F. Scott Fitzgerald", "coverGesamt": 293, "ausgabenGeprüft": 1180,
  "jahrzehnte": [{ "von": 1990, "cover": 34, "verlage": ["Scribner", "Penguin"], "formate": {"paperback": 21} }],
  "quellen": ["https://openlibrary.org/works/OL468431W"]
}
```

Jede Zahl auf der fertigen Seite muss aus diesem Blatt stammen. Das ist R1, technisch durchgesetzt: der Entwurf schreibt `{{coverGesamt}}`, das Skript setzt ein.

### Stufe 2 — Entwurf (Claude-Agent)

Ein Agent je Seite, mit dem Faktenblatt als einziger Eingabe und einem Auftrag, der die Regeln aus Abschnitt 2 wörtlich enthält. Ausgabe: eine kurze Struktur (Titel, Untertitel, 120–250 Wörter, je Gruppe eine Zeile), Zahlen nur als Platzhalter, jeder Satz mit dem Feld annotiert, aus dem er folgt.

**Wichtig für die Qualität:** Der Auftrag muss ausdrücklich erlauben, **nichts zu schreiben.** Ein Agent, der „hier gibt die Datenlage keine Beobachtung her" antwortet, hat richtig gearbeitet. Ohne diese Erlaubnis erfindet er etwas, weil er glaubt, liefern zu müssen — das ist die häufigste Ursache von Slop in solchen Ketten.

### Stufe 3 — Prüfung (zweiter Agent, gegnerisch)

Ein zweiter Agent bekommt Faktenblatt und Entwurf, **nicht** den Auftrag von Stufe 2, und geht Satz für Satz durch: belegt durch Feld X, belegt durch Quelle Y (die er abruft), oder unbelegt. Er darf nicht umschreiben, nur urteilen. Ergebnis ist eine Liste.

**Abbruchregel:** mehr als zwei unbelegte Sätze, oder ein unbelegter Satz mit einer Zahl darin → der Entwurf wird verworfen, nicht repariert. Reparieren führt dazu, dass die Kette lernt, knapp an der Schwelle zu liefern.

Dazu ein paar deterministische Prüfungen, die kein Modell braucht: die verbotenen Wörter aus R7 (`every`, `all`, `complete`), das Wortbudget, ob jede Zahl im Text auch im Faktenblatt steht.

### Stufe 4 — Julians Freigabe

Die Kette öffnet einen Pull Request mit einer Seite je Commit, dazu die Prüfliste aus Stufe 3 als Beschreibung. Julian liest die Vorschau, macht den PR zu oder nicht. **Fünf Seiten pro Woche sind etwa zehn Minuten Lesezeit** — das ist die eigentliche Kapazitätsgrenze der Phase, nicht die Rechenzeit.

Eine Seite, die er zumacht, wird mit Begründung in eine Datei `docs/tests/abgelehnt.md` geschrieben. Nach zwanzig Ablehnungen weiß man, welche Gattung nicht trägt, und streicht sie.

### Stufe 5 — Veröffentlichen

Die Seite landet als JSON oder MDX unter `content/`, eine Route rendert sie mit denselben Bausteinen wie die Werkseite, und sie kommt in die Sitemap. Kein CMS, kein zusätzlicher Dienst.

### Wie das läuft

- **Von Hand, zum Anfangen:** `npx tsx scripts/find-candidates.ts` und dann in einer Claude-Code-Sitzung die Stufen 2 und 3 als Unteragenten. Das ist der richtige Weg für die ersten fünf Seiten, weil man dabei die Aufträge schärft.
- **Wöchentlich, wenn es steht:** ein geplanter Agent (`/schedule`) montags früh, der die Kette für fünf Kandidaten fährt und einen PR öffnet. Julian sieht montags einen PR und entscheidet.
- **Kosten:** Das Faktenblatt ist klein, der Entwurf kurz. Pro Seite eine niedrige einstellige Zahl von Cent, pro Woche also Kleingeld. Der Engpass ist die Freigabe, nicht das Geld.

**Was ausdrücklich nicht automatisiert wird:** kein Kommentar, kein Reddit-Beitrag, keine E-Mail und keine Antwort an einen Menschen kommt aus einer Maschine. Das ist keine Frage der Qualität, sondern des Anstands, und es ist auch die Grenze, an der Plattformen sperren.

---

## 5. Verteilung: 5.5 und 5.6

**Pinterest** ist der einzige Kanal, dessen Material vollständig aus den Daten fällt. Wir erzeugen schon 1200×630 für Open Graph; ein zweites Format 1000×1500 aus derselben Maschinerie ergibt einen Pin je Werk mit Titel, Autor und vier Covern. Pins leben Monate, was zum langsamen Aufbau passt. Das **Hochladen** braucht ein Geschäftskonto und läuft entweder von Hand in Stapeln oder über die API — erst prüfen, ob deren Bedingungen automatisiertes Posten erlauben.

**Instagram und TikTok:** aus der Coverliste lässt sich mit ffmpeg ein 15-Sekunden-Clip bauen („30 Cover von Dune"). Erzeugen ja, Posten von Hand.

**Reddit** bleibt Handarbeit, siehe oben. Der Nutzen liegt darin, bei „welche Ausgabe soll ich kaufen?"-Fragen die passende Vergleichsseite zu verlinken — das ist nur dann willkommen, wenn ein Mensch es tut und die Seite wirklich passt.

**Launch-Momente (5.6)** sind einmalig und von Hand: Show HN, Product Hunt, r/InternetIsBeautiful. Vorbereitung ist automatisierbar (für jeden angeschriebenen Blogger ein fertiger Link auf „sein" Buch), das Anschreiben nicht.

---

## 6. Reihenfolge

1. **5.1 zuerst** — ohne die Liste der ~500 Werke gibt es keine Kandidaten. Sie fällt aus den Suchen der Analyse-Seite (Phase 3) plus einer Setzliste.
2. **5.4b Jahrzehnte-Seiten** als erste Gattung: vollständig aus vorhandenen Daten, kein Google-Aufruf, kein Modell nötig. Damit lässt sich die Kette bauen und messen, bevor Prosa ins Spiel kommt.
3. **5.4a Reihen-Seiten** danach, weil sie den größten Sucherfolg versprechen und die Aliaslisten Julians Zeit kosten.
4. **5.5 Pinterest** parallel, sobald es Seiten zum Verlinken gibt.
5. **5.4c Kaufberatung** erst nach Phase 4, sonst zeigt die Seite Kauf-Links ohne Provision.
6. **5.2 Serverseitiges Rendern** nur, wenn die Search Console zeigt, dass die Wand nicht indexiert wird. Nicht auf Verdacht.
7. **5.4e Gleiches Motiv** ganz zuletzt, nach dem Signatur-Index.

## 7. Woran wir merken, dass es nicht funktioniert

Nach acht Wochen in der Search Console je Seitengattung: Impressionen, Klicks, mittlere Position. **Eine Gattung unter 50 Impressionen pro Woche wird eingestellt**, nicht verbessert. Dazu die Ablehnungsquote aus Stufe 4: mehr als ein Drittel abgelehnt heißt, die Schwellen aus Stufe 0 sind zu weich.

Und die Frage, die über allem steht: bringt eine erzeugte Seite jemanden dazu, ein Buch zu öffnen? Das misst 3.1 ohnehin. Wenn nicht, ist die ganze Phase eine Fleißaufgabe gewesen, und dann hört man damit auf.
