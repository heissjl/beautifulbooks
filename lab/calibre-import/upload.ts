/**
 * The chosen books as a collection on the site (lab/calibre-import, ROADMAP 5.17).
 *
 * One request: `POST <base>/api/walls {title, tiles}` with the visitor id as
 * the cookie the site itself sets (E22). The new collection is **not saved**
 * — it lapses after 48 hours unless Julian presses "Keep it" on the site
 * (5.13j); this tool never sends `save`.
 *
 * **The visitor id is the key to Julian's collections.** It comes from
 * `BB_VISITOR` — or, with `--as-test`, from `BB_TEST_VISITOR`, the visitor
 * kept for tests on the live site — (the environment, else the main folder's
 * `.env.local`), goes
 * into the cookie header and nowhere else: no message, no file, no address
 * built here carries it, and a test holds every output against it.
 *
 * What goes up per tile is what `validTile` keeps — work, cover, title,
 * author, at most the ISBN — nothing else from Calibre.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseEnv } from '../../scripts/cockpit/env';
import { userAgent } from '../../lib/seo';
import { isVisitorId, isWallId, MAX_TILES, normalVisitorId, validTile, type Tile } from '../../lib/walls/model';

export const DEFAULT_TITLE = 'My Calibre library';

export class UploadError extends Error {}

export const isLocalBase = (base: string): boolean => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);

/** Julian's own id. */
export const VISITOR_VAR = 'BB_VISITOR';
/**
 * A visitor of its own for tests on the live site (Julian, 2026-10-03: „benutze
 * vielleicht eine dedizierte test-user ID, mit der wir in production testen").
 * What a test creates there never lands among Julian's own collections.
 */
export const TEST_VISITOR_VAR = 'BB_TEST_VISITOR';

/** The named variable from the environment, else from the main folder's `.env.local`; null when neither has a usable id. */
export function visitorFromEnv(env: Record<string, string | undefined> = process.env, cwd: string = process.cwd(), name: string = VISITOR_VAR): string | null {
  const given = env[name];
  if (given) return isVisitorId(normalVisitorId(given)) ? normalVisitorId(given) : null;
  try {
    // A worktree has no .env.local of its own; the main folder is where git keeps the common directory.
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd, encoding: 'utf8' }).trim();
    const file = join(dirname(common), '.env.local');
    if (!existsSync(file)) return null;
    const value = parseEnv(readFileSync(file, 'utf8')).get(name);
    return value && isVisitorId(normalVisitorId(value)) ? normalVisitorId(value) : null;
  } catch {
    return null;
  }
}

export interface UploadRequest {
  base: string;
  visitor: string;
  title: string;
  tiles: readonly Tile[];
}

export interface Uploaded {
  wallId: string;
  /** How many tiles the site kept (it drops a cover that appears twice). */
  tiles: number;
  editUrl: string;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>;

/** Creates the collection. Throws `UploadError` with a sentence that never holds the visitor id. */
export async function uploadWall(req: UploadRequest, send: Fetch = fetch): Promise<Uploaded> {
  if (!isVisitorId(req.visitor)) throw new UploadError('The visitor ID is not in the shape the site gives out.');
  if (req.tiles.length === 0) throw new UploadError('No book is ticked — nothing to make a collection of.');
  if (req.tiles.length > MAX_TILES) throw new UploadError(`${req.tiles.length} tiles, and a collection holds ${MAX_TILES}. Untick some, or split the library.`);
  const tiles = req.tiles.map(validTile);
  let res: Awaited<ReturnType<Fetch>>;
  try {
    res = await send(`${req.base}/api/walls`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `bb_visitor=${req.visitor}`, 'user-agent': userAgent(req.base) },
      body: JSON.stringify({ title: req.title, tiles }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    // The cause may quote the request; it is not passed on.
    throw new UploadError(`${req.base} did not answer. Nothing is known to have been created — look at "Your collections" before trying again.`);
  }
  if (res.status === 404) throw new UploadError(`${req.base} has readers' collections switched off (WALLS).`);
  if (res.status === 429) throw new UploadError('The site says: too many requests. Wait a minute.');
  if (!res.ok) throw new UploadError(`The site answered ${res.status}. Nothing was created.`);
  const wall = ((await res.json().catch(() => null)) as { wall?: { id?: unknown; tiles?: unknown[] } } | null)?.wall;
  if (!wall || !isWallId(wall.id)) throw new UploadError('The site answered without a collection.');
  return { wallId: wall.id, tiles: Array.isArray(wall.tiles) ? wall.tiles.length : 0, editUrl: `${req.base}/c/${wall.id}/edit` };
}
