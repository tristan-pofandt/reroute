// Builds assets/*.png from ../favicon.svg with sharp, then `npx capacitor-assets generate` writes every Android mipmap and iOS AppIcon/splash.
// Re-run after changing the logo:  node scripts/make-native-assets.mjs && npx capacitor-assets generate --android --ios
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const svg = readFileSync(resolve(root, "..", "favicon.svg"), "utf8");
const glyph = svg.match(/<\/rect>|<rect[^>]*\/>([\s\S]*)<\/svg>/)[1];
const defs = svg.match(/<defs>[\s\S]*<\/defs>/)[0];
const wrap = (body, size, bg = "") => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${defs}${bg}${body}</svg>`);
const grad = '<rect width="64" height="64" fill="url(#bg)"/>';
const out = (n) => resolve(root, "assets", n);
mkdirSync(resolve(root, "assets"), { recursive: true });
const png = (buf, n) => sharp(buf).png().toFile(out(n));
await png(wrap(glyph, 1024, grad), "icon-only.png");                                                             // iOS: full bleed, no rounding (iOS rounds it)
await png(wrap(`<g transform="translate(32 32) scale(.85) translate(-32 -32)">${glyph}</g>`, 1024), "icon-foreground.png"); // Android adaptive: glyph inside the 66% safe zone
await png(wrap("", 1024, grad), "icon-background.png");
const rounded = wrap(`<rect width="64" height="64" rx="15" fill="url(#bg)"/>${glyph}`, 640);
for (const n of ["splash.png", "splash-dark.png"]) {
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: "#090A0F" } }).composite([{ input: await sharp(rounded).png().toBuffer(), gravity: "center" }]).png().toFile(out(n));
}
console.log("assets/ written");
