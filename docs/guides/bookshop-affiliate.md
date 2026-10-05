# Anleitung: Affiliate-Konto bei Bookshop.org beantragen

Geschrieben 2026-09-26 für Julian (ROADMAP 4.1). Stand der Quellen: Bookshop.orgs Hilfeseiten und Bewerbungsseite, am selben Tag gelesen; die Affiliate-Übersichtsseite selbst antwortete dem Abruf mit 403.

## Stand 2026-10-04: die Bewerbung läuft, und das Formular sieht anders aus als unten beschrieben

Julian hat das Konto bei Bookshop.org (US) angelegt und die E-Mail bestätigt; Claude hat im Chrome mitgelesen. Was die Seite an dem Tag wirklich zeigte:

- „Join the Affiliate Program" führt zuerst auf `/signup` (Konto mit E-Mail und Passwort; das Häkchen für den Newsletter ist vorbelegt). Vor der bestätigten E-Mail zeigt `/affiliates/profile` nur „Verify Your Account".
- **Es gibt keine Wahl „Non-bookstore affiliate" und kein Feld für die Website.** Das Profil ist eine öffentliche Shop-Seite: *Shop Name*, *URL For Your Shop* (`bookshop.org/shop/<name>`, nur Buchstaben, Ziffern, Binde- und Unterstrich), *About* (Rich Text), Profilbild (180 × 180), Banner (2048 × 600), Links zu Threads, Bluesky, Instagram, TikTok, Facebook, YouTube, X, Substack, eine *Libro ID*, ein Häkchen für den wöchentlichen Verkaufsbericht per Mail (vorbelegt) und *My Book Lists*. Ein Feld für Mastodon gibt es nicht.
- Die Prüfung ist ein eigener Schritt: oben auf der Seite „In order to complete your profile, you must request for verification" mit dem Link *Request Verification* (`/affiliates/profile/request`).
- **Vorgeschlagene Einträge** (Name und Adresse der Seite, wie sie seit 2026-10-02 heißen): Shop Name „Buy Its Covers", URL `buyitscovers`, About: „Buy Its Covers (https://buyitscovers.com) shows the covers a book has been printed with, side by side, so you can pick the edition whose cover you like. Each cover links to that printing's ISBN at bookshops, Bookshop.org among them." Bluesky `https://bsky.app/profile/buyitscovers.com`, X `https://x.com/buyitscovers`; Instagram bleibt leer, solange das Konto gesperrt ist (domain-recherche §23), TikTok bis es das Konto gibt.
- **Bilder:** `assets/social/avatar-360.png` und `assets/social/banner-2048x600.png`, am selben Tag für dieses Formular gesetzt.
- **Profil gespeichert (Julian, 2026-10-04):** Shop Name, URL `bookshop.org/shop/buyitscovers`, About, beide Bilder, Bluesky und X. Die Seite zeigt seitdem **Affiliate ID: 129426** und „Verification Status: Unverified". Offen: *Request Verification*.
- **Buchlisten gehen erst nach der Prüfung.** `/lists/manage` sagt: „Your affiliate profile must be verified to create new lists", der Knopf ist ausgegraut. Die Idee (Julian: ein paar Listen aus den Sammlungen) wartet also auf die Freigabe.
- **Welche Sammlungen überhaupt als Liste gehen** (einmal je ISBN in Bookshops Suche nachgesehen): NYRB Children's Collection ja (`9781590171257` gefunden, 21 Bände mit `coverIsbn`). **suhrkamp taschenbuch nein** — `9783518067260` (Solaris) und `9783518065020` (Wilhelm Tell für die Schule) ergeben „No results"; Bookshop US führt lieferbare Titel des US-Handels, keine deutschen Taschenbücher der Siebziger. **Fischer Bücherei nein** — keiner der 186 + 10 + 85 Bände trägt eine ISBN, die Reihe ist älter als die ISBN. Für die deutschen Reihen sind Antiquariate der passende Händler (ROADMAP 4.10: Booklooker, ZVAB), nicht Bookshop. Kandidaten für eine zweite und dritte Liste: Penguin Clothbound Classics (63), Library of America (72), Feminist Press (76) — alle öffentlich und mit `coverIsbn`, bei Bookshop noch nicht nachgesehen.

- **Reicht das Profil für *Request Verification*? Recherche 2026-10-04** (Julian: „can you do a research on experiences of other people if i have enough to request it now?"). Befund: **ja, nichts spricht fürs Warten.** Bookshops Hilfeseite: „Anyone who wants to support indie bookstores by linking to the Bookshop.org platform can be an Affiliate" (Autoren, Verlage, Medien, Blogger, Buchclubs), ohne Mindestreichweite, ohne Pflicht zu einer Website. Ein Bericht von 2020 nennt „The approval process takes 2 minutes" und „open to all — whether you're a ‚Bookstagrammer' with a dozen followers or a magazine with a national audience". **Einen Erfahrungsbericht über eine Ablehnung habe ich in sechs Suchen nicht gefunden** (Reddit, Substack, Blogs); der Satz „new ventures might face rejection due to insufficient traffic" steht nur in Affiliate-Verzeichnissen (linkclicky, affinew) ohne Quelle. Dauer laut diesen Verzeichnissen: wenige Tage, in vollen Zeiten ein bis zwei Wochen. **Nicht geklärt:** ob ein Wohnsitz außerhalb der USA stört — die Hilfeseiten nennen keine Einschränkung, Programme gibt es für US, UK und Spanien; die Frage stellt sich praktisch erst bei Stripe (Auszahlung, W-8BEN), nicht bei der Prüfung des Profils. Quellen: support.bookshop.org (Artikel 65000191390), bloggingguide.substack.com/p/bookshop-review-for-bloggers (2020-05-12), linkclicky.com/affiliate-program/bookshop-org.

Die Abschnitte darunter sind der Stand vom 2026-09-26 und nennen noch den alten Namen und die alte Adresse.

## Worum es geht

Bookshop.org zahlt Affiliates **10 % des Kaufpreises** für Bücher, die innerhalb von 48 Stunden nach einem Klick auf einen Affiliate-Link gekauft werden (zählt der letzte Klick). Die Seite hat die Anbindung schon: `lib/buylinks.ts` baut mit einer ID den Link `https://bookshop.org/a/<ID>/<ISBN>` auf die Produktseite, ohne ID nur eine Suchseite. Der Mehrwert ist also doppelt — Provision und ein besserer Link.

**US und UK sind getrennte Programme mit getrennten Konten** („it is necessary to set up separate affiliate accounts for Bookshop.org UK and US"). Die Seite hat für beide eine Stelle: `AFFILIATE_BOOKSHOP_ID_US` und `AFFILIATE_BOOKSHOP_ID_UK`. Einen deutschen Bookshop gibt es nicht (nur US, UK, Spanien).

## Vorher klären (5 Minuten)

1. **Auszahlung: Julian hat ein US-Bankkonto** (2026-09-26) — damit ist der Weg über **Bookshop US** der naheliegende: Stripe Connect zahlt auf ein US-Konto ohne Umweg. Ob Bookshop einen Wohnsitz außerhalb der USA im Profil stört, sagen die Hilfeseiten nicht; mit US-Konto ist das die kleinere Frage. UK kann später als zweites Konto dazukommen.
2. **Steuer:** Stripe fragt ein US-Steuerformular ab: **W-9**, wenn du US-Bürger oder in den USA steuerlich ansässig bist, sonst **W-8BEN** (bestätigt die Steuerpflicht in Deutschland; das Doppelbesteuerungsabkommen senkt den US-Einbehalt). Welches zutrifft, weißt du; das US-Konto allein entscheidet es nicht. In Deutschland sind die Einnahmen gewerblich — ROADMAP 4.4 (Gewerbeanmeldung, Kleinunternehmerregelung) vorher oder parallel.
3. **Offenlegung:** Bookshop verlangt einen Hinweis, dass Links Provision bringen. **Das ist schon gebaut:** Sobald eine ID gesetzt ist, sagt die About-Seite „Some links can earn a commission …" und die Datenschutzerklärung „Some links carry an affiliate parameter …" — ohne ID steht dort jeweils das Gegenteil (`app/about/page.tsx`, `app/privacy/page.tsx`).

## Schritt für Schritt

1. **Bewerbung öffnen:** https://bookshop.org/affiliates/profile/introduction (UK: https://uk.bookshop.org, dort „Become an affiliate"). Ein Konto mit E-Mail und Passwort anlegen — das machst du selbst.
2. **Art wählen: „Non-bookstore affiliate"** (Bookstore-Affiliates sind Buchhandlungen mit ABA-Mitgliedschaft und bekommen 30 %; das trifft nicht zu).
3. **Profil ausfüllen.** Vorschlag zum Einfügen (Englisch, wie die Seite):
   - **Name / Affiliate name:** Beautiful Books
   - **Website:** https://beautifulcovers.vercel.app
   - **Description:** „Beautiful Books shows the covers of a book side by side — every printing Open Library and Google Books know of, grouped by language, folded where two scans show the same design — so readers can pick the edition whose cover they like. Each cover links to the printing's ISBN at independent bookshops."
   - **How will you promote Bookshop?:** „Buy links on each edition of a book page (ISBN deep links), plus curated collections of series covers (SF Masterworks, Penguin Clothbound Classics, Feminist Press)."
   - **Audience / traffic:** ehrlich klein angeben (die Seite ist jung); Bookshop verlangt keine Mindestzahl.
4. **Absenden.** Bookshop prüft kurz („a brief verification process") und schreibt per E-Mail über den Stand.
5. **Nach der Freigabe die ID finden:** im Affiliate-Dashboard; es ist der Teil in deinen Links nach `/a/` (z. B. `https://bookshop.org/a/12345/…` → `12345`).
6. **Auszahlung einrichten:** im Dashboard „Cash Out" → Stripe verbinden (US-Bankkonto, W-9 oder W-8BEN). Mindestens **20 $**, und erst wenn die 30-Tage-Rückgabefrist des Kaufs vorbei ist; das Geld ist binnen zwei Werktagen da.

## Danach (Claude, 15 Minuten)

Sag mir die ID(s) — eine Affiliate-ID ist kein Geheimnis, sie steht in jedem Link. Dann:
- `AFFILIATE_BOOKSHOP_ID_US` (und/oder `_UK`) in Vercel für Production eintragen (`vercel env add`), neu deployen;
- einmal prüfen: `/go/bookshop/<ISBN>?market=us` muss auf `https://bookshop.org/a/<ID>/<ISBN>` umleiten, About und Datenschutz zeigen den Provisionssatz;
- ROADMAP 4.1 abhaken, Historie.

## Text für eine Vorab-Frage an den Support (falls du erst fragen willst)

> Hello, I run a small website in Germany (https://beautifulcovers.vercel.app) that links each edition of a book to its ISBN at bookshops. I would like to join the Bookshop.org affiliate program (US and/or UK). Can a non-US resident with a German bank account join the US program and receive payouts via Stripe, or should I apply to Bookshop.org UK? Thank you, Julian

## Quellen

- [Bewerbung](https://bookshop.org/affiliates/profile/introduction)
- [Can you explain Bookshop.org's affiliate program?](https://support.bookshop.org/en/support/solutions/articles/65000191390-can-you-explain-bookshop-org-s-affiliate-program-)
- [How do I get paid …](https://support.bookshop.org/en/support/solutions/articles/65000168992-how-do-i-get-paid-for-the-books-that-sell-how-much-will-you-pay-me-and-when-will-you-pay-it-) (Stripe Connect, 20 $, 30 Tage, 2 Werktage)
- [Becoming a Bookshop.org Affiliate](https://support.bookshop.org/en/support/solutions/folders/65000154819)
- [Bookshop (company), Wikipedia](https://en.wikipedia.org/wiki/Bookshop_(company)) (UK seit 2020, Spanien)
