import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { listAdminPayments, verifyPaymentWithMp } from "@/lib/admin-payments";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const result = await listAdminPayments({
    q: searchParams.get("q") ?? "",
    flag: searchParams.get("flag") ?? "",
    page: Number(searchParams.get("page") ?? 1) || 1,
    perPage: Number(searchParams.get("perPage") ?? 20) || 20,
  });
  return Response.json({ ok: true, ...result });
}

/** Conciliación puntual contra la API de Mercado Pago. No escribe nada. */
export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) {
    return Response.json({ ok: false, error: "Falta el código de pedido." }, { status: 400 });
  }
  const result = await verifyPaymentWithMp(code);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json(result);
}
