import { ADMIN_COOKIE, adminCookieOptions, adminPasswordConfigured, createAdminSessionValue, verifyAdminPassword } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!adminPasswordConfigured()) {
    return Response.json({ ok: false, error: "Panel no configurado. Definí ADMIN_PASSWORD en el servidor." }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!verifyAdminPassword((body.password ?? "").trim())) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ ok: false, error: "Contraseña incorrecta." }, { status: 401 });
  }
  const session = await createAdminSessionValue();
  if (!session) {
    return Response.json({ ok: false, error: "No se pudo crear la sesión." }, { status: 500 });
  }
  const res = Response.json({ ok: true });
  const opts = adminCookieOptions();
  res.headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${encodeURIComponent(session)}; Path=${opts.path}; HttpOnly; SameSite=Lax; Max-Age=${opts.maxAge}${opts.secure ? "; Secure" : ""}`,
  );
  return res;
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
