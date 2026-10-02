# PLAN 5.16a — Schallplatten: lokales MVP aus dem Mockup

Stand: 2026-10-02, offen. Julian: „ok, starting from the mock up, what do we need now to build a local mvp". Grundlage: [lab/vinyl/README.md](../../lab/vinyl/README.md), Messungen in der [Historie](../history.md#2026-09-29--schallplatten-statt-bücher-erste-messung-roadmap-516).

## Was „lokales MVP" heißt

**Jedes Album suchbar, seine Wand entsteht beim Aufruf** — nicht mehr acht vorab gesammelte Alben. Läuft auf `127.0.0.1` als Lab-Werkzeug (wie `lab/collections/`, Port 4342), nicht in der Next-App und nicht auf Vercel. So bleibt die offene Frage (3) aus 5.16 offen (eigene Seite oder Teil von beautifulcovers, siehe [Einschätzung](../../lab/vinyl/README.md#fork-eigene-app-oder-teil-der-buchseite)); was hier gebaut wird, ist in beiden Fällen der Kern.

**Abnahme:** fünf Alben, vier neue und eins der acht gemessenen als Kontrolle (Vorschlag: *Abbey Road*, *Blue* von Joni Mitchell, *Unknown Pleasures*, *Thriller*; Kontrolle *Kind of Blue*), je Album: richtige Release-Gruppe als erster Treffer, erste Kacheln nach ≤ 3 s kalt, gefaltete Wand nach ≤ 30 s kalt, ≤ 1 s warm. Angesehen bei 1280 × 800 und 390 × 844.

## Was das Mockup schon hat und was fehlt

| Baustein | Heute (`mockup.ts` + `mockup.html`) | Fürs MVP |
|---|---|---|
| Album finden | fest verdrahtet, acht Alben aus `measure.ts`, Titel-Gleichheit | **fehlt:** Suche über `release-group?query=`, nur `primary-type: Album`, Kompilationen, Tribute und Bootlegs nach hinten; MusicBrainz hat keine Beliebtheit, nur `score` — Rangfolge an den fünf Abnahme-Alben plus Mehrdeutigen (*Blue*, *Rumours*) messen |
| Pressungen | Stapel-Skript, `cache.json` als ein großes Objekt | als Funktion `loadAlbum(rgid)` auf Abruf; Releases seitenweise (100), **1 Anfrage/s an MusicBrainz** (deren Regel), bei 23–151 Releases also 1–2 s; Cache je Album als Datei, nicht ein Gesamt-JSON |
| Vorderseiten | je Pressung das CAA-JSON, dann das Bild | **CAA-JSON für die Wand weglassen:** die Release-Antwort sagt `cover-art-archive.front: true`, das Bild liegt dann unter `coverartarchive.org/release/<mbid>/front-250`. Halbiert die Anfragen; JSON (Rückseite, Etiketten, Booklet) erst beim Auswählen einer Hülle |
| Signaturen | dHash über `lib/imagehash.ts`, Bilder in `out/thumbs/` | gleich, aber nebenläufig begrenzt (archive.org verliert bei jedem Lauf ein bis zwei Bilder) mit Wiederholung; eine Hülle ohne Hash erscheint ungefaltet, nie als „keine" |
| Faltung | `fold()` im Browser-Skript von `mockup.html`, Umschalter 16–22 | als reines Modul `lab/vinyl/fold.ts` herauslösen, Schwelle 20 fest (Julians Wahl), **Test gegen die 57 von Hand eingeteilten *Kind of Blue*-Hüllen** (Ergebnis 9 Kacheln, nichts vermischt außer dem bekannten UHQR-Fall) — die Einteilung muss dafür als Fixture in die Tests |
| Wand | ein statisches HTML mit eingebetteten Daten | Seite liest `/api/album/<rgid>` und baut **fortschreitend**: Kacheln ungefaltet, sobald die Pressungen da sind, gefaltet, sobald die Hashes da sind (wie `useWorkPages` bei Büchern) |
| Reiter | Länder | bleibt |
| Seitenleiste | Pressung, Rückseite, Etiketten derselben Hülle | bleibt; Rückseite und Etiketten aus dem CAA-JSON beim Auswählen |
| Geschichte | `wiki-only.ts` als Messskript | als Funktion: Wikidata-ID aus den URL-Beziehungen der Release-Gruppe, Wikipedia-Auszug mit Link und CC BY-SA (entschieden 2026-09-29), gesetzte Zeile je Hülle aus `captions.ts`. Gemessen 1,0 s Median |
| Discogs-Anmerkungen, Plattenfarbe | aus dem Dump-Lauf, nur für die acht Alben | **weglassen** (siehe unten) |

## Was Julian vorher entscheiden muss — und was nicht

- **Discogs im MVP: nein, vorgeschlagen.** Die Anmerkungen brauchen einen lokalen Auszug aus dem 11-GB-Dump (8 Minuten Lesen, dann ein Index der über MusicBrainz verknüpften Discogs-Releases); die Farbe kam über diese Verknüpfung nur für 10 von 138 Pressungen mit Foto. Lohnt erst, wenn die Wand ohne sie trägt. Entscheidung (1) aus 5.16 bleibt damit offen, wird aber nicht blockierend.
- **Rückseite und Etikett (Frage 2):** das MVP behält den Umschalter Front · Back · Label des Mockups. Da Rückseiten und Etiketten das CAA-JSON je Pressung brauchen, kosten „Back" und „Label" auf der Wand dieselben n Anfragen wieder, die oben gespart werden — nachgeladen erst beim Umschalten. Die Messung dieser Kosten ist Teil des MVP und Grundlage für Frage 2.
- **Positionierung (0) und eigene Seite (3):** für ein lokales MVP nicht nötig.
- **Die fünf Abnahme-Alben:** Vorschlag oben, Julian darf tauschen.

## Reihenfolge

1. `fold.ts` und `pressing.ts` (Release → Pressung, heute inline in `mockup.ts`) als reine Module mit Tests; Fixtures aus einem aufgenommenen Album (*Kind of Blue*), keine Netzzugriffe in Tests (Lab-Regel 4).
2. `album.ts`: `loadAlbum(rgid)` mit Datei-Cache, MusicBrainz-Takt 1/s, Vorderseiten ohne CAA-JSON, Signaturen nebenläufig. Kalt und warm gemessen an den acht bekannten Alben.
3. `search.ts`: Release-Gruppen-Suche mit Rangfolge; gemessen an den Abnahme-Alben und den Mehrdeutigen.
4. `server.ts`: `127.0.0.1:4342`, Routen `/`, `/album/<rgid>`, `/api/search`, `/api/album/<rgid>`, `/api/release/<mbid>` (CAA-JSON, Geschichte); Seite aus `mockup.html` mit Suchfeld, ohne eingebettete Daten.
5. Abnahme wie oben, Zahlen in die Historie, Bildschirmfotos nach `docs/tests/` (nicht ins Repository).

Grob geschätzt: 1–2 Sitzungen. Netzzugriff auf musicbrainz.org und coverartarchive.org ist nötig; aus der Cloud-Umgebung vom 2026-10-02 waren beide gesperrt (Proxy 403), Schritt 2–5 also lokal oder mit freigegebenem Netz.

## Was das MVP nicht ist

Kein Deploy, keine Next-Route, kein Kauf-Link (Partnerfeeds aus [markt.md](../../lab/vinyl/markt.md) sind ein eigener Punkt), keine Discogs-Bilder, kein Google Books (E10).
