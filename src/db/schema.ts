import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type Spec = { label: string; value: string };

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("📦"),
    tagline: text("tagline").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    // Jerarquía real de WooCommerce (3 niveles). Null = categoría raíz.
    parentId: integer("parent_id"),
    descriptionHtml: text("description_html").notNull().default(""),
    imageUrl: text("image_url"),
    wpId: integer("wp_id"),
  },
  (table) => [
    index("categories_parent_idx").on(table.parentId),
    index("categories_sort_idx").on(table.sortOrder),
  ],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    sku: text("sku").notNull().default(""),
    name: text("name").notNull(),
    brand: text("brand").notNull(),
    // Categoría principal (raíz más cercana). El resto vive en productCategories.
    categorySlug: text("category_slug").notNull(),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),
    // Descripción original de WooCommerce, saneada.
    descriptionHtml: text("description_html").notNull().default(""),
    // prices stored as whole ARS pesos (WooCommerce sends integers, not cents)
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    stock: integer("stock").notNull().default(0),
    rating: integer("rating").notNull().default(48), // rating * 10
    reviewCount: integer("review_count").notNull().default(0),
    soldCount: integer("sold_count").notNull().default(0),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    /**
     * Un `srcset` por cada entrada de `images`, en el mismo orden.
     *
     * Antes era un solo array plano con las variantes de todas las fotos
     * revueltas, y la galería pasaba ese mismo array a cada miniatura: el
     * navegador elegía por ancho una variante que podía ser de otra foto, así
     * que todas las miniaturas mostraban la misma imagen. Un srcset por foto
     * evita que se mezclen.
     *
     * Necesario porque el optimizador de Vercel está bloqueado en este
     * proyecto (`unoptimized: true`) y se sirven los archivos originales.
     */
    imageSrcSets: jsonb("image_srcsets").$type<string[][]>().notNull().default([]),
    /** @deprecated Usar `imageSrcSets`; esta columna quedó sin uso tras el fix. */
    imageSrcSet: jsonb("image_srcset").$type<string[]>().notNull().default([]),
    highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
    specs: jsonb("specs").$type<Spec[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    badge: text("badge"),
    featured: boolean("featured").notNull().default(false),
    freeShipping: boolean("free_shipping").notNull().default(false),
    /**
     * Garantía legal en meses. La API pública de WooCommerce NO expone la
     * garantía, así que este valor no viene del sitio original: es el plazo que
     * dice la política de garantía de Córdoba Digital ("garantía legal de seis
     * (6) meses a partir de la entrega", Ley 24.240). Antes estaba en 12, que
     * no figuraba en ningún lado.
     */
    warrantyMonths: integer("warranty_months").notNull().default(6),
    weight: text("weight"),
    dimensions: text("dimensions"),
    /**
     * Ficha estructurada (AI Commerce): modelo, memoria, RAM, estado y liberado
     * como columnas propias —no texto libre— para que sean filtrables, salgan en
     * la tabla de specs y alimenten el futuro feed de Shopping.
     */
    model: text("model").notNull().default(""),
    storage: text("storage").notNull().default(""),
    ram: text("ram").notNull().default(""),
    condition: text("condition").notNull().default("Nuevo"),
    isUnlocked: boolean("is_unlocked").notNull().default(true),
    /**
     * Origen de la fila: `wp` (migración WooCommerce) o `manual` (alta desde el
     * admin). El prune de `migrate-wp` solo borra `origin = 'wp'` y el upsert
     * no pisa los campos de una fila manual.
     */
    origin: text("origin").notNull().default("wp"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    wpId: integer("wp_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_category_idx").on(table.categorySlug),
    index("products_brand_idx").on(table.brand),
    index("products_price_idx").on(table.price),
    index("products_featured_idx").on(table.featured),
  ],
);

/** Puente N:N: el 80% del catálogo de WooCommerce está en más de una categoría. */
export const productCategories = pgTable(
  "product_categories",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull(),
    categoryId: integer("category_id").notNull(),
  },
  (table) => [
    uniqueIndex("product_categories_unique_idx").on(table.productId, table.categoryId),
    index("product_categories_category_idx").on(table.categoryId),
  ],
);

/**
 * Reseñas de producto. Solo se aceptan con un pedido pago que incluya el
 * producto (`/api/reviews`), y solo las `verified` cuentan para el promedio y
 * el AggregateRating. `orderId` es null en las filas anteriores a ese cambio;
 * el índice único deja una sola reseña por pedido y producto.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    productSlug: text("product_slug").notNull(),
    orderId: integer("order_id"),
    author: text("author").notNull(),
    rating: integer("rating").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reviews_order_product_idx").on(table.orderId, table.productSlug),
    index("reviews_product_idx").on(table.productSlug),
  ],
);

export const coupons = pgTable("coupons", {
  code: text("code").primaryKey(),
  kind: text("kind").notNull(), // percent | fixed
  value: integer("value").notNull(), // percent points or ARS pesos
  minSubtotal: integer("min_subtotal").notNull().default(0),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
});

/**
 * Guías de compra: los artículos de blog que el sitio original publica y que
 * el pie enlaza ("Cómo elegir tu próxima impresora", etc.).
 *
 * El `slug` es la URL del artículo en el sitio viejo, sin cambio: la idea es
 * que las guías conserven la dirección que ya está indexada en Google.
 *
 * `body` es HTML ya saneado por `scripts/lib/guia-html.mjs`: lista blanca de
 * etiquetas, sin atributos salvo `href`, y sin los `<style>`/`<script>` que
 * venían pegados dentro del contenido de cada artículo. La página lo pinta con
 * `dangerouslySetInnerHTML`, así que el saneador es la única barrera.
 */
export const guides = pgTable(
  "guides",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    description: text("description").notNull().default(""),
    body: text("body").notNull(),
    wordCount: integer("word_count").notNull().default(0),
    /** Orden en el pie. El original los lista en este orden. */
    footerOrder: integer("footer_order").notNull().default(0),
    /**
     * Lo que los autores escribieron arriba del artículo, ya separado del
     * cuerpo: etiqueta ("GUÍA DEFINITIVA 2026"), actualizacion, cobertura y la
     * ruta interna de la categoría. Se muestra en la cabecera de la página.
     */
    meta: jsonb("meta").$type<{
      etiqueta?: string;
      actualizacion?: string;
      cobertura?: string;
      categoria?: string;
    }>().notNull().default({}),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("guides_slug_idx").on(table.slug),
    index("guides_footer_order_idx").on(table.footerOrder),
  ],
);

export type ShippingAddress = {
  street: string;
  number: string;
  extra: string;
  city: string;
  province: string;
  zip: string;
};

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    status: text("status").notNull().default("pendiente_pago"),
    customerName: text("customer_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    docId: text("doc_id").notNull().default(""),
    deliveryMethod: text("delivery_method").notNull(), // pickup | standard | express
    deliveryLabel: text("delivery_label").notNull().default(""),
    deliveryEta: text("delivery_eta").notNull().default(""),
    address: jsonb("address").$type<ShippingAddress | null>(),
    paymentMethod: text("payment_method").notNull(), // transferencia | tarjeta | mercadopago | efectivo
    paymentLabel: text("payment_label").notNull().default(""),
    installments: integer("installments").notNull().default(1),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    paymentAdjustment: integer("payment_adjustment").notNull().default(0),
    shippingCost: integer("shipping_cost").notNull().default(0),
    total: integer("total").notNull(),
    couponCode: text("coupon_code"),
    notes: text("notes").notNull().default(""),
    mercadopagoPreferenceId: text("mercadopago_preference_id"),
    mercadopagoPaymentId: text("mercadopago_payment_id"),
    trackingCode: text("tracking_code").notNull().default(""),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_code_idx").on(table.code),
    // "Mi cuenta" y el panel de usuarios buscan pedidos por email sin mayúsculas.
    index("orders_email_lower_idx").on(sql`lower(${table.email})`),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull(),
    fromStatus: text("from_status").notNull().default(""),
    toStatus: text("to_status").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_events_order_idx").on(table.orderId)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull(),
    productSlug: text("product_slug").notNull(),
    name: text("name").notNull(),
    image: text("image").notNull().default(""),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    /**
     * Unidades que este ítem descontó del stock al comprarse (0 cuando el stock
     * era solo disponibilidad 1/0). Es lo que se devuelve si el pedido se cancela.
     * La columna la crea `ensureOrderStockSchema` al primer uso.
     */
    stockReserved: integer("stock_reserved").notNull().default(0),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Clientes con cuenta (login con Google). El pedido invitado sigue existiendo:
 * al registrarse con el mismo email, el historial muestra también los pedidos
 * viejos por match de email (ver `getOrdersByEmail`).
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    googleSub: text("google_sub").notNull().unique(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    avatarUrl: text("avatar_url").notNull().default(""),
    isDisabled: boolean("is_disabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

/**
 * Sesiones de clientes. Se guarda el hash SHA-256 del token (la cookie lleva
 * el token crudo): si la base se filtra, las sesiones no sirven sin más.
 */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("user_sessions_user_idx").on(table.userId)],
);

export const arrepentimientoRequests = pgTable(
  "arrepentimiento_requests",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    email: text("email").notNull(),
    numeroPedido: text("numero_pedido").notNull().default(""),
    telefono: text("telefono").notNull(),
    fechaCompra: text("fecha_compra").notNull(),
    producto: text("producto").notNull(),
    comentarios: text("comentarios").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ProductCategory = typeof productCategories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type ArrepentimientoRequest = typeof arrepentimientoRequests.$inferSelect;
