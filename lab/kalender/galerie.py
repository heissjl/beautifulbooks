"""
The post gallery (5.6b): every rendered image of lab/kalender/out, grouped by
post with its status, as one HTML page for an artifact.

    python3 lab/kalender/galerie.py "$PWD" lab/kalender/out   # writes lab/kalender/out/galerie.html

The list of posts below is kept by hand with the calendar.
"""
import base64, io, os, sys, html
from PIL import Image
root, sp = sys.argv[1], sys.argv[2]
OUT = f'{root}/lab/kalender/out'
def img(name, w=520):
    im = Image.open(f'{OUT}/{name}').convert('RGB'); im.thumbnail((w, w * 2))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=80)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
e = html.escape
# (group, title, status, status-kind, note, [files], calendar)
G = [
 ('kampagne', 'Zug-Witz, Version 2: The Gruffalo oder Le visage dans l’abîme', 'neu, Entwurf', 'draft',
  'Aus einer Runde des Spiels. Rechts ein Boris-Vallejo-Akt: Instagram und Pinterest entfernen nackte Brüste oft oder schränken den Post ein. Für Bluesky und X eher unkritisch, dort mit Inhaltswarnung.',
  ['zug2-1080x1350.jpg', 'pinterest-zug2.jpg'], 'noch nicht im Kalender'),
 ('kampagne', 'Zug-Witz, Version 1: Infinite Jest oder Fifty Shades of Grey', 'im Kalender, wartet auf Rechte', 'wait',
  'Für alle Plattformen am 23.10. Links das Buch, mit dem man gesehen werden will, rechts das, das man versteckt.',
  ['zug-1080x1350.jpg', 'pinterest-zug.jpg'], 'pr-versus, pr-zug-x, pr-zug-instagram, pr-zug-pinterest'),
 ('kampagne', 'The performative reader’s starter pack', 'auf Bluesky gepostet', 'ok',
  'Julians Sharepic, auf Bluesky gepostet am 6.10. mit dem Link auf sein Shelf-Portrait.',
  ['starterpack-sharepic.jpg'], 'pr-ig-starter, pr-starter-bluesky, pr-starter-x, pr-starter-pinterest'),
 ('kampagne', 'Starter-Pack, Claudes erster Vorschlag', 'ersetzt', 'old',
  'Durch Julians Brett ersetzt.', ['starterpack-vorschlag.jpg'], '—'),
 ('kampagne', 'Rowohlts Monographien an der Wand', 'im Kalender', 'ok',
  'Aus Julians Foto: 110 Bände, zehn mal elf. Pinterest am 22.10., verlinkt auf die Sammlung.',
  ['pinterest-rowohlt-wand.jpg'], 'pr-pin-rowohlt'),
 ('exposes', 'Pinterest-Exposé: das Cover-Spiel mit zwei gemeinfreien Covern', 'im Kalender', 'ok',
  'Peter and Wendy (1911) oder La guerre des mondes (1906). Braucht keine Rechte-Entscheidung.',
  ['pinterest-versus.jpg'], 'pin-expose, 17.10.'),
 ('exposes', 'Pinterest-Exposé, Entwurf mit Covern aus dem Spiel', 'Entwurf, wartet auf Rechte', 'draft',
  'The Great Gatsby oder Dune (SF Masterworks).', ['pinterest-versus-entwurf.jpg'], '—'),
 ('exposes', 'Instagram-Exposé: fünf gemeinfreie Einbände', 'im Kalender', 'ok',
  'Sieben Folien, 1080 × 1350. Gestalter vor 1956 gestorben, alle vor 1931 erschienen.',
  [f'instagram-{i}.jpg' for i in range(1, 8)], 'ig-expose, 13.10.'),
 ('exposes', 'Pinterest: Peter and Wendy, 1911', 'im Kalender', 'ok',
  'Bedfords Einband, verlinkt auf Peter Pan durch die Jahrzehnte.', ['pinterest-1.jpg'], 'pin-peter-and-wendy, 21.10.'),
 ('mosaike', 'The women behind the covers', 'im Kalender', 'ok',
  'Vier Folien, ohne Überblendung: Austen, Alcott, Wharton aus den Covern ihrer Bücher.',
  [f'instagram-frauen-{i}.jpg' for i in range(1, 5)], 'ig-mosaik-frauen, 16.10.'),
 ('mosaike', 'Pinterest: Mark Twain aus seinen Covern', 'im Kalender', 'ok',
  'Verlinkt auf die Autorensuche.', ['pinterest-mosaik-1.jpg'], 'pin-mosaik-twain, 19.10.'),
 ('mosaike', 'Four writers, made of their own covers', 'ersetzt', 'old',
  'Twain, Austen, Poe, Dickens. Durch die Frauen-Story ersetzt.',
  [f'instagram-mosaik-{i}.jpg' for i in range(1, 7)], '—'),
]
GROUPS = [('kampagne', 'Kampagne „performative readers“'), ('exposes', 'Exposés'), ('mosaike', 'Mosaike')]
cards = []
for g, title, status, kind, note, files, cal in G:
    files = [f for f in files if os.path.exists(f'{OUT}/{f}')]
    if not files: continue
    many = len(files) > 2
    imgs = ''.join(f'<figure><img src="{img(f, 360 if many else 520)}" alt="{e(title)}, Bild {i+1}" loading="lazy"><figcaption>{e(f)}</figcaption></figure>' for i, f in enumerate(files))
    cards.append(f'''<article class="card" data-group="{g}" data-kind="{kind}">
<header><h3>{e(title)}</h3><span class="pill {kind}">{e(status)}</span></header>
<p>{e(note)}</p>
<div class="strip{' many' if many else ''}">{imgs}</div>
<p class="meta"><span>Kalender</span> {e(cal)}</p></article>''')
chips = ''.join(f'<button type="button" class="chip" data-f="{g}" id="f-{g}">{e(n)}</button>' for g, n in GROUPS)
page = f'''<title>Post-Galerie</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Xanh+Mono:ital@0;1&family=Jost:wght@400;500&display=swap">
<style>
/* Layout: one column of cards, newest work first; each card is one post with all its versions side by side. Tokens from the site. */
:root {{ --bg:#f4f0e8; --surface:#fbf9f4; --ink:#1a1714; --mut:#6e655b; --line:#ddd5c8; --accent:#945138; --ok:#3f6b45; --wait:#8a5a12;
  --display:"Xanh Mono", Georgia, serif; --sans:"Jost", ui-sans-serif, system-ui, sans-serif; --mono:ui-monospace, Menlo, monospace; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#131110; --surface:#1b1815; --ink:#efe8dd; --mut:#a39a8f; --line:#2e2925; --accent:#dbac94; --ok:#9cc7a1; --wait:#e0b56a; color-scheme:dark; }} }}
:root[data-theme="dark"] {{ --bg:#131110; --surface:#1b1815; --ink:#efe8dd; --mut:#a39a8f; --line:#2e2925; --accent:#dbac94; --ok:#9cc7a1; --wait:#e0b56a; color-scheme:dark; }}
* {{ box-sizing:border-box; }}
body {{ background:var(--bg); color:var(--ink); font:16px/1.5 var(--sans); }}
.wrap {{ max-width:1100px; margin:0 auto; padding-inline:20px; padding-block:36px 80px; }}
h1 {{ font:400 clamp(2rem,5vw,3rem)/1.1 var(--display); margin:0; }}
.lede {{ color:var(--mut); max-width:64ch; margin:10px 0 0; }}
.filters {{ display:flex; flex-wrap:wrap; gap:8px; margin:24px 0; position:sticky; top:env(safe-area-inset-top,0px); background:var(--bg); padding-block:10px; z-index:1; }}
.chip {{ font:inherit; font-size:14px; border:1px solid var(--line); background:var(--surface); color:var(--ink); border-radius:999px; padding:5px 14px; cursor:pointer; }}
.chip[aria-pressed="true"] {{ background:var(--ink); color:var(--bg); border-color:var(--ink); }}
.chip:focus-visible {{ outline:2px solid var(--accent); outline-offset:2px; }}
.card {{ border-top:1px solid var(--line); padding-block:28px; }}
.card header {{ display:flex; flex-wrap:wrap; gap:10px; align-items:baseline; justify-content:space-between; }}
h3 {{ font:400 1.5rem/1.2 var(--display); margin:0; text-wrap:balance; }}
.pill {{ font-size:13px; border:1px solid currentColor; border-radius:999px; padding:1px 10px; white-space:nowrap; }}
.pill.ok {{ color:var(--ok); }} .pill.wait, .pill.draft {{ color:var(--wait); }} .pill.old {{ color:var(--mut); }}
.card p {{ max-width:68ch; margin:8px 0 14px; }}
.strip {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr)); gap:14px; }}
.strip.many {{ grid-template-columns:repeat(auto-fill,minmax(min(100%,180px),1fr)); }}
figure {{ margin:0; min-width:0; }}
figure img {{ width:100%; height:auto; display:block; border:1px solid var(--line); border-radius:6px; background:var(--surface); }}
figcaption {{ font:12px var(--mono); color:var(--mut); margin-top:4px; word-break:break-all; }}
.meta {{ font-size:14px; color:var(--mut); }} .meta span {{ text-transform:uppercase; letter-spacing:.06em; font-size:12px; margin-right:6px; }}
.card[data-kind="old"] figure img {{ opacity:.7; }}
</style>
<div class="wrap">
<h1>Post-Galerie</h1>
<p class="lede">Alle Bilder aus der Arbeit an Kalender und Kampagne, je Post mit allen Fassungen. Die Dateien liegen in <code>lab/kalender/out/</code>; neu erzeugt mit <code>python3 lab/kalender/render_gemeinfrei.py</code>. Was im Kalender steht, gilt; ersetzte Fassungen stehen der Vollständigkeit halber unten im Abschnitt.</p>
<div class="filters" role="group" aria-label="Abschnitte"><button type="button" class="chip" data-f="all" id="f-all" aria-pressed="true">Alle</button>{chips}</div>
{''.join(cards)}
</div>
<script>
const chips=[...document.querySelectorAll('.chip')];
function show(f){{chips.forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.f===f)));document.querySelectorAll('.card').forEach(c=>c.hidden=f!=='all'&&c.dataset.group!==f);try{{localStorage.setItem('gal.f',f)}}catch{{}}}}
chips.forEach(c=>c.addEventListener('click',()=>show(c.dataset.f)));
let f='all';try{{f=localStorage.getItem('gal.f')||'all'}}catch{{}}show(f);
</script>
'''
open(f'{sp}/galerie.html', 'w').write(page)
print(len(page))
