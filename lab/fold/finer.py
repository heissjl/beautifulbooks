# -*- coding: utf-8 -*-
"""Ist der 64-Bit-Hash schlicht zu grob? Feinere Raster und eine Farbschranke.

    python3 lab/fold/finer.py

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


def dhash_bits(im, n):
    t = im.convert('L').resize((n + 1, n))
    px = list(t.getdata())
    return [1 if px[y * (n + 1) + x] > px[y * (n + 1) + x + 1] else 0
            for y in range(n) for x in range(n)]


def frac(a, b):
    return sum(1 for x, y in zip(a, b) if x != y) / len(a)


def colour_layout(im, n=4):
    return list(im.convert('RGB').resize((n, n)).getdata())


def colour_dist(a, b):
    return sum(sum(abs(p - q) for p, q in zip(x, y)) for x, y in zip(a, b)) / (len(a) * 3 * 255)


def main():
    rows = []
    for p in PAIRS:
        a, b = load(p['a']), load(p['b'])
        ga, gb = a.convert('L'), b.convert('L')
        ea, eb = ImageOps.equalize(ga), ImageOps.equalize(gb)
        rows.append((p['label'], p['indexDistance'],
                     frac(dhash_bits(ga, 8), dhash_bits(gb, 8)),
                     frac(dhash_bits(ga, 16), dhash_bits(gb, 16)),
                     frac(dhash_bits(ga, 32), dhash_bits(gb, 32)),
                     frac(dhash_bits(ea, 16), dhash_bits(eb, 16)),
                     colour_dist(colour_layout(a), colour_layout(b))))

    hdr = ('8x8', '16x16', '32x32', '16 eq', 'colour')
    print(f"{'label':5} {'idx':>3} " + ' '.join(f'{h:>7}' for h in hdr))
    for r in rows:
        print(f'{r[0]:5} {r[1]:>3} ' + ' '.join(f'{v:>7.3f}' for v in r[2:]))

    print()
    for k, name in enumerate(hdr):
        s = [r[2 + k] for r in rows if r[0] == 'same']
        d = [r[2 + k] for r in rows if r[0] == 'diff']
        gap = min(d) - max(s)
        print(f'{name:7} same max {max(s):.3f}  diff min {min(d):.3f}  '
              f'gap {gap:+.3f}  {"SEPARATES" if gap > 0 else "overlaps"}')


if __name__ == '__main__':
    main()
