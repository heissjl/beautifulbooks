"""
Second round for the Szafran collection (5.10s): every ISFDB printing in
in/szafran/details.txt (read from pl.cgi, all fields) is looked up at Open
Library — by ISBN first, which finds editions filed under duplicate works the
first round missed, then by title + author over the top three works, filtered
by publisher and year. Writes in/szafran/round2.json; uploads and new editions
happen by hand from it.
"""
import json, os, re, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'in', 'szafran')
UA = {'User-Agent': 'Buy Its Covers lab (szafran_round2.py)'}

def get(url):
    for wait in (1.5, 20, 60):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as err:
            if err.code == 404: return None
            print('  retry', err)
        except Exception as err:
            print('  retry', err)
    return None

def main():
    out = json.load(open(os.path.join(D, 'round2.json'))) if os.path.exists(os.path.join(D, 'round2.json')) else {}
    for line in open(os.path.join(D, 'details.txt')):
        f = [x.strip() for x in line.split('¦')]
        if len(f) < 11: continue
        pub, title, author, date, isbn, cat, publisher, _, pages, fmt, img = f[:11]
        if pub in out: continue
        isbn10 = re.sub(r'[^0-9X]', '', isbn)
        year = date[:4] if date[:4].isdigit() else ''
        row = {'title': title, 'author': author, 'date': date, 'isbn10': isbn10, 'catalog': cat, 'publisher': publisher, 'pages': pages, 'format': fmt, 'img': img, 'existing': [], 'works': []}
        if isbn10:
            e = get(f'https://openlibrary.org/isbn/{isbn10}.json')
            if e:
                row['existing'].append({'edition': e['key'].split('/')[-1], 'work': (e.get('works') or [{}])[0].get('key', '').split('/')[-1], 'date': e.get('publish_date'), 'covers': [c for c in e.get('covers', []) if c and c > 0], 'why': 'isbn'})
        q = urllib.parse.urlencode({'title': title, 'author': author.split(',')[0], 'fields': 'key,title', 'limit': 3})
        s = get(f'https://openlibrary.org/search.json?{q}') or {}
        row['works'] = [d['key'].split('/')[-1] for d in s.get('docs', [])]
        pw = re.split(r'[ /(]', publisher.replace('Books', '').strip())[0].lower()
        if not row['existing'] and year:
            for w in row['works']:
                e = get(f'https://openlibrary.org/works/{w}/editions.json?limit=300') or {}
                for ed in e.get('entries', []):
                    y = re.search(r'(19\d\d|20\d\d)', ed.get('publish_date', ''))
                    pubs = ' '.join(ed.get('publishers', [])).lower()
                    if y and y.group(1) == year and (pw in pubs or (pw == 'signet' and 'new american' in pubs)):
                        row['existing'].append({'edition': ed['key'].split('/')[-1], 'work': w, 'date': ed.get('publish_date'), 'covers': [c for c in ed.get('covers', []) if c and c > 0], 'why': 'publisher+year'})
        out[pub] = row
        print(pub, title[:32], '| works', row['works'][:3], '| existing', [(x['edition'], x['why'], x['date'], len(x['covers'])) for x in row['existing']], flush=True)
        json.dump(out, open(os.path.join(D, 'round2.json'), 'w'), indent=1)

if __name__ == '__main__':
    main()
