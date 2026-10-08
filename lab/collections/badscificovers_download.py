"""
Downloads the cover pictures of r/badscificovers' top posts (PLAN-5.6b §6a).

Julian runs this himself: Reddit's image host is off limits to Claude. It reads
the listing he saved (lab/collections/in/badscificovers-top100.json) and writes
one picture per post to lab/collections/in/badscificovers/<rank>.<ext>, one
request at a time with a pause. Both paths are git-ignored. A later step matches
each picture against the covers Open Library holds for the book.

    python3 lab/collections/badscificovers_download.py
"""
import json
import os
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
LISTING = os.path.join(HERE, 'in', 'badscificovers-top100.json')
OUT = os.path.join(HERE, 'in', 'badscificovers')


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    posts = [c['data'] for c in json.load(open(LISTING))['data']['children']]
    got = failed = 0
    for rank, post in enumerate(posts):
        url = post.get('url', '')
        if 'imgur.com/' in url and not url.startswith('https://i.'):
            url = url.replace('://imgur.com/', '://i.imgur.com/')
        ext = os.path.splitext(url.split('?')[0])[1].lower()
        if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
            print(f'{rank:3d}  skipped, not a picture: {post["title"][:60]}')
            continue
        path = os.path.join(OUT, f'{rank:03d}{ext}')
        if os.path.exists(path):
            got += 1
            continue
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (personal script, one-off)'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                open(path, 'wb').write(r.read())
            got += 1
            print(f'{rank:3d}  ok      {post["title"][:60]}')
        except Exception as err:
            failed += 1
            print(f'{rank:3d}  failed  {err}  {post["title"][:50]}')
        time.sleep(1)
    print(f'\n{got} pictures in {OUT}, {failed} failed')


if __name__ == '__main__':
    main()
