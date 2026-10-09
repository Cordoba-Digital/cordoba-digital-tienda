import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { getAdminUserDetail, setUserDisabled } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

function idFrom(request: Request): number | null {
  const parts = new URL(request.url).pathname.split("/");
  const id = Number(parts[parts.length - 1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const id = idFrom(request);
  if (id === null) {
    return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }
  const user = await getAdminUserDetail(id);
  if (!user) {
    return Response.json({ ok: false, error: "Usuario inexistente." }, { status: 404 });
  }
  return Response.json({ ok: true, user });
}

export async function PATCH(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const id = idFrom(request);
  if (id === null) {
    return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { disabled?: unknown };
  if (typeof body.disabled !== "boolean") {
    return Response.json({ ok: false, error: "Falta el estado (disabled: true/false)." }, { status: 400 });
  }
  const updated = await setUserDisabled(id, body.disabled);
  if (!updated) {
    return Response.json({ ok: false, error: "Usuario inexistente." }, { status: 404 });
  }
  return Response.json({ ok: true, disabled: body.disabled });
}
