/**
 * The external services and stores the project depends on (ROADMAP 6.54,
 * „Dienste"). This is the one table the Cockpit keeps itself, because the
 * facts are prose in CLAUDE.md, SPEC §7 and the roadmap, not data; each row
 * names where it is written down (`src`), and that document wins when they
 * disagree. Everything else in the view is read from files.
 */
export interface Service {
  name: string;
  kind: string;
  use: string;
  limits: string;
  code: string[];
  items: string[];
  src: string;
}

export const SERVICES: Service[] = [
  { name: 'Vercel (Hobby)', kind: 'Hosting', use: 'Projekt beautifulbooks unter beautifulcovers.vercel.app; ein Push nach origin/main ist ein Deploy.', limits: 'Hobby-Plan (E20); Logs etwa eine Stunde; Bot-Schutz antwortet 403 auf wiederholte automatische Abrufe', code: ['next.config.ts', 'app/api/rate.ts'], items: ['2.4', '2.7'], src: 'CLAUDE.md' },
  { name: 'Redis (Vercel Marketplace)', kind: 'Speicher', use: 'Stimmen des Cover-Spiels, Vorschläge der Freunde, /curate-Entwürfe, veröffentlichte Entwürfe und Schalter der Sammlungen. Preview und Produktion teilen ihn.', limits: 'ob er bleibt: E21 (Julian)', code: ['lib/hotornot/store.ts', 'lib/curate/drafts.ts', 'lib/collections-live.ts'], items: ['5.8a', '5.10a', '5.10b', '5.10g'], src: 'CLAUDE.md' },
  { name: 'Open Library', kind: 'Quelle', use: 'Suche, Ausgaben, Werke, Cover-Bilder, Listen für Sammlungen.', limits: '2–7 s je Suche, 3–10 s je Ausgabenseite; Timeouts in OL_TIMEOUTS', code: ['lib/sources/openlibrary.ts'], items: ['6.45'], src: 'CLAUDE.md, SPEC §7' },
  { name: 'Google Books', kind: 'Quelle', use: 'Genau zwei Aufrufer: Seite 0 einer Werkseite und die ISBN-Nachschau bei Auswahl.', limits: '1.000 Anfragen am Tag; Pause bis Mitternacht pazifisch bei dailyLimitExceeded', code: ['lib/sources/googlebooks.ts', 'lib/googlequota.ts', 'lib/isbn.ts'], items: ['0.2', '0.3', '0.13'], src: 'CLAUDE.md, SPEC E10' },
  { name: 'ISFDB', kind: 'Quelle (Lab)', use: 'Cover-Gestalter für SF-Sammlungen.', limits: 'nur lab/, Cache in lab/isfdb/', code: ['lab/isfdb/parse.ts'], items: ['6.50', '6.52'], src: 'ROADMAP 6.50' },
  { name: 'GitHub', kind: 'Code', use: 'heissjl/beautifulbooks; origin/main ist Produktion.', limits: 'Screenshots nie hochladen (2026-09-11)', code: [], items: [], src: 'CLAUDE.md' },
  { name: 'Händler', kind: 'Links', use: 'Nur URL-Vorlagen; kein Händler wird kontaktiert. Klicks laufen über /go.', limits: 'Hobby-Modus: Partner-IDs ignoriert', code: ['lib/buylinks.ts'], items: ['4.1'], src: 'CLAUDE.md' },
];
