// Dev-only: node scripts/montage.mjs <dir> out.png name1 name2 ... -> the named screenshots side by side.
import sharp from "sharp";
import path from "node:path";
const [dir, out, ...names] = process.argv.slice(2);
const imgs = await Promise.all(names.map((n) => sharp(path.join(dir, n + ".png")).toBuffer({ resolveWithObject: true })));
const h = Math.max(...imgs.map((i) => i.info.height));
let x = 0;
const parts = imgs.map((i) => { const p = { input: i.data, left: x, top: 0 }; x += i.info.width + 6; return p; });
await sharp({ create: { width: x, height: h, channels: 3, background: "#888" } }).composite(parts).png().toFile(out);
