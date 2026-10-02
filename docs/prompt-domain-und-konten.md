# Prompt für eine lokale Sitzung: Domains in den Warenkorb, Konten vorbereiten

Gehört zu ROADMAP 0.5 und 2.2. Geschrieben am 2026-10-02 für „Other Covers", am selben Abend auf **„Buy Its Covers"** umgeschrieben (Julian: „we're switching the name to buyitscovers(.com)"); ein Warenkorb mit den alten Domains ist hinfällig. Geschrieben, weil die Sitzung, die es vorbereiten sollte, ihren Browser-Bereich nicht auf dem Bildschirm hatte und dann keinen Klick ausführen kann. Der Hintergrund steht in [domain-recherche.md](domain-recherche.md) Teil B, §12 (Konten) und §14 (Umschalttag).

Den Block unten als Ganzes in eine Sitzung geben, die einen **sichtbaren** Browser hat.

```text
Du arbeitest im Projekt beautifulbooks. Die Seite wird in „Buy Its Covers" umbenannt; die
Umbenennung liegt fertig im lokalen main (nicht gepusht). Es fehlen die Domain und die
Konten. Bereite beides im Browser so weit vor, dass ich nur noch anmelden, ausfüllen und
bezahlen muss. Lies vorher docs/domain-recherche.md, Teil B, §12 und §14.

Halte den Browser sichtbar. Ist er verborgen, gehen Klicks verloren — dann sag es mir
sofort und versuche es nicht weiter.

Was du nicht tust, auch wenn es nahe liegt: kein Konto anlegen, kein Passwort und keine
Zahlungsdaten eingeben, nichts kaufen, kein Formular mit meinen Daten absenden, keine
Bedingungen annehmen. Das mache ich. Du bringst jede Seite bis genau vor diesen Schritt
und sagst mir, was dort von mir gebraucht wird.

TEIL 1 — Warenkorb bei INWX (inwx.de)

1. Lege zwei Domains zur Registrierung für 12 Monate in den Warenkorb:
   buyitscovers.com und buyitscovers.de. (Die Einzahl buyitscover.com ist seit 2013 vergeben;
   .net, .org, .co und .app waren am 2026-10-02 frei — nur auf mein Wort dazu.)
   Suche jede einzeln: https://www.inwx.de/de/domain/check?domain=<name> — zwei Namen in
   einem Suchfeld behandelt INWX als einen Begriff. Ein Hinweisfenster „Phishing-Mails im
   Umlauf" liegt unten rechts über dem Knopf „In den Warenkorb"; erst zuklappen.
2. Ein Warenkorb aus einer früheren Sitzung hängt an deren Browser und ist bei dir
   vermutlich leer. Fang also von vorn an und prüfe am Ende auf https://www.inwx.de/de/cart,
   dass genau diese zwei Domains darin liegen.
3. Nimm nichts dazu, was INWX anbietet (SSL-Zertifikat, Hosting, weitere Endungen). Das
   Zertifikat stellt Vercel aus.
4. Erwartete Preise (INWX-Listenpreise vom 2026-10-02, ohne Mehrwertsteuer): .com 14,60 € im
   Jahr, .de 5,02 € (Verlängerung 3,91 €) — zusammen 19,62 €. Für diesen Namen nicht einzeln
   nachgesehen; ein Premium-Aufschlag wäre eine Abweichung.
   Weicht ein Preis ab oder ist eine Domain nicht mehr verfügbar: anhalten und melden,
   nicht auf eine andere Endung ausweichen.
5. Halte auf der Warenkorbseite an, vor „Weiter". Anmelden und bezahlen mache ich.

TEIL 2 — Konten, Name überall: buyitscovers

Öffne je einen Reiter und bringe ihn bis zum Anmeldeformular. Fülle nichts aus.

- X: https://x.com/i/flow/signup
  Für buyitscovers nicht geprüft (die Prüfung vom 2026-10-02 galt dem alten Namen).
- TikTok: https://www.tiktok.com/signup
  Ebenfalls nicht geprüft.
- Bluesky: https://bsky.app
  Ich melde mich mit irgendeinem Namen an und stelle ihn danach um: Settings → Account →
  Handle → „I have my own domain" → buyitscovers.com. Bluesky nennt dann einen TXT-Eintrag
  für _atproto mit einem Wert, der mit did= beginnt. Der gehört bei INWX ins DNS der
  Domain — geht also erst nach dem Kauf. Wenn ich so weit bin: lies mir Namen und Wert
  des Eintrags von der Bluesky-Seite vor und zeig mir die Stelle im INWX-DNS.
- GitHub: KEIN zweites Konto — GitHub erlaubt je Person ein kostenloses. Stattdessen eine
  Organisation „buyitscovers" unter meinem Konto heissjl:
  https://github.com/account/organizations/new?plan=free (verlangt meine Anmeldung).
- Instagram (und damit Threads): prüfe, ob @buyitscovers frei ist; wenn nicht, die erste freie
  Form von buyitscovers.books, buyitscoversbooks, buyitscovers_com. Nur nachsehen, nichts anlegen.
- Von Hand nachsehen, weil es automatisch nicht zu entscheiden war: Reddit (u/buyitscovers
  und r/buyitscovers), Pinterest (pinterest.com/buyitscovers), Ko-fi (ko-fi.com/buyitscovers).
  Sag mir je Plattform: frei, vergeben, oder nicht zu erkennen. Der GitHub-Name buyitscovers war
  am 2026-10-02 frei (404).

TEIL 3 — Nach dem Kauf, wenn ich es sage

Reihenfolge aus docs/domain-recherche.md §14. Lies die DNS-Werte immer von der Seite ab,
die sie verlangt, und nimm keine aus dem Gedächtnis.

1. Vercel, Projekt beautifulbooks → Settings → Domains: buyitscovers.com hinzufügen und als
   Hauptdomain setzen; buyitscovers.de hinzufügen, als Weiterleitung auf buyitscovers.com. Vercel zeigt für jede die DNS-Einträge, die es erwartet.
2. Diese Einträge bei INWX im DNS der beiden Domains setzen. Zeig mir vorher, was du
   eintragen willst.
3. Vercel → Environment Variables: NEXT_PUBLIC_SITE_URL auf https://buyitscovers.com
   (Production). Ist WALLS_REPORT_FROM gesetzt, steht dort der alte Name als Absender —
   nur melden, den Wert nicht lesen.
4. Erst danach main pushen (das löst das Deployment aus) — nur auf mein Wort.
5. Produktion EINMAL ansehen: Kopfzeile, Reitertitel einer Buchseite, /opengraph-image.
   Nicht wiederholt abfragen (CLAUDE.md: Vercels Bot-Schutz antwortet sonst mit 403).

Schreib am Ende in docs/domain-recherche.md §14 und in ROADMAP.md 0.5, was getan ist und
was offen bleibt, mit Datum. Nichts ist fertig, das nur im Chat steht.
```

**Warum der Prompt so eng ist.** Konten anlegen, Passwörter und Zahlungsdaten eingeben und einen Kauf abschließen sind Schritte, die keine Sitzung übernimmt, gleich wer sie darum bittet. Der Prompt führt deshalb jede Seite bis genau davor. Teil 3 steht nur zur Vollständigkeit darin und wartet auf Julians Wort.
