"""
Contact sheets for the Szafran match: per row the ISFDB scan of the printing
Szafran's art first appeared on, then up to seven Open Library candidates of
the same publisher (szafran_ol.py). Decided by looking, never by a hash.

    python3 lab/collections/szafran_sheets.py   # needs in/szafran/isfdb-images.json
"""
import json, os, time, urllib.request
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'in', 'szafran')
TW, TH, PER, ROWS = 150, 230, 7, 6
UA = {'User-Agent': 'Mozilla/5.0 (Buy Its Covers lab)'}

def fetch(url, path):
    if not os.path.exists(path):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                open(path, 'wb').write(r.read())
        except Exception:
            return None
        time.sleep(0.4)
    try:
        return Image.open(path).convert('RGB')
    except Exception:
        return None

def fit(im):
    t = Image.new('RGB', (TW, TH), (40, 40, 40))
    if im:
        im = im.copy(); im.thumbnail((TW, TH)); t.paste(im, ((TW - im.width) // 2, (TH - im.height) // 2))
    return t

def main():
    cands = json.load(open(os.path.join(D, 'candidates.json')))
    imgs = json.load(open(os.path.join(D, 'isfdb-images.json')))
    os.makedirs(os.path.join(D, 'img'), exist_ok=True)
    rows = [r for r in cands.values() if r['candidates']]
    for s in range(0, len(rows), ROWS):
        chunk = rows[s:s + ROWS]
        sheet = Image.new('RGB', ((PER + 1) * (TW + 8) + 8, len(chunk) * (TH + 34) + 8), (18, 18, 18))
        d = ImageDraw.Draw(sheet)
        for i, r in enumerate(chunk):
            y = 8 + i * (TH + 34)
            src = imgs.get(r['isfdb_pub'], '')
            ref = fetch(src, os.path.join(D, 'img', f"isfdb-{r['isfdb_pub']}.jpg")) if src.startswith('http') else None
            sheet.paste(fit(ref), (8, y + 16))
            d.text((8, y + 2), f"{s + i + 1}. {r['title'][:34]} ({r['publisher'][:12]} {r['first_date']})", fill=(255, 220, 120))
            covers = [(c, e) for e in r['candidates'] for c in e['covers'][:2]][:PER]
            for j, (c, e) in enumerate(covers):
                x = 8 + (j + 1) * (TW + 8)
                sheet.paste(fit(fetch(f'https://covers.openlibrary.org/b/id/{c}-M.jpg', os.path.join(D, 'img', f'{c}.jpg'))), (x, y + 16))
                d.text((x, y + 16 + TH + 2), f"{c}{' =isbn' if e['sameIsbn'] else ''}", fill=(200, 200, 200))
        out = os.path.join(D, f'sheet-{s // ROWS + 1:02d}.jpg')
        sheet.save(out, quality=85); print('written', out)

if __name__ == '__main__':
    main()
