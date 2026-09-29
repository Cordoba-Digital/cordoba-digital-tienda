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

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productSlug: text("product_slug").notNull(),
  author: text("author").notNull(),
  rating: integer("rating").notNull(),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  verified: boolean("verified").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coupons = pgTable("coupons", {
  code: text("code").primaryKey(),
  kind: text("kind").notNull(), // percent | fixed
  value: integer("value").notNull(), // percent points or ARS pesos
  minSubtotal: integer("min_subtotal").notNull().default(0),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
});

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("orders_code_idx").on(table.code)],
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productSlug: text("product_slug").notNull(),
  name: text("name").notNull(),
  image: text("image").notNull().default(""),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
});

export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ProductCategory = typeof productCategories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
