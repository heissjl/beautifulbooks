/**
 * A caption for each sleeve without a language model (ROADMAP 5.16; Julian,
 * 2026-09-29: „ist es einfacher nur den text aus wikipedia zu finden und
 * darzustellen, statt zusammenzufassen? 22$ für 1000 anfragen ist auch viel
 * zu teuer"). One line set from our own timeline and the credits, and at
 * most one Discogs note quoted as written — all CC0, nothing invented.
 */

export interface SleeveFacts {
  pressings: number; first: string; last: string; countries: string[]; labels: string[];
  mbCredits: string[]; discogsCredits: string[]; notes: string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Photography By [Cover Photo]: Jay Maisel" and "photography: Jay Maisel" → "Photo: Jay Maisel". */
export function sleeveCredits(facts: Pick<SleeveFacts, 'mbCredits' | 'discogsCredits'>): string[] {
  const kind = (role: string) =>
    /design/i.test(role) ? 'Design' : /photo/i.test(role) ? 'Photo' : /paint/i.test(role) ? 'Painting'
      : /illustrat/i.test(role) ? 'Illustration' : /art direction/i.test(role) ? 'Art direction' : /art(work)?|cover/i.test(role) ? 'Artwork' : null;
  const split = (c: string) => { const i = c.lastIndexOf(': '); return i < 0 ? null : { role: c.slice(0, i), name: c.slice(i + 2).replace(/ \(\d+\)$/, '') }; };
  const all = [...facts.mbCredits, ...facts.discogsCredits].map(split).filter((c): c is { role: string; name: string } => !!c && !!c.name);
  // Back-cover photos, sleeve notes and inserts are not the picture on the front. A name that Discogs
  // gives only for those also drops out of MusicBrainz's plainer "photography: …" (Autobahn: Barbara Niemöller).
  const notFront = /notes|back ?cover|backcover|liner|inner|booklet|label|insert/i;
  const elsewhere = new Set(all.filter(c => notFront.test(c.role)).map(c => c.name));
  const front = new Set(all.filter(c => !notFront.test(c.role) && /\[(cover|front)/i.test(c.role)).map(c => c.name));
  // Credits arrive once per pressing that names them; keep the names most pressings agree on.
  const counts = new Map<string, Map<string, number>>();
  for (const { role, name } of all) {
    if (notFront.test(role) || (elsewhere.has(name) && !front.has(name) && !/paint|design|illustrat/i.test(role))) continue;
    const k = kind(role);
    if (!k) continue;
    if (!counts.has(k)) counts.set(k, new Map());
    counts.get(k)!.set(name, (counts.get(k)!.get(name) ?? 0) + 1);
  }
  const top = Math.max(0, ...[...counts.values()].flatMap(m => [...m.values()]));
  return [...counts]
    .map(([k, m]) => ({ k, names: [...m].filter(([, n]) => n >= Math.ceil(top / 3)).sort((a, b) => b[1] - a[1]).slice(0, 2) }))
    .filter(x => x.names.length)
    .sort((a, b) => b.names[0][1] - a.names[0][1])
    .slice(0, 3)
    .map(x => `${x.k}: ${x.names.map(([name]) => name).join(', ')}`);
}

/** The first line: label, years, how many pressings in how many countries, and who made the picture. */
export function sleeveLine(facts: SleeveFacts): string {
  const years = facts.first && facts.last && facts.first !== facts.last ? `${facts.first}–${facts.last}` : facts.first || 'year unknown';
  const parts = [
    facts.labels.slice(0, 2).join(', ') || 'Label unknown',
    years,
    `${plural(facts.pressings, 'pressing')} with a photo${facts.countries.length ? `, ${plural(facts.countries.length, 'country', 'countries')}` : ''}`,
    ...sleeveCredits(facts),
  ];
  return parts.join(' · ');
}

/**
 * The one note worth showing: one that says what sets the sleeve apart, not
 * where it was printed. Returns null rather than a production detail.
 */
export function distinguishingNote(notes: string[]): string | null {
  const clean = notes.map(n => n.replace(/^[-–•\s]+/, '').replace(/&#13;/g, '').trim()).filter(n => n.length > 12 && n.length < 240);
  const telling = /\b(different|unique|alternat\w*|variant|instead of|rather than|misprint\w*|censor\w*|replac\w*|reconstruct\w*|design|photograph\w*|painting|artwork|colou?r(ed)?)\b/i;
  const routine = /\b(printed (in|by)|made in|sticker|shrink|cat(alog(ue)?)?[#.\s]*(no|number)?\b.*\d|barcode|distributed|℗|©|price|runout|matrix)\b/i;
  return clean.find(n => telling.test(n) && !routine.test(n)) ?? null;
}
