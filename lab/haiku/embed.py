"""ROADMAP 6.101, step 2: embed the haikus locally (fastembed, BAAI/bge-small-en-v1.5, no API, no cost).
Reads lab/haiku/out/sample.json, writes lab/haiku/out/vectors.json (one vector per cover, null where no text).

  ../bb-lab-cache/haiku/venv/bin/python lab/haiku/embed.py
"""
import json
import re
from fastembed import TextEmbedding

MODEL = "BAAI/bge-small-en-v1.5"
data = json.load(open("lab/haiku/out/sample.json"))
def clean(text):
    # Some answers carry headings ("# Haiku 1: Image and Motif"); measured 2026-10-08, they made covers cluster by
    # answer format rather than by look. Keep only the haiku lines.
    lines = [l for l in (text or "").splitlines() if l.strip() and not re.match(r"^\s*(#|\*\*|haiku\b|\d+[.)])", l, re.I)]
    return "\n".join(lines)

texts = [clean(c["text"]) for c in data["covers"]]
model = TextEmbedding(MODEL, cache_dir="../bb-lab-cache/haiku/models")
raw = [list(map(float, v)) for v in model.embed(texts)]
# Centre: every haiku shares "letters, light, dark"; subtracting the mean removes that common part, which otherwise
# makes a few plain covers everyone's nearest neighbour (hubness, measured below in the README).
mean = [sum(col) / len(raw) for col in zip(*raw)]
vectors = [[round(x - m, 5) for x, m in zip(v, mean)] for v in raw]
json.dump({"model": MODEL, "vectors": [v if t else None for v, t in zip(vectors, texts)]}, open("lab/haiku/out/vectors.json", "w"))
print(len(vectors), "vectors of", len(vectors[0]))
