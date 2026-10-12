---
name: nueva-migracion
description: Cambiar el esquema de la base (src/db/schema.ts) con su migración en drizzle/, probarla en local y dejar listo cómo aplicarla en producción.
---

# Nueva migración

Detalle completo en `docs/MIGRACIONES.md`.

1. Editar `src/db/schema.ts`. Montos siempre `integer` en pesos enteros.
2. `npm run db:generate -- --name que_cambia` y leer el SQL que escribió en `drizzle/`:
   - Que no tenga `DROP` de tablas o columnas con datos sin que se haya pedido.
   - Una columna nueva `not null` en una tabla con filas necesita `default`.
3. Probar en una base local vacía y dos veces seguidas (tiene que ser idempotente):
   `DATABASE_URL=postgres://postgres:ci@127.0.0.1:5432/ci npm run db:migrate && npm run db:migrate`
4. `npm run check` y, si el cambio toca pedidos o productos, `npm run test:api` (actualizar
   `tests/api/db.mts` si hay una tabla nueva que vaciar entre casos).
5. Commitear schema y migración juntos. El CI (`migraciones`) falla si falta una.
6. Producción: no correr nada sin pedido explícito. En el PR dejar escrito el paso para el dueño:
   crear un branch de Neon como backup, `npm run db:migrate -- --status` y recién después `npm run db:migrate`.
