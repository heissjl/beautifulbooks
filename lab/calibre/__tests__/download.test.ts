import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { CoverDownloads, type DownloadNote } from '../download';

/** A picture large enough to pass as a cover, and small enough to decode in no time. */
const cover = ((): Buffer => {
  const img = new PNG({ width: 200, height: 280 });
  img.data.fill(128);
  return PNG.sync.write(img);
})();

const idOf = (url: string): string => /\/id\/(\d+)/.exec(url)?.[1] ?? '';
const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** An image host whose answers the test hands out: every request waits until it is answered or aborted. */
function host() {
  const asked: { id: string; url: string; answer: (body: Buffer | number) => void; aborted: boolean }[] = [];
  const fetchFake = ((input: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const url = String(input);
      const entry = {
        id: idOf(url),
        url,
        aborted: false,
        answer: (body: Buffer | number) => resolve(typeof body === 'number' ? new Response('no', { status: body }) : new Response(new Uint8Array(body), { status: 200 })),
      };
      init?.signal?.addEventListener('abort', () => {
        entry.aborted = true;
        reject(new Error('aborted'));
      });
      asked.push(entry);
    })) as typeof fetch;
  return { asked, fetch: fetchFake };
}

describe('CoverDownloads', () => {
  it('starts the image someone waits for at once, however many are being fetched ahead', async () => {
    const h = host();
    const d = new CoverDownloads('https://example.test', { fetch: h.fetch, secondAskAfter: 60_000 });
    d.warm('ol:1');
    d.warm('ol:2');
    d.warm('ol:3');
    await tick();
    // Two ahead of a click at a time; the third waits.
    expect(h.asked.map((a) => a.id)).toEqual(['1', '2']);

    const clicked = d.get('ol:9');
    await tick();
    expect(h.asked.map((a) => a.id)).toEqual(['1', '2', '9']);
    h.asked[2].answer(cover);
    expect((await clicked).check.ok).toBe(true);

    // The clicked one finishing does not let a waiting one in: two are still running.
    await tick();
    expect(h.asked.map((a) => a.id)).toEqual(['1', '2', '9']);
    h.asked[0].answer(cover);
    await tick();
    expect(h.asked.map((a) => a.id)).toEqual(['1', '2', '9', '3']);
  });

  it('lets a waiting image go the moment it is clicked, and asks for it once', async () => {
    const h = host();
    const d = new CoverDownloads('https://example.test', { fetch: h.fetch, secondAskAfter: 60_000 });
    d.warm('ol:1');
    d.warm('ol:2');
    d.warm('ol:3');
    await tick();
    const clicked = d.get('ol:3');
    await tick();
    expect(h.asked.map((a) => a.id)).toEqual(['1', '2', '3']);
    h.asked[2].answer(cover);
    expect((await clicked).bytes?.length).toBe(cover.length);
    // Fetched once per run: a second look asks nobody.
    await d.get('ol:3');
    expect(h.asked.filter((a) => a.id === '3')).toHaveLength(1);
  });

  it('keeps three waiting at most; one that gave up is fetched when it is clicked after all', async () => {
    const h = host();
    const d = new CoverDownloads('https://example.test', { fetch: h.fetch, secondAskAfter: 60_000 });
    for (const n of [1, 2, 3, 4, 5, 6]) d.warm(`ol:${n}`);
    await tick();
    expect(h.asked.map((a) => a.id)).toEqual(['1', '2']);
    h.asked[0].answer(cover);
    h.asked[1].answer(cover);
    await tick();
    // 3 was the oldest in line when 6 came, and gave up: 4 and 5 go next.
    expect(h.asked.map((a) => a.id)).toEqual(['1', '2', '4', '5']);

    const clicked = d.get('ol:3');
    await tick();
    expect(h.asked.at(-1)?.id).toBe('3');
    h.asked.at(-1)?.answer(cover);
    expect((await clicked).check.ok).toBe(true);
  });

  it('asks a silent address a second time, uses the first answer and drops the other ask', async () => {
    const h = host();
    const notes: DownloadNote[] = [];
    const d = new CoverDownloads('https://example.test', { fetch: h.fetch, secondAskAfter: 20, note: (n) => notes.push(n) });
    const got = d.get('ol:7');
    await tick(5);
    expect(h.asked).toHaveLength(1);
    await tick(40);
    expect(h.asked).toHaveLength(2);
    expect(h.asked[1].url).toBe(h.asked[0].url);
    h.asked[1].answer(cover);
    expect((await got).check.ok).toBe(true);
    expect(h.asked[0].aborted).toBe(true);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ coverId: 'ol:7', ok: true, bytes: cover.length, second: true, won: 2 });
  });

  it('does not ask twice when the first answer comes in time, and a refusal is not asked again', async () => {
    const h = host();
    const notes: DownloadNote[] = [];
    const d = new CoverDownloads('https://example.test', { fetch: h.fetch, secondAskAfter: 30, note: (n) => notes.push(n) });
    const quick = d.get('ol:7');
    await tick();
    h.asked[0].answer(cover);
    await quick;
    await tick(60);
    expect(h.asked).toHaveLength(1);
    expect(notes[0].second).toBeUndefined();

    // 404 for the original: on to the large image, not the same address again.
    const missing = d.get('ol:8');
    await tick();
    h.asked[1].answer(404);
    await tick();
    expect(h.asked.map((a) => a.url.includes('-L.jpg'))).toEqual([false, false, true]);
    h.asked[2].answer(404);
    const f = await missing;
    expect(f.check).toEqual({ ok: false, reason: 'The image source answered 404.' });
    await tick(60);
    expect(h.asked).toHaveLength(3);
  });

  it('waits for the second ask when the first one fails after it was sent', async () => {
    const h = host();
    const d = new CoverDownloads('https://example.test', { fetch: h.fetch, secondAskAfter: 10 });
    const got = d.get('ol:7');
    await tick(30);
    expect(h.asked).toHaveLength(2);
    h.asked[0].answer(503);
    await tick();
    h.asked[1].answer(cover);
    expect((await got).check.ok).toBe(true);
  });

  it('does not remember a failure: the next look asks again', async () => {
    const h = host();
    const d = new CoverDownloads('https://example.test', { fetch: h.fetch, secondAskAfter: 60_000 });
    const first = d.get('ol:7');
    await tick();
    h.asked[0].answer(500);
    await tick();
    h.asked[1].answer(500);
    expect((await first).check.ok).toBe(false);
    const again = d.get('ol:7');
    await tick();
    expect(h.asked).toHaveLength(3);
    h.asked[2].answer(cover);
    expect((await again).check.ok).toBe(true);
  });
});
