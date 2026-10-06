# Prompt für eine lokale Sitzung: Google Search Console und Bing Webmaster Tools

Gehört zu ROADMAP 2.5 (und 2.15 Schritt 4). Geschrieben am 2026-10-04, nachdem das DNS aller sechs Domains steht ([domain-recherche.md](domain-recherche.md) §20) und die Seite unter `https://buyitscovers.com` antwortet. Den Block unten als Ganzes in eine Sitzung geben, die einen **sichtbaren** Chrome mit der Claude-Erweiterung hat, in dem Julian bei Google, bei Microsoft (oder mit demselben Google-Konto bei Bing) und bei INWX angemeldet ist.

**Warum lokal:** Search Console und Bing gehören zu Julians Konten; die Cloud-Sitzung hat weder seine Anmeldungen noch Zugang zu INWX. Die Domain-Bestätigung braucht einen TXT-Eintrag bei INWX — beides in einem Browser, in einer Sitzung, ist der kürzeste Weg. Erfahrung vom 2026-10-04 (§20): die Elementsuche der Erweiterung kann ihr Wochenlimit erreichen; dann INWX' eigene Seitenfunktionen nutzen, wie dort beschrieben.

```text
Du arbeitest im Projekt beautifulbooks. Die Seite heißt „Buy Its Covers" und läuft unter
https://buyitscovers.com (Vercel). Die fünf anderen Domains (buyitscovers.de, byitscovers.com/.de,
othercovers.com/.de) und beautifulcovers.vercel.app leiten mit 308 dorthin. Richte die Seite bei
Google Search Console und Bing Webmaster Tools ein. Lies vorher ROADMAP.md, Punkt 2.5 und 2.15,
und docs/domain-recherche.md §20.

Halte den Browser sichtbar. Ich bin bei Google, Microsoft und INWX angemeldet. Gib nirgends ein
Passwort ein; fragt eine Seite nach Anmeldung oder Zwei-Faktor-Code, halte an und sag es mir.
Frag keine Seite in einer Schleife ab: höchstens drei Versuche je Schritt, mit Minuten dazwischen.

TEIL 1 — Google Search Console

1. https://search.google.com/search-console → „Property hinzufügen" → Typ **Domain** (nicht
   „URL-Präfix") → buyitscovers.com. Google zeigt einen TXT-Eintrag
   (google-site-verification=…). Keine Property für die Weiterleitungs-Domains und keine für
   beautifulcovers.vercel.app anlegen.
2. INWX → Domains → buyitscovers.com → DNS: einen **neuen** TXT-Eintrag auf „@" mit genau dem
   Wert von Google anlegen. Den vorhandenen TXT-Eintrag v=spf1 -all NICHT ändern oder
   zusammenlegen — es dürfen mehrere TXT-Einträge auf „@" stehen, aber nur einer mit v=spf1.
   Sonst nichts anfassen (A, CNAME www, _dmarc, MX bleiben). Zeig mir vor dem Speichern den
   Eintrag und danach die Liste, wie INWX sie anzeigt.
3. Zurück zur Search Console → „Bestätigen". Schlägt es fehl: die INWX-Nameserver halten
   Antworten bis zu 3600 s zwischengespeichert (§20). Dann 10–15 Minuten warten und noch
   einmal; nach dem dritten Fehlschlag anhalten und mir sagen, was Google meldet.
4. Nach der Bestätigung: „Sitemaps" → „sitemap.xml" eintragen (volle Adresse
   https://buyitscovers.com/sitemap.xml) → Senden. Notiere Status und die Zahl
   „Gefundene Seiten", sobald sie erscheint (kann Stunden dauern; dann nur „gesendet" notieren).
5. „URL-Prüfung" für genau diese vier Adressen, je „Indexierung beantragen" (Google erlaubt
   davon nur ein paar am Tag):
   https://buyitscovers.com/
   https://buyitscovers.com/book/OL1168083W
   https://buyitscovers.com/collections/sf-masterworks
   https://buyitscovers.com/book/OL1168083W/decades
   Notiere je Adresse, was die Prüfung sagt (z. B. „URL ist nicht auf Google" ist bei einer
   neuen Domain normal; wichtig ist, dass der Live-Test „Seite kann indexiert werden" zeigt und
   kanonische URL = geprüfte URL).
6. Nichts unter „Adressänderung" tun — die alte Adresse war nie eine eigene Property.

TEIL 2 — Bing Webmaster Tools

1. https://www.bing.com/webmasters → mit dem Microsoft- oder Google-Konto anmelden (bin ich
   schon) → „Import from Google Search Console" → buyitscovers.com auswählen → importieren.
   Das übernimmt Bestätigung und Sitemap.
2. Geht der Import nicht (Property noch nicht bestätigt o. ä.): die Website manuell
   hinzufügen, Bestätigung per DNS (CNAME, den Bing anzeigt) bei INWX — wieder nur den
   neuen Eintrag anlegen, nichts anderes ändern —, dann unter „Sitemaps"
   https://buyitscovers.com/sitemap.xml einreichen.
3. Notiere: Website bestätigt ja/nein, Sitemap Status.

TEIL 3 — Aufschreiben (Regel des Projekts: nichts bleibt nur im Chat)

- ROADMAP.md, Punkt 2.5: Stand mit Datum — Property-Typ, Bestätigung per DNS-TXT, Sitemap
  gesendet, die vier URL-Prüfungen mit ihrem Ergebnis, Bing importiert. Abhaken erst, wenn
  Google die Sitemap gelesen hat; sonst offen lassen mit „wartet auf Google".
- ROADMAP.md, Punkt 2.15: Schritt 4 als erledigt markieren.
- docs/domain-recherche.md §20: den neuen TXT-Eintrag (nur „google-site-verification", den
  Wert selbst nicht nötig) und ggf. Bings CNAME in die Liste der Einträge.
- docs/history.md: ein kurzer Eintrag mit Datum und dem, was gemessen wurde.
- Commit-Nachricht nennt 2.5; dazu die Zeile „Analytics: no effect, settings outside the code."
  (Regel in CLAUDE.md). Nicht nach main pushen, ohne mich zu fragen.
```

## Danach, ohne Browser

- **Nach zwei bis drei Wochen:** Search Console → Leistung (Suchanfragen, Positionen) und Seiten (indexiert / nicht indexiert mit Grund). Werden Buchseiten als „Gecrawlt – zurzeit nicht indexiert" gemeldet, ist das der Auslöser für 5.2 (Seite 0 serverseitig rendern).
- **Core Web Vitals** erscheinen erst mit 28 Tagen Chrome-Felddaten und genug Besuchen; „nicht genügend Daten" ist bis dahin kein Fehler.
- **IndexNow** (Bing, Yandex, Seznam; Google nimmt es nicht an) wäre eine Datei mit Schlüssel im Webroot und ein Aufruf bei jeder neuen Seite — lohnt erst, wenn Seiten in größerer Zahl entstehen (5.3/5.4). Kein Schritt für diese Sitzung.
