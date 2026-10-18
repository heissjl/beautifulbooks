/** Which requests the analytics count (ROADMAP 3.1i): a click or a beacon that can be a person's, with a browser of this or last year. */
import { describe, expect, it } from 'vitest';
import { browserAge, humanRequest, oldestCurrentMajor } from '../insights/human';

const NOW = new Date('2026-10-18T12:00:00Z');

/** The ten strings the scraper rotated on 2026-10-16/17 (`vercel metrics --group-by clientUserAgent`), and its headless one. */
const SCRAPER = {
  firefox121mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  firefox120: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  edge120: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  edge119: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
  chrome118: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  chrome119mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  chrome120: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  lightpanda: 'Lightpanda/1.0',
};

/** Browsers a reader has in October 2026. */
const READER = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphoneSafari18: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/152.0.0.0 Mobile/15E148 Safari/604.1',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
};

const bag = (h: Record<string, string>) => ({ get: (name: string) => h[name.toLowerCase()] ?? null });
const click = (ua: string) => bag({ 'user-agent': ua, 'sec-fetch-mode': 'navigate', 'sec-fetch-user': '?1', 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'document' });
const beacon = (ua: string) => bag({ 'user-agent': ua, 'sec-fetch-mode': 'no-cors', 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'empty' });

describe('how old a browser is', () => {
  it('derives the oldest current major from the date, not from a list', () => {
    // Chrome 132 and Firefox 134 opened 2025; the estimate is at or just below them.
    expect(oldestCurrentMajor('chrome', NOW)).toBe(132);
    expect(oldestCurrentMajor('firefox', NOW)).toBe(133);
    // A year on, the window has moved by twelve.
    expect(oldestCurrentMajor('chrome', new Date('2027-10-18T00:00:00Z'))).toBe(144);
    expect(oldestCurrentMajor('firefox', new Date('2027-10-18T00:00:00Z'))).toBe(145);
  });

  it('calls the scraper’s ten strings old and a reader’s browsers current', () => {
    for (const ua of [SCRAPER.firefox121mac, SCRAPER.firefox120, SCRAPER.edge120, SCRAPER.edge119, SCRAPER.chrome118, SCRAPER.chrome119mac, SCRAPER.chrome120]) {
      expect(browserAge(ua, NOW), ua).toBe('old');
    }
    for (const ua of Object.values(READER).filter(ua => ua !== READER.samsung)) expect(browserAge(ua, NOW), ua).toBe('current');
  });

  it('moves with the date: Chrome 132 is current in 2026 and old in 2027', () => {
    const chrome132 = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
    expect(browserAge(chrome132, NOW)).toBe('current');
    expect(browserAge(chrome132, new Date('2027-10-18T00:00:00Z'))).toBe('old');
  });

  it('gives Safari a year more, because a phone keeps its major until the OS is updated', () => {
    expect(browserAge(READER.iphoneSafari18, NOW)).toBe('current');
    const safari17 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
    expect(browserAge(safari17, NOW)).toBe('old');
  });

  it('does not judge what it does not recognise — an unknown real browser passes', () => {
    // Samsung Internet carries a Chrome number that lags its own age.
    expect(browserAge(READER.samsung, NOW)).toBe('unknown');
    expect(browserAge('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0', NOW)).toBe('unknown');
    expect(browserAge('curl/8.4.0', NOW)).toBe('unknown');
    expect(browserAge('', NOW)).toBe('unknown');
  });
});

describe('a click through /go/', () => {
  it('counts a navigation the reader set off, from a current browser', () => {
    for (const ua of Object.values(READER)) expect(humanRequest(click(ua), 'go', NOW), ua).toEqual({ human: true });
  });

  it('does not count the scraper: old strings, and Lightpanda by name', () => {
    expect(humanRequest(click(SCRAPER.firefox121mac), 'go', NOW)).toEqual({ human: false, reason: 'old-browser' });
    expect(humanRequest(click(SCRAPER.edge120), 'go', NOW)).toEqual({ human: false, reason: 'old-browser' });
    expect(humanRequest(click(SCRAPER.chrome118), 'go', NOW)).toEqual({ human: false, reason: 'old-browser' });
    expect(humanRequest(click(SCRAPER.lightpanda), 'go', NOW)).toEqual({ human: false, reason: 'headless' });
    const headless = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36';
    expect(humanRequest(click(headless), 'go', NOW)).toEqual({ human: false, reason: 'headless' });
  });

  it('does not count a fetch, a curl or a navigation nobody set off', () => {
    expect(humanRequest(bag({ 'user-agent': READER.chrome, 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin' }), 'go', NOW)).toEqual({ human: false, reason: 'not-a-click' });
    expect(humanRequest(bag({ 'user-agent': READER.chrome, 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none' }), 'go', NOW)).toEqual({ human: false, reason: 'not-a-click' });
    expect(humanRequest(bag({ 'user-agent': 'curl/8.4.0' }), 'go', NOW)).toEqual({ human: false, reason: 'not-a-click' });
    expect(humanRequest(bag({}), 'go', NOW)).toEqual({ human: false, reason: 'not-a-click' });
  });

  it('reads the header values whatever their case', () => {
    expect(humanRequest(bag({ 'user-agent': READER.firefox, 'sec-fetch-mode': 'Navigate', 'sec-fetch-user': '?1' }), 'go', NOW)).toEqual({ human: true });
  });
});

describe('a beacon to /api/seen', () => {
  it('counts one sent from a page of this site by a current browser', () => {
    for (const ua of Object.values(READER)) expect(humanRequest(beacon(ua), 'seen', NOW), ua).toEqual({ human: true });
  });

  it('does not count the scraper’s beacons, nor a post from elsewhere', () => {
    expect(humanRequest(beacon(SCRAPER.chrome120), 'seen', NOW)).toEqual({ human: false, reason: 'old-browser' });
    expect(humanRequest(beacon(SCRAPER.lightpanda), 'seen', NOW)).toEqual({ human: false, reason: 'headless' });
    expect(humanRequest(bag({ 'user-agent': READER.chrome, 'sec-fetch-site': 'cross-site' }), 'seen', NOW)).toEqual({ human: false, reason: 'not-own-page' });
    expect(humanRequest(bag({ 'user-agent': READER.chrome, 'sec-fetch-site': 'none' }), 'seen', NOW)).toEqual({ human: false, reason: 'not-own-page' });
    expect(humanRequest(bag({ 'user-agent': 'curl/8.4.0' }), 'seen', NOW)).toEqual({ human: false, reason: 'not-own-page' });
  });
});
