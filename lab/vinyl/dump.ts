/**
 * Pure readers for the Discogs monthly dump (CC0, data.discogs.com), ROADMAP
 * 5.16. One `<release>…</release>` element in, the fields the measurement
 * needs out; no XML library, because the dump is regular and 10 GB large.
 *
 * The colour of the record is free text in `format[@text]` (Discogs
 * guideline 6: "any non-standard color of the audio carrier", black left
 * out). The same field also carries label, sleeve and obi colours ("Green WB
 * Labels", "Yellow Cover", "Green Obi"), weights and editions, so
 * `vinylColour` reads it segment by segment and drops any segment that names
 * another part of the record.
 */

export interface DumpFormat { name: string; qty: string; text: string; descriptions: string[] }
export interface DumpRelease {
  id: number;
  masterId: number | null;
  title: string;
  country: string;
  released: string;
  formats: DumpFormat[];
  catnos: string[];
  barcodes: string[];
  /** Number of `<image>` elements, or null when the element is absent altogether. */
  images: number | null;
  /** Release credits (`extraartists`) as role and name, e.g. "Design" — "Hipgnosis". */
  credits: Array<{ role: string; name: string }>;
  /** Free-text notes, where editors explain what sets a pressing apart. */
  notes: string;
}

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = (tag: string, name: string) => decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '');
const text = (xml: string, tag: string) => decode(xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? '');

/** Credit roles that describe the sleeve, as Discogs spells them (role text may carry a bracket: "Photography By [Cover]"). */
export const SLEEVE_ROLE_RE = /\b(design|designed|artwork|art direction|art by|cover|photography|photo|illustration|painting|layout|lettering|sleeve|typography)\b/i;

export function parseDumpRelease(xml: string): DumpRelease | null {
  const id = Number(xml.match(/<release id="(\d+)"/)?.[1]);
  if (!id) return null;
  const master = xml.match(/<master_id[^>]*>(\d+)<\/master_id>/)?.[1];
  const formats: DumpFormat[] = [];
  for (const m of xml.matchAll(/<format ([^>]*?)(?:\/>|>([\s\S]*?)<\/format>)/g)) {
    formats.push({
      name: attr(m[1], 'name'),
      qty: attr(m[1], 'qty'),
      text: attr(m[1], 'text'),
      descriptions: [...(m[2] ?? '').matchAll(/<description>([^<]*)<\/description>/g)].map(d => decode(d[1])),
    });
  }
  const labels = xml.match(/<labels>([\s\S]*?)<\/labels>/)?.[1] ?? '';
  const identifiers = xml.match(/<identifiers>([\s\S]*?)<\/identifiers>/)?.[1] ?? '';
  const imagesBlock = xml.match(/<images>([\s\S]*?)<\/images>|<images\s*\/>/);
  return {
    id,
    masterId: master ? Number(master) : null,
    title: text(xml, 'title'),
    country: text(xml, 'country'),
    released: text(xml, 'released'),
    formats,
    catnos: [...labels.matchAll(/<label ([^>]*)\/?>/g)].map(m => attr(m[1], 'catno')).filter(c => c && c.toLowerCase() !== 'none'),
    barcodes: [...identifiers.matchAll(/<identifier ([^>]*)\/?>/g)]
      .filter(m => attr(m[1], 'type') === 'Barcode').map(m => attr(m[1], 'value')),
    images: imagesBlock ? (imagesBlock[1]?.match(/<image\b/g)?.length ?? 0) : null,
    credits: [...(xml.match(/<extraartists>([\s\S]*?)<\/extraartists>/)?.[1] ?? '').matchAll(/<artist>([\s\S]*?)<\/artist>/g)]
      .map(m => ({ role: text(m[1], 'role'), name: text(m[1], 'name') })),
    notes: decode(xml.match(/<notes>([\s\S]*?)<\/notes>/)?.[1] ?? ''),
  };
}

export const isVinylFormat = (f: DumpFormat) => f.name === 'Vinyl';

const COLOUR_WORDS = [
  'red', 'blue', 'green', 'yellow', 'white', 'clear', 'transparent', 'translucent', 'orange', 'pink', 'purple', 'violet',
  'gold', 'golden', 'silver', 'grey', 'gray', 'brown', 'cream', 'bone', 'beige', 'tan', 'teal', 'turquoise', 'magenta',
  'maroon', 'burgundy', 'navy', 'aqua', 'mint', 'lavender', 'lilac', 'coke bottle', 'smoke', 'smoky', 'crystal',
  'marble', 'marbled', 'splatter', 'splattered', 'swirl', 'swirled', 'haze', 'galaxy', 'colou?red', 'multicolou?r(?:ed)?',
  'glow in the dark', 'opaque', 'black',
];
const COLOUR_RE = new RegExp(`\\b(${COLOUR_WORDS.join('|')})\\b`, 'i');
/** A segment naming another part of the record describes that part, not the vinyl. */
const OTHER_PART_RE = /\b(labels?|cover|sleeves?|jacket|obi|insert|inner|sticker|print(?:ed)?|stamp(?:ed)?|box|slipcase|poster|booklet|spine|lettering|text|font|logo|artwork)\b/i;

/**
 * The colour of the record from one format's free text, or null when the text
 * names none. Returns the first colour segment as written ("Red Translucent").
 * "Black" counts: Discogs leaves plain black out, so a "Black" in the text is
 * usually a deliberate variant ("Black / White Split") or a note beside one.
 */
export function vinylColour(formatText: string): string | null {
  const t = formatText.replace(/white[- ]label/gi, '');
  for (const segment of t.split(/[,;]+/).map(s => s.trim()).filter(Boolean)) {
    if (OTHER_PART_RE.test(segment)) continue;
    if (COLOUR_RE.test(segment)) return segment;
  }
  return null;
}

/** Picture disc, shaped or etched: the structured descriptions Discogs does have. */
export function specialVinyl(f: DumpFormat): string[] {
  return f.descriptions.filter(d => /^(Picture Disc|Shape|Etched)$/i.test(d));
}
