# Prompt für eine lokale Sitzung: Domains in den Warenkorb, Konten vorbereiten

Gehört zu ROADMAP 0.5 und 2.2. Geschrieben am 2026-10-02, weil die Sitzung, die es vorbereiten sollte, ihren Browser-Bereich nicht auf dem Bildschirm hatte und dann keinen Klick ausführen kann. Der Hintergrund steht in [domain-recherche.md](domain-recherche.md) Teil B, §12 (Konten) und §14 (Umschalttag).

Den Block unten als Ganzes in eine Sitzung geben, die einen **sichtbaren** Browser hat.

```text
Du arbeitest im Projekt beautifulbooks. Die Seite wird in „Other Covers" umbenannt; die
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

1. Lege drei Domains zur Registrierung für 12 Monate in den Warenkorb:
   othercovers.com, othercovers.de, othercover.com (die Einzahl, als Vertipper-Fang).
   Suche jede einzeln: https://www.inwx.de/de/domain/check?domain=<name> — zwei Namen in
   einem Suchfeld behandelt INWX als einen Begriff. Ein Hinweisfenster „Phishing-Mails im
   Umlauf" liegt unten rechts über dem Knopf „In den Warenkorb"; erst zuklappen.
2. Ein Warenkorb aus einer früheren Sitzung hängt an deren Browser und ist bei dir
   vermutlich leer. Fang also von vorn an und prüfe am Ende auf https://www.inwx.de/de/cart,
   dass genau diese drei Domains darin liegen.
3. Nimm nichts dazu, was INWX anbietet (SSL-Zertifikat, Hosting, weitere Endungen). Das
   Zertifikat stellt Vercel aus.
4. Erwartete Preise vom 2026-10-02, ohne Mehrwertsteuer: othercovers.com 14,60 € im Jahr,
   othercovers.de 5,02 € (Verlängerung 3,91 €), othercover.com 14,60 € — zusammen 34,22 €.
   Weicht ein Preis ab oder ist eine Domain nicht mehr verfügbar: anhalten und melden,
   nicht auf eine andere Endung ausweichen.
5. Halte auf der Warenkorbseite an, vor „Weiter". Anmelden und bezahlen mache ich.

TEIL 2 — Konten, Name überall: othercovers

Öffne je einen Reiter und bringe ihn bis zum Anmeldeformular. Fülle nichts aus.

- X: https://x.com/i/flow/signup
  Am 2026-10-02 gab es dort kein Konto @othercovers.
- TikTok: https://www.tiktok.com/signup
  Ebenfalls kein Konto @othercovers gefunden.
- Bluesky: https://bsky.app
  Ich melde mich mit irgendeinem Namen an und stelle ihn danach um: Settings → Account →
  Handle → „I have my own domain" → othercovers.com. Bluesky nennt dann einen TXT-Eintrag
  für _atproto mit einem Wert, der mit did= beginnt. Der gehört bei INWX ins DNS der
  Domain — geht also erst nach dem Kauf. Wenn ich so weit bin: lies mir Namen und Wert
  des Eintrags von der Bluesky-Seite vor und zeig mir die Stelle im INWX-DNS.
- GitHub: KEIN zweites Konto — GitHub erlaubt je Person ein kostenloses. Stattdessen eine
  Organisation „othercovers" unter meinem Konto heissjl:
  https://github.com/account/organizations/new?plan=free (verlangt meine Anmeldung).
- Instagram: der Name @othercovers ist vergeben (17 Follower, KI-Plattencover), damit auch
  Threads. Prüfe, ob eine dieser Formen frei ist, und nenne mir die erste freie:
  othercovers.books, othercoversbooks, othercovers_com. Nur nachsehen, nichts anlegen.
- Von Hand nachsehen, weil es automatisch nicht zu entscheiden war: Reddit (u/othercovers
  und r/othercovers), Pinterest (pinterest.com/othercovers), Ko-fi (ko-fi.com/othercovers).
  Sag mir je Plattform: frei, vergeben, oder nicht zu erkennen.

TEIL 3 — Nach dem Kauf, wenn ich es sage

Reihenfolge aus docs/domain-recherche.md §14. Lies die DNS-Werte immer von der Seite ab,
die sie verlangt, und nimm keine aus dem Gedächtnis.

1. Vercel, Projekt beautifulbooks → Settings → Domains: othercovers.com hinzufügen und als
   Hauptdomain setzen; othercover.com und othercovers.de hinzufügen, beide als Weiterleitung
   auf othercovers.com. Vercel zeigt für jede die DNS-Einträge, die es erwartet.
2. Diese Einträge bei INWX im DNS der drei Domains setzen. Zeig mir vorher, was du
   eintragen willst.
3. Vercel → Environment Variables: NEXT_PUBLIC_SITE_URL auf https://othercovers.com
   (Production). Ist WALLS_REPORT_FROM gesetzt, steht dort der alte Name als Absender —
   nur melden, den Wert nicht lesen.
4. Erst danach main pushen (das löst das Deployment aus) — nur auf mein Wort.
5. Produktion EINMAL ansehen: Kopfzeile, Reitertitel einer Buchseite, /opengraph-image.
   Nicht wiederholt abfragen (CLAUDE.md: Vercels Bot-Schutz antwortet sonst mit 403).

Schreib am Ende in docs/domain-recherche.md §14 und in ROADMAP.md 0.5, was getan ist und
was offen bleibt, mit Datum. Nichts ist fertig, das nur im Chat steht.
```

**Warum der Prompt so eng ist.** Konten anlegen, Passwörter und Zahlungsdaten eingeben und einen Kauf abschließen sind Schritte, die keine Sitzung übernimmt, gleich wer sie darum bittet. Der Prompt führt deshalb jede Seite bis genau davor. Teil 3 steht nur zur Vollständigkeit darin und wartet auf Julians Wort.
