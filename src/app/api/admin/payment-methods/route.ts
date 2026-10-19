import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { isOwnerEmail } from "@/lib/admin-access";
import { logAdminAction } from "@/lib/admin-audit";
import { mailConfigured, sendMail, STORE_EMAIL } from "@/lib/mailer";
import { validateTransferInput, type TransferAccountInput } from "@/lib/transfer-account";
import { getSavedTransferAccount, saveTransferAccount } from "@/lib/transfer-account-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  return Response.json({ ok: true, transfer: await getSavedTransferAccount() });
}

const LABELS: Record<keyof TransferAccountInput, string> = { number: "CBU/CVU", alias: "alias", holder: "titular", cuit: "CUIT" };

/**
 * Cambia la cuenta a la que transfieren los clientes: `{ number, alias, holder, cuit }`.
 * Es lo más delicado del panel (decide a dónde va la plata), así que solo lo
 * cambian los dueños (`ADMIN_EMAILS`) o quien entró con la contraseña, queda en
 * Actividad con el valor anterior y llega un aviso a la casilla de la tienda.
 */
export async function PUT(request: Request) {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  if (session.email && !isOwnerEmail(session.email)) {
    return Response.json({ ok: false, error: "Solo los dueños pueden cambiar la cuenta de cobro." }, { status: 403 });
  }
  const parsed = validateTransferInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });

  const actor = adminActorLabel(session);
  const next = parsed.value;
  const before = await saveTransferAccount(next, actor);
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(LABELS) as (keyof TransferAccountInput)[]) {
    const from = before?.[key] ?? "";
    if (from !== next[key]) changes[LABELS[key]] = { from, to: next[key] };
  }
  if (Object.keys(changes).length) {
    await logAdminAction(actor, {
      action: "cuenta_cobro",
      entityType: "medios_de_pago",
      entityId: "transferencia",
      summary: `Cambió la cuenta para transferencias (${next.alias})`,
      changes,
    });
    if (mailConfigured()) {
      const lines = Object.entries(changes).map(([label, c]) => `${label}: ${c.from || "(vacío)"} → ${c.to || "(vacío)"}`);
      await sendMail({
        to: STORE_EMAIL,
        subject: "Se cambió la cuenta para transferencias de la tienda",
        text: [
          `${actor} cambió desde el panel la cuenta a la que transfieren los clientes:`,
          "",
          ...lines,
          "",
          "Si no fuiste vos ni alguien de confianza, entrá al panel, volvé a poner la cuenta correcta y cambiá las contraseñas.",
        ].join("\n"),
      }).catch((error) => console.error("[medios-de-pago] no se pudo mandar el aviso:", error));
    }
  }
  return Response.json({ ok: true, transfer: await getSavedTransferAccount() });
}
