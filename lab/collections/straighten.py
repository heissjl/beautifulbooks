"""
Straightens a photographed cover into something that looks like a flat scan
(ROADMAP 5.10r; Julian, 2026-10-09: "das ist gut, behalte das skript für
ähnliche anpassungen bereit").

Two steps, because the corners are read by eye, not detected:

    python3 lab/collections/straighten.py grid  <photo.jpg>
        writes grid-<photo>.png beside it: the photo at twice the size with a
        line every 10 px of the original, labelled every 50. Read the four
        corners of the front cover from it. Read the *edges* first (a long,
        straight line is easy to place) and take the corners where they meet;
        on 2026-10-09 corners guessed straight off a 50 px grid left two of
        three covers visibly slanted, one corner ~50 px out.

    python3 lab/collections/straighten.py flat <photo.jpg> TLx,TLy TRx,TRy BRx,BRy BLx,BLy [--ratio=1.62] [--width=N]
        writes flat-<photo>.jpg: the quadrilateral mapped onto a rectangle of
        height/width = ratio (Fontana paperbacks ~1.62, SF Masterworks ~1.53).
        The width defaults to the longer of the top and bottom edges, so the
        result is never blown up beyond what the photo holds.

Then look at the result beside the photo. Title lines horizontal and the
spine edge vertical is the test; a sliver of table or spine at one side means
a corner is a few pixels out.
"""
import sys
import os
import numpy as np
from PIL import Image, ImageDraw


def coeffs(dst, src):
    """The eight coefficients PIL's PERSPECTIVE wants: output point -> input point."""
    a, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return np.linalg.solve(np.array(a, float), np.array(b, float)).tolist()


def straighten(path, corners, out, ratio=1.62, width=None):
    im = Image.open(path).convert('RGB')
    (tl, tr, br, bl) = corners
    w = width or round(max(np.hypot(tr[0] - tl[0], tr[1] - tl[1]), np.hypot(br[0] - bl[0], br[1] - bl[1])))
    h = round(w * ratio)
    flat = im.transform((w, h), Image.PERSPECTIVE, coeffs([(0, 0), (w, 0), (w, h), (0, h)], corners), Image.BICUBIC)
    flat.save(out, quality=95)
    return flat


def grid(path, out, step=10, scale=2):
    im = Image.open(path).convert('RGB')
    im = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    for v in range(0, max(im.size) // scale + 1, step):
        major = v % 50 == 0
        colour = (255, 40, 40) if major else (255, 255, 0)
        d.line((v * scale, 0, v * scale, im.height), fill=colour, width=1)
        d.line((0, v * scale, im.width, v * scale), fill=colour, width=1)
        if major:
            d.text((v * scale + 2, 2), str(v), fill=(255, 40, 40))
            d.text((2, v * scale + 2), str(v), fill=(255, 40, 40))
    im.save(out)


def beside(path, flat, out):
    a = Image.open(path).convert('RGB')
    s = Image.new('RGB', (a.width + flat.width + 30, max(a.height, flat.height) + 20), (20, 20, 20))
    s.paste(a, (10, 10)); s.paste(flat, (a.width + 20, 10))
    s.save(out, quality=90)


if __name__ == '__main__':
    cmd, path = sys.argv[1], sys.argv[2]
    folder, name = os.path.split(path)
    stem = os.path.splitext(name)[0]
    if cmd == 'grid':
        grid(path, os.path.join(folder, f'grid-{stem}.png'))
    elif cmd == 'flat':
        pts = [tuple(int(n) for n in p.split(',')) for p in sys.argv[3:7]]
        opts = dict(a[2:].split('=') for a in sys.argv[7:] if a.startswith('--'))
        out = os.path.join(folder, f'flat-{stem}.jpg')
        flat = straighten(path, pts, out, float(opts.get('ratio', 1.62)), int(opts['width']) if 'width' in opts else None)
        beside(path, flat, os.path.join(folder, f'beside-{stem}.jpg'))
        print('written', out, flat.size)
    else:
        raise SystemExit(__doc__)
