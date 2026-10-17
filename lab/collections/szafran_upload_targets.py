"""
Upload targets for Szafran covers Open Library lacks (5.10s; Julian,
2026-10-09: "da wo der OL scan fehlt, können wir ja jederzeit den isfdb scan
reinnehmen und zu OL hochladen").

For every ISFDB printing with a scan but no matching Open Library cover, the
Open Library editions of the work whose ISBN equals the printing's ISBN, or,
for printings without an ISBN, whose publisher matches and whose year is the
printing's year. Writes in/szafran/upload-targets.json; nothing is uploaded
here — that happens by hand, with Julian's yes, under his account.
"""
import csv, json, os, re, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'in', 'szafran')
UA = {'User-Agent': 'Buy Its Covers lab (szafran_upload_targets.py)'}
PICKED = set(json.load(open(os.path.join(D, 'picked.json'))))

def get(url):
    for wait in (1.5, 20, 60):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as err:
            print('  retry', err)
    return None

def main():
    cands = json.load(open(os.path.join(D, 'candidates.json')))
    imgs = json.load(open(os.path.join(D, 'isfdb-images.json')))
    out = {}
    for pub, r in cands.items():
        if pub in PICKED or not imgs.get(pub) or not r.get('work'): continue
        isbn = re.sub(r'[^0-9X]', '', r['isbn_or_catalog'].split('/')[0]) if re.search(r'\d-\d', r['isbn_or_catalog']) else ''
        year = r['first_date'][:4]
        pubw = re.split(r'[ /(]', r['publisher'].replace('Books', '').strip())[0].lower()
        e = get(f"https://openlibrary.org/works/{r['work']}/editions.json?limit=300") or {}
        hits = []
        for ed in e.get('entries', []):
            isbns = [re.sub(r'[^0-9X]', '', i) for i in ed.get('isbn_10', []) + ed.get('isbn_13', [])]
            y = re.search(r'(19\d\d|20\d\d)', ed.get('publish_date', ''))
            pubs = ' '.join(ed.get('publishers', [])).lower()
            if isbn and any(isbn == i or (len(i) == 13 and isbn[:9] in i) for i in isbns):
                why = 'isbn'
            elif not isbn and year and y and y.group(1) == year and (pubw in pubs or (pubw == 'signet' and 'new american' in pubs)):
                why = 'publisher+year'
            else:
                continue
            hits.append({'edition': ed['key'].split('/')[-1], 'why': why, 'date': ed.get('publish_date', ''), 'publishers': ed.get('publishers', []), 'isbns': isbns, 'covers': [c for c in ed.get('covers', []) if c and c > 0]})
        out[pub] = {'title': r['title'], 'author': r['author'], 'printing': f"{r['publisher']} {r['first_date']} {r['isbn_or_catalog']}", 'work': r['work'], 'isfdbImage': imgs[pub], 'editions': hits}
        print(f"{r['title'][:38]:38} {len(hits)} edition(s): " + ', '.join(f"{h['edition']} ({h['why']}, {h['date']}, covers {len(h['covers'])})" for h in hits), flush=True)
        json.dump(out, open(os.path.join(D, 'upload-targets.json'), 'w'), indent=1)

if __name__ == '__main__':
    main()
