/**
 * The sleeve's story without a language model (ROADMAP 5.16; Julian,
 * 2026-09-29: „ist es einfacher nur den text aus wikipedia zu finden und
 * darzustellen, statt zusammenzufassen?"): Wikipedia's artwork text shown as
 * an excerpt with its licence, and one set line plus at most one quoted
 * Discogs note per sleeve (`captions.ts`).
 *
 *   npx tsx lab/vinyl/wiki-only.ts [rounds]      (after story.ts)
 *
 * Times the lookup twice per album: from the MusicBrainz release group, as
 * live-story.ts did, and from a Wikidata id the site would already store.
 * Writes `out/wiki-only.json`; `mockup.ts` puts it into the page.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { distinguishingNote, sleeveLine, type SleeveFacts } from './captions';
import { artworkFromWikidata, artworkFromWikipedia, excerpt } from './wiki';

const DIR = import.meta.dirname;
const ROUNDS = Number(process.argv[2] ?? 2);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Album { id: string; title: string }
interface StoryAlbum { album: string; sleeves: Array<SleeveFacts & { ids: string[] }> }

async function main() {
  const html = readFileSync(join(DIR, 'out', 'mockup.html'), 'utf8');
  const albums = JSON.parse(html.match(/const DATA = (\[[\s\S]*?\]);\n/)![1]) as Album[];
  const stories = JSON.parse(readFileSync(join(DIR, 'out', 'story.json'), 'utf8')) as StoryAlbum[];
  const cache = JSON.parse(readFileSync(join(DIR, 'cache.json'), 'utf8')) as Record<string, { relations?: Array<{ type: string; url: { resource: string } }> }>;
  const out = [];
  for (let round = 1; round <= ROUNDS; round++) {
    for (const album of albums) {
      let t = performance.now();
      const viaMb = await artworkFromWikipedia(album.id);
      const mbMs = Math.round(performance.now() - t);
      await sleep(1100); // MusicBrainz: one request a second
      const qid = cache[`https://musicbrainz.org/ws/2/release-group/${album.id}?inc=url-rels&fmt=json`]?.relations
        ?.find(r => r.type === 'wikidata')?.url.resource.match(/Q\d+/)?.[0];
      t = performance.now();
      const viaQid = qid ? await artworkFromWikidata(qid) : null;
      const qidMs = viaQid ? Math.round(performance.now() - t) : null;
      t = performance.now();
      const text = viaMb.sections.map(s => s.text).join('\n\n');
      const sleeves = (stories.find(s => s.album === album.title)?.sleeves ?? []).map(s => ({ ids: s.ids, line: sleeveLine(s), note: distinguishingNote(s.notes) }));
      const setMs = Math.round((performance.now() - t) * 10) / 10;
      out.push({
        round, album: album.title, qid, article: viaMb.article, url: viaMb.url, headings: viaMb.sections.map(s => s.heading),
        chars: text.length, excerpt: excerpt(text), fromMusicBrainzMs: mbMs, fromWikidataMs: qidMs, steps: viaMb.ms, setMs, sleeves,
      });
      console.log(`${round} ${album.title.padEnd(26)} via MusicBrainz ${String(mbMs).padStart(5)} ms · via stored Wikidata id ${String(qidMs).padStart(5)} ms · captions ${setMs} ms · ${text.length} chars → excerpt ${excerpt(text).length}`);
      writeFileSync(join(DIR, 'out', 'wiki-only.json'), JSON.stringify(out, null, 1));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
