"""
The performative reader's starter pack as a share picture (5.6b, PLAN-5.6b §4b).

Julian made the board in the Shelf-Portrait editor and saved the poster
(`out/cache/starterpack-julian.jpg`, his, local only). For this one picture
he wanted the second line as the only heading (2026-10-06: "for this single
picture i would like the subheader to be the header so i can use it as a
sharepic"). The site's poster stays as it is; this redraws the head band from
the poster's own mosaic and sets the line in the site's proportional Xanh.

    python3 lab/kalender/sharepic_starterpack.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
SRC = os.path.join(HERE, 'out', 'cache', 'starterpack-julian.jpg')
OUT = os.path.join(HERE, 'out', 'starterpack-sharepic.jpg')
TITLE = 'The performative reader starter pack'
BAND = 143  # the covers start here in the 1080x1350 poster

src = Image.open(SRC).convert('RGB')
W = src.width
# Pure mosaic between the last row of covers and the footer, stacked to fill the band.
strip = src.crop((0, 1180, W, 1226))
band = Image.new('RGB', (W, BAND))
for y in range(0, BAND, strip.height):
    band.paste(strip, (0, y))
# Keep the original at the outer edges so the band meets the sides without a seam.
mask = Image.new('L', (W, BAND))
md = ImageDraw.Draw(mask)
for x in range(W):
    edge = min(x, W - 1 - x)
    md.line((x, 0, x, BAND - 1), fill=255 if edge > 70 else int(255 * edge / 70))
merged = Image.composite(band, src.crop((0, 0, W, BAND)), mask)
# Darker towards the top, as the poster is behind its words.
shade = Image.new('L', (W, BAND))
sd = ImageDraw.Draw(shade)
for y in range(BAND):
    sd.line((0, y, W, y), fill=int(150 - 60 * y / (BAND - 1)))
merged = Image.composite(Image.new('RGB', (W, BAND), (18, 16, 12)), merged, shade)
out = src.copy()
out.paste(merged, (0, 0))
d = ImageDraw.Draw(out)
f = ImageFont.truetype(os.path.join(ROOT, 'assets', 'fonts', 'xanh-proportional-regular.woff'), 56)
x = (W - d.textlength(TITLE, font=f)) / 2
d.text((x + 2, 43), TITLE, font=f, fill=(0, 0, 0))
d.text((x, 40), TITLE, font=f, fill=(244, 240, 231))
out.save(OUT, quality=93)
print('written', OUT)
