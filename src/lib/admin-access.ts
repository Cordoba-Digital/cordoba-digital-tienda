import { sql } from "drizzle-orm";

import { db } from "@/db";
import { adminEmails } from "@/lib/admin-auth";

/**
 * Quién puede entrar al panel con Google:
 * - Dueños: los emails de `ADMIN_EMAILS` en Vercel. No se pueden quitar desde
 *   el panel, así nadie deja la tienda sin acceso por error.
 * - Admins agregados desde Panel → Accesos (tabla `admin_access`).
 * Solo los dueños (o quien entró con la contraseña) pueden agregar o quitar.
 */

export type AdminAccessRow = { email: string; addedBy: string; addedAt: Date; owner: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 200 && EMAIL_RE.test(email);
}

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = db
      .execute(sql`create table if not exists admin_access (
        email text primary key,
        added_by text not null,
        added_at timestamptz not null default now()
      )`)
      .then(() => undefined)
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

export function isOwnerEmail(email: string): boolean {
  return adminEmails().includes(normalizeEmail(email));
}

/** Dueño o admin agregado. Si la base no responde, solo pasan los dueños. */
export async function isAllowedAdminEmail(email: string): Promise<boolean> {
  const who = normalizeEmail(email);
  if (!who) return false;
  if (isOwnerEmail(who)) return true;
  try {
    await ensureTable();
    const res = await db.execute(sql`select 1 from admin_access where email = ${who} limit 1`);
    return res.rows.length > 0;
  } catch (error) {
    console.error("[admin-access] no se pudo consultar:", error);
    return false;
  }
}

export async function listAdminAccess(): Promise<AdminAccessRow[]> {
  await ensureTable();
  const res = await db.execute(sql`select email, added_by, added_at from admin_access order by added_at asc`);
  const added = (res.rows as { email: string; added_by: string; added_at: string | Date }[])
    .filter((r) => !isOwnerEmail(r.email))
    .map((r) => ({ email: r.email, addedBy: r.added_by, addedAt: new Date(r.added_at), owner: false }));
  const owners = adminEmails().map((email) => ({ email, addedBy: "Vercel", addedAt: new Date(0), owner: true }));
  return [...owners, ...added];
}

/** `false` si ya estaba. */
export async function addAdminAccess(email: string, addedBy: string): Promise<boolean> {
  await ensureTable();
  const res = await db.execute(
    sql`insert into admin_access (email, added_by) values (${normalizeEmail(email)}, ${addedBy}) on conflict (email) do nothing returning email`,
  );
  return res.rows.length > 0;
}

/** `false` si no estaba. */
export async function removeAdminAccess(email: string): Promise<boolean> {
  await ensureTable();
  const res = await db.execute(sql`delete from admin_access where email = ${normalizeEmail(email)} returning email`);
  return res.rows.length > 0;
}
