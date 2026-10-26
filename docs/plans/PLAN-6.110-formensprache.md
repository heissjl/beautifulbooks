# Plan 6.110 und 6.111: eine Formensprache für die ganze Seite, und das Artefakt dazu

Stand: 2026-10-23, **Plan**, nichts gebaut. Quelle: die [Durchsicht der Gestaltung vom 2026-10-22](../tests/2026-10-22-design-durchsicht.md) (Julian: „kannst du einen plan für behebung der fehler machen?"). Sieben Schritte für die Seite (6.110 a–g), einer für das Design-System-Artefakt (6.111). Geschrieben für eine Sitzung, die den Code nicht kennt: je Schritt die Stelle, die Änderung, die Messung, der Test, und wer entscheidet.

## 0. Reihenfolge und Entscheidungen

| Schritt | Was | Entscheidung | Aufwand | Commit |
|---|---|---|---|---|
| 1 | (a) Kopfzeile der Buchseite bei 375 px | keine — Empfehlung unten, Julian kann widersprechen | 1 h | `6.110a` |
| 2 | (e) Platzhalter `ink-2` | keine | 30 min | `6.110e` |
| 3 | (d) Mittelpunkt-Zeilen | keine; die Regel in SPEC §5 wird präzisiert | 1–2 h | `6.110d` |
| 4 | (g) Fußzeile: Collections, Game, Shelf-Portrait | keine | 30 min | `6.110g` |
| 5 | (c) Flaggen im Marktschalter | **Julian:** weg oder als SVG | 15 min | `6.110c` |
| 6 | (b) Pillen gegen `.btn`/`.chip` | **Julian:** Pillen weg oder benannte Werkzeug-Variante | 3–4 h | `6.110b` |
| 7 | (f) Seitenleiste bei 800 px Höhe | **Julian** sieht zwei Fassungen an | 1 h Mockup + 1 h Bau | `6.110f` |
| 8 | 6.111 Artefakt nachziehen | A2 (Reiter-Zahlen) **Julian**; der Rest keine | 2 h | `6.111` |

Schritte 1–4 brauchen keine Entscheidung und können sofort, in dieser Reihenfolge, in einer Sitzung gebaut werden. 5 und 6 warten auf ein Wort von Julian, 7 auf seinen Blick, 8 auf 6 und A2. Jeder Schritt ein Commit mit seiner Nummer im Betreff; deployt wird einmal nach 1–4, danach einmal nach 5–7. **Jede Änderung wird bei 390 × 844 und 1280 × 800 angesehen** (SPEC N14), hell und dunkel, und mit dem deutschen Cookie, weil „Ergebnisse“ und „Sammlungen“ länger sind als ihre englischen Wörter — Maße per DOM (`innerWidth`, `scrollWidth`, `getBoundingClientRect`), nicht nach Augenmaß; im versteckten Browser-Bereich zuerst `document.getAnimations().forEach(a => a.finish())` (umgang.md §5).

**Die Analyse (CLAUDE.md-Liste):** keiner der Schritte ändert einen Shop-Link, einen Preis, eine Route oder ein Signal; (g) sind interne Links, die `originOf` schon als internen Einstieg klassiert. Das steht so in jeder Commit-Nachricht.

## 1. Schritt (a): die Kopfzeile der Buchseite bei 375 px

**Befund.** Ohne gewähltes Cover stehen in der Kopfzeile Rücklink, Marke mit Wortmarke, Lupe, „Deutsch“ und „Share“. Summe bei 375 px: Rücklink 66 + Lücke 16 + Wortmarke 133 + Lupe 32 + 8 + „Deutsch“ 52 + 8 + „Share“ 69 + Ränder 32 = **416 px**. Die linke Gruppe ist `flex min-w-0` (`components/SiteHeader.tsx:32`), die Wortmarke `shrink-0` (Zeile 40), `BackLink` `min-w-0` ohne `truncate` (`components/BackLink.tsx`) — also gibt der Rücklink nach: 8 px breit, das Wort liegt unter der Marke. Mit gewähltem Cover wandert „Share“ in die Peek-Leiste (`components/BookDetail.tsx:457`: `right={selected ? undefined : <ShareMenu …>}`), und die Zeile passt.

**Zwei Wege.**

1. *Das Wort des Rücklinks unter `sm` nur zeigen, wenn die Seite keinen eigenen Knopf hat.* `BookDetail` weiß das (`!selected`) und gäbe `BackLink` ein `compact`; das Wort kommt wieder, sobald ein Cover gewählt ist. Rechnung: 22 + 16 + 133 + 169 + 32 = 372 px — **passt bei 375 mit 3 px Luft, bei 390 mit 18 px**. Nachteil: das Wort springt beim Wählen eines Covers.
2. **Empfohlen: „Share“ unter `sm` als Symbolknopf** (das übliche Teilen-Symbol, 32 × 32 wie die Lupe, Wort als `aria-label` und `title`), ab `sm` wie heute. Rechnung: 66 + 16 + 133 + 32 + 8 + 52 + 8 + 32 + 32 = **379 px — 4 px zu viel bei 375**, darum dazu `BackLink` unter `sm` mit `truncate` auf `max-w-[5rem]` (das Wort „Results“ ist 50 px, „Ergebnisse“ 72 px und würde zu „Ergebn…“; „Home“/„Start“ passen). Nichts springt; das Wort bleibt auf der Buchseite, wo es die Durchsicht von außen verlangt hatte (6.64).

   Falls Julian das Symbol nicht will: Weg 1, oder „Deutsch“ unter `sm` zu „DE“ (spart 25 px; der `LocaleSwitcher` kennt die kurze Form noch nicht).

**Bau (Weg 2).** `components/ShareMenu.tsx` bekommt `iconOnly?: boolean` (unter `sm` per Klasse: Wort `hidden sm:inline`, Symbol `sm:hidden`, so bleibt es eine Komponente); `BookDetail.tsx:457` übergibt nichts Neues, die Klasse entscheidet. `BackLink` erhält für den Fall ohne `truncate` ein `max-w-[5rem] truncate sm:max-w-none`. In `SiteHeader.tsx:32` bleibt `min-w-0`.

**Messen.** Bei 375 und 390, Englisch und Deutsch, Buchseite ohne Cover: kein Element der Kopfzeile überlappt ein anderes (Rechtecke je Element, wie in der Durchsicht), der Rücklink ≥ 40 px breit, `scrollWidth` = `innerWidth`. Dann mit Cover (Peek-Leiste), dann die Jahrzehnte-Seite („‹ The wall“) und eine Sammlung (`truncate` schon da). Vorher/nachher-Bild nach `docs/tests/` (lokal).

**Test.** Keiner im Code möglich für Layout; die Messung geht in die Historie.

## 2. Schritt (e): Platzhalter in `ink-2`

**Befund.** `placeholder:text-ink-3` auf `bg-surface` an zehn Stellen (`SearchBar.tsx:170`, `HeaderSearch.tsx:120`, `BookSearch.tsx:65`, `WallIdField.tsx:75`, `InspirationEditor.tsx:392/407/703/859`, `CollectionEditor.tsx:360/370`). `ink-3` auf `surface` ist dunkel 4,23 (SPEC §5 Zahlen), WCAG 1.4.3 nimmt Platzhalter nicht aus.

**Bau.** Eine Zeile in `app/globals.css`, Schicht `base`: `::placeholder { color: var(--ink-2); }` — dann fallen die zehn Klassen weg (sie würden die Basisregel überschreiben, also entfernen). `ink-2` auf `surface`: hell ≥ 6, dunkel ≥ 6 (Tokens-Notiz). Dazu in `lab/palette/palettes.ts` `contrastRows` die Zeilen „ink-3 auf surface“ und „ink-2 auf surface“, damit die nächste Farbänderung sie rechnet. SPEC §5: ein Halbsatz („Platzhalter in `ink-2`, weil `ink-3` auf `surface` dunkel 4,23 erreicht“).

**Messen.** `getComputedStyle(input, '::placeholder').color` auf Startseite und `/create`, hell und dunkel. **Test:** `lab/palette/__tests__` (falls vorhanden) oder ein Vitest-Fall, der `contrastRows` für beide Schemata ≥ 4,5 verlangt.

## 3. Schritt (d): die Mittelpunkt-Zeilen

**Regel zuerst, in SPEC §5 (Bausteine):** *Ein Mittelpunkt trennt gleichartige, kurze Angaben in einer Liste — zwei Zählungen auf einer Karte („1,200 editions · 16 languages“), Titel in einer Aufzählung. Nie zwischen Aussagen, nie mehr als einer in einer Zeile für Leser.* Das legt die BookCard-Zeile und die Titel-Listen (`SuggestTool.tsx:174/229`, `WallPicker.tsx:133/139`, `EditingBand.tsx:32`, `AddToWall.tsx:168`, `CollectionEditor.tsx:162`) als erlaubt fest und nennt drei Stellen, die geändert werden:

| Stelle | Heute | Neu |
|---|---|---|
| `lib/decades.ts:155` (`decadeLine`) | „49 covers · 19 of 49 printings say paperback · 46 publishers, Sirius and Project Gutenberg among them · 5 languages“ | Zwei Sätze: „49 covers from 46 publishers, Sirius and Project Gutenberg among them, in 5 languages. 19 of 49 printings say paperback.“ (ein Verlag: „… from 1 publisher, Signet.“; eine Sprache: ohne „in …“; kein Format: nur der erste Satz) |
| `components/Versus.tsx:321` | „1 vote so far · 5,018 covers“ | „5,018 covers, 1 vote so far.“ / „… {votes} votes so far.“; der Entwicklungs-Hinweis als eigener Satz |
| `components/Versus.tsx:442` | „Not a cover? Report the left one · the right one“ | „Not a cover? Report the left one or the right one.“ (zwei Knöpfe bleiben) |
| `components/Versus.tsx:458` | „See this edition · all its covers“ | „See this edition or all its covers.“ |

**Bau.** `decadeLine` baut die Sätze aus Teilen; die Tests in `lib/__tests__/decades.test.ts:58–70` werden auf die neuen Sätze umgeschrieben (alle Fälle: ein Verlag, mehrere, eine Sprache, kein Format). Jeder geänderte `t()`-Satz braucht sein Deutsch in `lib/i18n/de.ts` — `lib/__tests__/i18n.test.ts` nennt die fehlenden; die Übersetzung tut den Job des Satzes („49 Cover von 46 Verlagen, darunter Sirius und Project Gutenberg, in 5 Sprachen.“). `app/privacy/page.tsx:61` („Datenschutzerklärung · last updated“) ist eine Zeile über die Seite, bleibt.

**Messen.** Jahrzehnte-Seite Gatsby bei 390 und 1280: die Zeile bricht auf höchstens zwei Zeilen; `/versus` Kopf und Meldezeile.

## 4. Schritt (g): die drei Wege in der Fußzeile

**Befund.** Unter `sm` ist die Navigation ausgeblendet (`SiteHeader.tsx:54`, bewusst: die Zeile ist voll), die Fußzeile (`components/SiteFooterView.tsx:31–35`) nennt „Your collections“, About, Imprint & contact, Privacy — nicht Collections, Game, Shelf-Portrait. Von einer Buchseite aus gibt es am Telefon keinen Weg dorthin außer über die Startseite.

**Bau.** In `SiteFooterView` vor „About“ dieselben drei Links wie in der Kopfzeile, auf allen Breiten (eine Fußzeile darf wiederholen, was oben steht; unter `sm` ist es der einzige Ort). Die Kopfzeile zeigt Game und Shelf-Portrait ohne Schalter — die Fußzeile macht es genauso, damit beide gleich sind; wenn einer der Schalter je in der Produktion aus ist, bekommen beide Stellen denselben Prop (`SiteFooter` nimmt `walls` schon so entgegen, CLAUDE.md: die Buchseite rendert die Fußzeile im Browser, Schalter als Prop). Deutsch: „Sammlungen“, „Spiel“, „Shelf-Portrait“ sind in `de.ts` schon da (Kopfzeile).

**Messen.** Fußzeile bei 375: die Links umbrechen sauber, nichts ragt über den Rand. **Analyse:** interne Links; `originOf` zählt den Einstieg aus einer Buchseite als intern wie heute — nichts anzupassen, in der Commit-Nachricht gesagt.

## 5. Schritt (c): die Flaggen — Julian entscheidet

`components/MarketSwitcher.tsx:28` zeigt `m.flag` (🇺🇸 🇬🇧 🇩🇪 aus `lib/market.ts`) vor US/UK/DE; die einzigen Emoji der Seite, auf Windows Buchstabenpaare. **Empfehlung: streichen.** „Shop in: US · UK · DE“ sagt alles, die Chips werden je rund 20 px schmaler, und die Reihe passt in der Schublade in eine Zeile. Alternative: drei winzige Inline-SVG-Flaggen in `currentColor` — das wären drei neue Zeichnungen im Artefakt (6.111 A5), für wenig. Bau: die `span`-Zeile raus, `flag` in `MARKETS` bleibt (die Tests prüfen Länder, nicht Flaggen — vorher `grep flag lib/__tests__`). Messen: die Chip-Zeile in der Seitenleiste bei 1280 und in der Schublade bei 390.

## 6. Schritt (b): die Pillen — Julian entscheidet

**Befund.** 68 `rounded-full` in `components/`, alle in den Leser-Werkzeugen; null auf Startseite, Suche, Buchseite, Sammlungen (dort `.btn` 6 px, `.chip` 3 px). In der Seitenleiste steht die Pille „+ Add to collection“ (`AddToWall.tsx:148`, 28 px) neben „Share“ als `.btn` (34 px).

**Entscheidung.** (1) **Pillen weg** — ein mechanischer Durchgang wie 6.84: die Werkzeuge nehmen die Bausteine der Kernseiten. (2) Werkzeug-Variante: `.btn-pill` als benannter Baustein im Artefakt, dann aber überall in den Werkzeugen gleich, und „+ Add to collection“ muss trotzdem zu „Share“ passen. **Empfehlung: (1)** — 6.84 hat die Form für die Seite entschieden, die Werkzeuge kamen danach aus anderen Sitzungen ohne die Regel, und ein zweiter Baukasten braucht einen Grund, den die Durchsicht nicht fand.

**Zuordnung (Weg 1).** Pille mit Tinte gefüllt (Haupthandlung: Search, Start, Save, Copy) → `.btn-accent`, höchstens eine je Ansicht, die übrigen `.btn`; Pille mit Rand → `.btn`; Pillen als Schalter (Calibre/Goodreads, 3 · 6 · 9, Titel-Vorlagen, Story/Post in den Teilen-Werkzeugen, `aria-pressed`) → `.chip`; „+ Add to collection“ → `.btn` (mit `aria-expanded` wie heute, Häkchen-Zustand als `.btn` mit Akzentrand). **Bleiben rund** (das Artefakt erlaubt `radius-full` für Punkte und runde Symbolknöpfe): die Faltungs-Abzeichen „+1“ (`CoverGallery.tsx:255/260`), die Pfeilknöpfe der Druck-Reihe (`BookDetail.tsx:755`), die Pins im Regalfoto (`WallPhoto.tsx:322`), die Beschriftung auf den Kacheln (`CollectionGrid.tsx:78`, ein Zähler), die Admin-Ansicht (`AdminCollections.tsx`, nicht öffentlich).

**Dateien** (aus `grep -rn rounded-full components`): `WallSample`, `WallPicker`, `StartFromPicker`, `WallIdField` (6), `InspirationShareTools` (2), `StartFromCollection`, `WallProposal` (4), `InspirationShared` (2 Konstanten), `InspirationToCollection`, `AddToWall`, `WallReview` (2), dazu die Editoren (`InspirationEditor`, `CollectionEditor`, `CurateTool`) — vor dem Bau die Liste frisch ziehen, Sitzungen seit dem 22.10. können Stellen dazugetan haben.

**Test.** `lib/__tests__/pills.test.ts` nach dem Muster von `sitename.test.ts`: liest `components/` und `app/`, zählt `rounded-full` außerhalb einer Erlaubnisliste (die fünf Stellen oben, je Datei) und schlägt bei jeder neuen fehl — so bleibt die Entscheidung, wie die Marke in `SITE_NAME`.

**Messen.** `/create`, `/shelfportrait`, `/c/<id>/edit` (Test-Besucher, nie Julians ID) und die Seitenleiste bei 390 und 1280, hell und dunkel; die Höhen in einer Zeile gleich (Add/Share beide 34 px). Zwei Bilder je Seite vorher/nachher nach `docs/tests/`, Julian sieht sie an, bevor deployt wird.

## 7. Schritt (f): die Seitenleiste bei 800 px Höhe — Julian sieht zwei Fassungen an

**Befund, berichtigt.** Das gewählte Cover ist bei `lg` schon auf 31 vh begrenzt (`BookDetail.tsx:855`, `lg:max-w-[min(100%,31vh)]`), bei 800 px also 248 × 372 px — nicht die volle Leistenbreite, wie die Durchsicht zuerst schrieb. Trotzdem beginnt die Leiste erst unter dem Titelblock (rund 135 px), dann Cover 372, Zeile „Add / Share“ 34, Bildnachweis 20, „2 printings with this cover“ mit Reihe (84 px Kacheln plus zwei Zeilen Beschriftung, rund 150), Verlag und ISBN 50 — „Get this printing“ und die Shop-Knöpfe liegen bei etwa 850–900 px, unter der Falte eines 800-px-Fensters; einziger Hinweis ist der schwebende „More ↓“ (`MoreBelow`). Die Zahlen sind aus dem hellen Screenshot und dem Code abgeleitet; **Schritt 1 ist die Messung** per DOM bei 1280 × 800 und 1440 × 900 (die zwei häufigsten Laptop-Höhen).

**Zwei Fassungen, als Mockup hinter einem Dev-Schalter** (`?side=a|b`, nur unter `next dev`, wie `?invites=` bei 6.109): **A** die Reihe „N printings with this cover“ wandert unter die Shop-Knöpfe (sie erklärt, sie verkauft nicht); **B** das Cover auf 24 vh (192 × 288 px bei 800) und die Reihe bleibt. Für beide: der Abstand vom Leistenanfang bis zum ersten Shop-Knopf, bei 800 und 900 px Höhe, hell und dunkel, dazu 390 × 844 (dort ist es die Schublade, F2.11 — die Reihenfolge dort folgt der Leiste, also mitprüfen). Julian wählt; Empfehlung A, weil das Cover der Grund ist, auf dem man steht, und 31 vh schon knapp ist.

**Grenze.** SPEC F2.11 beschreibt die Leiste als „die gewählte Ausgabe … Kauf-Links als ruhige Buttons“; die Reihenfolge der Blöcke ist dort nicht festgelegt, der Wechsel also keine Spec-Änderung — ein Satz in F2.11 hält die gewählte Reihenfolge fest.

## 8. Schritt 6.111: das Artefakt nachziehen

Das Design-System (https://claude.ai/artifact/NPsPWyaFeTuRowdNuoao4Y) wird über seine `project/`-Dateien fortgeschrieben (Artefakt-Werkzeug: `read` je Datei, Kopie unter einem Ordner im Scratchpad, ein `publish` mit `root` und allen geänderten Pfaden, der Index `design-system.json` zuletzt mit `lastChange`; Anleitung in seiner `SKILL.md`) — oder über `/design-sync` aus dem Repository, wenn das Werkzeug die Dateien so erzeugt, wie sie jetzt sind (vorher an einer Kopie prüfen, dass es Julians Textstellen nicht überschreibt; `craft.md`: „Keep authors' words“).

**Ohne Entscheidung, jetzt:** README-Abschnitte Layout (Kopfzeile mit drei Links; Startseite mit den Einladungs-Karten), Komponenten (BackLink, Peek-Leiste und Schublade, Marktschalter, Faltungs-Abzeichen, Aufklappzeile, „More ↓“, Einladungs-Karte, Teilen-Menü — je README mit Vorschau, nach dem Muster der sieben vorhandenen), Ikonografie (Chevron, Pfeil, `▸`, Editor-Glyphen; Flaggen je nach Schritt 5); `bundle.css` `::selection` über `color-mix` mit `var(--accent)`; SearchField-Vorschau mit Platzhalter `ink-2` (nach Schritt 2); `tokens.json` `meta.ref` und `meta.synced` auf den Stand des Commits; `lastChange` mit Datum und Notiz.

**Nach Julians Entscheidungen:** A2 — die Chip-README sagt, was gilt (Zahlen in den Reitern ja oder nein; heute ja, 6.71b); Schritt 6 — entweder keine Pillen (README: „never `radius-full` for a control“) oder der benannte Baustein `.btn-pill` mit Vorschau.

**Regel, in CLAUDE.md und ROADMAP 6.111 schon notiert:** ein Punkt, der `app/globals.css` oder eine dokumentierte Komponente ändert, zieht das Artefakt in derselben Sitzung nach. Damit das nicht vergessen wird: `lib/__tests__/designsystem.test.ts` liest `meta.synced` aus einer eingecheckten Kopie `docs/design-system/tokens.json` (die Datei kommt beim Nachziehen mit ins Repository, 10 KB) und schlägt fehl, wenn `app/globals.css` jünger ist als sie — gemessen über `git log -1 --format=%cI` beider Pfade im Test, nur lokal und in CI mit Historie. Ob Julian die Kopie im Repository will, fragt die Sitzung, die 6.111 baut; ohne sie bleibt es eine Regel ohne Wächter.

## 9. Abnahme

Nach 1–4: `npx tsc --noEmit`, `npm run test:run` (i18n- und decades-Tests grün), `npm run build`; Bilder bei 390 × 844 und 1280 × 800 nach `docs/tests/`; Deploy; **einmal** in der Produktion: `/book/OL468431W` bei 375 ohne Cover (Kopfzeile), die Jahrzehnte-Seite (Zeile), die Fußzeile — nicht mehr. Dann Roadmap: 6.110 je Buchstabe abhaken, Historie mit den Maßen, `docs/features.md` nur, wenn (g) als Funktion zählt (nein: ein Link). Nach 5–7 dasselbe noch einmal, und 6.111 schließt mit dem Link auf die neue Artefakt-Version in docs/identitaet.md.
