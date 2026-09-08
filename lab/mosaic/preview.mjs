import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
const [, , input, output, wArg] = process.argv;
const src = PNG.sync.read(readFileSync(input));
const w = Number(wArg ?? 400), h = Math.round((src.height * w) / src.width);
const out = new PNG({ width: w, height: h });
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  let r = 0, g = 0, b = 0, n = 0;
  const x0 = Math.floor((x * src.width) / w), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * src.width) / w));
  const y0 = Math.floor((y * src.height) / h), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * src.height) / h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    const s = (yy * src.width + xx) * 4; r += src.data[s]; g += src.data[s + 1]; b += src.data[s + 2]; n++;
  }
  const d = (y * w + x) * 4;
  out.data[d] = r / n; out.data[d + 1] = g / n; out.data[d + 2] = b / n; out.data[d + 3] = 255;
}
writeFileSync(output, PNG.sync.write(out));
console.log('preview', output, w, h);
