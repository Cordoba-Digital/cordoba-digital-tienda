import { ADMIN_COOKIE, adminCookieOptions, adminPasswordConfigured, createAdminSessionValue, verifyAdminPassword } from "@/lib/admin-auth";
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
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!verifyAdminPassword((body.password ?? "").trim())) {
    await recordFailedLogin(ip);
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ ok: false, error: "Contraseña incorrecta." }, { status: 401 });
  }
  await clearFailedLogins(ip);
  const session = await createAdminSessionValue();
  if (!session) {
    return Response.json({ ok: false, error: "No se pudo crear la sesión." }, { status: 500 });
  }
  const res = Response.json({ ok: true });
  const opts = adminCookieOptions();
  res.headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${encodeURIComponent(session)}; Path=${opts.path}; HttpOnly; SameSite=Strict; Max-Age=${opts.maxAge}${opts.secure ? "; Secure" : ""}`,
  );
  return res;
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
  return res;
}
