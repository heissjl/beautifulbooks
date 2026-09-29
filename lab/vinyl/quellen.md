# Woher Pressungsdaten für Schallplatten kommen können

Recherche durch einen Agenten am 2026-09-29 (Julian: „schicke einen agenten eine deep research zu machen, wie man sonst noch an entsprechende daten kommen könnte"), ROADMAP 5.16. Nichts registriert, keine Zugangsdaten, kein Bot-Schutz umgangen. `discogs.com/developers` und `support.discogs.com` antworteten mit 403; die Discogs-Bedingungen stammen deshalb aus Zitaten in Dritt-Repos.

Markierung: **[v]** selbst abgefragt oder auf der Primärquelle gelesen · **[s]** zweite Hand · **[?]** vermutet.

## Ergebnis in einem Satz

Kein offener Katalog führt die Farbe der Platte als Feld. Der beste Weg ist der **Discogs-Dump (CC0)** für Pressungsliste und Farbtext, verbunden über die Discogs-Links in MusicBrainz mit den **Bildern des Cover Art Archive**. Discogs-Bilder selbst sind nach den Bedingungen für eine Seite mit Affiliate-Links vermutlich nicht nutzbar.

## Discogs

- **API:** mit Personal Token 60 Anfragen/min je IP, ohne 25 [s]. Volle Bild-URLs nur mit Authentifizierung [s]; deckt sich mit unserer Messung (ohne Token 150-px-Vorschau).
- **API Terms of Use** ([Original](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use), zitiert in [mpazaryna/crate#4](https://github.com/mpazaryna/crate/issues/4), [tagrex#361](https://github.com/tagrex/tagrex/issues/361)) [s]:
  - Bilder sind „Restricted Data" (Nutzeruploads): nicht an Dritte, nicht „for any commercial purposes". Ob Affiliate-Links kommerziell sind, lässt der Text offen — echtes Risiko.
  - Nichts anzeigen, das mehr als **6 Stunden** älter ist als Discogs; nicht länger cachen als nötig. Mit unserem 30-Tage-Cache unvereinbar.
  - Pflichttexte: „Data provided by Discogs" mit Link neben den Daten; „This application uses Discogs' API but is not affiliated with, sponsored or endorsed by Discogs".
  - Hotlinking: der Bildserver prüft die Herkunft, das Forum rät zum Selbstausliefern ([Forum](https://www.discogs.com/forum/thread/354867)) — im Widerspruch zur Cache-Regel [s, alt].
- **Monatliche Dumps** ([data.discogs.com](https://data.discogs.com/)): **CC0** [v], aktuell `discogs_20260901_releases.xml.gz`, 10,5 GB [v]. Formate mit `name, qty, text_string, descriptions` ([Schema discogs-xml2db](https://raw.githubusercontent.com/philipmat/discogs-xml2db/develop/postgresql/sql/CreateTables.sql)) [v] — der Farbtext ist drin. Bilder nur mit `type`, `width`, `height`, URIs absichtlich leer ([Forum](https://www.discogs.com/forum/thread/411182)) [s]: zählbar, nicht zeigbar.
- **Seite eines Bildes:** kein Typ; die Richtlinie legt die Reihenfolge Front, Back, Label A, Label B nahe ([Guidelines 13](https://support.discogs.com/hc/en-us/articles/360005006874-Database-Guidelines-13-Images)) — Heuristik, keine Garantie.
- **Farbe:** „any non-standard color of the audio carrier" gehört in den Freitext, wichtigste Farbe zuerst, Schwarz entfällt ([Guidelines 6](https://support.discogs.com/hc/en-us/articles/360005006654-Database-Guidelines-6-Format)). Fest sind nur `Picture Disc`, `Shape`, `Etched`.

## Andere Kataloge

| Quelle | Was sie hat | Zugang, Bedingungen | Urteil |
|---|---|---|---|
| **MusicBrainz / Cover Art Archive** | Pressungen, Bilder mit Typ; `Medium` ist laut [Definition](https://musicbrainz.org/doc/Cover_Art/Types) „the vinyl disc itself", praktisch das Etikett [v] | kein Limit genannt ([API](https://musicbrainz.org/doc/Cover_Art_Archive/API)) [v]; kein Farbfeld, keine Stilregel dazu [v]; Releases verlinken Discogs-Releases | Bildquelle, wie jetzt |
| **Wikidata** | MB-Release-Group-ID 244.835 Items, Discogs-Master 164.987, Discogs-Release 38.953, MB-Release 2.802 [v, SPARQL] | offen | nur Brücke Album ↔ Master |
| **Wikimedia Commons** | Albumcover „almost always" geschützt ([Regeln](https://commons.wikimedia.org/wiki/Commons:Copyright_rules_by_subject_matter)) | kein Fair Use | nein |
| **TheAudioDB** | je Album (nicht je Pressung): Front 8/8, Back 6/8 (ohne *Kind of Blue*, *Autobahn*), CD-Art 8/8 unserer Alben [v, Key `123`] | frei 30/min, Premium 100/min ([Doku](https://www.theaudiodb.com/free_music_api)); Artwork von Nutzern, Quelle nennen, DMCA-Löschung in 24 h ([Terms](https://www.theaudiodb.com/docs_terms_of_use.php)) | Rückseite und Disc-Motiv je Album als Ergänzung |
| **fanart.tv** | `albumcover`, `cdart` je Release Group [s] | Project Key Pflicht ([API](https://github.com/fanart-tv/fanart.tv-api)); Nutzer auf fanart.tv hinweisen, Rechte nicht geklärt ([Terms](https://fanart.tv/terms-and-conditions/)) | wie TheAudioDB; CD-Art sind gestaltete PNGs für Kodi, keine Fotos |
| **Spotify, iTunes, Deezer, Last.fm** | nur Front des Digitalreleases | Spotify Extended Quota erst ab 250.000 MAU ([Blog](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)); iTunes-Art nur zur Store-Werbung ([Doku](https://performance-partners.apple.com/search-api)); Deezer nicht kommerziell, nicht speichern ([Terms](https://developers.deezer.com/termsofuse)); Last.fm oft Platzhalter | nein |
| **45cat/45worlds, RateYourMusic, AllMusic** | — | keine API; RYM verbietet Scraping ([FAQ](https://rateyourmusic.com/wiki/RYM:FAQ)); AllMusic über TiVo lizenziert | nein |
| **Internet Archive** `unlockedrecordings` | 23.393 Items, meist vergriffene LPs; 0 Treffer für Fleetwood Mac; nur ein Frontbild, `disc1side1.png` sind Wellenformen [v, angesehen] | Great-78-Vergleich 09/2025 sperrt kommerzielle Aufnahmen ([DMN](https://www.digitalmusicnews.com/2025/09/16/great-78-project-lawsuit-settlement/)) | nein |
| **DNB** | *folklore*: 3 Datensätze, einer „2 Schallplatten", ohne Farbe, ohne Bild [v, SRU] | offen | nein |
| **VinylHub** | Plattenläden, keine Pressungen | — | für „Buy locally" (vgl. 5.12), nicht für Daten |

## Handel (nur offizielle Schnittstellen, nie Shops abgrasen)

- **HHV:** Partnerprogramm über Webgains mit täglichem Produktfeed ([HHV](https://www.hhv.de/en/help/affiliate-partner-program)) [v].
- **Rough Trade:** Affiliate mit Datenfeed, Netzwerk unklar ([Quelle](https://www.affiliate-toolkit.com/program/rough-trade/)) [s]. **Juno:** Partnerprogramm, kein Feed erwähnt ([Juno](https://affiliate.juno.co.uk/)) [v].
- **Amazon:** PA-API 5 im April/Mai 2026 abgeschaltet, Nachfolger Creators API, Zugang ab etwa 10 Verkäufen in 30 Tagen ([Amazon](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation)) [s].
- **eBay:** Browse API mit Partnerprogramm ([Anforderungen](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html)); Kategorie „Colored Vinyl" ([eBay](https://www.ebay.com/b/Colored-Vinyl-Records/176985/bn_7114785520)); Fotos zeigen einzelne Exemplare.
- **Bandcamp:** API nur für Labels und Fulfillment ([Bandcamp](https://bandcamp.com/developer)) [s]. **Artist-Stores:** ohne Shop-Token keine API [?].
- Feeds zeigen, was gerade verkauft wird, keine Geschichte der Pressungen.

## Farbe als Feld

Keine offene Quelle hat eins. coloredvinylrecords.com (rund 3.000 Einträge, Farbkategorien) ist eine Amazon-Affiliate-Seite ohne API. Realistisch: den Discogs-Freitext aus dem Dump selbst normalisieren, mit den Farbkarten der Presswerke als Vokabular ([United Record Pressing](https://www.urpressing.com/client-resources/vinyl-colors/), [Gotta Groove](https://www.gottagrooverecords.com/vinyl-colors/)) und abgegrenzt gegen „Labels", „Cover", „Sleeve", „Obi".

## Empfehlung

1. **Discogs-Dump (CC0) + CAA-Bilder**, verbunden über die Discogs-Links in MusicBrainz: Pressungsliste, Farbtext, Picture Disc/Shape ohne Limit und ohne Bildrechtsfrage; Bilder wie jetzt aus dem CAA.
2. **Discogs-API mit Token für Bilder** nur nach schriftlicher Klärung mit Discogs (Affiliate, Cache, 6-Stunden-Regel).
3. **TheAudioDB oder fanart.tv** für Rückseite und Disc-Motiv je Album, ausdrücklich nicht je Pressung.

## Nächste Messung (für Platz 1)

Den Dump (10,5 GB) einmal lokal streamen — **braucht Julians OK für den Download** —, nach den `master_id` der acht Alben filtern und je Album zählen: Vinyl-Releases (gegen 1.960 aus der API), Anteil mit `text_string`, Anteil, den ein Farblexikon eindeutig als Plattenfarbe erkennt (50 Fälle von Hand prüfen), Picture Disc/Shape/Etched, Bildzahl laut Metadaten. Dazu für die 181 MusicBrainz-Pressungen die Discogs-Links holen (1/s) und messen, wie viele CAA-Bilder so einen Farbtext bekommen. Null Discogs-API-Aufrufe.
