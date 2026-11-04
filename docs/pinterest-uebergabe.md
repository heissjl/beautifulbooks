# Pinterest: Übergabe an die Sitzung, die künftig alles Pinterest macht

Geschrieben am 2026-11-03 abends (Julian: „erstelle einen übergabezettel an eine andere session, mit der ich alle pinterest-aktivitäten machen will“). Zahlen und Termine: Stand dieses Abends, vor der Arbeit einmal gegen Pinterest prüfen.

**Zuerst lesen:** CLAUDE.md, [umgang.md §15](umgang.md) (Pinterest) und §12 (Cockpit), [PLAN-5.5-5.6 §5, §7, §7.1](plans/PLAN-5.5-5.6-kanaele.md), ROADMAP 5.5 und 5.5a. Antworten an Julian auf Deutsch.

## Ziel

Pinterest ist der eine Kanal, der ohne Follower wachsen kann (PLAN-5.6c). Regelmäßig Pins bringen, zwei am Tag, und nach acht Wochen ehrlich messen: **um den 26.12.2026 80 Pins und mindestens 50 Besuche pro Woche** mit `via=pinterest` (K16 in `/admin/insights`), sonst einstellen, nicht automatisieren.

## Wo die Arbeit liegt

Warteschlange und Zettel sind seit dem 2026-11-03 auf dem **lokalen `main`** (Julian: „Ja, mergen“, Merge `a4987bc`), **nicht gepusht**; `origin/main` ist Produktion und hat die alte Warteschlange. Eine neue Sitzung startet also vom lokalen `main`, nicht von `origin/main`. Pushen nur auf Julians Wort; eine reine Doku-Änderung fährt mit dem nächsten Inhalts-Commit mit.

Auf **`claude/elated-cohen-1f0d56`** liegen zwei weitere ungemergte Commits: `313b9a6` (die acht Entwürfe, hier schon übernommen) und `78411c5` (Mess-Sonde fürs Mosaik; die Cockpit-Prüfung nimmt auch `/compare.jpg` an). **Beim Zusammenführen darf deren `queue.json` die von `main` nicht überschreiben**; auch `scripts/cockpit/pins.ts` ist auf beiden geändert. Mergen nur auf Julians Wort.

## Stand

**Konto:** @buyitscovers, Unternehmenskonto, Profil fertig, `buyitscovers.com` per DNS-TXT bei INWX bestätigt. Gearbeitet wird in Julians Chrome (Claude in Chrome), dort ist er angemeldet.

**Pinnwände (fünf, öffentlich, mit Beschreibung):** SF Masterworks, Feminist Press, The Otherwise Award, Covers through the decades, Beautiful Books with Pretty Covers (noch leer).

**Noch anzulegen, wenn die Entwürfe ein Ja bekommen:** Science fiction book covers, Classic book covers, Vintage paperback covers, Book cover design, Fantasy book covers.

**Die eine Liste:** [`docs/pins/queue.json`](pins/queue.json), 32 Pins. Julian entscheidet im Cockpit unter „Pins“ (`npm run cockpit`, Port 4320; ein laufender Server kann noch aus dem alten Worktree `ecstatic-meninsky-e4fe7e` stammen und liest dessen Datei, also den Port prüfen). Bilder im Cockpit liegen git-ignoriert in `docs/cockpit/pins/`, in einem neuen Worktree neu holen.

| Zustand | Zahl | Welche |
|---|---|---|
| Veröffentlicht | 5 | SF Masterworks, Feminist Press, Animal Farm, The Otherwise Award, Nineteen Eighty-Four |
| Ungeklärt | 1 | Harry Potter, in der Datei noch `geplant` |
| Geplant | 7 | A Game of Thrones 4.11. 12:00, The Hobbit 4.11. 19:00, Brave New World 5.11. 12:00, Dune 5.11. 19:00, Fahrenheit 451 6.11. 12:00, Fellowship 6.11. 19:00, Ender's Game 7.11. 19:00 |
| Zu entscheiden | 19 | 11 Jahrzehnte-Pins (darunter die Reserve), 8 mit allgemeinen Suchnamen; Terminvorschläge bis 16.11. |

Pinterests Liste zeigt 8 geplante, weil der alte Fellowship-Pin noch dabei ist (Punkt 1 unten).

## Julians Entscheidungen, die gelten

- **Rechte:** Weg (a), Cover auf Pinterest mit Quellenangabe (2026-10-17).
- **Freigabe:** Nur Pins mit `ja` werden eingeplant; danach `geplant` in der Datei. Vorlegen, nie selbst entscheiden.
- **Bild:** Neue Pins stehen auf dem Mosaik-Grund (live). Der Vergleichs-Pin noch nicht, siehe unten.
- **Wortlaut der Jahrzehnte-Pins:** beginnt mit „A selection of <Zahl> book covers …“, kein Satz mit Verlagen. `decadePin` in `lib/pins.ts` schreibt noch die alte Form.
- **Allgemeine Namen:** Pins sollen auch unter allgemeinen Suchbegriffen laufen, nicht nur unter Sammlungsnamen. Der alte Name „Beautiful Books with Pretty Covers“ darf auf der Pinnwand bleiben.
- **Kein KI-Label** („Nein, so lassen“, 2026-10-31): „Mark as AI-Modified“ bleibt aus, die Bilder sind Montagen echter Scans.
- **Rhythmus:** zwei am Tag, 12:00 und 19:00, nie dasselbe Bild zweimal auf einer Pinnwand.
- **Kein Pinterest-Tag** auf der Seite (Tracker).

## Nächste Schritte, nach Dringlichkeit

**Nachtrag 2026-11-03 abends (Pinterest-Sitzung), Zahlen in [pinterest-formate-recherche-2026-11-03.md §1](pinterest-formate-recherche-2026-11-03.md):** Punkt 1 ist erledigt — der alte Fellowship-Pin `4000372565200832576` steht nicht mehr in der Planung, „Scheduled Pins“ zeigt 7 (A Game of Thrones bis Ender’s Game, ein Fellowship). Punkt 3: *Harry Potter* ist weiter weder unter Created noch Scheduled, hat aber 2 Impressions in der Statistik — der Pin war veröffentlicht und ist weg; Julian fragen, ob er ihn gelöscht hat, sonst neu anlegen. Punkt 2 erledigt am 2026-11-04 vormittags (Julian: „Text ändern“): alle fünf tragen in Pinterest den Wortlaut „A selection of … book covers …“ ohne Verlagssatz, die Bilder bleiben; *A Game of Thrones* und *The Hobbit* waren zu ihren Terminen schon veröffentlicht (die Änderung kam erst abends) und wurden am veröffentlichten Pin geändert. Erste Zahlen: 18 Impressions, 0 Saves, 0 ausgehende Klicks, K16 0 Einstiege.

1. **Alten Fellowship-Pin löschen, vor dem 6.11. 19:00. Das ist Julians Klick:** `https://www.pinterest.com/buyitscovers/scheduled-pin/4000372565200832576/`, oben „Delete“. Der Pin trägt noch „Publishers include HarperCollins …“. Sonst erscheint das Buch zweimal. Danach nachsehen, dass der Pin mit „A selection of 152 …“ bleibt. Claude löscht nichts endgültig selbst.
2. **Fünf geplante Jahrzehnte-Pins, Frage an Julian, vor dem 4.11. 12:00:** A Game of Thrones, The Hobbit, Brave New World, Dune und Fahrenheit 451 haben alten Text und altes Bild ohne Mosaik. Sein „löschen und neu planen“ fiel, als er falsch hörte, Pinterest lasse keine Änderung zu; ausgeführt ist es bisher nur für Fellowship. Der Text lässt sich ohne Löschen auf „Edit this Pin“ ändern. Das Mosaik-Bild verlangt einen neuen Pin (und Julians Löschklick am alten). Fragen, was er will.
3. **Harry Potter klären:** seit dem 2.11. weder unter „Scheduled Pins“ noch unter „Created“; die Pinnwand zählte am 2.11. 2 Pins und zeigte einen. Keine Benachrichtigung. Einmal nachsehen, sonst Julian fragen, ob neu anlegen.
4. **Ausstehende Pins:** 19 warten auf Julians Ja. Vorher ansehen:
   - *Metamorphosis*: Bild hatte am 31.10. drei leere Felder, neu holen; sonst die Reserve *The Hitchhiker's Guide*.
   - *Pride and Prejudice* und *The Catcher in the Rye*: Die Seite zeigt Gruppen vor der Erstausgabe (1810s, 1940s), Katalogjahre.
   - *The Great Gatsby*: Bild hatte am 31.10. nur sechs Cover.
   - Black-Band und Reihe Hanser: kalt 67 und 55 s auf dem Dev-Server, die Funktion hat 30 s. Vor dem Hochladen einmal von der Produktion holen und ansehen.
5. **Vergleichs-Pins:** Route `/book/<id>/compare.jpg?covers=…` ist auf `origin/main`, die Liste steht in `docs/pins-2026-10-31.md` (V1 ff.). Julian muss je Werk drei Cover von Hand wählen, erst dann in die Warteschlange (braucht `78411c5`). Offen: Mosaik-Grund auch hier? Die Vergleichs-Sitzung sah dafür einen dunklen Streifen hinter der Beschriftung nötig.
6. **Beautiful Books with Pretty Covers:** Julian wählt die Ausgaben.
7. **`decadePin` in `lib/pins.ts`** auf den neuen Wortlaut bringen, bevor `scripts/pin-list.ts` wieder Pins erzeugt.
8. **Rich Pins:** nicht entschieden. Der URL-Debugger existiert nicht mehr, ein hochgeladener Pin zeigt nur unseren Text. Eindeutig wäre ein Pin, den jemand mit „Merken“ von der Seite holt; nur die Jahrzehnte-Seiten tragen `og:type` `article`.
9. **Nachschub:** Bis 80 Pins fehlen rund 48. Listen pro Woche für Julian (PLAN §7), mit Zahlen von der Seite, nie aus dem Gedächtnis.
10. **ROADMAP 5.5** nach jedem Schritt nachziehen, Termine und Befunde in `docs/history.md`.

## Was funktioniert hat

- **Einplanen in Julians Chrome**, Ablauf in umgang §15: `/pin-creation-tool/`, Bild per `file_upload`, Felder tippen, „Publish at a later date“, Datum und Zeit über `find`, vor dem Bestätigen Titel, Link und Termin gegen die Datei prüfen.
- **Zahlen von der Jahrzehnte-Seite der Produktion lesen**, einmal je Seite, Abstand 7 s, wenn Open Library den Mac abweist (`scripts/pin-list.ts` braucht Open Library).
- **Bild vor dem Hochladen ansehen:** Das fand die leeren Felder.

## Was nicht funktioniert hat

- **„Geplante Pins sind fest“ war falsch.** Das Menü der Karte zeigt nur „Publish now“ und „Delete“, ein Klick auf die Karte öffnet „Edit this Pin“. Julian hat auf diese falsche Auskunft zweimal reagiert: beim KI-Label und bei „löschen und neu planen“. Vor einer Aussage „geht nicht“ die Oberfläche wirklich durchgehen.
- **`javascript_tool` sperrt Ausgaben mit Query-String:** Links als Vergleich gegen den Sollwert prüfen.
- **Tests und Skripte unbeobachtet in einer Kette:** Ein Skript brach ab, der Commit `8809aab` behauptete trotzdem die Korrektur (nachgeholt in `a8b327e`). Ergebnis lesen, bevor die Commit-Nachricht es sagt.
- **Produktion nie in einer Schleife fragen** (CLAUDE.md); Open Library sperrt nach Serien.
