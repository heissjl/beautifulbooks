# -*- coding: utf-8 -*-
"""Laesst sich der dHash gegen den Scan-Grundton unempfindlich machen?

    python3 lab/fold/variants.py

Bilder werden unter $FOLD_OUT zwischengespeichert (Vorgabe /tmp/fold), damit
ein zweiter Lauf nichts mehr holt. Kein Netz ausser den Coverbildern selbst.
"""
import json, os, io, urllib.request
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('FOLD_OUT', '/tmp/fold')
os.makedirs(f'{OUT}/imgs', exist_ok=True)

DATA = json.load(open(f'{HERE}/pairs-labelled.json'))
PAIRS = [p for p in DATA['pairs'] if p['label'] in ('same', 'diff')]


def load(cid):
    """Disk-cached; three tries, then say so instead of quietly using a grey box."""
    num = cid.split(':', 1)[1]
    path = f'{OUT}/imgs/{num}.jpg'
    if not os.path.exists(path):
        last = None
        for _ in range(3):
            try:
                with urllib.request.urlopen(
                    f'https://covers.openlibrary.org/b/id/{num}-M.jpg', timeout=40) as r:
                    open(path, 'wb').write(r.read())
                break
            except Exception as e:
                last = e
        else:
            raise RuntimeError(f'{cid}: {last}')
    return Image.open(path)


def dhash_bits(im, n=8):
    t = im.convert('L').resize((n + 1, n))
    px = list(t.getdata())
    return [1 if px[y * (n + 1) + x] > px[y * (n + 1) + x + 1] else 0
            for y in range(n) for x in range(n)]


def margins(im, n=8):
    """Per bit: how far apart the two neighbours were. Near-equal bits are noise."""
    t = im.convert('L').resize((n + 1, n))
    px = list(t.getdata())
    return [abs(px[y * (n + 1) + x] - px[y * (n + 1) + x + 1])
            for y in range(n) for x in range(n)]


def ham(a, b):
    return sum(1 for x, y in zip(a, b) if x != y)


def tolerant(a, b, floor=6):
    """Distance over the bits both images were confident about, scaled back to 64."""
    ba, bb, ma, mb = dhash_bits(a), dhash_bits(b), margins(a), margins(b)
    kept = [(x, y) for x, y, u, v in zip(ba, bb, ma, mb) if u >= floor and v >= floor]
    if not kept:
        return 64, 0
    return round(sum(1 for x, y in kept if x != y) * 64 / len(kept)), len(kept)


def main():
    rows = []
    for p in PAIRS:
        a, b = load(p['a']).convert('L'), load(p['b']).convert('L')
        td, kept = tolerant(a, b)
        rows.append((p['label'], p['indexDistance'],
                     ham(dhash_bits(a), dhash_bits(b)),
                     ham(dhash_bits(ImageOps.autocontrast(a, cutoff=2)),
                         dhash_bits(ImageOps.autocontrast(b, cutoff=2))),
                     ham(dhash_bits(ImageOps.equalize(a)), dhash_bits(ImageOps.equalize(b))),
                     td, kept))

    print(f"{'label':5} {'idx':>3} {'plain':>5} {'autoc':>5} {'equal':>5} {'tol':>4} {'kept':>4}")
    for r in rows:
        print(f'{r[0]:5} {r[1]:>3} {r[2]:>5} {r[3]:>5} {r[4]:>5} {r[5]:>4} {r[6]:>4}')

    print()
    for k, name in ((2, 'plain'), (3, 'autocontrast'), (4, 'equalised'), (5, 'tolerant')):
        s = [r[k] for r in rows if r[0] == 'same']
        d = [r[k] for r in rows if r[0] == 'diff']
        gap = min(d) - max(s)
        print(f'{name:13} same max {max(s):>3}  diff min {min(d):>3}  '
              f'gap {gap:+d}  {"SEPARATES" if gap > 0 else "overlaps"}')


if __name__ == '__main__':
    main()
