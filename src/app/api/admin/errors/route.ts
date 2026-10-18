import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { listErrors, resolveErrors } from "@/lib/error-log";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  return Response.json({ ok: true, errors: await listErrors() });
}

/** Marca resuelto un error: `{ fingerprint }`, o todos los abiertos con `{ fingerprint: "todos" }`. */
export async function PATCH(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { fingerprint?: unknown };
  const key = typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";
  if (key !== "todos" && !/^[0-9a-f]{24}$/.test(key)) {
    return Response.json({ ok: false, error: "Error inválido." }, { status: 400 });
  }
  const resolved = await resolveErrors(key);
  if (resolved) {
    await logAdminAction(await actorFromRequest(request), {
      action: "resolver",
      entityType: "error",
      entityId: key,
      summary: key === "todos" ? `Marcó resueltos ${resolved} errores` : "Marcó resuelto un error del servidor",
    });
  }
  return Response.json({ ok: true, resolved });
}
