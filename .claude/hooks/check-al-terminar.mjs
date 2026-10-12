// Antes de que Claude dé una tarea por terminada: si cambió código, corre
// `npm run check`. Si falla, Claude sigue trabajando hasta dejarlo en verde.
import { execFileSync } from "node:child_process";

let input = "";
for await (const chunk of process.stdin) input += chunk;
// Evita un bucle si el hook ya lo frenó una vez en este turno.
if (JSON.parse(input || "{}").stop_hook_active) process.exit(0);

const changed = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
if (!/\.(ts|tsx|js|mjs|jsx|json)$/m.test(changed)) process.exit(0);

try {
  execFileSync("npm", ["run", "check"], { stdio: "pipe", encoding: "utf8" });
} catch (error) {
  const out = `${error.stdout ?? ""}${error.stderr ?? ""}`.slice(-4000);
  process.stderr.write(`npm run check falló. Arreglalo antes de terminar:\n${out}`);
  process.exit(2);
}
