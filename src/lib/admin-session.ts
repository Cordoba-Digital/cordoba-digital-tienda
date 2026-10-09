import { decodeAdminSession, type AdminSession } from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-access";

/**
 * Sesión del admin para páginas y rutas (Node). Sacar un email de
 * `ADMIN_EMAILS` o de Accesos (o borrar `ADMIN_PASSWORD`) corta en el acto las
 * sesiones abiertas con él.
 */
export async function readAdminSession(value: string | undefined | null): Promise<AdminSession | null> {
  const session = await decodeAdminSession(value);
  if (!session) return null;
  if (session.email && !(await isAllowedAdminEmail(session.email))) return null;
  return session;
}

export async function verifyAdminSessionValue(value: string | undefined | null): Promise<boolean> {
  return (await readAdminSession(value)) !== null;
}
