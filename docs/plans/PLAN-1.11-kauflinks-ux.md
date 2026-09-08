# Plan 1.11 — Kauf-Links, die ins Leere laufen, und wie sie in die Cover-Wand passen

Stand: 2026-09-08. Roadmap-Punkt **1.11**, Auslöser: Julian am 2026-09-08 — „damit weniger Links ins Leere laufen", und danach: „das muss sinnvoll in die Cover-Wall-Seite integriert werden und darf aus einer UX-Perspektive nicht zu sehr verwirren."

Die Messungen, auf denen alles hier steht, sind in Roadmap 1.11 festgehalten (567 Ausgaben aus fünf Fixture-Werken, offline). Dieser Plan wiederholt nur die vier Zahlen, die den Entwurf tragen, und beschäftigt sich sonst mit der Spalte.

---

## 1. Warum das ein UX-Punkt ist und nicht nur ein Link-Punkt

Die vier Zahlen:

| | |
|---|---|
| Cover-Ausgaben, deren ISBN **nicht** aus dem englischen Sprachraum stammt | **76 %** (Türkei 47, Spanien 18, Italien 14, Indien 9, …) |
| Cover-Ausgaben mit **Verlag und Jahr** | 97 % |
| Cover-Ausgaben, deren **Ausgabentitel vom Werktitel abweicht** | 56 % |
| Cover-Ausgaben **ohne ISBN** | 7 % |

Voreingestellt ist der Markt **US**. Für einen Leser dort zeigt die Spalte also bei rund drei Vierteln der Cover eine Reihe Händler-Knöpfe zu einer ISBN, die in Istanbul oder Kopenhagen vergeben wurde.

**Der naive Ausweg wäre, Links hinzuzufügen** — angereicherte Titelsuchen für die Händler, denen die ISBN nichts sagt. Genau das darf nicht passieren, denn die Spalte ist heute schon zu voll. Gezählt für einen Leser im US-Markt, **eine** Ausgabe, ein Cover:

| Zone | Bedienelemente |
|---|---|
| Marktumschalter | 1 |
| „Buy this ISBN": Bookshop.org, Amazon, AbeBooks, ThriftBooks, eBay | 5 |
| „Check availability" | 1 |
| „Find this exact cover": AbeBooks, eBay, Google Lens, TinEye, WorldCat, Open Library | 6 |
| „Preview on Google Books" | 1 |
| **Summe** | **14**, dazu zwei Erklärabsätze und bis zu acht Metadatenzeilen |

Im DE-Markt sind es 15. Und das ist die Zählung für **eine** Ausgabe: trägt ein Cover nach dem Falten mehrere, wiederholt sich der ganze Apparat je Ausgabe. Das ist die Ursache der in 1.2 gemessenen 2.351 px Inhalt bei 804 px sichtbarer Höhe.

**Zwei Fehler sind beim Lesen des Codes dazugekommen**, beide reine UX:

1. **Doppelte Beschriftungen.** Im US-Markt steht **„AbeBooks" zweimal** und **„eBay" zweimal** in derselben Spalte, wenige Zeilen auseinander: einmal als ISBN-Link (`abebooks`, `ebay`), einmal als Suchlink (`abebooks-search`, `ebay-search`). Gleiches Label, verschiedene Abfrage, kein Unterschied zu sehen. Im DE-Markt betrifft es AbeBooks.
2. **Die zwei Überschriften beantworten dieselbe Frage.** „Buy this ISBN" und „Find this exact cover" zielen beide auf *dieses Exemplar*. Die Frage, die 76 % der Cover eigentlich aufwerfen — „und wenn ich das Buch einfach lesen will?" — hat in der Spalte gar keinen Ort, und deshalb wird sie stillschweigend von den Händler-Knöpfen mitbeantwortet, die dafür nicht gebaut sind.

**Die Aufgabe ist also nicht, Links zu ergänzen, sondern die Spalte auf zwei klar getrennte Fragen zu bringen und dabei kürzer zu werden.**

---

## 2. Der Entwurf: ein Block, der sagt, welche Frage er beantwortet

Ein Leser, der ein Cover anklickt, hat genau eine von zwei Absichten:

- **A — „ich will genau dieses Exemplar":** das gezeigte Cover, dieser Druck. Das ist das Versprechen der Seite.
- **B — „ich will dieses Buch lesen":** irgendeine Ausgabe. Legitim, und die einzige Absicht, aus der je Provision entsteht.

Heute vermischt die Spalte beides. Der Entwurf trennt sie sichtbar und gibt A den ganzen Platz, B eine ruhige Zeile.

```
┌──────────────────────────────────────────────┐
│  [Cover]                                     │
│  Image from Open Library · on 2 editions     │
│  Looks like this  [▪][▪][▪]                  │
│                                              │
│  Fischer Taschenbuch · 1979 · de             │  ← Kopfzeile statt <dl>
│  ISBN 978-3-596-21926-1                      │
│                                              │
│  GET THIS PRINTING                    [DE ▾] │  ← Frage A
│  [AbeBooks]  [Booklooker]  [Google Lens]     │  ← 2–3 Knöpfe, fallabhängig
│  Diese ISBN wurde im deutschen Sprachraum     │
│  vergeben. …ein Satz, der die Reihenfolge     │
│  begründet, ohne über Läden zu behaupten.     │
│                                              │
│  ▸ Other ways to find it (7)                 │  ← alles Übrige, zugeklappt
│                                              │
│  ─────────────────────────────────────────   │
│  Or read it in any edition                   │  ← Frage B, ruhig, klein
│  [Thalia] [Amazon]                           │
└──────────────────────────────────────────────┘
```

Sichtbar beim ersten Blick: **5 Bedienelemente statt 14.** Damit passt der Block in die 804 px, die 1.2 gemessen hat — dieser Plan erledigt die Hälfte von 1.2 nebenbei.

### 2.1 Die Entscheidung liegt in `lib/`, nicht in der Komponente

Eine reine Funktion, testbar, ohne Netz:

```ts
// lib/linkplan.ts
export type LinkCase = 'home' | 'foreign' | 'no-isbn';

export interface LinkPlan {
  case: LinkCase;
  /** 2–3 Knöpfe, die für diese ISBN in diesem Markt eine Chance haben. */
  lead: BuyLink[];
  /** Alles Übrige, hinter der Klappe. Nie leer, nie doppelt beschriftet. */
  rest: BuyLink[];
  /** Frage B: Titelsuche im Markt des Lesers, mit dem *Werk*titel. */
  anyEdition: BuyLink[];
  /** Ein Satz, der die Reihenfolge begründet. Behauptet nichts über Läden. */
  note: string;
}

export function linkPlan(input: {
  edition: Edition; workTitle: string; author?: string;
  market: Market; verdict: IsbnVerdict;
}): LinkPlan;
```

Die Komponente rendert nur. Das hält die Regel prüfbar und die Wortlaute an einem Ort — dieselbe Begründung wie bei `lib/verdicts.ts`, das genau deshalb entstanden ist (1.5).

### 2.2 Die drei Fälle

`registrationArea(isbn13)` liefert `en | de | fr | es | it | tr | … | kdp | unknown` aus der Registrierungsgruppe — eine Tabelle, offline, keine Anfrage.

| Fall | Wann | `lead` (US / DE) | Begründungssatz |
|---|---|---|---|
| **home** | Gruppe passt zum Markt (US: 978-0/1, DE: 978-3) | Bookshop.org, Amazon / Thalia, Amazon | heutige `VerdictNote`, unverändert |
| **foreign** | Gruppe passt nicht — **die Mehrheit** | AbeBooks, eBay, (Google Lens bei `differs`) / AbeBooks, Booklooker | „This printing's ISBN was registered in **Turkey**. The marketplaces below list second-hand and international copies; the shops in your market are under *other ways to find it*." |
| **no-isbn** | keine ISBN (7 %) | AbeBooks-Titelsuche, eBay-Titelsuche, Google Lens | heutiger Satz („This edition predates ISBNs …") |

**Der Satz im Fall `foreign` nennt nur eine Tatsache aus der ISBN und begründet damit eine Reihenfolge.** Er sagt nicht, dass ein Laden das Buch nicht hat — das wäre genau die Behauptung, die §9.2, `lib/verdicts.ts` und die Regel „ein Verdikt darf nie mehr behaupten, als geprüft wurde" verbieten. Kein Laden wird gefragt, und der Text darf nicht so klingen, als wäre einer gefragt worden.

### 2.3 Wo die angereicherte Suche landet — und wo nicht

Aus der Antwort vom 2026-09-08: Terme gehören **nicht** in den ISBN-Link, weil eine Titelsuche bei Bookshop US auf ein türkisches Cover ein Penguin-Taschenbuch antwortet. Der Link liefe dann nicht mehr ins Leere, sondern in die Irre.

Deshalb strikt nach Frage getrennt, und der Titel entscheidet sich mit:

| Zone | Frage | Titel | Weil |
|---|---|---|---|
| `lead` bei `foreign` / `no-isbn` | A | **Ausgabentitel** + Verlag + Jahr | AbeBooks und eBay sind international und antiquarisch; dort fehlt oft die ISBN, und Titel+Verlag+Jahr ist die *bessere* Abfrage. 97 % der Ausgaben tragen beide Felder |
| `anyEdition` | B | **Werktitel** | 56 % der Ausgabentitel sind Übersetzungen; „Die Enden der Parabel" bei Bookshop US ist wieder eine Null |

Und die Beschriftung folgt der Frage: unter „Or read it in any edition" heißt der Knopf `Thalia`, aber die Zone sagt vorher, dass dort **eine andere Ausgabe** wartet. Damit ist der Kauf-Link ehrlich beschriftet, ohne dass ein einziger Knopf lügt.

### 2.4 Doppelte Beschriftungen verschwinden von selbst

`linkPlan` stellt jeden Anbieter **genau einmal** zusammen — mit derjenigen Abfrage, die im vorliegenden Fall die bessere ist. AbeBooks erscheint im Fall `foreign` als Titel+Verlag+Jahr-Suche, im Fall `home` als ISBN-Suche, nie beides. Ein Test hält das fest: *kein Label kommt in `lead`, `rest` und `anyEdition` zusammen zweimal vor.*

### 2.5 Mehrere Ausgaben unter einem Cover

Nach dem Falten trägt ein Cover mehrere `editionIds`, und heute wiederholt sich der ganze Apparat je Ausgabe. Neu:

- **Eine** Ausgabe ist aufgeklappt — die nach Hebel 2 sortierte erste (ISBN im Sprachraum des Marktes zuerst, dann ISBN überhaupt, dann Jahr absteigend), statt wie heute die zufällig jüngste Open-Library-Datensatz-Reihenfolge.
- Die übrigen stehen als **einzeilige Knöpfe**: `Penguin · 2004 · 9780141036144`, die beim Aufklappen ihren eigenen Block zeigen. Immer nur einer offen.

### 2.6 Metadaten schrumpfen

Die `<dl>` mit bis zu acht Zeilen wird zur **Kopfzeile** `Verlag · Jahr · Sprache` plus ISBN in Monospace darunter; Format, Seitenzahl, Titel und „Also printed with" wandern in dieselbe Klappe wie die übrigen Links (`▸ Details`). Der Titel steht nur dann in der Kopfzeile, wenn er vom Werktitel abweicht — das ist bei 56 % der Fall und dort auch interessant.

---

## 3. Telefon

Die Schublade (`CoverSheet.tsx`) bekommt denselben Block. Weil er auf 5 Elemente schrumpft, ist die erste Handlung **ohne Scrollen** erreichbar — der Teil von 1.2, den die Peek-Leiste heute nicht löst. Die Klappen bleiben zu; auf 375 px ist das der Unterschied zwischen einer Schublade und einer zweiten Seite.

---

## 4. Was das an anderen Stellen auslöst

- **About-Seite.** Dort steht: „The order of the shops is not sorted by what they pay." Das bleibt wahr und muss trotzdem ergänzt werden, weil es künftig *eine* Sortierung gibt: nach dem Sprachraum der ISBN. Genau der Fall, den 1.2 als vertretbar benannt hat — eine Ordnung, die dem Leser nachweisbar nützt. Ein Satz, im selben Abschnitt, in dem die Verdikte erklärt werden.
- **1.2** (Kauf-Links nicht auffindbar) wird zur Hälfte hiervon erledigt; was bleibt, ist die Deckelung der Cover-Höhe. Die beiden Punkte gehören in dieselbe Sitzung.
- **1.1** (keine Vorauswahl) berührt denselben Code, und Hebel 2 ist genau die Sortierung, die dort fehlt. Reihenfolge: **1.11 vor 1.1**, sonst wird die Sortierung zweimal gebaut.
- **0.1** (Verfügbarkeits-Button): der Knopf sitzt mitten in diesem Block. Fällt die Entscheidung auf Entfernen, verschwindet er hier; bis dahin steht er hinter der Klappe, nicht in der ersten Reihe.
- **`kind: 'product'`** (Hebel 3 aus 1.11) heißt heute nur „diese URL hat die Form einer Produktseite". Im Fall `foreign` darf der Chip nicht `product` sagen. Entweder an den Fall koppeln oder das Wort in der Oberfläche zurücknehmen.

---

## 5. Umsetzung in Schritten

| # | Was | Dateien | Test |
|---|---|---|---|
| 1 | `registrationArea(isbn13)`, Tabelle der Registrierungsgruppen | `lib/normalize.ts` | Einheitstest über die Gruppen aus der Messung, inkl. 979-8 und unbekannt |
| 2 | `linkPlan()` mit den drei Fällen | `lib/linkplan.ts` (neu) | drei Fälle × zwei Märkte; **kein Label doppelt**; `anyEdition` benutzt den Werktitel |
| 3 | Titelsuchen für die Katalog-Händler ergänzen (Bookshop, ThriftBooks, Thalia, Hugendubel, Booklooker) | `lib/buylinks.ts` | URL-Form je Händler |
| 4 | Ausgaben-Sortierung unter einem Cover (Hebel 2) | `lib/works.ts` oder `lib/pages.ts` | fremde vor heimischer ISBN kehrt sich mit dem Markt um |
| 5 | Der Block in der Spalte, Klappen, Kopfzeile | `components/BookDetail.tsx` | — |
| 6 | Schublade | `components/CoverSheet.tsx` | — |
| 7 | About-Satz | `app/about/page.tsx` | der bestehende Test, der „all/every/complete" verbietet, bleibt grün |

Schritte 1–4 sind reine Logik mit Tests und können vor jeder Gestaltungsentscheidung fertig werden.

---

## 6. Abnahme

- Die fünf Akzeptanz-Queries aus SPEC §3 F1, im Browser.
- **Gemessen wie in 1.2:** Höhe des Spalteninhalts bei 1440 × 900 auf *Beloved* (heute 2.351 px) und *Wolf Hall* (heute 1.256 px), und der Abstand des ersten Kauf-Knopfes vom Fensterrand (heute 437 px bzw. 151 px **unter** der Kante). Ziel: erster Knopf sichtbar, ohne zu scrollen. Zahlen vorher/nachher in `docs/history.md`.
- Ein türkisches, ein deutsches und ein englisches Cover desselben Werks im US-Markt durchklicken und die drei Fälle sehen.
- **Julians Stichprobe aus 1.11** (zehn Minuten, mit 1.8): führen Bookshop.org und ThriftBooks eine türkische ISBN? Was zeigt Amazons `/dp/` bei einer nie geführten ISBN? Und findet ein Suchfeld etwas bei `ISBN + Titelwörtern` zusammen, oder null? Fällt das anders aus als angenommen, ändert sich die Zuordnung in 2.2, nicht der Aufbau.

---

## 7. Was Julian entscheiden muss, bevor gebaut wird

1. **Gibt es die Zone „Or read it in any edition" überhaupt?** Sie ist ehrlich und sie ist die einzige, aus der je Provision entsteht — aber sie schickt einen Leser zu einer *anderen* Ausgabe als der, deren Cover ihm gefallen hat. Das ist eine Produktentscheidung, keine Gestaltungsfrage. *(Vorschlag: ja, aber klein, unter einer Trennlinie, und mit dem Wort „another".)*
2. **Klappe zu oder offen beim ersten Besuch?** *(Vorschlag: zu. Wer mehr will, klappt auf; die Zahl in der Zeile sagt, wie viel dahinter liegt.)*
3. **Der Verfügbarkeits-Button** — das ist 0.1, und dieser Plan wartet nicht darauf, sondern setzt ihn hinter die Klappe.
