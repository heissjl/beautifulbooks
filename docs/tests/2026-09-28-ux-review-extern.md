# UX-Durchsicht von außen, 2026-09-28

*Von Julian am 2026-09-28 in die Sitzung gegeben, Verfasser nicht genannt; gesehen gegen Produktion in Chrome bei etwa 455 CSS-px, Dunkelmodus. Der Text steht unten unverändert auf Englisch. Was daraus folgt, was schon gebaut ist und was einer bewussten Entscheidung widerspricht, steht im [Plan 6.63](../plans/PLAN-6.63-alltag.md). Befunde, die gegen den Code geprüft wurden, sind dort mit Datei und Zeile belegt; hier ist nichts geändert.*

---

# Beautiful Books (beautifulcovers.vercel.app) — UX / content review

**Reviewed:** 2026-09-28, via Chrome, narrow viewport (~455 CSS px), dark theme
**Pages tested:** home, search results (`/?q=`), book wall (`/book/OL468431W`), cover detail panel (`?cover=`), by-decade view (`/book/…/decades`), share menu, versus game (`/versus`), standings (`/versus/board`), collection builder (`/create`)
**Goal of review:** what would make the site usable by an average person daily, consistently and efficiently

## Summary

The core mechanic (search a title → see every cover it has had, by language/year → buy the one you want) is strong and the fuzzy search is better than most ("Jane Austin" resolved to Jane Austen). Nearly all problems are *daily-use friction*: the site is built for a single browsing session, not for someone who returns every day. Items are ranked by impact.

## 1. No reason to return — build a retention loop

Nothing on the home page changes between visits: six static collections, eighteen static classics.

- Add a **"Cover of the day"** at the top of the home page (source: vote data + curated collections).
- Surface **Recently viewed** and **Your saved covers** on the home page instead of a footer link labelled "Your collections".
- Add a **recently added / recently voted-on** feed.
- The versus game already has a daily-habit shape. Add a **streak counter** and a **"your votes so far"** page. Currently a vote produces zero feedback — no "you picked the one 71 % of people pick", no animation, nothing. This is the cheapest engagement win on the site.

## 2. Identity model blocks cross-device daily use

Collections are tied to a cookie-held ID the user is told to copy and paste to other devices, and anyone holding the ID can edit the collections. That is both a security and a usability dead-end for an everyday user.

- Add passwordless login (magic link or passkey) and migrate the cookie ID into it.
- Keep the anonymous mode for first use; say plainly "sign in to keep this on your phone".

## 3. Search is the product, but the search box disappears

- On book and versus pages the header only shows a magnifier icon; typing needs an extra click. Keep a **persistent search field** in the header on every page; bind `/` to focus it.
- Results grid has no sort or filter (year, language, cover count). With 13 books / 12,627 editions for one author, that matters.
- Autocomplete shows a single "Popular" hit. Show 5–8 with cover thumbnails, and distinguish the *work* from *books about the work* ("Critical Insights: The Great Gatsby" by another author currently sits in the same list as the novel).

## 4. Data-quality issues that undermine trust

- **Wrong dates shown as fact.** *The Great Gatsby* appears as 1920 everywhere (published 1925). "Open Library dates it to 1920" is honest but reads as a bug. Options: curated override for the ~1,600 books in the game, or show the earliest *edition* year in your own data (a 1925 Scribner edition exists in the wall) alongside the OL date.
- **Inconsistent counts for the same book:** 293 covers on the wall, 291 after reload, 162 on the decade page ("from 181 edition records"). Compute once server-side, cache it, and state on the decade page that it only includes editions with a known year.
- **Non-covers in results grid.** Collage thumbnails include spines, blank flyleaves, half-cropped scans. The "not a cover" reporting mechanism already exists in the game; apply that (or an aspect-ratio + entropy heuristic) before thumbnails appear in results.
- **Versus game contradicts its own copy.** Page text says "two covers of two books", but two covers of *Far from the Madding Crowd* were served against each other.

## 5. The ranking method won't converge

- Standings state a cover is called best only after "3 rounds of 3335 votes" — ~10,000 votes before anything is declared, at 1,056 votes today.
- Interim ranking is raw win-rate on tiny samples ("won 3 of 3"), which rewards covers that drew three easy opponents.
- Switch to Elo or Bradley–Terry with a confidence interval, show rank with an uncertainty band, and pair covers with similar current ratings so each vote is maximally informative. This turns the leaderboard into something worth checking daily.

## 6. Performance on the book wall

- Wall loads ~300 images with a "900 of 1,180 editions checked" progress bar; images pop in over several seconds; result-grid collages arrive later still. On a phone this is the dominant impression of the site.
- Fixes: paginate or virtualise the wall (e.g. 36 at a time + "show more"); serve pre-generated collage thumbnails instead of composing client-side; preload the *next* pair in the versus game while the current one is displayed; cache the edition scan per work rather than re-checking every visit.

## 7. Interaction bugs observed

| Bug | Observation | Likely cause / fix |
|---|---|---|
| Underlined inline links not clickable by coordinate | Clicking the text of "help us find the prettiest cover" (home) and "Standings" (versus) did nothing twice; clicking the DOM element directly worked | Hit area probably a few px tall — pseudo-element underline or `display:inline` `<a>` inside flex parent. Give links `display:inline-block` + padding. |
| "Selected cover" bottom bar doesn't intercept clicks immediately | Clicking "Details" right after selecting a cover selected the cover *behind* the bar instead | Bar animates in with `pointer-events` applied late, or grid has higher z-index during transition |
| Grid order changes between loads of the same wall | First tile differed on reload | Use deterministic order (year desc, then publisher) — also gives users a scannable structure |
| Inconsistent back-links | "‹ Results", "‹ Home", "← The wall" — different glyph and destination depending on entry path | Single back-link component, consistent glyph |

## 8. Smaller content / UX points

- Home shows 6 of 30 collections; the other 24 are only reachable via "See all" or a dropdown on `/create`. Show them all with a filter by publisher / series / award.
- Footer label "Impressum" means nothing to non-German readers; it links to `/contact` — call it "Contact".
- Cover detail panel: purchase buttons are ISBN-specific; a 2013 printing is often out of stock. Add an "any edition" fallback link.
- Add **"Save to collection"** directly on the detail panel and on versus cards. Saving currently requires going to `/create` and re-finding the book.
- Keyboard hints for the game ("← and → choose, ↓ skips") are below the fold; move them next to the covers. Add the same shortcuts on the wall (arrows move selection, Enter opens details).

## Suggested order of work

1. Vote feedback + streak (item 1) — small, high impact
2. Persistent header search + `/` shortcut (item 3)
3. Fix the two click bugs and deterministic wall order (item 7)
4. Wall pagination + next-pair preload (item 6)
5. Date override + consistent counts (item 4)
6. Rating model change (item 5)
7. Passwordless login (item 2)
