import { describe, expect, it } from 'vitest';
import { CRAWL_DELAY, mayFetch, robotsRules, SEARCH_CRAWLERS, TOOL_CRAWLERS, TRAINING_CRAWLERS } from '../robots';

const rules = robotsRules();
// A work the site does not list: the endless rest.
const unlisted = 'OL999999999W';

describe('what crawlers may fetch (ROADMAP 2.18n, 6.107)', () => {
  it('changes nothing for search engines and for a fetch a person asked for', () => {
    for (const agent of ['Googlebot', 'bingbot', 'Claude-User', 'ChatGPT-User', 'SomeBrowser']) {
      expect(mayFetch(rules, agent, `/book/${unlisted}`)).toBe(true);
      expect(mayFetch(rules, agent, '/img/M/ol-15259424')).toBe(true);
      expect(mayFetch(rules, agent, '/?q=1984')).toBe(true);
      expect(mayFetch(rules, agent, '/api/works/OL1W')).toBe(false);
      expect(mayFetch(rules, agent, '/api/inspiration/covers/OL1W')).toBe(false);
      expect(mayFetch(rules, agent, '/go/amazon/9780141036144')).toBe(false);
      expect(mayFetch(rules, agent, '/admin/insights')).toBe(false);
    }
  });

  it('lets a link preview fetch the Shelf-Portrait card, which lives under /api/', () => {
    const card = '/api/inspiration/poster?b=2hxjo.5fq3&n=6&by=Caro&format=card&v=3';
    for (const agent of ['Twitterbot', 'facebookexternalhit', 'LinkedInBot', 'Slackbot']) {
      expect(mayFetch(rules, agent, card)).toBe(true);
    }
    expect(mayFetch(rules, 'Twitterbot', '/shelfportrait/card.jpg?b=2hxjo.5fq3&n=6&format=card&v=3')).toBe(true);
  });

  it('lets the AI search crawlers in like a search engine, with a pause', () => {
    for (const bot of SEARCH_CRAWLERS) {
      expect(mayFetch(rules, bot, `/book/${unlisted}`)).toBe(true);
      expect(mayFetch(rules, bot, '/collections/sf-masterworks')).toBe(true);
      expect(mayFetch(rules, bot, '/api/works/OL1W')).toBe(false);
      expect(mayFetch(rules, bot, '/admin/insights')).toBe(false);
    }
    const group = rules.find(rule => Array.isArray(rule.userAgent) && rule.userAgent.includes('Amzn-SearchBot'));
    expect(group?.crawlDelay).toBe(CRAWL_DELAY);
  });

  it('shuts training crawlers and SEO tools out of everything, whatever the case of the name', () => {
    for (const bot of [...TRAINING_CRAWLERS, ...TOOL_CRAWLERS]) {
      for (const path of ['/', '/about', '/collections/sf-masterworks', `/book/${unlisted}`, '/sitemap.xml']) {
        expect(mayFetch(rules, bot, path)).toBe(false);
      }
    }
    expect(mayFetch(rules, 'serankingbacklinksbot', '/')).toBe(false);
    // Googlebot is not Google-Extended: search stays open.
    expect(mayFetch(rules, 'Googlebot', '/collections/sf-masterworks')).toBe(true);
  });

  it('puts no crawler in two groups', () => {
    const all = [...SEARCH_CRAWLERS, ...TRAINING_CRAWLERS, ...TOOL_CRAWLERS].map(b => b.toLowerCase());
    expect(new Set(all).size).toBe(all.length);
  });
});
