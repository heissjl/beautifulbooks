# Profile picture and banner for the accounts

Chosen by Julian on 2026-10-04 ("vorerst W1 und das banner wie unten"; docs/domain-recherche.md §23).

| File | Use |
|---|---|
| `avatar-400.png`, `avatar-1000.png` | profile picture on X, Bluesky, Mastodon, TikTok, GitHub (the platforms crop it to a circle; the text stays inside it) |
| `banner-1500x500.png` | header on X and Mastodon |
| `banner-3000x1000.png` | header on Bluesky |
| `avatar-360.png` | profile image of the Bookshop.org shop page (the form asks for 180 × 180; this is twice that, for sharp screens) — added 2026-10-04 |
| `banner-2048x600.png` | banner of the Bookshop.org shop page (the form asks for 2048 × 600) — added 2026-10-04 |
| `site-icon-512.png` | the site's mark (`app/icon.svg`) as a PNG on a transparent ground, for forms that want a logo rather than the wordmark |

The sources are `avatar.svg`, `banner.svg` and `banner-bookshop.svg` (the same banner set for 2048 × 600, eight tiles a row instead of seven): the home page's line "Judge a book, *buy its covers.*" in Xanh Proportional from `../fonts/`, the site's paper `#f4f0e8`, ink `#1f1b18` and accent `#945138`, and the tile wall of the site's mark with one tile in the accent. The banner keeps its lower left empty because X lays the profile picture over it.

To render again: open the SVG in Chrome at the target size (the fonts load from `../fonts/` and `../og/`) and take a screenshot; the session that made them used headless Chrome over the DevTools protocol at device scale 1. `--headless=new --screenshot=… --window-size=2048,600` on the SVG's `file://` address writes the picture too, but that Chrome did not exit by itself on 2026-10-04 and had to be stopped.

The wordmark is not legible below about 40 px, so a small favicon-sized use still wants the site's icon (`app/icon.svg`).
