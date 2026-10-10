/**
 * ROADMAP 6.102, step 1: 200 covers from the built index, one per work, each described by a model in a fixed
 * form (three haikus about the look, never the book). Answers are cached in ../bb-lab-cache/haiku/desc/, so a
 * second run asks nothing. Writes lab/haiku/out/sample.json with descriptions, 6.10 neighbours and the cost.
 *
 *   set -a; source .env.local; set +a; npx tsx lab/haiku/describe.ts [count]
 */
import Anthropic from '@anthropic-ai/sdk';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverUrlFor, similarTo } from '../../lib/coverindex';
import { costUsd } from '../../lib/insights/prices';
import { sampleOnePerWork } from './rank';

const MODEL = 'claude-haiku-4-5';
const CACHE = join(process.cwd(), '..', 'bb-lab-cache', 'haiku', 'desc');
const OUT = join(process.cwd(), 'lab', 'haiku', 'out');

export const PROMPT = `This is a book cover. Write exactly three haikus (5-7-5) about how it LOOKS and FEELS as a designed object:
1. the image or motif, 2. colour and light, 3. typography and the era or mood it evokes.
Never name the book, the author, characters or the plot, and never quote text from the cover — describe it as if you could not read.
Answer with the three haikus only, separated by blank lines.`;

const count = Number(process.argv[2] ?? 200);
const index = JSON.parse(readFileSync('data/cover-index.json', 'utf8'));
const sample = sampleOnePerWork(index.works, index.covers, count);
mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const client = new Anthropic();
let input = 0, output = 0, asked = 0, failed = 0;

async function describe(coverId: string): Promise<string | null> {
  const file = join(CACHE, coverId.replace(':', '_') + '.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).text;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'url', url: coverUrlFor(coverId, 'M') ?? '' } },
        { type: 'text', text: PROMPT },
      ] }],
    });
    const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    input += msg.usage.input_tokens; output += msg.usage.output_tokens; asked++;
    writeFileSync(file, JSON.stringify({ coverId, model: MODEL, text, usage: msg.usage }));
    return text;
  } catch (e) {
    failed++;
    console.error(coverId, (e as Error).message.slice(0, 120));
    return null;
  }
}

const results: Array<{ coverId: string; workId: string; title: string; author: string; url: string; text: string | null; similar: Array<{ coverId: string; title: string; url: string }> }> = [];
async function main(): Promise<void> {
const queue = [...sample];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let c = queue.shift(); c; c = queue.shift()) {
    const text = await describe(c.coverId);
    results.push({
      ...c, url: coverUrlFor(c.coverId, 'M') ?? '', text,
      similar: similarTo(c.coverId, 5).map((s) => ({ coverId: s.coverId, title: s.title, url: s.url })),
    });
    if (results.length % 20 === 0) console.log(results.length, '/', sample.length);
  }
}));

results.sort((a, b) => sample.findIndex((s) => s.coverId === a.coverId) - sample.findIndex((s) => s.coverId === b.coverId));
const usd = costUsd(MODEL, input, output);
writeFileSync(join(OUT, 'sample.json'), JSON.stringify({ model: MODEL, prompt: PROMPT, asked, failed, input, output, usd, covers: results }, null, 1));
console.log({ asked, failed, input, output, usd });
}

main();
