"""
Downloads the cover pictures of r/badscificovers' top posts (PLAN-5.6b §6a).

Julian runs this himself: Reddit's image host is off limits to Claude. It reads
the listing he saved (lab/collections/in/badscificovers-top100.json) and writes
one picture per post to lab/collections/in/badscificovers/<rank>.<ext>, one
request at a time with a pause. Both paths are git-ignored. A later step matches
each picture against the covers Open Library holds for the book.

    python3 lab/collections/badscificovers_download.py

Since 2026-10-08 it reads every listing page Julian saved, in order —
badscificovers-top100.json, -top200.json, -top300.json … — and numbers the
posts across them (the first post of -top200.json is 100). It also writes a
300 px copy of each picture to badscificovers-small/, which the match step
reads (the hash decoder refuses pictures of several megapixels).
"""
import json
import os
import time
import glob
import subprocess
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
LISTINGS = sorted(glob.glob(os.path.join(HERE, 'in', 'badscificovers-top[0-9]*.json')), key=lambda p: int(p.rsplit('top', 1)[1].split('.')[0]))
OUT = os.path.join(HERE, 'in', 'badscificovers')
SMALL = os.path.join(HERE, 'in', 'badscificovers-small')


def small(path: str, rank: int) -> None:
    """A 300 px JPEG beside the original, with macOS' own sips — no package to install."""
    target = os.path.join(SMALL, f'{rank:03d}.jpg')
    if os.path.exists(target):
        return
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-Z', '300', path, '--out', target], capture_output=True)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SMALL, exist_ok=True)
    posts = [c['data'] for listing in LISTINGS for c in json.load(open(listing))['data']['children']]
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
            small(path, rank)
            continue
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (personal script, one-off)'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                open(path, 'wb').write(r.read())
            got += 1
            small(path, rank)
            print(f'{rank:3d}  ok      {post["title"][:60]}')
        except Exception as err:
            failed += 1
            print(f'{rank:3d}  failed  {err}  {post["title"][:50]}')
        time.sleep(1)
    print(f'\n{got} pictures in {OUT}, {failed} failed')


if __name__ == '__main__':
    main()
