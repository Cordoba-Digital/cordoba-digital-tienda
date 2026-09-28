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

## Scripts

- `npm run dev` — desarrollo
- `npm run build` / `npm start` — producción
- `npm run db:push` — crea tablas (`drizzle-kit push`)
- `npm run db:seed` — siembra catálogo demo (vía `ensureSeeded`)
- `npm run typecheck` / `npm run lint`

## Pagos

- Transferencia/efectivo/retiro: flujo interno, estado `pendiente_pago`.
- Mercado Pago Checkout Pro: crea preferencia (`/api/checkout/mercadopago`),
  redirige a `init_point`, confirma por webhook (`/api/webhooks/mercadopago`)
  con validación HMAC `x-signature`. Nunca `sandbox_init_point`.
- Tarjeta directa: se procesa vía Mercado Pago (no se guardan datos de tarjeta).

## Estructura

- `src/app` — páginas + API routes
- `src/components` — UI (checkout en `checkout-flow.tsx`)
- `src/lib` — precios, envíos, queries, seed
- `src/db` — schema Drizzle
- `scripts` — migración WooCommerce (`migrate-wp.ts`)
- `public/images` — logo + assets
- `docs` — plan cerrado y guías
