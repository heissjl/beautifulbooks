# Vergleich mit my9albums.org (2026-10-04)

Julian, 2026-10-04: „check what we can learn from this website that went viral just now". Die Seite selbst, X und der Blogbeitrag über sie waren aus der Sitzung nicht erreichbar (Egress-Proxy); alles über my9albums stammt aus Suchtreffern, der Selbstbeschreibung der Seite und dem Startbeitrag ihres Autors (@nays1_ auf X). **Was dort nicht steht, ist nicht geprüft** — vor allem das Format des Bildes und ob es die Adresse der Seite trägt.

## Was my9albums ist

- „Pick the 9 albums that made you, turn them into a poster, and share it." Neun Alben in einem 3×3-Raster, eine Reihenfolge, ein Name oder Handle, dann ein **Bild zum Herunterladen** „for your feed or story". Kein Konto; das Brett liegt im Browser, bis man teilt; ein Teil-Link `/s/<id>`.
- Verbreitung über das Bild selbst plus `#my9albums` (X, Threads), Ende September/Anfang Oktober 2026; die typische Begleitzeile ist „What's yours?".

## Was davon trägt, und was es für uns heißt

1. **Die Zahl ist das Produkt.** Neun zwingt zur Auswahl, macht zwei Bretter vergleichbar und stellt die Gegenfrage von selbst. Unsere Sammlung (F9) ist offen (bis 500), hat keine Frage und ist als Stufe 1 eines Funnels zur Wand gedacht — sie ist ein Werkzeug, keine Aussage über den, der sie baut. Ein Format „9 books that made you" wäre ein **anderes Ding** neben F9, nicht eine Einstellung davon.
2. **Was reist, ist ein Bild, kein Link.** Unser einziges Bild einer Sammlung ist die Vorschaukarte (`app/c/[id]/opengraph-image.tsx`, 1200×630 quer) — sie erscheint nur, wo ein Link eingefügt wird. Instagram-Feed (4:5, 1080×1350) und Story (9:16, 1080×1920) nehmen keine Links; X stuft Beiträge mit Links herab. Ohne „Download image" in Hochformat gibt es keinen Kreislauf. **Das Bild muss die Adresse tragen**, sonst führt es nirgends hin.
3. **Buchcover sind 2:3, Albumcover 1:1.** Ein 3×3 aus 2:3-Kacheln ist selbst 2:3 (1080×1620) und passt weder in 4:5 noch ohne Rand in 9:16. Story: Kacheln 330×495 ergeben 990×1485, bleiben gut 400 px für Titel, Name und Adresse — das Hochformat passt. Für 4:5 braucht es kleinere Kacheln mit Seitenrand (etwa 280×420 → 840×1260, ohne Platz für einen Kopf) — also Story zuerst.
4. **Reibung.** my9albums: suchen, klicken, fertig. Unser Weg: Cookie-ID, Lobby, Editor mit zwei Modi, „Keep it", 48-h-Verfall, „Your ID". Für neun Cover ist das alles unnötig: **neun Cover-IDs passen in die Adresse** (`/9?c=ol-123,ol-456,…&by=`). Kein Redis, keine Besucher-ID (N11 bleibt unberührt, E22 wird nicht ausgeweitet), keine Frage nach Aufbewahrung (5.13e), nichts zu moderieren außer dem Namen.
5. **Unser Vorteil, den Alben nicht haben:** ein Album hat ein Cover, ein Buch viele. „The 9 books that made you — **in the edition you read**" ist genau das, was nur diese Seite kann, und macht das Bild persönlicher als jedes Album-Raster. Der Standard muss aber das bekannteste Cover sein, mit „change edition" als zweitem Schritt — sonst kostet jedes Buch die Wartezeit einer Editionswand.
6. **Der Weg zurück zum Kauf.** Das Bild bringt Besucher auf eine Seite mit neun Büchern, jedes ein Link auf seine Buchseite mit Kauflinks über `/go/` — my9albums hat (soweit sichtbar) keinen solchen Weg.

## Was ein viraler Tag bei uns kaputt machen würde

- **Die Domain antwortet nicht** (2.2): ein Bild mit `buyitscovers.com` führt heute auf INWX' Parkseite. Vor jedem teilbaren Bild.
- **Google-Kontingent:** der Picker (`components/WallPicker.tsx`) lädt Seite 0 eines Werks über `useWorkPages`, und Seite 0 fragt Google. Neun kalte Werke = neun Anfragen; bei 1.000 am Tag sind nach rund hundert neuen Besuchern die Google-Cover weg (Open Library bleibt). Ein Neun-Format sollte `googleBooks: false` nehmen wie das Mosaik.
- **Open Library ist langsam** (2–7 s Suche, 3–10 s Editionsseite, N3) und wird über `/img/` von einer Adresse aus geholt (N8) — eine Spitze kann uns dort drosseln lassen. Das Bild selbst muss aus den gecachten `/img/`-Antworten gebaut werden.
- **Vercel Hobby:** Bot-Schutz antwortet bei Spitzen mit 403-Challenge (2.4); Bildgenerierung (`next/og`) kostet Funktionszeit je Download. Grenzen vor einem Start nachlesen.
- **Analytik (CLAUDE.md-Liste):** eine neue Seite braucht `originOf` (Punkt 3), ein Download wäre ein neues Signal (Punkt 6/7) — nur als Klasse, ohne Kennung.

## Vorschlag

Ein eigener Punkt in Phase 5, **erst nach 2.2**: „9 books that made you" unter eigener Adresse, Zustand nur in der URL, bekanntestes Cover als Standard mit Ausgabewahl, Download als 1080×1920 mit Adresse, Teil-Seite mit neun Buchseiten-Links, keine Google-Anfrage. Ob, und wie es heißt, entscheidet Julian.
