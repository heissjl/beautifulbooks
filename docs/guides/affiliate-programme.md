# Anleitung: die Partnerprogramme, von heute bis zum Umschalttag

Geschrieben 2026-10-03 für Julian (ROADMAP Phase 4). Was der Code heute kann, ist gelesen und stimmt; was die Programme verlangen, stammt aus den Roadmap-Punkten 4.1–4.4, 4.10, 4.11 und der [Bookshop-Anleitung](bookshop-affiliate.md) vom 2026-09-26 — **Provisionssätze und Fristen vor jeder Bewerbung auf der Seite des Programms nachlesen**, sie ändern sich, und von hier aus war am 2026-10-03 kein Abruf möglich. Keine Rechts- oder Steuerberatung.

*Sätze, Netzwerke und Bewerbungstext je Programm, im Netz nachgelesen am 2026-10-03: [affiliate-programme-recherche.md](affiliate-programme-recherche.md).*

## 1. Was die Seite schon kann, ohne dass du etwas tust

- **Jeder Händler-Link ist eine URL-Schablone** (`lib/buylinks.ts`), je Markt US / UK / DE (E9). Trägt ein Händler eine Umgebungsvariable (`affiliateEnv`), wird ihr Wert in den Link gesetzt — Amazon als `tag=`, Bookshop als `/a/<ID>/<ISBN>`. **Ohne Variable entsteht der neutrale Link.** Die fünf Stellen heute:

  | Variable | Händler | Markt | Wirkung mit Wert |
  |---|---|---|---|
  | `AFFILIATE_BOOKSHOP_ID_US` | Bookshop.org | US | Produktseite statt Suchseite (die Suchseite ist per robots.txt gesperrt, also heute ein kaputter Link) |
  | `AFFILIATE_BOOKSHOP_ID_UK` | uk.bookshop.org | UK | dito |
  | `AFFILIATE_AMAZON_TAG_US` | amazon.com | US | `tag=` am `/dp/<ISBN-10>`-Link und an der Titelsuche |
  | `AFFILIATE_AMAZON_TAG_UK` | amazon.co.uk | UK | dito |
  | `AFFILIATE_AMAZON_TAG_DE` | amazon.de | DE | dito |
  | `AFFILIATE_GENIALOKAL_ID_DE` | genialokal.de über Awin | DE | Wert ist die Awin-Publisher-ID 3114726; der Suchlink wird in `awin1.com/cread.php?awinmid=17358&awinaffid=…&ued=<Ziel>` gepackt (seit 2026-10-07) |

  AbeBooks/ZVAB, ThriftBooks, eBay, Blackwell's, Waterstones, Thalia, Hugendubel, Booklooker haben **keine** Stelle: ihre Programme laufen über Netzwerke (Impact, Awin, Adcell, eBay Partner Network), die andere Linkformen verlangen. Das ist 4.3 und braucht je Händler eine Zeile in der Tabelle plus Variable — eine Stunde Claude je Programm, sobald die Kennung da ist.
- **Der Schalter ist `NEXT_PUBLIC_SITE_MODE`** (`lib/sitemode.ts`, E20): `hobby` (Default) ignoriert jede Affiliate-Variable; erst `shop` setzt sie ein. Ein anderer Wert bricht den Build. Du kannst also Kennungen in Vercel eintragen, bevor umgeschaltet wird; sie tun nichts.
- **Mit `shop` ändert sich die Seite an vier Stellen von selbst:** (1) die Links tragen die Kennung und `rel="sponsored"`; (2) unter der ersten Shop-Reihe steht der Provisionshinweis (`commissionNote`, 4.11), bei einem Amazon-Tag mit Amazons Pflichtsatz wörtlich dahinter; (3) die Fußzeile sagt „Purchase links may earn us a commission."; (4) About und Datenschutz wechseln ihren Satz von „kein Link verdient" zu „manche Links tragen einen Partner-Parameter". Im Hobby-Modus steht überall das Gegenteil, und das ist wahr (N12).
- **Jeder Klick auf einen ISBN-Link geht über `/go/<provider>/<isbn>?market=`**, das den Klick zählt (Händler, Markt, ISBN, Art, Zeit — nichts über den Leser) und das Ziel aus der Tabelle neu baut. Das ist deine spätere Messung: welche Shops die Leser überhaupt anklicken, bevor ein Programm Verkäufe meldet.
- **Der Verfügbarkeits-Button bleibt aus** (0.1): Amazons Partnerbedingungen untersagen automatisierte Zugriffe, und vier von sechs Shops sperren den geprüften Pfad. Im Shop-Modus wäre er sichtbar — vor dem Umschalttag ist 0.1 zu entscheiden, sonst gefährdet er das Amazon-Konto am ersten Tag.

## 2. Was vor dem Umschalttag erledigt sein muss (nicht vor der ersten Bewerbung)

Bewerben kannst du dich jetzt. **Auf `shop` umschalten** erst, wenn diese vier stehen; alle vier sind deine, nicht meine:

1. **0.12 Vercel Pro** (20 USD/Monat): mit Provision ist die Seite kommerziell, der Hobby-Plan erlaubt das nicht, und erst Pro hat den Auftragsverarbeitungsvertrag (Art. 28 DSGVO).
2. **4.4 Gewerbe und Steuer:** Affiliate-Einnahmen sind Einkünfte aus Gewerbebetrieb — Gewerbeanmeldung, Kleinunternehmerregelung prüfen; die US-Programme fragen W-8BEN (du: in Deutschland steuerpflichtig) oder W-9.
3. **Impressum nach § 5 DDG** statt nur § 18 MStV: mit Affiliate-Links ist die Seite „geschäftsmäßig" ([recht-hobbyseite.md §2](../recht-hobbyseite.md)). Praktisch ist das die E-Mail-Zeile, die schon da ist; prüfen, dass nichts fehlt.
4. **4.12 About in der ersten Person:** wer an Links verdient, sagt, wer er ist. Du schreibst, ich baue ein.

Dazu **0.1** (Verfügbarkeits-Button: entscheiden, Empfehlung streichen) und **0.5/2.2**: bewirb dich unter dem Namen und der Domain, die bleiben (`buyitscovers.com`, sobald sie verbunden ist) — ein Programm, das die Seite unter `beautifulcovers.vercel.app` geprüft hat, muss bei Domainwechsel teils neu prüfen.

## 3. Die Programme, in der Reihenfolge der Roadmap

### 3.1 Bookshop.org (4.1) — jetzt, ohne Wartezeit

Schritt für Schritt in [bookshop-affiliate.md](bookshop-affiliate.md). Kurz: zwei Konten (US, UK) oder nur US; „Non-bookstore affiliate"; Profiltext dort — **mit dem neuen Namen und der neuen Adresse einsetzen**, die Anleitung nennt noch die alten. Keine Mindestreichweite, Auszahlung über Stripe auf dein US-Konto ab 20 USD, nach der 30-Tage-Rückgabefrist. **Nach der Freigabe:** die ID (der Teil nach `/a/` in deinen Links) an mich → Variable in Vercel, Deploy, ein Klick auf `/go/bookshop/<ISBN>?market=us` muss auf die Produktseite führen. Bis `shop` eingeschaltet ist, bleibt der Link neutral, also kaputt; das ist der Grund, warum 4.1 vor allem anderen steht.

**Angenommen (gemeldet 2026-10-05).** Bookshop.org hat die Bewerbung angenommen und einen Ordner mit fünf allgemeinen Anleitungen geschickt (Google Drive „Bookshop.org Affiliate User Guides": Affiliate-Links, Listen kuratieren, Provisionsbericht, Wunschlisten, E-Book-Links; nichts darin ist für dieses Konto eigens). Aus „BSO-Affiliate Links" (Stand 07/2025): ein Buch-Link heißt **`https://bookshop.org/a/<ID>/<ISBN13>`** — genau die Form, die `lib/buylinks.ts` baut; die **ID ist eine Zahl** und steht nach der Anmeldung unter **„Affiliate Profile & Lists" → „Update my profile" („Affiliate ID")**; jede Produktseite zeigt unten außerdem „Your Affiliate Link". **Affiliate-ID 129426, US-Konto, „Verified"** (Julian, 2026-10-05: „ich glaub wir haben nur us beantragt bisher"); **am 2026-10-05 als `AFFILIATE_BOOKSHOP_ID_US` in Vercel Production eingetragen** (nur Production, Preview ohne). Ein UK-Konto (`uk.bookshop.org`, eigene ID, Variable `AFFILIATE_BOOKSHOP_ID_UK`): **Antrag vorbereitet am 2026-10-05** (Julian: „beantrag auch das uk konto") — Reiter in Julians Chrome steht auf `uk.bookshop.org/signup` (E-Mail, Passwort, Bestätigung, ein Häkchen für Werbung der Buchhandlungen; optionale Cookies abgelehnt). Danach wie beim US-Konto ([bookshop-affiliate.md](bookshop-affiliate.md)): Profil mit denselben Einträgen (Shop Name „Buy Its Covers", URL `buyitscovers`, About-Text, Bilder aus `assets/social/`, Bluesky, X), dann *Request Verification*. Konto und Passwort sind Julians Schritt. **Beantragt am 2026-10-05:** Julian hat das Konto angelegt und die E-Mail bestätigt (vorher zeigt `/affiliates/profile` nur „Verify Your Account"); Claude hat das Profil gespeichert — Shop Name „Buy Its Covers", URL `uk.bookshop.org/shop/buyitscovers`, derselbe About-Text wie beim US-Konto, `assets/social/avatar-360.png` und `banner-2048x600.png`, Bluesky und X — und *Request Verification* geklickt. **UK-Affiliate-ID 18376, Status „Requested"** („You have requested verification … and will be notified when complete"). Nach der Annahme: `AFFILIATE_BOOKSHOP_ID_UK=18376` in Vercel Production (wirksam erst am Umschalttag). **Nicht geklärt:** wie Bookshop UK auszahlt (GBP; ob ein deutsches Konto über Stripe geht) — die Frage stellt sich erst nach der Annahme. `lib/buylinks.ts` liest die Kennung nur bei `commerceEnabled()`, also **wirksam erst mit dem Umschalttag** (§4, `NEXT_PUBLIC_SITE_MODE=shop`) — bis dahin bleibt der Bookshop-Link eine Suche ohne Kennung.

### 3.2 Amazon Associates (US), Amazon Associates UK, PartnerNet (DE) (4.2) — erst mit Reichweite

- **Ein Konto je Marktplatz**, je ein Tag; die drei Variablen oben.
- **Die Falle:** innerhalb von **180 Tagen drei qualifizierte Verkäufe**, sonst schließt Amazon das Konto, und eine zweite Bewerbung ist schwerer. Darum: erst bewerben, wenn die Search Console Besucher zeigt (2.5) und `/go/amazon/…` in den Logs regelmäßig vorkommt. Zu früh beworben ist das Konto verbrannt.
- **Pflichten, die der Code schon kennt:** der Hinweissatz steht (4.11; **offen:** ob amazon.de den deutschen Wortlaut „Als Amazon-Partner verdiene ich an qualifizierten Verkäufen" verlangt — vor dem DE-Konto nachlesen, dann gehört er in den Katalog `lib/i18n/de.ts`), keine Preise ohne ihre API (die Seite zeigt keine), keine Links in E-Mails (die Seite verschickt keine), keine automatisierten Zugriffe (0.1).
- **Zweiter Gewinn:** nach der Freigabe die **Product Advertising API** — zur ISBN das Bild, das Amazon wirklich ausliefert; hebt das Verdikt bei den heute vielen „unknown"-ISBNs auf eine Aussage (4.5). Erst nach der Freigabe, die API verlangt ein aktives Konto mit Verkäufen.

### 3.3 Die Netzwerke (4.3) — nach Bookshop, je nachdem, was die Leser klicken

Lies vorher die Klickzahlen aus `/go/` (`vercel logs --query bb.click` innerhalb der Stunde, oder 3.1, sobald es die Analyse-Seite gibt): ein Programm für einen Shop, den niemand anklickt, ist Verwaltung ohne Ertrag.

| Händler | Programm | Für wen wichtig | Was ich brauche |
|---|---|---|---|
| AbeBooks / ZVAB | über **Impact** | vergriffene Ausgaben, also die mit den interessanten Covern; in allen drei Märkten vorn (4.10) | die Impact-Linkform (meist ein Tracking-Link mit Ziel-URL als Parameter) und die Kennung |
| Thalia, Hugendubel, genialokal | **Awin** oder **Adcell** | der DE-Markt | je Shop Kennung und Linkform; genialokal nur, wenn der Ziellink weiter die ISBN-Suche trägt |
| eBay | **eBay Partner Network** | Sammlerausgaben | Campaign-ID; eBay baut `mkcid`/`campid`-Parameter an die Such-URL |
| buch7.de | eigenes Programm, Satz nicht veröffentlicht | der eine DE-Link, der Provision bringt und spendet (PLAN-4 §3 D) | anfragen; vorher robots.txt des Zielpfads prüfen, damit nicht das Bookshop-Problem von vorn beginnt |
| Better World Books | über Impact prüfen | gebraucht, US | wie AbeBooks |

Für jedes: Bewerbung durch dich (die Netzwerke verlangen Impressum, Datenschutz, oft eine Seitenbeschreibung und manchmal Mindesttraffic), Kennung an mich, eine Tabellenzeile plus Variable `AFFILIATE_<HÄNDLER>_<MARKT>` plus Test — und `commissionNote` zählt den Shop dann von selbst mit.

**Thalia DE abgelehnt (Awin-Mail, gemeldet 2026-10-05):** „Ihre Bewerbung beim Programm Thalia DE (AID:14158) von BuyItsCovers (PID:3114726) wurde … abgelehnt", Grund: **„aktuell zu geringe organische Sichtbarkeit"**. Das ist kein Nein zur Seite, sondern zum Zeitpunkt: die Domain ist seit dem 2026-10-04 live und erst seit dem Tag in der Search Console (2.5), Google kennt noch kaum Seiten. Folgen: (1) der Thalia-Link in `lib/buylinks.ts` bleibt, wie er ist — ohne Partnerkennung, er funktioniert für den Leser unverändert; (2) **neu bewerben, wenn die Search Console Impressionen zeigt** (der Blick in zwei bis drei Wochen aus 2.16 ist der Anlass), mit einer Zahl im Bewerbungstext (Seiten im Index, Besuche aus der Suche laut 3.1); (3) genialokal (17358) und Waterstones (3787) könnten aus demselben Grund ablehnen — ihre Antwort abwarten, nicht nachschieben. Awin selbst (Konto 3114726) ist davon nicht berührt.

**genialokal angenommen (Awin, gemeldet 2026-10-07)** — Julians Meldung mit dem Händlerprofil `ui.awin.com/awin/affiliate/3114726/merchant-profile/17358`. Gebaut am selben Tag: `AFFILIATE_GENIALOKAL_ID_DE` (Wert: die Awin-Publisher-ID 3114726) packt im Shop-Modus die ISBN-Suche und die Titelsuche bei genialokal in Awins Klick-Link; ohne Variable oder im Hobby-Modus bleibt der Link wie bisher. **Je Händler eine eigene Variable, nicht eine für ganz Awin**, weil Thalia abgelehnt hat: ein Link, der für ein Programm ohne Zusage über Awin läuft, bringt nichts. Einmal nachgeprüft: Awin leitet `cread.php?awinmid=17358&awinaffid=3114726&ued=…` mit 302 auf genialokals Suche weiter und hängt `awc=…` an — der Deep Link auf die Suchseite funktioniert. Der „Buy locally"-Link zu genialokal (`lib/localshops.ts`) trägt die Kennung bewusst nicht. Die Datenschutzerklärung nennt Awin im Shop-Modus mit einem eigenen Satz (`affiliateNetworks`), **der auf Julians Freigabe wartet**. Offen bei Julian: im Awin-Händlerprofil nachsehen, ob genialokal Deep Links erlaubt und was die Programmbedingungen sonst verlangen (die Seite von genialokal selbst steht hinter einer Bot-Sperre und war nicht lesbar); die Variable in Vercel Production setzen (wirkt erst am Umschalttag).

## 4. Der Umschalttag, als Checkliste

1. Punkte aus Abschnitt 2 abgehakt (0.12, 4.4, Impressum, 4.12), 0.1 entschieden.
2. Kennungen in Vercel für **Production** eingetragen (`vercel env add AFFILIATE_… production`); Preview ohne, damit Vorschauen keine Klicks zählen.
3. `NEXT_PUBLIC_SITE_MODE=shop` in Production setzen, deployen.
4. **Einmal** prüfen, nicht pollen (ROADMAP 2.4): eine Buchseite mit gewähltem Cover — Provisionshinweis da, Amazons Satz da, wenn ein Tag gesetzt ist; `/go/bookshop/<ISBN>?market=us` führt auf `bookshop.org/a/<ID>/<ISBN>`; Fußzeile, About und Datenschutz zeigen die Shop-Fassung.
5. Datenschutzerklärung: der Satz zu den Partner-Parametern schaltet von selbst; die Liste der Empfänger (Bookshop, Amazon, ggf. Impact/Awin) **von Hand** ergänzen, weil ein Netzwerk-Link den Leser über dessen Server leitet — das ist der eine Punkt, den der Code nicht automatisch richtig macht.
6. ROADMAP 4.1/4.2 abhaken, Historie mit Datum und den ersten Klickzahlen.

## 5. Was sich nicht lohnt, und warum (damit es nicht wieder gefragt wird)

- **Alle Programme auf einmal:** jedes verlangt Pflege (Steuerformulare, Mindestumsätze, Kündigung bei Inaktivität). Bookshop zuerst, Amazon bei Reichweite, der Rest nach Klickzahlen.
- **Reihenfolge der Shops nach Provision:** ausgeschlossen durch §2.4 und die About-Seite; die Reihenfolge folgt der Registrierungsgruppe der ISBN (`lib/linkplan.ts`). Ein Programm ändert die Reihenfolge nicht.
- **Preise oder Verfügbarkeit anzeigen:** ohne die API des jeweiligen Programms verboten (Amazon) oder technisch nicht möglich (0.1). Die Seite verspricht ein Cover, nie einen Preis.
