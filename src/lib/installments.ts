/**
 * Cuotas con tarjeta de crédito, tal como las ofrece la cuenta de Mercado Pago
 * de la tienda. No hay ninguna tabla escrita a mano: si Mercado Pago no
 * responde o no está configurado, la lista queda vacía y la tienda no muestra
 * cuotas (ver el comentario de `computeTotals` en `pricing.ts`).
 *
 * Este archivo lo usa también el navegador: solo tiene la forma de los datos y
 * las cuentas. La consulta a Mercado Pago vive en `installments-server.ts`.
 */
export type InstallmentPlan = {
  installments: number;
  /** Recargo sobre el precio, en porcentaje (0 = sin interés). */
  rate: number;
  /** Rango de precio en pesos en el que Mercado Pago ofrece este plan. */
  minAmount: number;
  maxAmount: number;
  /** "25,84%" tal como lo publica Mercado Pago, o null si no lo informa. */
  cft: string | null;
  tea: string | null;
};

export type InstallmentOption = {
  installments: number;
  interestFree: boolean;
  /** Valor de cada cuota, en pesos enteros. */
  amount: number;
  /** Precio final financiado, en pesos enteros. */
  total: number;
  cft: string | null;
  tea: string | null;
};

type RawPayerCost = {
  installments?: unknown;
  installment_rate?: unknown;
  min_allowed_amount?: unknown;
  max_allowed_amount?: unknown;
  labels?: unknown;
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Saca "25,84%" de una etiqueta como "CFT_25,84%|TEA_20,98%". */
function labelValue(labels: unknown, key: "CFT" | "TEA"): string | null {
  if (!Array.isArray(labels)) return null;
  for (const label of labels) {
    if (typeof label !== "string") continue;
    for (const part of label.split("|")) {
      const [name, value] = part.split("_");
      if (name === key && value) return value;
    }
  }
  return null;
}

/**
 * Convierte la respuesta de `GET /v1/payment_methods/installments` en planes.
 * Toma el primer medio de tarjeta de crédito; ante cualquier forma inesperada
 * devuelve una lista vacía en vez de inventar datos.
 */
export function parseInstallmentPlans(json: unknown): InstallmentPlan[] {
  if (!Array.isArray(json)) return [];
  const method = json.find(
    (entry) => entry && typeof entry === "object" && (entry as { payment_type_id?: unknown }).payment_type_id === "credit_card",
  ) as { payer_costs?: unknown } | undefined;
  if (!method || !Array.isArray(method.payer_costs)) return [];

  const plans: InstallmentPlan[] = [];
  for (const cost of method.payer_costs as RawPayerCost[]) {
    const installments = finite(cost?.installments);
    const rate = finite(cost?.installment_rate);
    if (!installments || installments < 1 || !Number.isInteger(installments) || rate === null || rate < 0) continue;
    plans.push({
      installments,
      rate,
      minAmount: finite(cost.min_allowed_amount) ?? 0,
      maxAmount: finite(cost.max_allowed_amount) ?? Number.MAX_SAFE_INTEGER,
      cft: labelValue(cost.labels, "CFT"),
      tea: labelValue(cost.labels, "TEA"),
    });
  }
  return plans.sort((a, b) => a.installments - b.installments);
}

/** Opciones en cuotas (2 o más) que aplican a un precio, de menos a más cuotas. */
export function installmentOptions(price: number, plans: InstallmentPlan[]): InstallmentOption[] {
  if (!(price > 0)) return [];
  return plans
    .filter((plan) => plan.installments > 1 && price >= plan.minAmount && price <= plan.maxAmount)
    .map((plan) => {
      const total = Math.round(price * (1 + plan.rate / 100));
      return {
        installments: plan.installments,
        interestFree: plan.rate === 0,
        amount: Math.round(total / plan.installments),
        total,
        cft: plan.cft,
        tea: plan.tea,
      };
    });
}

/** La opción sin interés con más cuotas, o null si no hay ninguna. */
export function bestInterestFree(price: number, plans: InstallmentPlan[]): InstallmentOption | null {
  const free = installmentOptions(price, plans).filter((option) => option.interestFree);
  return free.length ? free[free.length - 1] : null;
}
