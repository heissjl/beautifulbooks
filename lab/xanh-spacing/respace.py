"""Respace Xanh Mono proportionally (ROADMAP 6.61, lab/xanh-spacing).

Xanh Mono gives every glyph the same 500-unit advance, so a comma or an
"r" stands in a wide cell and an "m" or "W" in a tight one; headings read as
unevenly spaced. Letter-spacing cannot fix that, it moves every gap alike.

This gives each glyph an advance of its ink width plus a fixed sidebearing
on each side, leaves the outlines untouched, and renames the family (the
OFL allows modified versions; Xanh Mono reserves no name, a new one avoids
confusion anyway). How the ink width is measured:

- Italic: on the ink between `band_lo` and `band_hi` of the x-height (of the
  cap height for capitals and figures) rather than the bounding box, which
  includes the slant's overhang ("b y", "Beauti f ul" fell apart). Ink may
  reach at most `overhang` past that edge — without a limit the italic f
  (ink -97..663, body about 150 wide) ran over its neighbours and the space.
- Upright: the bounding box on the left, so the baseline serifs keep their
  room; on the right the band as well, with ink at most `arm` past it — the
  arm of an r over a following s.
- The band stops at 65 % of the x-height by default: measured to 90 %, the
  r's arm set its width and left a hole before an s ("cover s").
- Punctuation and symbols keep their bounding box.

    python3 lab/xanh-spacing/respace.py            # the chosen setting
    python3 lab/xanh-spacing/respace.py --side 30 --arm 0 ...

Reads the full Xanh Mono TTFs from --src (default lab/xanh-spacing/source/,
from google/fonts, OFL) and writes WOFF2 for the page and WOFF for the
shared-link cards, Latin and Latin Extended, to --out (default
lab/xanh-spacing/out/). The website's copies are built with
`--out assets/fonts`.
"""
import argparse
import os

from fontTools import subset
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
FAMILY = 'Xanh Proportional'
# Latin and Latin Extended-A/B, general punctuation, the euro and a few more.
UNICODES = 'U+0000-024F,U+0259,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+1E00-1EFF,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--side', type=int, default=22, help='sidebearing on each side, font units')
    p.add_argument('--space', type=int, default=230, help='advance of the space')
    p.add_argument('--overhang', type=int, default=180, help='italic: ink past the band edge, at most')
    p.add_argument('--arm', type=int, default=55, help='upright: ink past the right band edge, at most (0: box)')
    p.add_argument('--band-lo', type=float, default=0.1)
    p.add_argument('--band-hi', type=float, default=0.65)
    p.add_argument('--src', default=os.path.join(HERE, 'source'))
    p.add_argument('--out', default=os.path.join(HERE, 'out'))
    return p.parse_args()


def band_extent(glyf, name: str, lo: float, hi: float):
    """Leftmost and rightmost ink between heights lo and hi, or None.

    Walks each contour's polygon (on- and off-curve points alike, sampled
    along every edge) — close enough to the curve for spacing.
    """
    coords, ends, _flags = glyf[name].getCoordinates(glyf)
    xs = []
    start = 0
    for end in ends:
        points = list(coords[start:end + 1])
        start = end + 1
        for i, (x0, y0) in enumerate(points):
            x1, y1 = points[(i + 1) % len(points)]
            for k in range(9):
                t = k / 8
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                if lo <= y <= hi:
                    xs.append(x)
    return (min(xs), max(xs)) if xs else None


def respace(font: TTFont, italic: bool, a) -> TTFont:
    glyf = font['glyf']
    hmtx = font['hmtx']
    shift: dict[str, int] = {}
    x_height = font['OS/2'].sxHeight
    cap_height = font['OS/2'].sCapHeight
    char_of = {name: chr(code) for code, name in font.getBestCmap().items()}

    def bounds(name: str):
        glyph = glyf[name]
        glyph.recalcBounds(glyf)
        if not hasattr(glyph, 'xMin') or glyph.numberOfContours == 0:
            return None
        return glyph.xMin, glyph.xMax

    def measure(name: str):
        """The extent the sidebearings are measured from."""
        full = bounds(name)
        if full is None:
            return None
        ch = char_of.get(name, '')
        if ch.isupper() or ch.isdigit():
            height = cap_height
        elif ch.islower():
            height = x_height
        else:
            return full  # punctuation and symbols keep their box
        inner = band_extent(glyf, name, a.band_lo * height, a.band_hi * height)
        if inner is None:
            return full
        if italic:
            return min(inner[0], full[0] + a.overhang), max(inner[1], full[1] - a.overhang)
        if a.arm and ch.islower():
            return full[0], max(inner[1], full[1] - a.arm)
        return full

    def process(name: str) -> int:
        if name in shift:
            return shift[name]
        glyph = glyf[name]
        if glyph.isComposite():
            # Undo the shift the components got, so the shape is the original.
            for comp in glyph.components:
                comp.x -= process(comp.glyphName)
        b = measure(name)
        if b is None:
            shift[name] = 0
            advance = a.space if char_of.get(name) in (' ', ' ') else hmtx[name][0]
            hmtx[name] = (advance, 0)
            return 0
        dx = round(a.side - b[0])
        if glyph.isComposite():
            for comp in glyph.components:
                comp.x += dx
        else:
            glyph.coordinates.translate((dx, 0))
        glyph.recalcBounds(glyf)
        hmtx[name] = (round(b[1] - b[0]) + 2 * a.side, getattr(glyph, 'xMin', a.side))
        shift[name] = dx
        return dx

    for name in font.getGlyphOrder():
        process(name)

    font['post'].isFixedPitch = 0
    font['hhea'].advanceWidthMax = max(adv for adv, _ in hmtx.metrics.values())
    style = 'Italic' if italic else 'Regular'
    for record in font['name'].names:
        if record.nameID in (1, 16):
            record.string = FAMILY
        elif record.nameID == 4:
            record.string = f'{FAMILY} {style}' if italic else FAMILY
        elif record.nameID == 6:
            record.string = f"{FAMILY.replace(' ', '')}-{style}"
        elif record.nameID == 5:
            record.string = f'{record.toUnicode()}; respaced proportionally (beautifulbooks lab/xanh-spacing)'
    return font


def save_subset(font_path: str, out_path: str, flavor: str) -> None:
    options = subset.Options()
    options.flavor = flavor
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    sub = subset.Subsetter(options)
    font = TTFont(font_path)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)
    font.flavor = flavor
    font.save(out_path)


def main() -> None:
    a = parse_args()
    os.makedirs(a.out, exist_ok=True)
    settings = f'side {a.side}, space {a.space}, band {a.band_lo}-{a.band_hi}, overhang {a.overhang}, arm {a.arm}'
    for file, italic, stem in (('XanhMono-Regular.ttf', False, 'xanh-proportional-regular'),
                               ('XanhMono-Italic.ttf', True, 'xanh-proportional-italic')):
        ttf = os.path.join(a.out, stem + '.ttf')
        respace(TTFont(os.path.join(a.src, file)), italic, a).save(ttf)
        save_subset(ttf, os.path.join(a.out, stem + '.woff2'), 'woff2')
        save_subset(ttf, os.path.join(a.out, stem + '.woff'), 'woff')
        os.remove(ttf)
        print('written', stem, '.woff2 .woff', f'({settings})')

if __name__ == '__main__':
    main()
