import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { isOwnerEmail } from "@/lib/admin-access";
import { logAdminAction } from "@/lib/admin-audit";
import { mailConfigured, sendMail, STORE_EMAIL } from "@/lib/mailer";
import { isTronAddress } from "@/lib/tron";
import { getSavedUsdtWallet, saveUsdtWallet } from "@/lib/usdt-server";

export const dynamic = "force-dynamic";

/**
 * Cambia la wallet de USDT (red TRON) a la que pagan los clientes:
 * `{ wallet }`, o `""` para apagar USDT en el checkout. Mismas reglas que la
 * cuenta para transferir: solo dueños, queda en Actividad y avisa por mail.
 */
export async function PUT(request: Request) {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  if (session.email && !isOwnerEmail(session.email)) {
    return Response.json({ ok: false, error: "Solo los dueños pueden cambiar la wallet de cobro." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { wallet?: unknown } | null;
  const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : null;
  if (wallet === null || (wallet && !isTronAddress(wallet))) {
    return Response.json(
      { ok: false, error: "Esa no es una dirección de TRON válida. Empieza con T y tiene 34 caracteres: copiala de tu wallet." },
      { status: 400 },
    );
  }

  const actor = adminActorLabel(session);
  const before = await saveUsdtWallet(wallet, actor);
  if (before !== wallet) {
    await logAdminAction(actor, {
      action: "wallet_usdt",
      entityType: "medios_de_pago",
      entityId: "usdt",
      summary: wallet ? "Cambió la wallet de USDT (TRON)" : "Apagó el pago con USDT",
      changes: { wallet: { from: before, to: wallet } },
    });
    if (mailConfigured()) {
      await sendMail({
        to: STORE_EMAIL,
        subject: "Se cambió la wallet de USDT de la tienda",
        text: [
          `${actor} cambió desde el panel la wallet de USDT (red TRON) a la que pagan los clientes:`,
          "",
          `Antes: ${before || "(sin wallet)"}`,
          `Ahora: ${wallet || "(sin wallet: USDT apagado)"}`,
          "",
          "Si no fuiste vos ni alguien de confianza, entrá al panel, volvé a poner la wallet correcta y cambiá las contraseñas.",
        ].join("\n"),
      }).catch((error) => console.error("[medios-de-pago] no se pudo mandar el aviso:", error));
    }
  }
  return Response.json({ ok: true, wallet: (await getSavedUsdtWallet())?.wallet ?? "" });
}
