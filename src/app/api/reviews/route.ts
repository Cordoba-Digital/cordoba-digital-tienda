import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products, reviews } from "@/db/schema";
import { blockedMinutes, ipFromHeaders, recordMiss, REVIEW_LIMIT, tooManyAttempts } from "@/lib/rate-limit";
import { isPaidStatus } from "@/lib/payment-rules";
import { refreshStorePages } from "@/lib/store-cache";

export const dynamic = "force-dynamic";

/**
 * Solo pueden opinar quienes compraron el producto: el pedido tiene que
 * existir, coincidir con el email, estar pago y contener ese producto. Antes
 * cualquiera podía publicar sin pedido y la reseña sumaba al promedio y al
 * AggregateRating del JSON-LD (Google lo considera reseñas autogeneradas).
 */

/**
 * Crea `order_id` y sus índices si faltan, así el despliegue no depende de
 * correr las migraciones a mano. Es idempotente y corre una vez por instancia; las
 * filas viejas quedan con `order_id` null y no chocan con el índice único.
 */
let schemaReady: Promise<void> | null = null;
function ensureReviewsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`alter table reviews add column if not exists order_id integer`);
      await db.execute(sql`alter table reviews alter column verified set default false`);
      await db.execute(
        sql`create unique index if not exists reviews_order_product_idx on reviews (order_id, product_slug)`,
      );
      await db.execute(sql`create index if not exists reviews_product_idx on reviews (product_slug)`);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    author?: string;
    rating?: number;
    title?: string;
    body?: string;
    orderCode?: string;
    email?: string;
  };

  const slug = (body.slug ?? "").trim();
  const author = (body.author ?? "").trim().slice(0, 60);
  const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating ?? 5))));
  const text = (body.body ?? "").trim().slice(0, 600);
  const orderCode = (body.orderCode ?? "").trim().toUpperCase();
  const email = (body.email ?? "").trim().toLowerCase();

  if (!slug || author.length < 2 || text.length < 10) {
    return Response.json({ ok: false, error: "Completá tu nombre y una opinión de al menos 10 caracteres." }, { status: 400 });
  }
  if (!orderCode || !email) {
    return Response.json({ ok: false, error: "Ingresá el número de pedido y el email con el que compraste." }, { status: 400 });
  }

  await ensureReviewsSchema();

  const [product] = await db.select({ slug: products.slug }).from(products).where(eq(products.slug, slug)).limit(1);
  if (!product) return Response.json({ ok: false, error: "Producto inexistente" }, { status: 404 });

  const ip = ipFromHeaders(request.headers);
  const blocked = await blockedMinutes(REVIEW_LIMIT, ip);
  if (blocked) return tooManyAttempts(blocked);

  // Mismo mensaje para "no existe" y "email distinto": no revela qué códigos son válidos.
  const [order] = await db
    .select({ id: orders.id, email: orders.email, status: orders.status })
    .from(orders)
    .where(eq(orders.code, orderCode))
    .limit(1);
  if (!order || order.email.trim().toLowerCase() !== email) {
    await recordMiss(REVIEW_LIMIT, ip);
    return Response.json({ ok: false, error: "No encontramos un pedido con ese número y email." }, { status: 403 });
  }

  const [item] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), eq(orderItems.productSlug, slug)))
    .limit(1);
  if (!item) {
    return Response.json({ ok: false, error: "Ese pedido no incluye este producto." }, { status: 403 });
  }
  if (!isPaidStatus(order.status)) {
    return Response.json({ ok: false, error: "Vas a poder opinar cuando se acredite el pago del pedido." }, { status: 403 });
  }

  const inserted = await db
    .insert(reviews)
    .values({
      productSlug: slug,
      orderId: order.id,
      author,
      rating,
      title: (body.title ?? "").trim().slice(0, 90),
      body: text,
      verified: true,
    })
    .onConflictDoNothing()
    .returning({ id: reviews.id });
  if (!inserted.length) {
    return Response.json({ ok: false, error: "Ya dejaste una opinión de este producto para ese pedido." }, { status: 409 });
  }

  // Se recalcula desde las reseñas verificadas en vez de sumar sobre el valor
  // guardado: así el promedio de la tarjeta nunca arrastra conteos viejos.
  const [stats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      avg10: sql<number>`round(avg(${reviews.rating}) * 10)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.productSlug, slug), eq(reviews.verified, true)));

  await db
    .update(products)
    .set({ reviewCount: stats.count, rating: stats.avg10 })
    .where(eq(products.slug, slug));

  // La ficha está en caché: se regenera para que la opinión aparezca al refrescar.
  refreshStorePages([slug]);
  return Response.json({ ok: true });
}
