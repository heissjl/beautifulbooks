# PLAN 5.13m — Ein Bearbeitungsmodus für die eigene Sammlung

Stand: 2026-09-29, **Schritte 1–3 gebaut** (Branch `claude/collection-editing-ux-562eba`, nicht deployt; Messungen in der [Historie](../history.md)); offen 4, 5, 6. Julians Entscheidungen in §7. Roadmap: [5.13m](../../ROADMAP.md). Spec: F9 (wird mit dem Bau angepasst).

> Julian, 2026-09-29: „die bearbeitung für user von ihren bestehenden collections muss einfacher werden. zb muss man von einem foto einfach zu einer bestehenden collection hinzufügen können … und es sollte einen bearbeitungsmodus geben bei dem klar ist, bei welcher collection man gerade was hinzufügt mit bild oder suche. wenn ich eine collection in der create ansicht anklicke lande ich in der anzeigesicht, dort kann ich aber nichts machen.“

**Mockup:** Design-Canvas „Collection editing mode“ (<https://claude.ai/artifact/G47jpKYZZS8nYTisKRdAFs>, privat, bis Julian es teilt), sieben Tafeln A–G; B ist klickbar (Cover an- und abwählen, Tabs wechseln). Die Cover sind farbige Platzhalter, keine echten Bilder.

## 1. Befund: was heute im Weg steht

Gelesen im Code am 2026-09-29 (Stand `72b599a`):

| Stelle | Heute | Warum es stört |
|---|---|---|
| `/create` → Karte einer eigenen Sammlung (`components/WallsStart.tsx`) | führt auf `/c/<id>`, die Ansicht | der Besitzer will weitermachen, landet aber beim Anschauen |
| `/c/<id>` für den Besitzer (`components/WallView.tsx`) | Titel, Name, Zeilen als Felder; Entfernen und Verschieben als Knöpfe, die am Desktop erst beim Überfahren erscheinen; **Hinzufügen gar nicht** — nur der Link „Go back to search and choose more covers“ | der Link führt auf `/create`, das nicht weiß, von welcher Sammlung man kam: das Ziel ist `localStorage bb.wall.target` oder die neueste Sammlung |
| Suche auf `/create` | das Ziel („Adding to“ mit Auswahl) erscheint erst im Picker, also erst nach Suche **und** Klick auf ein Werk | vorher sieht man nicht, wohin man sammelt |
| Foto (`WallPhoto` → `WallProposal`) | einziger Knopf „Make a collection of N“ | ein Foto kann nur eine **neue** Sammlung machen — Julians erster Punkt |
| Sechs Zufallscover, „Start from a collection“ | ebenso nur neu | dasselbe |
| Buchseite (`components/AddToWall.tsx`) | Knopf + 7,5 rem schmale Auswahl; der Knopf wirkt auf die gewählte Sammlung | ob das Cover schon in einer **anderen** eigenen Sammlung ist, sieht man nicht |
| Wortwahl | nach jeder Änderung „Saved.“, während oben „Not saved yet“ steht | „saved“ heißt zweierlei: „die Änderung ist angekommen“ und „die Sammlung verfällt nicht“ (5.13j) |

Der Unterbau trägt das Ganze schon: `POST /api/walls/<id>` nimmt bis zu 50 Operationen in einer Anfrage (`add`, `remove`, `move`, `title`, `by`, `intro`, `save` …; `app/api/walls/[id]/route.ts`), `GET` sagt `canEdit`. **Es braucht keine neue Route im Speicher und keine neuen Daten** — nur eine neue Oberfläche.

## 2. Die Idee: ein Editor, ein Ort, ein sichtbares Ziel

Grundsatz: **Hinzufügen geschieht immer in eine Sammlung, die auf dem Bildschirm mit Namen steht.** Dafür gibt es einen Bearbeitungsmodus, und alle Wege, Cover zu sammeln, münden in ihn.

**Der Editor `/c/<id>/edit`** (Tafel B, klickbar; D mit Foto):

- Ein dunkles Band unter der Kopfzeile: „EDITING · Rainy-day paperbacks · 9 covers · not saved yet“, rechts „See it as others do“ und „Done“. Man weiß jederzeit, dass man bearbeitet und was.
- **Links „Add covers“** mit drei Reitern: **Search** (Suche → Werk → dieselbe gefaltete Wand wie heute im Picker, „All languages“ vorgewählt, ein Klick legt hinein, der zweite nimmt heraus, „Added ✓“ markiert), **Photo** (siehe §4), **Ideas** (sechs Zufallscover einzeln oder alle, „Draw six others“; die Cover einer anderen Sammlung zum Herauspicken).
- **Rechts die Sammlung** unter „YOU ARE ADDING TO“: Titel als Feld, „+ Your name, a few lines“ (klappt die zwei Felder auf), alle Cover klein mit **immer sichtbarem ✕**, Ziehen zum Verschieben, neu Hinzugefügte mit „new“ markiert; darunter „Not saved yet — gone in 2 days unless you keep it · **Keep it**“ und „Add to another instead“ mit den übrigen eigenen Sammlungen als Chips und „+ New collection“. Ein Chip wechselt in deren Editor, Suche und Werk bleiben in der Adresse.
- **Zwei Modi oben im Editor** (Julian, 2026-09-29, §7.3): „Add covers“ wie oben beschrieben, und „**Arrange**“ — die Sammlung in voller Breite mit großen Covern, ✕, Verschieben (Pfeile, später Ziehen) und den Feldern für Titel, Namen und Zeilen. Die schmale Spalte reicht zum Sammeln, nicht zum Ordnen von vierzig Covern. Adresse: `?mode=arrange`. *Im Mockup nicht gezeichnet; gebaut mit ←, ✕, → unter jedem Cover.* Abweichungen vom Mockup beim Bau: „Keep it“ steht im Band statt in der Spalte, damit es in beiden Modi und am Telefon zu sehen ist; das Band ist im dunklen Modus hell (es nimmt `ink` als Grund, und das kehrt sich um).
- Die Adresse trägt den Zustand wie überall: `/c/<id>/edit?add=search&q=rebecca&work=OL…W`. Reload und Zurück behalten Reiter, Suche und Werk.
- Ein Browser, der die Sammlung nicht besitzt, wird auf `/c/<id>` umgeleitet (dieselbe Prüfung wie heute: `GET /api/walls/<id>` → `canEdit`). `noindex`.

**Die Ansicht `/c/<id>`** (Tafel C) wird für alle gleich ruhig: eine Cover-Wand ohne Werkzeuge. Der Besitzer bekommt oben „**Edit collection**“ (Akzentfarbe) neben „Copy link“, dazu wie heute den Hinweis „Not saved yet · Keep it“, „Show it to others“ und „Your ID“. Die Hover-Knöpfe und die Felder verschwinden aus der Ansicht; „Go back to search and choose more covers“ entfällt.

**Die Lobby `/create`** (Tafel A): „Your collections“ öffnet beim Klick den **Editor** (Knopf „Edit“, daneben „View“), dazu eine Karte „+ New, empty collection“. Darunter „Start a new one“ mit drei Spalten — From a book, From a photo, From an idea — und dem Satz, dass jeder Start im Editor der neuen Sammlung endet:

- Suche auf `/create`: der **erste** Klick auf ein Cover legt die Sammlung an und ersetzt die Adresse durch `/c/<neu>/edit?add=search&q=…&work=…` — der Picker bleibt offen, man sammelt einfach weiter, jetzt mit Namen rechts.
- Foto auf `/create`: „Make a collection of N“ führt in den Editor; darunter „or add them to …“ mit Auswahl der eigenen Sammlungen (Julians erster Punkt gilt also auch hier).
- Sechs Zufallscover und „Start from a collection“ führen ebenso in den Editor der neuen Sammlung.

**Die Buchseite** (Tafel E): „+ Add to collection ▾“ öffnet eine kleine Liste **aller** eigenen Sammlungen mit Häkchen — ein Häkchen heißt „dieses Cover ist darin“, ein Klick legt es hinein oder nimmt es heraus —, darunter „+ New collection with it“ und „Open the editor“. Kommt man aus dem Editor (über „the book's page“ im Picker), steht unter der Kopfzeile ein schmales Band „EDITING · Rainy-day paperbacks · 10 covers · Back to the editor · Stop editing“, und diese Sammlung steht in der Liste oben. Das Band lebt in `sessionStorage` (`bb.wall.editing`), **nicht** in der Adresse, damit ein geteilter Buchlink keinen fremden Bearbeitungszustand mitnimmt; es endet mit „Stop editing“, „Done“ oder dem Tab.

**Am Telefon** (Tafeln F, G): Das Band schrumpft auf „EDITING · Titel · Done“, die Reiter und die Cover stehen in einer Spalte (drei Cover je Reihe). Die Sammlung ist eine **Leiste unten** wie das Cover-Blatt der Buchseite (`CoverSheet`): die letzten drei Cover, „YOU ARE ADDING TO · Rainy-day paperbacks · 10“; ein Tipp öffnet sie als Blatt mit Titel, Covern mit ✕, „Keep it“ und „Add to another instead“.

## 3. Wortwahl

- Die Rückmeldung nach einer Änderung heißt nicht mehr „Saved.“: jede Änderung ist sofort angekommen, und das sagt ein Satz unter der Sammlung („Every change is kept at once“), nicht ein flüchtiger Hinweis.
- **Entschieden (Julian, 2026-09-29):** „Save collection“ (5.13j) heißt „**Keep it**“, der Hinweis „Not saved yet — gone in 2 days unless you keep it“. Dann gibt es nur noch eine Bedeutung von „saved“, und die heißt anders. Die Regel aus 5.13j (48 Stunden, erst behaltene zählen und lassen sich zeigen) bleibt unverändert.

## 4. Foto in eine bestehende Sammlung (Tafel D)

- Der Reiter Photo im Editor liest das Foto wie heute (`/api/walls/photo`, `lib/walls/photo.ts`), zeigt die nummerierten Kästen und die Liste zum Abhaken.
- Neu je Zeile: **„already in this collection“**, wenn genau dieses Cover schon darin ist (abgehakt und gesperrt); ist das **Werk** mit einem anderen Cover darin, heißt es „in with another cover“ und ist nicht vorgewählt. „another cover“ öffnet den Reiter Search mit diesem Werk (`?add=search&work=…`), damit man das Cover wählen kann, das wirklich im Regal steht — heute steht dafür nur der Satz „change it in the picker below“.
- Nicht gefundene Titel bekommen „search for it“ (Reiter Search mit dem gelesenen Titel als Suche), eine gescheiterte Suche „try again“ — N12 wie heute: „the search did not answer“ ist kein „not found“.
- Der Knopf heißt „**Add 3 to Rainy-day paperbacks**“; rechts erscheinen die drei als gestrichelte Vorschau. Darunter „or make a new collection of them“.
- Eine Anfrage nimmt höchstens 50 Operationen; „Add all“ aus einer großen Sammlung (Ideas) wird deshalb in Pakete zu 50 geteilt — eine kleine reine Funktion in `lib/walls/`, mit Test.

## 5. Bauen, in Schritten (je ein Commit, „5.13m: …“)

1. **Editor mit Suche und Arrange.** Route `app/c/[id]/edit/page.tsx` (Server: Schalter `WALLS`, `noindex`, lädt die Sammlung wie `/c/<id>`); Komponente `components/CollectionEditor.tsx` mit Band, Modi „Add covers“ / „Arrange“, Reiter Search und Sammlungsspalte; „Keep it“ statt „Save collection“. `WallPicker` bekommt ein festes Ziel (Auswahl und Streifen fallen weg, wenn die Sammlung rechts steht). Ansicht: „Edit collection“ statt der Werkzeuge; `/create`-Karten → Editor. *Prüfen:* Besitzer und Fremder, Umleitung, Reload mit `q`/`work`, 390 und 1280.
2. **Foto und Ideen im Editor.** `WallProposal` bekommt ein optionales Ziel (Knopftext, „already in“, „in with another cover“, „another cover“, gestrichelte Vorschau); `WallSample` und „Start from a collection“ bekommen „Add“ statt „Make“. Reine Logik (Markierung gegen die Sammlung, Pakete zu 50) nach `lib/walls/` mit Tests.
3. **`/create` mündet in den Editor.** Erster Klick im Picker → Sammlung anlegen → `router.replace` auf den Editor mit denselben Parametern; Foto/Zufall/Sammlung → Editor; beim Foto „or add them to …“.
4. **Buchseite.** `AddToWall` als Liste mit Häkchen je Sammlung (eine Operation je Klick an die jeweilige Sammlung), „Open the editor“; das Band „EDITING …“ aus `sessionStorage`. Desktop-Zeile neben „Share“ bleibt (0 px, SPEC F9.3); das Menü klappt darüber auf.
5. **Telefon.** Leiste und Blatt für die Sammlung im Editor, nach dem Muster von `CoverSheet`.
6. **Ziehen zum Verschieben** (Pointer-Ereignisse, `move` gibt es schon), die Pfeile bleiben für die Tastatur. Kann auch später kommen.

Schritte 1–3 sind eine Sitzung, 4 und 5 je eine halbe. Nach jedem Schritt: `npm run test:run`, `npx tsc --noEmit`, `npm run build`, im Browser gegen `npm run dev` bei 390 × 844 und 1280 × 800 (N14). Mit dem Bau werden SPEC F9.3–F9.5 und F9.8 umgeschrieben und eine Zeile in docs/features.md ergänzt.

## 6. Was gleich bleibt

Speicher, Besucher-ID (E22), Eigentum (nur der Browser mit der ID ändert), die Operationen, 48 Stunden für nicht behaltene Sammlungen, „Show it to others“, „Your ID“ und „Copy link“ mit `#id=`. Keine neue Anfrage an Open Library oder Google: der Editor nutzt dieselben Routen wie `/create` heute.

## 7. Entschieden (Julian, 2026-09-29, im Chat)

1. **Eigene Adresse `/c/<id>/edit`.** Die Ansicht bleibt für alle gleich.
2. **„Save collection“ heißt „Keep it“**, die Meldung „Saved.“ nach jeder Änderung fällt weg (§3).
3. **Die Ansicht bleibt ohne Werkzeuge; geordnet wird im Editor, im Modus „Arrange“.** Julian fragte, ob Entfernen, Verschieben und die Textfelder hinter einem „Arrange“-Knopf in der Ansicht stehen sollten oder ob man sie ohnehin nach „Edit“ sieht. Antwort: im Editor stehen sie schon, nur ist die Spalte für viele Cover zu schmal — deshalb „Arrange“ als zweiter Modus des Editors, nicht als Knopf der Ansicht.
4. **Das Band „Editing …“ auf der Buchseite: ja** (nur im Tab, `sessionStorage`).
5. **Wortwahl nach dem Bau** (Julian, 2026-09-29): „statt ‚not kept yet‘ lieber ‚not saved yet‘. ‚keep it‘ lassen. statt ‚done‘ lieber ‚stop editing‘“ — der Hinweis heißt „not saved yet“, der Knopf „Keep it“, der Ausgang aus dem Editor „Stop editing“.
6. **Reihenfolge: Schritte 1–3 zusammen, dann 4 (Buchseite), dann 5 (Telefon);** Ziehen (6) später, bis dahin Pfeile.
