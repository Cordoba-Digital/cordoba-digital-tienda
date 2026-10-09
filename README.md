# Córdoba Digital — tienda Next.js

Reemplazo moderno de `cordobadigital.net` (WooCommerce) con checkout real.

## Requisitos

- Node 20+
- Postgres local o `DATABASE_URL` (Neon/Supabase para Vercel)

## Puesta en marcha

```bash
npm install
cp .env.example .env   # completar DATABASE_URL + MP_* + GOOGLE_*
npm run db:push
npm run dev
```

Abrir `http://localhost:3000`.

## Catálogo

El catálogo es el **real de WooCommerce** (2588 productos, 128 categorías en 3
niveles), migrado a Postgres. No hace falta el seed demo.

```bash
npm run audit:wp                        # inventario de WooCommerce -> docs/CATALOGO-WP.md
npm run migrate:wp -- --dry-run         # lee y muestra el mapeo, no escribe
npm run migrate:wp -- --prune           # migra y borra lo que no está en WP
npm run verify:wp                       # compara la base contra WooCommerce
```

- Fuente: **WC Store API pública** (`/wp-json/wc/store/v1`): sin credenciales.
- Las imágenes se sirven desde el servidor viejo de WordPress (`wp-content`).
- Las páginas de categoría son `/categoria/<padre>/<hijo>/...` y las URLs viejas
  de WooCommerce redirigen con 308. Ver `docs/MIGRACION-WP.md` y `docs/CATALOGO-WP.md`.

## Scripts

- `npm run dev` — desarrollo
- `npm run build` / `npm start` — producción
- `npm run db:push` — aplica el schema (`drizzle-kit push`)
- `npm run audit:wp` / `migrate:wp` / `verify:wp` — ciclo del catálogo
- `npm run typecheck` / `npm run lint`

## Pagos

- Transferencia/efectivo/retiro: flujo interno, estado `pendiente_pago`.
- Mercado Pago Checkout Pro: crea preferencia (`/api/checkout/mercadopago`),
  redirige a `init_point`, confirma por webhook (`/api/webhooks/mercadopago`)
  con validación HMAC `x-signature`. Nunca `sandbox_init_point`.
- Tarjeta directa: se procesa vía Mercado Pago (no se guardan datos de tarjeta).

## Google (Merchant Center, Analytics, Search Console)

- **Feed de Merchant Center**: `/products.xml` (RSS 2.0 con atributos `g:`), se
  arma en cada pedido desde la base. En Merchant Center: Productos > Fuentes de
  datos > Agregar feed > URL `https://<dominio>/products.xml`, descarga diaria.
  Quedan afuera los productos sin precio o sin foto.
- **GA4**: variable `GA_MEASUREMENT_ID` (`G-XXXXXXXX`). Sin ella no se carga
  ningún script. Envía páginas vistas y los eventos `view_item`,
  `add_to_cart`, `begin_checkout` y `purchase` (`src/lib/analytics.ts`).
- **Search Console**: variable `GOOGLE_SITE_VERIFICATION` con el código de la
  meta `google-site-verification` (varios códigos separados por coma).

## Estructura

- `src/app` — páginas + API routes (`/categoria/[...path]` para el árbol de categorías)
- `src/components` — UI (checkout en `checkout-flow.tsx`)
- `src/lib` — precios, envíos, queries, árbol de categorías (`category-tree.ts`)
- `src/db` — schema Drizzle (`categories` con `parentId`, puente `product_categories`)
- `scripts` — ciclo del catálogo (`audit-wp`, `migrate-wp`, `verify-catalog`)
- `public/images` — logo + assets
- `docs` — plan cerrado, inventario del catálogo y guías
