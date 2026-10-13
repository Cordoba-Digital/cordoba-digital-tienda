import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { blockedMinutes, ipFromHeaders, NEWSLETTER_LIMIT, recordMiss, tooManyAttempts } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = ipFromHeaders(request.headers);
  const minutes = await blockedMinutes(NEWSLETTER_LIMIT, ip);
  if (minutes > 0) return tooManyAttempts(minutes);
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ ok: false, error: "Email inválido" }, { status: 400 });
  }
  try {
    await recordMiss(NEWSLETTER_LIMIT, ip);
    await db.insert(subscribers).values({ email }).onConflictDoNothing();
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
  // No se devuelve ningun premio: los cupones los carga el local desde su
  // panel. Antes esta respuesta mandaba BIENVENIDO10, un codigo de demostracion
  // que no existe en el negocio real.
  return Response.json({ ok: true });
}
