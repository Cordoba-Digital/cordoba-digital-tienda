import { db } from "@/db";
import { subscribers } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ ok: false, error: "Email inválido" }, { status: 400 });
  }
  try {
    await db.insert(subscribers).values({ email }).onConflictDoNothing();
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true, coupon: "BIENVENIDO10" });
}
