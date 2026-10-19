import type { Metadata } from "next";

import { CheckoutFlow } from "@/components/checkout-flow";
import { mercadoPagoReady } from "@/lib/mercadopago";
import { getTransferAccount } from "@/lib/transfer-account-server";
import { getUsdtRate } from "@/lib/usdt-rate";
import { getUsdtWallet } from "@/lib/usdt-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout seguro",
  // Decía "3 pasos: datos, entrega y pago", pero el checkout es una sola
  // pantalla como en el original: se saca el wizard de 3 pasos (commit 36db357).
  // La descripción la lee el cliente aunque la página esté en noindex.
  description: "Finalizá tu compra eligiendo cómo pagar, sin registro obligatorio.",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const [transfer, usdtWallet] = await Promise.all([getTransferAccount(), getUsdtWallet()]);
  // USDT se ofrece solo con wallet y con la cotización de la tienda cargada.
  const usdtRate = usdtWallet ? await getUsdtRate() : null;
  return <CheckoutFlow mercadoPago={mercadoPagoReady()} transfer={transfer} usdtRate={usdtRate} />;
}
