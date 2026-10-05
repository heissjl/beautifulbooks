# Prompt für eine lokale Sitzung: lab/inspiration zum Laufen bringen und messen (ROADMAP 5.18)

Geschrieben 2026-10-05 in einer Cloud-Sitzung, die Open Library nicht erreichen konnte. Zum Einfügen in eine Claude-Code-Sitzung auf Julians Rechner.

---

Branch `claude/sleepy-wozniak-lodegp` im Repository `heissjl/beautifulbooks` enthält `lab/inspiration/` — den Prototyp „The books that inspired me“ (ROADMAP 5.18, Hintergrund in `docs/vergleich-my9albums.md`, Beschreibung und Maß in `lab/inspiration/README.md`). Er wurde in einer Sitzung ohne Netz zu Open Library gebaut: Tests grün, Poster nur aus Farbflächen gesehen, **nie mit echten Covern**. Deine Aufgabe: ihn hier lokal zum Laufen bringen, einmal ganz durchspielen, was du findest reparieren, und die Maße aus dem README eintragen.

**Bevor du etwas tust:** CLAUDE.md lesen. Es gilt: nichts wird im Chat erledigt — jede Zahl und jeder Befund landet in einer Datei; `lab/` fragt nie Google Books; Screenshots bleiben lokal unter `docs/tests/`; nicht gegen die Produktion prüfen.

**1. Den Branch finden.** Er ist in diesem Rechner schon in einem Worktree ausgecheckt (`git worktree add` scheiterte deshalb gestern). `git worktree list` zeigt den Pfad; dort `git pull origin claude/sleepy-wozniak-lodegp`, `npm ci`. Kein neuer Worktree.

**2. Starten.** `npx tsx lab/inspiration/serve.ts`, dann `http://localhost:4333/inspiration`. Der Server druckt je Anfrage, wie viele Open-Library-Aufrufe sie gekostet hat. `npx vitest run lab/inspiration` muss grün sein (22 Tests).

**3. Einmal ganz durchspielen, mit Stoppuhr:** neun Bücher suchen (Suche nur auf Enter), bei mindestens zweien „The edition I read“ benutzen, Namen eintragen, „Done — share it“, dann auf der geteilten Seite: „Save for a story“, „Save for a post“, einen Share-Knopf (X reicht, nicht absenden), „Copy link“, einen Kachel-Link auf die Buchseite (geht auf buyitscovers.com), „Make it a collection“ (das Ziel `/create#inspiration=` liest die Seite noch nicht — das ist bekannt, nicht reparieren). Beide Poster ansehen; das Story-Bild aufs Telefon schicken und in Instagrams Story-Vorschau ansehen.

**4. Was wahrscheinlich kaputt ist, weil es nie mit echten Daten lief:** die Cover-Bilder (`/img/<S|M|L>/<ol-…>` leitet auf covers.openlibrary.org um); `coversFromEditions` liefert vielleicht zu viele oder zu wenige Editionen; die Titel in „Buy these books“ kommen aus `getWork` und könnten fehlen; der Hairline-Rahmen und die Textgrößen auf dem Poster mit echten Covern. Repariere, was den Durchlauf blockiert; alles andere notieren.

**5. Messen und eintragen** (Maß 1–5 im README): Zeit vom leeren Brett bis zum gespeicherten Bild; wie oft die Ausgabe gewechselt wurde; Lesbarkeit am Telefon (Cover erkennbar? Adresse lesbar?); Open-Library-Aufrufe für ein fertiges Brett (aus der Serverausgabe); 0 Google-Aufrufe (steht so im Code; bestätigen). Ergebnisse in `docs/history.md` als Eintrag „2026-10-xx · lab/inspiration zum ersten Mal mit echten Covern (ROADMAP 5.18)“, Stand im README und in ROADMAP 5.18 nachziehen. Screenshots nach `docs/tests/`, nicht ins Repository.

**6. Nicht tun:** nichts auf die Website heben (das ist ein eigener Roadmap-Punkt, Umzugsliste steht im README unter „Auf der Seite“); keine Google-Anfrage; nicht nach `main` mergen; den Hashtag `#booksthatinspiredme` und den Satz oben nicht ändern — das entscheidet Julian, nach dem Lauf.

Am Ende: ein Commit „5.18 lab/inspiration: first run with real covers“ auf denselben Branch, gepusht; in der Antwort die fünf Maße in einer Tabelle und die Liste dessen, was repariert wurde und was offen blieb.
