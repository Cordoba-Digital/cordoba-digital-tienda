/**
 * Verifica el HTML servido: no debe quedar ningun `bg-white` opaco (todo paso a
 * `bg-surface`), salvo los tres casos conocidos que son blancos en los dos
 * temas. Los `bg-white/xx` con alpha si se conservan, porque van sobre
 * secciones oscuras donde translucido es lo correcto.
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const RUTAS = ["/", "/categoria/celulares-cordoba", "/carrito", "/productos"];

/** Blanco legitimo: la pastilla del logo en el header y en el footer. */
const BLANCOS_ESPERADOS = 2;

let fail = 0;

for (const ruta of RUTAS) {
  const res = await fetch(`https://cordoba-digital.vercel.app${ruta}`, {
    headers: { "user-agent": UA },
  });
  const html = await res.text();

  // El HTML servido incluye el payload serializado de React (RSC), donde las
  // mismas clases vuelven a aparecer escapadas. Contar sobre el archivo entero
  // daria falsos positivos, asi que se cuentan solo los atributos `class=""`
  // del markup renderizado.
  const rendered = (html.match(/class="[^"]*"/g) || []).join(" ");
  const contar = (re) => (rendered.match(re) || []).length;

  const opaco = contar(/(^|[^\w/-])bg-white(?![\w/-])/g);
  const alpha = contar(/bg-white\//g);
  const surface = contar(/bg-surface/g);
  const deep = contar(/bg-deep/g);
  const script = html.includes("cd-theme") ? 1 : 0;
  const toggle = (html.match(/Cambiar entre tema claro y oscuro/g) || []).length;

  const ok = opaco === BLANCOS_ESPERADOS && surface > 0 && script === 1 && toggle === 2;
  if (!ok) fail += 1;

  console.log(
    `${ok ? "ok  " : "FALTA"} ${ruta.padEnd(28)} bg-surface=${String(surface).padStart(3)}  ` +
      `bg-deep=${String(deep).padStart(3)}  bg-white opaco=${opaco}  bg-white/${String(alpha).padStart(2)}  ` +
      `script=${script}  toggle=${toggle}`,
  );
}

console.log(`\n${fail === 0 ? "TODO OK" : `${fail} RUTAS CON PROBLEMAS`}`);
process.exit(fail === 0 ? 0 : 1);
