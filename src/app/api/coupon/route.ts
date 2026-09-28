import { money } from "@/lib/format";
import { couponDiscountFor } from "@/lib/pricing";
import { getCoupon } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: string; subtotal?: number };
  const code = (body.code ?? "").trim().toUpperCase();
  const subtotal = Number(body.subtotal ?? 0);

  if (!code) return Response.json({ ok: false, error: "Ingresá un cupón." }, { status: 400 });

  const coupon = await getCoupon(code);
  if (!coupon) {
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
