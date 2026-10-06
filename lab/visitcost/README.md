# visitcost — was ein Besuch kostet (ROADMAP 2.18b)

**Frage:** Wie viele Anfragen, Funktionsaufrufe, Redis-Befehle, Katalog-Anfragen und Bytes kostet ein Besuch je Seitentyp? Die Tabelle in [PLAN-2.18 §3](../../docs/plans/PLAN-2.18-ansturm.md) war am Code abgelesen; diese Messung ersetzt sie.

**Wie:**

```bash
npx tsx lab/visitcost/run.ts              # baut, misst, schreibt results.json
npx tsx lab/visitcost/run.ts --no-build   # misst den letzten Build dieses Skripts
```

- `next build` und `next start` laufen mit festen Variablen (keine `.env`-Datei) und mit `intercept.cjs` als Preload. Der fängt jedes `fetch`, das den Prozess verlässt: Open Library und Google aus `lib/__fixtures__`, Cover als kleines JPEG, Redis als Attrappe des Upstash-REST-Protokolls (die Seite nimmt REST, sobald `STORAGE_*_REST_API_URL/TOKEN` gesetzt sind). **Jeder andere Host wird abgewiesen** — eine Messung erreicht nie einen echten Dienst, schon gar nicht die Redis der Produktion.
- Ein kopfloses Chrome besucht jede Seitenart in einem frischen Profil (1280 × 800), wartet auf Ruhe im Netz, scrollt bis zum Ende, verlässt die Seite (damit `/api/seen` gesendet wird). Zwei Durchgänge: **kalt** (der Datencache des Servers hat nur, was der Build holte) und **warm**.
- `next start` läuft mit `VERCEL_ENV=production`, damit die Analyse schreibt wie in Produktion; der Build ohne, weil sonst die Bildoptimierung (2.18o) angeschaltet wäre, die `next start` nicht nachbilden kann. Bilder laufen hier also über `/img`; in Produktion über `/_next/image` vor `/img`.

**Was die Spalte „Funktion" bedeutet:** ein Modell, keine Messung. Eine statische Datei und eine vorgerenderte Seite (`x-nextjs-cache: HIT`) sind auf Vercel ein CDN-Treffer; eine Antwort mit `s-maxage` ist es für den zweiten Leser; alles andere läuft jedes Mal in einer Funktion.

**Grenzen:** Fixtures gibt es für fünf Werke; ein anderes Werk antwortet leer, also misst die Suche die Mosaike der fünf und leere Karten für den Rest. Die Redis ist leer (keine Inhalte aus `/curate`, keine Leser-Sammlungen). Ein Leser am Telefon ist nicht gemessen (kopfloses Chrome rendert erst ab 500 px Breite).

**Stand:** gebaut 2026-10-05; Ergebnisse in `results.json` und in [docs/history.md](../../docs/history.md).
