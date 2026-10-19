import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { isOwnerEmail } from "@/lib/admin-access";
import { logAdminAction } from "@/lib/admin-audit";
import { mailConfigured, sendMail, STORE_EMAIL } from "@/lib/mailer";
import { getSavedUsdtRate, isValidUsdtRate, saveUsdtRate, USDT_RATE_MAX, USDT_RATE_MIN } from "@/lib/usdt-rate";

export const dynamic = "force-dynamic";

/**
 * Cambia la cotización con la que se pasa el total a USDT: `{ rate }` en
 * pesos enteros por USDT, o `null` para apagar USDT. Como la wallet: solo
 * dueños, queda en Actividad y avisa por mail.
 */
export async function PUT(request: Request) {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  if (session.email && !isOwnerEmail(session.email)) {
    return Response.json({ ok: false, error: "Solo los dueños pueden cambiar la cotización." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { rate?: unknown } | null;
  const rate = body?.rate === null ? null : body?.rate;
  if (rate !== null && !isValidUsdtRate(rate)) {
    return Response.json(
      { ok: false, error: `Poné cuántos pesos vale 1 USDT, en número entero entre ${USDT_RATE_MIN} y ${USDT_RATE_MAX.toLocaleString("es-AR")}.` },
      { status: 400 },
    );
  }

  const actor = adminActorLabel(session);
  const before = await saveUsdtRate(rate, actor);
  if (before !== rate) {
    const show = (value: number | null) => (value === null ? "(sin cotización: USDT apagado)" : `$${value.toLocaleString("es-AR")}`);
    await logAdminAction(actor, {
      action: "cotizacion_usdt",
      entityType: "medios_de_pago",
      entityId: "usdt",
      summary: rate === null ? "Borró la cotización de USDT" : `Cambió la cotización de USDT a ${show(rate)}`,
      changes: { rate: { from: before, to: rate } },
    });
    if (mailConfigured()) {
      await sendMail({
        to: STORE_EMAIL,
        subject: "Se cambió la cotización de USDT de la tienda",
        text: [
          `${actor} cambió desde el panel cuántos pesos vale 1 USDT para cobrar los pedidos:`,
          "",
          `Antes: ${show(before)}`,
          `Ahora: ${show(rate)}`,
          "",
          "Vale desde el próximo pedido. Si no fuiste vos ni alguien de confianza, entrá al panel y revisalo.",
        ].join("\n"),
      }).catch((error) => console.error("[medios-de-pago] no se pudo mandar el aviso:", error));
    }
  }
  return Response.json({ ok: true, rate: (await getSavedUsdtRate())?.rate ?? null });
}
