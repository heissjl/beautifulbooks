/**
 * The posting calendar (ROADMAP 5.6b): pure rules over `posts.json`, shared by
 * the local tool (`serve.ts`) and its tests.
 *
 * The calendar proposes; Julian posts. Nothing here talks to a platform — a
 * post's link is built so that he can copy it, and its status changes only
 * when he says so in the tool (the boundary from ROADMAP 5.6).
 */

/**
 * The channels the calendar plans for. Their names are the `?via=` classes of
 * 5.6a (`VIA` in lib/insights/signals.ts on the 5.6a branch), so that a link
 * posted here is counted under the channel it was posted on. `alle` is for
 * setup and review entries that belong to no single channel and carry no link.
 */
export const CHANNELS = ['bluesky', 'x', 'instagram', 'pinterest', 'tiktok', 'reddit', 'hn', 'producthunt', 'mail', 'alle'] as const;
export type Channel = (typeof CHANNELS)[number];

export const STATUSES = ['vorschlag', 'freigegeben', 'gepostet', 'verworfen'] as const;
export type Status = (typeof STATUSES)[number];

export const KINDS = ['setup', 'expose', 'collection', 'decades', 'feature', 'launch', 'answer', 'outreach', 'batch', 'review', 'galerie'] as const;
export type Kind = (typeof KINDS)[number];

export interface Post {
  id: string;
  /** YYYY-MM-DD, the day it is meant to go out. */
  date: string;
  /** HH:MM, Berlin time; only where the hour matters (HN, Reddit). */
  time?: string;
  channel: Channel;
  kind: Kind;
  /** Pin title, HN/Reddit/Product Hunt title; empty where the platform has none. */
  title?: string;
  /** The words to post, or for setup entries the task. */
  text: string;
  /** A path on the site, e.g. `/collections/sf-masterworks`; the tool adds the address and `?via=`. */
  path?: string;
  /** What picture goes with it, in words; the tool makes none. */
  image?: string;
  /** Prerequisites, by name (see NEEDS); a post waits until all are in `done`. */
  needs?: string[];
  status: Status;
  note?: string;
  /** Where it went out, once posted. */
  postedUrl?: string;
}

export interface Calendar {
  /** The address links are built on. */
  site: string;
  /** Prerequisites that are met. */
  done: string[];
  posts: Post[];
}

/**
 * The prerequisites a post can wait on, with what each means. A `publish:<slug>`
 * need (a draft collection that must be published first) is allowed besides.
 */
export const NEEDS: Record<string, string> = {
  rechte: 'Julian hat Weg (a) gewählt: Cover dürfen auf fremden Plattformen gezeigt werden (PLAN-5.5-5.6 §6 Frage 1)',
  '5.6a': '5.6a ist deployt: ?via= und die Plattform-Herkunft werden gezählt',
  kapazitaet: '0.2, 0.13 und 2.4 erledigt: eigener Google-Schlüssel, Kontingent-Alarm, Firewall auf Log',
  '5.5a': 'Pin-Format 1000×1500 gebaut',
  ffmpeg: 'ffmpeg installiert, Clips aus lab/video kodiert',
  'konto:bluesky': 'Bluesky-Konto angelegt',
  'konto:instagram': 'Instagram-Konto angelegt',
  'konto:pinterest': 'Pinterest-Unternehmenskonto angelegt, Website bestätigt',
  'konto:tiktok': 'TikTok-Konto angelegt',
  spiel: 'Das Cover-Spiel (/versus) ist in Produktion eingeschaltet',
  walls: 'Eigene Sammlungen (/create) sind in Produktion eingeschaltet',
};

export function knownNeed(need: string): boolean {
  return need in NEEDS || /^publish:[a-z0-9-]+$/.test(need) || /^clip:[a-z0-9-]+$/.test(need);
}

/**
 * Characters a platform takes. Bluesky counts the link if it is pasted into the
 * text, which is how the tool copies it; the others take the link elsewhere.
 */
export const LIMITS: Partial<Record<Channel, { text?: number; title?: number }>> = {
  bluesky: { text: 300 },
  x: { text: 280 },
  instagram: { text: 2200 },
  tiktok: { text: 2200 },
  pinterest: { title: 100, text: 500 },
  hn: { title: 80 },
  reddit: { title: 300 },
  producthunt: { title: 60, text: 260 },
};

/** Graphemes, roughly: code points, which is what a person counts for Latin text. */
const length = (s: string): number => [...s].length;

export function linkFor(post: Pick<Post, 'path' | 'channel'>, site: string): string | null {
  if (!post.path || post.channel === 'alle') return null;
  const url = new URL(post.path, site);
  // X has no class in 5.6a's VIA list; a mark there would be dropped anyway.
  if (post.channel !== 'x') url.searchParams.set('via', post.channel);
  return url.toString();
}

/**
 * Where the link does not go into the post: Instagram and TikTok take it in the
 * profile only, and a gallery (Julian, 2026-10-04, after a Depero gallery on X
 * with 48K views) is one sentence and four pictures — its link goes into the
 * first reply, because a link in the post itself shrinks its reach.
 */
export function linkElsewhere(post: Pick<Post, 'channel' | 'kind'>): boolean {
  return post.channel === 'instagram' || post.channel === 'tiktok' || post.kind === 'galerie';
}

/** What the tool puts on the clipboard: the text, and the link where the platform takes it inline. */
export function clipboardFor(post: Post, site: string): string {
  const link = linkFor(post, site);
  if (!link || linkElsewhere(post)) return post.text;
  return `${post.text}\n\n${link}`;
}

export function openNeeds(post: Pick<Post, 'needs'>, done: readonly string[]): string[] {
  return (post.needs ?? []).filter(n => !done.includes(n));
}

/** Monday of the ISO week a date falls in, as YYYY-MM-DD. */
export function weekOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * Moves every post from `from` on by `days`, except what has gone out or was
 * dropped; optionally only one channel. The way to say "a week later" without
 * touching thirty entries.
 */
export function shiftFrom(posts: readonly Post[], from: string, days: number, channel?: Channel): Post[] {
  return posts.map(p =>
    p.date >= from && p.status !== 'gepostet' && p.status !== 'verworfen' && (!channel || p.channel === channel)
      ? { ...p, date: addDays(p.date, days) }
      : p,
  );
}

export function sortPosts(posts: readonly Post[]): Post[] {
  return [...posts].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.channel.localeCompare(b.channel) || a.id.localeCompare(b.id));
}

export interface Warning {
  postId?: string;
  level: 'stop' | 'hinweis';
  message: string;
}

/**
 * Words the site never says about itself: completeness (CLAUDE.md) and the
 * ranking superlatives PLAN-5 §2 rules out. A hit is a prompt to look, not a
 * verdict — "not all of them" may be fine.
 */
const FORBIDDEN = /\b(all|every|complete|completely|best|most beautiful|ugliest|prettiest)\b/i;

const live = (p: Post): boolean => p.status !== 'verworfen';

export function validatePost(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'kein Post';
  const x = p as Partial<Post>;
  if (!x.id || !/^[a-z0-9-]+$/.test(x.id)) return 'id fehlt oder enthält mehr als a–z, 0–9, -';
  if (!x.date || !/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return 'Datum fehlt (YYYY-MM-DD)';
  if (x.time && !/^\d{2}:\d{2}$/.test(x.time)) return 'Uhrzeit als HH:MM';
  if (!CHANNELS.includes(x.channel as Channel)) return `unbekannter Kanal ${x.channel}`;
  if (!KINDS.includes(x.kind as Kind)) return `unbekannte Art ${x.kind}`;
  if (!STATUSES.includes(x.status as Status)) return `unbekannter Status ${x.status}`;
  if (typeof x.text !== 'string') return 'Text fehlt';
  if (x.path && !x.path.startsWith('/')) return 'Pfad beginnt mit /';
  const bad = (x.needs ?? []).find(n => !knownNeed(n));
  if (bad) return `unbekannte Voraussetzung ${bad}`;
  return null;
}

/** Everything the tool flags, against today's date. */
export function warnings(cal: Calendar, today: string): Warning[] {
  const out: Warning[] = [];
  const posts = sortPosts(cal.posts).filter(live);

  for (const p of posts) {
    const open = openNeeds(p, cal.done);
    if (p.status !== 'gepostet' && p.date < today) out.push({ postId: p.id, level: 'hinweis', message: `überfällig seit ${p.date}: posten, verschieben oder verwerfen` });
    if (p.status === 'freigegeben' && open.length > 0 && daysBetween(today, p.date) <= 3)
      out.push({ postId: p.id, level: 'stop', message: `freigegeben, aber es fehlt noch: ${open.join(', ')}` });
    if (p.kind === 'galerie' && !(p.needs ?? []).includes('rechte')) out.push({ postId: p.id, level: 'stop', message: 'eine Galerie lädt Cover hoch: sie wartet auf die Rechte-Entscheidung' });
    if (p.status === 'gepostet' && open.includes('rechte')) out.push({ postId: p.id, level: 'stop', message: 'als gepostet markiert, obwohl die Rechte-Entscheidung offen ist' });

    const limit = p.kind === 'setup' || p.kind === 'review' || p.kind === 'answer' || p.kind === 'outreach' || p.kind === 'batch' ? undefined : LIMITS[p.channel];
    const link = linkFor(p, cal.site);
    const textLength = p.channel === 'bluesky' ? length(clipboardFor(p, cal.site)) : length(p.text);
    if (limit?.text && textLength > limit.text) out.push({ postId: p.id, level: 'stop', message: `Text ${textLength} Zeichen, ${p.channel} nimmt ${limit.text}${p.channel === 'bluesky' && link ? ' (mit Link)' : ''}` });
    if (limit?.title && p.title && length(p.title) > limit.title) out.push({ postId: p.id, level: 'stop', message: `Titel ${length(p.title)} Zeichen, ${p.channel} nimmt ${limit.title}` });

    if (p.kind !== 'setup' && p.kind !== 'review') {
      const hit = `${p.title ?? ''} ${p.text}`.match(FORBIDDEN);
      if (hit) out.push({ postId: p.id, level: 'hinweis', message: `„${hit[0]}“: die Seite verspricht keine Vollständigkeit und keine Rangliste — prüfen` });
    }
  }

  // The exposé goes first on every channel that has one.
  const channels = new Set(posts.map(p => p.channel));
  for (const ch of channels) {
    const expose = posts.find(p => p.channel === ch && p.kind === 'expose');
    if (!expose) continue;
    for (const p of posts) {
      if (p.channel === ch && p.kind !== 'setup' && p.kind !== 'expose' && p.kind !== 'answer' && p.kind !== 'review' && p.date < expose.date)
        out.push({ postId: p.id, level: 'hinweis', message: `liegt vor dem Exposé auf ${ch} (${expose.date})` });
    }
  }

  // HN and the Reddit launch a week or two apart, or the counts cannot tell them apart (PLAN-5.5-5.6 §2.1).
  const launches = posts.filter(p => p.kind === 'launch' || (p.kind === 'expose' && (p.channel === 'hn' || p.channel === 'reddit' || p.channel === 'producthunt')));
  for (let i = 0; i < launches.length; i++)
    for (let j = i + 1; j < launches.length; j++) {
      const gap = Math.abs(daysBetween(launches[i].date, launches[j].date));
      if (launches[i].channel !== launches[j].channel && gap < 7)
        out.push({ postId: launches[j].id, level: 'hinweis', message: `nur ${gap} Tage nach dem Launch auf ${launches[i].channel}: die Messung trennt die beiden dann kaum` });
    }

  // Reddit answers: a few a week, never more, or the account counts as spam.
  const answers = new Map<string, number>();
  for (const p of posts.filter(p => p.channel === 'reddit' && p.kind === 'answer')) answers.set(weekOf(p.date), (answers.get(weekOf(p.date)) ?? 0) + 1);
  for (const [week, n] of answers) if (n > 3) out.push({ level: 'stop', message: `${n} Reddit-Antworten in der Woche ab ${week}: höchstens drei` });

  // The same page twice on one channel within two weeks reads as a repeat.
  for (let i = 0; i < posts.length; i++)
    for (let j = i + 1; j < posts.length; j++) {
      const a = posts[i], b = posts[j];
      if (a.path && a.path === b.path && a.channel === b.channel && a.kind !== 'answer' && a.kind !== 'galerie' && b.kind !== 'galerie' && daysBetween(a.date, b.date) < 14)
        out.push({ postId: b.id, level: 'hinweis', message: `${a.path} schon am ${a.date} auf ${a.channel}` });
    }

  return out;
}
