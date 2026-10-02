/**
 * One album, loaded on request (ROADMAP 5.16a): the release group, its vinyl
 * pressings, a dHash of every front, the label photos of every pressing and
 * the Wikipedia excerpt — in that order, and visible while it fills in. The
 * page polls `snapshot()`; nothing waits for the slowest part.
 *
 * Costs per album, cold: 1 MusicBrainz request for the group, 1–2 for its
 * releases (100 a page; 23–151 releases for the eight measured albums), one
 * front thumbnail per pressing with a front, one Cover Art Archive listing per
 * pressing with artwork (labels have no fixed address), 2–4 Wikipedia/Wikidata
 * requests. Warm: none — a finished album is read from `out/albums/`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { decode, dhash, toGray } from '../../lib/imagehash';
import { sleeveLine } from './captions';
import { foldSleeves } from './fold';
import { byDate, labelsFrom, toPressing, type CaaListedImage, type FullRelease, type Pressing } from './pressing';
import { artistOf } from './rank';
import { MB, pool, SourceError, type Sources } from './sources';
import { artworkFromWikidata, excerpt } from './wiki';

type Step = 'pending' | 'done' | 'failed';

export interface Story { article: string | null; url: string | null; excerpt: string }

export interface AlbumState {
  id: string;
  title: string;
  artist: string;
  first: string;
  /** Releases in all formats, as MusicBrainz counts them. */
  releases: number;
  status: 'loading' | 'done' | 'failed';
  /** Why the album could not be loaded at all; per-pressing failures sit on the pressing. */
  error?: string;
  steps: { group: Step; releases: Step; fronts: { done: number; total: number; failed: number }; labels: { done: number; total: number; failed: number }; story: Step | 'none' };
  pressings: Pressing[];
  sleeves: Array<{ ids: string[]; line: string }>;
  story: Story | null;
  /** Milliseconds from the start: pressings listed, every front hashed, every label listing read, all done. */
  ms: { pressings?: number; folded?: number; labels?: number; done?: number };
}

interface MbGroup {
  id: string; title: string; 'first-release-date'?: string;
  'artist-credit'?: Array<{ name: string; joinphrase?: string }>;
  relations?: Array<{ type: string; url: { resource: string } }>;
}

export interface AlbumOptions {
  sources: Sources;
  dir: string;
  /** The Wikipedia lookup; injectable so tests need no network. */
  story?: (qid: string) => Promise<Story>;
  concurrency?: number;
}

async function wikipediaStory(qid: string): Promise<Story> {
  const found = await artworkFromWikidata(qid);
  return { article: found.article, url: found.url, excerpt: excerpt(found.sections.map(s => s.text).join('\n\n')) };
}

/** A line per sleeve from our own data (captions.ts), without credits or Discogs notes in the MVP. */
export function sleeveLines(pressings: Pressing[]): AlbumState['sleeves'] {
  const byId = new Map(pressings.map(p => [p.id, p]));
  return foldSleeves(pressings).map(({ ids }) => {
    const ps = ids.map(id => byId.get(id)!);
    const years = ps.map(p => p.year).filter(Boolean).sort();
    return {
      ids,
      line: sleeveLine({
        pressings: ps.length, first: years[0] ?? '', last: years.at(-1) ?? '',
        countries: [...new Set(ps.map(p => p.country).filter(Boolean))],
        labels: [...new Set(ps.map(p => p.label).filter(Boolean))],
        mbCredits: [], discogsCredits: [], notes: [],
      }),
    };
  });
}

export function createAlbums({ sources, dir, story = wikipediaStory, concurrency = 4 }: AlbumOptions) {
  const albumDir = join(dir, 'albums');
  mkdirSync(albumDir, { recursive: true });
  const jobs = new Map<string, AlbumState>();
  const file = (id: string) => join(albumDir, `${id}.json`);

  async function run(s: AlbumState) {
    const t0 = Date.now();
    const at = () => Date.now() - t0;
    let group: MbGroup | null;
    try {
      group = await sources.json<MbGroup>(`${MB}/release-group/${s.id}?inc=artist-credits+url-rels&fmt=json`, 'musicbrainz');
    } catch (e) {
      s.steps.group = 'failed'; s.status = 'failed'; s.error = `MusicBrainz did not answer (${(e as Error).message}).`;
      return;
    }
    if (!group) { s.steps.group = 'failed'; s.status = 'failed'; s.error = 'MusicBrainz has no album with this id.'; return; }
    s.steps.group = 'done';
    s.title = group.title;
    s.artist = artistOf(group);
    s.first = group['first-release-date']?.slice(0, 4) ?? '';
    const qid = group.relations?.find(r => r.type === 'wikidata')?.url.resource.match(/Q\d+/)?.[0];

    const releases: FullRelease[] = [];
    try {
      for (let offset = 0; ; offset += 100) {
        const page = await sources.json<{ releases: FullRelease[]; 'release-count': number }>(
          `${MB}/release?release-group=${s.id}&inc=media+labels&fmt=json&limit=100&offset=${offset}`, 'musicbrainz');
        if (!page) break;
        releases.push(...page.releases);
        s.releases = page['release-count'];
        if (offset + 100 >= page['release-count']) break;
      }
    } catch (e) {
      s.steps.releases = 'failed'; s.status = 'failed'; s.error = `MusicBrainz did not list the pressings (${(e as Error).message}).`;
      return;
    }
    // A list that changes while it is paged can repeat a release on the next page.
    const unique = [...new Map(releases.map(r => [r.id, r])).values()];
    s.pressings = unique.map(toPressing).filter((p): p is Pressing => !!p).sort(byDate);
    s.steps.releases = 'done';
    s.ms.pressings = at();
    s.sleeves = sleeveLines(s.pressings);

    const withFront = s.pressings.filter(p => p.front);
    const withListing = s.pressings.filter(p => p.labels === null);
    s.steps.fronts.total = withFront.length;
    s.steps.labels.total = withListing.length;

    const fronts = pool(withFront, concurrency, async p => {
      try {
        const bytes = await sources.image(p.front!);
        const rgba = bytes && decode(bytes);
        if (rgba) { p.hash = dhash(toGray(rgba)); p.front = `/img/${sources.imageFile(p.front!)}`; }
        else p.hashFailed = true;
      } catch { p.hashFailed = true; }
      if (p.hashFailed) s.steps.fronts.failed++;
      s.steps.fronts.done++;
      s.sleeves = sleeveLines(s.pressings);
    }).then(() => { s.ms.folded = at(); });

    const labels = pool(withListing, concurrency, async p => {
      try {
        const listing = await sources.json<{ images: CaaListedImage[] }>(`https://coverartarchive.org/release/${p.id}`, 'coverartarchive');
        p.labels = listing ? labelsFrom(listing.images) : [];
      } catch { p.labelsFailed = true; s.steps.labels.failed++; }
      s.steps.labels.done++;
    }).then(() => { s.ms.labels = at(); });

    const told = (qid ? story(qid) : Promise.resolve(null)).then(
      st => { s.story = st; s.steps.story = st ? 'done' : 'none'; },
      () => { s.steps.story = 'failed'; });

    await Promise.all([fronts, labels, told]);
    s.ms.done = at();
    s.status = 'done';
    appendFileSync(join(dir, 'mvp-timings.jsonl'), JSON.stringify({
      at: new Date().toISOString(), id: s.id, title: s.title, releases: s.releases, vinyl: s.pressings.length,
      fronts: s.steps.fronts, labels: s.steps.labels, sleeves: s.sleeves.length, story: s.steps.story, ms: s.ms,
    }) + '\n');
    // Only a complete album is kept whole; a partial one is asked again next time,
    // and every part that did arrive is already in the source cache.
    if (!s.steps.fronts.failed && !s.steps.labels.failed && s.steps.story !== 'failed') writeFileSync(file(s.id), JSON.stringify(s));
  }

  /**
   * The album as far as it is loaded; starts loading on the first call. A
   * failed album, or one finished with failed parts, stays so until the reader
   * asks again (`retry`), so a page that keeps polling cannot hammer a source
   * that is down. A retry asks only what failed: the rest is in the cache.
   */
  function snapshot(id: string, retry = false): AlbumState {
    const running = jobs.get(id);
    const incomplete = (a: AlbumState) => a.status === 'failed' || (a.status === 'done' && (a.steps.fronts.failed > 0 || a.steps.labels.failed > 0 || a.steps.story === 'failed'));
    if (running && !(retry && incomplete(running))) return running;
    if (existsSync(file(id))) return JSON.parse(readFileSync(file(id), 'utf8')) as AlbumState;
    const s: AlbumState = {
      id, title: '', artist: '', first: '', releases: 0, status: 'loading',
      steps: { group: 'pending', releases: 'pending', fronts: { done: 0, total: 0, failed: 0 }, labels: { done: 0, total: 0, failed: 0 }, story: 'pending' },
      pressings: [], sleeves: [], story: null, ms: {},
    };
    jobs.set(id, s);
    const done = run(s).catch(e => {
      s.status = 'failed';
      s.error = e instanceof SourceError ? `${e.source} did not answer.` : `Loading failed: ${(e as Error).message}`;
    });
    void done.then(() => { if (s.status === 'done') setTimeout(() => jobs.delete(id), 60_000); });
    return s;
  }

  return { snapshot };
}

export type Albums = ReturnType<typeof createAlbums>;
