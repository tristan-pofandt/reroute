// Store graphics from the brand logo (../favicon.svg), written to docs/product/store-listing/assets/:
//   play-icon-512.png (Play hi-res icon, 512x512), play-feature-graphic-1024x500.png, ios-marketing-icon-1024.png (App Store, no alpha channel).
// Run:  node scripts/gen-store-assets.mjs   (sharp is a devDependency). Text in the feature graphic uses the machine's sans-serif font.
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const svg = readFileSync(resolve(import.meta.dirname, "..", "..", "favicon.svg"), "utf8");
const defs = svg.match(/<defs>[\s\S]*<\/defs>/)[0];
const glyph = svg.match(/<rect[^>]*\/>([\s\S]*)<\/svg>/)[1];
const outDir = resolve(import.meta.dirname, "..", "..", "..", "..", "docs", "product", "store-listing", "assets");
mkdirSync(outDir, { recursive: true });
const out = (name) => resolve(outDir, name);
const mark = (size, rounded) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${defs}<rect width="64" height="64"${rounded ? ' rx="15"' : ""} fill="url(#bg)"/>${glyph}</svg>`);

// Play and App Store both apply their own mask, so the icons are full-bleed squares.
await sharp(mark(512, false)).png().toFile(out("play-icon-512.png"));
await sharp(mark(1024, false)).flatten({ background: "#4F46E5" }).removeAlpha().png().toFile(out("ios-marketing-icon-1024.png"));

const logo = await sharp(mark(300, true)).png().toBuffer();
const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#13151D"/><stop offset="1" stop-color="#090A0F"/></linearGradient></defs>
  <rect width="1024" height="500" fill="url(#g)"/>
  <g font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" fill="#F4F5F9">
    <text x="400" y="235" font-size="92" font-weight="700" letter-spacing="-2">Reroute</text>
    <text x="404" y="295" font-size="34" fill="#B7BCCB">Beat transit disruptions.</text>
    <text x="404" y="342" font-size="22" fill="#8D93A6">Public transport first. Driving cost and CO2 compared.</text>
  </g></svg>`);
await sharp(text).composite([{ input: logo, left: 70, top: 100 }]).flatten({ background: "#090A0F" }).removeAlpha().png().toFile(out("play-feature-graphic-1024x500.png"));

for (const [name, w, h, alpha] of [["play-icon-512.png", 512, 512, true], ["play-feature-graphic-1024x500.png", 1024, 500, false], ["ios-marketing-icon-1024.png", 1024, 1024, false]]) {
  const m = await sharp(out(name)).metadata();
  if (m.width !== w || m.height !== h || (alpha === false && m.hasAlpha)) throw new Error(`${name}: wrong size or alpha (${m.width}x${m.height}, alpha ${m.hasAlpha})`);
  console.log(`${name} ${m.width}x${m.height} alpha=${m.hasAlpha}`);
}
