# Plan für Roadmap 5.16: die Seite als iOS-App

Geschrieben 2026-10-02 für eine Sitzung, die den Code nicht kennt. Julian: „create a branch and figure out what we would need to do to offer the website as an iOS app". Nichts ist gebaut; der Plan ist die Antwort auf die Frage, mit Preisen, und die Entscheidungen stehen in §7.

**Stand: Analyse 2026-10-02, drei Wege mit Preis; Empfehlung in §1; sechs Entscheidungen bei Julian (§7).**

## 1. Das Ergebnis in sechs Sätzen

1. **Es gibt drei Wege, und sie schließen einander nicht aus:** (A) die Seite als **Home-Bildschirm-Web-App** (Manifest, Statusleiste, Symbole), (B) die Seite in einer **nativen Hülle** (Capacitor, WKWebView) im App Store, (C) eine **native App** gegen die vorhandenen `/api/*`-Routen.
2. **A kostet einen halben Tag und kein Konto**, B kostet 99 USD im Jahr, einen Mac oder Xcode Cloud, zwei bis drei Tage Bau und ein Prüfrisiko, C kostet Wochen und eine dritte Oberfläche, die N14 dann ebenso bindet wie Telefon und Desktop.
3. **Der Haken bei B ist nicht die Technik, sondern Apples Regel 4.2 „Minimum Functionality":** eine App, die „nur eine verpackte Website" ist, wird abgelehnt, und 4.2.2 nennt ausdrücklich „a collection of links" — die Seitenleiste *ist* eine Sammlung von Links. Die Hülle ist nur zu verantworten, wenn sie etwas kann, was Safari nicht kann; heute gibt es das nicht (§4.7).
4. **Zwei Rechtsfragen stellt der App Store, die das Web nicht stellt:** fremde Cover-Bilder vor einem Gatekeeper, der nach Rechten fragen darf (5.2.1, dieselbe Frage wie 5.5), und der **Händlerstatus nach dem Digital Services Act**, der am Umschalttag (Phase 4) Julians Telefonnummer auf die Store-Seite bringt — genau das, was das kleine Impressum vermeidet ([Recht §1](../recht-hobbyseite.md)).
5. **Was A baut, braucht B ohnehin:** sichere Zonen am Rand, Symbole, das Verhalten des getrennten Speichers. A ist deshalb kein Umweg.
6. **Empfehlung:** A jetzt als eigenen Schritt mit Messung auf Julians iPhone; B erst, wenn die Domain (0.5) steht, eine native Funktion gewählt und gebaut ist und Julian eingeschrieben ist; C nicht, solange die Seite keine Besucher hat, die eine dritte Oberfläche tragen (3.1).

## 2. Befund im Code — was eine App heute vorfindet

- **Next 16.1.4, App Router, SSR und ISR**, 18 Seiten, 29 API-Routen. Ein statischer Export ist nicht möglich (dynamische Routen `/book/[id]`, `/c/[id]`, die API): **jede der drei Formen ist online-only.** Offline gibt es nichts zu zeigen, und ein Service Worker, der Seiten vorhält, zeigte alte Zähler — der Widerspruch zwischen Zähler und Text ist genau das, was F2.3 und N12 verbieten. Kein Service Worker.
- **Browser-APIs im Client** (gezählt 2026-10-02): `navigator.share` und `navigator.clipboard` (`components/ShareMenu.tsx`, `WallView.tsx`, `WallIdField.tsx`, `IdLinkNotice.tsx`, alle mit Fallback), `localStorage` (Markt, letzte Suchen, Ziel-Sammlung `bb.wall.target`, Land der Buchläden), `sessionStorage` (Ladeszene, Bearbeitungsmodus), Cookie `market` aus JavaScript und **`bb_visitor` vom Server** (`app/api/walls/guard.ts`: `SameSite=Lax`, `Secure`, `maxAge`), ein `<input type="file" accept="image/*">` für das Regalfoto (`components/WallPhoto.tsx`, ohne `capture`), `matchMedia` (reduced-motion, hover, Desktop-Breite), `IntersectionObserver`.
- **`app/layout.tsx`:** `viewport.themeColor` hell und dunkel ist gesetzt; **kein `viewportFit`, kein `env(safe-area-inset-*)` im CSS, kein Manifest, kein `appleWebApp`.** `app/apple-icon.png` ist die Bildmarke bei 180 px (576 Byte, `scripts/build-icons.py`), `app/icon.svg` die Vektorfassung; ein PNG mit 192, 512 und 1024 px gibt es nicht.
- **Markt** (`lib/market.ts`): Cookie, `x-vercel-ip-country`, `Accept-Language`. Ein WKWebView schickt beide Header; nichts zu ändern.
- **Analytics** (`components/Analytics.tsx`): Vercels Skript, ohne Cookie, Suchbegriff geschwärzt. Läuft in jeder Form gleich; für den Store muss es in den Datenschutz-Angaben stehen (§6).
- **Links nach außen:** `/go/<provider>/<isbn>` antwortet mit einer Weiterleitung zum Händler, das Teilen-Menü mit `intent`-Adressen und `mailto:`, die Ausgaben mit Links auf den Open-Library-Datensatz. In einer Hülle landen sie *in* der App, ohne Zurück — §4.2.
- **Bekannt aus der Historie:** iOS meldet `prefers-reduced-motion: reduce` auch im Stromsparmodus ([Historie](../history.md), 2026-09-10); das gilt in Home-Bildschirm und Hülle genauso.
- **Hinter Passwort oder Schalter:** `/curate`, `/suggest` (Passwort), `/versus` (`HOTORNOT`), `/create` und `/c` (`WALLS`). Ein Prüfer bei Apple sieht die Passwortseiten nur, wenn er die Adresse kennt; sie sind nirgends verlinkt.

## 3. Weg A — Home-Bildschirm-Web-App

**Was zu bauen ist** (ein halber Tag, kein Konto, kein neues Paket):

1. `app/manifest.ts` (`MetadataRoute.Manifest`): `name`, `short_name` „Beautiful Books", `start_url: '/'`, `display: 'standalone'`, `background_color` und `theme_color` aus der Palette (hell `#f4f0e8`), Symbole 192 und 512 px als PNG, dazu eines mit `purpose: 'maskable'` — `scripts/build-icons.py` um die drei Größen erweitern. Die Bildmarke auf transparentem Grund bekommt von iOS einen schwarzen Hintergrund; das Home-Bildschirm-Symbol braucht den Papierton als Fläche.
2. `metadata.appleWebApp = { capable: true, title: 'Beautiful Books', statusBarStyle: 'default' }` in `app/layout.tsx`. Ohne `capable` öffnet iOS die Seite vom Home-Bildschirm in Safari mit Adressleiste — das Manifest allein reicht auf iOS nicht in jeder Version; beides setzen.
3. `viewport.viewportFit = 'cover'` **und** `padding-top: env(safe-area-inset-top)` an der Kopfzeile, `padding-bottom: env(safe-area-inset-bottom)` an der Peek-Leiste (`CoverSheet.tsx`), der Telefon-Leiste des Editors und dem Bearbeitungsband. Ohne das liegt die Statusleiste im Standalone-Fenster über dem Suchfeld.
4. Nichts, was zum Hinzufügen auffordert: ein Hinweis „Zum Home-Bildschirm" wäre ein Satz über eine Einstellung, die die Seite nicht kennt (N12), und er gilt nur in Safari.

**Was dabei anders ist als in Safari, und darum gemessen wird** (auf Julians iPhone, 390 × 844, je ein Satz in die Historie):

| Nr. | Frage | Warum sie zählt |
|---|---|---|
| A1 | Liegt die Statusleiste über der Kopfzeile, und ist die Peek-Leiste über der Home-Anzeige frei? | Schritt 3 oben; nur am Gerät zu sehen, der Simulator im Browser hat keine Kerbe |
| A2 | **Die Home-Bildschirm-App hat einen eigenen Speicher**, getrennt von Safari: `bb_visitor`, Markt, letzte Suchen. Eine in Safari angelegte Sammlung ist in der App nicht „meine". Trägt der ID-Link (`WallIdField`, `IdLinkNotice`) sie hinüber? | Das ist die vorhandene Brücke; wenn sie trägt, braucht es keinen neuen Satz, sonst einen auf `/create` |
| A3 | Öffnet `/go/…` den Händler im Safari-Blatt der App, und führt das Blatt zurück? | Sonst verliert der Leser die Wand beim ersten Kauf-Link |
| A4 | Erscheint bei „Share" das System-Blatt (`navigator.share`), und kopiert „Copy link"? | Beide haben einen Fallback; zu prüfen ist, dass der Fallback nicht der Normalfall ist |
| A5 | Überlebt `localStorage` sieben Tage ohne Besuch? WebKit hat 2020 eine Sieben-Tage-Löschung für von Skripten geschriebenen Speicher eingeführt und Home-Bildschirm-Apps davon ausgenommen; **das ist eine Erinnerung, keine Messung** | Letzte Suchen und Markt hängen daran; `bb_visitor` nicht, der Cookie kommt vom Server |
| A6 | Bricht das Regalfoto (`WallPhoto`) mit „Take Photo" durch? | Im Standalone-Fenster ist das Safari; in der Hülle (§4.1) ist es die Stelle, an der eine App abstürzt |

**Nicht-Ziel von A:** kein Service Worker (§2), kein Web Push (ein Push-Abonnement ist eine Kennung, N11), keine Android-Besonderheiten (Chrome installiert aus demselben Manifest; nicht gefragt, nicht gemessen).

**Was A nicht bringt:** keine Präsenz im App Store, keine Suche dort, kein Symbol, das jemand *findet* — nur eines, das jemand *anlegt*. Für den Engpass aus dem [Stand](../../ROADMAP.md#stand) („niemand kennt die Seite") ändert A nichts.

## 4. Weg B — die Seite in einer Hülle im App Store

### 4.1 Die Hülle

- **Capacitor** (`@capacitor/core`, `@capacitor/ios`; 8.5.2 am 2026-10-02 bei npm) legt einen Ordner `ios/` mit einem Xcode-Projekt an, das einen WKWebView öffnet. `capacitor.config.ts` mit `server: { url: 'https://<domain>' }` lädt die laufende Seite; Capacitor beschreibt diese Einstellung als Live-Reload für die Entwicklung, technisch verbietet nichts den Betrieb, aber die App enthält dann **keine eigene Seite** und zeigt ohne Netz eine weiße Fläche. Die Hülle braucht einen nativen Offline-Bildschirm mit einem Satz und „Try again" (dieselbe Regel wie F1.7: ein Ausfall heißt nicht „nichts gefunden").
- **Ein eigener Zusatz im User-Agent** (`appendUserAgent: 'BeautifulBooks-iOS/<version>'`), damit der Server App-Besuche als Aggregat zählen kann, ohne eine Kennung (N11, E14). Dasselbe Feld sagt der Firewall (2.4), dass das keine Bot-Hülle ist.
- **Info.plist:** `NSCameraUsageDescription` und `NSPhotoLibraryUsageDescription` sind **Pflicht, nicht Kür**: der Datei-Knopf des Regalfotos bietet in einem WKWebView „Take Photo" an, und eine App ohne den Kamera-Text stürzt an dieser Stelle ab. Das ist Messpunkt B4.
- **Plugins:** `@capacitor/browser` für alles, was nicht auf der eigenen Domain liegt (§4.2). `@capacitor/share` ist nicht nötig, solange `navigator.share` im WKWebView das System-Blatt öffnet (Messpunkt B3). Ein Barcode- oder Kamera-Plugin erst mit der Funktion aus §4.7.
- **Build-Ziel iPhone only.** iPad-Unterstützung verlangt iPad-Screenshots und eine Oberfläche, die bei 1024 px nicht die Telefon-Schublade ist; `useIsDesktop` schaltet ab einer Breite, die ein iPad im Querformat erreicht — das wäre zu prüfen, bevor man das Häkchen setzt. Ohne das Häkchen gibt es nichts zu prüfen.

### 4.2 Was aus der Hülle heraus muss

Jede Adresse außerhalb der eigenen Domain verlässt den WKWebView: die Weiterleitungen von `/go/`, die `intent`-Adressen des Teilen-Menüs, `mailto:`, die Datensatz-Links zu Open Library, die Links der Buchläden (5.12). In Capacitor ist das eine Regel im nativen Navigations-Delegate (`decidePolicyFor`), die fremde Hosts an `SFSafariViewController` gibt; dort gibt es „Fertig", und die Wand liegt noch da. Ohne diese Regel ist der erste Kauf-Link das Ende der App-Sitzung.

### 4.3 Was Apple verlangt

| Was | Wer | Preis |
|---|---|---|
| Apple Developer Program, Einzelperson, Apple-ID mit Zwei-Faktor | Julian | 99 USD im Jahr; Apples Identitätsprüfung dauert bis zu zwei Tage |
| App Store Connect: Name (ist „Beautiful Books" frei? vorher suchen), Untertitel, Beschreibung, Schlüsselwörter, Kategorie, Altersfreigabe | Julian, Text von Claude | eine Stunde |
| Symbol 1024 × 1024 PNG **ohne Transparenz** | Claude (`build-icons.py`) | mit A erledigt |
| Screenshots 6,9" und 6,5" (Pflicht), aus der Seite bei Gerätebreite gerendert | Claude | eine Stunde, Playwright |
| Datenschutz-URL (`/privacy`), Support-URL (`/contact`) | vorhanden | — |
| **Privacy Nutrition Labels**, die mit `/privacy` übereinstimmen: Vercel Web Analytics → „Product Interaction, not linked to you"; die Sammlung (E22) → eine Kennung, deren Hash gespeichert wird; Klickzählung → Aggregat | Julian trägt ein, Claude liefert die Liste | 30 Minuten |
| Exportkontrolle: nur HTTPS → Ausnahme | Julian | ein Häkchen |
| Prüfnotizen: wie der Prüfer die Sammlung und das Spiel erreicht; `/curate` und `/suggest` nicht erwähnen, sie sind nicht verlinkt | Claude | — |

### 4.4 Bauen ohne Mac

Xcode läuft nur auf macOS. Wege, in der Reihenfolge des Preises:

| Weg | Was | Preis |
|---|---|---|
| Julians Mac, falls es einen gibt | Xcode, `npx cap open ios`, Archiv, Upload | 0 |
| **Xcode Cloud** | Apple baut aus dem GitHub-Repo, signiert, lädt in TestFlight; 25 Rechenstunden im Monat sind im Programm enthalten | 0 über die 99 USD hinaus |
| Codemagic | wie oben, 500 Minuten im Monat frei | 0 |
| GitHub Actions, macOS-Runner | frei nur für öffentliche Repositories, sonst zehnfache Minuten | hängt an der Sichtbarkeit des Repos |

**Nicht gemessen, vor B1 zu prüfen:** ob `npx cap add ios` den Ordner `ios/` unter Linux erzeugt (es schreibt Vorlagen; CocoaPods ist seit Capacitor 6 nicht mehr Pflicht). Wenn nicht, braucht der erste Commit des Ordners einmal einen Mac. Signatur und Profil in CI laufen über einen App-Store-Connect-API-Schlüssel, der als Secret liegt, nie in der Datei (dieselbe Regel wie beim Google-Schlüssel).

### 4.5 TestFlight als Stufe für die Freunde

TestFlight verteilt Builds ohne Store: interne Tester (Mitglieder des Teams), externe über einen öffentlichen Link (bis 10.000; der erste Build je Version durchläuft eine leichtere Prüfung), Builds verfallen nach 90 Tagen. Das ist die App-Fassung des Musters von 5.10a/5.10b: Freunde zuerst, und die Rückmeldungen kommen, bevor ein Prüfer entscheidet.

### 4.6 Das Prüfrisiko, konkret

| Regel | Wortlaut sinngemäß | Trifft die Seite |
|---|---|---|
| **4.2 Minimum Functionality** | „should include features, content, and UI that elevate it beyond a repackaged website" | **Ja, vollständig:** die Hülle *ist* die Website. Das ist der Ablehnungsgrund, nicht ein Nebenrisiko |
| **4.2.2** | nicht „simply a web clipping, content aggregator, or a collection of links" | Die Seitenleiste besteht aus Händler-Links; ein Prüfer, der die Suche überspringt, sieht genau das |
| **5.2.1 Intellectual Property** | keine Inhalte ohne Rechte | Die Cover sind fremde Bilder aus zwei Katalogen; die Seite verweist auf die Quelle. Dieselbe offene Frage wie 5.5 und [Risiko C](../risiken-2026-09-12.md), nur dass hier ein Gatekeeper *fragen* kann |
| 3.1.5(a) Physical Goods | Käufe körperlicher Waren außerhalb der App ohne In-App-Kauf erlaubt | Kauf-Links sind in Ordnung, auch mit Provision (Phase 4) |
| 2.5.6 | Web-Inhalte nur über WebKit | erfüllt |
| 5.1.1 | kein Kontozwang | erfüllt, es gibt kein Konto |

**Die Antwort auf 4.2 kann nur eine Funktion sein, nicht ein Text.** Deshalb:

### 4.7 Was nur eine App könnte — und was davon heute existiert

Julian, 2026-10-02, auf die Analyse: „what potential features could fulfil this requirement". Geordnet danach, wie viel die Funktion über Safari hinaus bringt; die rechte Spalte ist der Haken.

| Rang | Kandidat | Was er braucht | Haken |
|---|---|---|---|
| 1 | **Regalfoto mit Erkennung auf dem Gerät** (5.11a): iOS bringt Rechteck-Erkennung und Dokument-Segmentierung (Vision) mit — ohne Schlüssel, ohne Upload, bis der Leser bestätigt. Der [Plan 5.11a](PLAN-5.11a-regalfoto-zuverlaessig.md) hängt genau an der Kantensuche und wartet auf eine Entscheidung über einen Segmentierer | eine native Kamera-Ansicht, die Rücken-Ausschnitte an die vorhandene Route gibt | ungemessen; Rücken in einer Reihe sind nicht das, wofür Rechteck-Erkennung gebaut ist. Der einzige Kandidat, der ein offenes Roadmap-Problem löst statt eine Funktion zu erfinden |
| 2 | **Widget** auf dem Home-Bildschirm: Cover der Woche aus Julians Kuratierung oder eine Kachel einer veröffentlichten Sammlung, täglich aus einer kleinen JSON-Route | ein SwiftUI-Widget, eine Route (verwandt mit der RSS-Idee der Ideen-Tabelle) | billig und nur nativ, im ersten Screenshot sichtbar, keine Kennung — aber eine Tür, kein Werkzeug; allein dünn |
| 3 | **Share-Extension „Welche Ausgabe habe ich?"** (Ideen-Tabelle, Zeile 1): ein Foto aus Fotos oder Kamera an die App teilen, Ausgabe und ISBN zurück | zuerst die Bildabstands-Suche eines **Fotos** (Perspektive, Glanz) gegen `data/cover-index.json`; die Faltung vergleicht Scans mit Scans | die beste Geschichte, die Extension ein Tag — der Abgleich ist das Projekt; nichts gebaut |
| 4 | **Barcode im Suchfeld** (Zeile 2): die Kamera liest die ISBN, 6.29 übernimmt | ein Kamera-Plugin | **falls Safari auf iOS `BarcodeDetector` hat, kann das Web es schon** und der Unterschied verschwindet — vor dem Zählen messen |
| 5 | **Core Spotlight**: geöffnete Werke und Sammlungen in der Suche des iPhones („Gatsby covers") | ein Index auf dem Gerät, nichts verlässt es (N11 hält) | für einen Prüfer unsichtbar, wenn die Prüfnotiz nicht darauf zeigt |
| 6 | **Eigene Sammlung offline**, mit Covern auf dem Gerät | ein lokaler Cache der Sammlung | das einzige Offline-Stück einer sonst online-only Seite; der Prüfer bräuchte eine Sammlung, um es zu sehen |
| — | Push | — | ausgeschlossen durch N11 (ein Push-Token ist eine Kennung), es sei denn, Julian hebt N11 dafür auf wie bei E22 |
| — | Ladenfinder mit Standort (5.12) | — | der Browser hat Geolocation ebenso; 5.12 hat sich gegen einen Finder entschieden |
| — | AR, Haptik im Spiel | — | kosmetisch, trägt 4.2 nicht allein |

**Regel 4.2 wird von einem Prüfer mit Minuten beurteilt:** die Funktion muss auf dem ersten Bildschirm oder im ersten Screenshot liegen (ein Scan-Knopf im Suchfeld, ein Widget im Screenshot), sonst zählt sie nicht, auch wenn sie da ist.

**Folgerung:** Heute gibt es keine Funktion, die eine Hülle vor 4.2 trägt. B beginnt mit einem dieser Kandidaten als eigenem Roadmap-Punkt (zuerst als `lab/`-Experiment mit Messung, Regel aus `lab/README.md`), nicht mit dem Xcode-Projekt. Rang 1 ist zugleich der nächste Schritt von 5.11a; wenn Julian beide will, ist das ein Punkt, nicht zwei.

### 4.8 Die Domain vor dem Store

Die Hülle backt `server.url` ein, die Store-Seite zeigt die Adresse, Universal Links (ein Link auf `/book/…` öffnet die App) brauchen `/.well-known/apple-app-site-association` (JSON ohne Endung, aus `public/.well-known/` ausgeliefert) und das Associated-Domains-Entitlement, der Smart App Banner in Safari `metadata.itunes = { appId }` in `app/layout.tsx`. Alles davon hängt an der Domain; auf `vercel.app` gebaut, wird es nach 0.5 noch einmal gemacht, und ein App-Update ist eine Prüfung. **0.5 vor B.**

### 4.9 Firewall und Bot-Abwehr

Der User-Agent eines WKWebView enthält kein `Safari/`. Vercels Challenge-Modus (2.4) stellt eine JavaScript-Aufgabe, die ein WebView löst; der Attack-Challenge-Modus zeigt eine Zwischenseite, die in der Hülle die ganze App ist. **Vor der Einreichung einmal in der Preview messen**, mit dem Zusatz aus §4.1 im User-Agent; nie gegen Produktion polten (CLAUDE.md).

### 4.10 Aufwand

| Schritt | Wer | Aufwand |
|---|---|---|
| B0 Kandidat aus §4.7 wählen, als Lab-Experiment messen | Julian wählt, Claude misst | eine Sitzung je Kandidat |
| B1 Hülle: `ios/`, Konfiguration, Navigationsregel, Offline-Bildschirm, User-Agent, Info.plist, Symbole | Claude | zwei bis drei Tage |
| B2 Einschreibung, Zertifikate, Xcode Cloud oder Mac | Julian | ein Tag Wartezeit, eine Stunde Arbeit |
| B3 TestFlight an die Freunde, Messpunkte B1–B5 | beide | eine Woche Laufzeit |
| B4 Store-Seite, Screenshots, Labels, Einreichung, Prüfrunden | Julian trägt ein, Claude liefert | ein bis zwei Wochen Kalender, davon wenig Arbeit |

**Messpunkte der Hülle** (zusätzlich zu A1–A6, die im WKWebView erneut gelten): B1 kalter Start bis zur Startseite gegen Safari; B2 Offline-Bildschirm statt weißer Fläche; B3 `navigator.share` öffnet das System-Blatt; B4 „Take Photo" im Regalfoto stürzt nicht ab; B5 ein `/go/`-Link öffnet das Safari-Blatt und „Fertig" zeigt die Wand.

## 5. Weg C — eine native App gegen `/api/*`

Was zu portieren wäre: `foldDuplicateCovers` und `hamming` (die Faltung läuft im Browser, `lib/imagesig.ts`), `mergeWorkPages` und `orderGroups` (`lib/pages.ts`), der Link-Plan (`lib/buylinks.ts`), die Verdikte — deren Wortlaut lebt nach CLAUDE.md **an einer Stelle**, `lib/verdicts.ts`, weil zwei Kopien schon einmal auseinanderliefen; eine Swift-Kopie wäre die dritte, es sei denn, der Server liefert die Sätze —, das signierte Paar des Spiels, und die ganze `BookDetail`. Die API bräuchte eine Versionierung (eine alte App gegen eine neue Antwort) und ein eigenes Rate-Limit-Profil. N14 („jeder Zustand, den der Desktop hat, hat das Telefon auch") gälte dann für drei Oberflächen, und jede Änderung an der Wand wird zweimal gebaut.

**Nicht empfohlen**, und zwar nicht aus Vorsicht, sondern aus dem Stand: die Seite hat keine Besucher, die eine dritte Oberfläche tragen, und keine Funktion, die der Browser nicht kann (§4.7). Auslöser: Zahlen aus 3.1 und ein gebauter Kandidat aus §4.7.

## 6. Recht und Konten, die nur der Store stellt

- **Impressum und Datenschutz gelten für die App wie für die Seite** (Telemedium, § 18 MStV; Art. 13 DSGVO). `/contact` und `/privacy` aus der App erreichbar reicht; die Store-Seite verlangt die Datenschutz-URL ohnehin. Der Datenschutztext muss die App nennen, sobald sie ein eigenes Angebot ist, und seine Aussagen müssen mit Apples Labels übereinstimmen (§4.3) — zwei Texte über dieselbe Verarbeitung, die auseinanderlaufen können wie einst die Verdikte.
- **Händlerstatus (DSA).** Apple verlangt im EU-Storefront eine Erklärung, ob der Anbieter Händler ist; bei einem Händler stehen **Anschrift, Telefonnummer und E-Mail** öffentlich auf der Store-Seite. Im Hobby-Modus ohne Provision (E20) ist „kein Händler" vertretbar; **mit Provision (Phase 4) ist er Händler**, und die Telefonnummer steht dann dort, wo das kleine Impressum sie bewusst weglässt ([Recht §1](../recht-hobbyseite.md)). Diese Entscheidung gehört zum Umschalttag, nicht zur Einreichung.
- **Der Name auf der Store-Seite ist Julians** (Einzelperson). Ein Firmenname braucht eine juristische Person und eine D-U-N-S-Nummer.
- **Amazon Associates** verlangt für mobile Apps eine **eigene Freigabe** (Mobile Application Policy: nur kostenlose Apps in den offiziellen Stores, vorher angemeldet). Betrifft nur den Shop-Modus (4.2 in der Roadmap), dann aber vor dem ersten Provisions-Link in der App.
- **Die Cover:** siehe 4.6, Zeile 5.2.1. Bevor Julian einreicht, sollte die Rechtefrage aus 5.5 eine Antwort haben, die man einem Prüfer in zwei Sätzen schreiben kann.
- **Der Speicher des Spiels und der Sammlungen** (Redis, Region offen seit 5.8a) steht in den Labels wie im Datenschutztext; die offene Regionsfrage wird mit dem Store nicht leichter.

## 7. Entscheidungen bei Julian

1. **Weg A bauen?** Empfohlen; kostet nichts als sein iPhone für die Messung A1–A6.
2. **Apple Developer Program, 99 USD im Jahr** — und: gibt es einen Mac? Sonst Xcode Cloud (§4.4).
3. **Welcher Kandidat aus §4.7 trägt die Hülle** — Barcode, Foto → Ausgabe, Widget? Ohne einen: keine Einreichung, Regel 4.2.
4. **Händlerstatus und Telefonnummer** am Umschalttag (§6).
5. **Die Rechtefrage der Cover** (5.5) vor einem Prüfer.
6. **Reihenfolge:** Domain (0.5) vor dem Store (§4.8).

## 8. Reihenfolge

1. **A** als ein Commit (Manifest, `appleWebApp`, `viewportFit`, sichere Zonen, Symbole), geprüft bei 390 × 844 und 1280 × 800 (N14), dann die Messung A1–A6 am Gerät; die Sätze in die Historie, das Ergebnis als Zeile in `docs/features.md`.
2. **Tor zu B:** 0.5 erledigt, ein Kandidat aus §4.7 gewählt und als Lab-Experiment gemessen, Julian eingeschrieben.
3. **B0–B4** wie in §4.10; `ios/` liegt im Repository (Capacitor-Konvention), aus ESLint und `tsconfig` ausgenommen, Secrets nie in der Datei; TestFlight vor dem Store.
4. **C** bleibt ohne Datum.

## 9. Was dieser Plan nicht beantwortet

Android (dieselbe Capacitor-Hülle liefert es mit; nicht gefragt, nicht geprüft), alternative EU-Marktplätze, In-App-Käufe (es gibt keine), ein Service Worker (§2: nein, mit Grund). Und alles in §3 mit „messen": dieser Plan ist am Schreibtisch entstanden, kein Satz darin hat ein iPhone gesehen.
