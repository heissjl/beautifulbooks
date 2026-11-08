---
name: publish
description: Die Checkliste vor dem Veröffentlichen (Push nach main = Deploy) von oben nach unten durchgehen. Nur bewusst auslösen: /publish.
disable-model-invocation: true
---

# /publish

Lies `docs/publish.md` ganz und geh die Schritte von oben nach unten durch (ROADMAP 6.51). Der Inhalt steht nur dort, nicht hier. In deiner Antwort hakst du jeden Schritt ab — erledigt, übersprungen mit Grund, oder offen — und nennst bei einem Befund die Quelle des Schritts. Nichts auslassen, nichts erfinden; wo `docs/publish.md` „Offen“ nennt, Julian fragen.

Gepusht wird erst, wenn Julian es in diesem Gespräch gesagt hat; der Hook `guard-push` fragt bei `main` ohnehin nach. Die Produktion wird nach dem Deploy genau einmal geprüft, nie in einer Schleife.
