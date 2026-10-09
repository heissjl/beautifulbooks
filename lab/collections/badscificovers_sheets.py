"""
Contact sheets for the r/badscificovers match (PLAN-5.6b §6a).

The dHash only orders candidates: a photo of a book on a table is 18-26 bits
from a clean scan of the same cover. So each post gets one row: the post's
picture, then its nearest Open Library covers with their distance, and the
decision is made by looking. Six rows per sheet, written to
lab/collections/in/badscificovers-sheets/ (git-ignored).

    python3 lab/collections/badscificovers_sheets.py [matches file] [sheet prefix]

Defaults: badscificovers-matches.json and sheet-; for page 2 of the listing,
`badscificovers-matches-200.json p2-` (2026-10-08).
"""
import sys
import json
import os
import time
import urllib.request
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(HERE, 'in')
SMALL = os.path.join(IN, 'badscificovers-small')
COVERS = os.path.join(IN, 'badscificovers-covers')
OUT = os.path.join(IN, 'badscificovers-sheets')
TW, TH, PER_ROW, ROWS = 150, 225, 6, 6


def cover(cid: int) -> Image.Image | None:
    path = os.path.join(COVERS, f'{cid}.jpg')
    if not os.path.exists(path):
        try:
            with urllib.request.urlopen(f'https://covers.openlibrary.org/b/id/{cid}-M.jpg', timeout=30) as r:
                open(path, 'wb').write(r.read())
        except Exception:
            return None
        time.sleep(0.3)
    try:
        return Image.open(path).convert('RGB')
    except Exception:
        return None


def fit(im: Image.Image) -> Image.Image:
    im = im.copy()
    im.thumbnail((TW, TH))
    tile = Image.new('RGB', (TW, TH), (40, 40, 40))
    tile.paste(im, ((TW - im.width) // 2, (TH - im.height) // 2))
    return tile


def main() -> None:
    os.makedirs(COVERS, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    rows = [r for r in json.load(open(os.path.join(IN, sys.argv[1] if len(sys.argv) > 1 else 'badscificovers-matches.json'))) if r.get('candidates')]
    font = ImageFont.load_default()
    for s in range(0, len(rows), ROWS):
        chunk = rows[s:s + ROWS]
        sheet = Image.new('RGB', ((PER_ROW + 1) * (TW + 8) + 8, len(chunk) * (TH + 36) + 8), (18, 18, 18))
        d = ImageDraw.Draw(sheet)
        for i, r in enumerate(chunk):
            y = 8 + i * (TH + 36)
            post = Image.open(os.path.join(SMALL, f'{r["rank"]:03d}.jpg')).convert('RGB')
            sheet.paste(fit(post), (8, y + 18))
            d.text((8, y + 2), f'#{r["rank"]} {r["title"][:40]} (post)', fill=(255, 220, 120), font=font)
            for j, c in enumerate(r['candidates'][:PER_ROW]):
                im = cover(c['coverId'])
                x = 8 + (j + 1) * (TW + 8)
                if im:
                    sheet.paste(fit(im), (x, y + 18))
                d.text((x, y + 18 + TH + 2), f'{c["coverId"]} d={c["distance"]}', fill=(200, 200, 200), font=font)
        name = os.path.join(OUT, f'{sys.argv[2] if len(sys.argv) > 2 else "sheet-"}{s // ROWS + 1:02d}.jpg')
        sheet.save(name, quality=85)
        print('written', name)


if __name__ == '__main__':
    main()
