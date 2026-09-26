# lab/shelf — vom Foto des eigenen Regals zur teilbaren Sammlung

Julian, 2026-09-26: „setup lab project: take a picture of your own books, the website fetches the works with the covers and sets up a shareable link of a collection". Roadmap **5.11**. Stand: **Idee, Ordner angelegt, nichts gebaut.**

## Die Frage

Kann ein Foto — ein Regal mit Buchrücken oder ein Stapel mit Umschlägen — zuverlässig genug in Werke und **die abgebildeten Ausgaben** übersetzt werden, dass daraus ohne Nacharbeit eine Wand wie eine Sammlung wird, mit einem Link, den man teilen kann?

## Ablauf, wie er gedacht ist

1. **Foto hochladen** (Telefon oder Rechner).
2. **Erkennen:** je Buch Titel und Autor, dazu der Bildausschnitt (Rücken oder Umschlag).
3. **Zuordnen:** je Treffer das Open-Library-Werk über die vorhandene Suche (`lib/search.ts`, eine Open-Library-Anfrage, kein Google).
4. **Ausgabe wählen:** liegt ein Umschlag im Bild, wird sein Ausschnitt mit den Covern des Werks verglichen (Signaturen aus `lib/imagehash.ts`, dieselben Schwellen wie das Falten), und die Wand zeigt **genau diese Ausgabe**; bei einem Buchrücken das Cover des Werks oder eine Auswahl zum Antippen.
5. **Korrigieren:** falsche Treffer wegklicken, fehlende suchen — eine kleine Fassung von `lab/collections`.
6. **Teilen:** ein Link auf eine Wand im Stil der Sammlungen (`CoverWall`), Kacheln öffnen ihr Cover (wie seit heute bei den Sammlungen).

## Offene Entscheidungen (Julian)

1. **Womit erkennen?**
   - **Ein Bildmodell** (Claude Vision über die Anthropic-API): liest auch schräge, kleine Rückenschrift und gibt Titel, Autor und ungefähre Position zurück. Braucht einen API-Schlüssel und kostet je Foto wenige Cent; das Foto geht an einen Dienst. **Vorschlag.**
   - **Texterkennung (OCR) im Browser** (z. B. Tesseract.js): kostenlos, das Foto bleibt auf dem Gerät, aber auf Buchrücken erfahrungsgemäß schwach (senkrechte Schrift, Schmuckschriften).
   - **Barcode/ISBN von der Rückseite:** exakt die Ausgabe, aber man muss jedes Buch umdrehen.
   - Google Cloud Vision scheidet aus, solange das Google-Kontingent knapp ist (E10).
2. **Wo liegt der geteilte Link?** Ohne Speicher (die Liste steckt komprimiert in der Adresse — nichts wird gespeichert, lange Links) oder im vorhandenen Redis (kurze Links, aber eine Liste Dritter liegt bei uns; N11, Datenschutz).
3. **Das Foto selbst:** wird nie gespeichert (Vorschlag), nur die erkannte Liste.
4. Eigene Seite der Website später (`/shelf`?) oder vorerst nur lokal im Lab.

## Woran Erfolg erkannt wird (Messung, bevor irgendetwas an die Website geht)

- Fünf echte Regalfotos von Julian (Rücken, Umschläge, gemischt; hell und schummrig).
- Je Foto: **Anteil richtig erkannter Bücher** (Werk stimmt), **Anteil richtig gewählter Ausgaben** bei Umschlagfotos, Zahl der Fehltreffer, Dauer, Kosten.
- Schwelle zum Weitermachen (Vorschlag): ≥ 80 % der Werke richtig ohne Eingriff, jede Korrektur in unter 10 Sekunden.

## Bausteine, die es schon gibt

`lib/search.ts` (Werk zu Titel + Autor), `lib/work.ts` (Cover eines Werks), `lib/imagehash.ts` (Signaturen, serverseitig), `lab/collections` (Auswahl- und Sortieroberfläche), `components/CoverWall.tsx` (die Wand), `lib/collections.ts` (Datenform einer Sammlung).

## Regeln (lab/README.md)

Kein Google aus dem Lab ohne Messung; Tests ohne Netz; nichts erreicht die Website ohne eigenen Roadmap-Punkt.
