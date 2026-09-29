# lab/vinyl — dieselbe Wand für Schallplatten

Roadmap 5.16. Julian, 2026-09-29: „lab idee: exakt das gleiche aber für vinyl alben. zu bedenken: vorder und rückseite und vielleicht farbe oder print auf vinylplatte selbst".

## Die Frage

Hat eine offene Quelle genug Bilder, um für ein Album dieselbe Wand zu bauen wie für ein Buch — jede Pressung mit ihrem Cover —, und dazu die Rückseite und die Platte selbst (Farbe, Picture Disc, Etikett)?

## Das Modell passt fast eins zu eins

| Seite heute (SPEC §2) | Schallplatte | Quelle |
|---|---|---|
| Work | Album = MusicBrainz *release group* | `musicbrainz.org/ws/2/release-group` |
| Edition | Pressung = MusicBrainz *release* (Land, Jahr, Label, Katalognummer, Barcode, Format `12" Vinyl`) | `…/ws/2/release?release-group=…&inc=media` |
| Cover | Bild im Cover Art Archive, **mit Typ**: `Front`, `Back`, `Medium` (die Platte selbst oder ihr Etikett), `Spine`, `Obi`, `Booklet`, `Sticker`, `Poster`, `Matrix/Runout`, … | `coverartarchive.org/release/<mbid>` |
| ISBN | Barcode (EAN/UPC) und Katalognummer — erst ab etwa 1980 auf Platten, davor nur Katalognummer | release |

Was anders ist:

- **Seiten.** Ein Buchcover ist ein Bild; eine Pressung hat Vorder- und Rückseite und die Platte. Die Wand zeigt die Vorderseiten und faltet nach ihnen (dieselbe Faltung, `lib/works.ts`); Rückseite und Platte gehören in die Seitenleiste des gewählten Covers, als Umdrehen oder als zweite und dritte Kachel. Ein Rückseitenbild darf nie auf der Wand der Vorderseiten landen — dafür ist der Bildtyp da.
- **Farbe der Platte.** MusicBrainz hat dafür kein Feld; Bearbeiter schreiben es in die Disambiguierung („red vinyl", „picture disc"). `vinylColourNote` liest das, und kein Eintrag heißt „nicht notiert", nie „schwarz" (N12). Discogs führt die Farbe strukturierter (Formatbeschreibung „Red, Translucent"), braucht aber einen Token, und seine Bilder tragen keinen Seitentyp (nur „primary"/„secondary").
- **Gleiche Vorderseite, andere Platte.** Viele Neuauflagen unterscheiden sich nur in der Plattenfarbe. Die gefaltete Wand würde sie zu einer Kachel machen — richtig für die Wand, aber die Farbvarianten wären dann das, was man im gefalteten Stapel sucht.
- **Kaufen.** Kein Buchhandel, sondern Discogs-Marktplatz, eBay, Plattenläden; die Frage aus 5.14 stellt sich neu.

## Wie gemessen wird

`measure.ts` fragt für acht Alben aus sechs Jahrzehnten alle Releases ab, zählt die Vinyl-Pressungen, wie viele davon Vorder- und Rückseite haben (aus der Zusammenfassung, die MusicBrainz mitliefert), und fragt für bis zu 40 Vinyl-Pressungen mit Bild je Album das Cover Art Archive nach den Bildtypen — vor allem `Medium`. Eine Anfrage pro Sekunde an MusicBrainz, Antworten in `cache.json` (git-ignoriert), Fehlschläge als Fehlschläge. Kein Google Books.

```bash
npx tsx lab/vinyl/measure.ts
npx vitest run lab/vinyl
```

## Status

**Gemessen am 2026-09-29** an acht Alben; die Tabellen stehen in der [Historie](../../docs/history.md#2026-09-29--schallplatten-statt-bücher-erste-messung-roadmap-516). Kurz:

1. **Vorder- und Rückseite gibt es getrennt und benannt:** 138 von 181 Vinyl-Pressungen bei MusicBrainz haben eine Vorderseite, 113 eine Rückseite. Die Seite müsste nie raten, welche Seite ein Bild zeigt.
2. **Aber dünn:** 4 bis 57 Pressungen mit Bild je Album — eine Reihe, keine Wand. Discogs kennt 2- bis 20-mal so viele Vinyl-Versionen (*Rumours* 492 statt 24) und liefert ohne Token ein 150-px-Vorschaubild je Version; große Bilder brauchen einen Token, und ihre Bilder tragen keinen Seitentyp.
3. **`Medium` zeigt das Etikett, nicht die Platte:** 11 von 12 zufällig angesehenen Bildern sind Mittenetiketten (Columbia, CBS, Harvest, Geffen), eins eine CD aus einer Box. Eine Wand der Etiketten wäre eine eigene Idee.
4. **Die Plattenfarbe steht nur als Freitext** — bei MusicBrainz in 4 von 181 Disambiguierungen, bei Discogs im Formattext der Pressung, dort aber vermischt mit Etikett- und Hüllenfarbe („Green WB Labels", „Yellow Cover", „Green Obi"). Ein Farbwort allein heißt also noch nicht, dass die Platte so aussieht; ein Parser müsste „Labels", „Cover", „Obi", „Sleeve" ausschließen.

**Offen, Julian:** Discogs-Token beantragen und die Bildrechte dort prüfen, oder bei MusicBrainz bleiben; wo Rückseite und Etikett erscheinen (auf der Wand oder erst beim gewählten Cover); eigene Seite oder Teil von beautifulcovers.
