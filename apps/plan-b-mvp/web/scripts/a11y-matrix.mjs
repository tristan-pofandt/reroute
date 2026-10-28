// Runs a11y-audit.mjs --axe for dark and light at 100% and 200% text and fails if any run reports violations, overflow or console errors.
//   node scripts/a11y-matrix.mjs [--base http://127.0.0.1:9455/]   (needs python server.py serving web/dist, see a11y-audit.mjs)
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://127.0.0.1:9455/";
let failed = 0;
for (const theme of ["dark", "light"]) for (const text of [100, 200]) {
  const out = mkdtempSync(join(tmpdir(), "a11y-"));
  const run = spawnSync("node", [join(import.meta.dirname, "a11y-audit.mjs"), "--out", out, "--base", base, "--axe", "--theme", theme, "--text", String(text)], { encoding: "utf8" });
  const text_ = run.stdout + run.stderr;
  const ok = run.status === 0 && /axe: 0 violation groups, 0 nodes/.test(text_) && /overflow: none; console errors: 0/.test(text_);
  console.log(`${ok ? "PASS" : "FAIL"} ${theme} ${text}%`);
  if (!ok) { failed++; console.log(text_.split("\n").slice(-15).join("\n")); }
}
process.exit(failed ? 1 : 0);
