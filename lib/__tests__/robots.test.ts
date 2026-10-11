import { describe, expect, it } from 'vitest';
import decadePages from '../../data/decade-pages.json';
import { PUBLISHED_WORKS } from '../published';
import { BOUNDED_CRAWLERS, CRAWL_DELAY, mayFetch, robotsRules, SEARCH_CRAWLERS, TRAINING_CRAWLERS } from '../robots';

const published = PUBLISHED_WORKS.map(work => work.id);
const decades = decadePages.pages.map(page => page.id);
const rules = robotsRules(published, decades);
const known = published[0];
const withDecades = decades[0];
// A work the site does not list: the endless rest.
const unlisted = 'OL999999999W';

describe('what crawlers may fetch (ROADMAP 2.18n)', () => {
  it('keeps the named crawlers to the book pages of the sitemap', () => {
    expect(published).not.toContain(unlisted);
    for (const bot of BOUNDED_CRAWLERS) {
      expect(mayFetch(rules, bot, `/book/${known}`)).toBe(true);
      expect(mayFetch(rules, bot, `/book/${withDecades}/decades`)).toBe(true);
      expect(mayFetch(rules, bot, `/book/${unlisted}`)).toBe(false);
      expect(mayFetch(rules, bot, `/book/${unlisted}/decades`)).toBe(false);
    }
  });

  it('gives them no cover page, no address with a query and no image', () => {
    const bot = 'AhrefsBot';
    expect(mayFetch(rules, bot, `/book/${known}/cover/ol:123`)).toBe(false);
    expect(mayFetch(rules, bot, `/book/${known}?cover=ol%3A123`)).toBe(false);
    expect(mayFetch(rules, bot, '/?author=Philip%20K.%20Dick&key=OL1A')).toBe(false);
    expect(mayFetch(rules, bot, '/?q=1984')).toBe(false);
    expect(mayFetch(rules, bot, '/img/M/ol-15259424')).toBe(false);
    expect(mayFetch(rules, bot, '/c/abc123')).toBe(false);
    expect(mayFetch(rules, bot, '/api/works/OL1W')).toBe(false);
  });

  it('leaves them the pages that are files or few', () => {
    for (const path of ['/', '/about', '/collections', '/collections/sf-masterworks', '/versus', '/sitemap.xml']) {
      expect(mayFetch(rules, 'AhrefsBot', path)).toBe(true);
    }
  });

  it('matches a crawler by name whatever its case, and asks it to wait', () => {
    expect(mayFetch(rules, 'ahrefsbot', `/book/${unlisted}`)).toBe(false);
    const bounded = rules.find(rule => Array.isArray(rule.userAgent) && rule.userAgent.includes('AhrefsBot'));
    expect(bounded?.crawlDelay).toBe(CRAWL_DELAY);
  });

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
    expect(mayFetch(rules, 'AhrefsBot', card)).toBe(false);
    // Where the shared page now points: outside /api/, open under `Allow: /`.
    expect(mayFetch(rules, 'Twitterbot', '/shelfportrait/card.jpg?b=2hxjo.5fq3&n=6&format=card&v=3')).toBe(true);
  });

  it('allows exactly the book addresses the sitemap lists', () => {
    const bounded = rules.find(rule => Array.isArray(rule.userAgent) && rule.userAgent.includes('AhrefsBot'));
    const allow = Array.isArray(bounded?.allow) ? bounded.allow : [];
    expect(allow.length).toBe(published.length + decades.length);
    expect(new Set(allow).size).toBe(allow.length);
  });

  it('lets the AI search crawlers in like a search engine, with a pause (Julian, 2026-10-10: „mach c“)', () => {
    for (const bot of SEARCH_CRAWLERS) {
      expect(mayFetch(rules, bot, `/book/${unlisted}`)).toBe(true);
      expect(mayFetch(rules, bot, '/collections/sf-masterworks')).toBe(true);
      expect(mayFetch(rules, bot, '/api/works/OL1W')).toBe(false);
      expect(mayFetch(rules, bot, '/admin/insights')).toBe(false);
    }
    const group = rules.find(rule => Array.isArray(rule.userAgent) && rule.userAgent.includes('OAI-SearchBot'));
    expect(group?.crawlDelay).toBe(CRAWL_DELAY);
  });

  it('shuts the training crawlers out of everything', () => {
    for (const bot of TRAINING_CRAWLERS) {
      for (const path of ['/', '/about', '/collections/sf-masterworks', `/book/${known}`, '/sitemap.xml']) {
        expect(mayFetch(rules, bot, path)).toBe(false);
      }
    }
    // Googlebot is not Google-Extended: search stays open.
    expect(mayFetch(rules, 'Googlebot', '/collections/sf-masterworks')).toBe(true);
  });

  it('puts no crawler in two groups', () => {
    const all = [...SEARCH_CRAWLERS, ...TRAINING_CRAWLERS, ...BOUNDED_CRAWLERS].map(b => b.toLowerCase());
    expect(new Set(all).size).toBe(all.length);
  });
});
