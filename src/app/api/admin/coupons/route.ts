import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { createAdminCoupon, listAdminCoupons, parseCouponInput, type CouponInput } from "@/lib/admin-coupons";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  return Response.json({ ok: true, coupons: await listAdminCoupons() });
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const parsed = parseCouponInput((await request.json().catch(() => ({}))) as CouponInput);
  if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  const coupon = await createAdminCoupon(parsed.fields);
  if (!coupon) {
    return Response.json({ ok: false, error: `Ya existe un cupón ${parsed.fields.code}.` }, { status: 409 });
  }
  const amount = coupon.kind === "percent" ? `${coupon.value}%` : money(coupon.value);
  await logAdminAction(await actorFromRequest(request), {
    action: "alta",
    entityType: "cupon",
    entityId: coupon.code,
    summary: `Creó el cupón ${coupon.code} (${amount})`,
  });
  return Response.json({ ok: true, coupon });
}
