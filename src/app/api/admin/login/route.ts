import { ADMIN_COOKIE, adminPasswordConfigured, adminSessionCookieHeader, createAdminSessionValue, verifyAdminPassword } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { clearFailedLogins, clientIp, loginBlockedMinutes, recordFailedLogin } from "@/lib/admin-login-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!adminPasswordConfigured()) {
    return Response.json({ ok: false, error: "Panel no configurado. Definí ADMIN_PASSWORD en el servidor." }, { status: 503 });
  }
  const ip = clientIp(request);
  const blocked = await loginBlockedMinutes(ip);
  if (blocked) {
    return Response.json(
      { ok: false, error: `Demasiados intentos fallidos. Probá de nuevo en ${blocked} min.` },
      { status: 429, headers: { "Retry-After": String(blocked * 60) } },
    );
  }
  const body = (await request.json().catch(() => ({}))) as { password?: string; remember?: unknown };
  const remember = body.remember === true;
  if (!verifyAdminPassword((body.password ?? "").trim())) {
    await recordFailedLogin(ip);
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ ok: false, error: "Contraseña incorrecta." }, { status: 401 });
  }
  await clearFailedLogins(ip);
  const session = await createAdminSessionValue("", remember);
  if (!session) {
    return Response.json({ ok: false, error: "No se pudo crear la sesión." }, { status: 500 });
  }
  await logAdminAction("contraseña", { action: "ingreso", entityType: "sesion", entityId: ip, summary: "Ingresó con la clave de administrador" });
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", adminSessionCookieHeader(session, remember));
  return res;
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
  return res;
}
