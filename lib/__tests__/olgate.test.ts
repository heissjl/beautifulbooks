/**
 * The catalogue gate (ROADMAP 2.18e): four requests to openlibrary.org at a
 * time per instance, and a pause after Open Library turns one away — a 403, a
 * 429 or a refused connection — during which the site says "busy" instead of
 * asking again. Silence (timeout, 5xx) never opens the pause.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, HttpError, SourceUnavailableError } from '../sources/http';
import { BUSY_PAUSE_MS, CatalogueBusyError, catalogueBusyFor, isCatalogueBusy, MAX_IN_FLIGHT } from '../sources/olgate';
import { searchWorks } from '../sources/openlibrary';

const OL = 'https://openlibrary.org/search.json?q=x';
const opts = { timeoutMs: 1_000, revalidate: 60 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  warn.mockRestore();
});

describe('catalogue gate', () => {
  it('lets four requests to openlibrary.org out at a time and the fifth when one returns', async () => {
    const pending: Array<(r: Response) => void> = [];
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => pending.push(resolve)));
    vi.stubGlobal('fetch', fetchMock);
    const calls = Array.from({ length: MAX_IN_FLIGHT + 2 }, () => fetchJson(OL, opts));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(MAX_IN_FLIGHT);
    pending[0](json({ docs: [] }));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(MAX_IN_FLIGHT + 1);
    for (const resolve of pending.slice(1)) resolve(json({ docs: [] }));
    await flush();
    pending.at(-1)!(json({ docs: [] }));
    await Promise.all(calls);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_IN_FLIGHT + 2);
  });

  it('counts the wait for a slot against the request’s own timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    for (let i = 0; i < MAX_IN_FLIGHT; i++) void fetchJson(OL, opts).catch(() => {});
    await expect(fetchJson(OL, { timeoutMs: 20, revalidate: 60 })).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('does not gate the cover host', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    for (let i = 0; i < MAX_IN_FLIGHT; i++) void fetchJson(OL, opts).catch(() => {});
    void fetchJson('https://covers.openlibrary.org/b/id/1.json', opts).catch(() => {});
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(MAX_IN_FLIGHT + 1);
  });

  it.each([403, 429])('pauses after a %i and does not ask again inside the pause', async status => {
    const fetchMock = vi.fn(async () => json({ error: 'no' }, status));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchJson(OL, opts)).rejects.toBeInstanceOf(HttpError);
    expect(catalogueBusyFor()).toBeGreaterThan(BUSY_PAUSE_MS - 1_000);
    await expect(fetchJson(OL, opts)).rejects.toBeInstanceOf(CatalogueBusyError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^bb\.ol .*"busy"/);
  });

  it('pauses after a refused connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }); }));
    await expect(fetchJson(OL, opts)).rejects.toThrow('fetch failed');
    expect(catalogueBusyFor()).toBeGreaterThan(0);
  });

  it('never pauses for silence: a 503 or a timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 503)));
    await expect(fetchJson(OL, opts)).rejects.toBeInstanceOf(HttpError);
    vi.stubGlobal('fetch', vi.fn(async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); }));
    await expect(fetchJson(OL, opts)).rejects.toThrow('timed out');
    expect(catalogueBusyFor()).toBe(0);
  });

  it('ends the pause after BUSY_PAUSE_MS', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 429)));
    await expect(fetchJson(OL, opts)).rejects.toBeInstanceOf(HttpError);
    expect(catalogueBusyFor(Date.now() + BUSY_PAUSE_MS + 1)).toBe(0);
  });

  it('turns a search inside the pause into "busy" at once, without a retry and without a request', async () => {
    const fetchMock = vi.fn(async () => json({}, 429));
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchWorks('dune')).rejects.toBeInstanceOf(SourceUnavailableError);
    fetchMock.mockClear();
    const started = Date.now();
    const failure = await searchWorks('dune').catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(SourceUnavailableError);
    expect(isCatalogueBusy(failure)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Date.now() - started).toBeLessThan(200);
  });
});
