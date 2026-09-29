/**
 * Captura la pestana del navegador embebido de Orca y la guarda como PNG.
 *
 * `orca screenshot` devuelve la imagen en base64 por stdout, que son cientos de
 * KB: pasar eso por la salida de la terminal lo vuelve ilegible, asi que el
 * base64 se decodifica aca y solo se escribe el archivo.
 *
 * Uso: node scripts/shot.mjs <browserPageId> <salida.png> [tema]
 * El tema ("dark" o "light") se aplica antes de capturar, para comparar la misma
 * pantalla en los dos modos.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const [page, out, theme] = process.argv.slice(2);
if (!page || !out) {
  console.error("uso: node scripts/shot.mjs <browserPageId> <salida.png> [dark|light]");
  process.exit(1);
}

const orca = (args) => execFileSync("orca", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

if (theme === "dark" || theme === "light") {
  // Se escribe la preferencia y se RECARGA, en vez de cambiar la clase a mano
  // sobre la pagina viva. Cambiarla en el sitio produce un repintado parcial:
  // el fondo y el encabezado se actualizan y algunos elementos hijos quedan con
  // el color anterior, lo que hace creer que hay un bug de tema que no existe.
  // Recargando se recorre el camino real: script del <head> y primer pintado.
  orca([
    "eval",
    "--page",
    page,
    "--expression",
    `localStorage.setItem("cd-theme","${theme}");"ok"`,
    "--json",
  ]);
  orca(["reload", "--page", page, "--json"]);
  orca(["wait", "--page", page, "--load", "networkidle", "--json"]);
}

const raw = JSON.parse(orca(["screenshot", "--page", page, "--json"]));
if (!raw.ok) {
  console.error("captura fallida:", JSON.stringify(raw.error));
  process.exit(1);
}

const { data, format } = raw.result;
writeFileSync(out, Buffer.from(data, "base64"));
console.log(`${out} (${format}, ${Math.round((data.length * 3) / 4 / 1024)} KB)`);
