# Conexión con Andreani

La tienda usa la misma API que el plugin oficial "Andreani Envíos" para
WooCommerce (`andreani-shipping`), que es lo que el local usaba en el sitio
viejo. El cliente está en `src/lib/andreani.ts`.

## Credencial

- Es el **ID de credencial** que da `pymes.andreani.com` en *Integraciones*
  (opción WooCommerce). Es un texto en base64 que empieza con `Pyme|`.
- Vive solo en la variable `ANDREANI_CREDENTIAL` de Vercel (Production y
  Preview). No va en el repo ni en `.env` commiteados.
- No hacen falta números de contrato ni de cliente: los contratos de la cuenta
  vienen en la respuesta del login.
- Sin la variable, todo sigue andando con las tarifas fijas por zona
  (`tarifas-envio.ts`).

## Qué hace

| Dónde | Qué |
| --- | --- |
| Checkout | Cotiza con el peso y las medidas de cada producto. Si algún producto no tiene medidas, o Andreani no responde, usa la tarifa fija. |
| Checkout, "Andreani (sucursal)" | El cliente elige la sucursal de retiro de la lista de Andreani para su CP. |
| Panel, detalle del pedido | "Crear envío en Andreani" da de alta el envío. Se paga en el portal de PyMEs; recién ahí aparece el número de seguimiento. "Actualizar seguimiento" lo trae y "Descargar etiqueta" baja el PDF. |
| Cron diario (`/api/cron/vencer-pedidos`) | Trae seguimiento y estado de los envíos abiertos. Si Andreani dice "entregado", el pedido pasa a Entregado. |
| Página del pedido | Muestra la sucursal elegida y el link de seguimiento en andreani.com. |

## Medidas de los productos

El precio de Andreani depende sobre todo del volumen. Las medidas salen del
campo "Medidas (largo × ancho × alto)" del producto en el panel, en cm. Si
falta el peso se toma 1 kg. Un producto sin medidas se cotiza con la tarifa
fija y no se le puede crear el envío desde el panel hasta cargarlas.

## Cosas a confirmar con la cuenta real

La API no tiene documentación pública; esto se sacó del código del plugin.
En los logs de Vercel, la primera conexión deja `[andreani] sesión iniciada`
con las modalidades de los contratos, y una tarifa que no se reconoce deja
`[andreani] tarifas sin modalidad reconocida`. Si aparece eso, hay que sumar
el nombre a `modalidadDe()`.
