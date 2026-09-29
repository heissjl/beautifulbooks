"""Respace Xanh Mono proportionally (ROADMAP 6.61, lab/xanh-spacing).

Xanh Mono gives every glyph the same 500-unit advance, so a comma or an
"r" stands in a wide cell and an "m" or "W" in a tight one; headings read as
unevenly spaced. Letter-spacing cannot fix that, it moves every gap alike.

This gives each glyph an advance of its ink width plus a fixed sidebearing
on each side, leaves the outlines untouched, and renames the family (the
OFL allows modified versions; Xanh Mono reserves no name, a new one avoids
confusion anyway).

    python3 lab/xanh-spacing/respace.py [sidebearing] [space]

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


def respace(path: str, out_path: str) -> None:
    font = TTFont(path)
    glyf = font['glyf']
    hmtx = font['hmtx']
    shift: dict[str, int] = {}

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
        b = bounds(name)
        if b is None:
            shift[name] = 0
            advance = SPACE if name in ('space', 'uni00A0', 'nbspace') else hmtx[name][0]
            hmtx[name] = (advance, 0)
            return 0
        dx = SIDE - b[0]
        if glyph.isComposite():
            for comp in glyph.components:
                comp.x += dx
        else:
            glyph.coordinates.translate((dx, 0))
        glyph.recalcBounds(glyf)
        hmtx[name] = (b[1] - b[0] + 2 * SIDE, SIDE)
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
