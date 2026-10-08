"""
The prepared forum posts on one page (5.6b, PLAN-5.6b §6a).

Reads the posts from posts.json, so the page and the calendar never say
different things, and embeds the local screenshots as small JPEGs.

    python3 lab/kalender/beitraege.py <out.html>
"""
import base64
import html
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'out', 'reddit')

# Order on the page, where each one goes, and which screenshots belong to it.
POSTS = [
    ('x-9books-replies', 'X: Antworten in der 9-Bücher-Welle', 'Antworten, du postest selbst', 'Heute posten, solange die Threads warm sind. Höchstens fünf bis zehn am Tag, keine Automatik.', []),
    ('bsky-9books-replies', 'Bluesky: Antworten in der 9-Bücher-Welle', 'Antworten und ein eigener Post', 'Kleinere Welle, Links schaden hier nicht.', []),
    ('reddit-claudeai', 'r/ClaudeAI', 'Kommentar im Megathread „Built with Claude“', 'Keine Karma-Grenze. Der beste erste Beitrag für ein neues Konto.', []),
    ('reddit-vibecoding', 'r/vibecoding', 'Text-Post, Projekt', 'Projektposts müssen Werkzeuge, Ablauf und Einsichten nennen.', []),
    ('reddit-bookcoverporn', 'r/bookcoverporn', 'Bild-Post, Text als erster Kommentar', 'Regeln nicht gefunden: Seitenleiste lesen, ob Bildschirmfotos und ein eigener Link erlaubt sind.', ['sf-masterworks', '1984-decades']),
    ('reddit-books', 'r/books', 'Text-Post ohne Link', 'Selbstwerbung verboten. Ein Gespräch über Ausgaben, die Seite nur nennen, wenn jemand fragt.', ['1984-decades', '1984']),
    ('reddit-iib', 'r/InternetIsBeautiful', 'Link-Post, Text als erster Kommentar', 'Keine Sammlungen, keine KI-Inhalte, 90/10-Regel. Als Werkzeug beschrieben.', []),
    ('hn-show', 'Hacker News', 'Show HN, Link und Text', 'Für neue Konten noch gesperrt: erst Karma sammeln.', []),
]

SHOT_NAMES = {
    'sf-masterworks': 'SF Masterworks, die Sammlung',
    '1984-decades': 'Nineteen Eighty-Four nach Jahrzehnten',
    '1984': 'Nineteen Eighty-Four, die Cover-Wand',
}


def img(name: str) -> str:
    path = os.path.join(SHOTS, f'{name}-small.jpg')
    if not os.path.exists(path):
        return ''
    data = base64.b64encode(open(path, 'rb').read()).decode()
    return (f'<figure><img src="data:image/jpeg;base64,{data}" alt="{html.escape(SHOT_NAMES[name])}" loading="lazy">'
            f'<figcaption>{html.escape(SHOT_NAMES[name])} · lab/kalender/out/reddit/{name}.png</figcaption></figure>')


def block(label: str, text: str, key: str) -> str:
    return (f'<div class="field"><div class="fieldhead"><span>{label}</span>'
            f'<button type="button" class="copy" data-target="{key}">Kopieren</button></div>'
            f'<pre id="{key}">{html.escape(text)}</pre></div>')


def main(out: str) -> None:
    posts = {p['id']: p for p in json.load(open(os.path.join(HERE, 'posts.json')))['posts']}
    sections = []
    nav = []
    for pid, place, form, rule, shots in POSTS:
        p = posts[pid]
        fields = []
        if p.get('title'):
            fields.append(block('Titel', p['title'], f'{pid}-title'))
        text = p['text']
        # Two calendar texts carry German instructions around the post; copy only the post.
        if 'Erster Kommentar:\n' in text:
            text = text.split('Erster Kommentar:\n', 1)[1]
        if text.startswith('Text-Post, ohne Link'):
            text = '\n\n'.join(b for b in text.split('\n\n')[1:] if not b.startswith('(Bilder'))
        if pid == 'hn-show':
            fields.append(block('URL', 'https://buyitscovers.com', f'{pid}-url'))
        fields.append(block('Text', text, f'{pid}-text'))
        figs = ''.join(img(s) for s in shots)
        status = ('wartet auf Reddit-Konto' if 'konto:reddit' in p.get('needs', []) else 'wartet auf HN-Karma' if p['channel'] == 'hn' else 'jetzt')
        sections.append(
            f'<section id="{pid}"><header><h2>{html.escape(place)}</h2>'
            f'<p class="meta"><span class="pill">{status}</span> {html.escape(form)}</p>'
            f'<p class="rule">{html.escape(rule)}</p></header>'
            f'{"".join(fields)}{"<div class=shots>" + figs + "</div>" if figs else ""}</section>')
        nav.append(f'<a href="#{pid}">{html.escape(place)}</a>')
    page = TEMPLATE.replace('{{NAV}}', ''.join(nav)).replace('{{SECTIONS}}', ''.join(sections))
    open(out, 'w').write(page)
    print('written', out, len(page) // 1024, 'KB')


TEMPLATE = '''<title>Forum-Beiträge</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Xanh+Mono:ital@0;1&family=Jost:wght@400;500&family=IBM+Plex+Mono:wght@400&display=swap">
<style>
/* One column of posts, each a card with copyable fields; screenshots below the text. */
:root {
  --bg: #f3f1ec; --surface: #fbfaf7; --ink: #1d1b19; --muted: #6b655d; --line: #ddd8cf; --accent: #9a4a2f; --pill: #e8e2d6;
  --display: "Xanh Mono", Georgia, serif; --body: "Jost", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #141210; --surface: #1c1a17; --ink: #ece7df; --muted: #a39b90; --line: #34302b; --accent: #e0916f; --pill: #2a2622; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #141210; --surface: #1c1a17; --ink: #ece7df; --muted: #a39b90; --line: #34302b; --accent: #e0916f; --pill: #2a2622; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font: 16px/1.55 var(--body); }
.wrap { max-width: 860px; margin: 0 auto; padding-inline: 16px; padding-block: 40px 80px; }
h1 { font: 400 clamp(2rem, 5vw, 2.8rem)/1.1 var(--display); margin: 0 0 .4em; text-wrap: balance; }
h1 em { color: var(--accent); }
.lede { color: var(--muted); max-width: 62ch; margin: 0 0 1.5em; }
nav { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 40px; }
nav a { color: var(--ink); text-decoration: none; border: 1px solid var(--line); padding: 4px 10px; border-radius: 999px; font-size: .9rem; }
nav a:hover, nav a:focus-visible { border-color: var(--accent); color: var(--accent); }
section { display: grid; gap: 14px; padding-block: 28px; border-top: 1px solid var(--line); }
section header { display: grid; gap: 4px; }
h2 { font: 400 1.7rem/1.2 var(--display); margin: 0; }
.meta { margin: 0; color: var(--muted); font-size: .92rem; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.pill { background: var(--pill); color: var(--ink); font-size: .78rem; letter-spacing: .03em; padding: 2px 8px; border-radius: 999px; }
.rule { margin: 0; color: var(--muted); font-size: .92rem; max-width: 65ch; }
.field { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; min-width: 0; }
.fieldhead { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); font-size: .78rem; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
pre { margin: 0; padding: 14px 16px; white-space: pre-wrap; word-wrap: break-word; font: 14.5px/1.6 var(--mono); max-width: 100%; overflow-x: auto; }
.copy { font: 500 .78rem var(--body); letter-spacing: .03em; text-transform: none; background: none; border: 1px solid var(--line); color: var(--ink); border-radius: 4px; padding: 3px 10px; cursor: pointer; }
.copy:hover, .copy:focus-visible { border-color: var(--accent); color: var(--accent); outline: none; }
.shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
figure { margin: 0; min-width: 0; }
figure img { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 4px; }
figcaption { font-size: .8rem; color: var(--muted); margin-top: 6px; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
<div class="wrap">
<h1>Forum-<em>Beiträge</em></h1>
<p class="lede">Die Antworten für die 9-Bücher-Welle auf X und Bluesky, dann alle vorbereiteten Beiträge für Reddit und Hacker News, aus dem Kalender (<code>lab/kalender/posts.json</code>). Reddit braucht zuerst ein Konto mit eigener Geschichte, HN etwas Karma. Bildschirmfotos der Live-Seite vom 7. Oktober; die Originale liegen lokal.</p>
<nav>{{NAV}}</nav>
{{SECTIONS}}
</div>
<script>
document.querySelectorAll('.copy').forEach(function (b) {
  b.addEventListener('click', function () {
    var el = document.getElementById(b.dataset.target);
    var done = function () { b.textContent = 'Kopiert'; setTimeout(function () { b.textContent = 'Kopieren'; }, 1500); };
    var select = function () { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Markiert'; };
    try { navigator.clipboard.writeText(el.textContent).then(done, select); } catch (e) { select(); }
  });
});
</script>
'''

if __name__ == '__main__':
    main(sys.argv[1])
