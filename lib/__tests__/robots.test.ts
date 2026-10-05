import { describe, expect, it } from 'vitest';
import decadePages from '../../data/decade-pages.json';
import { PUBLISHED_WORKS } from '../published';
import { BOUNDED_CRAWLERS, CRAWL_DELAY, mayFetch, robotsRules } from '../robots';

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
    const bot = 'ClaudeBot';
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
      expect(mayFetch(rules, 'ClaudeBot', path)).toBe(true);
    }
  });

  it('matches a crawler by name whatever its case, and asks it to wait', () => {
    expect(mayFetch(rules, 'claudebot', `/book/${unlisted}`)).toBe(false);
    const bounded = rules.find(rule => Array.isArray(rule.userAgent));
    expect(bounded?.crawlDelay).toBe(CRAWL_DELAY);
  });

  it('changes nothing for search engines and for a fetch a person asked for', () => {
    for (const agent of ['Googlebot', 'bingbot', 'Claude-User', 'ChatGPT-User', 'SomeBrowser']) {
      expect(mayFetch(rules, agent, `/book/${unlisted}`)).toBe(true);
      expect(mayFetch(rules, agent, '/img/M/ol-15259424')).toBe(true);
      expect(mayFetch(rules, agent, '/?q=1984')).toBe(true);
      expect(mayFetch(rules, agent, '/api/works/OL1W')).toBe(false);
      expect(mayFetch(rules, agent, '/go/amazon/9780141036144')).toBe(false);
      expect(mayFetch(rules, agent, '/admin/insights')).toBe(false);
    }
  });

  it('allows exactly the book addresses the sitemap lists', () => {
    const bounded = rules.find(rule => Array.isArray(rule.userAgent));
    const allow = Array.isArray(bounded?.allow) ? bounded.allow : [];
    expect(allow.length).toBe(published.length + decades.length);
    expect(new Set(allow).size).toBe(allow.length);
  });
});
