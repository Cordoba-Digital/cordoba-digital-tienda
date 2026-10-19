import { inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { PENDING_EXPIRY_HOURS, SENA_EXPIRY_HOURS, STOCK_HOLD_HOURS } from "@/lib/payment-rules";

/**
 * Interruptores de automatización del panel (Admin → Automatizaciones). Cada
 * uno prende o apaga un paso que la tienda hace sola. Se guardan en
 * `store_settings` con la clave `automatizacion.<id>`; si nunca se tocaron,
 * vale el `default`, que es como funcionaba la tienda antes de tener el
 * interruptor.
 */
export const AUTOMATIONS = {
  vencerPedidos: {
    label: "Vencer pedidos sin pago",
    description:
      `Cancela las órdenes que siguen sin pago a las ${PENDING_EXPIRY_HOURS} horas (${SENA_EXPIRY_HOURS} horas si eran con seña) y devuelve el cupón. El stock de una orden sin pago vuelve a la venta a las ${STOCK_HOLD_HOURS} horas aunque esto esté apagado.`,
    default: true,
  },
  avisarCliente: {
    label: "Avisar al cliente por email",
    description:
      "Le manda un email al cliente cuando su pedido cambia de estado: pago acreditado, en preparación, en camino o listo para retirar, entregado y cancelado.",
    default: false,
  },
  portadaAutomatica: {
    label: "Elegir los productos de la portada",
    description:
      "Cada slide del carrusel de la portada muestra el producto que mejor le va: la oferta con más descuento, lo más vendido de los últimos 30 días y, en el resto, los que más se venden. Solo entran productos con stock y foto, y se actualiza cada 5 minutos. Si lo apagás, vuelve a mostrar los más nuevos. Lo que fijes o saques abajo vale siempre.",
    default: true,
  },
} as const satisfies Record<string, { label: string; description: string; default: boolean }>;

export type AutomationId = keyof typeof AUTOMATIONS;
export type Automations = Record<AutomationId, boolean>;

export const AUTOMATION_IDS = Object.keys(AUTOMATIONS) as AutomationId[];

export function isAutomationId(value: unknown): value is AutomationId {
  return typeof value === "string" && Object.hasOwn(AUTOMATIONS, value);
}

const settingKey = (id: AutomationId) => `automatizacion.${id}`;

/**
 * Crea `store_settings` si falta (es la de la migración 0003), así un deploy
 * que llegue antes que `db:migrate` no rompe el panel ni el cron. Idempotente;
 * corre una vez por instancia.
 */
let schemaReady: Promise<void> | null = null;
export function ensureSettingsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = db
      .execute(
        sql`create table if not exists store_settings (
          key text primary key,
          value jsonb not null,
          updated_by text not null default '',
          updated_at timestamptz not null default now()
        )`,
      )
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

/** Sin caché: se lee en cada uso para que un cambio en el panel valga enseguida en todas las instancias. */
export async function getAutomations(): Promise<Automations> {
  await ensureSettingsSchema();
  const rows = await db
    .select({ key: storeSettings.key, value: storeSettings.value })
    .from(storeSettings)
    .where(inArray(storeSettings.key, AUTOMATION_IDS.map(settingKey)));
  const saved = new Map(rows.map((r) => [r.key, r.value]));
  const result = {} as Automations;
  for (const id of AUTOMATION_IDS) {
    const value = saved.get(settingKey(id));
    result[id] = typeof value === "boolean" ? value : AUTOMATIONS[id].default;
  }
  return result;
}

export async function isAutomationOn(id: AutomationId): Promise<boolean> {
  return (await getAutomations())[id];
}

/** Devuelve el valor anterior. */
export async function setAutomation(id: AutomationId, enabled: boolean, actor: string): Promise<boolean> {
  const before = await isAutomationOn(id);
  await db
    .insert(storeSettings)
    .values({ key: settingKey(id), value: enabled, updatedBy: actor })
    .onConflictDoUpdate({
      target: storeSettings.key,
      set: { value: enabled, updatedBy: actor, updatedAt: new Date() },
    });
  return before;
}
