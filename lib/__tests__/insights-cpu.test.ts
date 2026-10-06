import { describe, expect, it } from 'vitest';
import { agentClass, CpuMeter, CPU_AGENTS, CPU_ROUTES, summarizeCpu } from '../insights/cpu';
import { summarizeCosts, VERCEL_PRICES, type FixedCost } from '../insights/costs';
import { countCpu } from '../insights/store';
import { insightsKey } from '../insights/model';
import { HINCRBY_MANY_SCRIPT, upstashCommands, type RedisCommands } from '../hotornot/store';

/** A meter on a clock the test moves. */
function meterAt() {
  let now = 0;
  const meter = new CpuMeter(() => now);
  return { meter, spend: (micros: number) => { now += micros; } };
}

const asRecord = (increments: Array<[string, number]>) => Object.fromEntries(increments);

describe('the CPU meter', () => {
  it('gives a request the CPU spent while it was alone', () => {
    const { meter, spend } = meterAt();
    const a = meter.start('img', 'browser');
    spend(40_000);
    meter.end(a, 120);
    expect(asRecord(meter.take())).toEqual({ 'img|browser|cpu': 40_000, 'img|browser|n': 1, 'img|browser|ms': 120 });
  });

  it('splits a stretch evenly among the requests in flight', () => {
    const { meter, spend } = meterAt();
    const a = meter.start('img', 'claudebot');
    spend(10_000); // a alone
    const b = meter.start('page-book', 'page');
    spend(60_000); // shared: 30,000 each
    meter.end(a, 50);
    spend(5_000); // b alone
    meter.end(b, 90);
    const taken = asRecord(meter.take());
    expect(taken['img|claudebot|cpu']).toBe(40_000);
    expect(taken['page-book|page|cpu']).toBe(35_000);
  });

  it('counts what the process used before its first request, and between requests, as idle', () => {
    let now = 250_000; // start-up, before the meter saw anything
    const meter = new CpuMeter(() => now);
    const a = meter.start('search', 'browser');
    now += 1_000;
    meter.end(a, 10);
    now += 7_000; // nothing in flight
    const taken = asRecord(meter.take());
    expect(taken['idle|none|cpu']).toBe(257_000);
    expect(taken['search|browser|cpu']).toBe(1_000);
  });

  it('adds up to exactly what the process used', () => {
    const { meter, spend } = meterAt();
    const tokens = [meter.start('img', 'browser'), meter.start('img', 'claudebot'), meter.start('works', 'bot')];
    spend(10_001);
    meter.end(tokens[0], 1);
    spend(20_002);
    meter.end(tokens[1], 1);
    meter.end(tokens[2], 1);
    spend(303);
    const cpu = meter.take().filter(([field]) => field.endsWith('|cpu')).reduce((sum, [, by]) => sum + by, 0);
    expect(Math.abs(cpu - 30_306)).toBeLessThanOrEqual(2); // rounding per field
  });

  it('starts again from nothing after a take, and ignores a token it does not know', () => {
    const { meter, spend } = meterAt();
    const a = meter.start('go', 'browser');
    spend(500);
    meter.end(a, 3);
    meter.end(a, 3);
    meter.end(999, 3);
    expect(meter.take().length).toBe(3);
    expect(meter.take()).toEqual([]);
  });
});

describe('the class of a caller', () => {
  it('names the crawlers that were measured, and keeps no string', () => {
    expect(agentClass('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')).toBe('claudebot');
    expect(agentClass('Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toBe('gptbot');
    expect(agentClass('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe('googlebot');
    expect(agentClass('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe('bingbot');
    expect(agentClass('Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)')).toBe('bot');
    expect(agentClass('curl/8.4.0')).toBe('bot');
    expect(agentClass('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1')).toBe('browser');
    expect(agentClass('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0')).toBe('browser');
    expect(agentClass(null)).toBe('none');
    expect(agentClass('  ')).toBe('none');
  });

  it('is always one of the listed classes', () => {
    for (const ua of ['x', 'Bot', 'spider', 'WhatsApp/2.23', '']) expect(CPU_AGENTS).toContain(agentClass(ua));
  });
});

describe('the CPU summary', () => {
  const days = ['2026-10-05', '2026-10-06'];
  const hashes = [
    { 'img|claudebot|cpu': '3000000', 'img|claudebot|n': '100', 'img|claudebot|ms': '90000', 'img|browser|cpu': '1000000', 'img|browser|n': '20' },
    { 'page-book|page|cpu': 2_000_000, 'page-book|page|n': 10, 'nonsense|browser|cpu': 99, 'img|someone|cpu': 99, 'img|browser|what': 99, 'img|browser': 99 },
  ];

  it('sums per route, per caller and per day, and the three agree', () => {
    const cpu = summarizeCpu(days, hashes);
    expect(cpu.cpu).toBe(6_000_000);
    expect(cpu.n).toBe(130);
    expect(cpu.byRoute.map(r => [r.route, r.cpu])).toEqual([['img', 4_000_000], ['page-book', 2_000_000]]);
    expect(cpu.byAgent.map(a => [a.agent, a.cpu])).toEqual([['claudebot', 3_000_000], ['page', 2_000_000], ['browser', 1_000_000]]);
    expect(cpu.perDay).toEqual([{ day: '2026-10-05', cpu: 4_000_000 }, { day: '2026-10-06', cpu: 2_000_000 }]);
    const sum = (rows: Array<{ cpu: number }>) => rows.reduce((total, row) => total + row.cpu, 0);
    expect(sum(cpu.byRoute)).toBe(cpu.cpu);
    expect(sum(cpu.byAgent)).toBe(cpu.cpu);
    expect(sum(cpu.perDay)).toBe(cpu.cpu);
    expect(sum(cpu.rows)).toBe(cpu.cpu);
  });

  it('skips a field outside the lists instead of guessing it into a class', () => {
    const cpu = summarizeCpu(days, hashes);
    expect(cpu.rows.every(r => (CPU_ROUTES as readonly string[]).includes(r.route) && (CPU_AGENTS as readonly string[]).includes(r.agent))).toBe(true);
    expect(cpu.rows.length).toBe(3);
  });

  it('is empty for days without a hash', () => {
    expect(summarizeCpu(days, [null, {}]).cpu).toBe(0);
  });
});

describe('writing the CPU totals', () => {
  it('adds every field to the day and sets one expiry', async () => {
    const calls: string[] = [];
    const commands = {
      hIncrBy: async (key: string, field: string, by: number) => { calls.push(`HINCRBY ${key} ${field} ${by}`); return by; },
      expire: async (key: string) => { calls.push(`EXPIRE ${key}`); return 1; },
    } as unknown as RedisCommands;
    const now = new Date('2026-10-05T12:00:00Z');
    const result = await countCpu([['img|browser|cpu', 5], ['img|browser|n', 1]], { env: { VERCEL_ENV: 'production' }, commands, now });
    const key = insightsKey('2026-10-05', 'cpu');
    expect(result).toBe('counted');
    expect(calls).toEqual([`HINCRBY ${key} img|browser|cpu 5`, `HINCRBY ${key} img|browser|n 1`, `EXPIRE ${key}`]);
  });

  it('sends a flush as one command where the store can (2.18d)', async () => {
    const calls: unknown[][] = [];
    const commands = {
      hIncrBy: async () => { throw new Error('must not be called'); },
      hIncrByMany: async (...args: unknown[]) => { calls.push(args); return 2; },
    } as unknown as RedisCommands;
    const now = new Date('2026-10-05T12:00:00Z');
    const result = await countCpu([['img|browser|cpu', 5], ['img|browser|n', 1]], { env: { VERCEL_ENV: 'production' }, commands, now });
    expect(result).toBe('counted');
    expect(calls).toEqual([[insightsKey('2026-10-05', 'cpu'), [['img|browser|cpu', 5], ['img|browser|n', 1]], expect.any(Number)]]);
  });

  it('speaks the batch over REST as one EVAL: key, expiry, then field and amount', async () => {
    const bodies: unknown[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ result: 2 }), { status: 200 });
    }) as unknown as typeof fetch;
    await upstashCommands('https://redis.example', 'token', fetchImpl).hIncrByMany!('ins:2026-10-05:cpu', [['a', 5], ['b', 1]], 3600);
    expect(bodies).toEqual([['EVAL', HINCRBY_MANY_SCRIPT, 1, 'ins:2026-10-05:cpu', '3600', 'a', '5', 'b', '1']]);
  });

  it('writes nothing outside production and nothing for an empty take', async () => {
    const commands = { hIncrBy: async () => { throw new Error('must not be called'); } } as unknown as RedisCommands;
    expect(await countCpu([['img|browser|cpu', 5]], { env: { VERCEL_ENV: 'preview' }, commands })).toBe('off');
    expect(await countCpu([], { env: { VERCEL_ENV: 'production' }, commands })).toBe('counted');
  });
});

describe('the costs of a range', () => {
  const fixed: FixedCost[] = [
    { id: 'vercel-pro', label: 'Vercel Pro', amount: 20, currency: 'USD', per: 'month', since: '2026-10-05' },
    { id: 'domains', label: 'Domains', amount: 73.05, currency: 'EUR', per: 'year', since: '2026-10-02' },
  ];
  const days = ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'];

  it('charges a fixed cost only for the days since it began, and never converts a currency', () => {
    const costs = summarizeCosts(days, { cpu: 0, n: 0 }, 0, fixed);
    const pro = costs.lines.find(l => l.label === 'Vercel Pro');
    const domains = costs.lines.find(l => l.label === 'Domains');
    expect(pro?.amount).toBeCloseTo((20 / 30.4375) * 2, 6);
    expect(domains?.amount).toBeCloseTo((73.05 / 365.25) * 4, 6);
    expect(costs.totals.EUR).toBeCloseTo(domains!.amount, 6);
    expect(costs.totals.USD).toBeCloseTo(pro!.amount, 6);
  });

  it('prices CPU hours and calls at the list price and takes the plan credit off, never below zero', () => {
    const tenHours = 10 * 3_600_000_000;
    const costs = summarizeCosts(days, { cpu: tenHours, n: 2_000_000 }, 1.5, fixed);
    const usage = 10 * VERCEL_PRICES.cpuUsdPerHour + 2 * VERCEL_PRICES.usdPerMillionInvocations;
    expect(costs.vercelUsageUsd).toBeCloseTo(usage, 6);
    const credit = (VERCEL_PRICES.monthlyCreditUsd / 30.4375) * 2;
    expect(costs.vercelCreditUsd).toBeCloseTo(Math.min(usage, credit), 6);
    const total = costs.lines.filter(l => l.currency === 'USD').reduce((sum, l) => sum + l.amount, 0);
    expect(costs.totals.USD).toBeCloseTo(total, 6);
    expect(costs.totals.USD).toBeCloseTo((20 / 30.4375) * 2 + usage - costs.vercelCreditUsd + 1.5, 6);
  });

  it('gives no credit before the plan began', () => {
    const costs = summarizeCosts(['2026-10-01', '2026-10-02'], { cpu: 3_600_000_000, n: 0 }, 0, fixed);
    expect(costs.vercelCreditUsd).toBe(0);
    expect(costs.lines.some(l => l.label === 'Vercel Pro')).toBe(false);
  });

  it('says what it does not measure', () => {
    expect(summarizeCosts(days, { cpu: 0, n: 0 }, 0, fixed).notMeasured.length).toBeGreaterThan(0);
  });
});

describe('the Anthropic Max plan in the cost table', () => {
  it('is counted in full from the first bill on 2026-09-04, at 100 USD a month, and not before', async () => {
    const { FIXED_COSTS } = await import('../insights/costs');
    const max = FIXED_COSTS.find(c => c.id === 'anthropic-max');
    expect(max).toMatchObject({ amount: 100, currency: 'USD', per: 'month', since: '2026-09-04' });
    const line = (days: string[]) => summarizeCosts(days, { cpu: 0, n: 0 }, 0).lines.find(l => l.label === max!.label);
    expect(line(['2026-09-03'])).toBeUndefined();
    expect(line(['2026-09-03', '2026-09-04', '2026-09-05'])?.amount).toBeCloseTo((100 / 30.4375) * 2, 6);
  });

  it('names the usage credits as not measured while their amount is missing', () => {
    expect(summarizeCosts(['2026-10-06'], { cpu: 0, n: 0 }, 0).notMeasured.some(n => n.includes('Usage Credits'))).toBe(true);
  });
});
