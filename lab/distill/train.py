# -*- coding: utf-8 -*-
"""The student: a small CNN that learns to put a cover where CLIP puts it.

    ~/.venvs/bb-distill/bin/python lab/distill/train.py [--width 1.0] [--epochs 40]

Teacher vectors and images come from lab/clip/out/ (teacher.ts, outside.ts).
Everything a measurement reads is held out of training: the images of every
labelled pair and every labelled "not a cover" image, the hand-excluded ones,
and all 43 works of outside-works.json. What is left of the index is the
training set; CLIP's vectors are its labels, so no human labels are spent.

Augmentation is the point, not a detail: the student sees each cover with a
shifted tone, contrast, crop and blur, and must still land on the clean
image's vector. That is the invariance the dHash lacks (lab/fold).

Writes lab/distill/out/ (git-ignored): student.pt, student.onnx, metrics.json.
"""
import argparse, base64, json, math, os, random, time
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F
from PIL import Image
from torchvision.transforms import v2 as T

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CLIP_OUT = os.path.join(ROOT, 'lab', 'clip', 'out')
OUT = os.path.join(HERE, 'out')
H, W = 96, 64          # the student's input; covers are squashed to 2:3, as at run time
CACHE_H, CACHE_W = 108, 72   # stored a little larger, so a random crop has room

ap = argparse.ArgumentParser()
ap.add_argument('--width', type=float, default=1.0)
ap.add_argument('--epochs', type=int, default=40)
ap.add_argument('--batch', type=int, default=256)
ap.add_argument('--lr', type=float, default=3e-3)
ap.add_argument('--relational', type=float, default=1.0, help='weight of the pairwise-similarity loss')
ap.add_argument('--seed', type=int, default=7)
ap.add_argument('--eval-only', action='store_true')
args = ap.parse_args()
torch.manual_seed(args.seed); random.seed(args.seed); np.random.seed(args.seed)
torch.set_num_threads(os.cpu_count() or 8)
os.makedirs(OUT, exist_ok=True)


def load_json(*parts):
    with open(os.path.join(*parts), encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------- data

# DISTILL_VECTORS points at a copy, for a smoke run while teacher.ts is still writing the real file
vectors_raw = load_json(os.environ.get('DISTILL_VECTORS') or os.path.join(CLIP_OUT, 'vectors-Xenova_clip_vit_base_patch32.json'))
teacher = {}
for cid, b64 in vectors_raw.items():
    if b64:
        v = np.frombuffer(base64.b64decode(b64), dtype=np.float32)
        teacher[cid] = v / np.linalg.norm(v)

index = load_json(ROOT, 'data', 'cover-index.json')
work_of = {row[1]: row[0] for row in index['covers']}

pairs = []
for f in (os.path.join(ROOT, 'lab', 'fold', 'pairs-labelled.json'), os.path.join(ROOT, 'lab', 'clip', 'pairs-labelled.json')):
    pairs += [p for p in load_json(f)['pairs'] if p['label'] != 'skip']
notcover_labels = load_json(ROOT, 'lab', 'clip', 'notcover-labelled.json')['covers']
excluded = [e['id'] for e in load_json(ROOT, 'data', 'versus-pool.json')['excluded']]
outside = load_json(HERE, 'outside-works.json')['works']
outside_ids = [c for w in outside for c in w['covers']]

held_out = set(outside_ids) | set(excluded) | {c['id'] for c in notcover_labels}
for p in pairs:
    held_out |= {p['a'], p['b']}
train_ids = [c for c in work_of if c in teacher and c not in held_out]


def image_path(cid):
    return os.path.join(CLIP_OUT, 'img', cid.split(':', 1)[1] + '.jpg')


def load_images(ids, name):
    """All images at CACHE_H × CACHE_W, uint8, decoded once and kept in out/."""
    cache = os.path.join(OUT, f'{name}-{CACHE_W}x{CACHE_H}.npz')
    if os.path.exists(cache):
        z = np.load(cache, allow_pickle=False)
        if list(z['ids']) == list(ids):
            return z['pixels']
    pixels = np.zeros((len(ids), CACHE_H, CACHE_W, 3), dtype=np.uint8)
    for i, cid in enumerate(ids):
        try:
            pixels[i] = np.asarray(Image.open(image_path(cid)).convert('RGB').resize((CACHE_W, CACHE_H), Image.BILINEAR))
        except Exception:
            pass  # stays black; it has a teacher vector, so the image existed once
    np.savez(cache, ids=np.array(ids), pixels=pixels)
    return pixels


augment = T.Compose([
    T.RandomResizedCrop((H, W), scale=(0.8, 1.0), ratio=(0.6, 0.75), antialias=True),
    T.RandomApply([T.ColorJitter(brightness=0.35, contrast=0.35, saturation=0.4, hue=0.04)], p=0.9),
    T.RandomGrayscale(p=0.05),
    T.RandomApply([T.GaussianBlur(3, sigma=(0.3, 1.2))], p=0.25),
    T.RandomRotation(3),
])
plain = T.Resize((H, W), antialias=True)
MEAN = torch.tensor([0.5, 0.5, 0.5]).view(1, 3, 1, 1)


def to_tensor(pixels):
    return torch.from_numpy(pixels).permute(0, 3, 1, 2).float() / 255.0


def gamma(x):
    g = torch.empty(x.shape[0], 1, 1, 1).uniform_(0.7, 1.4)
    return x.clamp(1e-4, 1) ** g


# ---------------------------------------------------------------- model

def block(cin, cout, stride):
    return nn.Sequential(nn.Conv2d(cin, cout, 3, stride, 1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True))


class Student(nn.Module):
    """Five strided 3×3 convolutions and one more, then a linear map into CLIP's 512 dimensions.

    Plain convolutions, not depthwise-separable ones: the first draft used
    MobileNet's depthwise blocks for their small size, and PyTorch's CPU
    backward pass for them took 4.7 s per batch of 256 against 0.35 s for
    these (2026-09-23) — 417 s an epoch. At run time either would be cheap.
    """

    def __init__(self, width=1.0, dim=512):
        super().__init__()
        c = lambda n: max(8, int(round(n * width / 8)) * 8)
        widths = [c(n) for n in (16, 32, 64, 96, 160)]
        layers, cin = [], 3
        for w in widths:
            layers.append(block(cin, w, 2))
            cin = w
        layers.append(block(cin, cin, 1))
        self.features = nn.Sequential(*layers)
        self.head = nn.Linear(cin, dim)

    def forward(self, x):
        x = self.features(x - MEAN)
        return F.normalize(self.head(x.mean((2, 3))), dim=1)


def embed(model, pixels, batch=512):
    model.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(pixels), batch):
            out.append(model(plain(to_tensor(pixels[i:i + batch]))))
    return torch.cat(out).numpy()


# ---------------------------------------------------------------- measures

def auc(pos, neg):
    pos, neg = np.asarray(pos), np.asarray(neg)
    if len(pos) == 0 or len(neg) == 0:
        return float('nan')
    wins = (pos[:, None] > neg[None, :]).sum() + 0.5 * (pos[:, None] == neg[None, :]).sum()
    return float(wins / (len(pos) * len(neg)))


def spearman(a, b):
    ra, rb = np.argsort(np.argsort(a)), np.argsort(np.argsort(b))
    return float(np.corrcoef(ra, rb)[0, 1])


def evaluate(model):
    """Every number the README reports, for this student and, beside it, for CLIP."""
    eval_ids = sorted(held_out & set(teacher))
    student = dict(zip(eval_ids, embed(model, load_images(eval_ids, 'eval'))))
    m = {}

    # how close the student lands to the teacher, image by image, on images it never saw
    inside = [c for c in eval_ids if c in work_of]
    m['teacherCosine'] = {
        'insideHeldOut': float(np.mean([student[c] @ teacher[c] for c in inside])),
        'outside': float(np.mean([student[c] @ teacher[c] for c in outside_ids if c in student])),
    }

    # question B on the human-labelled pairs (lab/clip)
    scored = [p for p in pairs if p['a'] in student and p['b'] in student]
    same = [p for p in scored if p['label'] == 'same']
    diff = [p for p in scored if p['label'] == 'diff']
    own = [p for p in same if 'translation' not in (p.get('note') or '')]
    cos = lambda src, p: float(src[p['a']] @ src[p['b']])
    m['pairs'] = {
        'same': len(same), 'diff': len(diff),
        'aucStudent': auc([cos(student, p) for p in same], [cos(student, p) for p in diff]),
        'aucTeacher': auc([cos(teacher, p) for p in same], [cos(teacher, p) for p in diff]),
        'aucDhash': auc([-p['indexDistance'] for p in same], [-p['indexDistance'] for p in diff]),
    }
    # what a threshold folds, for the student: at the threshold that folds no different pair, and one
    for allowed in (0, 1, 3):
        d = sorted((cos(student, p) for p in diff), reverse=True)
        t = d[allowed] + 1e-6 if len(d) > allowed else -1
        m['pairs'][f'studentAt{allowed}WrongFolds'] = {
            'threshold': round(t, 3), 'sameOwnLanguage': sum(cos(student, p) >= t for p in own), 'of': len(own)}

    # the outside works: does the student order a book's pairs as CLIP does?
    s_all, t_all, t_high, s_for_high = [], [], [], []
    for w in outside:
        ids = [c for c in w['covers'] if c in student]
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                s, t = float(student[ids[i]] @ student[ids[j]]), float(teacher[ids[i]] @ teacher[ids[j]])
                s_all.append(s); t_all.append(t)
    s_all, t_all = np.array(s_all), np.array(t_all)
    if len(s_all) == 0:
        m['outsidePairs'] = None  # outside.ts --embed has not run yet
        return m | notcover_measures(student)
    m['outsidePairs'] = {
        'pairs': int(len(s_all)),
        'spearman': spearman(s_all, t_all),
        # CLIP's own "same jacket" (≥ 0.90) as the target: can the student find those pairs?
        'teacherSame': int((t_all >= 0.9).sum()),
        'aucFindTeacherSame': auc(s_all[t_all >= 0.9], s_all[t_all < 0.9]),
    }

    return m | notcover_measures(student)


def notcover_measures(student):
    """Question A: zero-shot with CLIP's prompts on the student's vectors."""
    m = {}
    prompts = load_json(OUT, 'prompts.json')
    cover_t = np.array(prompts['cover']); other_t = np.array(prompts['other'])
    cover_t /= np.linalg.norm(cover_t, axis=1, keepdims=True); other_t /= np.linalg.norm(other_t, axis=1, keepdims=True)

    def notcover(v):
        logits = 100 * np.concatenate([cover_t @ v, other_t @ v])
        e = np.exp(logits - logits.max())
        return float(e[len(cover_t):].sum() / e.sum())

    bad = [c for c in set(excluded) | {c['id'] for c in notcover_labels if c['label'] == 'notcover'} if c in student]
    good = [c['id'] for c in notcover_labels if c['label'] == 'cover' and c['id'] in student]
    m['notCover'] = {
        'notCovers': len(bad), 'covers': len(good),
        'aucStudent': auc([notcover(student[c]) for c in bad], [notcover(student[c]) for c in good]),
        'aucTeacher': auc([notcover(teacher[c]) for c in bad], [notcover(teacher[c]) for c in good]),
    }
    return m


# ---------------------------------------------------------------- training

model = Student(args.width)
params = sum(p.numel() for p in model.parameters())
ckpt = os.path.join(OUT, f'student-w{args.width}.pt')

if not args.eval_only:
    pixels = load_images(train_ids, 'train')
    targets = torch.from_numpy(np.stack([teacher[c] for c in train_ids]))
    print(f'{len(train_ids)} training covers, {len(held_out & set(teacher))} held out; student {params:,} parameters')
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    steps = args.epochs * math.ceil(len(train_ids) / args.batch)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=steps, pct_start=0.1)
    for epoch in range(args.epochs):
        model.train()
        order = torch.randperm(len(train_ids))
        started, total = time.time(), 0.0
        for i in range(0, len(order), args.batch):
            idx = order[i:i + args.batch]
            x = gamma(torch.stack([augment(img) for img in to_tensor(pixels[idx.numpy()])]))
            t = targets[idx]
            s = model(x)
            loss = (1 - (s * t).sum(1)).mean()
            if args.relational:
                loss = loss + args.relational * F.mse_loss(s @ s.T, t @ t.T)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step()
            total += loss.item() * len(idx)
        print(f'epoch {epoch + 1:2d}/{args.epochs}: loss {total / len(order):.4f}, {time.time() - started:.0f} s', flush=True)
    torch.save(model.state_dict(), ckpt)
else:
    model.load_state_dict(torch.load(ckpt))

metrics = evaluate(model)
metrics['student'] = {'width': args.width, 'parameters': params, 'input': [H, W], 'epochs': args.epochs, 'relational': args.relational}

# export and time it: the student has to be cheap where the dHash runs today (lib/coverhash.ts)
model.eval()
onnx_path = os.path.join(OUT, f'student-w{args.width}.onnx')
torch.onnx.export(model, torch.zeros(1, 3, H, W), onnx_path, input_names=['image'], output_names=['vector'],
                  dynamic_axes={'image': {0: 'n'}, 'vector': {0: 'n'}}, opset_version=17, dynamo=False)
import onnxruntime as ort
sess = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
one = np.random.rand(1, 3, H, W).astype(np.float32)
for _ in range(20):
    sess.run(None, {'image': one})
t0 = time.time()
for _ in range(200):
    sess.run(None, {'image': one})
metrics['student']['onnxBytes'] = os.path.getsize(onnx_path)
metrics['student']['msPerImage'] = round((time.time() - t0) / 200 * 1000, 2)

with open(os.path.join(OUT, f'metrics-w{args.width}.json'), 'w') as f:
    json.dump(metrics, f, indent=1)
print(json.dumps(metrics, indent=1))
