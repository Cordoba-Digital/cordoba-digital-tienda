---
name: revision-seguridad
description: Revisar un cambio o el repo buscando problemas de seguridad propios de esta tienda (montos, webhook, panel admin, secretos, dependencias) antes de pedir aprobación.
---

# Revisión de seguridad

1. Automático (lo mismo que corre el CI en `seguridad.yml`):
   - `npm run seguridad` (dependencias de producción, falla con altas o críticas).
   - Secretos: que el diff no agregue claves, tokens ni `.env*`. No abrir archivos `.env*`.
2. Recorrer el diff con esta lista:
   - **Montos**: el servidor recalcula todo; ningún precio, descuento o envío sale del body del pedido.
   - **Webhook de Mercado Pago**: firma HMAC verificada antes de leer nada, pago consultado a la API
     de MP (no al body), monto cobrado igual al total, repetir el aviso no mueve stock dos veces.
   - **Panel**: cada `/api/admin/*` llama a `readAdminSession`/`verifyAdminSessionValue` aunque el
     middleware ya filtre; lo que borra o da accesos es solo para dueños (`isOwnerEmail`); las
     escrituras pasan por el chequeo de `Origin` del middleware (no excluir rutas nuevas de ese chequeo).
   - **Entrada del usuario**: validada en el servidor; SQL solo con Drizzle o `sql\`...\`` con parámetros,
     nunca concatenando strings; HTML de clientes escapado.
   - **Datos personales**: emails, teléfonos y DNI no van a logs ni a respuestas públicas.
   - **Cookies**: `HttpOnly`, `SameSite=Strict` en el admin, `Secure` en producción.
3. Si encontrás algo, escribí un test que lo muestre en `tests/api/` antes de arreglarlo.
4. Checkout, pagos, webhooks y permisos del panel necesitan aprobación de Ronan (`CODEOWNERS`).
