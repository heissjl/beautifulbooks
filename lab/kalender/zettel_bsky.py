"""Reply list, Bluesky half (ROADMAP 5.6c §5.2): search the public API for threads of the
last 72 h where an answer with a picture from the site would fit, and print them ranked.
No login, no posting; `python3 -I lab/kalender/zettel_bsky.py out.json [hours]` (default 72).
Since 2026-11-03 every row carries the poster's followers and bio (one getProfiles call per 25
handles) and the full-size image addresses, so a reader needs no browser to judge a thread;
at most three rows per handle, `more_from_handle` counts the rest."""
import json, sys, time, urllib.parse, urllib.request, datetime
QUERIES = [
  '"nine books"', '"9 books"', 'myninebooks', '"books that made me"', '"which edition"', '"best translation"',
  '"book haul"', '"penguin clothbound"', '"folio society"', '"nyrb classics"', '"sf masterworks"', '"penguin classics" cover',
  '"vintage classics"', '"first edition" cover', '"special edition" book cover', 'shelfie books', '"my bookshelf"',
  'Buchcover', 'Lieblingsausgabe', '"schönste Ausgabe"', '"book covers"', '"cover art" edition',
]
H = {'User-Agent': 'buyitscovers-zettel/0.1 (mail@buyitscovers.com)'}
now = datetime.datetime.now(datetime.timezone.utc)
HOURS = float(sys.argv[2]) if len(sys.argv) > 2 else 72
seen = {}
for q in QUERIES:
    url = 'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=%s&sort=latest&limit=25' % urllib.parse.quote(q)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=20) as r:
            d = json.load(r)
    except Exception as e:
        print('ERR', q, e, file=sys.stderr); continue
    for p in d.get('posts', []):
        ts = datetime.datetime.fromisoformat(p['indexedAt'].replace('Z', '+00:00'))
        age_h = (now - ts).total_seconds() / 3600
        if age_h > HOURS: continue
        rec = seen.setdefault(p['uri'], {'post': p, 'queries': set(), 'age_h': age_h})
        rec['queries'].add(q)
    time.sleep(0.4)
rows = []
for uri, rec in seen.items():
    p = rec['post']; a = p['author']; r = p['record']
    emb = p.get('embed') or {}
    imgs = emb.get('images') or (emb.get('media') or {}).get('images') or []
    alts = ' / '.join((i.get('alt') or '') for i in imgs if i.get('alt'))
    rows.append({
      'link': 'https://bsky.app/profile/%s/post/%s' % (a['handle'], uri.rsplit('/', 1)[-1]),
      'handle': a['handle'], 'name': a.get('displayName', ''), 'age_h': round(rec['age_h'], 1),
      'likes': p.get('likeCount', 0), 'replies': p.get('replyCount', 0), 'reposts': p.get('repostCount', 0),
      'text': (r.get('text') or '').replace('\n', ' '), 'alt': alts[:300],
      'ext': ((emb.get('external') or {}).get('uri') or ''), 'queries': sorted(rec['queries']), 'reply': bool(r.get('reply')),
      'images': [i.get('fullsize') for i in imgs if i.get('fullsize')], 'did': a.get('did', ''),
    })
# followers and bio, 25 handles per call (public.api.bsky.app answers getProfiles without a token)
handles = sorted({x['handle'] for x in rows})
profiles = {}
for i in range(0, len(handles), 25):
    qs = '&'.join('actors=' + urllib.parse.quote(h) for h in handles[i:i + 25])
    try:
        with urllib.request.urlopen(urllib.request.Request('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?' + qs, headers=H), timeout=20) as r:
            for pr in json.load(r).get('profiles', []): profiles[pr['handle']] = pr
    except Exception as e:
        print('ERR profiles', i, e, file=sys.stderr)
    time.sleep(0.4)
for x in rows:
    pr = profiles.get(x['handle'], {})
    x['followers'] = pr.get('followersCount'); x['bio'] = (pr.get('description') or '').replace('\n', ' ')[:300]
rows.sort(key=lambda x: (-(x['likes'] + 2 * x['replies'] + 2 * x['reposts']), x['age_h']))
# at most three rows per handle (a label bot filled 20 of 189 rows on 2026-11-03); the rest is counted in `more_from_handle`
kept, per = [], {}
for x in rows:
    n = per.get(x['handle'], 0); per[x['handle']] = n + 1
    if n < 3: kept.append(x)
for x in kept: x['more_from_handle'] = per[x['handle']] - 3 if per[x['handle']] > 3 else 0
rows = kept
if len(sys.argv) > 1:
    json.dump(rows, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print(len(rows), 'posts in the last %g h' % HOURS)
for x in rows[:60]:
    print('-', f"{x['age_h']}h L{x['likes']} R{x['replies']} RP{x['reposts']} F{x['followers']}", '@' + x['handle'], '(reply)' if x['reply'] else '', f"img{len(x['images'])}", '|', x['text'][:170], '|', ('ALT: ' + x['alt'][:120]) if x['alt'] else '', '|', x['ext'][:50])
    print('   ', x['link'])
