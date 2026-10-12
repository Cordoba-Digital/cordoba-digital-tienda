import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { actorFromRequest, diffFields, logAdminAction } from "@/lib/admin-audit";
import { parseCouponInput, updateAdminCoupon, type CouponInput } from "@/lib/admin-coupons";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

/** Edita todo menos el código, que los pedidos ya guardan como texto. */
export async function PATCH(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { code: rawCode } = await context.params;
  const body = (await request.json().catch(() => ({}))) as CouponInput;
  const parsed = parseCouponInput({ ...body, code: rawCode });
  if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  const { code, ...fields } = parsed.fields;
  const result = await updateAdminCoupon(code, fields);
  if (!result) return Response.json({ ok: false, error: `No existe el cupón ${code}.` }, { status: 404 });

  const changes = diffFields(result.before, result.after, ["kind", "value", "minSubtotal", "description", "active", "expiresOn", "maxUses"]);
  if (Object.keys(changes).length) {
    await logAdminAction(await actorFromRequest(request), {
      action: "edicion",
      entityType: "cupon",
      entityId: code,
      summary: `Editó el cupón ${code}`,
      changes,
    });
  }
  return Response.json({ ok: true, coupon: result.after });
}
