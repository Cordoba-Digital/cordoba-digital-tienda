import { eq } from "drizzle-orm";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { crearEnvioDePedido, sincronizarEnvios } from "@/lib/admin-andreani";
import { andreaniConfigurado, AndreaniError, etiqueta } from "@/lib/andreani";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

async function codigo(context: { params: Promise<{ code: string }> }): Promise<string> {
  return decodeURIComponent((await context.params).code).trim().toUpperCase();
}

/**
 * POST { accion: "crear", sucursal? } da de alta el envío en Andreani.
 * POST { accion: "actualizar" } trae el número de seguimiento y el estado.
 */
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  if (!andreaniConfigurado()) {
    return Response.json({ ok: false, error: "Andreani no está conectado (falta la credencial)." }, { status: 503 });
  }
  const code = await codigo(context);
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { accion?: unknown; sucursal?: unknown };

  if (body.accion === "crear") {
    const sucursal = typeof body.sucursal === "string" ? body.sucursal.trim().slice(0, 20) : "";
    const resultado = await crearEnvioDePedido(code, sucursal);
    if (!resultado.ok) return Response.json({ ok: false, error: resultado.error }, { status: resultado.status });
    await logAdminAction(await actorFromRequest(request), {
      action: "pedido",
      entityType: "pedido",
      entityId: code,
      summary: `Pedido ${code}: envío creado en Andreani (${resultado.envio.pedidoId})`,
      changes: { andreani: { from: null, to: resultado.envio.pedidoId } },
    });
    return Response.json({ ok: true, envio: resultado.envio });
  }

  if (body.accion === "actualizar") {
    try {
      const resultado = await sincronizarEnvios([code]);
      return Response.json({ ok: true, ...resultado });
    } catch (error) {
      const mensaje = error instanceof AndreaniError ? error.message : "No se pudo consultar Andreani.";
      return Response.json({ ok: false, error: mensaje }, { status: 502 });
    }
  }

  return Response.json({ ok: false, error: "Acción inválida." }, { status: 400 });
}

/** GET devuelve la etiqueta en PDF (solo con número de seguimiento). */
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const code = await codigo(context);
  const [order] = await db
    .select({ trackingCode: orders.trackingCode, andreani: orders.andreani })
    .from(orders)
    .where(eq(orders.code, code))
    .limit(1);
  if (!order?.andreani?.pedidoId || !order.trackingCode) {
    return Response.json(
      { ok: false, error: "La etiqueta está disponible cuando el envío está pagado y tiene número de seguimiento." },
      { status: 404 },
    );
  }
  try {
    const pdf = await etiqueta(order.trackingCode);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="etiqueta-${code}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const mensaje = error instanceof AndreaniError ? error.message : "No se pudo bajar la etiqueta.";
    return Response.json({ ok: false, error: mensaje }, { status: 502 });
  }
}
