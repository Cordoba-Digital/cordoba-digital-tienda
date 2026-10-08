import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { listAdminOrders } from "@/lib/admin-orders";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const result = await listAdminOrders({
    q: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? "",
    page: Number(searchParams.get("page") ?? 1) || 1,
    perPage: Number(searchParams.get("perPage") ?? 20) || 20,
  });
  return Response.json({ ok: true, ...result });
}
