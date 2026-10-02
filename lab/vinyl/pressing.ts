/**
 * A MusicBrainz release as the album page shows it: one vinyl pressing with
 * its sides (ROADMAP 5.16a). Pure, no network; `album.ts` does the asking.
 *
 * Front and back need no Cover Art Archive listing: the release itself says
 * whether the archive has them (`cover-art-archive.front` / `.back`), and the
 * archive serves them under fixed addresses. Labels (`Medium`) have no such
 * address, so they come from the release's listing, read by `labelsFrom`.
 */
import { isVinyl, vinylColourNote, type MbRelease } from './parse';

export interface LabelInfo { 'catalog-number'?: string | null; label?: { name: string } | null }
export type FullRelease = MbRelease & { barcode?: string | null; status?: string; 'label-info'?: LabelInfo[] };

export interface CaaListedImage { types: string[]; comment?: string; image: string; thumbnails: Record<string, string> }
export interface LabelImage { small: string; large: string; xl: string; full: string }

export interface Pressing {
  id: string;
  year: string;
  date: string;
  country: string;
  label: string;
  catno: string;
  barcode: string;
  format: string;
  colour: string | null;
  note: string;
  front: string | null; frontLarge: string | null; frontXL: string | null; frontFull: string | null;
  back: string | null; backLarge: string | null; backXL: string | null; backFull: string | null;
  /**
   * Label photos, side A first. `null` while the listing has not been read or
   * could not be read; `[]` when the archive has none. The page must keep the
   * two apart: "no photo on record" is a finding, "not loaded" is not.
   */
  labels: LabelImage[] | null;
  labelsFailed?: boolean;
  /** dHash of the front, from `lib/imagehash.ts`; null until hashed or when the image did not load. */
  hash: string | null;
  hashFailed?: boolean;
}

const CAA = 'https://coverartarchive.org/release';

/** The archive's fixed addresses for one side of a release. */
export function sideUrls(id: string, side: 'front' | 'back') {
  return { small: `${CAA}/${id}/${side}-250`, large: `${CAA}/${id}/${side}-500`, xl: `${CAA}/${id}/${side}-1200`, full: `${CAA}/${id}/${side}` };
}

/** One pressing from a release; null for anything that is not vinyl. */
export function toPressing(r: FullRelease): Pressing | null {
  if (!isVinyl(r)) return null;
  const caa = r['cover-art-archive'];
  const front = caa?.front ? sideUrls(r.id, 'front') : null;
  const back = caa?.back ? sideUrls(r.id, 'back') : null;
  const info = r['label-info'] ?? [];
  return {
    id: r.id,
    year: r.date?.slice(0, 4) ?? '',
    date: r.date ?? '',
    country: r.country ?? '',
    label: info.find(l => l.label?.name)?.label?.name ?? '',
    catno: [...new Set(info.map(l => l['catalog-number']).filter((c): c is string => !!c && c !== '[none]'))].join(', '),
    barcode: r.barcode ?? '',
    format: (r.media ?? []).map(m => m.format).filter(Boolean).join(' + '),
    colour: vinylColourNote(r),
    note: r.disambiguation ?? '',
    front: front?.small ?? null, frontLarge: front?.large ?? null, frontXL: front?.xl ?? null, frontFull: front?.full ?? null,
    back: back?.small ?? null, backLarge: back?.large ?? null, backXL: back?.xl ?? null, backFull: back?.full ?? null,
    // A release without artwork has no listing to read: no label photo is then a finding.
    labels: caa?.artwork ? null : [],
    hash: null,
  };
}

const https = (u: string) => u.replace(/^http:/, 'https:');

/**
 * Label photos from a release's listing: images typed `Medium`, without the
 * CD of a box set (measured 2026-09-29: 11 of 12 `Medium` images are labels,
 * one a CD from a Rumours box). At most two, side A and B in listing order.
 */
export function labelsFrom(images: CaaListedImage[]): LabelImage[] {
  return images
    .filter(i => i.types.includes('Medium') && !/\bCD\b/i.test(i.comment ?? ''))
    .slice(0, 2)
    .map(i => {
      const t = (size: string) => https(i.thumbnails[size] ?? i.thumbnails.large ?? i.thumbnails.small ?? i.image);
      return { small: t('250'), large: t('500'), xl: t('1200'), full: https(i.image) };
    });
}

/** Earliest first; a pressing without a date goes last. */
export function byDate(a: Pick<Pressing, 'date'>, b: Pick<Pressing, 'date'>): number {
  return (a.date || '9999').localeCompare(b.date || '9999');
}
