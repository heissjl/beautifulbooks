# PLAN 6.107 — Auffindbarkeit ohne neuen Inhalt

Julian, 2026-10-10, zum Red-Team-Befund K4 („die Suche als Einstieg verliert gegen Google“): „ok, mache einen plan zur umsetzung“.

**Status:** Plan. Schritt 0 wartet auf die Search Console (2.16); Schritte 1–3 können davor beginnen, Schritt 4 danach.

## 1. Die Lage

Niemand sucht „covers of Mrs Dalloway“; wer das Buch sucht, landet bei Amazon. Was gesucht wird, sind **Reihen, Jahrzehnte, Gestalter, Autoren**: „SF Masterworks covers“, „Penguin Classics covers 1960s“, „Chris Moore cover art“, „Ursula Le Guin book covers“. Für genau das hat die Seite schon Seiten — Sammlungen, Jahrzehnte-Seiten, Autorenseiten, die Buchseite —, aber ihre Titel und Beschreibungen sind aus der Sicht der Seite formuliert, nicht aus der Sicht dessen, der sucht. Und die Buchseite trägt bei manchen Werken einen Titel, den kein Suchender tippt (U1: kyrillisch).

Nichts hier erzeugt Inhalt; alles ordnet, was da ist. Regel wie überall: kein „every“, kein „all“, kein Versprechen, das die Seite nicht hält (SPEC §9.3 Schritt 15).

## 2. Die Schritte

**0. Messen, bevor geschnitten wird (2.16, Julian).** Search Console lesen: welche Anfragen bringen Eindrücke, welche Seiten erscheinen, mit welcher Position. Drei Wochen nach dem Umzug auf die Domain sind um. Ohne diese Zahlen ist jeder Schritt unten eine Vermutung; mit ihnen weiß man, ob Sammlungen oder Buchseiten zuerst dran sind.

**1. Sammlungsseiten als Antworten auf Suchanfragen (halber Tag, Claude).**
- `<title>`: „SF Masterworks: the 73 covers of the first run (1999–2007)“ statt „SF Masterworks · Buy Its Covers“ — Reihenname, was man sieht, Zeitraum. Die Zahl ist die gezählte, nicht „all“.
- `description`: ein Satz, der die Frage beantwortet, die jemand stellt („Which covers did the SF Masterworks have, and who painted them?“), mit den Gestalternamen, die in den Credits stehen.
- Strukturierte Daten: `ItemList` mit den Büchern (Name, Autor, Bild), damit die Sammlung als Liste erscheinen kann; `CollectionPage` als Typ.
- Eine Zeile „See also“ am Fuß: die zwei bis drei verwandten Sammlungen (Relaunch ↔ erste Reihe, Feminist Press ↔ Virago), aus einem Feld `related` in `data/collections.json`, von Julian gesetzt — keine Automatik, die Unsinn verlinkt.

**2. Jahrzehnte-Seiten und Autorenseiten als Einstiege (halber Tag, Claude).**
- Jahrzehnte-Seite: Titel „1984 by George Orwell: its covers by decade, 1949 to today“; `description` nennt die Jahrzehnte mit den meisten Covern. Die Seite existiert nur für Werke über der Schwelle (R6), das bleibt.
- Autorenseite (`/?author=`): heute eine Suchansicht mit `noindex`? Prüfen. Wenn sie indexierbar werden soll, braucht sie eine eigene Adresse (`/author/<key>`), einen Titel („Books by Ursula K. Le Guin, by their covers“), ISR wie die Buchseite und einen Platz in der Sitemap — das ist 6.9 („Mehr von diesem Autor“) in anderer Form. Erst nach Schritt 0, weil es Seiten vervielfacht; Google straft dünne Seiten (best-practices-2026-09-12.md A2).

**3. Die Buchseite spricht die Sprache des Suchenden (6.2, halber Tag, Claude).**
- `<title>` und `h1` aus der Ausgabe in der Sprache des Lesers, wenn es eine gibt (*The Master and Margarita* statt «Мастер и Маргарита»); der Katalogtitel bleibt als zweite Zeile und in den strukturierten Daten als `alternateName`. Ohne solche Ausgabe: Transkription als Rückfall (eine Stunde, Tabelle in `lib/`).
- Dasselbe für den Autor und die Beschreibung; „More by“ ebenso.
- Das ist zugleich U1 aus dem Usability-Durchgang; die Analytik-Regel 4 greift (die Signale lesen den `data-results`-Block, nicht den Titel — prüfen).

**4. Interne Verlinkung (6.9, ein Tag, Claude, nach Schritt 0).** Von der Buchseite zur Sammlung, in der das Werk steht („In the collection SF Masterworks, No. 12“), zur Jahrzehnte-Seite (gibt es), zu „More by“ (gibt es). Von der Sammlung zur Buchseite (gibt es). Von der Startseite zu den Sammlungen (gibt es) — und die Frage aus K2, ob die Startseite mit Sammlungen führt, entscheidet Julian getrennt (6.108).

**5. Sitemap und Robots prüfen (eine Stunde).** Sammlungen, Jahrzehnte-Seiten, kuratierte Buchseiten mit `lastmod`; `/c/`, `/versus`, `/shelfportrait/<id>` bleiben `noindex`; Bilder: `image:image` in der Sitemap für die Sammlungs-OG-Bilder, damit die Bildersuche sie findet (die Bildersuche ist für „cover art“-Anfragen der Weg).

## 3. Was nicht gemacht wird

- Keine Seiten je Schlagwort („red book covers“, 5.4b–e), keine Reihen-Vergleichsseiten ohne Kuratierung: dünne Seiten schaden.
- Keine Texte, die Vollständigkeit behaupten.
- Keine Keyword-Wiederholung in Beschreibungen; ein Satz, der die Frage beantwortet.

## 4. Messen

Search Console vor Schritt 1 (Stand), vier Wochen nach Schritt 3 (Eindrücke je Seitentyp, Klickrate der zehn häufigsten Anfragen). Die Zahlen gehen in docs/history.md; eine Änderung, die nach vier Wochen nichts bewegt hat, wird nicht erweitert.

## 5. Julian entscheidet

1. Schritt 0 selbst lesen oder Claude mit Zugang (`docs/prompt-search-console.md`)?
2. Autorenseiten mit eigener Adresse (Schritt 2) — ja, aber erst nach den Zahlen?
3. `related` je Sammlung: wer setzt die Verweise?
