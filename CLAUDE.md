# Córdoba Digital

Tienda online de Córdoba Digital (Córdoba, Argentina). Reemplaza el WooCommerce de
`cordobadigital.net`. Next.js 16 + React 19, Postgres (Neon) con Drizzle, Vercel, Tailwind 4.
El cliente es César; la tienda tiene que poder operarse sola desde el panel `/admin`.

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm run check` | Tipos + lint + tests unitarios. Correrlo antes de dar una tarea por terminada |
| `npm run test:api` | Tests de checkout, webhook y panel contra Postgres local (`DATABASE_URL` a localhost, migrada) |
| `npm run test:e2e` | Compra completa en Chromium contra el build (`npm run build` antes) y la misma base local |
| `npm run build` | Build de producción (necesita `DATABASE_URL`, alcanza una de mentira) |
| `npm run seguridad` | `npm audit` de dependencias de producción |
| `npm run db:generate -- --name <nombre>` | Migración nueva después de tocar `src/db/schema.ts` |
| `npm run db:migrate -- --status` | Qué migraciones faltan en una base |
| `npm run dev` | Servidor local en `http://localhost:3000` |

## Áreas

Un PR toca una sola área cuando se puede, y su título empieza con el área (`Checkout: …`).

| Área | Código |
| --- | --- |
| Tienda | páginas públicas de `src/app`, `src/components`, `src/lib/queries.ts`, `src/lib/structured-data.ts` |
| Checkout y pagos | `src/app/api/checkout`, `src/app/api/webhooks`, `src/lib/checkout-*.ts`, `src/lib/pricing.ts`, `src/lib/mercadopago.ts` |
| Envíos | `src/lib/shipping*.ts`, `src/lib/tarifas-envio.ts`, `src/app/api/shipping` |
| Panel admin | `src/app/admin`, `src/app/api/admin`, `src/lib/admin-*.ts` |
| Datos y catálogo | `src/db`, `drizzle/`, `scripts/` |
| Plataforma | `.github/`, `.claude/`, `middleware.ts`, `next.config.ts`, `vercel.json` |

## Tests

`node:test` + `tsx`, archivos `.mts` (permiten `await` arriba de todo). Unitarios en `tests/unit`,
de API en `tests/api` (llaman a los handlers con un `Request` y vacían la base local antes de cada caso),
y la compra en el navegador en `tests/e2e` (Playwright; acá `CHROMIUM_PATH=/opt/pw-browsers/chromium`,
sin `playwright install`).
Un bug arreglado en checkout, pagos o permisos viene con su test.

## Reglas

- Precios y montos en **pesos enteros** (`integer`), nunca centavos.
- Todo cambio en `src/db/schema.ts` viene con su migración en `drizzle/` (el CI lo exige). Ver `docs/MIGRACIONES.md`.
- El servidor recalcula precio, stock, cupón y envío. Nunca confiar en montos que manda el navegador.
- Las rutas `/api/admin/*` verifican la sesión además del middleware, y las que cambian datos chequean CSRF.
- Ningún pedido pasa a pagado sin que el monto cobrado coincida con el total.
- Textos para clientes en español de Argentina (voseo), con tildes. `npm run check:encoding` los revisa.
- No leer ni escribir `.env*` ni correr scripts contra la base de producción sin pedido explícito y backup previo (branch de Neon).
- Scripts que escriben datos se prueban primero con `--dry-run`.
- Checkout, pagos, webhooks y permisos del panel necesitan aprobación de Ronan (`CODEOWNERS`).
- Antes de pedir el merge de un PR que toque checkout, pagos, webhooks, envíos o el panel, correr la skill
  `revision-seguridad` y dejar el resultado como comentario en el PR (la revisión automática de
  `revision-claude.yml` está apagada: no hay `ANTHROPIC_API_KEY`).

## Documentación

`docs/MIGRACIONES.md`, `docs/IMAGENES.md`, `docs/MIGRACION-WP.md`, `docs/TARIFAS-ENVIO.md`, `docs/AI-COMMERCE.md`.
