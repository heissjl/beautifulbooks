# xanh-spacing — can Xanh Mono be spaced evenly?

**Question** (Julian, 2026-09-29: „kann man das letter spacing von der xanh font noch verbessern? es sieht unregelmäßig aus"): the headings in Xanh Mono read as unevenly spaced. Can that be fixed?

**Why it looks uneven.** Xanh Mono is a monospaced face: every glyph has an advance of 500 units (of 1000). A comma's ink is 114 units wide (191–305), a semicolon's 114 (197–311), so each stands in a cell four times its width — "Frankenstein ; or ," — while "m" (12–493) and "W" (−21–524) fill or overrun theirs. `letter-spacing` changes every gap by the same amount and cannot even this out; there is no kerning in a monospaced font to fix it pair by pair.

**What was tried** (`respace.py`, output in `out/`, git-ignored): each glyph gets the advance of its ink width plus a fixed sidebearing on both sides; outlines untouched, composites (accented letters) kept in shape, space set to 230–250 units, family renamed „Xanh Proportional" (the OFL allows modified versions; Xanh Mono reserves no name). Compared on paper colour against today's setting (letter-spacing −0.01em, word-spacing −0.3em) and against −0.04em.

**Result, 2026-09-29:**

- **Upright: better.** Punctuation sits against its word („Frankenstein; or,"), and the gaps between letters even out. Sidebearing 22 reads close to the page's current density; 36 is looser than today. Widths after respacing (side 36): i 518, l 518, r 532, e 459, o 466, m 553, W 617, comma 186, semicolon 186.
- **Italic: worse.** The sidebearing is taken from the glyph's bounding box, which for a slanted glyph includes the overhang: „b y", „Beauti f ul" open up. An italic needs sidebearings measured at the x-height band, not the whole box. Not done.
- **−0.04em letter-spacing** makes everything denser but keeps the punctuation cells.

**Status:** measured, not on the site. Open: Julian's choice; if the upright respacing goes in, the italic either stays Xanh Mono or gets a slant-aware respacing first. Roadmap 6.61.
