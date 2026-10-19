# Die 22 Abweichungen, im Netz nachgesehen (2026-10-19)

Julian: „kannst du eine webrecherche zu denen machen?“ Gesucht war je Werk das Jahr der **ersten Buchausgabe** (das, was „Erstausgabe {year}.“ verspricht), getrennt davon ein früherer Abdruck in einer Zeitschrift. Quellen: der Wikipedia-Artikel des Werks (Infobox und Text), für *Foundation* die ISFDB, für *Ender's Game* der Wikidata-Eintrag selbst, für *Breakfast at Tiffany's* eine Antiquariatsbeschreibung. Die Jahre sind gesichert; Monate stammen aus den Artikeln und sind nicht einzeln nachgeschlagen — nicht ungeprüft auf die Seite.

| # | Werk | OL | Wikidata | Erste Buchausgabe | Früher | Richtig |
|---|---|---|---|---|---|---|
| 1 | Madame Bovary | 1876 | 1857 | Apr 1857, Michel Lévy | Revue de Paris, Okt–Dez 1856 | Wikidata |
| 2 | L'étranger | 1922 | 1942 | 1942, Gallimard | – | Wikidata |
| 3 | Der Proceß | 2006 | 1925 | Apr 1925, Die Schmiede | geschrieben 1914–15 | Wikidata |
| 4 | Foundation | 1915 | 1951 | 1951, Gnome Press | Astounding 1942–44 | Wikidata |
| 5 | Buddenbrooks | 1909 | 1901 | Okt 1901, S. Fischer | – | Wikidata |
| 6 | 海辺のカフカ | 2001 | 2002 | 12 Sep 2002, Shinchōsha | – | Wikidata |
| 7 | Cry, the Beloved Country | 1940 | 1948 | Feb 1948, Scribner | – | Wikidata |
| 8 | Tender Is the Night | 1933 | 1934 | 12 Apr 1934, Scribner | Scribner's Magazine Jan–Apr 1934 | Wikidata |
| 9 | In Cold Blood | 1965 | 1966 | Jan 1966, Random House | The New Yorker Sep–Okt 1965 | Wikidata |
| 10 | Breakfast at Tiffany's | 1956 | 1958 | 1958, Random House | Esquire Nov 1958 | Wikidata |
| 11 | The Crying of Lot 49 | 1965 | 1966 | 27 Apr 1966, Lippincott | Auszug in Esquire Dez 1965 | Wikidata |
| 12 | White Noise | 1984 | 1985 | 21 Jan 1985, Viking | – | Wikidata |
| 13 | Americanah | 1969 | 2013 | Mai 2013, Knopf | – | Wikidata |
| 14 | Pale Fire | 1945 | 1962 | 1962, Putnam | – | Wikidata |
| 15 | As I Lay Dying | 1915 | 1930 | 6 Okt 1930, Cape & Smith | – | Wikidata |
| 16 | Oryx and Crake | 2002 | 2003 | Mai 2003, McClelland & Stewart | – | Wikidata |
| 17 | The Hound of the Baskervilles | 1900 | 1902 | 25 Mär 1902, Newnes | The Strand Aug 1901–Apr 1902 | Wikidata |
| 18 | Murder on the Orient Express | 1933 | 1934 | 1 Jan 1934, Collins | Saturday Evening Post Sep–Nov 1933 | Wikidata |
| 19 | Ender's Game | 1985 | 1977 | 15 Jan 1985, Tor | Novelle in Analog, Aug 1977 | **Open Library** |
| 20 | The Canterbury Tales | 1970 | 1387 | um 1476–77, Caxton (erster Druck) | geschrieben um 1387–1400 | **keins** |
| 21 | Dom Casmurro | 1982 | 1899 | Titelblatt 1899, Garnier; ausgeliefert Anfang 1900 | – | Wikidata nach Impressum |
| 22 | The Tenant of Wildfell Hall | 1847 | 1848 | Jun 1848, Newby | – | Wikidata |

**Muster.** Open Library hat bei keinem der 22 recht, außer bei *Ender's Game*. Viermal ist es das Jahr des Zeitschriftenabdrucks (*In Cold Blood*, *Lot 49*, *Orient Express*, halb *Tender Is the Night*), sonst ein verirrtes Ausgabedatum (*Foundation* 1915, *As I Lay Dying* 1915, *L'étranger* 1922, *Americanah* 1969, *Der Proceß* 2006). Bei *Ender's Game* ist es umgekehrt: der Wikidata-Eintrag Q5376051, an dem die Open-Library-ID hängt, ist die Novelle von 1977, nicht der Roman.

**Entschieden 2026-10-19** (Julian: „Trag die 18 Wikidata-Jahre und Ender's Game 1985 ein. Canterbury Tales ohne Jahr, Dom Casmurro 1899 nach Titelblatt.“ — es sind 19 Wikidata-Zeilen, die Zählung oben in der ersten Fassung hatte *Wildfell Hall* übersehen): alle in `data/first-years.json`, Quelle je Zeile. **Regel: das Jahr auf dem Titelblatt zählt**, nicht die Auslieferung. *Canterbury Tales* steht mit `year: null` drin — die Seite zeigt dann gar kein Jahr statt Open Librarys 1970.
