/**
 * 5.10i, step 1: ISBNs of translations from national libraries, for the
 * works of the international wall that Open Library alone could not fill.
 *
 *   npx tsx lab/international-covers/discover.ts            # all open works
 *   npx tsx lab/international-covers/discover.ts 50 139     # only these orders
 *
 * For each work: the German National Library by original title and surname
 * (its records carry the original title, so an unknown German title is
 * found too), and by any German title known; the BnF by every French title
 * known and by the English title. Then ISFDB's REST record and Open
 * Library's /isbn/ for every printed ISBN found, and whether the DNB cover
 * service has an image. Writes `discovered.json`. A source that fails is
 * listed under `failed`, never read as "no translation".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bnf, dnb, isfdb, ol, probeImage, SourceFailed } from './lookup';

interface Book { order: number; id: string; title: string; author: string; en: string[]; surname: string }
interface Searched { order: number; searched: { lang: string; title: string }[] }

const dir = import.meta.dirname;
const list: { order: number; id: string; title: string; author: string; status: string }[] =
  JSON.parse(readFileSync(join(dir, '..', 'collections', 'lists', 'sf-relaunch-international.json'), 'utf8'));
const known: Searched[] = JSON.parse(readFileSync(join(dir, 'translated-titles.json'), 'utf8'));

/** The English title(s) to search by, where the list's title carries series noise or an OL error. */
const EN: Record<number, { en?: string[]; surname?: string }> = {
  25: { en: ['Arslan'] },
  64: { en: ['The Continuous Katherine Mortenhoe', 'The Unsleeping Eye'] },
  68: { en: ['The Caltraps of Time'] },
  78: { en: ['This Is the Way the World Ends'] },
  81: { en: ['Time Is the Fire', 'The Best of Connie Willis'] },
  88: { en: ['Transfigurations'] },
  95: { en: ['The Shrinking Man'], surname: 'Matheson' },
  97: { surname: 'Tiptree' },
  101: { en: ['Mission of Gravity'] },
  109: { surname: 'Miller' },
  124: { en: ['The Sword of the Lictor', 'The Citadel of the Autarch', 'Sword and Citadel'] },
  138: { surname: "O'Neill" },
  140: { en: ['Dreaming in Smoke'] },
  142: { en: ['The Best of R. A. Lafferty'] },
  165: { en: ['The Secret of Life'] },
  171: { en: ['First Born', 'Gor Saga'] },
  175: { en: ['Beginning Operations', 'Hospital Station', 'Star Surgeon', 'Major Operation'] },
  179: { en: ['Thirteen', 'Black Man'] },
  181: { en: ['Alien Emergencies', 'Ambulance Ship', 'Sector General', 'Star Healer'] },
};

function books(only: number[]): Book[] {
  return list
    .filter(w => w.status !== 'found' && (only.length === 0 || only.includes(w.order)))
    .map(w => {
      const o = EN[w.order] ?? {};
      const surname = o.surname ?? w.author.replace(/,? Jr\.?$/, '').trim().split(' ').pop()!;
      return { order: w.order, id: w.id, title: w.title, author: w.author, en: o.en ?? [w.title], surname };
    });
}

const isbn13 = (s: string) => s.replace(/[^0-9Xx]/g, '');

async function main() {
  const only = process.argv.slice(2).map(Number);
  const outFile = join(dir, 'discovered.json');
  const out: Record<string, unknown> = (() => { try { return JSON.parse(readFileSync(outFile, 'utf8')); } catch { return {}; } })();
  for (const b of books(only)) {
    const failed: string[] = [];
    const candidates: Record<string, { isbn: string; lang: string; title: string; publisher: string; year: string; source: string; form?: string }> = {};
    const titles = known.find(k => k.order === b.order)?.searched ?? [];
    const dnbQueries = [...b.en.map(t => `tit="${t}" and per=${b.surname}`), ...titles.filter(t => t.lang === 'ger').map(t => `tit="${t.title}" and per=${b.surname}`)];
    for (const q of dnbQueries) {
      try {
        const r = await dnb(q);
        for (const rec of r.records) {
          if (rec.form === 'cr') continue; // e-book
          const i = rec.isbn.map(isbn13).find(x => x.length === 13) ?? rec.isbn.map(isbn13)[0];
          if (!i) continue;
          candidates[i] = { isbn: i, lang: rec.lang[0] ?? '?', title: rec.title, publisher: rec.publisher[0] ?? '', year: rec.year[0] ?? '', source: `dnb:${rec.id}`, form: rec.form };
        }
      } catch (e) { failed.push(`dnb ${q}: ${e instanceof SourceFailed ? e.message : e}`); }
    }
    const bnfQueries = [...titles.filter(t => t.lang === 'fre').map(t => t.title), ...b.en].map(t => `bib.title all "${t}" and bib.author all "${b.surname}"`);
    for (const q of bnfQueries) {
      try {
        const r = await bnf(q);
        for (const rec of r.records) {
          const i = rec.id.map(x => x.match(/ISBN\s*([0-9Xx-]+)/)?.[1]).filter(Boolean).map(x => isbn13(x!))[0];
          if (!i) continue;
          if (rec.lang.some(l => l === 'eng')) continue;
          candidates[i] = { isbn: i, lang: rec.lang[0] ?? '?', title: rec.title[0] ?? '', publisher: rec.publisher[0] ?? '', year: rec.date[0] ?? '', source: 'bnf' };
        }
      } catch (e) { failed.push(`bnf ${q}: ${e instanceof SourceFailed ? e.message : e}`); }
    }
    const checked = [];
    for (const c of Object.values(candidates)) {
      const row: Record<string, unknown> = { ...c };
      try {
        const r = await isfdb(c.isbn);
        row.isfdb = r.publications.map(p => ({ record: p.record, title: p.title, year: p.year, publisher: p.publisher, artists: p.artists, image: p.image }));
      } catch (e) { failed.push(`isfdb ${c.isbn}: ${e}`); }
      try {
        const r = await ol(c.isbn);
        row.ol = r.edition ? { edition: r.edition, works: r.works, covers: r.covers ?? [] } : null;
      } catch (e) { failed.push(`ol ${c.isbn}: ${e}`); }
      if (c.isbn.startsWith('9783') || c.isbn.startsWith('3')) {
        try {
          const r = await probeImage(`https://portal.dnb.de/opac/mvb/cover?isbn=${c.isbn}`);
          row.dnbCover = r.status === 200 && r.type.startsWith('image/') ? r.bytes : false;
        } catch (e) { failed.push(`dnb cover ${c.isbn}: ${e}`); }
      }
      checked.push(row);
    }
    out[b.order] = { ...b, dnbQueries, bnfQueries, candidates: checked, failed };
    writeFileSync(outFile, JSON.stringify(out, null, 1));
    console.log(b.order, b.title, '—', checked.length, 'ISBNs', failed.length ? `(${failed.length} failed)` : '');
  }
}

main();
