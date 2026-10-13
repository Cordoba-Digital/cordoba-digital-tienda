import nodemailer from "nodemailer";

export const STORE_EMAIL = "consultas@cordobadigital.net";

export type OutgoingMail = { to: string; subject: string; text: string };

let testOutbox: OutgoingMail[] | null = null;

/** Para los tests: en vez de mandar por SMTP, guarda los emails en la lista que devuelve. */
export function captureMailForTests(): OutgoingMail[] {
  testOutbox = [];
  return testOutbox;
}

/** Hay con qué mandar: las variables `SMTP_*` de Vercel (las mismas que usa el botón de arrepentimiento). */
export function mailConfigured(): boolean {
  return testOutbox !== null || Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Manda un email de texto con respuesta a la casilla de la tienda. Tira error si no se pudo. */
export async function sendMail(mail: OutgoingMail): Promise<void> {
  if (testOutbox) {
    testOutbox.push(mail);
    return;
  }
  if (!mailConfigured()) throw new Error("SMTP no configurado.");
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Se manda dentro del pedido que cambia el estado: un SMTP colgado no puede trabar el panel ni el webhook.
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? '"Córdoba Digital" <no-reply@cordobadigital.net>',
    replyTo: STORE_EMAIL,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  });
}
