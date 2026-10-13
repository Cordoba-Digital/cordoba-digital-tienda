import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { andreaniConfigurado, AndreaniError, cuentaAndreani } from "@/lib/andreani";

export const dynamic = "force-dynamic";

/** Estado de la conexión con Andreani: si la credencial anda y qué contratos tiene. */
export async function GET(request: Request) {
  if (!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  if (!andreaniConfigurado()) {
    return Response.json({ ok: false, conectado: false, error: "Falta la credencial de Andreani." });
  }
  try {
    const cuenta = await cuentaAndreani();
    return Response.json({
      ok: true,
      conectado: true,
      tipo: cuenta.tipo,
      nombre: cuenta.nombre,
      contratos: cuenta.contratos.map((c) => ({ nombre: c.nombre, modalidad: c.modalidad })),
    });
  } catch (error) {
    const mensaje = error instanceof AndreaniError ? error.message : "No se pudo conectar con Andreani.";
    return Response.json({ ok: false, conectado: false, error: mensaje }, { status: 502 });
  }
}
