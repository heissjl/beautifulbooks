/**
 * CLIP on this machine: fetch a cover once, embed it once, keep both under
 * lab/clip/out/ (git-ignored). Everything slow or networked lives here; the
 * arithmetic is in score.ts.
 *
 * Model: Xenova/clip-vit-base-patch32 through @huggingface/transformers 3.x,
 * pinned below 4 because 4.x ships an onnxruntime built for macOS 14 and this
 * Mac runs 13.4 (dlopen fails on a libc++ symbol).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from '@huggingface/transformers';
import { fromBase64, toBase64 } from './score';

export const MODEL = 'Xenova/clip-vit-base-patch32';
export const OUT = join(__dirname, 'out');
const IMAGES = join(OUT, 'img');
const VECTORS = join(OUT, `vectors-${MODEL.replace(/\W+/g, '_')}.json`);

mkdirSync(IMAGES, { recursive: true });
env.cacheDir = join(OUT, 'models');

/** The M image of an Open Library cover id ("ol:6352405"), fetched once. Null when there is none. */
export async function coverImage(id: string): Promise<Buffer | null> {
  const num = id.replace(/^ol:/, '');
  const file = join(IMAGES, `${num}.jpg`);
  const missing = `${file}.missing`;
  if (existsSync(file)) return readFileSync(file);
  if (existsSync(missing)) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://covers.openlibrary.org/b/id/${num}-M.jpg?default=false`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 404) {
        writeFileSync(missing, '');
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, buf);
      return buf;
    } catch {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null; // a failure, not a finding: not written as missing, so the next run asks again
}

let models: Promise<{
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
  vision: Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>>;
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
  text: Awaited<ReturnType<typeof CLIPTextModelWithProjection.from_pretrained>>;
}> | null = null;

function load() {
  models ??= (async () => ({
    processor: await AutoProcessor.from_pretrained(MODEL, {}),
    vision: await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'fp32' }),
    tokenizer: await AutoTokenizer.from_pretrained(MODEL),
    text: await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'fp32' }),
  }))();
  return models;
}

function readVectors(): Record<string, string | null> {
  return existsSync(VECTORS) ? JSON.parse(readFileSync(VECTORS, 'utf8')) : {};
}

/**
 * Image vectors for cover ids, from the cache where possible. A cover without
 * an image maps to null; one that failed to download is left out, so it is
 * tried again on the next run.
 */
export async function embedCovers(ids: readonly string[], concurrency = 6): Promise<Map<string, Float32Array | null>> {
  const cache = readVectors();
  const todo = ids.filter((id) => !(id in cache));
  const { processor, vision } = await load();
  let done = 0;
  let next = 0;
  const started = Date.now();
  const worker = async () => {
    while (next < todo.length) {
      const id = todo[next++];
      const buf = await coverImage(id);
      if (buf === null) {
        if (existsSync(join(IMAGES, `${id.replace(/^ol:/, '')}.jpg.missing`))) cache[id] = null;
      } else {
        try {
          const image = await RawImage.fromBlob(new Blob([new Uint8Array(buf)]));
          const { image_embeds } = await vision(await processor(image));
          cache[id] = toBase64(new Float32Array(image_embeds.data as Float32Array));
        } catch {
          cache[id] = null; // undecodable, e.g. a GIF placeholder
        }
      }
      if (++done % 100 === 0) {
        writeFileSync(VECTORS, JSON.stringify(cache));
        process.stderr.write(`  ${done}/${todo.length} embedded, ${Math.round((Date.now() - started) / 1000)} s\n`);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  writeFileSync(VECTORS, JSON.stringify(cache));
  const out = new Map<string, Float32Array | null>();
  for (const id of ids) if (id in cache) out.set(id, cache[id] === null ? null : fromBase64(cache[id]!));
  return out;
}

export async function embedTexts(texts: readonly string[]): Promise<Float32Array[]> {
  const { tokenizer, text } = await load();
  const { text_embeds } = await text(tokenizer([...texts], { padding: true, truncation: true }));
  const data = text_embeds.data as Float32Array;
  const dim = data.length / texts.length;
  return texts.map((_, i) => data.slice(i * dim, (i + 1) * dim));
}
