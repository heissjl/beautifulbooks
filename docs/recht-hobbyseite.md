# Impressum und Datenschutzerklärung für die Hobby-Seite: was mindestens sein muss

Stand: 2026-09-08, Recherche von Claude auf Julians Frage („welche Minimalforderungen wir erfüllen müssen für die Hobbyseite, was Datenschutzerklärung und Impressum angeht“). **Keine Rechtsberatung**; die Quellen stehen bei jedem Befund, die Gesetzestexte sind nachgelesen, die Auslegungen stammen von Medienanstalten, IHKs und Anwaltsseiten. Gehört zu [PLAN-2-mvp-hobby.md](plans/PLAN-2-mvp-hobby.md) §3 und ROADMAP 0.4, 0.6, 2.3.

## 1. Das Ergebnis in vier Sätzen

1. **Ein Impressum mit Name und ladungsfähiger Anschrift ist Pflicht, sobald die Seite öffentlich ist** — nicht wegen § 5 DDG, sondern wegen § 18 Abs. 1 MStV, der für *jedes* Telemedium gilt, das „nicht ausschließlich persönlichen oder familiären Zwecken“ dient. Eine Cover-Suche für jedermann ist kein Familienalbum. „Ohne großes Impressum“ heißt also: ohne Telefon, ohne Umsatzsteuer-ID, ohne Register, ohne Verantwortlichen nach § 18 Abs. 2 — aber **nicht ohne Anschrift**.
2. **Der Unterschied zwischen dem kleinen Impressum (MStV) und dem vollen (§ 5 DDG) ist für eine Privatperson ohne Gewerbe genau eine Zeile: die E-Mail-Adresse.** Ob neutrale Händler-Links die Seite „geschäftsmäßig“ machen, ist eine Grauzone; die billigste Antwort ist, die E-Mail dazuzuschreiben und beide Vorschriften zu erfüllen.
3. **Eine Datenschutzerklärung ist unabhängig davon Pflicht** (Art. 13 DSGVO), weil das Hosting IP-Adressen verarbeitet. Kein Cookie-Banner nötig: nichts auf der Seite braucht eine Einwilligung.
4. **Der eine echte Haken ist nicht das Impressum, sondern Vercel Hobby:** Vercels Auftragsverarbeitungsvertrag (Art. 28 DSGVO) gilt nur für Pro und Enterprise. Auf dem Hobby-Plan fehlt er. Das ist eine Entscheidung für Julian (§ 5 unten).

## 2. Impressum

### 2.1 Zwei Vorschriften, zwei Schwellen

| Vorschrift | Gilt für | Verlangt |
|---|---|---|
| **§ 18 Abs. 1 MStV** | Telemedien, „die nicht ausschließlich persönlichen oder familiären Zwecken dienen“ | „1. Name und Anschrift sowie 2. bei juristischen Personen auch Name und Anschrift des Vertretungsberechtigten“, „leicht erkennbar, unmittelbar erreichbar und ständig verfügbar“ |
| **§ 5 Abs. 1 DDG** | „geschäftsmäßige, in der Regel gegen Entgelt angebotene digitale Dienste“ | Nr. 1 Name und Anschrift, Nr. 2 Angaben für schnelle elektronische Kontaktaufnahme (E-Mail), dazu Nr. 3–8 nur für Aufsicht, Register, reglementierte Berufe, USt-ID, Abwicklung, audiovisuelle Dienste — für eine Privatperson ohne Gewerbe alles nicht einschlägig |
| **§ 18 Abs. 2 MStV** | journalistisch-redaktionell gestaltete Angebote | zusätzlich einen Verantwortlichen mit Name und Anschrift |

Gesetzestexte: [§ 18 MStV](https://dr-dsgvo.de/18-mstv-informationspflichten-und-auskunftsrechte/), [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html). Auslegung der Medienanstalten: [Leitfaden LFK Baden-Württemberg](https://www.lfk.de/service/dokumente-rechtsgrundlagen/leitfaden-zur-impressumspflicht-im-internet), [Leitfaden NLM Niedersachsen (PDF)](https://www.nlm.de/fileadmin/dateien/infothek/pdf/leitfaden_impressumspflicht_NLM.pdf).

**Was das für Beautiful Books heißt.** Die Ausnahme „ausschließlich persönlich oder familiär“ ist eng: Familienseiten, private Fotogalerien, Hobby-Blogs für den eigenen Kreis. Eine Seite, die für beliebige Besucher Bücher sucht und in der Sitemap steht, fällt nicht darunter — der LFK-Leitfaden fasst § 18 Abs. 1 so: „solche Online-Angebote müssen den Namen und den (Wohn-)Sitz […] angeben.“ Das kleine Impressum ist also nicht verhandelbar.

**Geschäftsmäßig oder nicht — die Grauzone der neutralen Händler-Links.** Der LFK-Leitfaden nennt als geschäftsmäßig: Bannerwerbung, Affiliate-Links, Monetarisierungs-Tools, Werbekooperationen, Produktvorstellung gegen geldwerten Vorteil; auf die Entgeltlichkeit des Dienstes selbst kommt es „nach der ständigen Rechtsprechung nicht an“. Links ohne Gegenleistung stehen nicht in der Liste. [eRecht24](https://www.e-recht24.de/artikel/datenschutz/209.html) zieht die Linie bei „Werbebanner oder Teilnahme an einem Affiliate-Programm“. Eine Anwaltsseite ([adressgeber.de](https://adressgeber.de/impressumspflicht-fuer-private-website-wann-brauchst-du-laut-gesetz-ein-impressum/)) sieht schon Produktempfehlungen „auch ohne direkte Einnahmen“ als geschäftsmäßig, nennt dafür aber keine Entscheidung. **Folgerung:** Mit `NEXT_PUBLIC_SITE_MODE=hobby` (keine Provisionsparameter, kein Provisionssatz, kein `rel="sponsored"`) steht die Seite auf der sicheren Seite der Leitfäden; ganz ausschließen lässt sich die Lesart nicht. Da § 5 DDG für Julian nur die E-Mail-Adresse zusätzlich verlangt, ist die Frage praktisch ohne Preis zu erledigen: **Name, Anschrift, E-Mail** erfüllt beides.

**Impressumsverstöße sind ein Abmahnklassiker** (eRecht24), und zwar wegen Wettbewerbsrechts — das trifft vor allem Seiten mit Mitbewerbern. Für eine Hobby-Seite ist das Risiko kleiner, aber nicht null, und die Medienanstalten können Bußgelder nach dem MStV verhängen.

### 2.2 Die Anschrift: was zulässig ist

- **Ladungsfähig** heißt: dort können Schriftstücke wirksam zugestellt werden. **Ein Postfach genügt nicht**, eine reine Briefkasten- oder Weiterleitungsadresse auch nicht ([eRecht24](https://www.e-recht24.de/impressum/13082-ladungsfaehige-anschrift.html), [media-loft-koblenz](https://www.media-loft-koblenz.de/2026/01/27/postfach-im-impressum/)).
- **Die Privatadresse lässt sich vermeiden**, aber nur durch eine andere ladungsfähige Adresse: ein Impressum-Service mit c/o-Adresse und **ausdrücklicher Empfangsvollmacht** (nach einer BGH-Entscheidung zulässig, [ihr-impressum.de](https://ihr-impressum.de/pages/impressum-ohne-private-adresse), [smarvo.de](https://smarvo.de/privatadresse-im-impressum/)), oder ein angemieteter Platz, an dem Zustellung tatsächlich möglich ist. Das ist die Option aus ROADMAP 0.4 (5–10 EUR/Monat). **Der Hobby-Modus erspart diese Kosten nicht** — er erspart nur die Angaben, die eine Privatperson ohnehin nicht hat.

### 2.3 Wann § 18 Abs. 2 MStV (Verantwortlicher) dazukommt

Erst mit journalistisch-redaktionellen Inhalten, also mit den Seitengattungen aus Phase 5 („Cover der Woche“, Verlagsseiten mit Text). Eine Suchmaske und eine Cover-Wand sind keine Redaktion ([it-recht-kanzlei](https://www.it-recht-kanzlei.de/redaktionell-verantwortlicher-online-shop.html), [res-media](https://www.res-media.net/18-mstv-das-impressum-und-der-verantwortliche/)). Dann kommt eine Zeile „Verantwortlich nach § 18 Abs. 2 MStV: Name, Anschrift“ dazu — dieselbe Person, dieselbe Adresse. Vermerk für PLAN-5.

### 2.4 Der Text, den die Seite braucht

Eine Seite `/contact` (oder `/imprint`; der Name ist frei, aber das Wort „Impressum“ sollte im Titel stehen, damit die Angaben „leicht erkennbar“ sind), aus der Fußzeile verlinkt, mit:

```
Impressum / Legal notice
Julian Heiss
<ladungsfähige Anschrift>
<E-Mail>
```

Sprache: die Vorschriften schreiben keine vor; Englisch mit dem deutschen Wort „Impressum“ in der Überschrift ist üblich für englischsprachige Seiten deutscher Betreiber.

## 3. Datenschutzerklärung

### 3.1 Warum sie Pflicht ist

Art. 13 DSGVO verlangt die Information bei jeder Verarbeitung personenbezogener Daten, und es gibt keine Ausnahme für kleine oder private Seiten ([IHK München](https://www.ihk-muenchen.de/ratgeber/recht/datenschutz/eu-datenschutz-grundverordnung/datenschutzerklaerung/), [giel-rechtsanwalt](https://giel-rechtsanwalt.de/allgemein/datenschutzerklaerung-webseite-pflicht/)). Schon das Hosting verarbeitet IP-Adressen in Server-Logs, und eine IP-Adresse ist ein personenbezogenes Datum. Die Haushaltsausnahme (Art. 2 Abs. 2 c) greift für eine öffentliche Seite nicht.

### 3.2 Was Beautiful Books im Hobby-Modus tatsächlich verarbeitet

Alles gemessen am Code, nicht angenommen (Stand `mvp-hobby`, 2026-09-08):

| Vorgang | Daten | Wohin | Rechtsgrundlage | Einwilligung? |
|---|---|---|---|---|
| Hosting und Auslieferung | IP-Adresse, User-Agent, aufgerufene URL, Zeit (Server-Logs) | Vercel Inc., USA; Funktionen in `fra1` | Art. 6 Abs. 1 f (berechtigtes Interesse: Betrieb, Sicherheit) | nein |
| Vercel Web Analytics | Seitenaufruf, Referrer, Land/Region, Gerätetyp, Browser; Besucher als Hash aus der Anfrage, nach 24 h verworfen; **keine Cookies, nichts im Gerät gespeichert** ([Vercel](https://vercel.com/docs/analytics/privacy-policy)) | Vercel Inc. | Art. 6 Abs. 1 f | nein — § 25 TDDDG greift nicht, weil nichts in der Endeinrichtung gespeichert oder gelesen wird |
| Cover-Bilder | der Browser lädt Bilder direkt von `covers.openlibrary.org` (leitet auf archive.org weiter) und `books.google.com`; dabei sehen diese Server die IP-Adresse | Internet Archive (USA), Google (USA) | Art. 6 Abs. 1 f (die Bilder *sind* der Dienst) | nein; **aber: ein eigener Bild-Cache (ROADMAP 1.3) würde diesen Abfluss beenden und ist damit auch ein Datenschutzpunkt** |
| Suche, Werk, ISBN | die Anfrage geht **vom Server** an Open Library und Google Books (N1); der Leser bleibt für die Quellen unsichtbar, nur der Suchbegriff reist | — | — | nein |
| localStorage: letzte Suchen; sessionStorage: Ladeszene; Cookie `market` | nur im Gerät des Lesers, nie an den Server außer dem Cookie `market` | — | § 25 Abs. 2 Nr. 2 TDDDG: unbedingt erforderlich für eine vom Nutzer gewünschte Funktion (eigene Suchhistorie, gewählter Markt) | nein, aber **nennen** |
| Klickzählung `/go/` | Händler, Markt, ISBN, Linkart, Zeit — **keine** IP, kein Cookie, kein User-Agent, kein Referrer (F5, E14) | Vercel-Logs | keine personenbezogenen Daten | nein, aber nennen, weil es Vertrauen schafft |

**Kein Cookie-Banner.** Nichts oben braucht eine Einwilligung; § 25 TDDDG ([Text](https://www.gesetze-im-internet.de/ttdsg/__25.html)) ist nur für den Cookie `market` und die Storages überhaupt berührt, und die fallen unter die Ausnahme in Abs. 2 Nr. 2. Das ändert sich am Tag, an dem ein Werbenetzwerk oder ein Tracking-Tool dazukommt (E19 verbietet genau das).

### 3.3 Der Mindestinhalt

Nach Art. 13 und der Praxis der IHKs ([IHK Regensburg](https://www.ihk.de/regensburg/fachthemen/recht/online-recht-und-datenschutz/eu-datenschutzgrundverordnung/anforderungen-an-websites-nach-der-ds-gvo-4158848), [website-prüfung.de](https://website-pruefung.de/ratgeber/datenschutzerklaerung-website/)):

1. **Verantwortlicher**: Name, Anschrift, E-Mail (dieselben Angaben wie im Impressum).
2. **Je Vorgang aus 3.2**: was, wozu, Rechtsgrundlage, Empfänger, Speicherdauer (Vercel-Logs: Frist aus Vercels Doku eintragen; Analytics-Hash 24 h).
3. **Drittlandtransfer**: Vercel ist unter dem EU-US Data Privacy Framework zertifiziert ([Vercel-Changelog](https://vercel.com/changelog/vercel-is-now-certified-under-the-eu-us-data-privacy-framework-dpf), [Vercel KB](https://vercel.com/kb/guide/is-vercel-certified-under-dpf)); für Internet Archive und Google die Bildabrufe als Drittlandkontakt nennen (Google ebenfalls DPF-zertifiziert; Internet Archive: prüfen, sonst Art. 49 Abs. 1 b oder berechtigtes Interesse mit Hinweis).
4. **Betroffenenrechte** (Auskunft, Löschung, Berichtigung, Einschränkung, Widerspruch, Datenübertragbarkeit) und das **Beschwerderecht bei einer Aufsichtsbehörde** — ein Absatz.
5. **Keine Pflicht zur Bereitstellung**, keine automatisierte Entscheidungsfindung — ein Satz.
6. **Datum** der Fassung.

Ein Generator (eRecht24, IHK) liefert die Standardabsätze; die Tabelle aus 3.2 ist das, was kein Generator weiß und was hier stimmen muss (N12 gilt auch für die Datenschutzerklärung: nichts nennen, was die Seite nicht tut, und nichts weglassen, was sie tut).

## 4. Vercel Web Analytics, genauer

Vercels eigene Angaben ([Privacy and Compliance](https://vercel.com/docs/analytics/privacy-policy), Stand 2026-06-26): keine Drittanbieter-Cookies, Besucher als Hash aus der eingehenden Anfrage, Sitzung nach 24 h verworfen, „no personal identifiers that track and cross-check end users' data across different applications or websites“, gespeichert werden Zeit, URL, Pfadmuster, Referrer, gefilterte Query-Parameter, Geolokation auf Stadtebene, Gerät, Browser. Anbieter-Einschätzungen ([flowconsent](https://www.flowconsent.com/en/services/hosting/vercel)) halten es für unter berechtigtem Interesse einsetzbar, raten aber zur Nennung in der Datenschutzerklärung — was 3.2 tut. **Zu beachten:** `?q=` (der Suchbegriff) landet als Query-Parameter bei Vercel; ein Suchbegriff ist selten personenbezogen, aber „mein Name“ als Suche wäre es. `beforeSend` in `@vercel/analytics` kann `q` entfernen; im Plan vorsehen und in 3.2 nennen.

## 5. Der Haken: Vercel Hobby hat keinen Auftragsverarbeitungsvertrag

Vercels [Data Processing Addendum](https://vercel.com/legal/dpa) (Stand 2026-03-17) sagt wörtlich: „This Addendum applies to Vercel's Processing of Personal Data as a Processor under the Agreement for Customers who are on Enterprise and Pro plans.“ Der Hobby-Plan wird nicht erwähnt. Art. 28 Abs. 3 DSGVO verlangt aber für jede Auftragsverarbeitung — und Hosting ist eine — einen Vertrag mit festgelegtem Inhalt. Die DPF-Zertifizierung löst den *Transfer* (Art. 44 ff.), nicht den fehlenden *Vertrag* (Art. 28).

Drei Wege, mit Preis:

| Weg | Was passiert | Preis |
|---|---|---|
| **(a) Hobby-Plan, Lücke bewusst tragen** | Datenschutzerklärung nennt Vercel als Hoster mit DPF; der Art.-28-Vertrag fehlt. Für eine Seite ohne Konto, ohne Formular und ohne Tracking ist der Schaden für Betroffene minimal, die Lücke ist trotzdem formal | 0 EUR; ein Restrisiko gegenüber einer Aufsichtsbehörde, das bei einer Hobby-Seite ohne Beschwerdeanlass klein ist |
| **(b) Vercel Pro** | DPA gilt automatisch „upon Customer entering into the Agreement“; nebenbei ist der Plan kommerziell nutzbar, also auch für die Shop-Variante | 20 USD/Monat |
| **(c) Cloudflare Pages** | Cloudflares [Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) gilt für Self-Serve-Kunden, DPF-zertifiziert, kostenloser Plan erlaubt kommerzielle Nutzung (ROADMAP 0.6) | Umbau auf OpenNext, anderes Cache-Verhalten (E6 hängt am Next-Datencache) — ein bis zwei Tage und eine neue Messreihe |

**Empfehlung:** (a) für den MVP, **ausdrücklich als Entscheidung in ROADMAP 0.6 eingetragen**, mit (b) als erstem Schritt, sobald die Seite irgendetwas anderes als Stöbern erlaubt oder die Shop-Variante live geht. (c) nur, wenn Julian ohnehin weg von Vercel will.

## 6. Checkliste für Sitzung 1

- [ ] `/contact` mit Name, ladungsfähiger Anschrift, E-Mail; Überschrift enthält „Impressum“
- [ ] `/privacy` nach 3.3 mit der Tabelle 3.2 in Prosa; Vercel-Log-Frist aus der Doku nachtragen
- [ ] beide in der Fußzeile, auf jeder Seite, mit einem Klick erreichbar
- [ ] `beforeSend` entfernt `q` aus den Analytics-URLs
- [ ] Julian: Anschrift entscheiden (privat oder c/o-Service, 0.4) und Weg (a)/(b)/(c) aus § 5

## Quellen

Gesetze: [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html), [§ 18 MStV](https://dr-dsgvo.de/18-mstv-informationspflichten-und-auskunftsrechte/), [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html). Medienanstalten: [LFK](https://www.lfk.de/service/dokumente-rechtsgrundlagen/leitfaden-zur-impressumspflicht-im-internet), [NLM (PDF)](https://www.nlm.de/fileadmin/dateien/infothek/pdf/leitfaden_impressumspflicht_NLM.pdf). IHKs: [München](https://www.ihk-muenchen.de/ratgeber/recht/datenschutz/eu-datenschutz-grundverordnung/datenschutzerklaerung/), [Regensburg](https://www.ihk.de/regensburg/fachthemen/recht/online-recht-und-datenschutz/eu-datenschutzgrundverordnung/anforderungen-an-websites-nach-der-ds-gvo-4158848), [Düsseldorf](https://www.ihk.de/duesseldorf/recht-und-steuern/recht/internetrecht/impressum-5109750). Anwalts- und Ratgeberseiten: [eRecht24 Impressum](https://www.e-recht24.de/artikel/datenschutz/209.html), [eRecht24 Anschrift](https://www.e-recht24.de/impressum/13082-ladungsfaehige-anschrift.html), [Legal Cockpit](https://www.cockpit.legal/impressum-pflicht-webseite/), [adressgeber.de](https://adressgeber.de/impressumspflicht-fuer-private-website-wann-brauchst-du-laut-gesetz-ein-impressum/), [it-recht-kanzlei](https://www.it-recht-kanzlei.de/redaktionell-verantwortlicher-online-shop.html), [res-media](https://www.res-media.net/18-mstv-das-impressum-und-der-verantwortliche/), [giel-rechtsanwalt](https://giel-rechtsanwalt.de/allgemein/datenschutzerklaerung-webseite-pflicht/), [website-prüfung.de](https://website-pruefung.de/ratgeber/datenschutzerklaerung-website/), [ihr-impressum.de](https://ihr-impressum.de/pages/impressum-ohne-private-adresse), [smarvo.de](https://smarvo.de/privatadresse-im-impressum/), [media-loft-koblenz](https://www.media-loft-koblenz.de/2026/01/27/postfach-im-impressum/). Vercel: [Analytics Privacy](https://vercel.com/docs/analytics/privacy-policy), [DPA](https://vercel.com/legal/dpa), [DPF-Changelog](https://vercel.com/changelog/vercel-is-now-certified-under-the-eu-us-data-privacy-framework-dpf), [KB DPF](https://vercel.com/kb/guide/is-vercel-certified-under-dpf). Cloudflare: [Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/). Einschätzung Dritter zu Vercel: [flowconsent](https://www.flowconsent.com/en/services/hosting/vercel), [meetergo](https://scan.meetergo.com/en/vendors/vercel).
