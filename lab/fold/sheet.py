# -*- coding: utf-8 -*-
"""Contact sheet of sampled cover pairs per distance band, for looking at."""
import json, random, urllib.request, io, sys, os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('FOLD_OUT', '/tmp/fold')
os.makedirs(f'{OUT}/imgs', exist_ok=True)
pairs = json.load(open(f'{OUT}/pairs.json'))
random.seed(7)

CW, CH, GAP = 150, 225, 10
cache = {}

def fetch(cid):
    if cid in cache: return cache[cid]
    num = cid.split(':', 1)[1]
    url = f'https://covers.openlibrary.org/b/id/{num}-M.jpg'
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            im = Image.open(io.BytesIO(r.read())).convert('RGB').resize((CW, CH))
    except Exception as e:
        im = Image.new('RGB', (CW, CH), (60, 60, 60))
        ImageDraw.Draw(im).text((8, 8), f'no image\n{e}'[:40], fill=(255, 255, 255))
    cache[cid] = im
    return im

band = sys.argv[1]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 10
sample = random.sample(pairs[band], min(n, len(pairs[band])))

cols = 5
rows = (len(sample) + cols - 1) // cols
pw = CW * 2 + 6
sheet = Image.new('RGB', (cols * (pw + GAP) + GAP, rows * (CH + 26 + GAP) + GAP), (250, 249, 246))
dr = ImageDraw.Draw(sheet)
for k, (w, a, b, dist, ma, mb, sa, sb) in enumerate(sample):
    x = GAP + (k % cols) * (pw + GAP)
    y = GAP + (k // cols) * (CH + 26 + GAP)
    sheet.paste(fetch(a), (x, y)); sheet.paste(fetch(b), (x + CW + 6, y))
    dr.text((x + 2, y + CH + 6), f'd={dist}  mean {ma}/{mb}  sat {sa}/{sb}', fill=(20, 20, 20))
out = f'{OUT}/band-{band}.png'
sheet.save(out)
print(out, len(sample), 'pairs')
