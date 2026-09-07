/**
 * Checks the retailer table in lib/buylinks.ts against live shops
 * (SPEC §8.7, §9.3 step 16). Run before launch and whenever a retailer is
 * added; the URL patterns rot silently otherwise.
 *
 * Run: npx tsx scripts/check-buylinks.ts [isbn ...]
 *
 * What it can and cannot tell you, measured 2026-09-07:
 * - Several shops refuse a request from a server outright (403, 406, 429).
 * - Amazon answers .com with a bot check every time, .de intermittently.
 * - Shops that do answer render their results in the browser, so the HTML is
 *   byte-identical for a real ISBN and an invented one.
 * So this reports whether a URL is *reachable*, never whether the book is in
 * stock. A control ISBN that cannot exist is checked alongside: whenever a
 * shop answers the same way for both, its answer carries no information.
 */
const MARKETS = ['us', 'uk', 'de'] as const;

/** A syntactically valid ISBN-13 that no publisher can have been assigned. */
const CONTROL_ISBN = '9780000000019';

const DEFAULT_ISBNS = ['9780099273936', '9780307388629', '9783499130656'];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const TIMEOUT_MS = 25_000;

interface Probe {
  status: number;
  bytes: number;
  botCheck: boolean;
}

async function probe(url: string): Promise<Probe | { error: string }> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9,de;q=0.8' },
    });
    const body = await res.text();
    const low = body.toLowerCase();
    return {
      status: res.status,
      bytes: body.length,
      botCheck: low.includes('captcha') || low.includes('automated access') || low.includes('are you a robot'),
    };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

function verdict(real: Probe | { error: string }, control: Probe | { error: string }): string {
  if ('error' in real) return `unreachable (${real.error})`;
  if (real.botCheck) return 'bot check, cannot be verified from a server';
  if (real.status === 403 || real.status === 406 || real.status === 429) return `refuses automated requests (${real.status})`;
  if (real.status === 404) return '404, the URL pattern may be wrong';
  if (real.status >= 400) return `HTTP ${real.status}`;
  if ('error' in control) return `reachable (${real.bytes} bytes); control unreachable`;
  const same = Math.abs(real.bytes - control.bytes) < Math.max(512, real.bytes * 0.02);
  return same
    ? `reachable, but identical to the control ISBN: results are rendered in the browser`
    : `reachable, and differs from the control (${real.bytes} vs ${control.bytes} bytes)`;
}

async function main() {
  const isbns = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ISBNS;
  const { buyLinksFor } = await import('../lib/buylinks');

  for (const market of MARKETS) {
    console.log(`\n== market ${market}`);
    const controls = new Map<string, Probe | { error: string }>();
    for (const link of buyLinksFor({ isbn13: CONTROL_ISBN }, market, {})) {
      controls.set(link.provider, await probe(link.url));
    }
    for (const isbn of isbns) {
      console.log(`  ISBN ${isbn}`);
      for (const link of buyLinksFor({ isbn13: isbn }, market, {})) {
        const result = await probe(link.url);
        console.log(`    ${link.label.padEnd(13)} ${(link.kind ?? 'search').padEnd(8)} ${verdict(result, controls.get(link.provider)!)}`);
      }
    }
  }
}

main();
