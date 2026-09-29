/** Lista cada `bg-white` opaco con su línea, para clasificarlos a mano. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(name)) files.push(p);
  }
})("src");

const RE = /(^|[^\w/-])bg-white(?![\w/-])/;
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!RE.test(line)) return;
    const text = line.trim().replace(/\s+/g, " ");
    console.log(`${(f + ":" + (i + 1)).padEnd(40)} ${text.slice(0, 105)}`);
  });
}
