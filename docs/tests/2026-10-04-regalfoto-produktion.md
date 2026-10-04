# Zwei Fotos gegen die Produktion, 2026-10-04 abends (ROADMAP 5.11a, 5.13m)

Julian, am Telefon in der Homescreen-Web-App: „i did two tries of making a collection with uploaded photos in the last hour and once it barely found any works and the other time i couldnt find the "another cover" button on the phone". Gelesen aus `bb.photo` und den Request-Zeilen von Vercel, innerhalb der Stunde, die Hobby die Logs hält (Deployment `dpl_3LPUH87KFkzPu4TZfytRk9MNZc5m`).

## Der Ablauf laut Log (UTC)

| Zeit | Anfrage | Was |
|---|---|---|
| 19:35:08 | `GET /create` | die Lobby |
| 19:35:31 | `POST /api/walls/photo` | Foto 1 |
| 19:36:13 | `POST /api/walls/photo` | Foto 2 |
| 19:37:01 | `POST /api/walls` 201 | „Make a collection of …“ auf `/create` → Sammlung `llcr83mmp1` |
| 19:37:01 | `GET /c/llcr83mmp1/edit` | der Editor, ohne `?mode=` |
| 19:37:07 | `POST /api/walls/llcr83mmp1` | eine Änderung (welche, sagt das Log nicht) |
| 19:37:09, :12 | `GET /api/works/OL46028551W` | ein Werk geladen — ob über den Tausch-Dialog oder die Suche, sagt das Log nicht |
| 19:37:57 | `GET /` | zurück zur Startseite |

## Foto 1: acht Umschläge gelesen, keiner gefunden

```
read 8 · found 0 · maybe 1 · notFound 7 · failed 0 · covers 8 · msModel 4323 · msSearch 3008 · 1,0 ct
```

- **Das Lesen hat funktioniert:** acht Bücher, alle als `cover` (Umschlag zur Kamera), kein Parserproblem. Das deckt sich mit dem Testsatz („Umschläge sind gelöst“, 58 von 61).
- **Das Zuordnen nicht:** 7 × „not in the catalogue“, 1 × „maybe“. `failed 0` heißt: Open Library hat jedes Mal geantwortet; es ist kein Ausfall.
- **Der Testsatz misst diese Stufe nicht.** `lab/shelf/evaluate.ts` hält die *Lesungen* gegen die Wahrheitslisten; ob `matchPhotoBook` (`lib/walls/photo.ts`) zu einer Lesung ein Werk mit Cover findet, wird nirgends gemessen. Die 91 % des Testsatzes sagen über den Weg bis zur Kachel nichts.
- **„not in the catalogue“ fasst drei Fälle zusammen**, die der Code unterscheiden könnte: (a) die Suche liefert nichts; (b) sie liefert Werke, aber weder Autor noch Titel stimmen (`first-result`, seit 2026-09-28 absichtlich verworfen); (c) das passende Werk hat bei Open Library kein Cover (`tileFromWork` → `undefined`). Nur (a) ist „nicht im Katalog“; (c) ist sogar ein Treffer.
- **Welche acht Bücher es waren, steht nirgends** — `bb.photo` loggt mit Absicht nur Zahlen. Ohne die Titel ist nicht zu sagen, ob es (a), (b) oder (c) war. Von hier aus nicht nachzustellen: der Container erreicht openlibrary.org nicht.

## Foto 2: das „another cover“, das es auf `/create` nicht gibt

```
read 29 · found 18 · maybe 8 · notFound 3 · failed 0 · covers 2 · msModel 9573 · msSearch 13202 · 2,0 ct
```

- **Auf `/create` gibt es den Link nicht, mit Absicht:** `WallsStart` reicht kein `onOtherCover` an `WallPhoto`, weil es noch keine Sammlung gibt, in der getauscht werden könnte; der Satz über der Liste sagt „you can change it in the collection’s editor“. Bei den acht „maybe“-Zeilen stünde ohnehin „search instead“ an der Stelle.
- **Der Editor öffnete danach auf „Add covers“**, einem Suchfeld — die eben angelegten Cover lagen hinter dem Reiter „Arrange“, auf dem Telefon dazu hinter der Leiste „You are adding to … · Open“. `commit` in `components/WallsStart.tsx` rief `editHref(wall.id)` ohne Modus.
- **Im Arrange war der Tausch nur ein Tipp auf die Kachel ohne Wort dafür:** der einzige Hinweis ist das `title`-Attribut („Click for another cover of this book …“), und ein Tooltip erscheint auf einem Touchscreen nie.

## Geändert (dieser Commit)

1. `components/WallsStart.tsx`: wer auf `/create` Cover in eine Sammlung gibt (Foto, Zufall, fremde Sammlung), landet im Editor auf **Arrange** (`?mode=arrange`); die leere Sammlung bleibt bei „Add covers“.
2. `components/CollectionEditor.tsx`: über dem Raster steht „Tap or click a cover to swap it for another cover of the same book.“ (deutsch in `lib/i18n/de.ts`). Angesehen bei 390 × 844 und 1280 × 800 gegen `npm run dev`: eine Zeile, 358 bzw. 1216 px breit, kein waagrechtes Scrollen.

## Offen (in ROADMAP 5.11a eingetragen)

- **Die Titel von Foto 1** — Julian, falls er sie noch weiß oder das Foto hat: als Foto 15 in den Testsatz (Wahrheitsliste), dann ist der Fall nachstellbar.
- **Die Zuordnung messen:** `evaluate.ts` um die Stufe nach dem Lesen erweitern — je Foto, wie viele Lesungen eine Kachel bekommen, getrennt nach (a)/(b)/(c). Braucht Open Library (live oder als Fixtures), kein Google.
- **„not in the catalogue“ nur für (a)**; (c) ehrlich benennen („found, but the catalogue has no cover for it“) und die Suche anbieten. N12: kein Befund, der mehr behauptet als geprüft wurde.
- **`bb.photo` um `noHits` / `noAgreement` / `noCover`** ergänzen — drei Zahlen, kein Titel, nichts über den Leser —, damit der nächste Fall aus dem Log lesbar ist.
