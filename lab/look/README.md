# look — weniger nach Claude aussehen

**Frage.** Julian am 2026-10-02: Teile der Seite sehen aus wie das, was ein Modell ohne Vorgabe baut. Wie sähe sie mit Farben aus dem Material und ohne die typischen Bauteile aus? Befund: [docs/gestaltung-ki-anmutung.md](../../docs/gestaltung-ki-anmutung.md).

**Maß.** Kein Urteil per Zahl. Dieselbe Gatsby-Seite (Kopf, Titel, Sprachreiter, Wand, Seitenleiste, Läden) in fünf Fassungen, hell und dunkel, mit echten Drucken aus `lib/__fixtures__/the-great-gatsby/`. Unter jeder Fassung die Kontrasttabelle (`lib/contrast.ts`); wer unter 4,5 fällt, ist raus — Stand 2026-10-02 besteht jede Fassung. Darunter die Vorschläge zu Etiketten, Pfeilen, Mittelpunkten und Slogan mit jeder Stelle im Code.

**Fassungen** (`looks.ts`): *Heute*; *Heutige Farben, neue Form*; *Galerie* (kein Akzent, kühles Papier); *Edelmann-Gelb* (Reihe Hanser, Gelb als Fläche, Schrift schwarz); *Penguin-Orange* (Band über der Seite, Orange als Fläche, Links dunkles Orange). Anders als `lab/palette/` (6.22) trennt ein Schema die drei Aufgaben des Akzents: Linktext, gefüllter Knopf, gewählter Reiter — Gelb und Penguin-Orange sind als Text auf hellem Grund unlesbar, als Fläche mit Tinte darauf nicht.

**Stand.** Mockup gebaut 2026-10-02. Entschieden ist nichts; Julian wählt.

## Bauen

```bash
npx tsx lab/look/build.ts           # -> lab/look/index.html, Bilder von Open Library
npx tsx lab/look/build.ts --embed   # -> lab/look/out/look.html, Bilder und Schrift eingebettet (git-ignoriert)
```
