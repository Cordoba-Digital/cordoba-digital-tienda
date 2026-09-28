# Plan cerrado — Córdoba Digital

## Decidido

- País: **AR** (MLA, ARS, es). SDK: **node** (package.json). Cliente: **react** (Next.js).
- Pagos: **Mercado Pago Checkout Pro** (`Preferences API`, `mode=preferences`, `init_point`).
  Sin `sandbox_init_point`, sin `auto_return` en localhost, `external_reference` = código de orden.
- Webhook HMAC-SHA256 (`x-signature` + `x-request-id`), responde 200 inmediato, idempotente.
- Catálogo: **migrar real desde WooCommerce** (`cordobadigital.net`), no seed demo.
- Deploy: **Vercel preview** (no producción hasta validar).

## Estado (27/09/2026)

- [x] Fase 0 — carpeta organizada, `lint` + `tsc` en verde.
- [x] Fase 1 — MP Checkout Pro esqueleto (preferencia, webhook HMAC, CTA).
  Bloqueado para prueba real: falta `MP_ACCESS_TOKEN` (pestaña Prueba) y `MP_WEBHOOK_SECRET`.
- [x] Fase 2 — reseñas Google cableadas (API + home + JSON-LD + atribución).
  Sin keys muestra fallback local. Falta `GOOGLE_PLACE_ID` + `GOOGLE_PLACES_API_KEY`.
- [x] Fase 3 — `scripts/migrate-wp.ts` + `--dry-run` + `docs/MIGRACION-WP.md`.
  Falta `WC_STORE_URL` + keys y `DATABASE_URL` para correrla.
- [x] Fase 4 — deploy en Vercel: proyecto `jac10/cordoba-digital` linkeado,
  `DATABASE_URL` en Preview + Production, deploy Ready en
  https://cordoba-digital-9sjhyg5wq-jac10.vercel.app (alias cordoba-digital.vercel.app).
  Nota: Vercel asignó el primer deploy a producción automáticamente;
  los próximos serán preview salvo `--prod`. Pendiente: resto de envs
  (`MP_*`, `GOOGLE_*`, `WC_*`, `APP_URL` pública) y `vercel-optimize` con métricas.

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
