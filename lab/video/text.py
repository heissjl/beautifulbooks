"""
Text for the clip in the site's own fonts (lab/video/README.md).

Why Python: sharp's text renderer on macOS goes through CoreText, which does
not see a font file handed to it (`fontfile` is registered with fontconfig
only), so every attempt rendered Helvetica. Pillow's FreeType reads the
files directly and can set a variable font's axes, which Fraunces needs: its
default instance is weight 900 at optical size 9.

The fonts are the files the site ships: next/font self-hosts Fraunces and
Geist as WOFF2 under `.next/**/static/media/` after any `next dev` or
`next build`. They are found by their name table (family, style, and a latin
cmap), converted to TTF once into the fonts folder, and never committed.

Usage (render.ts calls it):
  python3 lab/video/text.py <fontsdir> <outdir> <searchdir>... < items.json
items.json: {"items": [{"id", "text", "font": "display"|"display-italic"|
  "sans"|"sans-medium", "size", "color", "tracking" (em), "maxWidth",
  "lineHeight", "align": "left"|"center"}]}
Prints {"fonts": "site"|"system", "items": {id: {"w", "h"}}}.
Needs Pillow and fontTools with brotli (present on Julian's machine, 2026-09-27).
"""
import glob
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

FALLBACK = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
SYSTEM = {
    'display': '/System/Library/Fonts/Supplemental/Georgia.ttf',
    'display-italic': '/System/Library/Fonts/Supplemental/Georgia Italic.ttf',
    'sans': '/System/Library/Fonts/Helvetica.ttc',
    'sans-medium': '/System/Library/Fonts/Helvetica.ttc',
}
# (file, variation by axis name) per role. h1 on the site: font-display, 500;
# the wordmark: font-display italic at 20 px; .kicker: medium.
ROLES = {
    'display': ('fraunces.ttf', {'Optical Size': 72, 'Weight': 500}),
    'display-italic': ('fraunces-italic.ttf', {'Optical Size': 36, 'Weight': 400}),
    'sans': ('geist.ttf', {'Weight': 400}),
    'sans-medium': ('geist.ttf', {'Weight': 500}),
}


def prepare(fontsdir, searchdirs):
    """Finds the site's latin WOFF2 files and writes them as TTF. True when all three exist."""
    wanted = {'fraunces.ttf': ('Fraunces', 'Regular'), 'fraunces-italic.ttf': ('Fraunces', 'Italic'), 'geist.ttf': ('Geist', 'Regular')}
    missing = {k: v for k, v in wanted.items() if not os.path.exists(os.path.join(fontsdir, k))}
    if not missing:
        return True
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        return False
    os.makedirs(fontsdir, exist_ok=True)
    for d in searchdirs:
        for path in glob.glob(os.path.join(d, '.next', '**', 'static', 'media', '*.woff2'), recursive=True):
            try:
                font = TTFont(path)
            except Exception:
                continue
            family = font['name'].getDebugName(1)
            style = font['name'].getDebugName(2)
            cmap = font.getBestCmap() or {}
            if 0x41 not in cmap or 0xE9 not in cmap:
                continue  # not the latin subset
            for name, (fam, sty) in list(missing.items()):
                if family == fam and style == sty:
                    font.flavor = None
                    font.save(os.path.join(fontsdir, name))
                    del missing[name]
        if not missing:
            break
    return not missing


def load(role, size, site, fontsdir):
    if site:
        file, axes = ROLES[role]
        font = ImageFont.truetype(os.path.join(fontsdir, file), size)
        values = [axes.get(a['name'].decode() if isinstance(a['name'], bytes) else a['name'], a['default']) for a in font.get_variation_axes()]
        font.set_variation_by_axes(values)
        return font
    return ImageFont.truetype(SYSTEM[role], size, index=1 if role == 'sans-medium' else 0)


def covers(font_path, text):
    from fontTools.ttLib import TTFont
    cmap = TTFont(font_path).getBestCmap() or {}
    return all(ord(c) in cmap or c.isspace() for c in text)


def wrap(text, font, tracking_px, max_width):
    words, lines, line = text.split(), [], ''
    for word in words:
        trial = f'{line} {word}'.strip()
        if line and width_of(trial, font, tracking_px) > max_width:
            lines.append(line)
            line = word
        else:
            line = trial
    if line:
        lines.append(line)
    return lines or ['']


def width_of(text, font, tracking_px):
    return font.getlength(text) + tracking_px * max(0, len(text) - 1)


def draw_line(draw, x, y, text, font, fill, tracking_px):
    if tracking_px == 0:
        draw.text((x, y), text, font=font, fill=fill)
        return
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking_px


def main():
    fontsdir, outdir, *searchdirs = sys.argv[1:]
    site = prepare(fontsdir, searchdirs)
    os.makedirs(outdir, exist_ok=True)
    request = json.load(sys.stdin)
    cmap_ok = {}
    result = {}
    for item in request['items']:
        size = int(item['size'])
        role = item['font']
        text = item['text']
        font = load(role, size, site, fontsdir)
        # Characters outside the latin subset (Cyrillic publishers) fall back
        # to a system font for the whole line, as a browser would per glyph.
        if site:
            key = (ROLES[role][0], text)
            if key not in cmap_ok:
                cmap_ok[key] = covers(os.path.join(fontsdir, ROLES[role][0]), text)
            if not cmap_ok[key]:
                font = ImageFont.truetype(FALLBACK, size)
        tracking_px = float(item.get('tracking', 0)) * size
        max_width = item.get('maxWidth') or 10_000
        lines = wrap(text, font, tracking_px, max_width)
        ascent, descent = font.getmetrics()
        line_height = int(round(size * float(item.get('lineHeight', 1.2))))
        widths = [width_of(line, font, tracking_px) for line in lines]
        w = int(max(widths)) + 4
        h = line_height * (len(lines) - 1) + ascent + descent
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        for i, line in enumerate(lines):
            x = (w - widths[i]) / 2 if item.get('align', 'center') == 'center' else 0
            draw_line(draw, x, i * line_height, line, font, item['color'], tracking_px)
        img.save(os.path.join(outdir, f"{item['id']}.png"))
        result[item['id']] = {'w': w, 'h': h, 'lines': len(lines)}
    print(json.dumps({'fonts': 'site' if site else 'system', 'items': result}))


if __name__ == '__main__':
    main()
