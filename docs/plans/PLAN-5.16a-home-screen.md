# Plan für Roadmap 5.16a: die Seite als Home-Bildschirm-Web-App

Geschrieben 2026-10-02 für eine Sitzung, die den Code nicht kennt. Julian, zur Analyse in [PLAN-5.16](PLAN-5.16-ios-app.md) §3: „ok, plan this version now". Weg A von dort, ausgearbeitet bis auf Datei und Zeile. Nichts gebaut.

**Stand: Plan 2026-10-02; Bau ein halber Tag Claude, Messung eine Stunde Julian am iPhone; eine Entscheidung vorab (§7).**

## 1. Ziel, Messlatte, Nicht-Ziel

**Ziel.** Wer die Seite in Safari auf dem iPhone „Zum Home-Bildschirm" legt, bekommt ein Symbol mit der Bildmarke und ein eigenes Fenster ohne Adressleiste, in dem jede Seite so aussieht und sich so bedient wie in Safari. Kein Konto, kein Store, kein neues Paket.

**Messlatte** (jede Zeile wird gemessen, nicht angesehen):

1. `/manifest.webmanifest` antwortet 200 mit `display: standalone`, Name, Farben und drei Symbolen; jede Symboldatei antwortet 200 und hat die Größe, die das Manifest nennt (Test, §5).
2. Der Kopf jeder Seite trägt `<link rel="manifest">`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` und `apple-mobile-web-app-status-bar-style` (am Dev-Server abgelesen, §6).
3. Am Gerät (§6, Julian): die Kopfzeile liegt frei unter der Statusleiste, die Peek-Leiste über der Home-Anzeige, ein Kauf-Link führt hin und zurück, Teilen öffnet das System-Blatt, die Sammlung aus Safari ist über den ID-Link erreichbar.
4. Nichts, was heute in Safari geht, geht im Standalone-Fenster nicht (N14 Regel 2) — insbesondere der Weg zurück, denn das Fenster hat keine Browser-Knöpfe.
5. Bei 390 × 844 und 1280 × 800 ändert sich im Browser **nichts Sichtbares** (N14 Regel 3): dieser Schritt fügt Metadaten und Dateien hinzu, keine Gestaltung.

**Nicht-Ziel.** Kein Service Worker (PLAN-5.16 §2: alte Zähler wären ein Verstoß gegen N12), kein Web Push (N11), kein Hinweis „Zum Home-Bildschirm" auf der Seite, kein Smart App Banner (das ist B), keine Android-Messung, kein `viewport-fit: cover` im ersten Schritt (§3, Begründung dort).

## 2. Befund im Code

- **`app/layout.tsx`:** `metadata` mit `metadataBase`, Titelvorlage, Beschreibung; `viewport` nur mit `themeColor` hell `#f4f0e8` / dunkel `#131110`. Kein `manifest`, kein `appleWebApp`, kein `viewportFit`. Next liest `app/icon.svg`, `app/favicon.ico` und `app/apple-icon.png` von selbst ein.
- **Symbole:** `scripts/build-icons.py` (Pillow) zeichnet die Bildmarke je Größe aufs Pixelraster, `LAYOUT` je Größe (16, 32, 48, 180). **Die 180-px-Datei ist deckend** auf Papierton (`rounded_rectangle` mit Ecke 0 und `PAPER`); die kleinen haben runde, durchsichtige Ecken. Es fehlen 192 und 512 px für das Manifest, davon eines als `maskable` (Android legt eine Maske darüber; der Inhalt muss in den inneren 80 % liegen).
- **`app/globals.css`:** `html` und `body` haben `background: var(--bg)`. Das zählt: im Standalone-Fenster füllt iOS die Ränder außerhalb des sicheren Bereichs mit dem Seitenhintergrund, und der ist damit Papier, nicht Weiß.
- **Kopfzeile** `components/SiteHeader.tsx`: `sticky top-0 z-20 … h-14`. An ihrer Höhe hängen `sticky top-14` in `CollectionEditor.tsx` (Z. 152), `top-20` in `EditingBand.tsx` (Z. 23), `lg:top-20` in `BookDetail.tsx` (Z. 461), `lg:top-32` in `CollectionEditor.tsx` (Z. 278). **Wer die Kopfzeile um einen Sicherheitsabstand wachsen lässt, muss alle vier nachziehen** — ein Grund, es im ersten Schritt nicht zu tun (§3).
- **Leisten am unteren Rand:** `CoverSheet.tsx` Z. 123 (`fixed inset-x-0 bottom-0`, Peek-Leiste; misst sich per `ResizeObserver` und gibt dem `body` genau ihre Höhe als `paddingBottom`, 6.57) und `CollectionSheet.tsx` Z. 57 (gleiches Muster), dazu `CurateTool.tsx` Z. 535 und `CoverGallery.tsx` Z. 241. Die Blätter darüber: `CoverSheet.tsx` Z. 145–153 (`fixed inset-0`, Inhalt ab `top-12`), `CollectionSheet.tsx` Z. 78–80; die Modale `CollectionEditor.tsx` Z. 204 und `CurateTool.tsx` Z. 687 (`fixed inset-0 … p-4`).
- **Speicher im Browser** (PLAN-5.16 §2): Markt und letzte Suchen in `localStorage`, `bb_visitor` vom Server. Das Standalone-Fenster hat einen **eigenen** Speicher; die Brücke für die Sammlung ist der ID-Link (`components/WallIdField.tsx`, `IdLinkNotice.tsx`).
- **Zurück:** die Kopfzeile trägt auf jeder Seite außer der Suche das Suchfeld und einen Zurück-Link (features.md, Suche); die Blätter haben „Close". Ob die Wischgeste vom Rand im Standalone-Fenster zurückführt, entscheidet iOS, nicht die Seite — Messpunkt A7.
- **Tests:** `lib/__tests__/seo.test.ts` prüft die Texte aus `lib/seo.ts` und weist „every / all / complete" zurück. Für das Manifest gibt es kein Muster; §5 legt eines nach demselben Schnitt an (reine Funktion in `lib/`, dünne Datei in `app/`).

## 3. Die eine Gestaltungsfrage: Sicherheitsbereich

Zwei Wege, und der billige zuerst:

| | `viewport-fit` bleibt `auto` (**Schritt 1**) | `viewport-fit: cover` (**nur wenn Schritt 1 in der Messung scheitert**) |
|---|---|---|
| Was iOS tut | legt die Seite in den sicheren Bereich; Statusleiste (Stil `default`) und Home-Anzeige liegen **außerhalb**, die Ränder tragen `html { background }` = Papier | zieht die Seite unter Statusleiste und Home-Anzeige; die Seite muss selbst `env(safe-area-inset-*)` als Abstand setzen |
| Zu ändern | `appleWebApp.statusBarStyle: 'default'`, sonst nichts | `viewport.viewportFit = 'cover'`; `padding-top: env(safe-area-inset-top)` an der Kopfzeile **und** an den vier Offsets aus §2; `padding-bottom: env(safe-area-inset-bottom)` an den vier Leisten; `top: calc(3rem + env(safe-area-inset-top))` am Blatt in `CoverSheet` und `CollectionSheet`; Abstand oben an den zwei Modalen |
| Risiko | ein Papierstreifen über der Kopfzeile und unter der Peek-Leiste, der auf dem Foto wie ein Rand aussieht | zehn Stellen, von denen jede bei 390 × 844 in Safari **und** im Fenster zu messen ist; die Offsets bleiben leicht stehen |

Schritt 1 ist die Fassung dieses Plans. Der zweite Weg wird nur gebaut, wenn Messpunkt A1 (§6) den Streifen als störend zeigt — und dann als eigener Commit mit den zehn Stellen aus der Tabelle, nicht als Nachbesserung in diesem.

**Korrektur zur Analyse vom selben Tag:** PLAN-5.16 §3 nannte `viewportFit: 'cover'` und die sicheren Zonen als Teil von A. Das ist nach dem Blick in den Code der teurere Weg, und er ist erst nach der Messung fällig.

## 4. Die Schritte

### 4.1 Manifest — `lib/manifest.ts` (rein) und `app/manifest.ts` (dünn)

`lib/manifest.ts` exportiert eine Funktion `siteManifest(): MetadataRoute.Manifest`-Form ohne Import aus `next` (der Typ wird lokal nachgebildet, damit `lib/` frei von `next` bleibt, Regel aus `lab/README.md`), mit:

| Feld | Wert | Warum |
|---|---|---|
| `name` | `Beautiful Books` | wie die Titelvorlage in `layout.tsx` |
| `short_name` | **Julians Entscheidung (§7)** — unter dem Symbol zeigt iOS etwa zwölf Zeichen; „Beautiful Books" hat fünfzehn | die Beschriftung kommt auf iOS aus `appleWebApp.title`, auf Android aus `short_name`; beide gleich setzen |
| `description` | der Satz aus `layout.tsx` | ein Text an einer Stelle: aus `lib/seo.ts` beziehen, nicht abschreiben |
| `id`, `start_url`, `scope` | `/` | eine Adresse; kein `?utm`, keine Kennung (N11) |
| `display` | `standalone` | das Fenster ohne Adressleiste; `fullscreen` nähme die Statusleiste weg, `minimal-ui` hieße Adressleiste |
| `background_color` | `#f4f0e8` | der Startbildschirm, bis die Seite steht; ein Wert, das Manifest kennt keinen Dunkelmodus — die Statusleiste folgt weiter `viewport.themeColor` |
| `theme_color` | `#f4f0e8` | dito |
| `lang`, `dir` | `en`, `ltr` | die Oberfläche ist Englisch (E9) |
| `icons` | `/icons/icon-192.png` (192, `any`), `/icons/icon-512.png` (512, `any`), `/icons/icon-512-maskable.png` (512, `maskable`) | §4.3 |

`app/manifest.ts`: `export default function manifest() { return siteManifest(); }` mit dem `MetadataRoute.Manifest`-Typ. Next liefert es unter `/manifest.webmanifest` und setzt den `<link rel="manifest">` selbst.

### 4.2 `app/layout.tsx`

In `metadata`:

```ts
appleWebApp: { capable: true, title: '<short_name aus §7>', statusBarStyle: 'default' },
```

`viewport` bleibt, wie es ist (§3). Nichts an `themeColor`. Kein `manifest:`-Feld nötig, die Datei-Konvention setzt den Link.

### 4.3 Symbole — `scripts/build-icons.py`

Zwei neue Einträge in `LAYOUT` und drei Ausgaben nach `public/icons/`:

| Datei | Größe | Vorschlag für `LAYOUT` (Kachel b × h, Lücke, Mitte b × h, Ecke) | Grund |
|---|---|---|---|
| `icon-192.png` | 192 | `(34, 49, 11, 45, 64, 0)` — die 180er Maße um 192/180 | wie `apple-icon.png`, deckend, Ecke 0 (iOS und Android runden selbst) |
| `icon-512.png` | 512 | `(91, 131, 28, 120, 171, 0)` | dito |
| `icon-512-maskable.png` | 512 | dieselbe Wand auf **70 %** skaliert, zentriert: `(64, 92, 20, 84, 120, 0)` | Androids Maske zeigt nur die inneren 80 %; 70 % lässt Luft |

Die Zahlen sind gerundete Skalierungen der 180er Zeile und **vor dem Commit anzusehen** (CLAUDE.md: Schwellen und Maße werden angesehen, nicht nur gerechnet) — bei 512 px fällt ein um ein Pixel versetztes Raster nicht auf, bei der Maske schon, wenn die Wand den Rand berührt. `apple-icon.png` bleibt; iOS nimmt es, nicht das Manifest. Eine 1024-px-Zeile ist eine Zeile mehr und gehört zu B (PLAN-5.16 §4.3), nicht hierher.

Der Docstring des Skripts nennt die neuen Dateien; `public/icons/` wird committet (die PNGs sind wenige KB, wie die vorhandenen).

### 4.4 Was absichtlich nicht angefasst wird

`robots.ts` und `sitemap.ts` (das Manifest ist keine Seite), `Analytics.tsx` (ein Standalone-Besuch zählt wie jeder; ob er als Aggregat erkennbar sein soll, ist eine Frage für 3.1, nicht für diesen Schritt), die Leisten und Offsets aus §2 (Weg 2 in §3), die Texte der Seite.

## 5. Test

`lib/__tests__/manifest.test.ts`, nach dem Schnitt von `seo.test.ts`:

1. `display === 'standalone'`, `start_url === '/'`, `scope === '/'`, `background_color` und `theme_color` gleich dem hellen `--bg` aus `app/globals.css` (die Datei lesen, wie der vorhandene Farbtest es tut).
2. `name`, `short_name` und `description` enthalten keines der drei verbotenen Wörter (N12).
3. Für jedes Symbol: die Datei unter `public/` existiert, und ihre Breite und Höhe aus dem PNG-Kopf (`pngjs`, server-only, in Tests erlaubt) sind die im Manifest genannten; das `maskable`-Symbol ist 512 × 512.
4. `appleWebApp.title` in `layout.tsx` gleich `short_name` — nicht importierbar (die Datei zieht Schriften); stattdessen den Wert in `lib/manifest.ts` als Konstante `APP_TITLE` halten und in `layout.tsx` von dort importieren, dann ist der Test ein Blick auf eine Stelle.

Dazu `npx tsc --noEmit`, `npm run test:run`, `npm run build` (Pflicht vor „fertig").

## 6. Messung

**Am Dev-Server (Claude, Playwright gegen `npm run dev`, Chromium ist im Container):** `curl` auf `/manifest.webmanifest` und die drei Symbole; der Kopf von `/`, `/book/<id>` und `/collections` auf die vier Meta-Tags aus Messlatte 2; ein Screenshot der Startseite bei 390 × 844 und 1280 × 800 vor und nach dem Commit, pixelgleich bis auf das Datum (Messlatte 5).

**Am Gerät (Julian, iPhone, Safari → Teilen → „Zum Home-Bildschirm"; Bericht als `docs/tests/<Datum>-home-screen.md`, Bilder bleiben lokal):**

| Nr. | Frage | Erwartung in Schritt 1 (§3) |
|---|---|---|
| A1 | Liegt ein Papierstreifen über der Kopfzeile und unter der Peek-Leiste, und stört er? | ja, ein Streifen; ob er stört, entscheidet den Weg 2 aus §3 |
| A2 | Eine in Safari angelegte Sammlung: ist sie im Fenster „meine"? Trägt der ID-Link sie hinüber? | nein, eigener Speicher; der Link soll tragen |
| A3 | Ein Kauf-Link (`/go/…`): öffnet er den Händler im Safari-Blatt der App, und führt „Fertig" zur Wand zurück? | Blatt erwartet; die Weiterleitung beginnt auf der eigenen Domain, das macht den Fall unsicher |
| A4 | „Share" → System-Blatt; „Copy link" → Zwischenablage? | beides ja |
| A5 | Nach sieben Tagen ohne Öffnen: stehen die letzten Suchen noch? | Erinnerung sagt ja (Ausnahme für Home-Bildschirm-Apps); erst die Messung sagt es |
| A6 | Regalfoto → „Take Photo": Kamera, Bild, Pins? | ja, das Fenster ist Safari |
| A7 | **Zurück ohne Browser-Knöpfe:** von der Wand zur Trefferliste, vom Blatt zur Wand, von einer Sammlung zur Übersicht — per Wischgeste vom linken Rand und per Zurück-Link der Kopfzeile | der Link muss reichen; die Geste ist Zugabe |
| A8 | Die Beschriftung unter dem Symbol: ganz zu lesen oder mit „…"? | hängt an §7 |

Jede Zeile wird ein Satz in `docs/history.md`; A1 und A7 entscheiden, ob ein zweiter Commit folgt.

## 7. Entscheidung vorab (Julian)

**Die Beschriftung unter dem Symbol.** iOS zeigt rund zwölf Zeichen, „Beautiful Books" sind fünfzehn. Kandidaten: „Beautiful Books" und sehen, wo iOS kürzt (A8); „Covers"; „Book Covers". Der Wert steht einmal in `lib/manifest.ts` (`APP_TITLE`) und wird von Manifest und `appleWebApp.title` gelesen.

## 8. Reihenfolge und Aufwand

| Schritt | Was | Aufwand |
|---|---|---|
| 1 | `lib/manifest.ts`, `app/manifest.ts`, `appleWebApp` in `layout.tsx` | eine Stunde |
| 2 | `build-icons.py` erweitern, drei PNGs ansehen und committen | eine Stunde |
| 3 | Test (§5), `tsc`, Tests, Build | eine Stunde |
| 4 | Messung am Dev-Server (§6), Screenshots vorher/nachher | eine Stunde |
| 5 | **ein Commit** „5.16a: …", Zeile in `docs/features.md`, Eintrag in `docs/history.md`, Punkt abhaken | 30 Minuten |
| 6 | Julian: A1–A8 am iPhone, Bericht | eine Stunde |
| 7 | nur wenn A1 oder A7 es verlangen: Weg 2 aus §3 als zweiter Commit | ein halber Tag |

Schritte 1–5 sind der halbe Tag aus der Analyse; Schritt 7 ist der Teil, den die Analyse unterschätzt hatte, und er ist bedingt.
