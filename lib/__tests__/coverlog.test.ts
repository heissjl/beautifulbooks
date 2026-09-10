import { describe, expect, it, vi } from 'vitest';
import { looksLikeThrottling, recordCoverFailure } from '../coverlog';

describe('recordCoverFailure', () => {
  it('writes one line with the upstream answer and no trace of the reader', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    recordCoverFailure({ coverId: 'ol:12345', size: 'M', source: 'openlibrary', status: 429, reason: 'status', ms: 812 });
    expect(info).toHaveBeenCalledTimes(1);
    const line = info.mock.calls[0][0] as string;
    expect(line.startsWith('bb.img ')).toBe(true);
    const payload = JSON.parse(line.slice('bb.img '.length));
    expect(Object.keys(payload).sort()).toEqual(['at', 'coverId', 'ms', 'reason', 'size', 'source', 'status']);
    expect(payload.status).toBe(429);
    info.mockRestore();
  });

  it('never throws, even when the console does', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => { throw new Error('closed'); });
    expect(() => recordCoverFailure({ coverId: 'gb:abc', size: 'S', source: 'googlebooks', status: null, reason: 'timeout', ms: 15000 })).not.toThrow();
    info.mockRestore();
  });
});

describe('looksLikeThrottling', () => {
  it('names only the two statuses that mean a refusal of us', () => {
    expect(looksLikeThrottling({ status: 429 })).toBe(true);
    expect(looksLikeThrottling({ status: 403 })).toBe(true);
    // A 404 is a missing cover, a 503 is an episode, a timeout is silence.
    expect(looksLikeThrottling({ status: 404 })).toBe(false);
    expect(looksLikeThrottling({ status: 503 })).toBe(false);
    expect(looksLikeThrottling({ status: null })).toBe(false);
  });
});
