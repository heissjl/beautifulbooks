# Sicherheit und störungsfreier Betrieb — Durchsicht vom 2026-10-02

Julian, 2026-10-02: „kannst du eine analyse zur cybersecurity machen. was sollte ich noch beachten und einbauen. bei vercel aber auch auf der site oder im projekt … Brauche ich sicherheit gegen bots irgendwo? sollen wir regelmäßige mirrors vom zustand der seite machen falls was passiert? geht das mit vercel? denke noch weiter".

Ergänzt das [Risikoregister](risiken-2026-09-12.md) (Quellen, Hosting, Recht, Betrieb) um die Frage, die dort fehlt: **was kann jemand mit Absicht tun, und was geht verloren, wenn etwas kaputtgeht.** Den Plan für Vercels Firewall gibt es schon ([PLAN-2.4](plans/PLAN-2.4-firewall.md)); er ist nicht eingerichtet.

## 1. Die kurze Antwort

Die Seite ist für ihre Größe ordentlich gebaut: keine Schlüssel im Repository, Passwörter werden zeitkonstant verglichen, die teure Route hat eine Tagesgrenze, der Weiterleiter nimmt keine Adresse aus der Anfrage. **Drei Dinge sind trotzdem dringend, und keines davon ist ein Bot:**

1. **Next.js ist drei Unterversionen zurück** (16.1.4, aktuell 16.3.8). `npm audit` nennt dafür 33 Sicherheitshinweise, zwei davon „critical". → 2.9
2. **Was nicht in git liegt, hat keine Sicherung.** Die Sammlungen der Leser, die Stimmen des Cover-Spiels, die Entwürfe und Veröffentlichungs-Schalter von `/curate` und die Vorschläge der Freunde liegen in einer Redis-Datenbank, von der es keine Kopie gibt. → 2.11
3. **Die Konten sind die eigentliche Angriffsfläche.** Wer in GitHub, Vercel oder — ab heute — INWX hineinkommt, hat die Seite. Ob überall ein zweiter Faktor an ist, kann ich nicht sehen. → 2.10

Eine Lücke habe ich beim Lesen gefunden und gleich geschlossen (§3, 2.8).

## 2. Was angesehen wurde, und was nicht

**Angesehen:** alle 31 Routen unter `app/api`, `app/go` und `app/img` auf Anmeldung, Grenzen und Eingaben; `lib/ratelimit.ts`, `lib/suggest/auth.ts`, die Cookie-Stellen, `lib/photoprep.ts`; `next.config.ts`; die ganze git-Historie aller Branches auf Zeichenfolgen in der Form von Google-, Anthropic-, Resend-, GitHub-Schlüsseln, Redis-Adressen mit Passwort und privaten Schlüsseln; `npm audit`; die Antwort-Header der Produktion (eine Anfrage); die Sicherheits-Einstellungen des GitHub-Repositorys (`gh api`); Projekt- und Firewall-Einstellungen bei Vercel über den Connector.

**Nicht angesehen:** die Konten selbst (zweiter Faktor, Wiederherstellung) — das kann nur Julian; die Werte der Variablen in Vercel (werden nie gelesen, Regel aus CLAUDE.md), und auch ihre Namen diesmal nicht, weil die CLI im Worktree nicht verknüpft ist; die Einstellungen des Redis-Anbieters; kein Angriff wurde ausprobiert, weder gegen die Produktion noch lokal. Das ist eine Durchsicht des Codes und der Einstellungen, kein Penetrationstest.

## 3. Befunde

Sortiert nach Dringlichkeit. „Wer" sagt, wer es tun kann.

### Jetzt

| Befund | Beleg | Was passieren kann | Abhilfe | Wer |
|---|---|---|---|---|
| **Ein Buchtitel konnte Skript in die Buchseite tragen — behoben, noch nicht deployt** | `app/book/[id]/page.tsx` schrieb die strukturierten Daten mit `JSON.stringify` in ein `<script>`. `JSON.stringify` lässt `<` stehen, und der Browser beendet ein Skript beim ersten `</script>`, gleich was im JSON steht | Titel und Beschreibungen kommen von Open Library, wo jeder mit einem Konto Datensätze ändern kann. Ein Titel mit `</script><script>…` wäre als Code gelaufen — bei jedem, der die Buchseite öffnet. Das Cookie `bb_visitor` ist für Skripte lesbar (es muss, die Seite zeigt die ID an), also wären die Sammlungen der Leser übernehmbar gewesen. Ob es je versucht wurde, ist nicht zu sagen | `jsonLdHtml()` in `lib/seo.ts` ersetzt `<`, `>`, `&` und zwei Zeilentrenner durch ihre JSON-Schreibweise; ein Test mit einem feindlichen Titel. Liegt im lokalen `main`, **geht mit dem nächsten Push online** | erledigt (2.8) |
| **Next.js 16.1.4, aktuell ist 16.3.8** | `npm audit --omit=dev`: 5 betroffene Pakete, 1 critical, 3 high. Für `next` allein 33 Hinweise, darunter „Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used" (behoben in 16.3.3), mehrere Umgehungen von Middleware, mehrere Wege, den Server lahmzulegen | **Was davon diese Seite auf Vercel trifft, habe ich nicht geprüft** — Vercel rechnet Bilder auf eigener Infrastruktur, eine Middleware gibt es hier nicht, der Windows-Hinweis ist gegenstandslos. Es bleibt eine lange Liste, von der man nicht jede Zeile selbst beurteilen will | Auf 16.3.x heben, dazu `sharp` (0.34.5 → 0.35.5, vier Hinweise zu libvips und libheif). Tests, Build, die fünf Abnahme-Suchen, ein Deploy. Halber Tag mit Ansehen | Claude (2.9) |
| **Zweiter Faktor auf allen Konten** | nicht einsehbar | GitHub: wer pusht, deployt. Vercel: Variablen, Domains, Deployments. **INWX: wer die Domain hat, hat die Seite und jede Mail-Adresse darunter** — und kann sie wegtransferieren. Google Cloud, Anthropic, Resend: Geld und Kontingent | Überall TOTP oder Passkey, Wiederherstellungscodes ausgedruckt, bei INWX zusätzlich die Transfersperre der Domain | Julian (2.10) |
| **Ausgabengrenze bei Anthropic** | `PHOTOS_PER_DAY = 300` in der Fotoroute, aber: „A silent store does not stop a reader" — antwortet die Redis nicht, zählt niemand, und es bleibt nur die Grenze je IP und Instanz (3, dann 1 je Minute) | Bei stiller Datenbank und vielen Adressen ist der Tagesdeckel offen. Auch mit Deckel: 300 × 1–3 ct sind bis 9 € am Tag, 270 € im Monat | Im Anthropic-Konto ein **Monatslimit** setzen (das ist der einzige Deckel, den niemand umgehen kann). Im Code entscheiden, ob die Route bei stiller Datenbank lieber ablehnt | Julian, dann Claude (2.10) |

### Bald

| Befund | Beleg | Was passieren kann | Abhilfe | Wer |
|---|---|---|---|---|
| **Keine Sicherung der Datenbank** | In `scripts/` gibt es kein Export-Skript; die Speicher (`lib/hotornot/store.ts`, `lib/walls/store.ts`, `lib/curate/drafts.ts`, `lib/suggest/store.ts`) teilen sich eine Redis aus dem Vercel Marketplace | Kostenlose Redis-Tarife sichern in der Regel nicht und löschen teils ungenutzte Datenbanken. Weg wären: jede Sammlung eines Lesers, alle Stimmen (das Brett), **die veröffentlichten Entwürfe und Schalter von `/curate`** — also Sammlungen, die online sind, aber nicht in `data/collections.json` stehen | Siehe §5 | Claude baut, Julian richtet ein (2.11) |
| **Keine Antwort-Header außer HSTS** | Produktion antwortet mit `strict-transport-security` (von Vercel) und sonst nichts: kein `Content-Security-Policy`, kein `X-Content-Type-Options`, kein `Referrer-Policy`, keine Einbettungs-Sperre | Die Seite lässt sich in fremde Rahmen einbetten (Klick-Fallen auf „Vote", „Report", „Publish"); ohne CSP hat ein eingeschleustes Skript freie Hand — der Befund oben wäre mit einer CSP folgenlos geblieben | In `next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`, eine `Permissions-Policy`, und eine CSP — zuerst als *Report-Only*, weil Next eigene Inline-Skripte schreibt und Vercels Analytics dazukommt | Claude (2.12) |
| **Firewall nicht eingerichtet** | Der Connector findet für das Projekt keine Firewall-Konfiguration; 2.4 ist offen | Siehe §4 | PLAN-2.4 ausführen | Julian, 45 Minuten (2.4) |
| **GitHub meldet keine verwundbaren Abhängigkeiten** | `gh api`: Dependabot-Alarme aus, Sicherheits-Updates aus. (An sind: Geheimnis-Suche und Push-Schutz — gut.) `main` ist nicht geschützt | Der Rückstand bei Next wäre vor Wochen aufgefallen | Dependabot-Alarme und -Sicherheitsupdates einschalten, dazu eine `.github/dependabot.yml` für wöchentliche npm-Updates. Branch-Schutz lohnt bei einem Entwickler mit vielen Sitzungen nicht | Julian 2 Minuten, Claude die Datei (2.13) |
| **Die neue Domain kann als Absender gefälscht werden** | `othercovers.com` hat noch kein DNS | Ohne SPF und DMARC kann jeder Mails „von @othercovers.com" verschicken; trifft die Leser, nicht die Seite | Solange keine Mail von der Domain geht: `v=spf1 -all`, DMARC `p=reject`, ein Null-MX. Sobald Resend von der Domain senden soll: dessen SPF- und DKIM-Einträge. Dazu DNSSEC und ein CAA-Eintrag für Vercels Zertifikatsstelle, automatische Verlängerung an | Julian mit der Domain-Sitzung (2.14) |

### Wissen, nicht bauen

| Befund | Beleg | Einordnung |
|---|---|---|
| **Die Grenzen je IP gelten je Instanz und nur im Arbeitsspeicher** | `lib/ratelimit.ts`; CLAUDE.md sagt es selbst | Sie bremsen einen einzelnen Ungeduldigen, keinen verteilten Angriff. Für die Anmeldung (5, dann 2 je Minute) heißt das: Raten ist langsam, aber nicht ausgeschlossen. Die Passwörter sind zufällig erzeugt, das trägt. Wer es fester will, zählt die Anmeldeversuche in der Redis |
| **`.env.local` liegt in iCloud Drive, und die Passwörter standen in einem Chat** | ROADMAP 5.10a: „die Werte liegen nur in Julians `.env.local` im Hauptordner und im Chat"; 6.42 | Die Schlüssel werden zu Apple synchronisiert und stehen in einem Sitzungsprotokoll. Kein Notfall, aber ein Grund, `SUGGEST_ADMIN_PASSWORD` einmal neu zu setzen und alle Schlüssel in einem Passwort-Manager zu führen, nicht nur in der Datei |
| **Das Freunde-Passwort ist eines für alle** | `lib/suggest/auth.ts`: das Cookie ist mit dem Passwort signiert | Einen einzelnen Freund kann man nicht aussperren; Passwort ändern und neu deployen sperrt alle. Für eine Handvoll Bekannte angemessen |
| **Sammlungen der Leser erscheinen ungeprüft** | 5.13d; Meldung per Mail ab 1, verborgen ab 5 | Titel, Name und Zeilen sind freier Text unter Julians Impressum. React setzt ihn als Text, Code ist das nicht — aber Beleidigung, Werbung, fremde Namen sind es. Die Meldekette gibt es; wissen muss man, dass man nach einer Meldung haftet, wenn man nicht handelt |
| **Die APIs sind ein kostenloser Zugang zu Open Library und Google** | `/api/search`, `/api/works`, `/api/isbn` sind offen | Ein Fremder kann das Google-Kontingent des Tages in Minuten verbrauchen. Die Seite sagt dann ehrlich „unavailable" (N12), kaputt geht nichts. Abhilfe ist die Firewall-Regel aus PLAN-2.4 §3.4 |
| **Vorschau-Deployments** | Vercel: Anmeldung nötig für alles außer eigenen Domains | Gut so. Zu prüfen bleibt, ob Vorschauen in dieselbe Redis schreiben wie die Produktion — dann kann ein Branch echte Daten ändern |
| **Logs leben eine Stunde** | CLAUDE.md, Vercel Hobby | Nach einem Vorfall ist nichts mehr nachzulesen. Auf Hobby nicht zu ändern; ein Grund für Pro, wenn die Seite Leser hat |

### Was in Ordnung ist

- **Keine Schlüssel in der Historie.** Fünf Treffer auf Redis-Adressen mit Passwort sind Testwerte (`x.example.io`, `x.upstash.io`). `.env*` ist ignoriert, nur `.env.example` ist eingecheckt.
- **Passwörter** werden über SHA-256 zeitkonstant verglichen, die Sitzung ist ein signiertes Ablaufdatum in einem `httpOnly`-Cookie, `secure` in Produktion, `SameSite=Lax`.
- **Kein Schreiben über fremde Seiten:** `SameSite=Lax` schickt bei einem POST von einer fremden Seite kein Cookie mit; eigene Origin-Prüfungen gibt es nicht, sie fehlen hier auch nicht.
- **`/img`** nimmt nur Cover-Kennungen an und baut die Adresse selbst — kein offener Bild-Proxy, kein Weg ins interne Netz.
- **`/go`** baut das Ziel aus `lib/buylinks.ts` und nimmt nichts aus der Anfrage (CLAUDE.md).
- **Das hochgeladene Foto** wird mit `jpeg-js` und `pngjs` gelesen, mit Grenzen für Speicher und Auflösung, 12 MB höchstens, ohne EXIF weitergegeben; `sharp` bekommt nie eine Datei von einem Leser.
- **Stimmen** gelten nur für ein vom Server signiertes Paar mit Einmal-Kennung.
- **Die Adresse des Anfragenden** nimmt die Seite aus `x-forwarded-for`; den Kopf setzt Vercel selbst, ein Besucher kann ihn dort nicht vorgeben.
- **Wenige Abhängigkeiten:** sieben direkte. Das ist die beste Verteidigung gegen verseuchte Pakete.

## 4. Brauche ich Schutz gegen Bots?

**Ja, aber nicht gegen Einbrecher — gegen Verbrauch.** Die realistische Gefahr ist nicht, dass ein Bot etwas stiehlt. Sie ist, dass er etwas aufbraucht, und davon gibt es vier Dinge:

| Was | Grenze | Was dann geschieht |
|---|---|---|
| Vercel Hobby | 1 Mio. Anfragen, 100 GB, **4 CPU-Stunden** im Monat | **Die Seite steht bis zum Monatsersten.** Kein Nachkauf. Das ist der eine Fall, in dem ein gelangweilter Crawler die Seite wirklich abschaltet |
| Google Books | 1.000 Anfragen am Tag | Verdikte und Beschreibungen fehlen bis Mitternacht Pazifik-Zeit |
| Open Library | bittet um Rücksicht | Im schlimmsten Fall sperrt Open Library *unsere* Adresse, weil ein Bot durch uns hindurch abfragt |
| Anthropic | Geld | siehe oben |

**Was dagegen steht, in der Reihenfolge des Nutzens:**

1. **PLAN-2.4 ausführen.** Bot Protection und AI Bots auf *Log* (erst sehen, dann sperren), und die eine eigene Regel, die Hobby erlaubt, als Rate-Limit vor die Routen, die Google kosten. Vercels Grenze sitzt vor den Funktionen und gilt über alle Instanzen — genau das, was `lib/ratelimit.ts` nicht kann.
2. **Wissen, wo der Notschalter ist.** *Attack Mode* (Firewall → Bot Management) stellt jedem Besucher eine Prüfung; er sperrt auch Google und jeden Link-Vorschau-Abruf, deshalb bleibt er aus und ist nur für den Tag, an dem die Zähler davonlaufen. Er wirkt sofort, ohne Deploy.
3. **`robots.txt` für KI-Crawler entscheiden.** Heute: alle dürfen alles außer `/api/` und `/go/`. Wer GPTBot, ClaudeBot, CCBot und ähnliche nicht will, schreibt sie hinein — wirkt nur bei den höflichen, kostet nichts. Dagegen spricht: eine neue Seite will gefunden werden, auch von Assistenten.
4. **Kein CAPTCHA.** Es gibt hier kein Formular, das eines verdient; das Cover-Spiel ist mit signierten Paaren besser geschützt als mit einem Rätsel, und ein CAPTCHA wäre ein dritter Anbieter in der Datenschutzerklärung.

Was Bots **nicht** können: sich anmelden (zufällige Passwörter), fremde Sammlungen ändern (die ID ist 128 Bit Zufall), das Brett fälschen ohne Mühe (signierte Paare — aber ein geduldiger Bot kann abstimmen; das Brett ist ein Spiel, kein Wahlergebnis).

## 5. Sicherungen: was es schon gibt, was fehlt, und was Vercel kann

**Vercel sichert Deployments, nicht Daten.** Jedes Deployment bleibt unveränderlich liegen; „Instant Rollback" stellt die vorige Produktion in Sekunden wieder her (auf Hobby: die unmittelbar vorige). Das ist die Antwort auf „ein Deploy hat etwas kaputt gemacht" — und nur darauf. Einen Spiegel der Seite oder eine Datensicherung bietet Vercel nicht.

Was es zu sichern gibt, sind vier Dinge mit sehr verschiedenem Stand:

| Was | Wo es liegt | Kopien heute | Lücke |
|---|---|---|---|
| **Code, Daten-Dateien, Dokumente** | git | GitHub, Julians Rechner, iCloud, jeder Worktree | keine echte. iCloud ist dabei eher Risiko als Sicherung (6.42: Duplikate, die den Build stören). Ein zweites Remote (Codeberg, GitLab) wäre fünf Minuten und schützt vor einem gesperrten GitHub-Konto |
| **Die Redis** | beim Anbieter | **keine** | Sammlungen der Leser, Stimmen, Entwürfe und Schalter von `/curate`, Vorschläge. Das ist die Lücke |
| **Schlüssel und Variablen** | Vercel, `.env.local` | die Datei, in iCloud | kein Verzeichnis, was es alles gibt und wo man es neu erzeugt. Nach einem verlorenen Rechner oder einem gesperrten Vercel-Konto wüsste niemand, was fehlt |
| **Konten** | GitHub, Vercel, INWX, Google, Anthropic, Resend | — | Wiederherstellungscodes |

**Vorschlag für die Redis (2.11):**

1. Eine Route `GET /api/admin/export`, nur mit dem Admin-Passwort als Bearer wie `/api/curate/publish`, die alle Schlüssel als eine JSON-Datei ausgibt — die Seite kennt ihre Verbindung, ein Skript auf Julians Rechner müsste sie erst bekommen.
2. `npm run backup` holt die Datei und legt sie mit Datum in einen Ordner **außerhalb** des Repositorys und außerhalb von iCloud; das Cockpit zeigt, wie alt die letzte ist.
3. Einmal in der Woche von Hand oder per geplanter Aufgabe; nach jedem Abend, an dem auf `/curate` gearbeitet wurde.
4. **`npm run restore` in eine leere lokale Redis, einmal ausprobiert.** Eine Sicherung, die nie zurückgespielt wurde, ist eine Vermutung.
5. Beim Anbieter nachsehen, was der Tarif sichert und ob er ungenutzte Datenbanken löscht.

Die Export-Datei enthält Namen, die Leser getippt haben, und die Hashes ihrer IDs — sie ist so zu behandeln wie die Datenbank selbst: nicht ins Repository, nicht in einen Chat.

**Ein „Spiegel der Seite" im engeren Sinn** — die Seiten als fertiges HTML — hilft hier wenig, weil fast jede Seite beim Aufruf aus Open Library entsteht. Was diesem Wunsch am nächsten kommt, steht schon auf der Roadmap: **6.45**, die kuratierten Werke als gebaute Daten, damit ein Ausfall von Open Library die wichtigsten Seiten nicht mitnimmt. Für die Nachwelt: die Startseite und die Sammlungen einmal bei der Wayback Machine einreichen, das kostet nichts.

## 6. Weiter gedacht

**Der Notfallzettel.** Am Tag, an dem etwas passiert, will niemand suchen. Eine Seite, ausgedruckt:

| Wenn | Dann | Wie schnell |
|---|---|---|
| Ein Deploy hat etwas kaputt gemacht | Vercel → Deployments → voriges → *Instant Rollback* | Sekunden |
| Die Zähler laufen davon, jemand hämmert | Firewall → *Attack Mode* an | sofort |
| Die Fotoroute wird missbraucht | `ANTHROPIC_API_KEY` in Vercel entfernen **und neu deployen** — eine Variable wirkt erst mit dem nächsten Build | 2–3 Minuten |
| Sammlungen der Leser laufen aus dem Ruder | `WALLS` ausschalten, neu deployen; einzelne über `/create/review` | 2–3 Minuten |
| Ein Schlüssel ist bekannt geworden | beim Anbieter widerrufen, neuen in Vercel setzen, neu deployen; für die beiden Passwörter gilt dasselbe und meldet alle ab | 5 Minuten |
| Das GitHub-Konto ist gesperrt oder übernommen | in Vercel die Git-Verbindung trennen; die Seite läuft weiter, deployt wird mit `vercel --prod` vom Rechner | — |
| Die Datenbank ist weg | `npm run restore` aus der letzten Sicherung | so alt wie die Sicherung |

Bemerkenswert daran: **drei der sieben Schalter brauchen einen Deploy.** Wer einen Schalter will, der sofort wirkt, legt ihn in die Redis statt in eine Variable — für die Fotoroute wäre das eine Überlegung wert.

**Die Sitzungen sind selbst eine Angriffsfläche.** Mehrere Claude-Sitzungen arbeiten mit Schreibrecht auf das Repository, einige pushen nach `main`, und ein Push ist ein Deploy. Sie lesen Open Library, Webseiten, Kommentare — Text, den Fremde geschrieben haben. Die Regeln dagegen stehen in CLAUDE.md (keine Werte aus Vercel lesen, keine Geheimnisse in Dateien, das Cockpit nur auf 127.0.0.1). Zwei Ergänzungen wären ehrlich: Geheimnisse nie in einen Chat schreiben, auch nicht zum Übergeben; und kein Push nach `main` ohne Julians Wort — heute ist das Gewohnheit, keine Regel.

**Anmeldung mit Google, Apple oder Meta** (5.13h, liegt in einem Worktree) macht aus einer Seite ohne Konten eine mit. Das ist die größte Änderung der Angriffsfläche, die auf der Roadmap steht: Rückruf-Adressen, Sitzungen, Konten-Zusammenführung, Löschung auf Anfrage. Vor dem Merge verdient das eine eigene Durchsicht, nicht nur Tests.

**Provisionen** (Phase 4) bringen Geld und damit ein Motiv: wer den Weiterleiter oder die Affiliate-Kennung manipulieren kann, verdient. `/go` ist dafür richtig gebaut. Wenn Kennungen kommen, gehören sie in Vercel als *sensitive* Variablen und nie in den Browser.

**Was die Seite über Leser weiß**, ist wenig: einen Hash je Sammlungs-Besitzer, einen freiwillig getippten Namen, zwei Cover und einen Tag je Stimme. Das ist die beste Vorsorge für den Fall eines Datenabflusses — es gibt kaum etwas abzufließen. Trotzdem gilt die Meldepflicht (Art. 33 DSGVO, 72 Stunden an die Aufsichtsbehörde, wenn ein Risiko für Betroffene besteht). Es lohnt, den Satz dazu einmal gelesen zu haben, bevor man ihn braucht.

**`/.well-known/security.txt`** mit der Kontaktadresse aus dem Impressum: zehn Minuten, und wer eine Lücke findet, weiß, wem er sie sagt, statt sie auf einer Plattform zu veröffentlichen.

**Überwachung von außen.** Niemand merkt heute einen Ausfall (Risikoregister D). Ein kostenloser Dienst, der alle fünf Minuten die Startseite abruft und eine Mail schickt, ist der billigste Sicherheitsgewinn auf dieser Liste — PLAN-2.4 §3.7 beschreibt, wie er an Vercels Bot-Abwehr vorbeikommt.

**Der Umzug aus iCloud** (6.42) ist auch ein Sicherheitspunkt: ein Ordner, den ein Dienst im Hintergrund umschreibt, ist kein verlässlicher Arbeitsplatz für Schlüssel und Builds.

## 7. Was daraus in die Roadmap kommt

| Nr. | Was | Wer | Aufwand |
|---|---|---|---|
| **2.8** | JSON-LD maskiert — **erledigt 2026-10-02**, geht mit dem nächsten Push online | Claude | — |
| **2.9** | Next.js auf 16.3.x und `sharp` auf 0.35.x heben, danach `npm audit` ohne critical und high | Claude | halber Tag mit Ansehen |
| **2.10** | Konten und Ausgaben: zweiter Faktor und Wiederherstellungscodes bei GitHub, Vercel, INWX, Google Cloud, Anthropic, Resend, dem Redis-Anbieter; Monatslimit bei Anthropic; Google-Schlüssel auf die Books API beschränken; `SUGGEST_ADMIN_PASSWORD` neu setzen; ein Verzeichnis der Schlüssel im Passwort-Manager | Julian | eine Stunde |
| **2.11** | Sicherung der Redis: Export-Route, `npm run backup`, `npm run restore`, einmal zurückgespielt; zweites git-Remote | Claude baut, Julian richtet ein | ein Tag |
| **2.12** | Antwort-Header: `nosniff`, `Referrer-Policy`, `frame-ancestors`, `Permissions-Policy`, CSP zuerst als Report-Only; `security.txt` | Claude | halber Tag |
| **2.13** | GitHub: Dependabot-Alarme und Sicherheitsupdates an, `.github/dependabot.yml` | Julian 2 Minuten, Claude die Datei | — |
| **2.14** | DNS der neuen Domain härten: SPF, DMARC, Null-MX (oder Resends Einträge), DNSSEC, CAA, Transfersperre, automatische Verlängerung | Julian mit der Domain-Sitzung | 20 Minuten |
| 2.4 | (besteht) Firewall nach PLAN-2.4, dazu der Überwachungsdienst | Julian | 45 Minuten |
| 6.45 | (besteht) Kaltreserve der kuratierten Werke | Claude | ein Tag |

Reihenfolge nach Nutzen je Minute: **2.10 → 2.9 → 2.13 → 2.4 → 2.14 → 2.11 → 2.12.**
