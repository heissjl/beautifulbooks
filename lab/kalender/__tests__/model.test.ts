import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addDays, clipboardFor, linkFor, openNeeds, shiftFrom, validatePost, warnings, weekOf, type Calendar, type Post } from '../model';

const SITE = 'https://buyitscovers.com';
const post = (over: Partial<Post>): Post => ({ id: 'p1', date: '2026-10-14', channel: 'bluesky', kind: 'collection', text: 'Hello', status: 'vorschlag', ...over });
const cal = (posts: Post[], done: string[] = []): Calendar => ({ site: SITE, done, posts });

describe('linkFor', () => {
  it('adds the channel as ?via= so that 5.6a counts the visit under it', () => {
    expect(linkFor(post({ path: '/collections/sf-masterworks' }), SITE)).toBe('https://buyitscovers.com/collections/sf-masterworks?via=bluesky');
  });
  it('keeps a query the path already has', () => {
    expect(linkFor(post({ path: '/book/OL1W?cover=ol:2', channel: 'pinterest' }), SITE)).toBe('https://buyitscovers.com/book/OL1W?cover=ol%3A2&via=pinterest');
  });
  it('has no link for setup entries or posts without a path', () => {
    expect(linkFor(post({ path: '/', channel: 'alle' }), SITE)).toBeNull();
    expect(linkFor(post({}), SITE)).toBeNull();
  });
});

describe('clipboardFor', () => {
  it('appends the link where the platform takes it in the text, not on Instagram', () => {
    expect(clipboardFor(post({ path: '/' }), SITE)).toBe('Hello\n\nhttps://buyitscovers.com/?via=bluesky');
    expect(clipboardFor(post({ path: '/', channel: 'instagram' }), SITE)).toBe('Hello');
  });
});

describe('dates', () => {
  it('finds the Monday of a week and shifts across a month', () => {
    expect(weekOf('2026-10-18')).toBe('2026-10-12');
    expect(weekOf('2026-10-12')).toBe('2026-10-12');
    expect(addDays('2026-10-28', 7)).toBe('2026-11-04');
  });
  it('shifts only what has not gone out, from the given day on, optionally one channel', () => {
    const posts = [
      post({ id: 'a', date: '2026-10-12' }),
      post({ id: 'b', date: '2026-10-14' }),
      post({ id: 'c', date: '2026-10-15', status: 'gepostet' }),
      post({ id: 'd', date: '2026-10-16', channel: 'instagram' }),
    ];
    expect(shiftFrom(posts, '2026-10-13', 7).map(p => p.date)).toEqual(['2026-10-12', '2026-10-21', '2026-10-15', '2026-10-23']);
    expect(shiftFrom(posts, '2026-10-13', 7, 'instagram').map(p => p.date)).toEqual(['2026-10-12', '2026-10-14', '2026-10-15', '2026-10-23']);
  });
});

describe('openNeeds', () => {
  it('lists what is not done yet', () => {
    expect(openNeeds(post({ needs: ['rechte', '5.6a'] }), ['5.6a'])).toEqual(['rechte']);
  });
});

describe('validatePost', () => {
  it('accepts a sound post and names what is wrong otherwise', () => {
    expect(validatePost(post({ needs: ['rechte', 'publish:penguin-great-ideas'] }))).toBeNull();
    expect(validatePost(post({ channel: 'x' as Post['channel'] }))).toMatch(/Kanal/);
    expect(validatePost(post({ needs: ['irgendwas'] }))).toMatch(/Voraussetzung/);
    expect(validatePost(post({ path: 'collections/x' }))).toMatch(/Pfad/);
  });
});

describe('warnings', () => {
  const today = '2026-10-13';
  const messages = (c: Calendar) => warnings(c, today).map(w => w.message);

  it('flags an overdue post and an approved one whose prerequisites are missing', () => {
    const m = messages(cal([post({ id: 'old', date: '2026-10-10' }), post({ id: 'soon', date: '2026-10-14', status: 'freigegeben', needs: ['rechte'] })]));
    expect(m.some(x => x.startsWith('überfällig'))).toBe(true);
    expect(m.some(x => x.includes('es fehlt noch: rechte'))).toBe(true);
  });
  it('counts the link into a Bluesky post’s length', () => {
    const text = 'x'.repeat(270);
    expect(messages(cal([post({ text })]))).toEqual([]);
    expect(messages(cal([post({ text, path: '/collections/sf-masterworks' })])).some(x => x.includes('bluesky nimmt 300'))).toBe(true);
  });
  it('asks to look at completeness words and superlatives', () => {
    expect(messages(cal([post({ text: 'Every cover of Dune' })])).some(x => x.includes('„Every“'))).toBe(true);
    expect(messages(cal([post({ kind: 'setup', channel: 'alle', text: 'Read all the rules' })]))).toEqual([]);
  });
  it('wants the exposé first on its channel', () => {
    const m = messages(cal([post({ id: 'e', kind: 'expose', date: '2026-10-15' }), post({ id: 'c', date: '2026-10-14' })]));
    expect(m.some(x => x.includes('vor dem Exposé'))).toBe(true);
  });
  it('keeps the launches a week apart', () => {
    const m = messages(cal([post({ id: 'hn', channel: 'hn', kind: 'expose', date: '2026-10-20' }), post({ id: 'r', channel: 'reddit', kind: 'launch', date: '2026-10-22' })]));
    expect(m.some(x => x.includes('nur 2 Tage nach dem Launch auf hn'))).toBe(true);
  });
  it('stops a fourth Reddit answer in one week', () => {
    const answers = [12, 13, 14, 15].map(d => post({ id: `a${d}`, channel: 'reddit', kind: 'answer', date: `2026-10-${d}` }));
    expect(warnings(cal(answers), '2026-10-01').filter(w => w.level === 'stop')).toHaveLength(1);
  });
  it('flags the same page twice on one channel within two weeks', () => {
    const m = messages(cal([post({ id: 'a', path: '/x', date: '2026-10-14' }), post({ id: 'b', path: '/x', date: '2026-10-20' })]));
    expect(m.some(x => x.includes('/x schon am 2026-10-14'))).toBe(true);
  });
  it('ignores dropped posts', () => {
    expect(messages(cal([post({ id: 'old', date: '2026-10-10', status: 'verworfen' })]))).toEqual([]);
  });
});

describe('posts.json', () => {
  const file = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'posts.json'), 'utf8')) as Calendar;

  it('holds only valid posts with unique ids', () => {
    for (const p of file.posts) expect(validatePost(p), p.id).toBeNull();
    expect(new Set(file.posts.map(p => p.id)).size).toBe(file.posts.length);
  });
  it('starts every channel that has posts with an exposé', () => {
    const channels = new Set(file.posts.filter(p => p.kind !== 'setup' && p.kind !== 'review' && p.kind !== 'answer' && p.kind !== 'outreach').map(p => p.channel));
    for (const ch of channels) expect(file.posts.some(p => p.channel === ch && p.kind === 'expose'), ch).toBe(true);
  });
  it('has nothing the tool would stop', () => {
    expect(warnings(file, '2026-10-05').filter(w => w.level === 'stop')).toEqual([]);
  });
  it('lets no post show covers on another platform without the rights decision', () => {
    const coverChannels = ['instagram', 'pinterest', 'tiktok'];
    for (const p of file.posts.filter(p => coverChannels.includes(p.channel) && (p.kind === 'collection' || p.kind === 'decades' || p.kind === 'batch')))
      expect(p.needs ?? [], p.id).toContain('rechte');
  });
  it('points only at collections that exist in data/collections.json, and waits for a draft to be published', () => {
    const collections = (JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', '..', 'data', 'collections.json'), 'utf8')) as { collections: { slug: string; published: boolean }[] }).collections;
    for (const p of file.posts.filter(p => p.path?.startsWith('/collections/'))) {
      const slug = p.path!.split('/')[2].split('?')[0];
      const c = collections.find(x => x.slug === slug);
      expect(c, `${p.id}: ${slug}`).toBeDefined();
      if (!c!.published) expect(p.needs ?? [], p.id).toContain(`publish:${slug}`);
    }
  });
});
