"""Draw the raster icons of the mark (ROADMAP 6.61, direction A).

    python3 scripts/build-icons.py

Writes app/favicon.ico (16, 32, 48 px) and app/apple-icon.png (180 px).
The vector mark is components/BrandMark.tsx and app/icon.svg; this draws the
same wall of 3 x 3 book-shaped tiles in shelf tones with the middle one
picked out, but
snapped to whole pixels per size, because a 16 px icon scaled from the
vector blurs into a grey square. A raster icon cannot follow dark mode, so
it sits on the paper colour; browsers that read SVG icons use app/icon.svg,
which does. Needs Pillow.
"""
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAPER = (244, 240, 232, 255)   # --bg, light
ACCENT = (148, 81, 56, 255)    # --accent, light
# --mark-0 … --mark-6, light, and the tone of each tile row by row (the A + C
# mix, components/BrandMark.tsx MARK_TONES).
TONES = ['#2a2622', '#3a342f', '#4a433c', '#6b635a', '#8a8178', '#b8ab9c', '#d9cfc1']
MARK_TONES = [[2, 6, 3], [5, -1, 3], [2, 0, 1]]

# Per size: tile width, tile height, gap, picked width, picked height, corner.
# Tiles keep roughly the 2:3 of a book; the picked tile is larger by about a
# third, centred on the middle cell.
LAYOUT = {
    16: (3, 4, 1, 5, 6, 3),
    32: (6, 8, 2, 8, 11, 6),
    48: (9, 12, 3, 12, 16, 9),
    180: (32, 46, 10, 42, 60, 0),  # iOS rounds the corners itself
}


def draw(size: int) -> Image.Image:
    tw, th, gap, pw, ph, corner = LAYOUT[size]
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=corner, fill=PAPER)
    wall_w = 3 * tw + 2 * gap
    wall_h = 3 * th + 2 * gap
    x0 = (size - wall_w) // 2
    y0 = (size - wall_h) // 2
    for row in range(3):
        for col in range(3):
            if (row, col) == (1, 1):
                continue
            x = x0 + col * (tw + gap)
            y = y0 + row * (th + gap)
            d.rectangle((x, y, x + tw - 1, y + th - 1), fill=TONES[MARK_TONES[row][col]])
    cx = x0 + (tw + gap) + tw / 2
    cy = y0 + (th + gap) + th / 2
    px = round(cx - pw / 2)
    py = round(cy - ph / 2)
    d.rectangle((px, py, px + pw - 1, py + ph - 1), fill=ACCENT)
    return img


def main() -> None:
    icons = [draw(s) for s in (16, 32, 48)]
    ico = os.path.join(ROOT, 'app', 'favicon.ico')
    icons[2].save(ico, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)], append_images=icons[:2])
    apple = draw(180).convert('RGB')
    apple.save(os.path.join(ROOT, 'app', 'apple-icon.png'))
    print('written app/favicon.ico (16, 32, 48) and app/apple-icon.png (180)')


if __name__ == '__main__':
    main()
