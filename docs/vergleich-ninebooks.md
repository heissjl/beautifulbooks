# Nine Books + Albums (thestalwart.com/ninebooks) — lässt es sich in /shelfportrait und /create einbauen?

Angesehen am 2026-10-09 auf Julians Frage („can we integrate this into our /create and /shelfportrait sections? for
people to automatically upload the scans into his database?"), ROADMAP 5.18c. Quellen: Joe Weisenthals Beitrag vom
2026-10-09, das Repository `github.com/jnathan9/ninebooks` (MIT, Daten CC0), sein `src/worker.js` und `wrangler.toml`.

## Was es ist

Ein Foto von neun Lieblingsbüchern oder -alben hochladen, Claude Haiku 4.5 erkennt Titel und Autor je Platz, der
Mensch prüft jeden Eintrag, willigt in CC0 ein (anonym oder mit Namen) und veröffentlicht. Die Liste ist die Einheit:
neun Titel, ihre Positionen im Bild, Kategorie, eine öffentliche Mitwirkenden-ID. Lesen ist offen
(`https://ninebooks-api.pages.dev/api/…`, CORS für GET erlaubt, stündlicher Export auf GitHub). Stand 2026-10-09:
24 Listen, 130 Bücher, 79 Alben, 19 Mitwirkende.

## Warum ein automatisches Hochladen von uns aus nicht geht

- **Schreiben nur von seiner Seite:** jeder POST braucht den `Origin` `https://thestalwart.com` (`ALLOWED_ORIGINS`),
  sonst 403 „Please submit from the Nine Books website."
- **Veröffentlichen nur nach seiner Erkennung:** `POST /api/lists` verlangt ein signiertes Token aus `POST /api/analyze`,
  also aus *seinem* Modellaufruf auf *seinem* Bild; ein fertige Liste ohne Bild nimmt er nicht.
- **Seine Quoten:** 5 Versuche je IP und Stunde, 200 am Tag insgesamt. Ein Strom von uns würde sie aufbrauchen.
- Den `Origin` vom Server aus zu fälschen hieße seinen Schutz zu umgehen — kommt nicht in Frage.

## Was geht

1. **Ein Link, sofort:** nach einem fertigen Shelf-Portrait (genau neun Bücher, sein Format) ein Satz „Add your nine
   to the open Nine Books database" auf `thestalwart.com/ninebooks/`. Der Leser lädt dort selbst sein Bild hoch. Wir
   senden nichts, die Datenschutzerklärung bleibt, wie sie ist. Auf `/create` passt es schlechter (eine Sammlung hat
   beliebig viele Bücher), höchstens bei einer Sammlung mit genau neun.
2. **Mit ihm, später:** ihn fragen, ob er unseren Origin zulässt und einen Weg für eine schon geprüfte Liste ohne Bild
   öffnet (Titel, Autor, Open-Library-Werk-ID, Reihenfolge). Dann könnte ein Leser mit einem Klick und eigener
   CC0-Einwilligung übertragen. Das ist eine Übermittlung an einen Dritten: neuer Satz in der Datenschutzerklärung
   (englisch und deutsch), `docs/recht-hobbyseite.md` §4, Julian gibt den Satz frei (CLAUDE.md, Analytik-Regel 6).
3. **Lesen, ohne zu fragen:** seine Daten sind CC0 — „Leute mit diesem Buch unter ihren neun mögen auch …" ginge aus
   dem Export, offline gebaut, ohne Laufzeitaufruf. Mit 24 Listen noch zu dünn.

**Empfehlung:** (1) jetzt, wenn Julian will; (2) erst, wenn Julian ihn anschreiben möchte — eine Nachricht in Julians
Namen schicke ich nicht.
