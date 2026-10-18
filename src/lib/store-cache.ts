import { revalidatePath } from "next/cache";
import { connection } from "next/server";

import { pool } from "@/db";

/**
 * La home y las fichas de producto quedan en la caché del CDN de Vercel
 * (`revalidate` en cada página) y se regeneran solas cada pocos minutos. Cuando
 * el panel cambia algo que se ve ahí (precio, stock, fotos, la home), se piden
 * de nuevo en el acto para que el cambio aparezca sin esperar.
 */
export function refreshStorePages(slugs: (string | null | undefined)[] = []): void {
  try {
    revalidatePath("/");
    for (const slug of new Set(slugs)) {
      if (slug) revalidatePath(`/producto/${slug}`);
    }
  } catch (error) {
    // Fuera de un pedido de Next (tests, scripts) no hay caché que refrescar.
    if (process.env.NODE_ENV === "production") console.warn("[cache] no se pudo refrescar la tienda:", error);
  }
}

/**
 * Como `refreshStorePages`, pero para algo del header o del pie, que se ve en
 * todas las páginas: invalida el layout entero y no solo la home.
 */
export function refreshWholeStore(): void {
  try {
    revalidatePath("/", "layout");
  } catch (error) {
    if (process.env.NODE_ENV === "production") console.warn("[cache] no se pudo refrescar la tienda:", error);
  }
}

/**
 * Las páginas en caché se arman también durante el build. En Vercel la base
 * responde y la página sale prearmada; en el CI (o si la base no contesta en
 * ese momento) la página pasa a armarse en cada visita en vez de romper el
 * build. Solo hace algo durante `next build`.
 */
export async function renderPerRequestIfNoDatabase(): Promise<void> {
  if (process.env.NEXT_PHASE !== "phase-production-build") return;
  try {
    await pool.query("select 1");
  } catch {
    await connection();
  }
}
