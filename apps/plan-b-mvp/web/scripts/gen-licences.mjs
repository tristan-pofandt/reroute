// Generates src/screens/legal/licences.data.json for the Open-source licences page.
//   node scripts/gen-licences.mjs            (run from apps/plan-b-mvp/web after `npm ci`; set PYTHON to choose the interpreter)
// Sources: package-lock.json (production packages only, no devDependencies), their node_modules/*/package.json and LICENSE files,
// requirements.txt plus its installed dependency closure (read from the Python metadata when Python and the packages are available),
// and the vendored files in ../vendor. Re-run it whenever dependencies change; commit the JSON. Human review required: this reads the
// licence field the package declares and the first copyright line of its licence file, it is not a legal clearance.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..");
const app = join(web, "..");
const out = join(web, "src", "screens", "legal", "licences.data.json");

const spdx = (value) => (typeof value === "string" ? value : value?.type || (Array.isArray(value) ? value.map(spdx).join(" OR ") : "") || "Unknown");
function copyright(dir) {
  for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "license", "license.md", "COPYING"]) {
    const file = join(dir, name);
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => /copyright|\(c\)|©/i.test(l));
    if (line) return line.trim().slice(0, 160);
  }
  return "";
}

// ── npm: the production closure from the lock file
const lock = JSON.parse(readFileSync(join(web, "package-lock.json"), "utf8"));
const npm = [];
for (const [path, info] of Object.entries(lock.packages)) {
  if (!path || info.dev) continue;
  const dir = join(web, path);
  const pkg = existsSync(join(dir, "package.json")) ? JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) : {};
  const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url || pkg.homepage || "";
  npm.push({
    name: path.replace(/^node_modules\//, ""), version: info.version || pkg.version || "", license: spdx(info.license || pkg.license),
    copyright: copyright(dir), url: repo.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://") || `https://www.npmjs.com/package/${path.replace(/^node_modules\//, "")}`,
  });
}

// ── Python: requirements.txt and everything they install
const names = readFileSync(join(app, "requirements.txt"), "utf8").split(/\r?\n/).map((l) => l.trim().split(/[<>=!~\[; ]/)[0]).filter((l) => l && !l.startsWith("#"));
const snippet = `
import json, sys
from importlib import metadata
from importlib.metadata import PackageNotFoundError
import re
seen, rows, todo = set(), [], sys.argv[1:]
while todo:
    name = re.sub(r"[-_.]+", "-", todo.pop()).lower()
    if name in seen: continue
    seen.add(name)
    try: dist = metadata.distribution(name)
    except PackageNotFoundError: continue
    m = dist.metadata
    lic = (m.get("License-Expression") or "").strip()
    if not lic:
        lic = next((c.split("::")[-1].strip() for c in m.get_all("Classifier") or [] if c.startswith("License ::") and "OSI Approved" not in c.split("::")[-1]), "")
    if not lic:
        lic = next((c.split("::")[-1].strip() for c in m.get_all("Classifier") or [] if c.startswith("License ::")), "")
    if not lic: lic = (m.get("License") or "").strip().splitlines()[0][:60] if m.get("License") else "Unknown"
    rows.append({"name": m["Name"], "version": m["Version"], "license": lic, "copyright": "", "url": m.get("Home-page") or next((u.split(", ")[-1] for u in m.get_all("Project-URL") or []), "") or "https://pypi.org/project/" + m["Name"]})
    for req in dist.requires or []:
        if "extra ==" in req: continue
        todo.append(re.split(r"[<>=!~\\[; (]", req)[0])
print(json.dumps(rows))
`;
let python = [];
try {
  python = JSON.parse(execFileSync(process.env.PYTHON || "python", ["-c", snippet, ...names], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
} catch {
  console.warn("Python metadata not available: listing only the direct requirements without versions.");
  python = names.map((name) => ({ name, version: "", license: "See package", copyright: "", url: `https://pypi.org/project/${name}/` }));
}

// Requirements that are not installed here (gunicorn is Linux-only in the Docker image) still get a row.
for (const name of names) {
  if (!python.some((row) => row.name.toLowerCase() === name.toLowerCase())) python.push({ name, version: "", license: { gunicorn: "MIT" }[name.toLowerCase()] || "See package", copyright: "", url: `https://pypi.org/project/${name}/` });
}

// ── Vendored and hosted files that are not in either manager
const vendored = [
  { name: "GSAP (with ScrollTrigger and Flip)", version: "3.12.5", license: "GreenSock Standard License", copyright: "Copyright 2024, GreenSock", url: "https://gsap.com/standard-license" },
  { name: "Lenis (vendored build)", version: "", license: "MIT", copyright: "Copyright (c) Studio Freight / Darkroom Engineering", url: "https://github.com/darkroomengineering/lenis" },
  { name: "Inter typeface (served by Google Fonts)", version: "", license: "OFL-1.1", copyright: "Copyright (c) The Inter Project Authors", url: "https://github.com/rsms/inter" },
];

const byName = (a, b) => a.name.localeCompare(b.name);
const data = { generated: new Date().toISOString().slice(0, 10), npm: npm.sort(byName), python: python.sort(byName), vendored };
writeFileSync(out, JSON.stringify(data, null, 1) + "\n");
console.log(`Wrote ${out}: ${npm.length} npm, ${python.length} Python, ${vendored.length} vendored.`);
