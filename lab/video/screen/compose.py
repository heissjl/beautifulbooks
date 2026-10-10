"""
Cuts the recorded take into the 15-second clip (ROADMAP 5.5b).

  python3 lab/video/screen/compose.py

Reads lab/video/screen/out/take.json and out/raw/ (from record.ts), writes
out/frames/NNNN.jpg (1080 x 1920, 30 fps), out/preview.webp (animated, 360 px
wide) and out/encode.sh, which turns the frames into out/goodreads-clip.mp4
with encode.swift (AVFoundation).

What is cut: the time between the phase marks where the page was still
loading (the editor between "Make a collection" and the collection, the book
page before its covers had loaded), and the rest plays faster than it was
recorded, at the speeds in SEGMENTS. Nothing is drawn that the page did not
show, except what is plainly not the page: the words in their pill, the
finger, the file flying in, and the two cards.

Fonts: the site's own, Xanh Proportional for display and Jost for text,
converted once from the WOFF2 files next/font puts under .next/static/media/.
"""
import glob
import json
import math
import os
import shutil

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(HERE, 'out')
RAW = os.path.join(OUT, 'raw')
FRAMES = os.path.join(OUT, 'frames')
FONTS = os.path.join(OUT, 'fonts')
W, H, FPS = 1080, 1920, 30

# The site's light theme (app/globals.css): paper, ink, accent.
PAPER = (244, 240, 232)
INK = (26, 23, 20)
ACCENT = (148, 81, 56)

TITLE_S = 1.4
CHIP_S = 1.3
END_S = 1.6
# (from mark, to mark, speed, headline, line under it)
# Two things carry the clip (Julian, 2026-10-09): it is *your* Goodreads list,
# and the edition you love is easy to find. Each caption says one of them.
SEGMENTS = [
    # Slower than recorded (Julian, 2026-10-09: „der good-reads-teil am anfang muss etwas langsamer passieren“).
    ('drop', 'editor', 0.95, 'Your Goodreads list', 'Drop in the export file'),
    ('wall', 'book-loading', 1.3, 'Your to-read shelf', 'as a wall of covers'),
    ('book', 'shops', 1.3, 'Pick the edition you love', 'Tap the book, open its details'),
    # Not "order that edition": that needs the publisher's image to be this cover (`verified`),
    # and on 2026-10-09 Google answered no ISBN lookup at all, so no cover could be.
    ('shops', 'end', 1.0, 'See where to buy it', 'Tap a shop: it opens on this printing'),
]


def font_file(name, family, style, need_latin=True):
    os.makedirs(FONTS, exist_ok=True)
    out = os.path.join(FONTS, name)
    if os.path.exists(out):
        return out
    for path in glob.glob(os.path.join(ROOT, '.next', '**', 'static', 'media', '*.woff2'), recursive=True):
        font = TTFont(path)
        names = font['name']
        cmap = font.getBestCmap() or {}
        if names.getDebugName(1) == family and names.getDebugName(2) == style and (ord('a') in cmap or not need_latin):
            font.flavor = None
            font.save(out)
            return out
    raise SystemExit(f'{family} {style} not found under .next/ — run next dev once')


def font(path, size, weight=None):
    f = ImageFont.truetype(path, size)
    if weight is not None:
        try:
            f.set_variation_by_axes([weight])
        except OSError:
            pass
    return f


XANH = font_file('xanh.ttf', 'Xanh Proportional', 'Regular')
JOST = font_file('jost.ttf', 'Jost', 'Regular')

take = json.load(open(os.path.join(OUT, 'take.json')))
scale = take['scale']
frames = take['frames']
marks = {m['name']: m['t'] for m in take['marks']}
# The held tap at the end was recorded longer than it is shown.
marks['end'] -= 0.8


def source_frame(t):
    """The last frame recorded at or before source time t."""
    best = frames[0]
    for f in frames:
        if f['t'] <= t:
            best = f
        else:
            break
    return best['file']


# The timeline: output second -> what to draw.
timeline = []  # (out_start, out_end, kind, payload)
t = 0.0
timeline.append((t, t + TITLE_S, 'title', None))
t += TITLE_S
timeline.append((t, t + CHIP_S, 'chip', SEGMENTS[0][3:5]))
t += CHIP_S
spans = []  # (out_start, src_start, speed)
for a, b, speed, head, sub in SEGMENTS:
    words = (head, sub)
    length = (marks[b] - marks[a]) / speed
    timeline.append((t, t + length, 'take', (marks[a], speed, words)))
    spans.append((t, t + length, marks[a], marks[b], speed))
    t += length
timeline.append((t, t + END_S, 'end', None))
TOTAL = t + END_S


def out_time(src):
    for o0, o1, s0, s1, speed in spans:
        if s0 <= src <= s1:
            return o0 + (src - s0) / speed
    return None


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def card(lines, sub, foot=None):
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    big = font(XANH, 118)
    y = 720 - 70 * len(lines)
    for line in lines:
        w = d.textlength(line, font=big)
        d.text(((W - w) / 2, y), line, font=big, fill=INK)
        y += 140
    small = font(JOST, 52, 400)
    w = d.textlength(sub, font=small)
    d.text(((W - w) / 2, y + 40), sub, font=small, fill=ACCENT)
    if foot:
        tiny = font(JOST, 40, 400)
        w = d.textlength(foot, font=tiny)
        d.text(((W - w) / 2, y + 140), foot, font=tiny, fill=(110, 100, 90))
    return im


TITLE = card(['Your Goodreads list,', 'the editions you love'], 'Drop it in, pick a cover, see where to buy it')
END = card(['Buy Its Covers'], 'buyitscovers.com', 'Judge a book, buy its covers')

HEAD_FONT = font(XANH, 76)
SUB_FONT = font(JOST, 46, 400)


def pill(im, words, alpha):
    """The caption: a headline and a line under it, in a band low on the screen."""
    if alpha <= 0:
        return im
    head, sub = words
    d = ImageDraw.Draw(im)
    w = max(d.textlength(head, font=HEAD_FONT), d.textlength(sub, font=SUB_FONT))
    pad_x, h = 56, 214
    box = Image.new('RGBA', (int(w) + 2 * pad_x, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(box)
    bd.rounded_rectangle((0, 0, box.width - 1, h - 1), radius=36, fill=INK + (int(238 * alpha),))
    bd.text(((box.width - bd.textlength(head, font=HEAD_FONT)) / 2, 30), head, font=HEAD_FONT, fill=PAPER + (int(255 * alpha),))
    bd.text(((box.width - bd.textlength(sub, font=SUB_FONT)) / 2, 130), sub, font=SUB_FONT, fill=(222, 196, 170, int(255 * alpha)))
    # Low on the screen: the top holds what each step is about (the Goodreads switch, the title).
    im.paste(box, ((W - box.width) // 2, 1440), box)
    return im


def finger(im, x, y, k):
    """A soft dot where the tap lands; k runs 0..1 over its life."""
    if k <= 0 or k >= 1:
        return im
    grow = ease(k / 0.25) if k < 0.25 else 1.0
    fade = 1.0 if k < 0.7 else 1 - ease((k - 0.7) / 0.3)
    r = 54 * (0.6 + 0.4 * grow)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse((x - r, y - r, x + r, y + r), fill=(30, 26, 22, int(110 * fade)), outline=(255, 255, 255, int(200 * fade)), width=5)
    im.paste(layer, (0, 0), layer)
    return im


def pressed(im, x, y, w, h, alpha):
    """The button under the finger, lit in the accent colour while the film holds on it."""
    if alpha <= 0:
        return im
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle((x - w / 2, y - h / 2, x + w / 2, y + h / 2), radius=24, outline=ACCENT + (int(255 * alpha),), width=8, fill=ACCENT + (int(60 * alpha),))
    im.paste(layer, (0, 0), layer)
    return im


def chip(im, k, target):
    """The export file flying from the top right onto the drop zone."""
    tx, ty = target
    sx, sy = W + 300, ty - 120
    e = ease(k)
    x, y = sx + (tx - sx) * e, sy + (ty - sy) * e  # a straight slide, no arc (less movement)
    label = 'goodreads_library_export.csv'
    f = font(JOST, 38, 500)
    tw = ImageDraw.Draw(im).textlength(label, font=f)
    cw, ch = int(tw) + 150, 120
    card_im = Image.new('RGBA', (cw + 60, ch + 60), (0, 0, 0, 0))
    shadow = Image.new('RGBA', card_im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((30, 40, 30 + cw, 40 + ch), radius=22, fill=(0, 0, 0, 70))
    card_im = Image.alpha_composite(card_im, shadow.filter(ImageFilter.GaussianBlur(14)))
    cd = ImageDraw.Draw(card_im)
    cd.rounded_rectangle((30, 30, 30 + cw, 30 + ch), radius=22, fill=(255, 255, 255, 255), outline=(220, 212, 200, 255), width=2)
    # a page with a folded corner, as a file icon
    ix, iy = 58, 52
    cd.polygon([(ix, iy), (ix + 44, iy), (ix + 62, iy + 18), (ix + 62, iy + 76), (ix, iy + 76)], fill=(234, 226, 214, 255), outline=ACCENT + (255,))
    cd.text((ix + 9, iy + 40), 'CSV', font=font(JOST, 18, 600), fill=ACCENT + (255,))
    cd.text((ix + 88, 30 + (ch - 46) / 2), label, font=f, fill=INK + (255,))
    im.paste(card_im, (int(x - card_im.width / 2), int(y - card_im.height / 2)), card_im)
    return im


def fade_alpha(t0, t1, t, edge=0.2):
    return min(1.0, (t - t0) / edge, (t1 - t) / edge)


shutil.rmtree(FRAMES, ignore_errors=True)
os.makedirs(FRAMES)
zone = (take['zone']['x'] * scale, take['zone']['y'] * scale)
taps = [(tp['t'], tp['x'] * scale, tp['y'] * scale, tp.get('w', 0) * scale, tp.get('h', 0) * scale) for tp in take['taps']]
n = int(round(TOTAL * FPS))
cache = {}
preview = []
for i in range(n):
    t = i / FPS
    kind, payload, t0, t1 = None, None, 0, 0
    for a, b, k, p in timeline:
        if a <= t < b or (k == 'end' and t >= a):
            kind, payload, t0, t1 = k, p, a, b
            break
    if kind == 'title':
        im = TITLE.copy()
    elif kind == 'end':
        im = END.copy()
    else:
        src = marks['drop'] - 0.05 if kind == 'chip' else payload[0] + (t - t0) * payload[1]
        name = source_frame(src)
        if name not in cache:
            cache.clear()
            cache[name] = Image.open(os.path.join(RAW, name)).convert('RGB')
        im = cache[name].copy()
        if kind == 'chip':
            im = chip(im, (t - t0) / (t1 - t0), zone)
            words, a0, a1 = payload, t0, spans[0][1]
        else:
            words = payload[2]
            a0, a1 = t0, t1
            if kind == 'take' and words == SEGMENTS[0][3:5]:
                a0 = t0 - CHIP_S
        im = pill(im, words, fade_alpha(a0, a1, t))
        if kind == 'take':
            last = taps[-1][0]
            for tap_t, x, y, bw, bh in taps:
                s = out_time(tap_t)
                if s is None:
                    continue
                if tap_t == last:
                    # The last tap is held, not released: the button stays lit until the end card.
                    im = pressed(im, x, y, bw, bh, ease((t - s - 0.1) / 0.25))
                    im = finger(im, x, y, min(0.69, (t - s + 0.1) / 0.75))
                else:
                    im = finger(im, x, y, (t - s + 0.1) / 0.75)
    im.save(os.path.join(FRAMES, f'{i:04d}.jpg'), quality=92)
    if i % 2 == 0:
        preview.append(im.resize((360, 640), Image.LANCZOS))

preview[0].save(os.path.join(OUT, 'preview.webp'), save_all=True, append_images=preview[1:], duration=int(2000 / FPS), loop=0, quality=80)
with open(os.path.join(OUT, 'encode.sh'), 'w') as f:
    # AVFoundation, not ffmpeg (Julian, 2026-10-09): nothing to install on macOS.
    f.write('#!/bin/sh\ncd "$(dirname "$0")"\n'
            f'swift ../encode.swift frames goodreads-clip.mp4 {FPS}\n')
os.chmod(os.path.join(OUT, 'encode.sh'), 0o755)
print(json.dumps({'seconds': round(TOTAL, 2), 'frames': n, 'timeline': [(round(a, 2), round(b, 2), k) for a, b, k, _ in timeline]}))
