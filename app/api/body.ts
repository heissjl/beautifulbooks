/**
 * Reads a small request body with a ceiling (red team 2026-10-09, L3).
 *
 * `request.text()` reads the whole body before anyone can measure it, so a
 * route that checks the length afterwards has already held a long body in
 * memory. Here a `Content-Length` over the ceiling is refused before a byte
 * is read, and a body without one is read chunk by chunk and cut off at the
 * ceiling. `null` means too long or unreadable — the two routes that use it
 * answer 204 either way, as they do for everything (`/api/csp`, `/api/seen`).
 */
export async function readBounded(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const body = request.body;
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const joined = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}
