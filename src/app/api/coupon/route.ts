import { money } from "@/lib/format";
import { couponDiscountFor } from "@/lib/pricing";
import { getCoupon } from "@/lib/queries";
import { blockedMinutes, COUPON_LIMIT, ipFromHeaders, recordMiss, tooManyAttempts } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { code?: unknown; subtotal?: number };
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const subtotal = Number(body.subtotal ?? 0);

  if (!code) return Response.json({ ok: false, error: "Ingresá un cupón." }, { status: 400 });

  const ip = ipFromHeaders(request.headers);
  const blocked = await blockedMinutes(COUPON_LIMIT, ip);
  if (blocked) return tooManyAttempts(blocked);

  const coupon = await getCoupon(code);
  if (!coupon) {
    await recordMiss(COUPON_LIMIT, ip);
    return Response.json({ ok: false, error: "El cupón no existe o ya venció." }, { status: 404 });
  }
  if (subtotal < coupon.minSubtotal) {
    return Response.json(
      {
        ok: false,
        error: `El cupón ${coupon.code} aplica en compras desde ${money(coupon.minSubtotal)}.`,
      },
      { status: 400 },
    );
  }

  return Response.json({
    ok: true,
    coupon: {
      code: coupon.code,
      kind: coupon.kind,
      value: coupon.value,
      minSubtotal: coupon.minSubtotal,
      description: coupon.description,
    },
    discount: couponDiscountFor(subtotal, coupon),
  });
}
