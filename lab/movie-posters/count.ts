// TMDB poster count for twenty films (ROADMAP 5.20).
// Run locally: TMDB_API_KEY=<v3 key> npx tsx lab/movie-posters/count.ts
// Non-commercial key only; one request at a time with a pause; writes results.json and prints a table.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { countPosters, table, type PosterCount, type TmdbImage } from './tmdb'

const FILMS: [string, number][] = [
  ['Nosferatu', 1922], ['Metropolis', 1927], ['Casablanca', 1942], ['Seven Samurai', 1954],
  ['Vertigo', 1958], ['Psycho', 1960], ['2001: A Space Odyssey', 1968], ['The Godfather', 1972],
  ['Star Wars', 1977], ['Alien', 1979], ['Das Boot', 1981], ['Blade Runner', 1982],
  ['Pulp Fiction', 1994], ['The Matrix', 1999], ['Amélie', 2001], ['Spirited Away', 2001],
  ['Parasite', 2019], ['Dune', 2021], ['Barbie', 2023], ['Oppenheimer', 2023],
]

const key = process.env.TMDB_API_KEY
if (!key) throw new Error('TMDB_API_KEY is not set')
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`)
  for (const [k, v] of Object.entries({ ...params, api_key: key! })) url.searchParams.set(k, v)
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`${res.status} for ${path}`)
  await pause(300)
  return (await res.json()) as T
}

const rows: PosterCount[] = []
for (const [title, year] of FILMS) {
  const search = await get<{ results: { id: number }[] }>('/search/movie', { query: title, year: String(year) })
  const id = search.results[0]?.id ?? null
  // No language parameter: the images endpoint then returns every language.
  const images = id === null ? { posters: [] } : await get<{ posters: TmdbImage[] }>(`/movie/${id}/images`, {})
  rows.push(countPosters(title, year, id, images.posters))
  console.error(`${title}: ${images.posters.length}`)
}
writeFileSync(join(import.meta.dirname, 'results.json'), JSON.stringify({ measured: new Date().toISOString(), rows }, null, 2))
console.log(table(rows))
