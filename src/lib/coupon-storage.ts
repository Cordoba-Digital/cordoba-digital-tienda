import type { CouponInfo } from "@/lib/pricing";

const KEY = "cd_coupon_v1";

/** El cupón guardado, solo si tiene la forma de uno. El servidor lo valida igual al confirmar. */
export function readCoupon(): CouponInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<CouponInfo> | null;
    if (
      !c ||
      typeof c.code !== "string" ||
      typeof c.kind !== "string" ||
      typeof c.value !== "number" ||
      !Number.isFinite(c.value)
    ) {
      return null;
    }
    return {
      code: c.code,
      kind: c.kind,
      value: c.value,
      minSubtotal: typeof c.minSubtotal === "number" && Number.isFinite(c.minSubtotal) ? c.minSubtotal : 0,
      description: typeof c.description === "string" ? c.description : "",
    };
  } catch {
    return null;
  }
}

export function writeCoupon(coupon: CouponInfo | null) {
  if (typeof window === "undefined") return;
  try {
    if (!coupon) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(coupon));
  } catch {
    /* sin almacenamiento el cupón vive hasta recargar */
  }
}
