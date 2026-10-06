import { describe, expect, it } from 'vitest'
import { countPosters, median, table } from '../tmdb'

const img = (lang: string | null, height: number) => ({ file_path: '/x.jpg', width: height / 1.5, height, iso_639_1: lang, vote_count: 0 })

describe('countPosters', () => {
  it('counts languages, textless posters and print-sized scans', () => {
    const c = countPosters('Alien', 1979, 348, [img('en', 3000), img('en', 1500), img('de', 4000), img(null, 900)])
    expect(c.posters).toBe(4)
    expect(c.byLanguage).toEqual({ en: 2, de: 1, none: 1 })
    expect(c.printable).toBe(2)
    expect(c.maxHeight).toBe(4000)
  })
  it('says not found rather than zero posters', () => {
    expect(table([countPosters('X', 2000, null, [])])).toContain('nicht gefunden')
  })
})

describe('median', () => {
  it('handles odd, even and empty', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBe(0)
  })
})
