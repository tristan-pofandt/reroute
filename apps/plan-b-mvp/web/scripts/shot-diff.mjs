// Dev-only: compare two folders of screenshots from a11y-audit.mjs. `node scripts/shot-diff.mjs before after` prints, per screen, the share of
// pixels that differ by more than a small threshold (anti-aliasing noise is ignored) and writes <after>/diff-<name>.png for screens above 0.2%.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const [a, b] = process.argv.slice(2);
const T = 24;
let worst = 0;
for (const f of fs.readdirSync(a).filter((f) => f.endsWith(".png"))) {
  if (!fs.existsSync(path.join(b, f))) { console.log(f, "missing in after"); continue; }
  const [x, y] = await Promise.all([a, b].map((d) => sharp(path.join(d, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) { console.log(f, `size differs ${x.info.width}x${x.info.height} vs ${y.info.width}x${y.info.height}`); continue; }
  const out = Buffer.alloc(x.data.length);
  let n = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    const d = Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2]));
    if (d > T) { n++; out[i] = 255; out[i + 3] = 255; } else { out[i] = y.data[i] >> 2; out[i + 1] = y.data[i + 1] >> 2; out[i + 2] = y.data[i + 2] >> 2; out[i + 3] = 255; }
  }
  const pct = (100 * n) / (x.info.width * x.info.height);
  worst = Math.max(worst, pct);
  console.log(f.padEnd(22), pct.toFixed(3) + "%");
  if (pct > 0.2) await sharp(out, { raw: { width: x.info.width, height: x.info.height, channels: 4 } }).png().toFile(path.join(b, `diff-${f}`));
}
console.log("worst", worst.toFixed(3) + "%");
