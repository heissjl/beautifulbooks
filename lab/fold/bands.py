# -*- coding: utf-8 -*-
"""Intra-work dHash distance bands over the committed cover index. No network."""
import json, os, collections

OUT = os.environ.get('FOLD_OUT', '/tmp/fold')
os.makedirs(OUT, exist_ok=True)

d = json.load(open('data/cover-index.json'))
works = d['works']
covers = d['covers']

by_work = collections.defaultdict(list)
for row in covers:
    w, cid, h, contrast, mean, sat, hues = row
    by_work[w].append((cid, int(h, 16), contrast, mean, sat, hues))

BANDS = [(0, 8), (9, 12), (13, 16), (17, 20), (21, 24), (25, 32)]
totals = collections.Counter()
pairs_in_band = collections.defaultdict(list)

for w, items in by_work.items():
    n = len(items)
    for i in range(n):
        for j in range(i + 1, n):
            dist = bin(items[i][1] ^ items[j][1]).count('1')
            for lo, hi in BANDS:
                if lo <= dist <= hi:
                    totals[(lo, hi)] += 1
                    if len(pairs_in_band[(lo, hi)]) < 4000:
                        pairs_in_band[(lo, hi)].append((w, items[i], items[j], dist))
                    break

total_pairs = sum(len(v) * (len(v) - 1) // 2 for v in by_work.values())
print(f"works {len(by_work)}, covers {len(covers)}, intra-work pairs {total_pairs:,}")
for b in BANDS:
    print(f"  distance {b[0]:>2}-{b[1]:<2}  {totals[b]:>8,}  ({100*totals[b]/total_pairs:.3f}% of pairs)")

json.dump({f"{lo}-{hi}": [[w, a[0], b_[0], dist, a[3], b_[3], a[4], b_[4]]
                          for (w, a, b_, dist) in pairs_in_band[(lo, hi)]]
           for lo, hi in BANDS},
          open(f'{OUT}/pairs.json', 'w'))
