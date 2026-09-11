# lab/hotornot — zwei Cover, ein Klick

Roadmap 5.8, Spielart 4. Julian, 2026-09-11: „Ich will das hot or not spiel mit covern nachbauen. so wie damals facebook gestartet ist als zuckerberg noch an harvard war. wir wollen viral gehen können auf booktok indem wir das hässlichste und das schönste buchcover finden."

```bash
npx tsx lab/hotornot/serve.ts                     # 100 Cover, je eines aus 100 Büchern
npx tsx lab/hotornot/serve.ts --work OL1168083W   # alle Gestaltungen eines Buchs (1984: 230)
npx tsx lab/hotornot/serve.ts --votes /tmp/x      # Stimmen anderswohin, für jeden Test
# dann http://localhost:4324 — die Rangliste unter #board

npx tsx lab/hotornot/simulate.ts --hold 3         # die Vorhersage, ohne Netz; --runs 5 für einen schnellen Blick
```

Von Facemash übernommen ist die Mechanik: zwei Bilder, ein Klick, eine Elo-Wertung. Was Facemash bewertete, Fotos von Menschen ohne deren Zustimmung, ist genau das, was ein Cover nicht ist. Ein Cover ist gemacht, um beurteilt zu werden, und „Judge a book by its covers" ist die erste Zeile dieser Seite.

## Die Frage

Nicht „lässt sich das bauen" — Facemash war ein Wochenende. Die Frage ist: **Ab wie vielen Stimmen darf die Seite sagen „das ist das hässlichste Cover", und wie oft läge sie dann falsch?** Für BookTok ist das die ganze Rechnung. Eine Krone nach sechzig Stimmen ist Rauschen mit Schlagzeile (N12), und die Zahl der nötigen Stimmen ist die Zahl der Leute, die mitspielen müssen.

Die zweite Frage können nur Menschen beantworten: **Sind sich Leute über Cover überhaupt einig?** Bei 50 % ist es reiner Geschmack. Dann gibt es kein hässlichstes Cover, egal wie lange geklickt wird.

## Das Maß

- **Höchstens jedes zehnte Urteil falsch.** Das Brett krönt ein Cover, wenn es in 90 % der plausiblen Ranglisten am Ende steht. Ob diese Schwelle ihr Versprechen hält, kann nur die Simulation zeigen, weil nur dort die Wahrheit bekannt ist.
- **Stimmen bis zum ersten Urteil**, auch je Cover gerechnet, bei gezielter Paarung.
- **„Favorit gewinnt"**, über echte Stimmen gemessen und gegen dieselbe Spalte der Simulation gelesen: die Zeile mit derselben Zahl ist die, die gilt. Nur mit der Spalte „gezielt" vergleichen — gezielte Paare liegen nah beieinander, der Favorit gewinnt dort seltener als bei Zufallspaaren.

## Wie es funktioniert

**Der Vorrat** kommt aus `data/cover-index.json`, offline. Gemessen am Index vom 2026-09-09: 12.132 Cover zu 139 Werken, nach der Faltung (dHash-Abstand ≤ 8, nur innerhalb eines Werks) **9.939 verschiedene Gestaltungen**; 63 sehen leer aus (0,5 %).

- *Mix* (Vorgabe): je Buch ein zufälliges Cover, gezogen mit einem festen Startwert. Ein leer aussehender Scan wird übergangen, wenn das Buch etwas anderes hat. Gelöscht wird er nicht, denn dieselben Zahlen beschreiben auch eine weiße Erstausgabe. Der Standardvorrat `mix-100-paperwhite` enthält 100 Bücher und keinen leeren Scan.
- *Werk*: alle Gestaltungen eines Buchs. Die meisten haben die *Odyssee* und die *Göttliche Komödie* (je 280), *Der kleine Prinz* (265), *Der Hobbit* (248) und *1984* (230). Median über alle Werke: 48.

**Beim Abstimmen** ist der Titel verborgen — gezählt wird das Cover, nicht das Buch. Das Bild wird ganz gezeigt und nie beschnitten, denn ein Anschnitt ändert das Urteil. Welches Cover links steht, ist Zufall, weil Menschen eine Seite bevorzugen. „Weiß nicht" ist keine Stimme. „Ist kein Cover" nimmt ein Bild aus dem Spiel, und ein Bild, das nicht lädt, tut das von selbst.

**Die Paarung** (`nextPair`) nimmt das am wenigsten gesehene Cover und gibt ihm einen Gegner mit ähnlicher Elo-Wertung; eine Stimme zwischen einem klaren Favoriten und einem klaren Außenseiter lehrt fast nichts. Hat jedes Cover drei Spiele, geht jede zweite Paarung an die Enden, denn um die Enden geht es.

**Die Rangliste** (`crowns` in `rating.ts`) besteht aus vier Teilen:

1. Bradley–Terry über alle Stimmen, unabhängig von ihrer Reihenfolge. Elo dient nur zum Paaren.
2. Für jedes Cover eine Unsicherheit aus der Krümmung der Wahrscheinlichkeit (Laplace). Aus 100 plausiblen Ranglisten ergibt sich, wie oft ein Cover am Ende steht.
3. Wie stark die Wertungen zur Mitte gezogen werden, folgt aus den Stimmen selbst: aus der Streuung der Wertungen, abzüglich des Anteils, der nur Messfehler ist.
4. **Eine Krone zählt erst, wenn dasselbe Cover sie drei Runden in Folge hält** (`CROWN_HOLD`). Eine Runde sind so viele Stimmen, wie es Cover gibt. Vorher heißt es auf dem Brett „vorn, aber erst seit einer Runde".

**Die Stimmen** liegen in `lab/hotornot/votes/<pool>.json` und enthalten **nichts, was einen Spieler kennzeichnet** (N11): zwei Cover, der Sieger, ein Tag. Die Datei hält auch den Vorrat fest, damit ein neu gebauter Index nicht die Cover unter bereits abgegebenen Stimmen austauscht. Jeder Test startet mit `--votes <ordner>`; das Kuratier-Werkzeug hat gelernt, was sonst in echten Daten landet.

Google Books wird nie gefragt (lab-Regel 6). Nur die Bilder kommen vom CDN von Open Library.

## Wie die Rechnung dreimal zu früh krönte

Jede Fassung ist an einem Test oder an der Simulation gescheitert, und jede Fassung hätte auf BookTok eine falsche Krone vergeben.

1. **Bootstrap über die Stimmen.** Nach 15 Stimmen über 10 Cover stand schon „eines der drei hässlichsten". Ein Cover, das seine einzigen drei Spiele verloren hatte, verlor sie in fast jeder Neuziehung wieder. Gemessen war damit die Stabilität *dieser* Stimmen, nicht die Sicherheit über das Cover. Drei Niederlagen passieren einem Durchschnittscover in einem von acht Fällen.
2. **Unsicherheit je Cover, festes Vorwissen** (ein virtuelles Spiel). Das krönte immer noch auf der Handvoll Stimmen, weil ein virtuelles Spiel zwei Einheiten Abstand erlaubt. In der Simulation waren **26 von 201** ersten Urteilen falsch (13 %).
3. **Vorwissen aus den Stimmen geschätzt.** Das behob die Handvoll, aber bei vielen Stimmen blieben **25 von 200** falsch (12,5 %). Der Grund ist das vorzeitige Hinschauen: das Brett wird nach jeder Runde neu gefragt, und wer beim ersten Überschreiten der 90 % postet, erbt den Zufallstreffer.
4. **Krone drei Runden gehalten.** **11 von 172** falsch (6,4 %), also unter den versprochenen 10 %. Der Preis: Urteile kommen später und seltener.

Gezählt über dieselben 16 Tabellenzeilen, gezielte Paarung, Pools 50 bis 200, 20 Läufe je Zeile.

## Was die Simulation vorhersagt

Die Regel des Bretts (Krone drei Runden gehalten), gezielte Paarung, 20 Läufe je Zeile, höchstens 60 Stimmen je Cover. „Einigkeit" heißt: wie oft ein Mensch bei einem zufälligen Paar das in Wahrheit schönere Cover wählt.

| Pool | Einigkeit | Favorit gewinnt | Urteil „hässlichstes" nach | davon falsch | Urteil „schönstes" nach | davon falsch |
|---|---|---|---|---|---|---|
| 50 | 83 % | 68 % | 1.600 (32/Cover) | 0 von 11 | 1.300 (26/Cover) | 0 von 15 |
| 50 | 73 % | 60 % | nicht in 60/Cover | 2 von 9 | 1.650 (33/Cover) | 0 von 12 |
| 50 | 63 % | 55 % | nicht in 60/Cover | 0 von 2 | nicht in 60/Cover | 0 von 6 |
| 100 | 83 % | 66 % | 1.600 (16/Cover) | 1 von 17 | 3.700 (37/Cover) | 1 von 13 |
| 100 | 73 % | 58 % | 2.900 (29/Cover) | 1 von 13 | nicht in 60/Cover | 1 von 9 |
| 100 | 63 % | 54 % | nicht in 60/Cover | 1 von 9 | nicht in 60/Cover | 1 von 5 |
| 200 | 83 % | 61 % | 6.200 (31/Cover) | 2 von 15 | 5.800 (29/Cover) | 1 von 14 |
| 200 | 73 % | 56 % | nicht in 60/Cover | 0 von 9 | 7.400 (37/Cover) | 0 von 13 |
| 200 | 63 % | 54 % | nicht in 60/Cover | 0 von 4 | nicht in 60/Cover | 0 von 6 |

„Nicht in 60/Cover" heißt: in mehr als der Hälfte der Läufe kein Urteil vor dem Deckel. Die Mediane an diesem Deckel sind grob. Bei Pool 50 mit 73 % liegt das hässlichste Ende über dem Deckel und das schönste bei 1.650 — das ist Streuung über 20 Läufe, kein Unterschied der Enden.

**Gezielte Paarung findet das Ende zwei- bis fünfmal früher als zufällige**: bei 100 Covern und 73 % Einigkeit steht das wahre hässlichste Cover nach 1.100 statt 3.000 Stimmen am Ende der Wertung, bei 200 Covern nach 5.000 statt 12.000. Bei zufälliger Paarung erreicht das Brett in den meisten Zeilen gar kein Urteil.

## Was das für BookTok heißt

- **Für den Standardvorrat von 100 Covern:** Sind sich Menschen so einig wie in der mittleren Zeile, braucht „das hässlichste Cover" rund **2.900 Stimmen**. Bei etwa dreißig Stimmen je Mitspieler sind das ungefähr **hundert Leute**. Das schönste Ende braucht länger.
- **Ein Werk-Vorrat** („das hässlichste der 230 Cover von *1984*") braucht selbst bei hoher Einigkeit mehrere Tausend Stimmen. Anfangen lässt sich mit dem Mix oder einem kleineren Vorrat.
- **Liegt die Einigkeit bei 63 %, ist kein hässlichstes Cover in Reichweite.** Das ist auch ein Ergebnis, und das Brett sagt es so.
- **Vor jedem Posten:** ein Mensch sieht die letzten fünf an, denn ein Platzhalter ist kein hässliches Cover. Die Rechtefrage aus 5.5 gilt, denn Cover auf einer fremden Plattform sind Verbreitung. Und nach 5.6 postet ein Mensch von Hand, nie eine Maschine.

## Befunde beim Bauen

- **Ein Platzhalter steht im Standardvorrat:** eine *Reading Guide* zu *Slaughterhouse-Five* (`ol:10942061`) mit dem Aufdruck „Note: This is not the actual book cover". Beim Testlauf wurde er per Knopf aussortiert, nicht durch einen meiner Klicks, sondern im sichtbaren Browser-Bereich. Genau dafür ist der Knopf da. Ohne ihn hätte der Platzhalter eine gute Chance auf „das hässlichste Cover".
- Beim ersten Bild blieb eine Hälfte einige Sekunden leer: das CDN von Open Library war langsam, das Bild fehlte nicht.
- Fällt der Server aus, sagt die Seite das, statt still hängen zu bleiben (F1.7, N12).

## Offen

1. **Mit Menschen spielen.** Die Favoriten-Zahl über echte Stimmen entscheidet, welche Zeile der Tabelle gilt. Auch offen: ob Leute dreißig Paare durchhalten.
2. **Ein geteilter Link.** Eine Online-Fassung braucht einen Ort für die Stimmen, also den Speicher, den E6 zurückstellt (5.8, „Zu klären"). Bis das entschieden ist, bleibt das Spiel lokal.
3. **Pool 400 unter der Regel des Bretts ist nicht gemessen**; der Lauf war zu lang. Für die Fundstelle allein gibt es Zahlen in der Historie.
4. **Die Unsicherheit ist absichtlich zu breit geschätzt**, je Cover für sich (Diagonal-Laplace). Ob das zu vorsichtig ist, zeigt erst der Vergleich mit echten Stimmen.
5. **Die Rechtefrage aus 5.5**, vor allem anderen, was nach außen geht.

## Stand

Gebaut und simuliert am 2026-09-11, im Browser geprüft (Spiel, Rangliste, Telefon). **Noch nicht von Menschen gespielt.** Die Messung und ihr Weg stehen in [docs/history.md](../../docs/history.md).
