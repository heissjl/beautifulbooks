# lab/movie-posters — dasselbe für Filmplakate, mit Weg zum Druck

**Roadmap:** 5.20. **Status:** Idee und Recherche 2026-10-06 (Julian: „lab idea: das ganze für movie poster, mit funnel zum print bestellen. schau mal ob es eine DB für filme gibt, die mehrere poster scans hat"). Nichts gebaut, nichts gemessen, keine API angefragt.

## Frage

Gibt es eine Filmdatenbank, die je Film **mehrere** Plakate führt (Länder, Wiederaufführungen, Teaser) — so wie Open Library je Werk mehrere Ausgaben mit Umschlag — und lässt sich von einem gewählten Plakat **legal** zu einem Druck führen?

## Quellen (Recherche, nicht gemessen)

| Quelle | Mehrere Plakate je Film? | Zugang | Darf eine Seite mit Affiliate-Links sie nutzen? |
|---|---|---|---|
| **TMDB** (`/movie/{id}/images`) | ja: `posters[]` mit `iso_639_1`, Breite, Höhe, Stimmen; Filter `include_image_language` (max. 5 Sprachen) | freie API mit Schlüssel | **Nein ohne Lizenz.** Frei nur nicht-kommerziell mit Nennung; eine „destination site", die mit TMDB-Inhalten Verkehr und Umsatz erzeugt, braucht eine kommerzielle Lizenz (Preis auf Anfrage). TMDB beansprucht keine Rechte an den Bildern — es kann also auch keine weitergeben. |
| **fanart.tv** (`movieposter`) | ja, mit Sprache und Likes; überwiegend Fan-Gestaltungen, nicht nur Originale | freier API-Schlüssel | Bedingungen nicht gefunden; offen |
| **ThePosterDB** | ja, aber fast nur **Fan-Plakate** für Plex | **keine öffentliche API**, nur Scraping mit Konto | nein — falsches Material und kein Zugang |
| **IMP Awards** (impawards.com) | ja: offizielle Plakate inkl. internationale Fassungen und Wiederaufführungen, ab 1912 | **keine API**, nur HTML | Scraping eines Privatarchivs; nein |
| **eMoviePoster** (Auktionshaus) | ja: **1,64 Mio. Auktionsergebnisse** mit unbearbeiteten Scans **echter Original-Plakate**, nach Land und Format | keine API bekannt | Scans gehören dem Auktionshaus; aber es **verkauft das Original** — siehe unten |
| **Wikimedia Commons / Wikidata** | wenige je Film, nur gemeinfreie (USA: vor 1929 oder ohne Copyright-Vermerk) | offene API | **ja**, und gemeinfreie Plakate dürfen gedruckt werden |
| IMDb, OMDb, Letterboxd, Trakt | ein Plakat je Film bzw. TMDB-Bilder | — | trägt die Idee nicht |

Kein Treffer ist ein Open-Library-Gegenstück: **frei, kommerziell nutzbar und mit vielen Plakaten je Film** gibt es nicht. TMDB hat die Daten, aber nicht die Erlaubnis.

## Der Bruch in der Idee: „Print bestellen"

Bei Büchern verlinkt die Seite eine Ausgabe, die ein Laden verkauft; sie vervielfältigt nichts. **Ein Plakat-Scan als Druck auf Bestellung ist eine Vervielfältigung eines urheberrechtlich geschützten Werks** (Plakatkunst, Fotos, Schauspielerbild). Das geht nur bei:

1. **Gemeinfreien Plakaten** (Commons) — dann darf die Seite selbst drucken lassen (Print-on-Demand-Partner). Kleiner Bestand, alte Filme.
2. **Lizenzierten Nachdrucken** eines Händlers — Affiliate wie bei Büchern. Gefunden: Displate (Lizenzen u. a. Disney, Star Wars, Marvel; Affiliate 3,2–7,2 %, 30 Tage), GB Posters (offiziell lizenziert, 10 % über Awin). Posterlounge, Juniqe u. a. nicht geprüft.
3. **Dem Original selbst** — eMoviePoster, Heritage, eBay. Das ist das genaue Gegenstück zu „Buy Its Covers": *diese* Druckfassung kaufen, nicht irgendeine.

Was fehlt, ist das Gegenstück zur ISBN: **ein Plakat hat keine Kennung.** Ob ein lizenzierter Nachdruck dieselbe Fassung ist wie der Scan, kann nur ein Bildvergleich sagen (`lib/imagehash.ts` wäre der Anfang). Ohne ihn verspricht der Link ein Plakat, das der Händler vielleicht nicht hat — genau der Fehler, den die Seite bei Büchern vermeidet (E8, §9.2).

## Was zu messen wäre, bevor etwas gebaut wird

1. **Wie viele Plakate je Film hat TMDB wirklich?** Zwanzig Filme quer durch Jahrzehnte (wie die fünf Abnahmesuchen), Anzahl gesamt, je Sprache, Anteil Fan-Uploads. Erst mit nicht-kommerziellem Schlüssel, nur lokal.
2. **Was kostet die kommerzielle TMDB-Lizenz?** Anfrage an TMDB — **Julian**.
3. **Wie viele Plakate eines Films führt ein lizenzierter Händler, und trifft einer davon einen TMDB-Scan?** Zehn Filme bei Displate und GB Posters, Treffer per dHash.
4. **Für wie viele Filme hat Commons mindestens zwei gemeinfreie Plakate?** (Wikidata-Abfrage.)

Erfolg: ein Film, für den die Seite ≥ 10 Plakate zeigen und für ≥ 1 davon einen legalen Kaufweg nennen kann, der *dieses* Plakat liefert.
