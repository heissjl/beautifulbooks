/**
 * What `/api/health` reports (ROADMAP 2.18g, red team B1). Pure; the route
 * gathers the facts.
 *
 * Both uptime monitors watched answers the CDN or a fallback could give while
 * the site was half down: the search came from the CDN for a day, and the home
 * page rendered from the deployed file when Redis was silent. This report is
 * `no-store` and names the two things that fail quietly — the store and Google
 * — without asking Open Library, so watching the site never adds to the load
 * that gets an address refused.
 *
 * Only the store decides the status: Google out of quota or answering nothing
 * is a weaker verdict, not an outage (the catalogue stands in, 1.12).
 */
export interface HealthFacts {
  /** Milliseconds the store took to answer one GET, or null when it did not answer in time. */
  redisMs: number | null;
  /** Whether a store is configured at all here. */
  redisConfigured: boolean;
  /** Seconds the Google breaker still stays shut (quota or rate limit); 0 when open. */
  googlePausedS: number;
  /** The field search is held broken (1.13). */
  googleFieldsBroken: boolean;
}

export function healthReport(f: HealthFacts): { ok: boolean; text: string } {
  const redis = !f.redisConfigured ? 'not configured' : f.redisMs === null ? 'no answer' : `ok (${f.redisMs} ms)`;
  const google = f.googlePausedS > 0 ? `paused ${f.googlePausedS} s` : f.googleFieldsBroken ? 'field search answers nothing' : 'ok';
  const ok = f.redisConfigured && f.redisMs !== null;
  return { ok, text: [`status: ${ok ? 'ok' : 'degraded'}`, `redis: ${redis}`, `google: ${google}`, ''].join('\n') };
}
