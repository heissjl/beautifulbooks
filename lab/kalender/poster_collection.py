"""
A collection as one high-resolution picture (5.6b, r/bookcoverporn).

Julian, 2026-10-07: "make a version of the bookcoverporn sf masterworks
picture that has all the covers in it, make it a high-res picture and not a
screenshot of the website. artist names should still be in it and then let's
have a header with the collection name and description but to the right we
have our domain branding and also at the bottom of the picture, but with the
link to the collection itself".

The collection is read from a live snapshot (scripts/live-collections.ts),
because the site lays online drafts over data/collections.json; the covers are
Open Library's large images, fetched one at a time and cached in out/cache.

    python3 lab/kalender/poster_collection.py <live.json> sf-masterworks [--plain] [--first]
"""
import json
import os
import sys
import time
import urllib.request
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
CACHE = os.path.join(HERE, 'out', 'cache')
FONTS = os.path.join(ROOT, 'assets', 'fonts')

BG = (18, 17, 16)
CREAM = (236, 231, 223)
MUTED = (150, 143, 134)
ACCENT = (224, 145, 111)

W = 3600
MARGIN = 140
COLS = 11          # 73 = 6 × 11 + 7: the last row is nearly full
GAP_X = 40
GAP_Y = 64
RATIO = 1.55       # height over width of an SF Masterworks paperback
TEXT_H = 172

# SF Masterworks numbers whose cover on Open Library is a later printing; with
# --first the picture takes the first printing's image and artist from ISFDB
# (lab/collections/lists/sf-masterworks-isfdb-first.tsv, checked by eye
# 2026-10-07; Open Library holds none of the three).
FIRST_PRINTING = {1, 28, 73}


def font(name: str, size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    if name == 'jost':
        f = ImageFont.truetype(os.path.join(CACHE, 'jost.ttf'), size)
        f.set_variation_by_axes([weight or 400])
        return f
    return ImageFont.truetype(os.path.join(FONTS, f'xanh-proportional-{name}.woff'), size)


def cover(cid: str) -> Image.Image:
    n = cid.split(':')[1]
    path = os.path.join(CACHE, f'ol-{n}-L.jpg')
    if not os.path.exists(path):
        req = urllib.request.Request(f'https://covers.openlibrary.org/b/id/{n}-L.jpg', headers={'User-Agent': 'Buy Its Covers lab (poster_collection.py)'})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
        except Exception as err:
            raise SystemExit(f'cover {cid} did not come: {err}. Nothing written; run again later.')
        open(path, 'wb').write(data)
        time.sleep(1)
    return Image.open(path).convert('RGB')


def fill(im: Image.Image, w: int, h: int) -> Image.Image:
    if im.width / im.height > w / h:
        nw = round(im.height * w / h)
        x = (im.width - nw) // 2
        im = im.crop((x, 0, x + nw, im.height))
    else:
        nh = round(im.width * h / w)
        y = (im.height - nh) // 2
        im = im.crop((0, y, im.width, y + nh))
    return im.resize((w, h), Image.LANCZOS)


def fit_text(d: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, width: int) -> str:
    if d.textlength(text, font=f) <= width:
        return text
    while text and d.textlength(text + '…', font=f) > width:
        text = text[:-1]
    return text.rstrip() + '…'


def wrap(d: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if d.textlength(trial, font=f) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + ([line] if line else [])


def brand(d: ImageDraw.ImageDraw, right: int, top: int, size: int) -> int:
    """'Buy Its Covers' in the site's italic, right-aligned; returns the bottom edge."""
    mark = font('italic', size)
    d.text((right - d.textlength('Buy Its Covers', font=mark), top), 'Buy Its Covers', font=mark, fill=CREAM)
    return top + size


def main(live: str, slug: str, plain: bool = False, first: bool = False) -> None:
    data = json.load(open(live))
    records = data if isinstance(data, list) else data.get('collections', data.get('records'))
    coll = next(c for c in records if c['slug'] == slug)
    works = coll['works']
    os.makedirs(CACHE, exist_ok=True)
    isfdb = {}
    if first:
        import csv
        for r in csv.DictReader(open(os.path.join(ROOT, 'lab', 'collections', 'lists', 'sf-masterworks-isfdb-first.tsv')), delimiter='\t'):
            isfdb[int(r['no'])] = r['cover_artist'].split(' (variant')[0]
    tiles = []
    for i, w in enumerate(works):
        if first and i + 1 in FIRST_PRINTING:
            tiles.append(Image.open(os.path.join(CACHE, 'isfdb', f'{i + 1:02d}.jpg')).convert('RGB'))
            works[i] = {**w, 'coverArtists': [isfdb[i + 1]]}
            continue
        tiles.append(cover(w['coverId']))
        print(f'{i + 1}/{len(works)}', w['title'], flush=True)

    tw = (W - 2 * MARGIN - (COLS - 1) * GAP_X) // COLS
    th = round(tw * RATIO)
    rows = -(-len(works) // COLS)

    probe = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    title_f = font('regular', 150)
    intro_f = font('jost', 44, 400)
    intro = coll['intro'].split(' Behind each cover')[0]
    intro_lines = wrap(probe, intro, intro_f, 2200)
    header_h = MARGIN + 150 + 40 + len(intro_lines) * 62 + 110
    footer_h = 120 if plain else 260
    H = header_h + rows * (th + TEXT_H + GAP_Y) - GAP_Y + footer_h

    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)

    # Header: name and description on the left, the site on the right.
    d.text((MARGIN, MARGIN - 20), coll['title'], font=title_f, fill=CREAM)
    y = MARGIN + 170
    for line in intro_lines:
        d.text((MARGIN, y), line, font=intro_f, fill=MUTED)
        y += 62
    if not plain:
        b = brand(d, W - MARGIN, MARGIN + 10, 84)
        dom = font('jost', 40, 400)
        d.text((W - MARGIN - d.textlength('buyitscovers.com', font=dom), b + 28), 'buyitscovers.com', font=dom, fill=MUTED)
    d.line((MARGIN, header_h - 60, W - MARGIN, header_h - 60), fill=(52, 48, 43), width=2)

    # The grid, in the order of the numbers; the last row is centred.
    t_f, a_f, c_f, n_f = font('jost', 30, 500), font('jost', 26, 400), font('jost', 24, 400), font('jost', 24, 400)
    for i, (w, tile) in enumerate(zip(works, tiles)):
        r, c = divmod(i, COLS)
        in_row = min(COLS, len(works) - r * COLS)
        x0 = (W - (in_row * tw + (in_row - 1) * GAP_X)) // 2
        x = x0 + c * (tw + GAP_X)
        y = header_h + r * (th + TEXT_H + GAP_Y)
        img.paste(fill(tile, tw, th), (x, y))
        ty = y + th + 16
        # A work printed in two designs keeps its series number; the second tile says so.
        repeat = i > 0 and works[i - 1]['id'] == w['id']
        number = sum(1 for k, x in enumerate(works[:i + 1]) if k == 0 or works[k - 1]['id'] != x['id'])
        num = f'{number}  '
        d.text((x, ty + 4), num, font=n_f, fill=MUTED)
        nx = x + d.textlength(num, font=n_f)
        # The title gets two lines; the first is indented past the number.
        lines = wrap(d, w['title'], t_f, tw - (nx - x))
        if len(lines) > 1:
            rest = wrap(d, ' '.join(lines[1:]), t_f, tw)
            lines = [lines[0], fit_text(d, ' '.join(rest), t_f, tw)]
        d.text((nx, ty), lines[0], font=t_f, fill=CREAM)
        if len(lines) > 1:
            d.text((x, ty + 36), lines[1], font=t_f, fill=CREAM)
        ay = ty + 36 * len(lines) + 6
        d.text((x, ay), fit_text(d, 'later printing' if repeat else w.get('author', ''), a_f, tw), font=a_f, fill=MUTED)
        artists = w.get('coverArtists') or []
        if artists:
            d.text((x, ay + 36), fit_text(d, 'Cover: ' + ', '.join(artists), c_f, tw), font=c_f, fill=ACCENT)

    # Footer: the site and the address of this collection.
    if not plain:
        fy = H - footer_h + 70
        d.line((MARGIN, fy - 40, W - MARGIN, fy - 40), fill=(52, 48, 43), width=2)
        link = f'buyitscovers.com/collections/{slug}'
        lf = font('jost', 52, 400)
        d.text((MARGIN, fy + 14), link, font=lf, fill=CREAM)
        brand(d, W - MARGIN, fy, 84)

    # --plain: the same picture without the site's name, for forums that refuse it (Julian, 2026-10-07).
    out = os.path.join(HERE, 'out', f'collection-{slug}{"-plain" if plain else ""}{"-first" if first else ""}.jpg')
    img.save(out, quality=92)
    print('written', out, img.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], '--plain' in sys.argv[3:], '--first' in sys.argv[3:])
