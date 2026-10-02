# PLAN 5.16a — Schallplatten: lokales MVP aus dem Mockup

Stand: 2026-10-02, **gebaut** (Schritte 1–4, [lab/vinyl README Punkt 15](../../lab/vinyl/README.md)); Schritt 5, die Abnahme mit echten Daten, ist offen — aus der Cloud-Umgebung waren alle Quellen gesperrt. Abweichungen vom Plan: die Faltungs-Regression gegen die 57 von Hand eingeteilten *Kind-of-Blue*-Hüllen fehlt, weil deren Hashes nur in Julians lokalem `cache.json` liegen (die Tests prüfen die Regel an erfundenen Hashes); bis alle Vorderseiten verglichen sind, zeigt die Seite ein Raster statt Hüllen-Abschnitten. Julian: „ok, starting from the mock up, what do we need now to build a local mvp". Grundlage: [lab/vinyl/README.md](../../lab/vinyl/README.md), Messungen in der [Historie](../history.md#2026-09-29--schallplatten-statt-bücher-erste-messung-roadmap-516).

## Was „lokales MVP" heißt

**Jedes Album suchbar, seine Wand entsteht beim Aufruf** — nicht mehr acht vorab gesammelte Alben. Läuft auf `127.0.0.1` als Lab-Werkzeug (wie `lab/collections/`, Port 4342), nicht in der Next-App und nicht auf Vercel. So bleibt die offene Frage (3) aus 5.16 offen (eigene Seite oder Teil von beautifulcovers, siehe [Einschätzung](../../lab/vinyl/README.md#fork-eigene-app-oder-teil-der-buchseite)); was hier gebaut wird, ist in beiden Fällen der Kern.

**Abnahme:** fünf Alben, vier neue und eins der acht gemessenen als Kontrolle (Vorschlag: *Abbey Road*, *Blue* von Joni Mitchell, *Unknown Pleasures*, *Thriller*; Kontrolle *Kind of Blue*), je Album: richtige Release-Gruppe als erster Treffer, erste Vorderseiten nach ≤ 3 s kalt, Abschnitte mit allen Etiketten nach ≤ 30 s kalt, ≤ 1 s warm. Angesehen bei 1280 × 800 und 390 × 844.

## Was das Mockup schon hat und was fehlt

| Baustein | Heute (`mockup.ts` + `mockup.html`) | Fürs MVP |
|---|---|---|
| Album finden | fest verdrahtet, acht Alben aus `measure.ts`, Titel-Gleichheit | **fehlt:** Suche über `release-group?query=`, nur `primary-type: Album`, Kompilationen, Tribute und Bootlegs nach hinten; MusicBrainz hat keine Beliebtheit, nur `score` — Rangfolge an den fünf Abnahme-Alben plus Mehrdeutigen (*Blue*, *Rumours*) messen |
| Pressungen | Stapel-Skript, `cache.json` als ein großes Objekt | als Funktion `loadAlbum(rgid)` auf Abruf; Releases seitenweise (100), **1 Anfrage/s an MusicBrainz** (deren Regel), bei 23–151 Releases also 1–2 s; Cache je Album als Datei, nicht ein Gesamt-JSON |
| Bilder | je Pressung das CAA-JSON, dann das Bild | Vorder- und Rückseite **ohne CAA-JSON**: die Release-Antwort sagt `cover-art-archive.front`/`back`, die Bilder liegen unter `coverartarchive.org/release/<mbid>/front-250` und `/back-250`. Die **Etiketten brauchen das JSON** (Typ `Medium` hat keine solche Adresse), und seit dem Layout Hüllen im Detail (2026-10-02) zeigt jeder Abschnitt die Etiketten aller Pressungen seiner Hülle: ein JSON je Pressung mit Bildern (4–57 je Album, gemessen 2026-09-29). Nebenläufig begrenzt nachladen; die Etiketten-Reihe füllt sich nach den Vorderseiten |
| Signaturen | dHash über `lib/imagehash.ts`, Bilder in `out/thumbs/` | gleich, aber nebenläufig begrenzt (archive.org verliert bei jedem Lauf ein bis zwei Bilder) mit Wiederholung; eine Hülle ohne Hash erscheint ungefaltet, nie als „keine" |
| Faltung | `fold()` im Browser-Skript von `mockup.html`, Umschalter 16–22 | als reines Modul `lab/vinyl/fold.ts` herauslösen, Schwelle 20 fest (Julians Wahl), **Test gegen die 57 von Hand eingeteilten *Kind of Blue*-Hüllen** (Ergebnis 9 Kacheln, nichts vermischt außer dem bekannten UHQR-Fall) — die Einteilung muss dafür als Fixture in die Tests |
| Albumseite | statisches HTML mit eingebetteten Daten; seit 2026-10-02 ein Abschnitt je Hülle mit Vorderseite, Rückseite, Etiketten und der Etiketten-Reihe ihrer Pressungen | Seite liest `/api/album/<rgid>` und baut **fortschreitend**: Pressungen zuerst einzeln, zu Hüllen-Abschnitten zusammengelegt, sobald die Hashes da sind (wie `useWorkPages` bei Büchern) |
| Reiter | Länder | bleibt |
| Seitenleiste | nur noch das Album (Auszug, Zahlen); die gewählte Pressung steht im Abschnitt | bleibt so |
| Geschichte | `wiki-only.ts` als Messskript | als Funktion: Wikidata-ID aus den URL-Beziehungen der Release-Gruppe, Wikipedia-Auszug mit Link und CC BY-SA (entschieden 2026-09-29), gesetzte Zeile je Hülle aus `captions.ts`. Gemessen 1,0 s Median |
| Discogs-Anmerkungen, Plattenfarbe | aus dem Dump-Lauf, nur für die acht Alben | **weglassen** (siehe unten) |

## Was Julian vorher entscheiden muss — und was nicht

- **Discogs im MVP: nein, vorgeschlagen.** Die Anmerkungen brauchen einen lokalen Auszug aus dem 11-GB-Dump (8 Minuten Lesen, dann ein Index der über MusicBrainz verknüpften Discogs-Releases); die Farbe kam über diese Verknüpfung nur für 10 von 138 Pressungen mit Foto. Lohnt erst, wenn die Wand ohne sie trägt. Entscheidung (1) aus 5.16 bleibt damit offen, wird aber nicht blockierend.
- **Rückseite und Etikett (Frage 2): entschieden 2026-10-02**, beide auf der Albumseite selbst (Layout Hüllen im Detail, [README Punkt 14](../../lab/vinyl/README.md)). Preis: ein CAA-JSON je Pressung mit Bildern, nur für die Etiketten; Teil der Abnahme ist, wie lange die Etiketten-Reihe kalt braucht.
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
