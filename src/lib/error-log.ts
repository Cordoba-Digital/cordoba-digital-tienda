import { createHash } from "node:crypto";

import { desc, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { errorEvents } from "@/db/schema";
import { adminEmails } from "@/lib/admin-auth";
import { mailConfigured, sendMail } from "@/lib/mailer";
import { url } from "@/lib/site";

/**
 * Registro de errores del servidor. `instrumentation.ts` llama a
 * `recordServerError` cada vez que una página o una ruta de API tira un error
 * sin atrapar. Los errores iguales se agrupan por huella (mensaje sin números
 * más la ruta), así un error repetido mil veces es una sola fila con su cuenta.
 * El primero de cada tipo, o el que vuelve después de marcarlo resuelto, le
 * llega por email a los dueños del panel.
 */

/** Un error que sigue pasando vuelve a avisar como mucho cada este tiempo. */
const REALERT_MS = 6 * 60 * 60 * 1000;

export type ServerErrorInput = {
  message: string;
  stack?: string;
  route?: string;
  path?: string;
  method?: string;
};

export type ErrorRow = typeof errorEvents.$inferSelect;

/** Saca de un texto lo que podría ser un dato personal: emails y números largos (DNI, teléfono, tarjeta). */
export function redact(text: string): string {
  return text
    .replace(/[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi, "[email]")
    .replace(/\d[\d\s.-]{5,}\d/g, (m) => (m.replace(/\D/g, "").length >= 7 ? "[número]" : m));
}

/** Huella del error: el mismo error con otro id, pedido o fecha da la misma huella. */
export function fingerprint(message: string, route: string): string {
  const normalized = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b[0-9a-f]{12,}\b/gi, "<hex>")
    .replace(/\d+/g, "<n>")
    .trim();
  return createHash("sha256").update(`${route}\n${normalized}`).digest("hex").slice(0, 24);
}

let schemaReady: Promise<void> | null = null;
/** Crea la tabla si falta (es la de la migración 0005), igual que las otras tablas que la app se arregla sola. */
export function ensureErrorSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = db
      .execute(
        sql`create table if not exists error_events (
          fingerprint text primary key,
          message text not null,
          stack text not null default '',
          route text not null default '',
          path text not null default '',
          method text not null default '',
          count integer not null default 1,
          first_seen timestamptz not null default now(),
          last_seen timestamptz not null default now(),
          last_alerted_at timestamptz,
          resolved_at timestamptz
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

/**
 * Guarda el error y avisa por email si corresponde. Nunca tira error: si la
 * base también falla, queda solo en los logs de Vercel.
 */
export async function recordServerError(input: ServerErrorInput): Promise<void> {
  try {
    await ensureErrorSchema();
    const message = redact(input.message || "Error sin mensaje").slice(0, 1000);
    const route = (input.route ?? "").slice(0, 200);
    // Sin query string: puede traer tokens o datos del cliente.
    const path = redact((input.path ?? "").split("?")[0]).slice(0, 300);
    const stack = redact(input.stack ?? "").slice(0, 4000);
    const method = (input.method ?? "").slice(0, 10);
    const key = fingerprint(message, route);

    const [row] = await db
      .insert(errorEvents)
      .values({ fingerprint: key, message, stack, route, path, method })
      .onConflictDoUpdate({
        target: errorEvents.fingerprint,
        set: {
          count: sql`${errorEvents.count} + 1`,
          lastSeen: sql`now()`,
          message,
          stack,
          path,
          method,
          resolvedAt: null,
        },
      })
      .returning();

    // Reclama el aviso en el mismo UPDATE: si llegan diez errores iguales a la vez, sale un solo email.
    const claimed = await db
      .update(errorEvents)
      .set({ lastAlertedAt: sql`now()` })
      .where(
        sql`${errorEvents.fingerprint} = ${key} and (${errorEvents.lastAlertedAt} is null
          or ${errorEvents.lastAlertedAt} < now() - make_interval(secs => ${REALERT_MS / 1000}))`,
      )
      .returning({ fingerprint: errorEvents.fingerprint });
    if (claimed.length) await alertOwners(row);
  } catch (error) {
    console.error("[error-log] no se pudo registrar el error:", error instanceof Error ? error.message : error);
  }
}

async function alertOwners(row: ErrorRow): Promise<void> {
  const to = adminEmails();
  if (!to.length || !mailConfigured()) return;
  const text = [
    "La tienda tuvo un error en el servidor.",
    "",
    `Error: ${row.message}`,
    `Dónde: ${row.method} ${row.path || row.route}`,
    `Veces: ${row.count}`,
    "",
    `Detalle y estado: ${url("/admin/errores")}`,
    "",
    "Si sigue pasando, no te llega otro aviso por este mismo error en las próximas 6 horas.",
  ].join("\n");
  for (const email of to) {
    await sendMail({ to: email, subject: `Error en la tienda: ${row.message.slice(0, 80)}`, text }).catch((error) =>
      console.error("[error-log] no se pudo mandar el aviso:", (error as { code?: string }).code ?? "sin código"),
    );
  }
}

export async function listErrors(): Promise<ErrorRow[]> {
  await ensureErrorSchema();
  return db
    .select()
    .from(errorEvents)
    .orderBy(sql`${errorEvents.resolvedAt} is not null`, desc(errorEvents.lastSeen))
    .limit(200);
}

export async function countOpenErrors(): Promise<number> {
  try {
    await ensureErrorSchema();
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(errorEvents).where(isNull(errorEvents.resolvedAt));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Marca resuelto un error (o todos los abiertos con `"todos"`). Si vuelve a pasar, se reabre y avisa de nuevo. */
export async function resolveErrors(key: string): Promise<number> {
  await ensureErrorSchema();
  const rows = await db
    .update(errorEvents)
    // Sin aviso pendiente: si vuelve a pasar, avisa enseguida aunque no hayan pasado las 6 horas.
    .set({ resolvedAt: sql`now()`, lastAlertedAt: null })
    .where(key === "todos" ? isNull(errorEvents.resolvedAt) : sql`${errorEvents.fingerprint} = ${key} and ${errorEvents.resolvedAt} is null`)
    .returning({ fingerprint: errorEvents.fingerprint });
  return rows.length;
}
