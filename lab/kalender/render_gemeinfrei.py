"""
Renders the Instagram exposé carousel (1080x1350) and the first Pinterest pin
(1000x1500) from five public-domain covers (ROADMAP 5.6b; the covers and why
they are free: docs/plans/research-gemeinfreie-cover.md).

    python3 lab/kalender/render_gemeinfrei.py      # writes lab/kalender/out/

It also lays out a second carousel and pin from author portraits made of the
authors' covers (Julian, 2026-10-05: mosaics of covers that are not public
domain "should pragmatically not cause rights problems"). The mosaics
themselves come from lab/mosaic, one command each, documented in
lab/kalender/README.md; this script only adds the captions.

Python because Pillow sets type with real fonts; the site's Xanh Mono and Jost
are fetched once from the google/fonts repository. Covers come from archive.org
scans where one is large enough, otherwise Open Library's L size; both are
cached under out/cache, one request at a time with a pause (Open Library shuts
the door on bursts, CLAUDE.md). Nothing here asks Google.
"""
import os
import time
import urllib.request
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
CACHE = os.path.join(OUT, 'cache')

# The site's tokens (app/globals.css, light theme).
BG = (244, 240, 232)
INK = (26, 23, 20)
MUTED = (110, 101, 91)
ACCENT = (148, 81, 56)

FONTS = {
    'xanh': 'https://raw.githubusercontent.com/google/fonts/main/ofl/xanhmono/XanhMono-Regular.ttf',
    'xanh-italic': 'https://raw.githubusercontent.com/google/fonts/main/ofl/xanhmono/XanhMono-Italic.ttf',
    'jost': 'https://raw.githubusercontent.com/google/fonts/main/ofl/jost/Jost%5Bwght%5D.ttf',
}

# In carousel order. `crop` trims scan borders as fractions (left, top, right, bottom).
COVERS = [
    dict(key='peter', title='Peter and Wendy', imprint="Charles Scribner's Sons, New York, 1911",
         credit='Cover: F. D. Bedford (d. 1954)', work='OL462007W',
         url='https://archive.org/download/peterwendy00barr2/page/n0.jpg', crop=(0.012, 0.008, 0.012, 0.008)),
    dict(key='pinocchio', title='Le avventure di Pinocchio', imprint='R. Bemporad & Figlio, Florence, 1902',
         credit='Cover: Carlo Chiostri (d. 1939)', work='OL1527356W',
         url='https://covers.openlibrary.org/b/id/6527327-L.jpg', crop=(0, 0, 0, 0)),
    dict(key='jungle', title='The Jungle Book', imprint='Macmillan and Co., London, 1894',
         credit='Cover: John Lockwood Kipling (d. 1911)', work='OL19870W',
         url='https://covers.openlibrary.org/b/id/6252570-L.jpg', crop=(0, 0, 0, 0)),
    dict(key='alice', title="Alice's Adventures in Wonderland", imprint='John Lane, The Bodley Head, London, 1928',
         credit='Cover: W. H. Walker (d. 1938)', work='OL138052W',
         url='https://archive.org/download/alicesadventures0000unse_v7d2/page/n0.jpg', crop=(0.012, 0.008, 0.012, 0.008)),
    dict(key='guerre', title='La guerre des mondes', imprint='L. Vandamme & Co., Brussels, 1906',
         credit='Cover: Henrique Alvim Corrêa (d. 1910)', work='OL52114W',
         url='https://covers.openlibrary.org/b/id/14614995-L.jpg', crop=(0, 0, 0, 0)),
]


def fetch(url: str, name: str) -> str:
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={'User-Agent': 'Buy Its Covers lab (render_gemeinfrei.py)'})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as f:
            f.write(r.read())
        time.sleep(3)
    return path


def font(name: str, size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(fetch(FONTS[name], f'{name}.ttf'), size)
    if weight is not None:
        f.set_variation_by_axes([weight])
    return f


def cover_image(c: dict) -> Image.Image:
    im = Image.open(fetch(c['url'], f"{c['key']}{os.path.splitext(c['url'])[1]}")).convert('RGB')
    l, t, r, b = c['crop']
    w, h = im.size
    return im.crop((int(w * l), int(h * t), int(w * (1 - r)), int(h * (1 - b))))


def place_cover(canvas: Image.Image, im: Image.Image, box_h: int, top: int) -> tuple[int, int, int, int]:
    """Centres the cover at height box_h with a soft shadow, returns its box."""
    w = round(im.width * box_h / im.height)
    im = im.resize((w, box_h), Image.LANCZOS)
    x = (canvas.width - w) // 2
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle((x + 6, top + 14, x + w + 6, top + box_h + 14), fill=(20, 16, 12, 70))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    canvas.paste(im, (x, top))
    return x, top, x + w, top + box_h


def centred(d: ImageDraw.ImageDraw, y: int, text: str, f, fill, width: int) -> int:
    tw = d.textlength(text, font=f)
    d.text(((width - tw) / 2, y), text, font=f, fill=fill)
    return y + f.size


def tight_text(d: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, f, fill, space: float = 0.5):
    """Draws text with word spaces at `space` of the monospaced advance."""
    x, y = xy
    gap = d.textlength(' ', font=f) * space
    # A monospaced comma or full stop sits in the middle of a full cell, which
    # looks like a space before it; pull it in by a third of a cell.
    pull = d.textlength(' ', font=f) * 0.35
    for i, word in enumerate(text.split(' ')):
        if i:
            x += gap
        stem, mark = (word[:-1], word[-1]) if word[-1:] in ',.;:' else (word, '')
        d.text((x, y), stem, font=f, fill=fill)
        x += d.textlength(stem, font=f)
        if mark:
            d.text((x - pull, y), mark, font=f, fill=fill)
            x += d.textlength(mark, font=f) - pull


def wrap(d: ImageDraw.ImageDraw, text: str, f, max_w: int) -> list[str]:
    lines, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if d.textlength(trial, font=f) <= max_w:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def counter(d, i: int, n: int, W: int):
    f = font('jost', 26, 400)
    t = f'{i}/{n}'
    d.text((W - 64 - d.textlength(t, font=f), 52), t, font=f, fill=MUTED)


def carousel():
    W, H, n = 1080, 1350, len(COVERS) + 2
    slides = []

    # 1: the line, and what follows.
    s = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(s)
    d.text((80, 80), 'Buy Its Covers', font=font('xanh-italic', 44), fill=INK)
    counter(d, 1, n, W)
    big, big_i = font('xanh', 118), font('xanh-italic', 118)
    d.text((80, 760), 'Judge a book,', font=big, fill=INK)
    d.text((80, 900), 'buy its covers.', font=big_i, fill=ACCENT)
    f = font('jost', 36, 400)
    d.text((84, 1110), 'Five covers from before 1931,', font=f, fill=INK)
    d.text((84, 1158), 'all in the public domain', font=f, fill=INK)
    # Jost has no arrow glyph, so the arrow is drawn.
    x0 = 84 + d.textlength('all in the public domain', font=f) + 24
    y0 = 1158 + 24
    d.line((x0, y0, x0 + 56, y0), fill=INK, width=3)
    d.line((x0 + 40, y0 - 14, x0 + 57, y0), fill=INK, width=3)
    d.line((x0 + 40, y0 + 14, x0 + 57, y0), fill=INK, width=3)
    slides.append(s)

    # 2..6: one cover each.
    for i, c in enumerate(COVERS, start=2):
        s = Image.new('RGBA', (W, H), BG + (255,))
        d = ImageDraw.Draw(s)
        counter(d, i, n, W)
        place_cover(s, cover_image(c), 860, 120)
        d = ImageDraw.Draw(s)
        y = 1040
        title_f = font('xanh', 54)
        for line in wrap(d, c['title'], title_f, W - 160):
            y = centred(d, y, line, title_f, INK, W) + 6
        y = centred(d, y + 14, c['imprint'], font('jost', 30, 400), INK, W) + 10
        centred(d, y, c['credit'], font('jost', 28, 400), MUTED, W)
        slides.append(s)

    # Last: what the site does.
    s = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(s)
    counter(d, n, n, W)
    f, y = font('xanh', 72), 330
    for text in ['Type a title.', 'See the covers it', 'has been printed with,', 'by language and year.', 'Find the edition', "you'd want on your shelf."]:
        d.text((80, y), text, font=f, fill=INK)
        y += 92
    d.text((80, 1060), 'buyitscovers.com', font=font('xanh-italic', 64), fill=ACCENT)
    d.text((84, 1150), 'Link in bio', font=font('jost', 32, 400), fill=MUTED)
    slides.append(s)

    for i, s in enumerate(slides, start=1):
        s.convert('RGB').save(os.path.join(OUT, f'instagram-{i}.jpg'), quality=92)


def pin():
    W, H = 1000, 1500
    c = COVERS[0]
    s = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(s)
    d.text((70, 70), 'Buy Its Covers', font=font('xanh-italic', 40), fill=INK)
    place_cover(s, cover_image(c), 980, 170)
    d = ImageDraw.Draw(s)
    d.text((70, 1200), 'Peter and Wendy, 1911', font=font('xanh', 64), fill=INK)
    d.text((72, 1286), 'Cover: F. D. Bedford. Peter Pan, decade by decade:', font=font('jost', 30, 400), fill=INK)
    d.text((72, 1328), 'buyitscovers.com', font=font('xanh-italic', 44), fill=ACCENT)
    s.convert('RGB').save(os.path.join(OUT, 'pinterest-1.jpg'), quality=92)


# Portraits whose face reads in the mosaic (Wilde and Woolf were tried and did
# not: Woolf's light face dissolves into her light background, Wilde sits too
# small in his seated photograph). Credits from lab/loading/templates.json.
PORTRAITS = [
    dict(key='mark-twain', name='Mark Twain', books='his eight most-printed books', search='mark twain',
         credit='Portrait: photograph, 1907 (public domain)'),
    dict(key='jane-austen', name='Jane Austen', books='her eight most-printed books', search='jane austen',
         credit='Portrait: engraving after Cassandra Austen, 1870 (public domain)'),
    dict(key='edgar-allan-poe', name='Edgar Allan Poe', books='his eight most-printed books', search='edgar allan poe',
         credit='Portrait: daguerreotype, 1849 (public domain)'),
    dict(key='charles-dickens', name='Charles Dickens', books='his eight most-printed books', search='charles dickens',
         credit='Portrait: Jeremiah Gurney, 1867–68 (public domain)'),
]


def mosaic_carousel():
    W, H = 1080, 1350
    n = len(PORTRAITS) + 2
    slides = []
    s = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(s)
    d.text((80, 80), 'Buy Its Covers', font=font('xanh-italic', 44), fill=INK)
    counter(d, 1, n, W)
    big, big_i = font('xanh', 104), font('xanh-italic', 104)
    d.text((80, 700), 'Four writers,', font=big, fill=INK)
    d.text((80, 828), 'made of their', font=big, fill=INK)
    d.text((80, 956), 'own covers.', font=big_i, fill=ACCENT)
    f = font('jost', 36, 400)
    d.text((84, 1150), 'Every tile is a printing of their books', font=f, fill=INK)
    slides.append(s)
    for i, p in enumerate(PORTRAITS, start=2):
        s = Image.new('RGBA', (W, H), BG + (255,))
        m = Image.open(os.path.join(OUT, f"mosaic-{p['key']}.png")).convert('RGB')
        m = m.resize((W, round(m.height * W / m.width)), Image.LANCZOS).crop((0, 0, W, 1152))
        s.paste(m, (0, 0))
        d = ImageDraw.Draw(s)
        d.text((64, 1176), p['name'], font=font('xanh', 52), fill=INK)
        d.text((66, 1242), f"made of covers of {p['books']}", font=font('jost', 30, 400), fill=INK)
        d.text((66, 1284), p['credit'], font=font('jost', 24, 400), fill=MUTED)
        t = f'{i}/{n}'
        cf = font('jost', 26, 400)
        d.text((W - 64 - d.textlength(t, font=cf), 1184), t, font=cf, fill=MUTED)
        slides.append(s)
    s = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(s)
    counter(d, n, n, W)
    f, y = font('xanh', 72), 330
    for text in ['Type a title or a name.', 'See the covers', 'their books have been', 'printed with.', 'Find the edition', "you'd want on your shelf."]:
        d.text((80, y), text, font=f, fill=INK)
        y += 92
    d.text((80, 1060), 'buyitscovers.com', font=font('xanh-italic', 64), fill=ACCENT)
    d.text((84, 1150), 'Link in bio', font=font('jost', 32, 400), fill=MUTED)
    slides.append(s)
    for i, s in enumerate(slides, start=1):
        s.convert('RGB').save(os.path.join(OUT, f'instagram-mosaik-{i}.jpg'), quality=92)


def mosaic_pin():
    W, H = 1000, 1500
    s = Image.new('RGBA', (W, H), BG + (255,))
    m = Image.open(os.path.join(OUT, 'mosaic-mark-twain-pin.png')).convert('RGB')
    m = m.resize((W, round(m.height * W / m.width)), Image.LANCZOS).crop((0, 0, W, 1290))
    s.paste(m, (0, 0))
    d = ImageDraw.Draw(s)
    d.text((60, 1312), 'Mark Twain, made of his covers', font=font('xanh', 54), fill=INK)
    d.text((62, 1382), 'Tom Sawyer, Huck Finn and six more, in every tile.', font=font('jost', 28, 400), fill=INK)
    d.text((62, 1424), 'buyitscovers.com', font=font('xanh-italic', 40), fill=ACCENT)
    s.convert('RGB').save(os.path.join(OUT, 'pinterest-mosaik-1.jpg'), quality=92)


# Women only, and a short story (Julian, 2026-10-05: "bereite mosaike mit nur
# frauen vor", fewer slides, other words on the first one, blend as close to 0
# as possible). Rendered at 45 columns with no blend. Of nine women tried,
# these three read at blend 0; Eliot, Shelley and Cather came out too soft,
# Montgomery, Brontë and Burnett as faces cut or blurred.
WOMEN = [
    dict(key='jane-austen', name='Jane Austen', books='made of covers of her most-printed books',
         credit='Portrait: engraving after Cassandra Austen, 1870 (public domain)'),
    dict(key='louisa-may-alcott', name='Louisa May Alcott', books='made of covers of her eight most-printed books',
         credit="Portrait: Warren's Portraits, Boston, c. 1870 (public domain)"),
    dict(key='edith-wharton', name='Edith Wharton', books='made of covers of her most-printed books',
         credit='Portrait: E. F. Cooper, Newport, c. 1889–90 (public domain)'),
]


def women_story():
    W, H = 1080, 1350
    n = len(WOMEN) + 1
    slides = []
    s = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(s)
    d.text((80, 80), 'Buy Its Covers', font=font('xanh-italic', 44), fill=INK)
    counter(d, 1, n, W)
    big, big_i = font('xanh', 96), font('xanh-italic', 96)
    d.text((80, 790), 'The women', font=big, fill=INK)
    d.text((80, 910), 'behind the covers.', font=big_i, fill=ACCENT)
    f = font('jost', 36, 400)
    d.text((84, 1110), 'Each portrait is made of the covers', font=f, fill=INK)
    d.text((84, 1158), 'her books have been printed with.', font=f, fill=INK)
    slides.append(s)
    for i, p in enumerate(WOMEN, start=2):
        s = Image.new('RGBA', (W, H), BG + (255,))
        m = Image.open(os.path.join(OUT, f"mosaic-{p['key']}.png")).convert('RGB')
        m = m.resize((W, round(m.height * W / m.width)), Image.LANCZOS).crop((0, 0, W, 1152))
        s.paste(m, (0, 0))
        d = ImageDraw.Draw(s)
        d.text((64, 1176), p['name'], font=font('xanh', 52), fill=INK)
        d.text((66, 1242), p['books'], font=font('jost', 30, 400), fill=INK)
        d.text((66, 1284), p['credit'], font=font('jost', 24, 400), fill=MUTED)
        cf = font('jost', 26, 400)
        t = f'{i}/{n}'
        d.text((W - 64 - d.textlength(t, font=cf), 1184), t, font=cf, fill=MUTED)
        uf = font('xanh-italic', 30)
        d.text((W - 64 - d.textlength('buyitscovers.com', font=uf), 1282), 'buyitscovers.com', font=uf, fill=ACCENT)
        slides.append(s)
    for i, s in enumerate(slides, start=1):
        s.convert('RGB').save(os.path.join(OUT, f'instagram-frauen-{i}.jpg'), quality=92)


# A draft for when public domain would not matter (Julian, 2026-10-05: "mache
# mal einen entwurf, wenn gemeinfrei nicht relevant wäre"): two covers that are
# actually in the game's pool (data/versus-pool.json). Not cleared for posting:
# these covers are protected, and the rights decision for single covers is open.
VERSUS_DRAFT = (
    dict(key='pool-gatsby', title='The Great Gatsby', imprint='in the game, 2026', credit='',
         url='https://covers.openlibrary.org/b/id/12547003-L.jpg', crop=(0, 0, 0, 0)),
    dict(key='pool-dune', title='Dune', imprint='in the game, 2026', credit='',
         url='https://covers.openlibrary.org/b/id/380097-L.jpg', crop=(0, 0, 0, 0)),
)


def versus_pin(pair=None, name='pinterest-versus.jpg'):
    """The Pinterest exposé (Julian, 2026-10-05): the cover game at /versus, its
    own question and line, shown with two public-domain covers so the pin
    needs no rights decision. The game itself shows covers that are not free."""
    W, H = 1000, 1500
    s = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(s)
    d.text((70, 64), 'Buy Its Covers', font=font('xanh-italic', 40), fill=INK)
    q = font('xanh', 62)
    d.text((70, 170), 'Which cover would you', font=q, fill=INK)
    d.text((70, 246), 'rather look at?', font=q, fill=INK)
    left, right = pair or (COVERS[0], COVERS[4])  # Peter and Wendy 1911, La guerre des mondes 1906 (Julian: two others)
    box_h, top = 600, 420
    boxes = []
    for c, cx in ((left, W // 4 + 10), (right, 3 * W // 4 - 10)):
        im = cover_image(c)
        w = round(im.width * box_h / im.height)
        if w > 400:
            w, h = 400, round(im.height * 400 / im.width)
        else:
            h = box_h
        im = im.resize((w, h), Image.LANCZOS)
        x, y = cx - w // 2, top + (box_h - h) // 2
        shadow = Image.new('RGBA', s.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rectangle((x + 6, y + 14, x + w + 6, y + h + 14), fill=(20, 16, 12, 70))
        s.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(16)))
        s.paste(im, (x, y))
        boxes.append((cx, c))
    d = ImageDraw.Draw(s)
    of = font('xanh-italic', 48)
    d.text(((W - d.textlength('or', font=of)) / 2, top + box_h // 2 - 30), 'or', font=of, fill=MUTED)
    lf = font('jost', 26, 400)
    for cx, c in boxes:
        year = c['imprint'].rsplit(', ', 1)[1]
        label = c['title'] if c['key'].startswith('pool-') else f"{c['title']}, {year}"
        d.text((cx - d.textlength(label, font=lf) / 2, top + box_h + 30), label, font=lf, fill=MUTED)
    # Julian, 2026-10-05: no explaining sentences under the tagline, and tidy
    # its spacing — Xanh Mono is monospaced, so a full-width space reads as a gap.
    tight_text(d, (70, 1180), 'Judge the cover, not the book.', font('xanh-italic', 58), ACCENT)
    d.text((72, 1330), 'buyitscovers.com/versus', font=font('xanh-italic', 40), fill=INK)
    s.convert('RGB').save(os.path.join(OUT, name), quality=92)


def rowohlt_pin():
    """A pin from Julian's photograph of his framed wall of Rowohlts Monographien
    (2026-10-06, "einen pinterest post, der das bild hier nutzt"). The photo is
    his and stays local (out/cache is git-ignored, like docs/tests images)."""
    src = os.path.join(CACHE, 'rowohlt-wand.jpg')
    if not os.path.exists(src):
        return
    W, H = 1000, 1500
    s = Image.new('RGBA', (W, H), BG + (255,))
    photo = Image.open(src).convert('RGB')
    # The frame, with a little of the wall around it.
    photo = photo.crop((150, 70, 1055, 1545))
    ph = 1180
    pw = round(photo.width * ph / photo.height)
    photo = photo.resize((pw, ph), Image.LANCZOS)
    x = (W - pw) // 2
    shadow = Image.new('RGBA', s.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle((x + 8, 34, x + pw + 8, 34 + ph + 16), fill=(20, 16, 12, 60))
    s.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    s.paste(photo, (x, 30))
    d = ImageDraw.Draw(s)
    tight_text(d, (60, 1250), 'A hundred and ten lives,', font('xanh', 50), INK)
    tight_text(d, (60, 1312), 'one wall.', font('xanh-italic', 50), ACCENT)
    d.text((62, 1392), 'Rowohlts Monographien, framed. The covers and their editions:', font=font('jost', 26, 400), fill=INK)
    d.text((62, 1430), 'buyitscovers.com', font=font('xanh-italic', 36), fill=ACCENT)
    s.convert('RGB').save(os.path.join(OUT, 'pinterest-rowohlt-wand.jpg'), quality=92)


if __name__ == '__main__':
    os.makedirs(CACHE, exist_ok=True)
    carousel()
    pin()
    versus_pin()
    rowohlt_pin()
    versus_pin(VERSUS_DRAFT, 'pinterest-versus-entwurf.jpg')
    if os.path.exists(os.path.join(OUT, 'mosaic-mark-twain.png')):
        mosaic_carousel()
    if os.path.exists(os.path.join(OUT, 'mosaic-mark-twain-pin.png')):
        mosaic_pin()
    if all(os.path.exists(os.path.join(OUT, f"mosaic-{p['key']}.png")) for p in WOMEN):
        women_story()
    print('written to', OUT)
