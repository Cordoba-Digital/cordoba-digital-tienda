import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products, type EnvioAndreani, type ShippingAddress } from "@/db/schema";
import {
  altaEnvio,
  AndreaniError,
  envioEntregado,
  estadosDeEnvio,
  sucursales,
  type Modalidad,
  type ProductoCotizacion,
} from "@/lib/andreani";
import { medidasDeEnvio } from "@/lib/andreani-paquete";
import { applyOrderStatus, canTransition } from "@/lib/order-status";

/** Email del local que Andreani usa para avisos del envío. */
const EMAIL_COMERCIO = "consultas@cordobadigital.net";

function modalidadDelPedido(deliveryMethod: string): Modalidad | null {
  if (deliveryMethod === "standard") return "domicilio";
  if (deliveryMethod === "express") return "sucursal";
  return null;
}

/** "Juan Pérez García" → nombre "Juan", apellido "Pérez García". */
function separarNombre(completo: string): { nombre: string; apellido: string } {
  const partes = completo.trim().split(/\s+/);
  const nombre = partes.shift() ?? "";
  return { nombre, apellido: partes.join(" ") || nombre };
}

export type ResultadoAlta = { ok: true; envio: EnvioAndreani } | { ok: false; error: string; status: number };

/**
 * Da de alta en Andreani el envío de un pedido. Lo usa el botón "Crear envío
 * en Andreani" del panel. Un pedido tiene a lo sumo un envío: antes de llamar a
 * Andreani se reserva el pedido con un update condicional, así dos clics
 * seguidos no generan dos envíos.
 */
export async function crearEnvioDePedido(code: string, sucursalElegida = ""): Promise<ResultadoAlta> {
  const [order] = await db.select().from(orders).where(eq(orders.code, code)).limit(1);
  if (!order) return { ok: false, error: "No encontramos un pedido con ese código.", status: 404 };
  if (order.andreani?.pedidoId) return { ok: false, error: "Este pedido ya tiene un envío en Andreani.", status: 409 };
  if (order.status === "pendiente_pago" || order.status === "cancelado") {
    return { ok: false, error: "El envío se crea cuando el pago está acreditado.", status: 400 };
  }
  const modalidad = modalidadDelPedido(order.deliveryMethod);
  if (!modalidad || !order.address) {
    return { ok: false, error: "Este pedido es para retirar en el local, no lleva envío.", status: 400 };
  }

  const address: ShippingAddress = { ...order.address };
  if (modalidad === "sucursal" && !address.sucursal?.codigo) {
    if (!sucursalElegida) return { ok: false, error: "Elegí la sucursal de Andreani donde retira el cliente.", status: 400 };
    const sucursal = (await sucursales(address.zip)).find((s) => s.codigo === sucursalElegida);
    if (!sucursal) return { ok: false, error: "Esa sucursal no figura en Andreani para el código postal del pedido.", status: 400 };
    address.sucursal = {
      codigo: sucursal.codigo,
      nombre: sucursal.nombre,
      direccion: [sucursal.direccion, sucursal.localidad].filter(Boolean).join(", "),
    };
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const filas = await db
    .select({ slug: products.slug, name: products.name, weight: products.weight, dimensions: products.dimensions })
    .from(products)
    .where(inArray(products.slug, items.map((i) => i.productSlug)));
  const porSlug = new Map(filas.map((f) => [f.slug, f]));
  const productos: ProductoCotizacion[] = [];
  for (const item of items) {
    const fila = porSlug.get(item.productSlug);
    const medidas = fila ? medidasDeEnvio(fila) : null;
    if (!medidas) {
      return {
        ok: false,
        error: `"${item.name}" no tiene las medidas del paquete cargadas. Cargalas en el producto (largo × ancho × alto en cm) y probá de nuevo.`,
        status: 400,
      };
    }
    productos.push({ cantidad: item.quantity, precio: item.unitPrice, ...medidas });
  }

  // Reserva: solo un pedido sin envío pasa a "creando".
  const ahora = new Date().toISOString();
  const reserva: EnvioAndreani = { pedidoId: "", numeroInterno: "", modalidad, estado: "creando", creadoEn: ahora, actualizadoEn: ahora };
  const reservado = await db
    .update(orders)
    .set({ andreani: reserva })
    .where(and(eq(orders.id, order.id), isNull(orders.andreani)))
    .returning({ id: orders.id });
  if (!reservado.length) {
    return { ok: false, error: "Este pedido ya tiene un envío en Andreani (o se está creando).", status: 409 };
  }

  const { nombre, apellido } = separarNombre(order.customerName);
  try {
    const alta = await altaEnvio({
      remito: order.code,
      modalidad,
      costo: order.shippingCost,
      destino: {
        calle: address.street,
        numero: address.number,
        piso: address.extra,
        cp: address.zip,
        localidad: address.city,
        sucursal: address.sucursal?.codigo ?? "",
      },
      destinatario: { nombre, apellido, telefono: order.phone, dni: order.docId, email: order.email },
      productos,
      emailComercio: EMAIL_COMERCIO,
    });
    const envio: EnvioAndreani = { ...reserva, pedidoId: alta.pedidoId, numeroInterno: alta.numeroInterno, estado: "" };
    await db.update(orders).set({ andreani: envio, address }).where(eq(orders.id, order.id));
    // Queda en el historial del pedido. Si justo cambió de estado, el envío ya
    // está guardado igual y solo se pierde la nota.
    await applyOrderStatus(order.id, {
      from: order.status,
      to: order.status,
      note: `Envío creado en Andreani (pedido ${alta.pedidoId}). Falta pagarlo en el portal de PyMEs.`,
    });
    return { ok: true, envio };
  } catch (error) {
    // El alta falló: se libera la reserva para poder reintentar. Si Andreani
    // llegó a crearlo pero la respuesta se perdió, el reintento puede
    // duplicarlo; por eso el panel avisa que se revise el portal antes.
    await db.update(orders).set({ andreani: null }).where(eq(orders.id, order.id));
    const mensaje = error instanceof AndreaniError ? error.message : "Error inesperado al crear el envío.";
    // Sin el mensaje: Andreani puede repetir ahí datos del destinatario.
    console.error("[andreani] alta de envío fallida", order.code, error instanceof AndreaniError ? error.status : "sin estado");
    return { ok: false, error: mensaje, status: 502 };
  }
}

/**
 * Trae de Andreani el número de seguimiento y el estado de los envíos
 * creados, y los guarda. Si Andreani informa "entregado", el pedido pasa a
 * Entregado. Sin argumentos revisa todos los envíos que no se entregaron.
 */
export async function sincronizarEnvios(codigos?: string[]): Promise<{ revisados: number; actualizados: number }> {
  const filtros = [isNotNull(orders.andreani), sql`coalesce(${orders.andreani}->>'pedidoId', '') <> ''`];
  if (codigos?.length) filtros.push(inArray(orders.code, codigos));
  else filtros.push(notInArray(orders.status, ["entregado", "cancelado"]));
  const pendientes = await db.select().from(orders).where(and(...filtros)).limit(100);
  if (!pendientes.length) return { revisados: 0, actualizados: 0 };

  const estados = await estadosDeEnvio(pendientes.map((o) => o.code));
  const porPedido = new Map(estados.map((e) => [e.pedido, e]));
  let actualizados = 0;
  for (const order of pendientes) {
    const info = porPedido.get(order.code);
    const envio = order.andreani;
    if (!info || !envio) continue;
    const seguimiento = info.seguimiento || order.trackingCode;
    if (seguimiento === order.trackingCode && info.estado === envio.estado) continue;

    const nuevoEnvio: EnvioAndreani = { ...envio, estado: info.estado, actualizadoEn: new Date().toISOString() };
    const entregado = envioEntregado(info.estado) && !canTransition(order.status, "entregado") && order.status !== "cancelado";
    const notas = [
      seguimiento !== order.trackingCode ? `Andreani asignó el número de seguimiento ${seguimiento}.` : "",
      info.estado !== envio.estado && info.estado ? `Estado en Andreani: ${info.estado}.` : "",
    ].filter(Boolean);
    const aplicado = await applyOrderStatus(order.id, {
      from: order.status,
      to: entregado ? "entregado" : order.status,
      note: notas.join(" "),
      extra: { andreani: nuevoEnvio, trackingCode: seguimiento },
    });
    if (aplicado) actualizados += 1;
  }
  return { revisados: pendientes.length, actualizados };
}
