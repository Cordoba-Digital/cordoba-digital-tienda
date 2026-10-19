# Migración del catálogo desde WooCommerce

Script: `scripts/migrate-wp.ts` (`npm run migrate:wp` → `tsx scripts/migrate-wp.ts`).

Lee el catálogo real de WooCommerce y hace upsert en Postgres (Drizzle) por `slug`.

## 1. Ya no necesita credenciales de WooCommerce

El script usa la **WC Store API pública** (`/wp-json/wc/store/v1`), que es de solo
lectura y **no requiere consumer key/secret**. Se descartaron las keys de `wc/v3`.

> `WC_CONSUMER_KEY` y `WC_CONSUMER_SECRET` **ya no se usan**. Si siguen puestas en
> `.env` / `.env.local` se pueden borrar: el script las ignora.

Un detalle operativo: el server de WordPress responde **HTTP 403 "Your browser is
outdated"** a requests sin User-Agent moderno, así que el script manda un UA de
Chrome 131 (`scripts/audit-wp.ts` usa el mismo).

## 2. Variables de entorno

| Var | Requerida | Descripción |
| --- | --------- | ----------- |
| `WC_STORE_URL` | No | URL base del WP. Default `https://www.cordobadigital.net`. |
| `DATABASE_URL` | Solo modo real | Connection string Postgres. No hace falta en `--dry-run`. |

No commitear `.env`. Copiar desde `.env.example`.

## 3. Comandos

```bash
# Solo lectura: descarga todo, mapea, imprime tabla de conteos + 10 ejemplos + huérfanos.
npm run migrate:wp -- --dry-run

# Probar con las primeras N páginas de productos (cada página son 100 productos).
npm run migrate:wp -- --dry-run --limit=2

# Migración real (upsert por slug, idempotente, errores por item sin abortar todo).
npm run migrate:wp

# Migración real + borrar de la DB lo que no existe en WP (saca el seed demo).
npm run migrate:wp -- --prune
```

Comando de la migración real completa (con prune del seed demo):

```bash
npm run migrate:wp -- --prune
```

Productos nuevos que el cliente sigue cargando en el WordPress (no toca lo que ya está en la base):

```bash
npm run migrate:wp -- --solo-nuevos --dry-run   # lista los que faltan (lee la base, no escribe)
npm run migrate:wp -- --solo-nuevos             # los da de alta con descripción, fotos, categorías, precio y stock
npm run images:migrate -- --yes                 # copia sus fotos del WordPress al almacenamiento propio
```

| Flag | Efecto |
| ---- | ------ |
| `--solo-nuevos` | Solo inserta los productos cuyo slug no existe en la base. No toca categorías ni productos existentes. Necesita `DATABASE_URL` también en `--dry-run`. No se combina con `--prune`. |
| `--dry-run` | Lee todo, no escribe nada. Imprime conteos, 10 productos mapeados y la lista de huérfanos. |
| `--prune` | Además del upsert, borra productos y categorías de la DB cuyo slug no existe en WP, y limpia los links huérfanos de `product_categories`. |
| `--limit=N` | Solo las primeras N páginas de productos (para probar rápido). |

## 4. Qué hace

1. **Descarga** categorías (`products/categories`) y productos (`products`) de la
   Store API, paginando con `per_page=100&page=N` y leyendo el total del header
   `x-wp-total`. Pool de 2 requests, `AbortSignal.timeout(30000)` y 3 reintentos
   con backoff exponencial. Un error puntual no aborta: se cuenta y se reporta al
   final. Log de progreso cada 50 productos.
2. **Marcas**: no hay tabla propia, se derivan de `products[].brands[0].name` y se
   escriben en el campo de texto `products.brand` (fallback `General`).
3. **Categorías** en 3 pasos: se insertan **padres antes que hijos**, en una pasada
   por nivel de profundidad. Después de cada pasada se resuelve el
   `Map<wpId, ourId>` con un `SELECT` y se asigna `parentId` con un `UPDATE`
   agrupado por padre (lotes). WooCommerce da el `id` del padre, nuestra tabla usa
   un id serial propio, por eso no se puede setear en el mismo `INSERT`.
4. **Productos** en lotes de 50 con `onConflictDoUpdate` target `slug`.
5. **Puente `product_categories`**: se borra y reinserta por lote de productos
   (idempotente aunque la corrida se corte a la mitad).

## 5. Campos que se migran

| Campo destino | Origen en la Store API | Nota |
| --- | --- | --- |
| `products.slug` | `slug` | 1:1, es la clave del upsert |
| `products.sku` | `sku` | |
| `products.name` | `name` | a texto plano |
| `products.brand` | `brands[0].name` | fallback `General` |
| `products.categorySlug` | categoría **más cercana a la raíz** | fallback `general` |
| `product_categories` | `categories[]` | puente N:N para el 80% multi-categoría |
| `products.price` | `prices.price` | **centavos ARS, ya en centavos** (string → int, sin ×100) |
| `products.compareAtPrice` | `prices.regular_price` | solo si `on_sale` y `regular > price` |
| `products.stock` | `is_in_stock ? 1 : 0` | la API pública no expone cantidad |
| `products.shortDescription` | `short_description` | texto plano, máx 500 chars |
| `products.description` | `description` | texto plano |
| `products.descriptionHtml` | `description` | HTML **saneado** (ver §6) |
| `products.highlights` | `<li>` de la descripción | hasta 6, de 8 a 180 chars |
| `products.images` | `images[].src` | URLs absolutas del WP viejo |
| `products.tags` | `tags[].slug` | máx 30 |
| `products.specs` | — | `[]`: la Store API no publica atributos |
| `products.badge` | derivado de `on_sale` | `"Oferta"` si el descuento supera el 5%, si no `null` |
| `products.weight` | `weight` | si viene |
| `products.dimensions` | `dimensions` | llega como objeto `{length,width,height}` → `"10x15x10 cm"` |
| `products.wpId` | `id` | |
| `products.seoTitle` / `seoDescription` | — | `null`: Rank Math no está expuesto en la Store API |
| `products.rating` / `reviewCount` / `soldCount` | — | `48` / `0` / `0` (WP no tiene ratings) |
| `products.featured` / `freeShipping` / `warrantyMonths` | — | `false` / `false` / `12` |
| `categories.slug` / `name` | `slug` / `name` | |
| `categories.parentId` | `parent` | árbol real de 3 niveles |
| `categories.descriptionHtml` | `description` | HTML saneado |
| `categories.tagline` | `description` | texto plano, máx 200 chars |
| `categories.imageUrl` | `image.src` | |
| `categories.sortOrder` | derivado | por profundidad y luego por `count` descendente |
| `categories.icon` | — | `📦` (WP no tiene iconos) |
| `categories.wpId` | `id` | |

## 6. Saneo de HTML

El script trae su propio sanitizador (no se agregó ninguna dependencia). Deja pasar
solo estos tags:

`p, br, strong, b, em, i, u, ul, ol, li, h2, h3, h4, h5, h6, a[href], img[src|alt], table, thead, tbody, tr, th, td, blockquote, span`

Y descarta: `<script>`, `<style>`, `<iframe>`, `<noscript>`, `<object>`, `<embed>`,
`<form>`, `<svg>`, `<math>` (con todo su contenido), todo atributo `on*`, el
`style` inline, `class`, `id`, `data-*` y cualquier `href`/`src` con esquema
`javascript:`, `vbscript:` o `data:`. Los tags no permitidos se desenvuelven (se
conserva el texto interno). Las entidades numéricas no ASCII (`&#8211;`, `&#8217;`,
`&#8243;`…) se convierten a su carácter.

## 7. Imágenes: se sirven desde el WP viejo

Las URLs de `products.images` y `categories.imageUrl` apuntan a
`wp-content/uploads/...` del WordPress original y se renderizan con `next/image`.
Por eso:

- El WordPress viejo tiene que seguir online hasta el corte.
- `next.config.ts` necesita `remotePatterns` para el host de `wp-content`.
- No se copiaron binarios al repo.

## 8. Redirects SEO pendientes

El WP original sirve fichas en `/producto/:slug`; Next usa `/producto/[slug]`.
Si los slugs se conservaron, agregar en `next.config.ts` (o middleware) redirects 1:1, ej.:

```ts
// next.config.ts
async redirects() {
  return [
    // Si el origen era /producto/:slug y el destino es idéntico, no hace falta nada.
    // Si el origen era /product/:slug (inglés) o con prefijo de categoría:
    { source: "/product/:slug", destination: "/producto/:slug", permanent: true },
    // Agregar acá mapeos manuales para slugs que cambiaron en la migración.
  ];
}
```

Pendiente: relevar en WP los slugs con mejor tráfico (Search Console) y verificar
que existan en Next; para los que no coincidan, agregar redirect 301 explícito
fuente → destino.

## 9. Notas

- El catálogo es 100% de productos simples (0 variables, 0 con atributos), así que
  la migración es 1:1 sin motor de variantes.
- Como la Store API no expone `stock_quantity`, el stock se migra como 1/0 según
  `is_in_stock`. Si en el futuro se necesita cantidad real, hay que volver a una
  API autenticada.
- Para el inventario completo del catálogo (árbol de categorías, marcas, muestra de
  precios y diff contra los sitemaps) ver `docs/CATALOGO-WP.md`
  (`npm run audit:wp`).
