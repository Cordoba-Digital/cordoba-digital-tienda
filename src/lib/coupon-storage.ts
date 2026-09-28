import type { CouponInfo } from "@/lib/pricing";

const KEY = "cd_coupon_v1";

export function readCoupon(): CouponInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CouponInfo) : null;
  } catch {
    return null;
  }
}

export function writeCoupon(coupon: CouponInfo | null) {
  if (typeof window === "undefined") return;
  if (!coupon) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, JSON.stringify(coupon));
}
