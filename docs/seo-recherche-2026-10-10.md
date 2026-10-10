# Suchsichtbarkeit für eine kleine, neue Seite — Recherche 2026-10-10

Julian, 2026-10-10, zum SEO-Plan 6.107: „ich glaube man kann hier noch nicht viel messen, weil wir kaum traffic haben. eher nochmal eine webrecherche machen, was wichtig für kleine neue seiten ist“. Recherche eines Agenten im Web (Quellen mit Stand); danach von Claude gegen den Code geprüft (§7). **[G]** = Google selbst (Search Central, Mitarbeiter), **[B]/[O]/[P]** = Bing, OpenAI, Perplexity selbst, **[SEO]** = Praktiker oder Tool-Anbieter.

**Kurz:** Google bewertet Indexierung und Ranking zunehmend nach der Qualität der ganzen Seite. Das Kapital von *Buy Its Covers* sind die ~60 kuratierten Sammlungen; Hunderte Buchseiten, die vor allem Katalogdaten neu ordnen, sind auf einer neuen Domain eher ein Risiko. Zwei technische Befunde wiegen am schwersten: **die deutsche Fassung ist für Google praktisch unsichtbar** (Sprache per Cookie unter derselben Adresse), und **`lastmod` ist in der Sitemap überall „jetzt“**, also wertlos.

## 1. Neue Domain, wenige Backlinks

- **Crawl-Budget ist bei dieser Größe kein Thema.** [G] Der Leitfaden gilt grob ab 1 Mio. URLs oder 10.000 mit täglichen Änderungen; kleineren Seiten genügen eine aktuelle Sitemap und der Indexierungsbericht. Der Crawl-Bedarf hängt aber an Einzigartigkeit und Nutzen. developers.google.com/crawling/docs/crawl-budget (Stand 2026-07-22)
- **„Discovered“ / „Crawled – currently not indexed“** [G]: gefunden, aber nicht abgerufen (meist Serverlast) bzw. abgerufen, aber nicht aufgenommen; erneutes Einreichen nicht nötig. support.google.com/webmasters/answer/7440203. Mueller/Splitt (*Search Off the Record*, Bericht seroundtable.com 2026-07-16): „crawled, not indexed“ ist „sometimes“ ein Qualitätssignal; bei Zweifel crawlen die Systeme „a lot less“; bleibt eine ganze Gruppe draußen, die Qualität insgesamt prüfen. Mueller (Bluesky, Juli 2025) zu einer Seite mit 4 indexierten Seiten: die Systeme seien „aren't convinced about the site overall“.
- **Scaled Content Abuse** [G]: trifft Seiten, bei denen „many pages are generated for the primary purpose of manipulating search rankings and not helping users“ — Beispiele u. a. Scrapen von Feeds und Zusammenstückeln fremder Inhalte „without adding value“. Der Zweck zählt, nicht die Methode. developers.google.com/search/docs/essentials/spam-policies (Stand 2026-08-28). Mueller (Bluesky, Sept. 2026, Bericht searchenginejournal.com 2026-09-08): „Programmatic SEO like this often leads to a site that's either spam, borderline spam, or low quality“; alte schwache Seiten können das Vertrauen in die ganze Seite kosten, Erholung „tends to take time & significant effort“. Warnsignale im Leitfaden zu hilfreichen Inhalten: „extensive automation to produce content on many topics“, „mainly summarizing what others have to say without adding much value“ (Stand 2026-10-05).
- [SEO] Faustregeln von Anbietern, keine Google-Schwellen: programmatische Seiten in Schüben von 50–100 veröffentlichen, 2–4 Wochen beobachten, eine Indexquote unter 70–80 % als Warnsignal.
- **Für diese Seite:** Eine Buchseite, die nur Open-Library- und Google-Daten neu anordnet, entspricht dem Muster der Beispiele. Dagegen steht die eigene Leistung: Zusammenfassen gleicher Cover, Urteile zu Cover und ISBN, Credits der Gestalter, kuratierter Kontext. Eine Regel „erst Autorität, dann Long-Tail“ gibt Google nicht an; aus Muellers Aussagen folgt aber, dass viele schwache Seiten früh die Domain belasten können (Schluss, kein Zitat).

## 2. Was eine kleine Seite voranbringt

- **Eigenständiger Inhalt** [G]: „Creating content that people find unique, compelling, and useful“ als wichtigster Faktor; selbst erstellen statt nacherzählen. developers.google.com/search/docs/fundamentals/ai-optimization-guide (Stand 2026-07-10)
- **Interne Links** [G]: „the vast majority of the new pages Google finds every day are through links“. SEO-Starter-Guide (Stand 2025-12-10)
- **Wenige starke Hub-Seiten** statt vieler dünner: nicht wörtlich von Google, folgt aus der Bewertung der ganzen Seite. Hier: die Sammlungen tragen, die Buchseiten hängen darunter.
- **Google Bilder** [G]: Alt-Text ist die wichtigste Angabe; echte `<img src>` (CSS-Hintergründe werden nicht indexiert); Bild nahe am passenden Text, Bildunterschriften helfen; sprechende Dateinamen; eine Bild-Sitemap darf Bilder auf fremden Domains listen (also `covers.openlibrary.org`); das Vorschaubild steuern `primaryImageOfPage`, `image`, `og:image`. developers.google.com/search/docs/appearance/google-images (Stand 2026-03-02)
- **Lizenz-Metadaten** [G]: `contentUrl` plus eines von `creator`, `creditText`, `copyrightNotice`, `license`; „Licensable“ nur mit `license`. **Die Seite hält keine Rechte** — also nie `license`/`acquireLicensePage`; höchstens `creator`/`creditText` mit dem Gestalter, wo ein gesicherter Credit steht.
- **Discover** [G]: keine besonderen Tags; Bilder ab 1200 px, `max-image-preview:large`; bevorzugt aktuelle, erzählte Inhalte mit eigener Einsicht — realistisch nur Sammlungen und Geschichten.
- **OG und Pinterest:** `og:image` ist für Google nur ein Hinweis aufs Vorschaubild. [Pinterest] Article Rich Pins gelten nicht für Seiten aus Bildern mit wenig Text. [SEO] Einzelberichte über sinkenden Pinterest-Referral-Traffic seit 2025. Für eine Bilderseite trotzdem ein plausibler Kanal; teilbare Wände eher als Rich Pins.
- **Core Web Vitals** [G]: „Google Search always seeks to show the most relevant content, even if the page experience is sub-par.“ (Stand 2026-09-22) — geringes Gewicht.

## 3. Backlinks und Erwähnungen ohne Budget

- [G] Link-Spam ist „creating links … primarily for the purpose of manipulating search rankings“; auch thematisch passender Linktausch ist schlecht, wenn systematisch (Mueller). Mundpropaganda ist „one of the most effective and lasting ways“ (Starter-Guide).
- Wikipedia-Links sind seit 2007 `nofollow`, selbst gesetzte verstoßen gegen die Richtlinien — kein Hebel.
- [SEO] Für KI-Antworten korrelieren Markenerwähnungen stärker als Backlinks (Ahrefs, Aug. 2025, 75.000 Marken: r = 0,664 gegen 0,218; Sekundärquelle).
- **Was realistisch geht:** einzelne Sammlungen dort zeigen, wo sie Thema sind (SF-Foren, Verlags- und Designblogs, Buchgestaltungs-Accounts); Verlage und Gestalter auf ihre Wand hinweisen; Korrekturen an Open Library beitragen (nur mit Julians Ja). Reddit macht Julian selbst (für Claude tabu).

## 4. Bing, andere Suchmaschinen, KI-Suche

- **Bing** [B]: vollständige Sitemap mit **echtem** `lastmod` (ISO 8601 mit Uhrzeit, nicht die Erzeugungszeit), IndexNow ergänzend; `changefreq`/`priority` ignoriert. blogs.bing.com, 2025-07-31. Copilot sucht in Bings Index. Bing Webmaster Tools hat seit Februar 2026 einen „AI Performance“-Bericht.
- **Google AI Overviews / AI Mode** [G]: „There are no additional requirements … nor other special optimizations necessary.“ (Stand 2025-12-10)
- **llms.txt** [G]: „Google Search itself doesn't use them.“ Nur Lighthouse prüft sie, ohne Ranking-Bezug.
- **ChatGPT-Suche** [O]: `OAI-SearchBot` entscheidet über Erscheinen in den Antworten; `GPTBot` (Training) getrennt sperrbar. **Perplexity** [P]: `PerplexityBot` erlauben, um zitiert zu werden.
- **Was die Seite tun kann:** klare Faktenseiten mit überprüfbaren Sätzen („SF Masterworks #1: zwei Cover unter einer ISBN, 1999 und 2004“), Methodik auf der About-Seite, die Such-Crawler nicht aussperren.

## 5. Technische Grundlagen

- **Sitemap** [G]: `lastmod` nur, wenn „consistently and verifiably“ richtig, als letzte wesentliche Änderung (Hauptinhalt, strukturierte Daten, Links); `priority`/`changefreq` ignoriert; nur kanonische URLs. (Stand 2026-07-08)
- **Canonicals** [G]: ein Hinweis, kein Befehl; selbstreferenzierend, absolut; intern auf die kanonische URL verlinken; nicht robots.txt oder `noindex` als Canonical-Ersatz. (Stand 2026-07-10)
- **Sprache per Cookie unter derselben URL — ein Problem** [G]: „Google recommends using different URLs for each language version of a page“ statt Cookies oder Browsereinstellungen; keine automatischen Weiterleitungen, sichtbare Sprachlinks. Googlebot crawlt meist von US-IPs ohne `Accept-Language`. developers.google.com/search/docs/specialty/international/managing-multi-regional-sites, …/locale-adaptive-pages (Stand 2025-12-10). **Folge:** Googlebot sieht nur Englisch; die deutsche Fassung wird praktisch nicht indexiert. Wenn deutsche Suche zählen soll: `/de/…` öffentlich, gegenseitiges `hreflang` plus `x-default`, das Cookie wählt nur noch zwischen den Adressen.

## 6. Rangliste des Agenten für *Buy Its Covers*

**Zuerst:** (1) Search Console und Bing Webmaster Tools verifizieren, Sitemap einreichen, Indexquote je Seitentyp beobachten. (2) Sitemap auf das Starke beschränken, `lastmod` nur bei echter Änderung. (3) Canonicals für `?cover=`, `?q=`, `?lang=`; `/?q=` auf `noindex`. (4) Sammlungen als Hub-Seiten: ein paar Sätze eigener Text, Links zu den Büchern und zurück. (5) Bild-SEO: Alt-Text mit Ausgabe und Gestalter, Bildunterschriften, Bild-Sitemap für Sammlungen; `creditText` nur bei gesichertem Credit, nie `license`. (6) Sprachfrage entscheiden: bewusst nur Englisch im Index, oder öffentliche `/de/` mit `hreflang`. (7) Googlebot, Bingbot, `OAI-SearchBot`, `PerplexityBot` in robots.txt und im Vercel-Bot-Schutz prüfen. (8) Gezielt erwähnt werden, mit Mehrwert statt Werbung.

**Lassen:** (1) keine Hunderte Buch- und Jahrzehnte-Seiten in den Index drücken, solange sie vor allem Katalogdaten zeigen; (2) kein llms.txt, keine KI-Schema-Tricks, kein Linktausch, keine Verzeichnisse; (3) `/c/` und das Spiel nicht indexieren, kein Feinschliff an Core Web Vitals auf Kosten von Inhalt.

## 7. Gegen den Code geprüft (Claude, 2026-10-10)

| Punkt | Stand im Code | Befund |
|---|---|---|
| Canonicals | Startseite `/`, Buchseite `workUrl(id)`, Sammlung, Jahrzehnte-Seite: je selbstreferenzierend (`app/book/[id]/page.tsx:67` u. a.) | in Ordnung; `?cover=`/`?q=` fallen auf die Basis |
| `/?q=` noindex | `app/page.tsx:57`: Ergebnisseiten `index: false, follow: true` | in Ordnung |
| Sitemap-Umfang | Start, About, Kontakt, Datenschutz, Sammlungen, **500 Buchseiten** (`PUBLISHED_WORKS`, der Index), **322 Jahrzehnte-Seiten**, das Spiel | ~880 URLs, davon ~820 datengetriebene — genau das, wovon die Recherche abrät, solange die Domain jung ist |
| `lastmod` | überall `lastModified: now` (`app/sitemap.ts`) | **wertlos** für Google, falsch für Bing |
| Sprache | Cookie + Proxy-Rewrite auf `app/de/`, kein `hreflang`, `/de/` nicht öffentlich | Deutsch nicht indexierbar (bewusst? — Julian) |
| KI-Crawler | `OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot` stehen in `BOUNDED_CRAWLERS` (`lib/robots.ts:20`): nur kuratierte Buchseiten, keine Query-Adressen, 10 s Crawl-Delay | nicht gesperrt, aber eng; Sammlungen sind offen |
| Vercel-Bot-Schutz | aus 2.4 bekannt: wiederholte Anfragen → 403 `challenge` | prüfen, ob Bingbot/OAI-SearchBot je eine Challenge bekamen (K14) |
