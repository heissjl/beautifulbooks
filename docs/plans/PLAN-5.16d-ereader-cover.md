# PLAN 5.16d — Ein Cover aussuchen und auf den eigenen E-Reader bringen, als Feature

Julian, 2026-10-09: „kannst du einen plan erstellen, wie man das aussuchen und aufspielen von covern für den eigenen ereader zum feature machen könnte? ich habe pocketbook, aber ich nehme an mit anderen moderneren ereadern geht es wahrscheinlich einfacher ein cover rauszusuchen? vllt sogar die website als e-reader-browser-freundliche version anbieten?“

**Status:** Plan, nichts gebaut. Wartet auf Julians Entscheidungen in §7.

## 1. Was wir schon wissen (aus 5.16–5.16c, am Gerät gemessen)

- **Das Cover steckt in der Buchdatei** (EPUB: das Bild, auf das `cover` im Paket zeigt). Was ein Reader in seiner Bibliothek zeigt, ist aber ein **eigenes Vorschaubild**, das er einmal aus der Datei macht und dann behält. PocketBook (Touch Lux 3, Firmware 5.12): `system/cover_chache/1/<Pfad>.png`, 8-Bit-Grau, höchstens 260 × 393; es wird **nicht erneuert**, wenn die Datei sich ändert (*Ubik*, 2026-10-04).
- **Eine geänderte Datei ist für den Reader ein neues Buch** (Prüfsumme in `explorer-3.db`): Lesestand und Markierungen bleiben am alten Eintrag. Für ein ungelesenes Buch ist das egal, für ein angefangenes nicht.
- **Calibre hilft bei PocketBook nicht:** alle neun PocketBook-Treiber laden beim Verbinden keine Cover hoch (`WANTS_UPDATED_THUMBNAILS = False`); nur erneutes Senden trägt das Cover in die Datei, und die Vorschau bleibt trotzdem alt.
- **Was funktioniert, und zwar lokal:** `lab/calibre/` (die „Calibre Covers“-App) schreibt ein gewähltes Cover in Calibre **oder** direkt als Vorschaubilder auf den PocketBook (`reader.ts`: Bibliothek und Startseite, mit Sicherung und Rücknahme), einzeln oder als Batch. Am echten Reader ist der Reader-Knopf noch nicht gelaufen (README, Status).
- **Rechte:** Cover gehören den Verlagen; die Seite zeigt sie als Katalogbilder. Ein Leser, der das Bild in **seine eigene** Buchdatei setzt, handelt privat; die Seite, die ihm dafür ein Werkzeug gibt, sollte das Bild nicht selbst in fremde Dateien schreiben und nichts speichern — dasselbe Muster wie beim Shelf-Portrait: alles im Browser des Lesers, nichts auf dem Server (Rechtefrage aus 5.5 gilt für Clips, nicht für die private Kopie; trotzdem in §7).

## 2. Was ein Reader braucht, je Gerät (zu prüfen, nicht gemessen)

| Reader | Woher kommt das Bild in der Bibliothek | Was ein Cover-Tausch braucht | Browser auf dem Gerät |
|---|---|---|---|
| **PocketBook** (gemessen) | eigenes `cover_chache`-PNG, nie erneuert | Datei ersetzen (neues Buch) **oder** die PNGs schreiben wie `reader.ts` | alter WebKit, langsam, kann Dateien herunterladen (zu prüfen: Dateiauswahl zum Hochladen?) |
| **Kobo** | Vorschaubilder in `.kobo-images/`, aus der Datei gemacht; Calibres Kobo-Treiber kann Cover hochladen („Upload covers“) | Datei ersetzen reicht meist; sonst Calibre mit Kobo-Treiber | Beta-Browser (Chromium-nah), für einfache Seiten brauchbar |
| **Kindle** | für per USB kopierte Bücher `system/thumbnails/`, erzeugt aus der Datei; bekannte Lücke: Sideload-Cover fehlen oft (Calibre-Plugin „Kindle hi-res thumbnails“ setzt sie) | Datei ersetzen + Vorschau nachliefern; über „Send to Kindle“ kommt das eingebettete Cover an | „experimenteller Browser“, sehr eingeschränkt |
| **Tolino** | aus der Datei | Datei ersetzen | Browser vorhanden, einfach |

Erste Aufgabe des Plans ist deshalb **eine Messreihe, nicht ein Bau**: je Gerät eine EPUB mit getauschtem Cover kopieren und sehen, was die Bibliothek zeigt. Julian hat den PocketBook; für Kobo/Kindle/Tolino braucht es Leihgeräte oder Freunde (die Freunde aus 5.10a).

## 3. Drei Wege zum Feature, und wofür jeder taugt

**A. Die Desktop-App bleibt der Weg für Calibre-Nutzer** (5.16a/b, gebaut). Sie kennt die Bibliothek, schreibt sicher, kennt den PocketBook. Für andere Reader fehlt nur ein zweiter `reader.ts` (Kobo: `.kobo-images`; Kindle: `system/thumbnails`). **Reichweite:** Julian und Calibre-Nutzer mit Mac. Kein Website-Feature.

**B. „Cover tauschen“ im Browser, ohne Upload — das eigentliche Feature.** Auf der Buchseite steht beim gewählten Cover ein dritter Weg neben „Get this printing“: *Put this cover on your copy*. Der Leser zieht seine EPUB in den Browser; **die Datei verlässt den Browser nie** — JSZip öffnet sie, das Paket-Manifest zeigt auf das Cover-Bild, das Bild wird durch das gewählte (über `/img`, in voller Größe) ersetzt, die EPUB neu gepackt und als Download angeboten. Server: nichts, außer dem Bild, das er ohnehin liefert. Das ist dasselbe Vertrauensmuster wie Goodreads-Export und Regalfoto („die Datei bleibt auf deinem Gerät“).
- Dann **je Reader ein Satz**, was zu tun ist (aus §2): „Copy it to the reader; the reader makes a new thumbnail from the file. Kindle: send it with Send to Kindle.“ Für PocketBook ehrlich: „Your reader treats the changed file as a new book; progress and highlights stay with the old one.“
- **Grenzen:** DRM-Dateien (Adobe, Kindle AZW/KFX) kann niemand öffnen — der Knopf sagt es, statt zu scheitern; MOBI/AZW3 später; eine EPUB ohne `cover`-Eintrag bekommt einen (die häufigste Reparatur).
- **Analytik:** ein Knopf, kein Shop; `originOf` unberührt; ein Zähler „Cover getauscht“ ohne Buch und ohne Datei (Regel 6), Satz für die Datenschutzerklärung von Julian.

**C. Eine E-Reader-Ansicht der Seite** (`?view=ink` oder Erkennung am User-Agent `PocketBook`, `Kobo`, `Kindle`): serverseitig gerendert, ohne JavaScript, Graustufen-tauglich (keine Farbkontraste als einzige Information, Rahmen statt Schatten), große Tippflächen, **12 Cover je Seite mit Blättern** statt der 300-Cover-Wand mit Nachladen, kein Lazy Loading, keine Übergänge. **Aber:** auf dem Reader selbst kann die Ansicht das Cover nicht in die Datei bringen — der Browser dort hat keinen Dateidialog (zu prüfen) und keinen JSZip-tauglichen Speicher. Die Ansicht taugt zum **Aussuchen**, nicht zum Aufspielen. Deshalb gehört zu C ein **„Merken“**: der Leser wählt auf dem Reader das Cover, es landet in seiner Sammlung (5.13, `bb_visitor`, Sammlung „Covers to apply“), und am Rechner (B oder A) steht die Liste bereit. Auf dem PocketBook-Browser kann die Seite zusätzlich das Bild als PNG anbieten — der Leser speichert es, aber ohne Werkzeug am Rechner nützt es ihm nichts; keine falsche Hoffnung in den Text.

**Empfohlene Reihenfolge:** erst **B** (das Feature, das jeder Leser mit Rechner nutzen kann, sechs Stunden), dann die Messreihe aus §2 mit B als Werkzeug, dann **C** nur, wenn Julians PocketBook-Browser die Seite überhaupt lädt (eine Stunde Messen vor jeder Stunde Bauen).

## 4. Wie B gebaut würde

1. `lib/epubcover.ts` (pur, Browser-tauglich): EPUB öffnen (`jszip`), `META-INF/container.xml` → OPF → `<meta name="cover">` oder `properties="cover-image"` → Bildpfad; Bild ersetzen (JPEG; Größe nach Readern: 1600 × 2400 reicht, Calibres eigene Grenze 1650 × 2200), fehlenden Eintrag anlegen; neu packen mit `mimetype` unkomprimiert zuerst (sonst lehnen Reader die Datei ab). Tests gegen drei kleine Fixture-EPUBs (EPUB 2 mit `meta cover`, EPUB 3 mit `cover-image`, eine ohne Cover) unter `lib/__fixtures__/epub/`.
2. `components/CoverSwap.tsx`: Drop-Zone in der Seitenleiste unter den Shops, nur mit gewähltem Cover; Verlauf (Datei lesen → Cover holen → packen) mit Sätzen, nie Prozent; Download `<Titel> – <Verlag Jahr>.epub`. Bekannte Browser-Grenzen: `<a download>` ist im Browser-Bereich nicht prüfbar (umgang.md §5) — mit `curl` prüfen, am Ende Julian von Hand.
3. Je Reader ein Absatz (§2), aus einer Liste in `lib/readers.ts`, übersetzt; **kein** „works on every reader“.
4. Datenschutzerklärung: ein Satz („the file stays in your browser“), Julian nimmt ihn ab. SPEC F-Nummer für „Cover tauschen“, Roadmap-Item, Features-Zeile.
5. Messung vor „fertig“: eine EPUB aus Julians Calibre (Kopie) mit neuem Cover auf den PocketBook kopieren, Bibliothek ansehen; dasselbe mit einer frischen Datei (neues Buch) und mit Ersetzen am gleichen Pfad (altes Vorschaubild?).

Aufwand B: ein Tag Claude plus Julians Gerätetest. C: ein halber Tag Messen, dann ein bis zwei Tage.

## 5. Was C wissen muss, bevor es gebaut wird

- Lädt der PocketBook-Browser `buyitscovers.com` (TLS, Schriften, 300 Bilder)? Wie lange? Was an `next dev` über das LAN gemessen werden kann (Dev-Server an die LAN-Adresse binden, nur für die Messung, danach zurück).
- User-Agent-Strings der Geräte (PocketBook: „PocketBook“; Kobo: „Kobo“; Kindle: „Kindle“) — am Gerät lesen, nicht raten; die Erkennung bleibt ein Vorschlag (`?view=ink` als Link), kein Zwang, damit niemand in einer abgespeckten Ansicht festsitzt.
- Welche Seiten: Suche, Buchseite als Blätterwand, Sammlung; nicht das Spiel, nicht das Shelf-Portrait, nicht die Foto-Wege.
- Caching: eine serverseitige Ansicht ohne Cookie kann ISR nutzen; mit „Merken“ (Cookie) nicht — dann zwei Seiten, oder Merken als Formular-POST.

## 6. Risiken und was der Plan nicht verspricht

- Kein Reader bekommt das Cover „automatisch“; jeder Satz nennt den Handgriff.
- PocketBook: der Verlust von Lesestand bei Dateitausch ist real und steht im Text; die PNG-Lösung (A) bleibt die einzige für angefangene Bücher.
- DRM bleibt draußen, offen gesagt.
- Rechte: die Seite schreibt nichts in fremde Dateien auf dem Server; Julian entscheidet, ob ein Werkzeug, das es im Browser tut, ihm wohl ist (§7).

## 7. Julian entscheidet

1. B bauen (Browser-Tausch ohne Upload), vor C?
2. Für welche Formate zuerst: nur EPUB?
3. Die Rechtefrage zu B: Katalogbild in die private Kopie des Lesers — in Ordnung, oder erst Rücksprache (recht-hobbyseite.md §?)?
4. Messgeräte: wer hat Kobo, Kindle, Tolino?
5. C: nur wenn der PocketBook-Browser die Seite lädt — misst Julian das einmal (eine Minute: Adresse eintippen, Zeit stoppen)?
