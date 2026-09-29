/**
 * Can the story of each sleeve be written while a reader waits? (ROADMAP 5.16;
 * Julian, 2026-09-29: „mach mal einen mockup mit den wikipedia-daten und miss
 * wie lange die ad-hoc erstellung dafür dauert, also ob man das live in einer
 * suche benutzen könnte".)
 *
 *   set -a; source <main folder>/.env.local; set +a   # ANTHROPIC_API_KEY, for this command only
 *   npx tsx lab/vinyl/live-story.ts [rounds]
 *
 * Per album, cold: Wikipedia's artwork text (`wiki.ts`, timed per step), then
 * one Claude call that turns it and our own material per sleeve — timeline,
 * credits, Discogs notes from `out/story.json` — into one caption per sleeve
 * and a short story of the album's sleeve, each tagged with the sources it
 * used. Streams, and records the time to the first token and to the end.
 * Writes `out/live-story.json`; `mockup.ts` puts the last round into the page.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { artworkFromWikipedia, type WikiArtwork } from './wiki';

const DIR = import.meta.dirname;
const MODEL = 'claude-opus-5-5';
const ROUNDS = Number(process.argv[2] ?? 2);

interface Sleeve { pressings: number; first: string; last: string; countries: string[]; labels: string[]; mbCredits: string[]; discogsCredits: string[]; notes: string[] }
interface StoryAlbum { album: string; albumCredits: string[]; sleeves: Sleeve[] }
interface Pressing { id: string; date: string; front: string | null; hash: string | null }
interface Album { id: string; title: string; artist: string; pressings: Pressing[] }

const SYSTEM = `You write the captions of a website that shows every known sleeve of a vinyl album as a wall of tiles, one tile per sleeve design.

Use only the material in the request. Do not add facts from your own knowledge, even when you are sure of them: every sentence must be supported by the material, and the "sources" of each item must name what supports it (wikipedia, timeline, credits, notes).

- "album": two or three sentences, at most 70 words, on the original sleeve — who made it and how it came about. Only from the Wikipedia text; if there is none, say only what the credits give, and use an empty text if they give nothing.
- "sleeves": one item per sleeve id, in the order given, one or two sentences, at most 40 words. Say what this sleeve is and what sets it apart, from its timeline, credits and notes. Production details from the notes (printers, stickers, catalogue numbers) only when they are what sets the sleeve apart. When the material is only the timeline, say the timeline plainly.
- Never call a pressing "first", "original" or "rare" unless the material says so. Never claim that the list of pressings or countries is complete.
- Plain English, no marketing tone.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['album', 'sleeves'],
  properties: {
    album: {
      type: 'object', additionalProperties: false, required: ['text', 'sources'],
      properties: { text: { type: 'string' }, sources: { type: 'array', items: { type: 'string', enum: ['wikipedia', 'credits'] } } },
    },
    sleeves: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'text', 'sources'],
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          sources: { type: 'array', items: { type: 'string', enum: ['wikipedia', 'timeline', 'credits', 'notes'] } },
        },
      },
    },
  },
} as const;

function material(album: Album, story: StoryAlbum, wiki: WikiArtwork): string {
  const lines = [`Album: ${album.title} — ${album.artist}`, ''];
  lines.push(wiki.sections.length
    ? `Wikipedia (${wiki.article}):\n${wiki.sections.map(s => `## ${s.heading}\n${s.text}`).join('\n\n')}`
    : 'Wikipedia: no text about the sleeve.');
  lines.push('', 'Sleeves:');
  story.sleeves.forEach((s, i) => {
    lines.push(`- id S${i + 1}: ${s.first}${s.last !== s.first ? `–${s.last}` : ''}, ${s.pressings} pressing${s.pressings > 1 ? 's' : ''} with a photo, countries ${s.countries.join(', ') || 'unknown'}, labels ${s.labels.join(', ') || 'unknown'}`);
    const credits = [...new Set([...s.mbCredits, ...s.discogsCredits])].filter(c => !/notes/i.test(c));
    if (credits.length) lines.push(`  credits: ${credits.join('; ')}`);
    for (const n of s.notes.slice(0, 3)) lines.push(`  note: ${n}`);
  });
  return lines.join('\n');
}

async function main() {
  const client = new Anthropic();
  const html = readFileSync(join(DIR, 'out', 'mockup.html'), 'utf8');
  const albums = JSON.parse(html.match(/const DATA = (\[[\s\S]*?\]);\n/)![1]) as Album[];
  const stories = JSON.parse(readFileSync(join(DIR, 'out', 'story.json'), 'utf8')) as StoryAlbum[];
  const runs = [];
  for (let round = 1; round <= ROUNDS; round++) {
    for (const album of albums) {
      const story = stories.find(s => s.album === album.title)!;
      const t0 = performance.now();
      const wiki = await artworkFromWikipedia(album.id);
      const tWiki = performance.now() - t0;
      const t1 = performance.now();
      let firstToken = 0;
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        // Refusals re-run on Anthropic's recommended fallback model instead of returning nothing.
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: material(album, story, wiki) }],
      });
      stream.on('text', () => { if (!firstToken) firstToken = performance.now() - t1; });
      const message = await stream.finalMessage();
      const tLlm = performance.now() - t1;
      const text = message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { /* recorded as null */ }
      const run = {
        round, album: album.title, article: wiki.article, url: wiki.url, wikiChars: wiki.sections.reduce((n, s) => n + s.text.length, 0),
        wikiMs: Math.round(tWiki), wikiSteps: wiki.ms, firstTokenMs: Math.round(firstToken), llmMs: Math.round(tLlm), totalMs: Math.round(tWiki + tLlm),
        stop: message.stop_reason, model: message.model, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens,
        story: parsed,
      };
      runs.push(run);
      console.log(`${round} ${album.title.padEnd(26)} wiki ${String(run.wikiMs).padStart(5)} ms · first token ${String(run.firstTokenMs).padStart(5)} ms · llm ${String(run.llmMs).padStart(5)} ms · total ${String(run.totalMs).padStart(5)} ms · ${run.inputTokens}→${run.outputTokens} tok · ${run.stop}${parsed ? '' : ' · JSON FAILED'}`);
      writeFileSync(join(DIR, 'out', 'live-story.json'), JSON.stringify(runs, null, 1));
      await new Promise(r => setTimeout(r, 1100)); // MusicBrainz: one request a second
    }
  }
}

main().catch(e => {
  if (e instanceof Anthropic.AuthenticationError) console.error('No valid ANTHROPIC_API_KEY in the environment.');
  else console.error(e);
  process.exit(1);
});
