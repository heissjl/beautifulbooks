# Prompt für eine lokale Sitzung: die Domains bei INWX auf Vercel zeigen lassen

Gehört zu ROADMAP 2.2. Geschrieben am 2026-10-02, nachdem die sechs Domains gekauft und im Vercel-Projekt angelegt waren ([domain-recherche.md](domain-recherche.md) §20). Den Block unten als Ganzes in eine Sitzung geben, die einen **sichtbaren** Browser hat, in dem Julian bei INWX angemeldet ist.

```text
Du arbeitest im Projekt beautifulbooks. Die Seite heißt „Buy Its Covers" und liegt bei Vercel
im Projekt beautifulbooks. Ich habe bei INWX sechs Domains gekauft; bei Vercel sind sie schon
angelegt (buyitscovers.com als Seite, die anderen als Weiterleitung). Was fehlt, sind die
DNS-Einträge bei INWX. Setze sie. Lies vorher docs/domain-recherche.md §20.

Halte den Browser sichtbar; ich bin bei INWX angemeldet. Ist der Browser verborgen, gehen
Klicks verloren — dann sag es mir und versuche es nicht weiter. Gib nirgends ein Passwort ein.

TEIL 1 — Die Einträge

Für jede der sechs Domains: INWX → Domains → auf die Domain → Reiter „Nameserver" bzw.
„DNS" (die Nameserver bleiben ns.inwx.de, ns2.inwx.de, ns3.inwx.eu — nichts daran ändern).

1. Vorhandene Einträge vom Typ A und AAAA auf dem Namen „@" (leer, die Domain selbst)
   löschen — INWX hat dort eine Parkseite eingetragen (185.181.104.242). Gibt es
   Einträge auf „www" oder „*" vom Typ A, AAAA oder CNAME, auch löschen. SOA-, NS- und
   alle übrigen Einträge in Ruhe lassen.
2. Neu anlegen:

   buyitscovers.com    A      @     76.76.21.21
   buyitscovers.com    CNAME  www   cname.vercel-dns.com
   buyitscovers.de     A      @     76.76.21.21
   byitscovers.com     A      @     76.76.21.21
   byitscovers.de      A      @     76.76.21.21
   othercovers.com     A      @     76.76.21.21
   othercovers.de      A      @     76.76.21.21

   TTL: den Vorschlag von INWX lassen (3600 ist in Ordnung). Keinen AAAA-Eintrag, keinen
   CAA-Eintrag anlegen. Trägt INWX „@" als leeres Feld oder als den Domainnamen ein, nimm
   die Form, die das Formular anbietet.
3. Zeig mir vor dem Speichern je Domain, was du einträgst, und nach dem Speichern die
   Liste, wie INWX sie anzeigt.

TEIL 2 — Prüfen, ohne zu hämmern

4. Nach dem Speichern aller sechs: im Terminal
     dig +short A buyitscovers.com
   und dasselbe für die anderen fünf. Erwartet ist 76.76.21.21. Steht noch
   185.181.104.242 da, warte fünf Minuten und frag einmal neu; frag nicht in einer Schleife.
5. Dann
     vercel domains inspect buyitscovers.com --scope julian-heiss-projects
   Verschwindet die Warnung „not configured properly", ist die Domain verbunden; Vercel
   stellt das Zertifikat selbst aus, das kann bis zu einer Stunde dauern und ist kein
   Fehler. Dasselbe einmal für buyitscovers.de und othercovers.com.
6. Sobald das Zertifikat da ist: https://buyitscovers.com/ EINMAL im Browser öffnen
   (Reitertitel „Buy Its Covers") und https://othercovers.com/ EINMAL (muss auf
   buyitscovers.com weiterleiten). Nicht wiederholt abrufen — Vercels Bot-Schutz
   antwortet sonst mit 403, und das sieht aus wie ein Ausfall (CLAUDE.md).

TEIL 3 — Nur auf mein Wort in dieser Sitzung: Mail-Schutz (ROADMAP 2.14)

Von keiner der sechs Domains geht heute Mail. Wenn ich es hier bestätige, lege je Domain
zusätzlich an, damit niemand in ihrem Namen schreiben kann:
     TXT  @        v=spf1 -all
     TXT  _dmarc   v=DMARC1; p=reject;
     MX   @        0 .        (Null-MX; wenn INWX das nicht annimmt, weglassen und sagen)
Sobald später ein Postfach oder Resend für buyitscovers.com eingerichtet wird, ersetzen
deren Einträge SPF und MX dort — die anderen fünf Domains behalten den Schutz.

Schreib am Ende in docs/domain-recherche.md unter §20, was gesetzt ist, mit Datum und
Uhrzeit, und hake in ROADMAP.md bei 2.2 ab, was erledigt ist. Nichts ist fertig, das nur
im Chat steht.
```

**Warum Teil 3 hinter einem Wort steht:** die drei Einträge sind richtig, solange keine Mail von der Domain kommt — und falsch an dem Tag, an dem Julian ein Postfach einrichtet, ohne an sie zu denken. Darum sollen sie bewusst gesetzt werden, nicht nebenbei.
