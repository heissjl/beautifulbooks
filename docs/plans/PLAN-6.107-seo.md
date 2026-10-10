# PLAN 6.107 — Auffindbarkeit für eine junge Seite

Julian, 2026-10-10, zum Red-Team-Befund K4: „ok, mache einen plan zur umsetzung“, dann: „ich glaube man kann hier noch nicht viel messen, weil wir kaum traffic haben. eher nochmal eine webrecherche machen, was wichtig für kleine neue seiten ist“. **Neu gefasst nach der [Recherche vom 2026-10-10](../seo-recherche-2026-10-10.md)**, die erste Fassung (Messen zuerst, Autorenseiten, mehr Einstiege) ist überholt.

**Status:** Plan. Schritte 1–3 kann Claude ohne Entscheidung bauen; Schritt 4 entscheidet Julian; Schritt 5 ist Julians Hand.

## 1. Was die Recherche verschiebt

- **Google bewertet die ganze Seite.** Viele schwache, datengetriebene Seiten früh im Index können der jungen Domain schaden (Mueller, Sept. 2026: programmatische Seiten „often … spam, borderline spam, or low quality“, Erholung „takes time“). Die Sitemap listet heute **500 Buchseiten und 322 Jahrzehnte-Seiten** neben ~60 Sammlungen — die Gewichte stehen falsch herum.
- **Das Kapital sind die Sammlungen**: eigener Text, eigene Auswahl, Credits. Sie sind die Hub-Seiten; Buchseiten hängen darunter.
- **Messen geht noch nicht** (Julian): zu wenig Verkehr für Zahlen über Anfragen. Was trotzdem geht: die **Indexquote je Seitentyp** in der Search Console — ob Google die Seiten überhaupt aufnimmt, braucht keine Besucher.
- **Die deutsche Fassung ist für Google unsichtbar** (Cookie unter derselben Adresse); das ist eine Entscheidung, kein Fehler, solange sie bewusst ist.
- `lastmod: now` in der ganzen Sitemap ist wertlos (Google) und falsch (Bing).

## 2. Die Schritte

**1. Sitemap auf das Starke beschränken, mit echtem `lastmod` (2 h, Claude).**
- Drin: Start, About, `/collections`, jede veröffentlichte Sammlung, und **nur die Buchseiten der Werke, die in einer veröffentlichten Sammlung stehen** (die Sammlung verleiht ihnen Kontext). Jahrzehnte-Seiten nur für diese Werke.
- Draußen: die übrigen Index-Werke und ihre Jahrzehnte-Seiten (sie bleiben erreichbar und verlinkt — Google findet sie über Links, wenn es will; wir drängen sie nur nicht auf), das Spiel, Kontakt, Datenschutz.
- `lastmod`: für eine Sammlung das Datum ihrer letzten Änderung (der Entwurf trägt `updatedAt`; die Datei das Commit-Datum), für eine Buchseite das der Sammlung, für die festen Seiten das Datum der letzten Textänderung (eine Konstante im Code, die beim Ändern mitzieht). Nie „jetzt“.
- Nicht `noindex` auf die übrigen Buchseiten setzen: sie haben eigene Leistung (Faltung, Urteil) und sollen findbar bleiben, wenn jemand auf sie verlinkt. Die Recherche rät zu weniger *Drängen*, nicht zu Verstecken.

**2. Die Sammlungen als Hub-Seiten (halber Tag, Claude; Texte Julian).**
- `<title>` und `description` so, wie gesucht wird: Reihe, Zahl, Zeitraum, Gestalter („SF Masterworks: the 73 covers of the first run, 1999–2007“). Die Zahl ist die gezählte.
- Ein paar Sätze eigener Text oben — die meisten Sammlungen haben ihn schon (`intro`); wo er fehlt, schreibt Julian ihn (Liste der Sammlungen ohne Intro aus `data/collections.json`).
- Jede Buchseite eines Werks in einer Sammlung verlinkt zurück („In SF Masterworks, No. 12“) — 6.9, nur dieser Teil.
- Strukturierte Daten `CollectionPage` mit `ItemList`.
- „See also“ zu zwei, drei verwandten Sammlungen, aus einem Feld `related`, von Julian gesetzt.

**3. Bild-SEO für die Cover (2 h, Claude).**
- Alt-Text jedes Covers auf Sammlungs- und Buchseiten: Titel, Verlag, Jahr, Gestalter wo gesichert („The Forever War, Millennium 1999, cover by Chris Moore“). Heute prüfen, was `alt` trägt.
- Bildunterschrift mit dem Credit, wo er steht (Sammlungen haben `Cover: …` schon).
- Bild-Sitemap für die Sammlungsseiten (`image:image` mit den Cover-URLs; fremde Domains sind erlaubt).
- `ImageObject` mit `creditText` nur bei gesichertem Credit; **nie** `license` oder `acquireLicensePage` — die Seite hält keine Rechte.

**4. Die Sprachfrage (Julian entscheidet).**
- (a) **Bewusst nur Englisch im Index** — so wie heute; nichts zu tun außer es in SPEC E23 festzuhalten. Die deutschen Leser kommen über Links und Teilen, nicht über die Suche.
- (b) **`/de/…` öffentlich mit `hreflang`** — jede Seite hat eine deutsche Adresse, beide tragen `hreflang="en"`/`"de"` und `x-default`, das Cookie wählt nur noch, wohin der Sprachschalter führt; keine automatische Umleitung nach `Accept-Language`. Das ersetzt den Spiegelbaum nicht, sondern macht ihn sichtbar; Aufwand ein Tag, und die Sitemap verdoppelt sich (dann wieder Schritt 1 bedenken). Lohnt nur, wenn deutsche Suchen ein Ziel sind.
- Empfehlung: (a) jetzt, (b) wenn deutsche Sammlungen (edition suhrkamp, Insel) Leser bringen sollen.

**5. Anmelden und Indexquote ansehen (Julian, 20 min).**
- Search Console (schon verifiziert?) und **Bing Webmaster Tools** (Import aus der Search Console geht in einem Schritt) — Sitemap einreichen.
- In drei Wochen: Indexquote je Seitentyp (Sammlungen, Buchseiten, Jahrzehnte). Bleiben Sammlungen draußen, ist das ein Qualitätssignal für die ganze Seite.

**6. Crawler prüfen (1 h, Claude).**
- `OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot` stehen heute in `BOUNDED_CRAWLERS` (nur kuratierte Buchseiten, 10 s Abstand) — für die *Such*-Crawler (anders als `GPTBot`, `CCBot`, die trainieren) ist das zu eng, wenn die Seite in KI-Antworten zitiert werden soll: Such-Bots bekommen die allgemeinen Regeln, Trainings-Bots bleiben begrenzt. Julian entscheidet, ob Training ganz gesperrt wird.
- Prüfen (K14, `/admin/insights`), ob Bingbot oder OAI-SearchBot je eine Vercel-Challenge bekamen.

**7. Erwähnt werden (Julian, laufend).** Je Sammlung eine Gemeinschaft oder ein Blog, wo sie Thema ist; Gestalter und Verlage auf ihre Wand hinweisen. Kein Linktausch, keine Verzeichnisse, kein llms.txt.

## 3. Was nicht gemacht wird

Keine Schlagwort-Seiten, keine Autorenseiten mit eigener Adresse (vorerst — sie vervielfachen dünne Seiten), kein llms.txt, keine KI-Schema-Tricks, kein `license` an fremden Covern, kein Feinschliff an Core Web Vitals, keine Vollständigkeitsworte.

## 4. Julian entscheidet

1. Sprachfrage: (a) nur Englisch im Index, oder (b) `/de/` öffentlich mit `hreflang`?
2. Such-Crawler der KI-Dienste auf die allgemeinen Regeln heben, Trainings-Crawler begrenzt lassen oder sperren?
3. Bing Webmaster Tools anmelden?
4. `related` je Sammlung und die fehlenden Intros: wann?
