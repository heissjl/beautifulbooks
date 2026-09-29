"""Respace Xanh Mono proportionally (ROADMAP 6.61, lab/xanh-spacing).

Xanh Mono gives every glyph the same 500-unit advance, so a comma or an
"r" stands in a wide cell and an "m" or "W" in a tight one; headings read as
unevenly spaced. Letter-spacing cannot fix that, it moves every gap alike.

This gives each glyph an advance of its ink width plus a fixed sidebearing
on each side, leaves the outlines untouched, and renames the family (the
OFL allows modified versions; Xanh Mono reserves no name, a new one avoids
confusion anyway).

    python3 lab/xanh-spacing/respace.py [sidebearing] [space] [band]

`band` measures the sidebearing on the ink between baseline and x-height
(capital height for capitals and figures) instead of the whole bounding box.
An italic needs it: its box includes the slant's overhang, so "b y" and
"Beauti f ul" fell apart. Italic files always use it; `band` as third
argument applies it to the upright files too.

Reads the WOFF files in assets/og/, writes lab/xanh-spacing/out/.
"""
import os
import sys

from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(ROOT, 'assets', 'og')
OUT = os.path.join(HERE, 'out')
FAMILY = 'Xanh Proportional'

SIDE = int(sys.argv[1]) if len(sys.argv) > 1 else 36
SPACE = int(sys.argv[2]) if len(sys.argv) > 2 else 250
BAND_UPRIGHT = len(sys.argv) > 3 and sys.argv[3] == 'band'
# How far ink may reach past the band-measured edge. Without a limit the
# italic f (ink -97..663, body ~150 wide) overlapped its neighbours and the
# space: "of fiction" read "offiction", "Wolf Hall" "WolfHall".
OVERHANG = int(sys.argv[4]) if len(sys.argv) > 4 else 80


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


def respace(path: str, out_path: str) -> None:
    font = TTFont(path)
    glyf = font['glyf']
    hmtx = font['hmtx']
    shift: dict[str, int] = {}
    band = 'italic' in path or BAND_UPRIGHT
    x_height = font['OS/2'].sxHeight
    cap_height = font['OS/2'].sCapHeight
    char_of = {name: chr(code) for code, name in font.getBestCmap().items()}

    def measure(name: str):
        """The extent the sidebearings are measured from."""
        full = bounds(name)
        if full is None or not band:
            return full
        ch = char_of.get(name, '')
        if ch.isupper() or ch.isdigit():
            lo, hi = 0.1 * cap_height, 0.9 * cap_height
        elif ch.islower():
            lo, hi = 0.1 * x_height, 0.9 * x_height
        else:
            return full  # punctuation and symbols keep their box
        inner = band_extent(glyf, name, lo, hi)
        if inner is None:
            return full
        return min(inner[0], full[0] + OVERHANG), max(inner[1], full[1] - OVERHANG)

    def bounds(name: str):
        glyph = glyf[name]
        glyph.recalcBounds(glyf)
        if not hasattr(glyph, 'xMin') or glyph.numberOfContours == 0:
            return None
        return glyph.xMin, glyph.xMax

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
            advance = SPACE if name in ('space', 'uni00A0', 'nbspace') else hmtx[name][0]
            hmtx[name] = (advance, 0)
            return 0
        dx = round(SIDE - b[0])
        if glyph.isComposite():
            for comp in glyph.components:
                comp.x += dx
        else:
            glyph.coordinates.translate((dx, 0))
        glyph.recalcBounds(glyf)
        glyph_after = glyf[name]
        hmtx[name] = (round(b[1] - b[0]) + 2 * SIDE, getattr(glyph_after, 'xMin', SIDE))
        shift[name] = dx
        return dx

    for name in font.getGlyphOrder():
        process(name)

    font['post'].isFixedPitch = 0
    font['hhea'].advanceWidthMax = max(a for a, _ in hmtx.metrics.values())
    for record in font['name'].names:
        if record.nameID in (1, 4, 16):
            style = ' Italic' if 'italic' in path else ''
            record.string = FAMILY + (style if record.nameID == 4 else '')
        elif record.nameID == 6:
            record.string = FAMILY.replace(' ', '') + ('-Italic' if 'italic' in path else '-Regular')
    font.flavor = 'woff'
    font.save(out_path)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for file in sorted(os.listdir(SRC)):
        if file.startswith('xanh-mono') and file.endswith('.woff'):
            target = file.replace('xanh-mono', 'xanh-proportional')
            respace(os.path.join(SRC, file), os.path.join(OUT, target))
            print('written', target, f'(side {SIDE}, space {SPACE})')


if __name__ == '__main__':
    main()
