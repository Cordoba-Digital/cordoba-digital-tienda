import type { Metadata } from "next";

import { CheckoutFlow } from "@/components/checkout-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout seguro",
  description: "Finalizá tu compra en 3 pasos: datos, entrega y pago. Sin registro obligatorio.",
  robots: { index: false },
};

export default function CheckoutPage() {
  return <CheckoutFlow />;
}
