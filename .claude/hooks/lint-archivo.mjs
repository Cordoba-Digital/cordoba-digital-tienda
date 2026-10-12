// Después de cada edición de Claude: corre ESLint sobre ese archivo y le
// devuelve los errores para que los arregle en el momento.
import { execFileSync } from "node:child_process";

let input = "";
for await (const chunk of process.stdin) input += chunk;

const file = JSON.parse(input || "{}").tool_input?.file_path ?? "";
if (!/\.(ts|tsx|js|mjs|jsx)$/.test(file) || file.includes("node_modules")) process.exit(0);

try {
  execFileSync("npx", ["eslint", "--no-warn-ignored", file], { stdio: "pipe", encoding: "utf8" });
} catch (error) {
  process.stderr.write(`ESLint encontró problemas en ${file}:\n${error.stdout || error.message}`);
  process.exit(2);
}
