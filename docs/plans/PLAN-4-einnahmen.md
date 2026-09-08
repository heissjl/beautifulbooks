# Plan 4 (Erweiterung): Einnahmen jenseits der Affiliate-Links

Stand: 2026-09-08. Anlass: Julians Frage vom 2026-09-07, wie die Seite Geld verdienen könnte, „ohne komplett seine Ehre aufzugeben“ — welche Werbung tragbar wäre, und ob sich ein Teil des Platzes kostenlos für gute Zwecke nutzen lässt, ohne dass es peinlich wird.

> **Entscheidung 2026-09-08 (Julian):** ein von Hand verkaufter oder von Hand belegter Platz ist zu viel Arbeit. **Ein Platz ist nur dann in Ordnung, wenn ein Marktplatz ihn automatisch füllt.** Damit fallen Direktvermarktung (Abschnitt 3 C) und die von Hand gewählten guten Zwecke (3 D) als Plan weg; sie bleiben unten als Analyse stehen. Was bleibt, ist ein Platz, den ein Netzwerk ohne Kennung des Lesers bespielt. Als **E19** in der Spec, offene Punkte in [ROADMAP.md](../../ROADMAP.md) 4.7 und 4.8.

Zahlen in diesem Dokument sind **Annahmen aus veröffentlichten Größenordnungen**, keine Messungen. Wo eine Zahl gemessen werden kann, steht sie in Abschnitt 6 als Frage an Phase 3.

---

## 1. Was die Seite schon versprochen hat

Jede Einnahmequelle muss vier Sätze überleben, die schon in der Spec stehen. Sie sind die eigentliche Antwort auf die Ehren-Frage: nicht „was ist erlaubt“, sondern „was widerspricht dem, was die Seite dem Leser heute sagt“.

| Versprechen | Wo | Was es ausschließt |
|---|---|---|
| **Galerie, nicht Shop** (§5) | Gestaltung | Bannerflächen, bewegte Anzeigen, Werbung zwischen Covern oder Ergebniskarten |
| **Datensparsamkeit** (N11, E14): kein Konto, keine Kennung, kein Tracking-Cookie; kein Cookie-Banner nötig (ROADMAP 2.3) | Nicht-funktional | Jedes Werbenetz, das ein Skript lädt, das Leser wiedererkennt — also praktisch die ganze Programmatic-Werbung in der EU |
| **Reihenfolge der Händler nicht nach Provision** (§2.4, About-Seite) | Kauf-Links | Bezahlte Platzierung in Wand, Ergebnis oder Händlerliste |
| **Keine Vollständigkeit behaupten** (§1) | Text | Werbung, die die Seite größer aussehen lässt, als sie ist („der Cover-Katalog“) |

Dazu zwei Randbedingungen aus den Quellen:

- **Google Books API Terms of Service** untersagen, für die Anwendung **Gebühren vom Nutzer** zu verlangen, ohne gesonderte Vereinbarung mit Google. Ein Bezahlmodell für Leser (Abschnitt 3, Option F) ist damit nicht einfach möglich, solange die Detailseite Google-Daten zeigt. Werbung *neben* den Daten wird dort nicht verboten; das Branding-Dokument verlangt Nennung der Quelle, was die Fußzeile tut. Vor dem Einbau eines Netzwerks noch einmal im Wortlaut lesen (Frage 6.3).
- **Open Library** ist Internet-Archive-Infrastruktur, spendenfinanziert, ohne Nutzungsbeschränkung für die Daten. Die Seite lebt von ihr; die Fußzeile nennt sie.

---

## 2. Die Rechnung, bevor man über Formate spricht

Was Werbung auf dieser Seite bringen kann, hängt an einer Zahl, die es noch nicht gibt: Aufrufe der Detailseite pro Monat. Alles unten skaliert damit, und unter ein paar tausend Aufrufen ist jede Quelle Taschengeld. Die Frage für die nächsten Monate ist deshalb nicht „womit verdienen wir am meisten“, sondern **„was schadet der Seite nicht, während sie noch klein ist“**.

Größenordnungen pro **1.000 Aufrufe der Detailseite** (Annahmen, in Phase 3 zu ersetzen):

| Quelle | Rechnung | Ertrag je 1.000 Aufrufe |
|---|---|---|
| Affiliate (Bookshop.org, 10 %) | 5–10 % klicken einen Kauf-Link, davon kaufen 2–5 % innerhalb der 30 Tage, Buch ~18 USD | ~2–9 USD |
| Affiliate (Amazon, Bücher ~4–5 %) | wie oben, 24-h-Fenster, kürzer, dafür höhere Kaufquote | ~1–5 USD |
| Kontextwerbung ohne Tracking (Carbon Ads, laut Netz 0,50–1,10 USD CPM) | eine Anzeige pro Seite | ~0,5–1 USD |
| Programmatic mit Einwilligung (Mediavine/Raptive-Klasse) | in der EU nur nach Cookie-Banner; typische RPM 10–30 USD bei US-Traffic, deutlich weniger bei EU-Lesern ohne Einwilligung | ~5–25 USD, **aber** siehe Option A |
| Direktsponsor (Festpreis) | unabhängig von Aufrufen, solange klein: 50–300 EUR/Monat für einen ruhigen Platz | **gestrichen**, siehe Entscheidung oben |

Laufende Kosten, gegen die das steht: Vercel Pro 20 USD, Impressum-Service 5–10 EUR, Domain ~1 EUR, ggf. ISBNdb 15 USD (ROADMAP 4.5). **Rund 30–50 EUR im Monat** sind die Schwelle, ab der die Seite sich selbst trägt. Bei den Annahmen oben braucht das Affiliate allein etwa 5.000–15.000 Detailseiten-Aufrufe im Monat.

Zwei Schlüsse:

1. **Affiliate bleibt die Hauptquelle** und ist pro Aufruf mindestens so ergiebig wie jede Werbung, die mit N11 vereinbar ist. Das bestätigt die Reihenfolge in Phase 4.
2. Werbung ohne Tracking bringt **eine Größenordnung weniger** als Affiliate und lohnt als Einnahme erst bei fünfstelligen Aufrufen. Vorher ist sie nur eines: ein Platz, der ohne Arbeit mitläuft.

---

## 3. Die Optionen, bewertet

Bewertung in drei Spalten: **Ehre** (verträgt sich mit Abschnitt 1), **Ertrag** (Abschnitt 2), **Aufwand**. Reihenfolge nach Empfehlung, nach der Entscheidung vom 2026-09-08.

### B. Kontextwerbung ohne Tracking über einen Marktplatz (Carbon Ads, EthicalAds, BuySellAds) — der eine Weg, der bleibt

Cookie-frei nach eigener Aussage, eine Anzeige pro Seite, Text plus kleines Bild, das Netzwerk wählt Publisher und Anzeigen; **nichts davon macht Julian von Hand.** Das ist die Bedingung aus der Entscheidung, und sie ist der Grund, warum diese Option vor allen anderen steht.

- Ehre: **gut**, wenn das Netzwerk wirklich ohne Kennung des Lesers liefert (Frage 6.4) und die Regeln in Abschnitt 4 gelten. Das Skript des Netzwerks ist ein Fremdskript und gehört in die Datenschutzerklärung (ROADMAP 2.3); ob es ohne Einwilligung geht, entscheidet die Antwort auf 6.4, nicht die Werbung des Netzwerks.
- Passung: **mittel.** Carbon zielt auf Entwickler und Gestalter, EthicalAds auf Entwickler. Buchgestaltung ist gestaltungsnah, aber die Leser dieser Seite sind zuerst Leser. Ob das Netzwerk die Seite überhaupt nimmt, zeigt erst die Bewerbung.
- Ertrag: laut Netzwerk 0,50–1,10 USD CPM, also bei 10.000 Aufrufen 5–10 USD im Monat. Erst anfragen, wenn Search Console fünfstellige Impressionen zeigt; vorher lohnt nicht einmal das Formular.
- Aufwand: ein halber Tag für Komponente, Platz und Datenschutztext (4.7), danach null.

### A. Programmatic Display (AdSense, Journey by Mediavine, Raptive) — nein, solange N11 gilt

Die Zugangsschwellen sind 2026 niedrig: Journey ab 1.000 Sitzungen, Raptive ab 25.000 Aufrufen, Mediavine nach Umsatz statt Reichweite. Die Ertragsseite wäre die höchste der Tabelle, und auch hier füllt ein Marktplatz automatisch. Dagegen steht alles aus Abschnitt 1: in der EU braucht personalisierte Werbung eine Einwilligung, also ein Cookie-Banner; nicht-personalisierte Varianten setzen trotzdem Cookies zur Frequenzbegrenzung; die Datenschutzerklärung aus 2.3 würde um ein Kapitel wachsen; und die Gestaltung „Galerie, nicht Shop“ überlebt kein Anzeigenraster. Dazu ein sachlicher Konflikt: die häufigsten Anzeigen wären Buch- und Amazon-Anzeigen, die neben den eigenen Kauf-Links stehen.

**Empfehlung: nicht.** Nicht als Grundsatz für immer, sondern weil die Seite ihr Datensparsamkeits-Versprechen heute als Teil des Produkts führt. Sollte die Reichweite je so groß werden, dass die Differenz Miete zahlt, ist das eine Produktentscheidung von Julian mit Änderung von N11, nicht ein Schalter.

### E. Spendenknopf für die Seite selbst — harmlos, fast ertraglos

Eine Zeile in der Fußzeile (Ko-fi, Liberapay, GitHub Sponsors, falls der Code öffentlich wird). Bei Werkzeug-Seiten ohne Community liegt der Ertrag erfahrungsgemäß nahe null; der Schaden ist ebenfalls null, solange es eine Zeile bleibt. Einmal einrichten, nichts pflegen — das verträgt sich mit der Entscheidung. Drei Monate messen, dann behalten oder streichen. Nicht vor Phase 2.

### C. Direktvermarktung eines Platzes — gestrichen 2026-09-08

Ein stiller Platz, verkauft an passende Partner (unabhängige Verlage, Cover-Gestalter, Buchgestaltungs-Preise, Buchbinder, Literaturzeitschriften), Festpreis pro Monat. Wäre pro Aufruf die ergiebigste Werbung, die mit Abschnitt 1 vereinbar ist, weil der Käufer die Zielgruppe kauft, nicht die Aufrufe. **Gestrichen, weil es Verkaufsarbeit ist**: Mediakit, Ansprache, Rechnung, Wechsel — genau das, was Julian nicht tun will. Bleibt als Analyse stehen für den Fall, dass jemand von sich aus anfragt; dann gelten die Regeln aus Abschnitt 4 unverändert.

### D. Unbezahlte Anzeigen für gute Zwecke — als Platz gestrichen, als Fußzeilen-Zeile möglich

Julians Frage direkt: ja, das geht, und nicht peinlich, wenn drei Bedingungen gelten: **wahr** (die Seite hat wirklich etwas mit dem Zweck zu tun), **konkret** (ein Satz, was der Empfänger tut, kein Appell) und **stumm** (kein Bild leidender Menschen, kein Pop-up, keine Zähler, kein „Nur noch heute“). Der natürliche Kandidat ist **Open Library / Internet Archive**: jede Wand hier besteht aus ihren Datensätzen, und sie leben von Spenden. Zweite Reihe wären Leseförderung (Stiftung Lesen, Room to Read, Bibliotheken) und Wikimedia, aber nur, wenn Julian sie selbst unterstützt; sonst wirkt es geliehen.

Was es *nicht* gibt: ein Netzwerk, das für das Schalten von Wohltätigkeits-Anzeigen bezahlt oder sie automatisch auswählt. Google Ad Grants und Ähnliches geben gemeinnützigen Organisationen Anzeigenbudget, nicht Seiten, die sie zeigen. Eine unbezahlte Anzeige ist also **kein Einkommen, sondern eine Ausgabe** (der Platz), und sie muss von Hand gewählt werden — **deshalb als Platz gestrichen.** Was ohne Pflege geht: ein Satz in der Fußzeile, einmal geschrieben, „Every cover here comes from Open Library, which runs on donations“, mit Link. Das ist Quellenangabe mit Adresse, keine Anzeige, und die Fußzeile nennt die Quelle ohnehin. Ob der Satz hinein soll, ist eine Zwei-Minuten-Frage für 2.3.

Verwandt, und in der Händlerliste statt im Werbeplatz zu prüfen: **Händler, die selbst spenden und Provision zahlen** — buch7.de (75 % des Gewinns an soziale Projekte; Partnerprogramm existiert, Satz nicht veröffentlicht, anfragen) und Better World Books (spendet Bücher; Partnerprogramm über Impact prüfen). Für den DE-Markt wäre buch7 der einzige Link, der zugleich Provision bringt und dem Leser etwas Gutes tut. → ROADMAP 4.3 ergänzt. Das ist einmal einrichten, keine laufende Arbeit.

### F. Bezahlfunktionen für Leser oder Händler — gesperrt durch Google, langfristig offen

Ideen gäbe es: Hochauflösungs-Export einer Wand, Benachrichtigung bei neuen Ausgaben, ein Einbett-Widget für Blogs und Buchhändler, eine API „welches Cover liefert der Handel zu dieser ISBN wirklich“ für Antiquariate. Zwei Sperren: die Google-Books-Bedingungen (keine Gebühren ohne Vereinbarung) und die Bildrechte (die Cover sind nicht unsere). Was bliebe, wäre eine Funktion allein auf Open-Library-Daten und unseren eigenen Signaturen. Frühestens nach Phase 5, und nur, wenn jemand danach fragt.

### Ausgeschlossen, mit Begründung

| Idee | Warum nicht |
|---|---|
| Poster, Drucke, Merch aus Cover-Wänden | Die Cover sind urheberrechtlich geschützt; die Seite zeigt sie als Katalogbilder. Verkauf ist Verwertung. |
| Bezahlte Platzierung in Wand, Ergebnis oder Händlerliste; „Verlagsempfehlung“ in der Wand | Widerspricht dem Satz auf der About-Seite und dem Ranking-Versprechen. Die Wand bleibt rein, auch gekennzeichnet. |
| Amazon Native Shopping Ads und ähnliche Händler-Werbung | Der Händler, der Provision zahlt, würde zusätzlich Anzeigenplatz kaufen; für den Leser nicht mehr unterscheidbar. |
| Verkauf von Klickdaten an Verlage („welches Cover wird gewählt“) | Aggregate wären erlaubt (E14), aber so klein, dass sie nichts wert sind, und der Verdacht, die Seite sammle für Dritte, kostet mehr als er bringt. Falls je, dann offen veröffentlicht, nicht verkauft. |
| Newsletter mit Werbung | In Phase 5 gestrichen (PLAN-5). |

---

## 4. Werberegeln (Entscheidung E19 in SPEC §6)

1. **Ein Platz.** Es gibt höchstens eine Anzeige pro Seite, an einer festen Stelle außerhalb der Cover-Wand, außerhalb des Ergebnisrasters und außerhalb der Händlerliste. Vorschlag: unterhalb der Seitenleiste auf der Detailseite und in der Fußzeilen-Zone der Startseite; nie in der Schublade auf dem Telefon. **Nicht** der leere Platz oben rechts aus ROADMAP 1.9.
2. **Automatisch gefüllt, nie von Hand.** Den Platz belegt ein Netzwerk, das Anzeigen selbst wählt. Kein Verkauf, keine Belegung, keine Freigabe durch Julian; was das Netzwerk nicht füllt, bleibt leer.
3. **Keine Kennung des Lesers.** Das Skript des Netzwerks darf keinen Cookie setzen und den Leser nicht wiedererkennen (N11, E14). Ist das nicht belegt, gibt es den Platz nicht. Das Skript wird in der Datenschutzerklärung genannt.
4. **Gekennzeichnet** als „Sponsored“ oder wie das Netzwerk es verlangt, und die About-Seite sagt mit einem Satz, dass der Platz die Reihenfolge von nichts beeinflusst.
5. **Passend.** Das Netzwerk muss Kategorien ausschließen können; ausgeschlossen werden Finanzprodukte, Kurse, Schreib- und Zusammenfassungs-Werkzeuge, alles, was das Buch ersetzen will. Ist das nicht einstellbar, gibt es den Platz nicht.
6. **Niemand zahlt mit Funktion.** Die Seite bleibt für alle gleich; kein Anzeigenkunde bekommt Einfluss auf Wand, Ranking, Verdikt oder Händlerliste.

---

## 5. Vorläufiger Plan

Gebunden an die bestehenden Phasen. Vor Phase 2 passiert nichts, weil nichts davon auf `localhost` Sinn hat und die Reihenfolge der Roadmap (Deployment vor Geld) gilt.

| Wann | Was | Wer | Roadmap |
|---|---|---|---|
| Erledigt 2026-09-08 | Regeln als E19 in der Spec | Claude | 4.6 ✓ |
| Mit 4.3 (weitere Programme) | buch7 und Better World Books als Partner anfragen | Julian | 4.3 (ergänzt) |
| Mit 2.3 | Fußzeilen-Satz zu Open Library mit Spendenlink, ja oder nein; Spendenzeile für die Seite selbst, ja oder nein | Julian, zwei Minuten | 2.3 |
| Ab fünfstelligen Impressionen in der Search Console | Bei Carbon Ads oder EthicalAds bewerben; vorher Frage 6.4 klären. Bei Zusage: Komponente, Platz, Datenschutztext, About-Satz | Julian bewirbt, Claude baut, ein halber Tag | 4.7 |
| Drei Monate nach 4.7 | Ertrag und Klickrate ansehen; unter dem, was das Netzwerk auszahlt, den Platz entfernen, nicht die Regeln | beide | 4.8 |
| Nie ohne neue Entscheidung | Programmatic Display; Bezahlfunktionen mit Google-Daten; Merch | Julian | — |

---

## 6. Plan für weitere Analyse — Fragen, die vor 4.7 geklärt sein müssen

1. **Wie viele Detailseiten-Aufrufe hat ein Monat, und wie viele davon klicken einen Kauf-Link?** Ersetzt die Annahmen in Abschnitt 2. Kommt aus 3.1 und den Partner-Dashboards (3.3).
2. **Kennzeichnungsrecht.** Wortlaut „Anzeige“/„Sponsored“ nach § 6 DDG und UWG für eine englischsprachige Seite mit deutschem Betreiber. Eine Stunde Recherche oder eine Frage an denjenigen, der das Impressum macht (0.4).
3. **Google Books API Terms of Service im Wortlaut**: Beschränkungen für Werbung neben API-Daten, Branding-Pflichten, und ob „keine Gebühren“ auch Spendenknöpfe für die Seite berührt (vermutlich nicht, prüfen).
4. **Carbon Ads / EthicalAds technisch — die entscheidende Frage:** liefern sie ohne Cookie und ohne Kennung? Welche Daten verlässt der Browser des Lesers an das Netzwerk (IP, Referrer, Seiten-URL)? Braucht es dafür nach DSGVO und TTDSG eine Einwilligung, oder reicht ein Satz in der Datenschutzerklärung? Lassen sich Kategorien ausschließen (Regel 5)? Welche Mindestreichweite verlangen sie derzeit tatsächlich? Fällt eine Antwort negativ aus, gibt es den Platz nicht (Regel 3 und 5).
5. **buch7 Partnerprogramm:** Provisionssatz, Netzwerk (direkt oder Awin/Adcell), Link-Format nach ISBN, robots.txt des Zielpfads (das Problem aus 4.1 nicht wiederholen).

---

## Quellen der Zahlen (abgerufen 2026-09-07)

- Bookshop.org: 10 % für Nicht-Buchhandlungs-Partner, bis 15 % im erweiterten Programm, 30-Tage-Fenster — [support.bookshop.org](https://support.bookshop.org/en/support/solutions/articles/65000191390-can-you-explain-bookshop-org-s-affiliate-program-), [getlasso.co](https://getlasso.co/affiliate/bookshop/)
- Raptive ab 25.000 Aufrufen — [Search Engine Journal](https://www.searchenginejournal.com/raptive-drops-traffic-requirement-by-75-to-25000-views/558780/); Mediavine nach Umsatz, Journey ab 1.000 Sitzungen — [jupiter.co](https://www.jupiter.co/blog/mediavine-requirements-2026-how-to-qualify), [productiveblogging.com](https://www.productiveblogging.com/everything-you-need-to-know-about-journey-by-mediavine/)
- Carbon Ads: Zielgruppe Entwickler und Gestalter, CPM 0,50–1,10 USD, handverlesene Publisher — [carbonads.net/faq](https://www.carbonads.net/faq), [carbonads.net/join](https://www.carbonads.net/join)
- Google Books API: keine Gebühren vom Nutzer ohne Vereinbarung — [developers.google.com/books/terms](https://developers.google.com/books/terms), [Branding Guidelines](https://developers.google.com/books/branding)
- buch7: 75 % des Gewinns gespendet, Partnerprogramm ohne veröffentlichten Satz — [buch7.de/unsere-partner](https://www.buch7.de/unsere-partner)
