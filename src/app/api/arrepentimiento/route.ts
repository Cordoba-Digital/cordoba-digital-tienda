import nodemailer from "nodemailer";

import { db } from "@/db";
import { arrepentimientoRequests } from "@/db/schema";

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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ArrepentimientoBody;

  const nombre = (body.nombre ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const telefono = (body.telefono ?? "").trim();
  const fechaCompra = (body.fechaCompra ?? "").trim();
  const producto = (body.producto ?? "").trim();
  const numeroPedido = (body.numeroPedido ?? "").trim();
  const comentarios = (body.comentarios ?? "").trim();

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
    .returning({ id: arrepentimientoRequests.id });

  let emailSent = false;
  let emailError: string | null = null;

  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? '"Córdoba Digital" <no-reply@cordobadigital.net>',
        to: "consultas@cordobadigital.net",
        subject: `Botón de arrepentimiento - ${nombre}`,
        text: [
          `Nombre: ${nombre}`,
          `Email: ${email}`,
          `Pedido: ${numeroPedido || "No indicado"}`,
          `Teléfono: ${telefono}`,
          `Fecha de compra: ${fechaCompra}`,
          `Producto: ${producto}`,
          `Comentarios: ${comentarios || "Sin comentarios"}`,
        ].join("\n"),
      });
      emailSent = true;
    } else {
      emailError = "SMTP no configurado.";
    }
  } catch (error) {
    emailError = error instanceof Error ? error.message : "No se pudo enviar el email.";
  }

  // El detalle del SMTP queda en los logs: puede nombrar el servidor o el
  // usuario de la casilla, y al cliente no le sirve.
  if (emailError) console.error("[arrepentimiento] email no enviado:", emailError);
  return Response.json({ ok: true, saved: true, emailSent, id: record.id });
}
