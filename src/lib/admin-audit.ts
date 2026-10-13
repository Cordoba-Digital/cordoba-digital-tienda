import { sql } from "drizzle-orm";

import { db } from "@/db";
import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";

/**
 * Registro de actividad del admin: quién (email de Google, o "contraseña"),
 * qué (entidad y campos con valor anterior y nuevo) y cuándo. Si guardar el
 * registro falla, el cambio ya hecho no se deshace: se avisa en el log.
 */

export type FieldChange = { from: unknown; to: unknown };
export type AuditEntry = {
  action: string;
  entityType: "producto" | "pedido" | "usuario" | "sesion" | "acceso" | "cupon" | "automatizacion" | "inicio" | "error";
  entityId: string;
  summary: string;
  changes?: Record<string, FieldChange>;
};

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await db.execute(sql`create table if not exists admin_audit (
        id serial primary key,
        at timestamptz not null default now(),
        actor text not null,
        action text not null,
        entity_type text not null,
        entity_id text not null,
        summary text not null,
        changes jsonb
      )`);
      await db.execute(sql`create index if not exists admin_audit_at_idx on admin_audit (at desc)`);
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

export async function actorFromRequest(request: Request): Promise<string> {
  return adminActorLabel(await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie"))));
}

export async function logAdminAction(actor: string, entry: AuditEntry): Promise<void> {
  try {
    await ensureTable();
    const changes = entry.changes && Object.keys(entry.changes).length ? JSON.stringify(entry.changes) : null;
    await db.execute(sql`insert into admin_audit (actor, action, entity_type, entity_id, summary, changes)
      values (${actor}, ${entry.action}, ${entry.entityType}, ${entry.entityId}, ${entry.summary.slice(0, 300)}, ${changes}::jsonb)`);
  } catch (error) {
    console.error("[admin-audit] no se pudo registrar:", entry.action, entry.entityId, error);
  }
}

const FIELD_LABELS: Record<string, string> = {
  name: "nombre", brand: "marca", model: "modelo", storage: "memoria", ram: "RAM", condition: "estado",
  isUnlocked: "liberado", price: "precio", compareAtPrice: "precio anterior", stock: "stock", sku: "SKU",
  categorySlug: "categoría", secondaryCategorySlugs: "otras categorías", shortDescription: "resumen",
  description: "descripción", descriptionHtml: "descripción", images: "fotos", badge: "etiqueta",
  featured: "destacado", warrantyMonths: "garantía", tags: "etiquetas de búsqueda", seoTitle: "título SEO",
  seoDescription: "descripción SEO", weight: "peso", dimensions: "medidas", highlights: "destacados",
  specs: "características",
  kind: "tipo", value: "descuento", minSubtotal: "compra mínima", active: "activo", expiresOn: "vence",
  maxUses: "tope de usos",
};

/** Nombre del campo para mostrar en la Actividad. */
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Textos largos: en el registro solo consta que cambiaron, no el texto entero. */
const LONG_FIELDS = new Set(["description", "descriptionHtml", "shortDescription", "specs", "highlights", "seoDescription"]);

/** Campos que cambiaron entre dos versiones (compara por valor). */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[] = Object.keys(after),
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  for (const field of fields) {
    const a = before[field] ?? null;
    const b = after[field] ?? null;
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    changes[field] = LONG_FIELDS.has(field) ? { from: "(texto anterior)", to: "(texto nuevo)" } : { from: a, to: b };
  }
  return changes;
}

export type ActivityRow = {
  id: number;
  at: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  changes: Record<string, FieldChange> | null;
};

export async function listAdminActivity({
  page = 1,
  perPage = 50,
  entityType = "",
  actor = "",
}: {
  page?: number;
  perPage?: number;
  entityType?: string;
  actor?: string;
}): Promise<{ items: ActivityRow[]; total: number; pages: number; actors: string[] }> {
  await ensureTable();
  const where = sql`where (${entityType} = '' or entity_type = ${entityType}) and (${actor} = '' or actor = ${actor})`;
  const offset = (Math.max(1, page) - 1) * perPage;
  const [rows, count, actors] = await Promise.all([
    db.execute<{
      id: number;
      at: string;
      actor: string;
      action: string;
      entity_type: string;
      entity_id: string;
      summary: string;
      changes: Record<string, FieldChange> | null;
    }>(sql`select id, at, actor, action, entity_type, entity_id, summary, changes from admin_audit ${where}
      order by at desc, id desc limit ${perPage} offset ${offset}`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from admin_audit ${where}`),
    db.execute<{ actor: string }>(sql`select distinct actor from admin_audit order by actor`),
  ]);
  const total = count.rows[0]?.n ?? 0;
  return {
    items: rows.rows.map((r) => ({
      id: r.id,
      at: new Date(r.at).toISOString(),
      actor: r.actor,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      summary: r.summary,
      changes: r.changes,
    })),
    total,
    pages: Math.max(1, Math.ceil(total / perPage)),
    actors: actors.rows.map((r) => r.actor),
  };
}
