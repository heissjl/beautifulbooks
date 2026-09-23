# -*- coding: utf-8 -*-
"""Contact sheets for looking at what CLIP decided, from the images clip.ts cached.

    python3 lab/clip/sheet.py notcover   # top scores outside the game, then inside it
    python3 lab/clip/sheet.py notcover --blind   # the random slice without scores, for labelling by eye
    python3 lab/clip/sheet.py fold       # sampled pairs, numbered, with both measures
    python3 lab/clip/sheet.py fold --blind   # the same without the numbers, for labelling by eye

Needs pillow. Sheets land in lab/clip/out/ (git-ignored), never in the repo.
"""
import json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
CW, CH, GAP, CAP = 140, 210, 10, 30
BLIND = '--blind' in sys.argv


def latin(text):
    """PIL's default bitmap font knows Latin-1 only; a Cyrillic or CJK title would stop the sheet."""
    return text.encode('latin-1', 'replace').decode('latin-1')


def image(cid):
    path = os.path.join(OUT, 'img', cid.split(':', 1)[1] + '.jpg')
    try:
        return Image.open(path).convert('RGB').resize((CW, CH))
    except Exception:
        im = Image.new('RGB', (CW, CH), (60, 60, 60))
        ImageDraw.Draw(im).text((8, 8), 'no image', fill=(255, 255, 255))
        return im


def grid(cells, cell_w, cols, draw_cell, name):
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (cell_w + GAP) + GAP, rows * (CH + CAP + GAP) + GAP), (250, 249, 246))
    dr = ImageDraw.Draw(sheet)
    for k, cell in enumerate(cells):
        x = GAP + (k % cols) * (cell_w + GAP)
        y = GAP + (k // cols) * (CH + CAP + GAP)
        draw_cell(sheet, dr, x, y, k, cell)
    path = os.path.join(OUT, name)
    sheet.save(path)
    print(path)


def notcover():
    data = json.load(open(os.path.join(OUT, 'notcover.json')))

    def cell(sheet, dr, x, y, k, c):
        sheet.paste(image(c['id']), (x, y))
        if BLIND:
            dr.text((x, y + CH + 2), latin(f"{k} {c['title'][:20]}"), fill=(0, 0, 0))
            return
        dr.text((x, y + CH + 2), latin(f"{k} {c['zeroShot']:.2f} {c['title'][:16]}"), fill=(0, 0, 0))
        dr.text((x, y + CH + 14), c['leansTo'][:24], fill=(90, 90, 90))

    keys = (('outsideRandom', 10),) if BLIND else (('outsideTop', 10), ('gameTop', 10), ('excluded', 8), ('outsideRandom', 10))
    for key, cols in keys:
        cells = data[key]
        for i in range(0, len(cells), 40):
            grid(cells[i:i + 40], CW, cols, cell, f'notcover-{key}-{i // 40}.png')


def fold():
    pairs = json.load(open(os.path.join(OUT, 'fold-sample.json')))
    pw = CW * 2 + 4

    def cell(sheet, dr, x, y, k, p):
        sheet.paste(image(p['a']), (x, y))
        sheet.paste(image(p['b']), (x + CW + 4, y))
        # --blind hides both measures, so a label by eye is not a label by number
        caption = f"#{k}" if BLIND else f"#{k}  {p['indexDistance']} bits  clip {p['clip']:.3f}"
        dr.text((x, y + CH + 2), caption, fill=(0, 0, 0))
        dr.text((x, y + CH + 14), latin(p['title'][:40]), fill=(90, 90, 90))

    for i in range(0, len(pairs), 20):
        grid(list(enumerate(pairs))[i:i + 20], pw, 4,
             lambda s, d, x, y, k, kp: cell(s, d, x, y, kp[0], kp[1]), f'fold-{i // 20}.png')


{'notcover': notcover, 'fold': fold}[sys.argv[1]]()
