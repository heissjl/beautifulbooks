# Plan 2.4: Firewall-Einstellungen für den Betrieb

Stand: 2026-09-11, **fortgeschrieben 2026-09-14**. Die Rate-Limit-Regel (§3.4) liegt als unveröffentlichter Entwurf bei Vercel, von Claude über die CLI angelegt. Veröffentlichen, die zwei verwalteten Regelsätze umstellen und UptimeRobot einrichten tut Julian (§5); Claude schreibt danach die Messungen in die Historie. Anlass: Julian, 2026-09-11: „mache einen Vorschlag, welche Firewall-Einstellungen wir machen müssen." Grundlage ist ROADMAP 2.4 und die Messung vom 2026-09-09 (403 mit `x-vercel-mitigated: challenge` nach wiederholten automatischen Abrufen).

## 1. Was der Hobby-Plan überhaupt erlaubt

Nachgelesen am 2026-09-11 in Vercels Doku (Quellen am Ende). Die Zahlen setzen den Rahmen; alles darüber hinaus gibt es erst ab Pro.

| Werkzeug | Hobby | Kosten |
|---|---|---|
| Automatische DDoS-Abwehr (L3/L4/L7) | immer an, nicht abschaltbar außer 24 h Pause | frei |
| Attack Mode | verfügbar | frei |
| Bot Protection (Regelsatz) | verfügbar, **aus** per Voreinstellung; Modi *Log* oder *Challenge* | frei |
| AI Bots (Regelsatz) | verfügbar, **Allow** per Voreinstellung; Modi *Log* oder *Deny* | frei |
| Eigene Regeln | **3 je Projekt**, davon höchstens **1 Rate-Limit-Regel** (fester Zeitraum 10 s bis 10 min, Schlüssel IP oder JA4, 1 Mio. erlaubte Anfragen inklusive) | frei |
| IP-Sperren | 3 je Projekt | frei |
| System-Bypass (eine IP an der DDoS-Abwehr vorbei) | **nicht verfügbar** (ab Pro 25) | — |
| OWASP-Regelsatz | nicht verfügbar | — |

Was die Firewall abweist, kostet weder CDN-Anfragen noch Datentransfer. Eine Regel wirkt nach dem Veröffentlichen sofort und ohne Deploy; das Audit-Log im Dashboard kann jede frühere Fassung wiederherstellen.

## 2. Der heutige Stand, gemessen

- **Attack Mode ist aus.** Ein einzelner `curl` auf `/about` am 2026-09-11 kam mit **200**, `x-vercel-cache: PRERENDER`, ohne Challenge. Attack Mode hätte jeden Client ohne Browser und ohne Verifizierung vor die Aufgabe gestellt.
- **Die Challenge vom 2026-09-09 kam also von der automatischen Abwehr**, ausgelöst durch *wiederholte* Abrufe derselben Adresse, nicht von einer Projekteinstellung. Auf Hobby lässt sie sich für eine einzelne Adresse nicht abschalten (kein System-Bypass).
- **Abgelesen am 2026-09-14** mit der inzwischen angemeldeten Vercel-CLI (`vercel firewall status` und `overview --project beautifulbooks`): keine eigenen Regeln („Firewall: Not configured"), Mitigations *Active*, Attack Mode *Off*, Bot Protection *Off*, AI Bots *Allow*, OWASP *Off* (erst mit Security+), System-Bypass „Requires Pro or Enterprise". Keine IP-Sperren. Die Voreinstellungen stehen also unberührt.
- **Traffic und Alarme liest die CLI auf Hobby nicht** („Traffic and alerts need Observability Plus"). Die Woche im Modus *Log* wird deshalb im Dashboard gelesen, nicht mit `vc metrics`.
- **Die CLI kann eigene Regeln anlegen, aber die verwalteten Regelsätze nicht umstellen**: Bot Protection und AI Bots gehen nur im Dashboard.

## 3. Der Vorschlag

Sieben Einstellungen, in dieser Reihenfolge. Jede Regel, die etwas abweisen kann, beginnt im Modus **Log** — eine Firewall-Regel kann echte Leser, Crawler und Link-Vorschauen treffen, und das sieht man erst an echtem Verkehr.

### 3.1 Attack Mode: aus lassen

Nur während eines echten Angriffs einschalten und danach wieder aus. **Die Sorge aus 2.4 war zu groß:** Attack Mode lässt verifizierte Bots durch, Googlebot und Bingbot eingeschlossen, die Suchmaschinen-Indexierung litte also nicht. Treffen würde er alles, was nicht in Vercels Verzeichnis steht — und dort fehlen die Vorschau-Abrufe von **WhatsApp, Telegram, Discord und Slack** (am 2026-09-11 im Verzeichnis gesucht; vorhanden sind `facebookexternalhit`, `twitterbot`, `linkedinbot`). Ein geteilter Link zeigte dann kein Bild, und Teilen ist der billigste Hebel für Reichweite (6.20, 6.21).

### 3.2 Bot Protection: von *Off* auf *Log*

Eine Woche beobachten, **nicht** auf *Challenge*. Der Regelsatz fordert heraus, was sich nicht wie ein Browser verhält; ob er ehrliche Vorschau-Abrufe mit eigenem User-Agent (`WhatsApp/2.x`, `TelegramBot`, `Discordbot`) dazuzählt, sagt die Doku nicht. Das Log sagt es: nach einer Woche nach diesen User-Agents filtern. Tauchen sie als Treffer auf, bleibt der Regelsatz auf *Log*; tauchen nur Scraper auf, kann er auf *Challenge*.

### 3.3 AI Bots: von *Allow* auf *Log*

Sperren ist eine **Produktentscheidung für Julian**, keine technische: derselbe Regelsatz trifft Trainings-Crawler (GPTBot, ClaudeBot, CCBot) und die Abrufe, mit denen ChatGPT, Claude oder Perplexity eine Seite lesen, wenn ein Leser danach fragt — und Antwortmaschinen sind ein Weg, auf dem die Seite gefunden werden kann (Phase 5). Kosten verursachen KI-Crawler kaum: sie führen kein JavaScript aus, lesen also nur die vorgerenderten Seiten, und die kosten **keine** Google-Anfrage (SPEC N9). Also erst zählen, dann entscheiden. Soll später nur das Training ausgeschlossen werden, geht das feiner über `robots.ts` (einzelne User-Agents) als über den Regelsatz.

### 3.4 Eigene Regel 1 — Rate-Limit auf die Anfragen, die Google kosten können

Der einzige Rate-Limit-Platz, den Hobby hat. Er gehört dorthin, wo das knappe Gut ist.

| Feld | Wert |
|---|---|
| Name | `api-google-burst` |
| Bedingung (ODER) | Pfad beginnt mit `/api/isbn/` **oder** (Pfad beginnt mit `/api/works/` **und** Query `summary` ist nicht `1` **und** Query `sibling` ist nicht `1`) |
| Stand | **Entwurf seit 2026-09-14**, Kennung `rule_api_google_burst_HfssuN`; bei Überschreitung vorerst `log` |
| Zeitraum / Grenze | **600 s, 300 Anfragen**, Schlüssel **IP** |
| Aktion | zuerst **Log**, nach einer Woche **Rate Limit (429)** |

*Warum diese Bedingung.* Google kosten nur Seite 0 eines Werks und die ISBN-Nachschau (`app/api/works/[id]/route.ts`: `spendsGoogle = !summary && offset === 0`; `app/api/isbn/`). Seite 0 lässt sich in der Firewall nicht sauber erkennen: der Client schickt dafür *gar keinen* `offset`, und der Server macht aus jedem unbrauchbaren Wert Seite 0 (`offset=-5`, `offset=50`, `offset=abc`, siehe `offsetFromRequest`). Eine Regel auf `offset` wäre also mit einem Zeichen zu umgehen. Deshalb zählt die Regel alle Wandseiten mit, nur die Mosaike (`summary=1`, bis zu zwanzig je Trefferliste, kosten nichts) nicht. `/api/search` bleibt draußen: eine Suche kostet seit dem 2026-09-07 keine Google-Anfrage mehr.

*Nachtrag 2026-09-14: auch `sibling=1` bleibt draußen.* Seit 6.13 lädt eine Wand zusätzlich die Seiten ihrer Geschwisterwerke mit `?sibling=1`, und die Route fragt dafür nie Google (`spendsGoogle = !summary && !sibling && offset === 0`). Anders als `offset` lassen sich diese beiden Ausnahmen nicht zum Umgehen nutzen: wer `summary=1` oder `sibling=1` anhängt, schaltet Google auf dem Server tatsächlich ab und kann das Kontingent damit nicht verbrauchen.

*Warum 300 in 10 Minuten.* Eine Detailseite lädt bis zu **16** Seiten ihrer Wand, ein Klick auf ein Cover kostet **1 Anfrage je ISBN**, gemessen 2 bis 5 (SPEC N9). Wer in zehn Minuten fünf Bücher öffnet und zehn Cover anklickt, kommt auf rund 5 × 16 + 10 × 4 = **120**. 300 lässt das Zweieinhalbfache Luft; die Woche im Log zeigt, ob das stimmt.

*Was sie nicht kann — und so muss es auch in der Spec stehen.* **Sie schützt nicht den Tag.** 1.000 Google-Anfragen am Tag sind 0,7 in der Minute; jede Grenze, die ein echter Leser verträgt, lässt eine einzelne hartnäckige Adresse den Tag in unter einer Stunde verbrauchen. Den Tag schützen der Automat in `lib/googlequota.ts` und der Alarm aus 0.13. Die Regel leistet zweierlei, was das eingebaute Rate-Limit (`lib/ratelimit.ts`, N10) nicht kann: sie zählt **je Region statt je Instanz**, und sie weist ab, **bevor** eine Funktion läuft — ein Scraper, der `robots.txt` übergeht, kostet dann weder Funktionszeit noch Open-Library-Anfragen. Und die Woche im Modus *Log* ist die erste Messung, wie viel automatischer Verkehr die API überhaupt trifft.

### 3.5 Eigene Regeln 2 und 3 — frei lassen

Zwei Plätze bleiben für den Ernstfall frei: eine Sperre gegen einen bestimmten Angreifer, oder eine *Bypass*-Regel, falls Bot Protection später auf *Challenge* geht und ein eigener Dienst darunter leidet. Eine Regel gegen Suchen nach `/wp-admin`, `/.env` und ähnlichem wäre möglich, lohnt aber keinen der drei Plätze: diese Anfragen enden in der statischen 404-Seite und kosten fast nichts. Erst wenn das Log Rauschen zeigt, das beim Lesen stört.

### 3.6 IP-Sperren: keine

Drei Plätze, nur im Ernstfall und mit einer Notiz, warum.

### 3.7 UptimeRobot: ohne Ausnahmeregel einrichten, eine Woche beobachten

Die Frage aus 2.4, ob der Monitor eine Ausnahme braucht: **auf Hobby gibt es keine**, und vermutlich ist keine nötig. `uptime-robot` steht in Vercels Verzeichnis verifizierter Bots (Kategorie *monitor*), kommt also an Attack Mode und Bot Protection vorbei. Ob die *automatische* DDoS-Abwehr ihn ebenfalls durchlässt, sagt die Doku nicht; bei einem Abruf alle fünf Minuten (288 am Tag, Voreinstellung des kostenlosen Tarifs) ist es unwahrscheinlich, dass er sie auslöst.

- Ziel bleibt `/api/search?q=1984`: kostet keine Google-Anfrage, fällt nicht unter Regel 1, und sagt, ob Open Library antwortet.
- Als **Keyword-Monitor** einrichten (Stichwort `Nineteen Eighty-Four`), nicht als bloßer Statuscheck — sonst zählte auch eine leere Trefferliste als „up", und genau das ist der Fehler aus 1.4.
- Meldet er in der ersten Woche einen Ausfall, zuerst im Firewall-Log nachsehen, ob die Antwort `x-vercel-mitigated` trug. Wenn ja, ist das der Befund für 2.4, und die Wege sind Pro (System-Bypass) oder ein anderer Dienst — nicht eine Regel, die auf Hobby nichts ausrichtet.

## 4. Warum die Regeln nicht in `vercel.json` stehen

`vercel.json` kann über `routes[].mitigate` Regeln mitliefern, aber **nur `deny` und `challenge`**, weder *Log* noch *Rate Limit* noch *Bypass*. Der Vorschlag beginnt überall mit *Log*, also bleibt die Konfiguration im Dashboard. Weil sie damit nicht in Git steht, **steht sie in der Spec**: sobald Julian veröffentlicht hat, trägt Claude die geltenden Einstellungen in SPEC N10 ein, mit Datum. Wer später eine Regel ändert, ändert auch diese Zeile.

## 5. Ablauf

0. ✅ **Claude, 2026-09-14:** Stand abgelesen (§2), Regel 3.4 als Entwurf angelegt. `vercel firewall diff` zeigt genau eine Änderung: „Added rule api-google-burst".
1. **Julian** (10 Minuten):
   - Den Entwurf veröffentlichen: im Dashboard unter Firewall → *Review Changes* → *Publish*, oder im Terminal `vercel firewall publish --project beautifulbooks --yes`.
   - Im Dashboard 3.2 Bot Protection auf *Log* und 3.3 AI Bots auf *Log* stellen, dann veröffentlichen.
   - UptimeRobot nach 3.7 einrichten — **später**, eigener Schritt (Julian, 2026-09-14: „das mit uptime robot mache ich später"). Die Woche im Log beginnt mit dem Veröffentlichen, nicht mit dem Monitor.
2. **Eine Woche warten.**
3. **Claude** mit Julian: Firewall-Traffic je Regel lesen, im Dashboard unter <https://vercel.com/julian-heiss-projects/beautifulbooks/firewall/traffic?filter=rule_api_google_burst_HfssuN> für Regel 3.4, die Regelsätze entsprechend; Zahlen in die Historie. Entscheiden: Regel 1 auf 429 und die Grenze nachziehen; Bot Protection *Log* oder *Challenge*; AI Bots (Julians Entscheidung).
4. Geltende Einstellungen in SPEC N10, 2.4 abhaken.

## 6. Nebenbefund

`app/api/search/route.ts` belastet noch den gemeinsamen `google`-Eimer (`rateLimited(request, 'search', 'google')`), obwohl `lib/search.ts` seit dem 2026-09-07 keine Google-Anfrage mehr stellt; CLAUDE.md nennt die Suche in derselben Regel noch als Google-Aufrufer. Das bremst zu früh, nicht zu spät, ist also harmlos, widerspricht aber der Regel „charge `google` only where a Google request is actually possible". Gehört als kleiner Punkt in Phase 6, nicht in diesen Plan. *Seit 2026-09-14 ROADMAP 6.47.*

## Quellen

- [Vercel WAF, Limits je Plan](https://vercel.com/docs/vercel-firewall/vercel-waf)
- [WAF Rate Limiting, Limits je Plan](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
- [WAF Custom Rules, Konfiguration in vercel.json](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)
- [Managed Rulesets: Bot Protection, AI Bots](https://vercel.com/docs/vercel-firewall/vercel-waf/managed-rulesets)
- [Bot Management und Verzeichnis verifizierter Bots](https://vercel.com/docs/bot-management)
- [Attack Mode](https://vercel.com/docs/vercel-firewall/attack-mode)
- [DDoS Mitigation](https://vercel.com/docs/vercel-firewall/ddos-mitigation)
- [System Bypass Rules](https://vercel.com/docs/vercel-firewall/vercel-waf/system-bypass-rules)
- [Usage & Pricing for Vercel WAF](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing)
