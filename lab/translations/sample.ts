/**
 * ROADMAP 6.15 step 3: how often does a translation show as a card of its own?
 *
 * Asks the search route for a fixed list of queries, one at a time with a
 * pause, and writes what came back to `out/<slug>.json`. It stops at the first
 * answer that is not 200 (docs/umgang.md §1: a catalogue that is asked too
 * much shuts the door). The cards are then labelled by hand in `labels.json`
 * (work id → same | about | other), and `--report` counts.
 *
 *   npx tsx lab/translations/sample.ts [--base https://buyitscovers.com] [--pause 7000]
 *   npx tsx lab/translations/sample.ts --report
 *
 * The base defaults to the live site because the Mac's own address may be
 * shut out of Open Library (umgang §1, "Ausweg während einer Sperre"); the
 * search route is the same code. The routes are CDN-cached, so a repeat costs
 * nothing.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = __dirname;
export const QUERIES = [
  'ansichten böll', 'der prozess kafka', 'die verwandlung kafka', 'der steppenwolf hesse',
  'siddhartha hesse', 'crime and punishment dostoevsky', 'anna karenina tolstoy', 'war and peace tolstoy',
  'madame bovary flaubert', 'the stranger camus', 'the plague camus', 'cien años de soledad garcía márquez',
  'one hundred years of solitude', 'the little prince saint-exupéry', 'the name of the rose eco',
  'the master and margarita bulgakov', 'the trial kafka', 'the metamorphosis kafka',
];

interface Card {
  id: string; title: string; authors: string[]; authorKeys?: string[];
  firstPublishYear?: number; editionCount?: number; languages?: string[];
}
const slug = (q: string) => q.normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };

async function collect() {
  const base = arg('--base', 'https://buyitscovers.com');
  const pause = Number(arg('--pause', '7000'));
  mkdirSync(join(DIR, 'out'), { recursive: true });
  for (const q of QUERIES) {
    const file = join(DIR, 'out', slug(q) + '.json');
    if (existsSync(file)) continue;
    const res = await fetch(`${base}/api/search?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(60_000) });
    if (res.status !== 200) { console.error(`${q}: ${res.status}, stopping`); process.exit(1); }
    const body = await res.json();
    writeFileSync(file, JSON.stringify(body.works, null, 1));
    console.log(`${q}: ${body.works.length} cards`);
    await new Promise((r) => setTimeout(r, pause));
  }
}

/** Language of the book as first written; decides what a card in another language is. */
const ORIGINAL: Record<string, string> = {
  'ansichten böll': 'de', 'der prozess kafka': 'de', 'die verwandlung kafka': 'de', 'der steppenwolf hesse': 'de',
  'siddhartha hesse': 'de', 'crime and punishment dostoevsky': 'ru', 'anna karenina tolstoy': 'ru',
  'war and peace tolstoy': 'ru', 'madame bovary flaubert': 'fr', 'the stranger camus': 'fr', 'the plague camus': 'fr',
  'cien años de soledad garcía márquez': 'es', 'one hundred years of solitude': 'es',
  'the little prince saint-exupéry': 'fr', 'the name of the rose eco': 'it', 'the master and margarita bulgakov': 'ru',
  'the trial kafka': 'de', 'the metamorphosis kafka': 'de',
};

function report() {
  // labels.json: query slug → work id → same | about | other (a person's reading of the card)
  const labels: Record<string, Record<string, 'same' | 'about' | 'other'>> = JSON.parse(readFileSync(join(DIR, 'labels.json'), 'utf8'));
  const t = { queries: 0, cards: 0, same: 0, about: 0, other: 0, unlabelled: 0, queriesSplit: 0, surplus: 0, translationCards: 0, sameLanguageCards: 0, noLanguageCards: 0 };
  const rows: string[] = [];
  for (const q of QUERIES) {
    const file = join(DIR, 'out', slug(q) + '.json');
    if (!existsSync(file)) continue;
    const works: Card[] = JSON.parse(readFileSync(file, 'utf8'));
    const l = labels[slug(q)] ?? {};
    t.queries++; t.cards += works.length;
    const same = works.filter((w) => l[w.id] === 'same');
    for (const w of works) { const x = l[w.id]; if (x === 'same') t.same++; else if (x === 'about') t.about++; else if (x === 'other') t.other++; else t.unlabelled++; }
    if (same.length > 1) { t.queriesSplit++; t.surplus += same.length - 1; }
    // the card with most editions is the book's own; every other card of it is a surplus
    const lead = [...same].sort((a, b) => (b.editionCount ?? 0) - (a.editionCount ?? 0))[0];
    let tr = 0, sl = 0, nl = 0;
    for (const w of same) {
      if (w === lead) continue;
      const langs = w.languages ?? [];
      if (!langs.length) nl++; else if (langs.includes(ORIGINAL[q])) sl++; else tr++;
    }
    t.translationCards += tr; t.sameLanguageCards += sl; t.noLanguageCards += nl;
    rows.push(`| ${q} | ${works.length} | ${same.length} | ${tr} | ${sl} | ${nl} |`);
  }
  console.log('| query | cards | cards of the book | translation cards | same-language | no language |\n|---|---|---|---|---|---|\n' + rows.join('\n'));
  console.log(t);
}

if (process.argv.includes('--report')) report(); else collect();
