# Anleitung: Gewerbe anmelden, Kleinunternehmer, Steuern — für den Shop-Modus

Geschrieben 2026-10-03 für Julian (ROADMAP 4.4, Zeile 4 der Sperrliste 4.13; Julian: „recherchiere und mache mir eine liste was und wie ich das machen muss"). Stand der Quellen: am selben Tag gesucht, Rechtslage 2026 (Kleinunternehmer-Reform zum 1.1.2025, Wachstumschancengesetz, BEG IV). **Keine Steuerberatung**; die mit ⚠ markierten Stellen vor dem Umschalttag einmal von einer Steuerberatung bestätigen lassen — eine Erstberatung kostet nach StBVV etwa 50–190 €.

Annahmen: Julian wohnt in Deutschland, betreibt die Seite als Einzelunternehmer, die Einnahmen sind Provisionen (Bookshop.org US, Amazon), keine eigenen Warenverkäufe. **Affiliate-Provisionen sind Einkünfte aus Gewerbebetrieb** (Vermittlung), nicht freiberuflich.

## Die Reihenfolge auf einen Blick

| # | Was | Wann | Kosten | Dauer |
|---|---|---|---|---|
| 0 | Vorher klären: Arbeitgeber, Krankenversicherung, US-Steuerstatus | jetzt | — | 30 min |
| 1 | Gewerbe anmelden beim Gewerbeamt | am Tag, an dem die erste Partner-Kennung live geht (Umschalttag) — nicht nach der ersten Auszahlung | 15–65 € je nach Gemeinde | 20 min online |
| 2 | Berufsgenossenschaft melden | innerhalb einer Woche nach Beginn | meist 0 € ohne Beschäftigte | 10 min |
| 3 | Fragebogen zur steuerlichen Erfassung über ELSTER | innerhalb eines Monats nach Beginn | 0 € | 45 min |
| 4 | USt-IdNr. (kommt über den Fragebogen) | mit 3 | 0 € | — |
| 5 | Impressum ergänzen | sobald USt-IdNr. oder W-IdNr. da ist | — | Claude, 5 min |
| 6 | Partnerkonten: Steuerangaben eintragen | mit der Anmeldung bei Bookshop/Amazon | — | 15 min |
| 7 | Laufend: Belege sammeln, Reverse Charge auf Auslandsabos | ab Tag 1 | — | 10 min/Monat |
| 8 | Jährlich: Einkommensteuererklärung mit Anlage EÜR | Folgejahr | — | 1–2 h |

## 0. Vorher klären

- **Arbeitgeber:** Wer angestellt ist, prüft den Arbeitsvertrag auf eine Pflicht, Nebentätigkeiten anzuzeigen oder genehmigen zu lassen. Eine Website mit Provisionslinks konkurriert selten mit dem Arbeitgeber, anzeigen ist trotzdem meist Pflicht.
- **Krankenversicherung:** Gesetzlich angestellt versichert — ein Nebengewerbe ändert nichts, solange es Nebensache bleibt. Familienversichert, studentisch versichert oder Bezug von Arbeitslosengeld/Bürgergeld: dort gelten Einkommensgrenzen bzw. Meldepflichten — dann vorher fragen.
- **US-Steuerstatus ⚠:** Die Bookshop-Anleitung nennt W-9 *oder* W-8BEN. **Ist Julian US-Bürger oder Green-Card-Inhaber, ist er in den USA mit dem Welteinkommen steuerpflichtig** — dann gilt W-9, eine US-Erklärung jedes Jahr, und das Doppelbesteuerungsabkommen regelt die Anrechnung. Das ändert nichts an den deutschen Schritten unten, kommt aber dazu. Sonst: W-8BEN, Einbehalt 0 % (Provisionen für Links, die außerhalb der USA gesetzt werden, sind keine US-Einkünfte).

## 1. Gewerbe anmelden

**Wo:** Gewerbeamt der Wohnsitzgemeinde; die meisten Städte bieten es online (Stadtportal oder Landesportal „Gewerbe-Service", Login mit Personalausweis-Online-Funktion oder BundID).

**Was ins Formular (GewA 1):**
- Rechtsform: **Einzelunternehmen**; Betriebsstätte: Wohnanschrift.
- Tätigkeit, so konkret wie nötig und so allgemein wie möglich: *„Betrieb von Internetseiten; Vermittlung von Waren gegen Provision (Affiliate-Marketing); Online-Werbung"*. „Online-Werbung" deckt später 4.7 (Werbeplatz) mit ab, ohne neue Ummeldung.
- Geschäftsbezeichnung: „Buy Its Covers" darf daneben stehen; die Firma eines nicht eingetragenen Einzelunternehmers ist der **eigene Vor- und Zuname** — so auch im Impressum.
- **Nebenerwerb** ankreuzen, wenn es neben einer Anstellung läuft.
- Beginn: der Umschalttag (Tag, an dem `AFFILIATE_*` in Production gesetzt ist). Konten bei Bookshop/Amazon *beantragen* ist Vorbereitung, kein Beginn.

**Danach automatisch:** Das Gewerbeamt meldet an Finanzamt, IHK, Berufsgenossenschaft, ggf. Handwerkskammer und Statistik. Die **IHK-Mitgliedschaft ist Pflicht**, kostet aber nichts, solange der Gewinn unter **5.200 €** im Jahr bleibt (natürliche Personen ohne Handelsregister); Existenzgründer sind in den ersten zwei Jahren bis 25.000 € Gewerbeertrag vom Grundbeitrag befreit.

## 2. Berufsgenossenschaft

§ 192 SGB VII: jedes neue Unternehmen meldet sich **innerhalb einer Woche** bei der zuständigen BG, auch ohne Beschäftigte; versäumt ist eine Ordnungswidrigkeit. Die Gewerbeanmeldung wird zwar weitergeleitet, die Frist läuft trotzdem. Für eine Website mit Provisionen ist voraussichtlich die **VBG** (Verwaltungs-BG) zuständig — welche, sagt die Zuständigkeitssuche der DGUV. Ein Unternehmer ohne Beschäftigte ist in der Regel nicht selbst pflichtversichert; Beitrag dann meist 0 €, eine freiwillige Versicherung wird angeboten und kann abgelehnt werden.

## 3. Fragebogen zur steuerlichen Erfassung (ELSTER)

Pflicht, elektronisch, **innerhalb eines Monats** nach Beginn (§ 138 Abs. 1b AO). ELSTER → Formulare → „Fragebogen zur steuerlichen Erfassung — Gewerbliche, selbständige (freiberufliche) oder land- und forstwirtschaftliche Tätigkeit (Einzelunternehmen)". Hat Julian noch kein ELSTER-Konto, dauert die Registrierung per Post eine Woche — **das Konto jetzt anlegen**.

Die Stellen, auf die es ankommt:
- **Gewinnermittlung:** Einnahmenüberschussrechnung (EÜR).
- **Voraussichtlicher Umsatz und Gewinn:** ehrlich niedrig schätzen (z. B. Umsatz Gründungsjahr 0–500 €, Folgejahr 1.000–2.000 €). Daraus setzt das Finanzamt Einkommensteuer-Vorauszahlungen fest; zu hoch geschätzt bindet Geld.
- **Kleinunternehmerregelung (§ 19 UStG): ja.** Voraussetzungen seit 2025: Umsatz im Vorjahr ≤ **25.000 €** und im laufenden Jahr ≤ **100.000 €**; wird die 100.000 überschritten, endet sie sofort mit dem Umsatz, der sie überschreitet.
- **USt-IdNr. beantragen: ja** (siehe 4).
- Bankverbindung: ein eigenes Konto ist nicht Pflicht, trennt aber Belege sauber; ein kostenloses zweites Girokonto genügt.

Das Finanzamt schickt danach die **Steuernummer** per Post.

## 4. USt-IdNr. — warum auch als Kleinunternehmer

Amazon PartnerNet (Amazon EU S.à r.l., Luxemburg) fragt sie ab. Die Provision ist eine Leistung an ein Unternehmen in Luxemburg, Leistungsort dort (§ 3a Abs. 2 UStG), in Deutschland nicht steuerbar; Amazon führt die Steuer per Reverse Charge selbst ab. Für Bookshop.org (USA) gilt dasselbe Ergebnis: nicht steuerbar in Deutschland.

- **Keine Zusammenfassende Meldung:** Kleinunternehmer sind davon befreit (§ 18a Abs. 4 UStG). Manche Ratgeber im Netz behaupten das Gegenteil — für Kleinunternehmer stimmt es nicht.
- **Keine Umsatzsteuer-Jahreserklärung:** seit dem Besteuerungszeitraum 2024 entfällt sie für Kleinunternehmer (§ 19 Abs. 1 Satz 4 UStG), außer das Finanzamt fordert sie an.
- ⚠ Nicht steuerbare Auslandsumsätze zählen nach herrschender Lesart **nicht** zum Gesamtumsatz der 25.000-€-Grenze (§ 19 Abs. 2 UStG: steuerbare Umsätze). Für die Grenze wäre das relevant erst bei Beträgen, die hier nicht zu erwarten sind; bestätigen lassen.

## 5. Impressum

Seit dem DDG verlangt § 5 Abs. 1 Nr. 6: **USt-IdNr. oder, falls keine, die Wirtschafts-Identifikationsnummer (W-IdNr.)**. Die W-IdNr. vergibt das BZSt automatisch seit November 2024, gestaffelt bis Ende 2027; ist eine zugeteilt, ist sie Pflichtangabe. Mit USt-IdNr. aus Schritt 4 genügt diese. Dazu ein Satz „Kleinunternehmer gemäß § 19 UStG" ist üblich, nicht Pflicht. **Claude baut das ein** — ein `IMPRINT_VAT_ID` neben den `IMPRINT_*`-Variablen (ROADMAP 4.13, Zeile 3).

## 6. Partnerkonten

- **Amazon PartnerNet (DE/EU):** im Konto Steuerinformationen: Kleinunternehmer angeben, USt-IdNr. eintragen. Amazon rechnet per Gutschrift ab; eine eigene Rechnung ist nicht nötig. Mit Kleinunternehmer-Status ohne Umsatzsteuer.
- **Amazon.com Associates, Bookshop.org US (Stripe):** Steuerinterview mit **W-8BEN** (oder W-9, siehe 0), Wohnsitzland Deutschland, Abkommensvergünstigung beanspruchen → 0 % Einbehalt.
- Belege: monatliche Abrechnungen/Gutschriften als PDF ablegen — das sind die Einnahmebelege.

## 7. Laufend: die eine Falle — Reverse Charge auf Auslandsabos ⚠

Wer als Unternehmer Leistungen von Anbietern **im Ausland** bezieht (Vercel Pro — Vercel Inc., USA —, Google Cloud aus Irland, ein Anthropic-API-Schlüssel), schuldet die deutsche Umsatzsteuer darauf selbst (§ 13b UStG). **Das gilt auch für Kleinunternehmer — ohne Vorsteuerabzug.** Folge: für jeden Monat mit einer solchen Rechnung eine **Umsatzsteuer-Voranmeldung** über ELSTER und 19 % auf den Nettobetrag zahlen; bei Vercel Pro (20 USD) rund 3,50 € im Monat. Das ist der einzige Punkt, an dem „Kleinunternehmer = keine Umsatzsteuer" nicht stimmt.

- Bei Vercel und Google die **USt-IdNr. ins Rechnungsprofil** eintragen, sobald vorhanden, damit die Rechnung ohne fremde Umsatzsteuer und mit Reverse-Charge-Vermerk kommt.
- INWX (deutscher Anbieter) ist nicht betroffen: normale Rechnung mit deutscher Umsatzsteuer, als Kleinunternehmer ist die Bruttosumme die Betriebsausgabe.
- **E-Rechnungen empfangen** können muss seit 1.1.2025 jedes Unternehmen; ein E-Mail-Postfach genügt. Ausstellen müssen Kleinunternehmer keine.
- **Belege 8 Jahre aufbewahren** (seit 2025, BEG IV; vorher 10), digital genügt.

## 8. Jährlich

- **Einkommensteuererklärung mit Anlage EÜR** (elektronisch). Betriebsausgaben: Domains, Vercel Pro samt § 13b-Steuer, ggf. Steuerberatung, anteilig Software. Der Gewinn kommt zu den übrigen Einkünften; als Angestellter ist die Erklärung Pflicht, sobald die Nebeneinkünfte **410 €** übersteigen (§ 46 Abs. 2 Nr. 1 EStG).
- **Gewerbesteuer:** Freibetrag **24.500 €** Gewerbeertrag für Einzelunternehmer; darunter fällt keine an, eine Gewerbesteuererklärung ist erst darüber abzugeben.
- **Umsatzsteuer:** keine Jahreserklärung (siehe 4), außer das Finanzamt fordert sie an — bei § 13b-Fällen kann es das tun.

## Was hier nicht steht

Verträge mit den Programmen selbst (Offenlegung, Amazons Pflichtsatz — ROADMAP 4.11, 4.13), die Datenschutzerklärung (4.13 Zeile 5) und Vercel Pro (0.6). Sobald Julian die Anmeldung gemacht hat: Datum und Steuernummer **nicht** ins Repository, nur „erledigt am …" in ROADMAP 4.4.

## Quellen (gelesen 2026-10-03)

- Kleinunternehmergrenzen 2025/2026: [mehrwertsteuerrechner.de](https://www.mehrwertsteuerrechner.de/kleinunternehmerregelung/), [steuernaut.de](https://steuernaut.de/blog/kleinunternehmerregelung-2026), [IHK Hannover](https://www.ihk.de/hannover/hauptnavigation/recht/steuerrecht/umsatzsteuer/kleinunternehmer-im-ust-5213920)
- Keine USt-Jahreserklärung seit 2024: [Haufe](https://www.haufe.de/finance/buchfuehrung-kontierung/kleinunternehmer-wann-ist-eine-ust-erklaerung-abzugeben_186_396414.html), [VGSD](https://www.vgsd.de/keine-umsatzsteuererklaerung-mehr-fuer-kleinunternehmer-innen-die-erklaerung-die-niemand-abgegeben-hat-faellt-weg/)
- Keine ZM für Kleinunternehmer: [BMF Umsatzsteuer-Handausgabe § 18a](https://usth.bundesfinanzministerium.de/usth/2021/A-Umsatzsteuergesetz/V-Besteuerung/Paragraf-18a/inhalt.html), [Handelskammer Hamburg](https://www.handelskammer-hamburg.de/recht-steuern/steuerrecht/umsatzsteuer-mehrwertsteuer/umsatzsteuer-mehrwertsteuer-international/zusammenfassende-meldung-6682984)
- Reverse Charge für Kleinunternehmer: [onlinebilanz.de](https://onlinebilanz.de/reverse-charge-kleinunternehmer/), [kleinunternehmer.de](https://www.kleinunternehmer.de/ausland.htm)
- Amazon PartnerNet und Umsatzsteuer: [Amazon PartnerNet Hilfe](https://partnernet.amazon.de/help/node/topic/GVKYCXQ2G3U4JS2C), [Kanzlei Riefer](https://kanzlei-riefer.de/blog/affiliate-marketing-gewerbe-und-steuern/)
- Fragebogen, Frist ein Monat: [IHK Darmstadt](https://www.ihk.de/darmstadt/produktmarken/gruendung/existenzgruendung-und-steuern/aufnahme-einer-gewerblichen-taetigkeit-2538356), [steuertipps.de](https://www.steuertipps.de/selbststaendigkeit/fragebogen-steuerliche-erfassung/themen)
- W-IdNr. im Impressum: [IHK München](https://www.ihk-muenchen.de/ratgeber/steuern/steuerliche-sonderthemen/wirtschafts-identifikationsnummer/), [e-recht24](https://www.e-recht24.de/unternehmensgruendung/13369-wirtschafts-identifikationsnummer.html)
- IHK-Beitragsfreiheit 5.200 €: [IHK Kassel-Marburg](https://www.ihk.de/kassel-marburg/ueber-uns/beitrag-und-mitgliedschaft/haeufig-gestellte-fragen-zum-ihk-beitrag-4103482)
- Berufsgenossenschaft, Woche nach § 192 SGB VII: [Lexware](https://www.lexware.de/wissen/gruendung/anmeldung-berufsgenossenschaft/)
- Aufbewahrung 8 Jahre: [Ecovis](https://ecovis-kso.com/blog/aufbewahrungsfristen-2025-archivierungspflicht-fuer-geschaeftsunterlagen/)
- Amazon.com und W-8BEN: [Amazon Associates Hilfe](https://affiliate-program.amazon.com/help/node/topic/GYJB2LE2AB473W2L)
