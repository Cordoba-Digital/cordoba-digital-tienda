import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders } from "@/db/schema";

export type PaymentFlag = "sin-preferencia" | "pendiente-con-preferencia" | "confirmado-sin-pago" | "pendiente-antiguo";

export type AdminPaymentRow = {
  code: string;
  status: string;
  customerName: string;
  email: string;
  total: number;
  preferenceId: string | null;
  paymentId: string | null;
  createdAt: Date;
  flags: PaymentFlag[];
};

/** Pendiente con preferencia hace más de este tiempo: probablemente abandonó. */
const STALE_PENDING_MS = 48 * 60 * 60 * 1000;

function flagsFor(row: {
  status: string;
  preferenceId: string | null;
  paymentId: string | null;
  createdAt: Date;
}): PaymentFlag[] {
  const flags: PaymentFlag[] = [];
  if (!row.preferenceId) flags.push("sin-preferencia");
  if (row.status === "pendiente_pago" && row.preferenceId) flags.push("pendiente-con-preferencia");
  if (row.status !== "pendiente_pago" && !row.paymentId) flags.push("confirmado-sin-pago");
  if (row.status === "pendiente_pago" && Date.now() - row.createdAt.getTime() > STALE_PENDING_MS) {
    flags.push("pendiente-antiguo");
  }
  return flags;
}

export const PAYMENT_FLAG_LABEL: Record<PaymentFlag, string> = {
  "sin-preferencia": "Sin preferencia",
  "pendiente-con-preferencia": "Fue a pagar",
  "confirmado-sin-pago": "Confirmado sin pago",
  "pendiente-antiguo": "Pendiente +48h",
};

export async function listAdminPayments(input: {
  q: string;
  flag: string;
  page: number;
  perPage: number;
}): Promise<{
  items: AdminPaymentRow[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  summary: { pendientes: number; confirmados: number; montoPendiente: number; montoConfirmado: number };
}> {
  const q = input.q.trim();
  const page = Math.max(1, input.page || 1);
  const perPage = Math.min(50, Math.max(1, input.perPage || 20));

  const clauses = [eq(orders.paymentMethod, "mercadopago")];
  if (q) {
    const term = `%${q}%`;
    const qClause = or(ilike(orders.code, term), ilike(orders.email, term), ilike(orders.customerName, term));
    if (qClause) clauses.push(qClause);
  }
  const where = and(...clauses);

  const rows = await db
    .select({
      code: orders.code,
      status: orders.status,
      customerName: orders.customerName,
      email: orders.email,
      total: orders.total,
      preferenceId: orders.mercadopagoPreferenceId,
      paymentId: orders.mercadopagoPaymentId,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(500);

  const all: AdminPaymentRow[] = rows.map((r) => ({
    ...r,
    flags: flagsFor({ status: r.status, preferenceId: r.preferenceId, paymentId: r.paymentId, createdAt: r.createdAt }),
  }));

  const filtered = input.flag ? all.filter((r) => r.flags.includes(input.flag as PaymentFlag)) : all;
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const items = filtered.slice((page - 1) * perPage, page * perPage);

  const summary = {
    pendientes: all.filter((r) => r.status === "pendiente_pago").length,
    confirmados: all.filter((r) => r.status !== "pendiente_pago").length,
    montoPendiente: all.filter((r) => r.status === "pendiente_pago").reduce((s, r) => s + r.total, 0),
    montoConfirmado: all
      .filter((r) => r.status === "pago_confirmado")
      .reduce((s, r) => s + r.total, 0),
  };

  return { items, total, page, perPage, pages, summary };
}

export type MpVerifyResult =
  | { ok: true; mpStatus: string; mpAmount: number | null; matches: boolean | null }
  | { ok: false; error: string; status: number };

/**
 * Conciliación puntual: trae el pago de la API de Mercado Pago y lo compara
 * con el total de la orden. No escribe nada: solo informa.
 */
export async function verifyPaymentWithMp(code: string): Promise<MpVerifyResult> {
  const normalized = code.trim().toUpperCase();
  const [order] = await db.select().from(orders).where(eq(orders.code, normalized)).limit(1);
  if (!order) return { ok: false, error: "Pedido inexistente.", status: 404 };
  if (!order.mercadopagoPaymentId) {
    return { ok: false, error: "El pedido no tiene pago de Mercado Pago registrado.", status: 409 };
  }
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "Mercado Pago no está conectado (falta credencial de test).", status: 503 };
  }

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${order.mercadopagoPaymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { ok: false, error: `Mercado Pago respondió ${res.status}.`, status: 502 };
  }
  const payment = (await res.json()) as {
    status?: string;
    transaction_amount?: number;
    external_reference?: string;
  };
  const mpStatus = payment.status ?? "desconocido";
  const mpAmount = typeof payment.transaction_amount === "number" ? Math.round(payment.transaction_amount) : null;
  return {
    ok: true,
    mpStatus,
    mpAmount,
    matches: mpAmount === null ? null : mpAmount === order.total,
  };
}
