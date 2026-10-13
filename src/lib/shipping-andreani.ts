import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { andreaniConfigurado, AndreaniError, cotizacionEnCache, cotizar, type ProductoCotizacion } from "@/lib/andreani";
import { medidasDeEnvio } from "@/lib/andreani-paquete";
import { ANDREANI_LIMIT, blockedMinutes, recordMiss } from "@/lib/rate-limit";
import type { PreciosAndreani } from "@/lib/shipping";

export type ItemCarrito = { slug: string; quantity: number };

/** Tope de unidades por cotización, igual que el del checkout. */
const MAX_UNIDADES = 99;

/**
 * Productos del carrito listos para cotizar, o null si alguno no tiene medidas
 * cargadas (en ese caso no se puede pedir precio a Andreani y se usa la
 * tarifa fija por zona).
 */
export async function productosParaAndreani(items: ItemCarrito[]): Promise<ProductoCotizacion[] | null> {
  const limpios = items
    .filter((i) => typeof i?.slug === "string" && i.slug)
    .map((i) => ({ slug: i.slug, quantity: Math.max(1, Math.min(MAX_UNIDADES, Math.floor(Number(i.quantity) || 1))) }));
  if (!limpios.length) return null;

  const filas = await db
    .select({ slug: products.slug, price: products.price, weight: products.weight, dimensions: products.dimensions })
    .from(products)
    .where(inArray(products.slug, limpios.map((i) => i.slug)));
  const porSlug = new Map(filas.map((f) => [f.slug, f]));

  const resultado: ProductoCotizacion[] = [];
  for (const item of limpios) {
    const fila = porSlug.get(item.slug);
    const medidas = fila ? medidasDeEnvio(fila) : null;
    if (!fila || !medidas) return null;
    resultado.push({ cantidad: item.quantity, precio: fila.price, ...medidas });
  }
  return resultado;
}

/** Motivo para el log: el mensaje propio de Andreani, o el tipo de error si es otra cosa. */
export function motivoDeError(error: unknown): string {
  if (error instanceof AndreaniError) return error.message;
  if (error instanceof Error) return `error inesperado (${error.name}: ${error.message.slice(0, 120)})`;
  return "error inesperado";
}

/**
 * Cuenta una llamada nueva a Andreani contra el límite por IP. Si la base no
 * responde deja pasar: el límite protege la credencial, no vale cortar los
 * envíos por eso.
 */
export async function consultaAndreaniPermitida(ip: string): Promise<boolean> {
  try {
    if (await blockedMinutes(ANDREANI_LIMIT, ip)) return false;
    await recordMiss(ANDREANI_LIMIT, ip);
  } catch (error) {
    console.warn("[andreani] no se pudo revisar el límite por IP:", motivoDeError(error));
  }
  return true;
}

/**
 * Precios de Andreani para el carrito, o `{}` si no se pueden obtener (sin
 * credencial, productos sin medidas o Andreani caído). Nunca tira: el checkout
 * sigue funcionando con la tarifa fija.
 */
export async function preciosAndreani(cp: string, items: ItemCarrito[], ip?: string): Promise<PreciosAndreani> {
  if (!andreaniConfigurado() || cp.length !== 4) return {};
  try {
    const productos = await productosParaAndreani(items);
    if (!productos) return {};
    // Con IP (la ruta pública de cotización) se limita cuántas llamadas nuevas
    // a Andreani puede generar cada visitante. Lo que ya está en caché no cuenta.
    if (ip && !cotizacionEnCache(cp, productos) && !(await consultaAndreaniPermitida(ip))) return {};
    const cotizacion = await cotizar(cp, productos);
    return { estandar: cotizacion.domicilio, sucursal: cotizacion.sucursal };
  } catch (error) {
    console.warn("[andreani] cotización no disponible, se usa la tarifa fija:", motivoDeError(error));
    return {};
  }
}
