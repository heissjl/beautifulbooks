import { describe, expect, it } from 'vitest';
import type { Tile } from '../../../lib/walls/model';
import { isLocalBase, uploadWall, UploadError, visitorFromEnv } from '../upload';

const VISITOR = '0f8fad5b-d9cb-469f-a165-70867728950e';
const tile = (n: number): Tile => ({ workId: `OL${n}W`, coverId: String(1000 + n), title: `Book ${n}`, author: 'A B', printings: [] });
const BASE = 'http://localhost:3000';

type Init = { method: string; headers: Record<string, string>; body: string };
const answer = (status: number, body: unknown) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

describe('uploadWall', () => {
  it('creates the collection in one request, with the id as the cookie and nowhere else', async () => {
    const seen: Array<{ url: string; init: Init }> = [];
    const up = await uploadWall({ base: BASE, visitor: VISITOR, title: 'My Calibre library', tiles: [tile(1), tile(2)] }, async (url, init) => {
      seen.push({ url, init });
      return { status: 201, ok: true, json: async () => ({ wall: { id: 'abcdefghij', tiles: [tile(1), tile(2)] } }) };
    });
    expect(up).toEqual({ wallId: 'abcdefghij', tiles: 2, editUrl: `${BASE}/c/abcdefghij/edit` });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(`${BASE}/api/walls`);
    expect(seen[0].init.headers.cookie).toBe(`bb_visitor=${VISITOR}`);
    expect(seen[0].url).not.toContain(VISITOR);
    expect(seen[0].init.body).not.toContain(VISITOR);
    // Never `save`: the collection lapses unless Julian keeps it on the site.
    expect(Object.keys(JSON.parse(seen[0].init.body) as object)).toEqual(['title', 'tiles']);
  });

  it('sends only what a tile is — nothing else a row may carry', async () => {
    let body = '';
    const loaded = { ...tile(1), path: 'Adams, Douglas/Per Anhalter (5)', bookId: 5, comments: 'private' } as Tile;
    await uploadWall({ base: BASE, visitor: VISITOR, title: 't', tiles: [loaded] }, async (_url, init) => {
      body = init.body;
      return { status: 201, ok: true, json: async () => ({ wall: { id: 'abcdefghij', tiles: [tile(1)] } }) };
    });
    expect(JSON.parse(body).tiles).toEqual([tile(1)]);
  });

  it('never puts the visitor id into what it says or returns', async () => {
    const said: string[] = [];
    const attempt = async (send: Parameters<typeof uploadWall>[1], tiles = [tile(1)], visitor = VISITOR) => {
      try {
        said.push(JSON.stringify(await uploadWall({ base: BASE, visitor, title: 't', tiles }, send)));
      } catch (err) {
        expect(err).toBeInstanceOf(UploadError);
        said.push((err as Error).message, String((err as Error).stack), JSON.stringify(err));
      }
    };
    await attempt(answer(201, { wall: { id: 'abcdefghij', tiles: [] } }));
    await attempt(answer(404, {}));
    await attempt(answer(429, {}));
    await attempt(answer(503, { error: `store down for bb_visitor=${VISITOR}` }));
    await attempt(answer(201, { wall: { id: VISITOR } }));
    await attempt(async (_url, init) => {
      throw new Error(`connect failed, request headers ${JSON.stringify(init.headers)}`);
    });
    await attempt(answer(201, {}), []);
    await attempt(answer(201, {}), Array.from({ length: 501 }, (_, i) => tile(i)));
    expect(said.length).toBeGreaterThanOrEqual(8);
    for (const s of said) expect(s).not.toContain(VISITOR);
  });

  it('refuses an id that is not one before anything is sent', async () => {
    let sent = false;
    await expect(
      uploadWall({ base: BASE, visitor: 'julian', title: 't', tiles: [tile(1)] }, async () => {
        sent = true;
        return { status: 201, ok: true, json: async () => ({}) };
      }),
    ).rejects.toThrow(UploadError);
    expect(sent).toBe(false);
  });
});

describe('where the id comes from', () => {
  it('takes BB_VISITOR from the environment, lower-cased, and nothing that is not an id', () => {
    expect(visitorFromEnv({ BB_VISITOR: ` ${VISITOR.toUpperCase()} ` })).toBe(VISITOR);
    expect(visitorFromEnv({ BB_VISITOR: 'not-an-id' })).toBeNull();
  });

  it('knows a dev server from the site', () => {
    expect(isLocalBase('http://localhost:3000')).toBe(true);
    expect(isLocalBase('http://127.0.0.1:3000')).toBe(true);
    expect(isLocalBase('https://buyitscovers.com')).toBe(false);
    expect(isLocalBase('http://localhost.evil.example')).toBe(false);
  });
});
