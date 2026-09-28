/**
 * Collections live in several layers that can drift apart (Julian,
 * 2026-09-25: „the project cockpit needs to think about this syncing
 * issues"). This module compares them, per collection address, and says in
 * plain words what differs and what would bring the layers together. Pure:
 * the generator reads the layers (collect.ts, production.ts) and hands them
 * in.
 *
 * The layers, from the repository outwards:
 *   1. `data/collections.json` as production has it (`origin/main`), and the
 *      working copy on this machine (the local tool and the scripts write it)
 *      — a difference is an uncommitted or unpushed change;
 *   2. online drafts in production's Redis (`curate:draft:<id>`), edited on
 *      /curate by friends and Julian;
 *   3. drafts published from /curate (`collections:content`, slug → record)
 *      and publish switches (`collections:published`), which win over the
 *      file on the running site (lib/collections-live.ts);
 *   4. series lists with `skip` marks (lab/collections/lists/*.json), which a
 *      rebuild with from-isbns.ts reads — and which overwrites the works of
 *      the collection in the file.
 *
 * A layer that could not be read is `null` and is said to be unknown, never
 * taken as empty (CLAUDE.md: a failure must never be reported as a finding).
 */
import type { CollectionPick, CollectionRecord, ContentOverrides, PublishOverrides } from '../../lib/collections';
import type { Draft } from '../../lib/curate/drafts';

export interface WorksDiff {
  added: number;
  removed: number;
  coverChanged: number;
  reordered: boolean;
  /** Title, text, authors or publishers differ. */
  meta: boolean;
}

export function diffRecords(base: CollectionRecord, other: CollectionRecord): WorksDiff {
  const a = new Map(base.works.map(w => [w.id, w]));
  const b = new Map(other.works.map(w => [w.id, w]));
  let added = 0, removed = 0, coverChanged = 0;
  for (const [id, w] of b) {
    const old = a.get(id);
    if (!old) added++;
    else if (old.coverId !== w.coverId) coverChanged++;
  }
  for (const id of a.keys()) if (!b.has(id)) removed++;
  const common = (list: CollectionPick[], other: Map<string, CollectionPick>) => list.filter(w => other.has(w.id)).map(w => w.id).join(',');
  const reordered = common(base.works, b) !== common(other.works, a);
  const names = (r: CollectionRecord) => JSON.stringify([(r.authors ?? []).map(x => x.name).sort(), [...(r.publishers ?? [])].sort()]);
  const meta = base.title !== other.title || (base.intro ?? '') !== (other.intro ?? '') || names(base) !== names(other);
  return { added, removed, coverChanged, reordered, meta };
}

export function isSame(d: WorksDiff): boolean {
  return !d.added && !d.removed && !d.coverChanged && !d.reordered && !d.meta;
}

/** "3 neu, 1 entfernt, 10 Coveränderungen, Reihenfolge" — what a diff says, in words. */
export function describeDiff(d: WorksDiff): string {
  const parts: string[] = [];
  if (d.coverChanged) parts.push(`${d.coverChanged} ${d.coverChanged === 1 ? 'Coveränderung' : 'Coveränderungen'}`);
  if (d.added) parts.push(`${d.added} ${d.added === 1 ? 'Buch' : 'Bücher'} neu`);
  if (d.removed) parts.push(`${d.removed} ${d.removed === 1 ? 'Buch' : 'Bücher'} entfernt`);
  if (d.reordered) parts.push('andere Reihenfolge');
  if (d.meta) parts.push('Titel, Text oder Grenze geändert');
  return parts.length ? parts.join(', ') : 'gleich';
}

export interface ListInfo {
  file: string;
  /** The collection a rebuild writes, and how that was found out. */
  slug: string | null;
  slugSource: string;
  entries: number;
  skipped: number;
  skippedIsbns: string[];
}

export interface SyncInput {
  production: CollectionRecord[] | null;
  local: { label: string; records: CollectionRecord[] } | null;
  drafts: Draft[] | null;
  content: ContentOverrides | null;
  switches: PublishOverrides | null;
  lists: ListInfo[];
}

export type Level = 'ok' | 'info' | 'act';
export interface Verdict { level: Level; text: string }

export interface DraftRow {
  id: string;
  by: string;
  title: string;
  updatedAt: string;
  count: number;
  importedOn: string | null;
  publishedOn: string | null;
  /** Against the working file; null when the file has no collection at this address. */
  vsFile: WorksDiff | null;
  /** Against the published draft at this address, if one is live. */
  vsContent: WorksDiff | null;
}

export interface SlugSync {
  slug: string;
  title: string;
  production: { published: boolean; count: number } | null;
  local: { published: boolean; count: number; vsProduction: WorksDiff | null } | null;
  drafts: DraftRow[];
  /** 'unknown' when production could not be asked. */
  content: { count: number; vsProduction: WorksDiff | null } | null | 'unknown';
  switchValue: boolean | null | 'unknown';
  /** What the running site shows at this address, when all layers are known. */
  live: { published: boolean; count: number; from: 'Datei' | 'veröffentlichter Entwurf' } | null;
  lists: ListInfo[];
  verdicts: Verdict[];
}

function recordOf(d: Draft): CollectionRecord {
  return { slug: d.slug, title: d.title, kind: d.kind, intro: d.intro, published: false, authors: d.authors, publishers: d.publishers, works: d.works };
}

function day(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

/** Every address that any layer knows, with its state in each and what to do. */
export function compareCollections(input: SyncInput): SlugSync[] {
  const prod = new Map((input.production ?? []).map(r => [r.slug, r]));
  const local = new Map((input.local?.records ?? []).map(r => [r.slug, r]));
  const slugs: string[] = [];
  const add = (s: string) => { if (!slugs.includes(s)) slugs.push(s); };
  for (const r of input.local?.records ?? []) add(r.slug);
  for (const r of input.production ?? []) add(r.slug);
  for (const d of input.drafts ?? []) add(d.basedOn ?? d.slug);
  for (const s of Object.keys(input.content ?? {})) add(s);
  for (const s of Object.keys(input.switches ?? {})) add(s);

  return slugs.map(slug => {
    const p = prod.get(slug) ?? null;
    const l = local.get(slug) ?? null;
    const file = l ?? p;
    const c = input.content === null ? 'unknown' : input.content[slug] ?? null;
    const sw = input.switches === null ? 'unknown' : slug in input.switches ? input.switches[slug] : null;
    const drafts: DraftRow[] = (input.drafts ?? [])
      .filter(d => (d.basedOn ?? d.slug) === slug)
      .map(d => ({
        id: d.id, by: d.by ?? '', title: d.title, updatedAt: d.updatedAt, count: d.works.length,
        importedOn: d.importedOn ?? null, publishedOn: d.publishedOn ?? null,
        vsFile: file ? diffRecords(file, recordOf(d)) : null,
        vsContent: c && c !== 'unknown' ? diffRecords(c, recordOf(d)) : null,
      }));

    const live = c === 'unknown' || sw === 'unknown' || (!p && !c)
      ? null
      : (() => {
          const base = c ?? p!;
          return { published: sw ?? base.published, count: base.works.length, from: c ? 'veröffentlichter Entwurf' as const : 'Datei' as const };
        })();

    const row: SlugSync = {
      slug,
      title: l?.title ?? p?.title ?? (c && c !== 'unknown' ? c.title : '') ?? drafts[0]?.title ?? slug,
      production: p ? { published: p.published, count: p.works.length } : null,
      local: l && input.local ? { published: l.published, count: l.works.length, vsProduction: p ? diffRecords(p, l) : null } : null,
      drafts,
      content: c === 'unknown' ? 'unknown' : c ? { count: c.works.length, vsProduction: p ? diffRecords(p, c) : null } : null,
      switchValue: sw,
      live,
      lists: input.lists.filter(x => x.slug === slug),
      verdicts: [],
    };
    if (!row.title) row.title = drafts[0]?.title ?? slug;
    row.verdicts = verdictsFor(row, { file, local: l, prod: p, content: c === 'unknown' ? undefined : c, localLabel: input.local?.label ?? '' });
    return row;
  });
}

function verdictsFor(
  row: SlugSync,
  ctx: { file: CollectionRecord | null; local: CollectionRecord | null; prod: CollectionRecord | null; content: CollectionRecord | null | undefined; localLabel: string },
): Verdict[] {
  const out: Verdict[] = [];
  const { local, prod } = ctx;

  // 1. The working file against production.
  if (local && !prod) {
    out.push({ level: 'act', text: `Nur in der lokalen Datei (${ctx.localLabel}), noch nicht in Produktion — committen und pushen, dann deployt Vercel.` });
  } else if (!local && prod && row.local === null && ctx.localLabel) {
    out.push({ level: 'act', text: `In Produktion, aber nicht mehr in der lokalen Datei (${ctx.localLabel}) — gelöscht? Ein Push nimmt sie von der Seite.` });
  } else if (row.local?.vsProduction && !isSame(row.local.vsProduction)) {
    out.push({ level: 'act', text: `Lokale Datei weicht von Produktion ab (${describeDiff(row.local.vsProduction)}) — committen und pushen, sonst sieht die Seite es nicht.` });
  }
  if (local && prod && local.published !== prod.published) {
    out.push({ level: 'info', text: `Lokal ${local.published ? 'veröffentlicht' : 'Entwurf'}, in Produktion ${prod.published ? 'veröffentlicht' : 'Entwurf'}.` });
  }

  // 2. Online drafts against the file.
  for (const d of row.drafts) {
    const who = d.by ? `von ${d.by}` : 'ohne Namen';
    const when = day(d.updatedAt);
    if (!d.vsFile) {
      out.push({ level: 'act', text: `Neuer Online-Entwurf ${who} (${when}, ${d.count} Bücher), nicht in der Datei — übernehmen (Sammlungs-App) oder veröffentlichen (/curate).` });
      continue;
    }
    if (isSame(d.vsFile)) {
      out.push({ level: 'ok', text: `Online-Entwurf ${who} (${when}) gleicht der Datei.` });
      continue;
    }
    const published = d.vsContent && isSame(d.vsContent);
    const importedAfter = d.importedOn && d.updatedAt.slice(0, 10) > d.importedOn;
    let text = `Online-Entwurf ${who} (${when}, ${d.count} Bücher) hat ${describeDiff(d.vsFile)} gegenüber der Datei`;
    if (published) text += ' — als veröffentlichter Entwurf live, aber nicht in der Datei: übernehmen, sonst hängt die Seite am Redis.';
    else if (d.publishedOn && row.content === 'unknown') text += ` — am ${day(d.publishedOn)} aus /curate veröffentlicht, gilt also wohl online statt der Datei (nicht geprüft: Produktion hat die Lese-Route noch nicht): übernehmen, damit Datei und Seite gleich sind.`;
    else if (importedAfter) text += ` — nach der Übernahme am ${d.importedOn} weiter bearbeitet: noch einmal übernehmen oder veröffentlichen.`;
    else if (d.importedOn) text += ` — am ${d.importedOn} übernommen, die Datei hat sich seitdem geändert (oder die Übernahme ist nicht committet).`;
    else text += ' — nicht in der Datei: übernehmen (Sammlungs-App) oder veröffentlichen (/curate).';
    out.push({ level: published ? 'info' : 'act', text });
    if (d.vsContent && !isSame(d.vsContent) && d.publishedOn) {
      out.push({ level: 'act', text: `Online-Entwurf ${who} nach dem Veröffentlichen (${day(d.publishedOn)}) geändert (${describeDiff(d.vsContent)}): online gilt noch der alte Stand — erneut veröffentlichen.` });
    }
  }

  // 3. What wins on the running site.
  // Unknown layers are said once, above the table, not on every row.
  if (row.content !== 'unknown' && row.switchValue !== 'unknown') {
    if (row.content && ctx.content) {
      const vs = ctx.file ? diffRecords(ctx.file, ctx.content) : null;
      if (vs && isSame(vs)) out.push({ level: 'info', text: 'Veröffentlichter Entwurf gleicht inzwischen der Datei — kann geräumt werden (die Übernahme in der Sammlungs-App räumt ihn ab).' });
      else out.push({ level: 'act', text: `Auf der Seite gilt der veröffentlichte Entwurf (${ctx.content.works.length} Bücher), nicht die Datei${vs ? ` (${describeDiff(vs)})` : ''} — übernehmen, damit Datei und Seite gleich sind.` });
    }
    if (row.switchValue !== null && ctx.file) {
      const base = ctx.content ?? prod ?? ctx.file;
      if (row.switchValue !== base.published) {
        out.push({ level: 'act', text: `Schalter in Produktion: ${row.switchValue ? 'veröffentlicht' : 'zurückgezogen'}, die Datei sagt ${base.published ? 'veröffentlicht' : 'Entwurf'} — „published" in der Datei nachziehen, sonst hängt es am Redis.` });
      }
    }
  }

  // 4. Series lists that a rebuild reads.
  for (const list of row.lists) {
    const hand = ctx.file ? ctx.file.works.filter(w => !w.from?.startsWith('isbn:')).length : 0;
    const stillIn = ctx.file ? ctx.file.works.filter(w => w.coverIsbn && list.skippedIsbns.includes(w.coverIsbn)).length : 0;
    const bits = [`${list.entries} Einträge, ${list.skipped} mit „skip“`];
    if (stillIn) bits.push(`${stillIn} übersprungene ISBNs stehen noch in der Datei — die Liste ist neuer als die Wand: neu bauen oder die Markierung prüfen`);
    if (hand) bits.push(`${hand} Bücher der Datei tragen eine Auswahl von Hand (kein „isbn:“-Ursprung); ein Neubau setzte sie auf das Listen-Cover zurück`);
    const pending = row.drafts.some(d => d.vsFile && !isSame(d.vsFile));
    if (pending) bits.push('ein Online-Entwurf ist nicht übernommen — ein Neubau schriebe die Datei neu, nicht den Entwurf');
    out.push({ level: 'info', text: `Liste ${list.file} (${list.slugSource}): ${bits.join('; ')}.` });
  }

  if (!out.some(v => v.level !== 'ok') && row.drafts.length === 0) out.push({ level: 'ok', text: 'Alle bekannten Ebenen stimmen überein.' });
  return out;
}

/** Which collection a series list feeds: a documented command line, the same name, or a name prefix. */
export function listSlug(file: string, slugs: string[], documented: Array<{ file: string; slug: string }>): { slug: string | null; source: string } {
  const base = file.replace(/^.*\//, '').replace(/\.json$/, '');
  const doc = documented.find(d => d.file.endsWith(`/${base}.json`) || d.file === file);
  if (doc) return { slug: doc.slug, source: 'dokumentierter Aufruf' };
  if (slugs.includes(base)) return { slug: base, source: 'gleicher Name' };
  const prefix = slugs.filter(s => base.startsWith(`${s}-`)).sort((a, b) => b.length - a.length)[0];
  if (prefix) return { slug: prefix, source: 'vermutet über den Namen' };
  return { slug: null, source: 'keiner Sammlung zugeordnet' };
}

/** `npx tsx lab/collections/from-isbns.ts <list> <slug> …` lines in the docs. */
export function documentedRebuilds(text: string): Array<{ file: string; slug: string }> {
  return [...text.matchAll(/from-isbns\.ts\s+(\S+\.json)\s+([a-z0-9-]+)/g)].map(m => ({ file: m[1], slug: m[2] }));
}
