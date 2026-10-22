import { formatDateTime } from "@/lib/format";
import type { OutgoingMail } from "@/lib/mailer";

/**
 * Código de trámite del botón de arrepentimiento. La Resolución 424/2020 pide
 * que el cliente reciba un código de identificación de la solicitud dentro de
 * las 24 horas, por el mismo medio. Sale del id de la fila, así que existe
 * desde que se guarda y no hace falta otra columna: ARR-00042.
 */
export function tramiteCode(id: number): string {
  return `ARR-${String(id).padStart(5, "0")}`;
}

export type SolicitudArrepentimiento = {
  id: number;
  nombre: string;
  email: string;
  numeroPedido: string;
  telefono: string;
  fechaCompra: string;
  producto: string;
  comentarios: string;
  createdAt: Date;
};

/**
 * Texto que escribió quien llenó el formulario, para el email que sale a la
 * dirección que puso: corto y sin links, así el formulario no sirve para
 * mandar spam desde la casilla de la tienda.
 */
function plain(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").replace(/(https?:\/\/|www\.)\S*/gi, "[link]").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Email al cliente con el código de trámite, en el momento en que manda el formulario. */
export function customerMail(s: SolicitudArrepentimiento): OutgoingMail {
  const code = tramiteCode(s.id);
  return {
    to: s.email,
    subject: `Recibimos tu solicitud de arrepentimiento (trámite ${code})`,
    text: [
      `Hola ${plain(s.nombre.split(" ")[0], 40)}:`,
      "",
      "Recibimos tu solicitud de arrepentimiento de compra.",
      "",
      `Código de trámite: ${code}`,
      `Fecha de la solicitud: ${formatDateTime(s.createdAt)}`,
      `Producto: ${plain(s.producto, 120)}`,
      `Pedido: ${plain(s.numeroPedido, 40) || "no lo indicaste"}`,
      "",
      "Guardá este código: identifica tu trámite. Te vamos a contactar dentro de las 24 horas hábiles para coordinar la devolución.",
      "",
      "Si tenés alguna duda, respondé este email.",
      "",
      "Córdoba Digital",
      "27 de Abril 180, Córdoba",
    ].join("\n"),
  };
}

/** Aviso a la casilla de la tienda con los datos de la solicitud. */
export function storeMail(s: SolicitudArrepentimiento, to: string): OutgoingMail {
  return {
    to,
    subject: `Botón de arrepentimiento ${tramiteCode(s.id)} - ${s.nombre}`,
    text: [
      `Código de trámite: ${tramiteCode(s.id)}`,
      `Nombre: ${s.nombre}`,
      `Email: ${s.email}`,
      `Pedido: ${s.numeroPedido || "No indicado"}`,
      `Teléfono: ${s.telefono}`,
      `Fecha de compra: ${s.fechaCompra}`,
      `Producto: ${s.producto}`,
      `Comentarios: ${s.comentarios || "Sin comentarios"}`,
    ].join("\n"),
  };
}
