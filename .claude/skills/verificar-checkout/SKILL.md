---
name: verificar-checkout
description: Verificar que el checkout, los pagos y el webhook de Mercado Pago siguen bien después de tocar src/app/api/checkout, src/app/api/webhooks, src/lib/checkout-*.ts, pricing.ts, shipping*.ts u order-status.ts.
---

# Verificar checkout

Usar después de cualquier cambio en el área Checkout y pagos o Envíos, antes de abrir el PR.

1. `npm run check` (tipos, lint y tests unitarios de precios, validación, envíos y estados).
2. Tests de API contra un Postgres local migrado:
   - Devcontainer: la base ya está en `db`. Fuera de él: `service postgresql start` o un `postgres:16` en Docker.
   - `DATABASE_URL=postgres://postgres:ci@127.0.0.1:5432/ci npm run db:migrate`
   - `DATABASE_URL=postgres://postgres:ci@127.0.0.1:5432/ci npm run test:api`
   - `tests/api/db.mts` se niega a correr contra una base que no sea local. Nunca apuntarlo a Neon.
3. Si el cambio arregla un bug o agrega una regla, sumar el caso en `tests/api/checkout.test.mts` o
   `tests/api/webhook-mercadopago.test.mts` y verlo fallar sin el arreglo.
4. Revisar a mano en el diff que se cumplan las reglas de `CLAUDE.md`:
   - El servidor recalcula precio, stock, cupón y envío; nada de montos del navegador.
   - Pesos enteros, nunca centavos.
   - Ningún pedido pasa a pagado sin firma válida y sin que el monto cobrado coincida con el total.
   - Stock `1` es "disponible" (catálogo migrado), solo se descuenta stock mayor a 1.
5. Si se tocó la pantalla de checkout: `npm run dev` y `npm run verificar:flujo -- http://localhost:3000`.
6. El PR lleva título `Checkout: …` y necesita aprobación de Ronan (`CODEOWNERS`).
