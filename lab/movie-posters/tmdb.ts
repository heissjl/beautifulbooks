// Pure part of the TMDB poster count (ROADMAP 5.20): no network, tested.

export interface TmdbImage {
  file_path: string
  width: number
  height: number
  iso_639_1: string | null
  vote_count: number
}

export interface PosterCount {
  title: string
  year: number
  tmdbId: number | null
  posters: number
  /** posters per language; 'none' is a poster without text (iso_639_1 null) */
  byLanguage: Record<string, number>
  /** posters at least 3000 px high: about A2 at 250 dpi, a print that does not look soft */
  printable: number
  maxHeight: number
}

export const PRINT_HEIGHT = 3000

export function countPosters(title: string, year: number, tmdbId: number | null, posters: TmdbImage[]): PosterCount {
  const byLanguage: Record<string, number> = {}
  for (const p of posters) {
    const key = p.iso_639_1 ?? 'none'
    byLanguage[key] = (byLanguage[key] ?? 0) + 1
  }
  return {
    title,
    year,
    tmdbId,
    posters: posters.length,
    byLanguage,
    printable: posters.filter((p) => p.height >= PRINT_HEIGHT).length,
    maxHeight: posters.reduce((m, p) => Math.max(m, p.height), 0),
  }
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function table(rows: PosterCount[]): string {
  const lines = ['| Film | Jahr | Plakate | Sprachen | ohne Text | ≥ 3000 px | max. Höhe |', '|---|---|---|---|---|---|---|']
  for (const r of rows) {
    const langs = Object.keys(r.byLanguage).filter((k) => k !== 'none').length
    lines.push(`| ${r.title} | ${r.year} | ${r.tmdbId === null ? 'nicht gefunden' : r.posters} | ${langs} | ${r.byLanguage.none ?? 0} | ${r.printable} | ${r.maxHeight} |`)
  }
  const found = rows.filter((r) => r.tmdbId !== null)
  lines.push(`| **Median** (${found.length} gefunden) | | ${median(found.map((r) => r.posters))} | | | ${median(found.map((r) => r.printable))} | |`)
  return lines.join('\n')
}
