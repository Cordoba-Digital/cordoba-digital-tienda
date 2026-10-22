import { db } from "@/db";
import { arrepentimientoRequests } from "@/db/schema";
import { customerMail, storeMail, tramiteCode } from "@/lib/arrepentimiento";
import { sendMail, STORE_EMAIL } from "@/lib/mailer";
import { blockedMinutes, FORM_LIMIT, ipFromHeaders, recordMiss, tooManyAttempts } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type ArrepentimientoBody = {
  nombre?: string;
  email?: string;
  numeroPedido?: string;
  telefono?: string;
  fechaCompra?: string;
  producto?: string;
  comentarios?: string;
};

/** Texto recortado a un largo razonable; lo que no es texto cuenta como vacío. */
function field(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const ip = ipFromHeaders(request.headers);
  const minutes = await blockedMinutes(FORM_LIMIT, ip);
  if (minutes > 0) return tooManyAttempts(minutes);

  const body = (await request.json().catch(() => ({}))) as ArrepentimientoBody;

  const nombre = field(body.nombre, 120);
  const email = field(body.email, 254).toLowerCase();
  const telefono = field(body.telefono, 40);
  const fechaCompra = field(body.fechaCompra, 40);
  const producto = field(body.producto, 300);
  const numeroPedido = field(body.numeroPedido, 40);
  const comentarios = field(body.comentarios, 2000);

  const errors: Record<string, string> = {};
  if (nombre.length < 2) errors.nombre = "Ingresá tu nombre.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "Ingresá un email válido.";
  if (telefono.length < 8) errors.telefono = "Ingresá un teléfono válido.";
  if (!fechaCompra) errors.fechaCompra = "Ingresá la fecha de compra.";
  if (producto.length < 2) errors.producto = "Ingresá el producto.";
  if (Object.keys(errors).length) {
    return Response.json({ ok: false, errors }, { status: 400 });
  }

  const [record] = await db
    .insert(arrepentimientoRequests)
    .values({ nombre, email, numeroPedido, telefono, fechaCompra, producto, comentarios })
    .returning();
  await recordMiss(FORM_LIMIT, ip);

  // Primero el del cliente: es el que pide la norma. Si uno falla, el otro
  // igual sale; la solicitud ya quedó guardada y se ve en el panel.
  const [customer, store] = await Promise.allSettled([sendMail(customerMail(record)), sendMail(storeMail(record, STORE_EMAIL))]);
  for (const result of [customer, store]) {
    // El detalle del SMTP queda en los logs: puede nombrar el servidor o el
    // usuario de la casilla, y al cliente no le sirve.
    if (result.status === "rejected") {
      console.error("[arrepentimiento] email no enviado:", result.reason instanceof Error ? result.reason.message : result.reason);
    }
  }
  return Response.json({
    ok: true,
    saved: true,
    code: tramiteCode(record.id),
    emailSent: customer.status === "fulfilled",
    id: record.id,
  });
}
