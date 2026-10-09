# haiku.zone — was wir davon lernen können

Angesehen am 2026-10-08 auf Julians Hinweis (ROADMAP 6.101). Quellen: eine geteilte Reise
(`haiku.zone/journey/c0947ae…`), die Startseite, eine Suche nach *The Great Gatsby*, und der
Beitrag des Machers Joe Weisenthal auf X vom selben Tag.

## Was die Seite tut

- **Ein Feld, ein Ding:** „An album, a book, an artist, an article of clothing…“. Nach der Eingabe
  eine Auswahl „Choose the thing you mean“ mit Art und Jahr (Film 1974, Buch 1925, Sammlerstück
  „First Edition“) — die Mehrdeutigkeit wird vor dem Ergebnis aufgelöst, nicht danach.
- **Ergebnis als „Galaxie“:** das Ding in der Mitte, acht Nachbarn aus *anderen* Gattungen drumherum
  (für Gatsby: Knott's Berry Farm 1920, *Niagara* 1953, Millays *Harp-Weaver* 1923, Ferragamo-Keile
  1930, Givenchy *L'Interdit* 1957, Ford Skyliner 1957, ein Hotel, ein Tanya-Tucker-Album). Daneben
  eine Liste und Filter nach Gattung.
- **Reise:** von jedem Nachbarn „Explore from here“; der gegangene Pfad wird nummeriert (01–05) und
  ist als eigene Adresse teilbar („Share journey“, „Keep this whole path“, „Start your own journey“).
- **Kein Konto:** „Saved things“ mit Zähler.

## Wie es gebaut ist (laut Weisenthal)

Große Listen von Dingen; ein Modell fasst das *Wesen* jedes Dings in eine Reihe Haikus — die Form
beschränkt die Ausgabe und erzwingt Bildsprache —, und erst die Haikus gehen in ein
Embedding-Modell. Ähnlichkeit ist dann Nähe der Haikus, nicht der Metadaten. Darum landet Gatsby bei
Parfum und Autos derselben Stimmung, nicht bei anderen Romanen der Zwanziger.

## Was davon zu uns passt

1. **Der Trick selbst: erst verdichten, dann einbetten.** Unser „sieht so aus“ (6.10) misst Farbe
   und Struktur und findet für 89 % der Cover keinen Nachbarn; 6.23 (b) wollte ein vortrainiertes
   Bild-Embedding. Der Umweg über Text wäre eine dritte Achse: ein Modell beschreibt ein *Cover*
   in drei Haikus oder fünf Zeilen (Motiv, Stimmung, Typografie, Epoche), die Beschreibung wird
   eingebettet. Das trifft „Cover mit derselben Haltung“, was Pixel nicht können — und ist
   ausdrücklich **nicht** die Faltung (dieselbe Gestaltung); dafür bleibt es bei dHash und 6.23.
   Kosten: einmal je Cover im Index-Bau, offline wie `data/cover-index.json`, nie im Request;
   Preis aus `lib/insights/prices.ts`, vorher an 50 Covern von Hand ansehen (Regel aus 6.10:
   Schwellen durch Hinsehen).
2. **Die Reise als teilbare Adresse.** Ein Pfad von Cover zu Cover („von *Dune* 1965 zu …“) ist
   dasselbe Muster wie das Shelf-Portrait: Zustand in der Adresse, nichts gespeichert, ein Satz zum
   Teilen. Passt zu den ähnlichen Covern und zu den Sammlungen, braucht aber erst mehr Nachbarn
   (Punkt 1).
3. **Mehrdeutigkeit vor dem Ergebnis.** „Choose the thing you mean“ mit Art und Jahr ist genau, was
   6.94 und F1.7 fehlt: lieber drei Kandidaten mit Autor und Jahr als ein Fremdtreffer.
4. **Was wir nicht übernehmen:** die Gattungsgrenzen auflösen (wir sind eine Cover-Seite, kein
   Geschmacksorakel), die dunkle Sternenhimmel-Optik (docs/gestaltung-ki-anmutung.md), und
   Nachbarn ohne Begründung — haiku.zone zeigt nicht, *warum* Gatsby neben dem Ford steht. Bei uns
   müsste ein Nachbar seinen Grund sagen können (unsere Vertrauensregel: nichts behaupten, was nicht
   geprüft ist).

## Vorschlag

Ein Lab-Experiment `lab/haiku/` (6.101): 200 Cover aus dem Index, je eine Beschreibung in fester Form
durch ein Modell, Text-Embedding, und ein Kontaktbogen der nächsten Nachbarn neben denen aus 6.10.
Frage: findet die Textachse Paare, die Julian „gehören zusammen“ nennt und die Farbe/Struktur nicht
finden? Erst messen, dann über die Seite reden.
