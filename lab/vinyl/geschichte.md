# Woher die Geschichte zu jeder Hülle käme

Julian, 2026-09-29: „aber woher bekommen wir die geschichte zu jeder hülle". Gemessen an den 24 Hüllen der acht Alben (Faltung bei dHash ≤ 20) mit [`story.ts`](story.ts); Daten aus MusicBrainz, dem Discogs-Dump (dritter Durchgang mit Credits und Anmerkungen), Wikidata und Wikipedia.

## Ergebnis

Die Geschichte einer Hülle setzt sich aus vier Schichten zusammen. Drei davon gibt es maschinell, und alle drei sind frei nutzbar; die vierte, die eigentliche Erzählung, gibt es für das Original, für die Varianten fast nie.

| Schicht | Quelle | Lizenz | Abdeckung (24 Hüllen) | Was sie sagt |
|---|---|---|---|---|
| **1 · Zeitleiste** | unsere eigenen Daten: die gefalteten Pressungen | — | **24 von 24** | erstes und letztes Jahr, Länder, Labels, Zahl der Pressungen: „Fontana, 1960–1961, UK, Niederlande, Frankreich, 5 Pressungen" |
| **2 · Credits** | MusicBrainz (Beziehungen *design*, *illustration*, *photography*, *art direction*) und Discogs (Rollen *Design*, *Photography By [Cover]*, *Painting [Coverpainting]* …), verbunden über den Discogs-Link je Release | beide CC0 | **15 von 24** (MB 8, Discogs 13) | wer: „Photography By [Cover Photo]: Jay Maisel", „Painting [Coverpainting]: Emil Schult", „Cover Art: Cedric Hervet, Warren Fu" |
| **3 · Anmerkungen** | Discogs `notes`, Freitext der Bearbeiter | CC0 (Teil des Dumps) | **21 von 24** nennen die Hülle | was anders ist: „Dutch issue with unique cover photography and orange CBS labels" (*Kind of Blue*, NL 1964, Foto Carel de Vogel), „This UK release has a 'Motorway logo' sleeve design" (*Autobahn*, Vertigo 1974), der „Adderly"-Druckfehler aller US-Six-Eye-Pressungen |
| **4 · Erzählung** | Wikipedia, Abschnitte *Artwork*, *Packaging*, *Art direction* | CC BY-SA 4.0 (Namensnennung, Weitergabe unter gleicher Lizenz) | **6 von 8 Alben**, fast nur zum Original | warum: Thorgersons Prisma aus einem Physikbuch von 1963, das Baby von *Nevermind* und Geffens geplante Ersatzhülle, das britische Autobahnschild, das später Standard wurde, die sieben Alternativhüllen von *folklore*; *Kind of Blue* und *Autobahn* ohne eigenen Abschnitt, *Kind of Blue* ohne einen Satz zur Hülle |

Wikidata hilft kaum: „cover art by" (P736) hat nur *Dark Side* (Hipgnosis). Drei Hüllen haben nur die Zeitleiste — alle drei von *Kind of Blue*: Japan 1959, die blau eingefärbte Jazz-Masterpieces-Fassung 1987/1990, Melodija 1993.

## Wie gut die Anmerkungen sind

Von den 1.981 Vinyl-Pressungen der acht Alben bei Discogs tragen **1.080 (55 %) einen Hüllen-Credit** und 1.252 eine Anmerkung, die die Hülle erwähnt. Die meisten Anmerkungen sind Herstellungsangaben („Printed in England by Robor Limited", „Released in a gatefold sleeve", Aufkleber, Katalognummer auf dem Rücken) — gut für Sammler, keine Geschichte. Ausdrücklich „andere Hülle" sagen nur 19 (Suchmuster *different/unique/alternate cover*): etwa „This version has a different sleeve design" (Philippinen 1973), „Released Previously Under A Different Cover As SMAS-11163" (USA 1978). Viele dieser abweichenden Hüllen haben im Cover Art Archive kein Bild.

## Was daraus folgt

- **Zeitleiste und Credits lassen sich für jede Hülle automatisch zeigen**, als Zeile unter der Kachel oder in der Seitenleiste: „Columbia · 1959–2025 · 42 Pressungen in 6 Ländern · Foto Jay Maisel". Beides CC0, beides nachprüfbar.
- **Anmerkungen gehören gefiltert in die Seitenleiste der Pressung**, nicht auf die Wand: nur die Sätze, die über die Hülle sprechen, mit Quelle „Discogs". Die meisten sind Sammlerdetails.
- **Die Erzählung zum Original** kann aus Wikipedia kommen: ein, zwei Sätze in eigenen Worten mit Link und Nennung, oder ein Zitat unter CC BY-SA.
- **Die Erzählung zu den Varianten gibt es nirgends fertig.** Sie müsste geschrieben werden — von Julian wie die kuratierten Sammlungen, oder als Entwurf aus Zeitleiste, Credits und Anmerkungen, den Julian prüft. Ein Entwurf darf nichts behaupten, was diese drei Quellen nicht hergeben (dieselbe Regel wie beim Verdikt: nie mehr sagen, als geprüft ist).
