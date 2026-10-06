/**
 * The posting calendar (ROADMAP 5.6b): a local tool to read, change, approve
 * and tick off the proposed posts in `posts.json`.
 *
 *   npx tsx lab/kalender/serve.ts     # then open http://localhost:4325
 *
 * Local only, never deployed, and it talks to no platform and no catalogue:
 * it reads and writes one file. Posting stays Julian's, by hand (ROADMAP 5.6).
 * Set `KALENDER_FILE` to point it elsewhere when testing.
 */
import { createServer, type IncomingMessage } from 'node:http';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHANNELS, KINDS, LIMITS, NEEDS, STATUSES, clipboardFor, linkFor, openNeeds, shiftFrom, sortPosts, validatePost, warnings, type Calendar, type Channel, type Post } from './model';

const FILE = process.env.KALENDER_FILE ?? join(import.meta.dirname, 'posts.json');
const HTML = join(import.meta.dirname, 'index.html');
const PORT = Number(process.env.PORT ?? 4325);

// Read afresh for every request: Julian or a session may have edited the file by hand.
const load = (): Calendar => JSON.parse(readFileSync(FILE, 'utf8')) as Calendar;

function save(cal: Calendar): void {
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ ...cal, posts: sortPosts(cal.posts) }, null, 2)}\n`);
  renameSync(tmp, FILE);
}

const today = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

function view(cal: Calendar) {
  return {
    site: cal.site,
    done: cal.done,
    today: today(),
    channels: CHANNELS,
    kinds: KINDS,
    statuses: STATUSES,
    needs: NEEDS,
    limits: LIMITS,
    posts: sortPosts(cal.posts).map(p => ({ ...p, link: linkFor(p, cal.site), clipboard: clipboardFor(p, cal.site), open: openNeeds(p, cal.done) })),
    warnings: warnings(cal, today()),
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>) : {};
}

const server = createServer(async (req, res) => {
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(readFileSync(HTML));
    }
    if (req.method === 'GET' && url.pathname === '/api/calendar') return send(200, view(load()));
    if (req.method !== 'POST') return send(404, { error: 'not found' });

    const cal = load();
    const b = await body(req);
    switch (url.pathname) {
      case '/api/post': {
        // Upsert; `previousId` lets a rename keep the entry instead of duplicating it.
        const post = b.post as Post;
        const problem = validatePost(post);
        if (problem) return send(400, { error: problem });
        const previous = typeof b.previousId === 'string' ? b.previousId : post.id;
        if (previous !== post.id && cal.posts.some(p => p.id === post.id)) return send(400, { error: `id ${post.id} gibt es schon` });
        const clean = Object.fromEntries(Object.entries(post).filter(([, v]) => v !== '' && v !== undefined && !(Array.isArray(v) && v.length === 0))) as unknown as Post;
        const rest = cal.posts.filter(p => p.id !== previous);
        save({ ...cal, posts: [...rest, clean] });
        break;
      }
      case '/api/delete': {
        save({ ...cal, posts: cal.posts.filter(p => p.id !== b.id) });
        break;
      }
      case '/api/shift': {
        const from = String(b.from ?? '');
        const days = Number(b.days);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !Number.isInteger(days) || Math.abs(days) > 120) return send(400, { error: 'Datum oder Tage ungültig' });
        const channel = CHANNELS.includes(b.channel as Channel) ? (b.channel as Channel) : undefined;
        save({ ...cal, posts: shiftFrom(cal.posts, from, days, channel) });
        break;
      }
      case '/api/done': {
        const need = String(b.need ?? '');
        const done = b.on ? [...new Set([...cal.done, need])] : cal.done.filter(n => n !== need);
        save({ ...cal, done });
        break;
      }
      default:
        return send(404, { error: 'not found' });
    }
    send(200, view(load()));
  } catch (err) {
    send(400, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`kalender: ${load().posts.length} posts in ${FILE}`);
  console.log(`open http://localhost:${PORT}`);
});
