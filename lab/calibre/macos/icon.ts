/**
 * The app's icon, drawn rather than kept as a file (ROADMAP 5.16b).
 *
 *   npx tsx lab/calibre/macos/icon.ts <out.png>
 *
 * A terracotta tile with three covers on it, 1024 px; build.sh cuts the sizes.
 */
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const SIZE = 1024;
const png = new PNG({ width: SIZE, height: SIZE });

type Rgb = [number, number, number];
function rounded(x0: number, y0: number, w: number, h: number, r: number, [red, green, blue]: Rgb): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      // Distance to the nearest corner centre decides whether a corner pixel is inside.
      const cx = Math.max(x0 + r, Math.min(x, x0 + w - 1 - r));
      const cy = Math.max(y0 + r, Math.min(y, y0 + h - 1 - r));
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const at = (y * SIZE + x) * 4;
      png.data[at] = red;
      png.data[at + 1] = green;
      png.data[at + 2] = blue;
      png.data[at + 3] = 255;
    }
  }
}

rounded(64, 64, 896, 896, 200, [181, 83, 47]);
rounded(190, 300, 250, 400, 14, [246, 243, 238]);
rounded(387, 240, 250, 460, 14, [29, 27, 25]);
rounded(584, 330, 250, 370, 14, [226, 178, 92]);
rounded(417, 300, 190, 26, 6, [246, 243, 238]);
rounded(417, 350, 120, 18, 6, [181, 83, 47]);

writeFileSync(process.argv[2] ?? 'icon.png', PNG.sync.write(png));
