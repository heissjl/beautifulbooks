"""
The performative reader starter pack as a share picture (5.6b, PLAN-5.6b §4b).

Julian chose the nine books in the Shelf-Portrait editor
(https://buyitscovers.com/shelfportrait/tvujl2pk, 2026-10-06, after a first
version at /shelfportrait/mzyjqzbo). For this one
picture the board's second line is the only heading (2026-10-06: "for this
single picture i would like the subheader to be the header so i can use it
as a sharepic"; without the apostrophe: "The performative reader starter
pack").

The picture is composed here rather than taken from the site's poster: the
production poster came back with six of nine covers missing (Open Library's
images were slow) and the CDN served that same picture again, and repeated
requests to production are what the project avoids. The look follows the
poster's `ambient` ground: the board's own covers blurred to their colours
and darkened, the covers on it with a shadow, the site's proportional Xanh.

    python3 lab/kalender/sharepic_starterpack.py
"""
import os
import time
import urllib.request
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
CACHE = os.path.join(HERE, 'out', 'cache')
OUT = os.path.join(HERE, 'out', 'starterpack-sharepic.jpg')
FONTS = os.path.join(ROOT, 'assets', 'fonts')
TITLE = 'The performative reader starter pack'

# Row by row, as the board holds them (decodeBoard of the short link's `b`).
COVERS = [107193, 13136689, 14853945, 15161047, 191075, 12212058, 8310729, 9249662, 14814330]

W, H = 1080, 1350
TILE_W, TILE_H, GAP = 220, 333, 20
TOP = 143
CREAM = (244, 240, 231)
GREY = (210, 203, 194)


def cover(cid: int) -> Image.Image:
    path = os.path.join(CACHE, f'starter-{cid}.jpg')
    if not os.path.exists(path):
        req = urllib.request.Request(f'https://covers.openlibrary.org/b/id/{cid}-L.jpg', headers={'User-Agent': 'Buy Its Covers lab (sharepic_starterpack.py)'})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as f:
            f.write(r.read())
        time.sleep(2)
    return Image.open(path).convert('RGB')


def fill(im: Image.Image, w: int, h: int) -> Image.Image:
    """Cut to the tile's shape from the middle, then scale: object-fit cover."""
    if im.width / im.height > w / h:
        nw = round(im.height * w / h)
        x = (im.width - nw) // 2
        im = im.crop((x, 0, x + nw, im.height))
    else:
        nh = round(im.width * h / w)
        y = (im.height - nh) // 2
        im = im.crop((0, y, im.width, y + nh))
    return im.resize((w, h), Image.LANCZOS)


def main():
    os.makedirs(CACHE, exist_ok=True)
    tiles = [fill(cover(c), TILE_W, TILE_H) for c in COVERS]

    # The ground: the board itself, stretched over the picture, blurred until only colour is left.
    ground = Image.new('RGB', (3 * TILE_W, 3 * TILE_H))
    for i, t in enumerate(tiles):
        ground.paste(t, ((i % 3) * TILE_W, (i // 3) * TILE_H))
    ground = ground.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(60))
    ground = ImageEnhance.Brightness(ground).enhance(0.38)
    vignette = Image.new('L', (W, H), 0)
    vd = ImageDraw.Draw(vignette)
    for k in range(120):
        vd.rectangle((k, k, W - 1 - k, H - 1 - k), outline=int(150 * (1 - k / 120)))
    ground = Image.composite(Image.new('RGB', (W, H), (14, 12, 10)), ground, vignette)
    canvas = ground.convert('RGBA')

    x0 = (W - (3 * TILE_W + 2 * GAP)) // 2
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i in range(9):
        x = x0 + (i % 3) * (TILE_W + GAP)
        y = TOP + (i // 3) * (TILE_H + GAP)
        sd.rectangle((x + 6, y + 14, x + TILE_W + 6, y + TILE_H + 14), fill=(0, 0, 0, 150))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))
    for i, t in enumerate(tiles):
        canvas.paste(t, (x0 + (i % 3) * (TILE_W + GAP), TOP + (i // 3) * (TILE_H + GAP)))

    d = ImageDraw.Draw(canvas)
    head = ImageFont.truetype(os.path.join(FONTS, 'xanh-proportional-regular.woff'), 56)
    d.text(((W - d.textlength(TITLE, font=head)) / 2, 40), TITLE, font=head, fill=CREAM)
    mark = ImageFont.truetype(os.path.join(FONTS, 'xanh-proportional-italic.woff'), 38)
    d.text(((W - d.textlength('Buy Its Covers', font=mark)) / 2, 1228), 'Buy Its Covers', font=mark, fill=CREAM)
    jost = os.path.join(CACHE, 'jost.ttf')
    addr = ImageFont.truetype(jost, 32)
    addr.set_variation_by_axes([400])
    url = 'buyitscovers.com/shelfportrait'
    d.text(((W - d.textlength(url, font=addr)) / 2, 1280), url, font=addr, fill=GREY)
    canvas.convert('RGB').save(OUT, quality=93)
    print('written', OUT)


if __name__ == '__main__':
    main()
