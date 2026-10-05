# Recherche: Partnerprogramme für die Kauf-Links — Sätze, Netzwerke, Reihenfolge

*Ergänzung zu [affiliate-programme.md](affiliate-programme.md) (die Anleitung vom selben Tag, aus einer parallelen Sitzung: was der Code kann, was vor dem Umschalttag stehen muss). Diese Datei hat die am 2026-10-03 im Netz nachgelesenen Sätze und Netzwerke je Programm, den Bewerbungstext und die Liste der IDs, die Claude danach braucht. Bei Widerspruch zu den Sätzen gilt die Seite des Programms.*

Geschrieben 2026-10-03 für Julian (ROADMAP 4.1, 4.2, 4.3; Zeile 6 der Sperrliste 4.13; Julian: „mach eine anleitung für die affiliate link programme"). Stand der Quellen: am selben Tag gesucht, überwiegend Verzeichnisse und Hilfeseiten der Programme. **Provisionssätze ändern sich; maßgeblich ist, was im jeweiligen Konto nach der Freischaltung steht** — die Zahlen hier sind zum Sortieren, nicht zum Rechnen. Für Bookshop.org gibt es die ausführliche Anleitung [bookshop-affiliate.md](bookshop-affiliate.md); Steuer und Gewerbe stehen in [gewerbe-anmeldung.md](gewerbe-anmeldung.md).

## Das Wichtigste vorab

1. **Nur zwei Händler sind heute im Code angeschlossen: Amazon und Bookshop.org** (`AFFILIATE_AMAZON_TAG_US|UK|DE`, `AFFILIATE_BOOKSHOP_ID_US|UK`, SPEC §2). Jedes andere Programm braucht erst Code (unten „Was Claude danach baut"), bevor eine Freischaltung etwas einbringt. Wer bei Thalia angenommen ist, verdient nichts, bis der Link umgebaut ist.
2. **Im Hobby-Modus werden alle Kennungen ignoriert** (E20). Bewerben ja, Variablen setzen ja — wirksam wird es erst am Umschalttag (4.13).
3. **Bewerben erst, wenn `buyitscovers.com` antwortet** (2.15 Schritt 1). Jedes Programm prüft die Seite; eine Bewerbung mit `beautifulcovers.vercel.app` muss später umgeschrieben werden, und bei Amazon ist die Website-Liste Teil der Prüfung.
4. **Ein Awin-Konto deckt drei Programme ab** (Thalia, genialokal, Waterstones). Das ist der beste Aufwand-Ertrag-Schritt nach Bookshop.

## Reihenfolge

| # | Programm | Markt | Netzwerk | Provision laut Verzeichnis | Code vorhanden? | Wann |
|---|---|---|---|---|---|---|
| 1 | **Bookshop.org US** | US | direkt (Stripe) | 10 % | ja | sobald die Domain antwortet |
| 2 | **Awin**: Thalia, genialokal, Waterstones | DE, DE, UK | Awin | Thalia bis 12 % (preisgebundene Bücher), genialokal 7,5 %, Waterstones 4 % Neukunden / 1 % Bestandskunden | **nein** | mit 1 |
| 3 | **Bookshop.org UK** | UK | direkt, eigenes Konto | 10 % | ja | nach 1, mit eigenem Konto |
| 4 | **Hugendubel** | DE | Tradedoubler | bis 10 % (preisgebunden) | **nein** | nach 2 |
| 5 | **AbeBooks / ZVAB** | US, UK, DE | Impact | 5 % auf die ersten 500 USD je Artikel | **nein** | nach 2; wichtig für vergriffene Ausgaben (4.10) |
| 6 | **Amazon** .com / .co.uk / .de | alle | direkt | Bücher 4,5 % (US; DE laut Ratgebern ebenso, im Vergütungskatalog prüfen) | ja | **erst mit Verkehr** — siehe unten |
| 7 | Booklooker | DE | eigenes Programm | 5 % + 1 € je Neukunde | nein | wenn 4.10 entschieden ist |
| 8 | buch7 | DE | eigenes Programm | nicht veröffentlicht, anfragen | nein (buch7 ist heute nicht in der Linkliste) | optional, 4.3 |
| 9 | eBay Partner Network | US, UK | direkt | 1–4 % je Kategorie | nein | zuletzt; kleine Beträge |
| — | ThriftBooks | US | über Netzwerke (FlexOffers u. a.) | 4–6,5 %, **7 Tage** Cookie | nein | nur bei Nachfrage |
| — | Blackwell's | UK | eigenes Programm | 6 % | nein | **nimmt seit 09/2025 niemanden auf** („on hold") |

## Was jede Bewerbung fragt — einmal vorbereiten

Ein Textbaustein, den du überall einfügst (englisch für US/UK, deutsch für die DE-Netzwerke):

> **Buy Its Covers** (https://buyitscovers.com) shows the covers a book has been printed with, side by side, from Open Library and Google Books, and links each edition to bookshops by ISBN. Visitors come to compare editions and buy a specific one. Links are editorial: one row per bookshop under each edition, labelled with the shop's name; no coupons, no cashback, no paid search, no email. Disclosure sits under the links and on the About page.

> **Buy Its Covers** (https://buyitscovers.com) zeigt die Umschläge, mit denen ein Buch gedruckt wurde, nebeneinander (Daten: Open Library, Google Books) und verlinkt jede Ausgabe über die ISBN zu Buchhandlungen. Besucher vergleichen Ausgaben und kaufen eine bestimmte. Redaktionelle Links, je Händler eine Zeile unter der Ausgabe; keine Gutscheine, kein Cashback, keine bezahlte Suche, keine E-Mails. Der Hinweis auf Provisionen steht unter den Links und auf der About-Seite.

Dazu überall gefragt:
- **Werbeform / Promotional method:** Content / Editorial website. **Nicht** „Cashback", „Voucher", „Sub-Network".
- **Besucherzahlen:** ehrlich; die Web Analytics in Vercel zeigen sie. Kleine Zahlen sind kein Ablehnungsgrund bei Bookshop und Amazon, bei Awin und Tradedoubler entscheidet jeder Händler selbst.
- **Steuerangaben:** Kleinunternehmer, USt-IdNr. sobald da (DE/EU-Netzwerke); W-8BEN für US-Programme (oder W-9, falls US-Bürger — siehe Gewerbe-Anleitung Schritt 0).
- **Auszahlung:** US-Konto für Bookshop US, Amazon.com und Impact; deutsches Konto (IBAN) für Awin, Tradedoubler, Amazon.de.

## Die Programme Schritt für Schritt

### 1. Bookshop.org US (und später UK)
Alles Nötige steht in [bookshop-affiliate.md](bookshop-affiliate.md). Ergebnis: eine ID → `AFFILIATE_BOOKSHOP_ID_US` in Vercel (Production). UK ist ein zweites, getrenntes Konto → `AFFILIATE_BOOKSHOP_ID_UK`.

### 2. Awin (Thalia, genialokal, Waterstones)
1. Auf awin.com als **Publisher** registrieren; Land Deutschland, Rechtsform Einzelunternehmen. Awin verlangt eine **Kaution von 5 €/5 USD** per Karte, die mit der ersten Auszahlung zurückkommt (bei Ablehnung nur auf Anfrage beim Compliance-Team).
2. Website `https://buyitscovers.com` eintragen, Werbeform „Content", Textbaustein von oben.
3. Nach der Freischaltung des Kontos im Advertiser-Verzeichnis **einzeln bewerben**: *Thalia.de*, *genialokal.de*, *Waterstones*. Jeder Händler entscheidet selbst, meist in ein bis vierzehn Tagen.
4. Notieren und Claude geben: deine **Publisher-ID** (Zahl, „awinaffid") und je Händler die **Advertiser-ID** („awinmid"; steht im Händlerprofil, z. B. `ui.awin.com/merchant-profile/<mid>`).
5. **genialokal**: Provisionen auf preisgebundene Bücher dürfen nicht an Kunden weitergereicht werden (Buchpreisbindung) — betrifft uns nicht, kein Cashback; bei Bestellungen mit Gutschein gibt es keine Provision.

### 3. Hugendubel (Tradedoubler)
Auf tradedoubler.com als Publisher registrieren (Website, Kategorie Content), dann beim Programm *Hugendubel* bewerben. Nach der Annahme: **Site-ID** und **Programm-ID** an Claude.

### 4. AbeBooks / ZVAB (Impact)
Auf abebooks.com/books/affiliateprogram auf „Join" → führt zu Impact. Konto als Media Partner anlegen, AbeBooks-Programm beantragen; **prüfen, ob ZVAB und abebooks.co.uk/.de als eigene Programme im Marktplatz stehen** — in der Suche war das nicht zu klären. **Geklärt 2026-10-04** (abebooks.com/books/affiliateprogram, FAQ): „you can link to all AbeBooks domains (AbeBooks.com, AbeBooks.co.uk, AbeBooks.de, AbeBooks.fr, AbeBooks.it, IberLibro.com and ZVAB.com) from the same affiliate account" — **ein Konto für AbeBooks und ZVAB.** Dazu von derselben Seite: 5 % auf Artikel bis 500 USD, 30 Tage Cookie (die ersten drei Verkäufe zählen), Auszahlung über Impact 50 Tage nach Monatsende, keine bezahlte Suche auf den Markennamen, und die Such-Schnittstelle (Search Web Services, für 5.14a) gibt es auf Anfrage. Die Anmeldung läuft über `app.impact.com/campaign-promo-signup/AbeBooks-Inc.brand`: erst das Häkchen für die Programmbedingungen, dann ein Impact-Konto über Google, Apple oder E-Mail. **Währung des Impact-Kontos (Julian, 2026-10-04: „welche währung ist am besten“):** sie lässt sich nach dem Anlegen nicht mehr ändern (help.impact.com, „Can I Change My Account Currency?“: nur über ein neues Konto), ausgezahlt wird in ihr, und Impact rechnet Provisionen in anderer Währung am Tag der Aktion um (Aufschlag auf der Hilfeseite nicht genannt). Empfehlung: **EUR** — deutsches Konto, Buchführung in Euro, dieselbe Währung wie Awin; USD lohnte nur, wenn die Auszahlung aufs US-Konto gehen soll. Außerdem von dort: kann Impact sechs Monate nicht auszahlen, weil Bankdaten fehlen, fällt ab dem siebten Monat eine monatliche Kontogebühr an — Bankdaten also bald eintragen. Auszahlung monatlich über Impact. Nach der Annahme: **Impact-Partner-ID** und die **Tracking-Link-Vorlage** an Claude.

### 5. Amazon — warum zuletzt
- **Drei qualifizierte Verkäufe in 180 Tagen**, sonst wird das Konto geschlossen; die eigentliche Prüfung der Seite findet erst danach statt. Die Kennung geht nicht verloren, aber eine Neubewerbung kostet Zeit. Bewerben also erst, wenn der Shop-Modus läuft und Verkehr da ist — vorher verbrennt die Uhr.
- **Ein Konto je Marktplatz** (affiliate-program.amazon.com, .co.uk, partnernet.amazon.de). Mit „Earn globally" aus dem US-Konto lässt sich die Teilnahme an UK und DE einschalten; die Tags je Land trotzdem einzeln in `AFFILIATE_AMAZON_TAG_US|UK|DE` eintragen. **OneLink nicht nötig**: die Seite wählt den Markt selbst (E9), und OneLink bräuchte ein Skript von Amazon auf der Seite.
- **Pflichten**: der Pflichtsatz ist gebaut (4.11; offen: deutscher Wortlaut für PartnerNet); **keine Preise** ohne Amazons API; **keine Links in E-Mails oder PDFs**; Links dürfen nicht verschleiern, dass es zu Amazon geht — unsere Links tragen den Namen „Amazon", `/go/` leitet nur weiter. ⚠ Ob die Weiterleitung über `/go/` Amazons Regel gegen „cloaking" berührt, vor der Bewerbung einmal in der Operating Agreement nachlesen; Ausweg wäre, Amazon-Links direkt statt über `/go/` zu setzen (der Klick wird dann nicht gezählt).
- **0.1 muss vorher entschieden sein**: der Verfügbarkeits-Button des Shop-Modus fragt Amazon automatisiert ab, was die Bedingungen verbieten (4.13 Zeile 1).

### 6. Booklooker, buch7, eBay
Erst, wenn 4.10 (Antiquariate) entschieden ist bzw. Zeit übrig ist. buch7: per Mail anfragen (Satz nicht veröffentlicht), vorher die robots.txt des Zielpfads prüfen (Problem aus 4.1). eBay Partner Network: Konto direkt bei eBay, Kampagnen-ID an Claude.

## Was Claude danach baut

- **Netzwerk-Links** in `lib/buylinks.ts`: heute kennt die Tabelle nur „ID in die URL" (Amazon-Tag, Bookshop-Pfad). Awin, Tradedoubler und Impact funktionieren anders — der Zielpfad wird in einen Link des Netzwerks gepackt (Awin: `https://www.awin1.com/cread.php?awinmid=<Händler>&awinaffid=<du>&ued=<Ziel-URL kodiert>`). Neue Variablen, je Netzwerk eine Kennung (`AFFILIATE_AWIN_ID`, `AFFILIATE_TRADEDOUBLER_ID`, `AFFILIATE_IMPACT_…`), die Händler-IDs als Konstanten im Code. Wichtig bleibt: **`/go/` baut das Ziel aus der Tabelle, nie aus der Anfrage** (offene Weiterleitung, CLAUDE.md). Ein Test je Netzwerk, dass ohne Variable der neutrale Link entsteht und im Hobby-Modus nie eine Kennung.
- `commissionNote` und `rel="sponsored"` greifen dann von selbst, weil sie an `BuyLink.affiliate` hängen.
- Datenschutzerklärung: die Netzwerke als Ziel von Links nennen (die Seite setzt kein Cookie, das Netzwerk beim Klick schon) — 4.13 Zeile 5.
- Etwa ein halber Tag für Awin; Tradedoubler und Impact je eine Stunde dazu, sobald die IDs da sind.

## Was du mir am Ende gibst

Nur Kennungen, keine Passwörter — und **nicht in den Chat, wenn es sich vermeiden lässt**: direkt in Vercel → Project → Settings → Environment Variables (Production), Namen wie oben. Für die Händler-IDs bei Awin genügt die Liste im Chat, sie sind öffentlich.

## Quellen (gelesen 2026-10-03)

- Amazon: [Provisionen nach Kategorie](https://affiliatexblocks.com/amazon-affiliate-commission-rates/), [PartnerNet Vergütungskatalog](https://partnernet.amazon.de/help/node/topic/GRXPHT8U84RAYDXZ), [drei Verkäufe in 180 Tagen](https://azonpress.com/key-amazon-affiliate-requirements/), [OneLink / Earn globally](https://affiliate-program.amazon.com/resource-center/onelink/)
- Awin-Kaution: [awin.com Anleitung](https://www.awin.com/us/how-to-use-awin/awin-guide-on-how-to-start-affiliate-marketing), [favly.com](https://favly.com/awin-affiliate-program)
- Thalia: [affiliate-marketing.de](https://www.affiliate-marketing.de/partnerprogramme/thalia.de), [Thalia Partnerprogramm](https://www.thalia.at/vorteile/partnerprogramm)
- genialokal: [affiliate-marketing.de](https://www.affiliate-marketing.de/partnerprogramme/genialokal.de), [genialokal Besonderheiten](https://www.genialokal.de/Besonderheiten-Affiliate/)
- Hugendubel: [Hugendubel Partnerprogramm](https://www.hugendubel.de/de/category/93926/affiliate_partnerprogramm.html), [Tradedoubler-Verzeichnis](https://directory.tradedoubler.com/de/programs/249407-Hugendubel)
- Waterstones: [Waterstones Affiliate Programme](https://www.waterstones.com/help/affiliate-programme/45)
- Blackwell's: [Affiliates 2025](https://blackwells.zendesk.com/hc/en-gb/articles/23457032075164-Affiliates-2025)
- AbeBooks: [abebooks.com Affiliate Program](https://www.abebooks.com/books/affiliateprogram/), [getlasso.co](https://getlasso.co/affiliate/abebooks/)
- ThriftBooks: [getlasso.co](https://getlasso.co/affiliate/thriftbooks/)
- eBay: [strackr.com](https://strackr.com/blog/ebay-affiliate-program)
- Booklooker, buch7: [affiliate-marketing.de](https://www.affiliate-marketing.de/partnerprogramme/booklooker.de), [buch7 Partner](https://www.buch7.de/store/list_partners)
