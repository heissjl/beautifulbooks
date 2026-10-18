"""
Finds Open Library candidates for Gene Szafran's covers (5.10, 2026-10-09).

Reads lab/collections/lists/szafran-isfdb.tsv (one row per cover art in the
ISFDB, its earliest English printing) and asks Open Library, one request at a
time with a pause, for the work and the editions of the same publisher within
a few years that carry a cover. Writes in/szafran/candidates.json (cached; a
second run only asks for rows not yet done). The decision is made by looking:
szafran_sheets.py puts the ISFDB scan beside the candidates.
"""
import csv, json, os, re, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'in', 'szafran', 'candidates.json')
UA = {'User-Agent': 'Buy Its Covers lab (szafran_ol.py)'}

def get(url):
    for wait in (0, 20, 60):
        time.sleep(wait or 1.5)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as err:
            print('  retry', err)
    return None

def short(p):
    return re.split(r'[ /(]', p.replace('Books', '').strip())[0].lower()

def main():
    done = json.load(open(OUT)) if os.path.exists(OUT) else {}
    rows = list(csv.DictReader(open(os.path.join(HERE, 'lists', 'szafran-isfdb.tsv')), delimiter='\t'))
    for r in rows:
        k = r['isfdb_pub']
        if k in done: continue
        isbn = re.sub(r'[^0-9X]', '', r['isbn_or_catalog'].split('/')[0]) if re.search(r'\d-\d', r['isbn_or_catalog']) else ''
        q = urllib.parse.urlencode({'title': r['title'], 'author': r['author'], 'fields': 'key,title,author_name', 'limit': 3})
        s = get(f'https://openlibrary.org/search.json?{q}')
        work = s['docs'][0]['key'].split('/')[-1] if s and s.get('docs') else None
        cands = []
        if work:
            e = get(f'https://openlibrary.org/works/{work}/editions.json?limit=300') or {}
            year = int(r['first_date'][:4]) if r['first_date'] else 1975
            pub = short(r['publisher'])
            for ed in e.get('entries', []):
                covers = [c for c in ed.get('covers', []) if c and c > 0]
                if not covers: continue
                pubs = ' '.join(ed.get('publishers', [])).lower()
                y = re.search(r'(1[89]\d\d|20\d\d)', ed.get('publish_date', ''))
                y = int(y.group(1)) if y else None
                isbns = [re.sub(r'[^0-9X]', '', i) for i in ed.get('isbn_10', []) + ed.get('isbn_13', [])]
                same_isbn = bool(isbn) and any(isbn in i or i in isbn for i in isbns)
                near = y is not None and abs(y - year) <= 8
                if same_isbn or (pub in pubs and (near or y is None)) or (pub == 'signet' and 'new american' in pubs and (near or y is None)):
                    cands.append({'edition': ed['key'].split('/')[-1], 'covers': covers, 'publishers': ed.get('publishers', []), 'date': ed.get('publish_date', ''), 'isbn': isbns[:1], 'sameIsbn': same_isbn})
        done[k] = {**r, 'work': work, 'candidates': cands}
        print(f"{r['title'][:40]:40} {work} {len(cands)} candidates", flush=True)
        json.dump(done, open(OUT, 'w'), indent=1)

if __name__ == '__main__':
    main()
