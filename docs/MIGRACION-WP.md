# Migración del catálogo desde WooCommerce

Script: `scripts/migrate-wp.ts` (comando `npm run migrate:wp` → `tsx scripts/migrate-wp.ts`).
Lee categorías y productos de WooCommerce y hace upsert en Postgres (Drizzle) por `slug`.

## 1. Variables de entorno

| Var | Requerida | Descripción |
| --- | --------- | ----------- |
| `WC_STORE_URL` | Sí (siempre) | URL base del WP, ej. `https://mitienda.com.ar` (sin `/` final). |
| `WC_CONSUMER_KEY` | Sí (siempre) | Consumer Key de la REST API. |
| `WC_CONSUMER_SECRET` | Sí (siempre) | Consumer Secret de la REST API. |
| `DATABASE_URL` | Solo modo real | Connection string Postgres. No se necesita en `--dry-run`. |

No commitear `.env`. Copiar desde `.env.example` y agregar las `WC_*` en local.

## 2. Cómo generar las keys en WooCommerce

1. En WP Admin: **WooCommerce > Ajustes > Avanzado > API REST** (en versiones nuevas: **WooCommerce > Ajustes > Avanzado > REST API**).
2. **Añadir clave** → usuario admin, permisos **Lectura** (alcanza para migrar), descripción p. ej. `migracion-next`.
3. **Generar** y copiar `Consumer Key` y `Consumer Secret` (el secret no se vuelve a mostrar).
4. Probar: `GET {store}/wp-json/wc/v3/products?per_page=1&consumer_key=...&consumer_secret=...` debe devolver 200.

## 3. Comandos

```bash
# Solo lectura: pagina categorías y productos, mapea y lista conteos. No escribe.
npm run migrate:wp -- --dry-run

# Migración real (upsert por slug, idempotente, errores por item sin abortar todo)
npm run migrate:wp
```

El script pagina `GET {store}/wp-json/wc/v3/categories` y `/products` con `per_page=100` y
`consumer_key`/`consumer_secret` como query params, convierte precios string a centavos ARS
(`Math.round(parseFloat * 100)`), limpia HTML y hace `onConflictDoUpdate` sobre `slug`.

## 4. Redirects SEO pendientes

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

Pendiente: relevar en WP los slugs con mejor tráfico (Search Console) y verificar que existan
en Next; para los que no coincidan, agregar redirect 301 explícito fuente → destino.
