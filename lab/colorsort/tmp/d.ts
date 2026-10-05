import { refineOriented, orientedColor, type OrientedBox } from '../oriented';
import { toLabImage } from '../spines';
import { rgbToOklab, distance } from '../color';
import { orientedScene } from '../synthetic';
const scene = orientedScene(Number(process.argv[2] ?? 3));
const img = toLabImage(scene.rgba, scene.width, scene.height);
scene.books.forEach((b, i) => {
  const side = i % 2 ? 1 : -1; const nx = -Math.sin(b.angle), ny = Math.cos(b.angle);
  const guess: OrientedBox = { cx: b.cx + nx*side*b.thickness*0.25, cy: b.cy + ny*side*b.thickness*0.25, angle: b.angle + side*2.5*Math.PI/180, length: b.length, thickness: b.thickness*(i%3===0?1.2:0.8) };
  const r = refineOriented(img, guess); const g = r.box;
  const across = (g.cx-b.cx)*nx + (g.cy-b.cy)*ny;
  const c = orientedColor(scene.rgba, scene.width, scene.height, b);
  console.log(i, 't', b.thickness, 'across', across.toFixed(1), 'thick', g.thickness.toFixed(1), 'angle', ((g.angle-b.angle)*180/Math.PI).toFixed(1), 'edges', r.edges, 'col', distance(c.lab, rgbToOklab(...b.color)).toFixed(3));
});
