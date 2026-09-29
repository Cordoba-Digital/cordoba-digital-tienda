# Plan cerrado — Córdoba Digital

## Decidido

- País: **AR** (MLA, ARS, es). SDK: **node** (package.json). Cliente: **react** (Next.js).
- Pagos: **Mercado Pago Checkout Pro** (`Preferences API`, `mode=preferences`, `init_point`).
  Sin `sandbox_init_point`, sin `auto_return` en localhost, `external_reference` = código de orden.
- Webhook HMAC-SHA256 (`x-signature` + `x-request-id`), responde 200 inmediato, idempotente.
- Catálogo: **migrar real desde WooCommerce** (`cordobadigital.net`), no seed demo.
- Deploy: **Vercel preview** (no producción hasta validar).

## Estado (28/09/2026)

- [x] Fase 0 — carpeta organizada, `lint` + `tsc` en verde.
- [x] Fase 1 — MP Checkout Pro esqueleto (preferencia, webhook HMAC, CTA).
  Bloqueado para prueba real: falta `MP_ACCESS_TOKEN` (pestaña Prueba) y `MP_WEBHOOK_SECRET`.
- [x] Fase 2 — reseñas Google cableadas (API + home + JSON-LD + atribución).
  Sin keys muestra fallback local. Falta `GOOGLE_PLACE_ID` + `GOOGLE_PLACES_API_KEY`.
- [x] Fase 4 — deploy en Vercel: proyecto `jac10/cordoba-digital` linkeado,
  `DATABASE_URL` en Preview + Production. Pendiente el resto de envs
  (`MP_*`, `GOOGLE_*`, `APP_URL` pública) y `vercel-optimize` con métricas.
- [x] **Fases A–E — migración del catálogo real** (detalle abajo).
- [x] **Galería de producto con un srcset por foto** (detalle abajo).

### Galería: un `srcset` por foto — HECHO

**Síntoma**: en la ficha de producto todas las miniaturas mostraban la misma
foto y al hacer clic no cambiaba la imagen, aunque en WooCommerce cada producto
tiene 2 o más. En el sitio viejo sí se veían fotos distintas.

**No era pérdida de imágenes**: la base tenía 2.146 de 2.588 productos con 2+
fotos, y contra la Store API los 441 que tienen una sola es porque en WP
también tienen una sola.

**Causa**: `products.image_srcset` era un **único array plano por producto** con
las variantes de todas las fotos mezcladas (el iPhone: 29 entradas revueltas
entre 4 fotos). `ProductGallery` pasaba ese mismo array a cada miniatura, así que
el navegador elegía por ancho una variante que podía pertenecer a otra foto y
todas acababan mostrando la misma.

**Arreglo**:

- `products.image_srcsets` (`jsonb`, `string[][]`): un srcset por entrada de
  `images`, alineado por índice. `srcSets[i]` solo contiene variantes de
  `urls[i]`. La columna vieja `image_srcset` quedó sin uso.
- `scripts/lib/wp-images.ts` — elección de variante y armado de galería,
  compartido entre el migrador y el backfill para que no diverjan.
- `ProductGallery` usa el srcset de la foto activa; miniatura `i` → `srcSets[i]`.
- Tarjeta, carrito y checkout usan `imageSrcSets[0]` (solo la foto principal).
- `scripts/backfill-image-srcsets.ts` — escribe **solo** `images` e
  `image_srcsets`; no toca precios, stock ni categorías. Correrlo con
  `--dry-run` primero: imprime cuántos srcsets quedan desalineados.
- `scripts/check-gallery.ts` — valida contra el deploy que las miniaturas
  muestren fotos distintas y que ninguna pueda cargar otra foto.

**Verificado**: 2.588/2.588 alineados, 0 srcsets con variantes de otra foto.
El único producto sin srcsets es `gabinete-aerocool-ore-saturn-...`, que en
WooCommerce tampoco tiene imagen.

**Nota de git**: este fix quedó dentro del commit `b98e8d9`, cuyo mensaje es
"captura y sonda de tema". El otro agente corrió `git add -A` y arrastró estos
archivos. El código está bien; el historial quedó misleading.

### Migración del catálogo real — HECHO

Decisiones tomadas: árbol de categorías **1:1** (128, mismos slugs), imágenes
**servidas desde el WP viejo** vía `<img>`/dominio permitido, stock **1/0
aproximado** (la API pública no da cantidades) y descripciones como **HTML
saneado + highlights**.

| Fase | Qué se hizo | Estado |
| --- | --- | --- |
| A | `scripts/audit-wp.ts` → `docs/CATALOGO-WP.md` (árbol, marcas, tags, mapeo, 301) | ✅ |
| B | `categories.parentId`/`descriptionHtml`/`imageUrl`/`wpId`, `products.descriptionHtml`/`weight`/`dimensions`/`seo*`/`wpId`, tabla puente `product_categories` | ✅ |
| C | `scripts/migrate-wp.ts` sobre la **Store API pública** (sin credenciales), con `--dry-run`/`--prune`/`--limit` y sanitizador HTML propio | ✅ |
| D | Ruta `/categoria/[...path]`, menú con jerarquía, filtros por descendientes, paginación 24, sitemap por índice (3 submaps), 301 de WooCommerce | ✅ |
| E | `scripts/verify-catalog.ts` + `npm run verify:wp` | ✅ |

Verificación contra WooCommerce (`npm run verify:wp`, exit 0):

| Métrica | WooCommerce | Nuestra base |
| --- | --- | --- |
| Categorías | 128 | 128 |
| Productos | 2588 | 2588 |
| Con stock | 2368 | 2368 |
| En oferta | 2383 | 2383 |
| Puentes producto→categoría | — | 4374 |
| Categorías ausentes / extra | — | 0 / 0 |
| Producto con categoría principal distinta | — | 0 |

Notas de la migración:

- El servidor de WordPress responde **403 "browser outdated"** con User-Agent
  vacío o viejo: todos los scripts mandan un UA de Chrome.
- No hacen falta `WC_CONSUMER_KEY`/`WC_CONSUMER_SECRET`. Solo se pierden los
  `seoTitle`/`seoDescription` por producto de Rank Math (requieren `wc/v3`).
- Los conteos por categoría OUR son mayores que los de WooCommerce porque una
  página de categoría incluye los productos de todo su subárbol y un producto
  puede estar en varias ramas. Ej.: `computacion` 1565 vs 996 en WP.
- El prune de la primera corrida borró de más (bug: `notInArray` por chunk en
  lugar de calcular los huérfanos); corregido y re-verificado.
- `next.config.ts` emite **308** en los redirects (semánticamente mejor que 301).

### Imágenes — decidido: no copiar, optimizar

`npm run images:migrate` (sin `--yes`) mide el corpus: **5700 imágenes únicas,
~553 MB** (promedio 99 KB, máximo 718 KB). Copiarlas al repo no conviene:

- 553 MB de binarios en git (historial immense) y en **cada** deploy de Vercel.
- El hosting viejo es del cliente y sigue en pie hasta el corte, así que las
  fotos están disponibles mientras tanto.

Lo que sí se hizo: todas las fotos de producto pasan por `next/image`, que
redimensiona y sirve WebP/AVIF desde el caché de Vercel. Medido sobre
`macbook-air-m5-15-16gb-1tb-sky-blue.png`:

| | Peso |
| --- | --- |
| Original en `wp-content` | 1330 KB |
| Servido por `next/image` (828px) | 96 KB (PNG) / **30 KB (WebP)** |

Cuando el cliente defina su hosting, la copia de las imágenes es una tarea de
migración con su almacenamiento. El script queda listo (`--yes`) pero **no se
va a usar** salvo que el cliente pida almacenamiento propio.

### 0. Organizar carpeta — HECHO

- `public/images/logo.png`, `public/`, `docs/`, `scripts/`, `.archive/`
- `.env.example`, `README.md`, `.gitignore`
- `package.json` renombrado + scripts `db:*`
- `next.config.ts` permite `cordobadigital.net`
- `drizzle.config` usa `DATABASE_URL`

### 1. Compra real (MP Checkout Pro)

1. `mercadopago@3.6.1` instalado.
2. `POST /api/checkout` crea orden `pendiente_pago` como hoy.
3. `POST /api/checkout/mercadopago` crea preferencia con items/order code.
4. CTA `data-mp-checkout-cta="checkout-pro"` en `checkout-flow.tsx` redirige a `init_point`.
5. `POST /api/webhooks/mercadopago` valida firma, marca `pago_confirmado`.
6. Test con usuario comprador + tarjeta APRO, luego `mp-review` mental.

### 2. Reseñas = Google Maps

- `GET /api/google-reviews` (Places API New, cache 24h) + fallback local.
- Atribución Google obligatoria. `aggregateRating` = datos reales.

### 3. Migración WooCommerce

- `scripts/migrate-wp.ts` (REST `wp-json/wc/v3`) → `categories/products`.
- Redirects SEO `/producto/:slug` + sitemap.

### 4. Deploy Vercel preview

- `vercel link` + envs (`DATABASE_URL`, `MP_*`, `GOOGLE_*`) + `vercel deploy -y --no-wait`.
- Luego `vercel-optimize` solo con métricas.

## Skills en uso

- `mp-integrate` (Checkout Pro + locks), `mp-webhooks` (HMAC), `mp-test-setup`
- `deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-optimize`
- Sin `vercel-react-best-practices` (no disponible).
- Migración WP: sin skill fiable → directa por API.
