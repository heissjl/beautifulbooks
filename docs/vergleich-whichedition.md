# Vergleich: whichedition.com (2026-10-01)

Julian: „compare https://www.whichedition.com/ with our project and see what we can learn from it and how the affiliate links work". Gelesen am 2026-10-01 per HTTP: Startseite, `/the-iliad`, `/the-iliad/compare`, `/crime-and-punishment`, `/about`, `robots.txt`, `sitemap.xml`. Keine Konten, keine Klicks auf Kauflinks.

## Was die Seite ist

„Which Edition — the best editions and translations of the classics". Eine Person kauft die Ausgaben, liest sie und schreibt auf, welche Übersetzung für wen taugt. Next.js mit Tailwind (dieselbe Technik wie wir), 141 URLs in der Sitemap: rund 70 Werke in sieben Regalen (Greek & Roman, Russian, European Fiction, Philosophy & Stoicism, Eastern Classics, English Classics, Shakespeare), je Werk eine Empfehlungsseite und eine `/compare`-Seite. `robots.txt` erlaubt alles. Stand laut About-Seite: Juni 2026.

**Die Frage ist eine andere als unsere.** Whichedition beantwortet „welche Übersetzung soll ich lesen?" mit einer Meinung und fünf Ausgaben je Werk. Wir beantworten „wie sah dieses Buch überall aus?" mit allem, was zwei offene Kataloge halten — Hunderte Cover je Werk, keine Wertung. Überschneidung gibt es nur beim Kaufen: beide führen am Ende zu einer ISBN.

### Werkseite (`/the-iliad`)

- Titel: „Best Translations of the Iliad: Fagles vs. Wilson vs. Lattimore" — genau die Suchanfrage, die Leser tippen.
- „Pick what matters most to you": fünf Karten, jede mit einem **Etikett** („Best for most", „Newest", „Most literal", „Best for going deep", „Most lyrical"), Übersetzer, Jahr und zwei bis drei Sätzen Urteil.
- Je Karte drei Knöpfe: **Buy now** (Amazon), **Borrow — from a library — Free** (WorldCat), in Grün „Free".
- Darunter, in jeder Seite: „Which Edition earns a small commission from purchases made through our links, at no extra cost to you — it never changes our picks."

### Vergleichsseite (`/the-iliad/compare`)

Spalten je Ausgabe, eine davon „Selected", in Abschnitten:

- **Read it** — derselbe Anfangsvers in jeder Übersetzung (bei drei von fünf noch „Sample coming soon").
- **Hold it** — Platz für eigene Fotos der Bücher („placeholder · bespoke shots to come").
- **Study it** — wer das Vorwort schrieb, wie viele Anmerkungen und wo (im Text / hinten), Karten, Stammbäume, Glossar.
- **Book details** — ISBN, Verlag, Jahr, Seiten, **Format in Zoll, Gewicht in Gramm**.

### Strukturierte Daten

Je Werkseite ein JSON-LD-Graph aus `FAQPage` („What is the best translation of The Iliad?" mit der Empfehlung als Antwort), `ItemList` aus fünf `Book` mit `translator`, `publisher`, `isbn`, `datePublished`, und `BreadcrumbList`.

## Wie die Affiliate-Links funktionieren

Ein Programm, ein Markt, ein Linktyp:

```
https://www.amazon.com/dp/<ISBN-10>?tag=whicheditio09-20
```

- **Amazon Associates US**, Tag `whicheditio09-20` (das `-20` ist die Endung, die Amazon US jedem Tag gibt). Der Link geht direkt auf die Produktseite der ISBN-10, also genau die Form, die `lib/buylinks.ts` schon baut (`amazon()`, `/dp/<isbn10>` plus `tag=`).
- **Kein Umweg über die eigene Seite**: kein Redirect, kein Klickzähler, kein `/go/…` — der Link steht fertig im HTML. Gezählt wird nur in Amazons eigenem Bericht.
- **Nur amazon.com, für jeden Leser.** Kein Ländererkennung, keine Shops für UK oder DE; wer aus Deutschland klickt, landet in Amazons US-Laden (und Amazon bietet ihm dort höchstens den Wechsel an). Provision gibt es dann nur, wenn er dort kauft.
- **`rel="noreferrer"`, aber kein `rel="sponsored"`.** Google verlangt `sponsored` (oder `nofollow`) für bezahlte Links; Whichedition lässt es weg. Wir setzen es schon, sobald `shop` gilt (`components/BookDetail.tsx`, Zeile mit `commerceEnabled()`).
- **Kein Preis.** Amazons Bedingungen erlauben Preise nur über die eigene API; Whichedition zeigt keinen. Wir auch nicht.
- **Kein zweiter Händler.** Kein Bookshop.org, kein Antiquariat, kein eBay; neben Amazon nur die Bibliothek.
- **Bibliothekslink ohne Provision**: `https://search.worldcat.org/search?q=bn:<ISBN-13>` — eine WorldCat-Suche nach genau der ISBN, gleichrangig neben „Buy now".
- **Hinweis** zweimal: als Satz unter den Knöpfen auf jeder Seite, und auf der About-Seite unter „How this is funded" mit dem Versprechen „the pick is the pick". **Der Satz, den Amazons Teilnahmebedingungen wörtlich verlangen** („As an Amazon Associate I earn from qualifying purchases"), steht auf keiner der fünf gelesenen Seiten — eigene Worte statt der Pflichtformel. Für uns: bei 4.2 die Formel wörtlich übernehmen, nicht nur sinngemäß.

Gemessen an unserer Lage (ROADMAP Phase 4): Whichedition hat das Amazon-Konto, das wir erst mit Verkehr beantragen wollen (4.2, drei Verkäufe in 180 Tagen), und verzichtet auf alles, was wir zusätzlich bauen — Märkte, Bookshop.org, Klickprotokoll, Verdikt über das Cover. Die einfache Form funktioniert, weil die Seite **eine** Ausgabe empfiehlt: wer „Best for most" liest, will genau diese ISBN, und ein Knopf genügt. Bei uns sucht der Leser ein Cover, und eine ISBN verspricht kein Cover (E8) — darum die Verdikte und mehrere Händler.

## Was wir übernehmen könnten

Geordnet nach Nutzen gegen Aufwand. Nichts davon ist beschlossen; Julian entscheidet, was eine Roadmap-Nummer bekommt.

1. **WorldCat nach ISBN statt nach Titel.** Unser WorldCat-Link (`searchLinksFor`, `lib/buylinks.ts`) sucht nach Titel, Verlag und Jahr. Wo die Ausgabe eine ISBN hat, trifft `q=bn:<ISBN-13>` genau diese Ausgabe. Klein, ohne Risiko, unabhängig von Phase 4.
2. **„Borrow — free" neben den Kauflinks.** Whichedition stellt die Bibliothek gleichrangig neben den Kauf, mit dem Wort „Free". Bei uns steht WorldCat unten zwischen den Suchlinks. Passt zum Ton der Seite (keine Werbung im Hobby-Modus) und kostet nichts. Achtung bei der Wortwahl: WorldCat zeigt, welche Bibliothek die Ausgabe **verzeichnet**, nicht dass sie ausleihbar ist — „find it in a library" statt „borrow it".
3. **Ein Satz Offenlegung direkt unter den Kauflinks**, sobald `shop` gilt. Unsere Regel (SPEC 2.4) sagt es auf der About-Seite; Whichedition zeigt, dass ein Satz unter den Knöpfen genügt und nicht stört. Die FTC-Regeln wollen den Hinweis nahe am Link, Amazon zusätzlich seine Pflichtformel (siehe oben). Das gehört zum Umschalttag (E20), nicht vorher — im Hobby-Modus wäre der Satz falsch (vgl. 2.3).
4. **Seitentitel, die die Frage enthalten.** „Best Translations of the Iliad: Fagles vs. Wilson vs. Lattimore" trifft eine Suchanfrage. Unsere Sammlungen und Werkseiten könnten dasselbe für Cover tun („The Great Gatsby covers, 1925 to today"); das ist Phase 5 (Reichweite) und `lib/seo.ts`, mit der dortigen Regel: nie „all" oder „every".
5. **`ItemList` von `Book` mit ISBN in JSON-LD** auf Sammlungsseiten. Unser Detailseiten-JSON-LD beschreibt ein Buch; eine Sammlung ist eine Liste von Ausgaben. `FAQPage` dagegen **nicht** übernehmen: Google zeigt FAQ-Ergebnisse seit 2023 nur noch für Behörden- und Gesundheitsseiten, und eine erfundene Frage-Antwort passt nicht zu einer Seite ohne Meinung.
6. **Etiketten statt Rangfolge.** „Best for most / Newest / Most literal" ordnet fünf Dinge, ohne eins zum Sieger zu erklären. Für Cover denkbar: „Erstausgabe", „aktueller Druck", „meistgedruckt", „vom Spiel gewählt" (Daten aus `/versus`). Nur wo die Daten es tragen — „Erstausgabe" darf nur stehen, wo das Jahr es belegt.
7. **Physische Daten der Ausgabe** (Format, Seiten, Gewicht — „Hold it"). Open Library hat `number_of_pages` und oft `physical_dimensions`/`weight`. Für Sammler interessant, aber ein eigenes Thema; erst prüfen, wie oft die Felder gefüllt sind.

## Was wir bewusst nicht übernehmen

- **Ein Händler, ein Markt.** Für eine Seite über Cover, deren Leser in drei Märkten sind, wäre ein amazon.com-Link für jeden ein Rückschritt hinter E9.
- **Links ohne `rel="sponsored"`.** Verstößt gegen Googles Richtlinie für bezahlte Links.
- **„It never changes our picks."** Wir haben keine Picks; unser Versprechen ist das Gegenstück: die Reihenfolge der Händler folgt der ISBN, nicht der Provision (SPEC 2.4).
- **Eine persönliche Empfehlung je Werk.** Das ist das Produkt von Whichedition; unseres ist die Wand.

## Anschluss

- Roadmap: Zeile unter „Ideen, unbewertet" (Vergleich whichedition.com, 2026-10-01).
- Zum Affiliate-Teil: ROADMAP Phase 4 (4.1 Bookshop.org, 4.2 Amazon), SPEC 2.4 und E20.
