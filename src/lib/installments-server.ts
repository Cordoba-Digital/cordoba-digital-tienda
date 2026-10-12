import { parseInstallmentPlans, type InstallmentPlan } from "@/lib/installments";
import { mercadoPagoReady } from "@/lib/mercadopago";
import { ttlCache } from "@/lib/ttl-cache";

/**
 * Monto de referencia para pedir los planes. Mercado Pago devuelve el rango de
 * precios de cada plan (`min_allowed_amount`/`max_allowed_amount`), así que con
 * una sola consulta alcanza para todo el catálogo.
 */
const REFERENCE_AMOUNT = 100_000;

/** Los planes cambian cuando César toca la cuenta de Mercado Pago, no a cada rato. */
const TTL_MS = 6 * 60 * 60 * 1000;

/** El layout espera esta consulta en todas las páginas: si tarda, sin cuotas. */
const TIMEOUT_MS = 2500;

const loadPlans = ttlCache<InstallmentPlan[]>("mp-installments", TTL_MS, async () => {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  const url = `https://api.mercadopago.com/v1/payment_methods/installments?amount=${REFERENCE_AMOUNT}&payment_method_id=visa`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Mercado Pago respondió ${response.status}`);
  const plans = parseInstallmentPlans(await response.json());
  // Una respuesta sin planes no se guarda: se vuelve a pedir en la próxima visita.
  if (!plans.length) throw new Error("Mercado Pago no devolvió planes de cuotas");
  return plans;
});

/**
 * Planes de cuotas con tarjeta de crédito de la cuenta de Mercado Pago. Lista
 * vacía si Mercado Pago no está configurado o no responde: la tienda nunca
 * muestra cuotas que no salgan de la cuenta real.
 */
export async function getInstallmentPlans(): Promise<InstallmentPlan[]> {
  if (!mercadoPagoReady()) return [];
  try {
    return await loadPlans();
  } catch (error) {
    console.warn("[cuotas] sin planes de Mercado Pago:", error instanceof Error ? error.message : error);
    return [];
  }
}
