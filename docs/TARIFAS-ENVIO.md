# Tarifas de envío

## De dónde salen los números

Salen del **propio calculador del sitio original**, no de un tarifario inventado.

El sitio viejo tiene un plugin propio de Andreani que expone el cálculo por
AJAX público:

```
POST https://www.cordobadigital.net/wp-admin/admin-ajax.php
  action   = andreani_cotizar_envio
  nonce    = el que viene en la ficha del producto
  product_id = id de WooCommerce
  postcode = codigo postal
  quantity = cantidad
```

Los valores de `src/lib/tarifas-envio.ts` se leyeron de ahí el **29/09/2026**.
Cross-check: para el teclado Logitech MK235 a cp 5000 el plugin devuelve
$5.556 / $8.331, que es exactamente lo que se ve en pantalla en la ficha del
sitio viejo. Coincide con las capturas del local.

## Qué estaba mal antes

`src/lib/shipping.ts` tenía una tabla inventada de 5 zonas con precios redondos
que no salen de ningún tarifario:

| CP | Antes (inventado) | Real | Error |
|---|---|---|---|
| 5000 Córdoba Capital | $4.900 | $5.556 / $8.331 | -12% |
| 8000 Neuquén | $13.900 | $7.573 / $9.408 | **+84%** |
| 9100 Comodoro | $13.900 | $8.896 / $10.850 | +56% |

Además:

- **Faltaba el servicio a sucursal.** El local vende "Andreani (sucursal)"
  (retirar en la sucursal) y "Andreani (estándar)" (a domicilio). El primero
  sale ~30% menos y no existía en el sitio nuevo.
- **"Moto express en el día" con "cadetería propia"** no tiene respaldo: no
  aparece en el sitio viejo ni en su configuración de Andreani. Era una
  afirmación inventada sobre un negocio que no está confirmado.
- **"Andreani prioritario 24/48 hs"** tampoco existe en su configuración. Venía
  de multiplicar el precio inventado por 1,7.
- **Las zonas estaban mal nombradas.** Mendoza (5500) caía en "Interior de
  Córdoba"; San Francisco, Córdoba (2400) en "Centro y Litoral"; Posadas (6000)
  en "Patagonia".

## Las cuatro zonas reales

| Zona | A sucursal | A domicilio | Códigos de control |
|---|---|---|---|
| Local | $5.556 | $8.331 | 5000, 5100, 5200 |
| General | $7.573 | $9.408 | CABA, La Plata, Rosario, Santa Fe, Mendoza, San Juan, San Luis, Neuquén, Villa María, Santiago del Estero… |
| Norte | $8.250 | $10.277 | Corrientes, Resistencia, Formosa, Salta, Jujuy, Bariloche |
| Caribe | $8.896 | $10.850 | Posadas, Comodoro Rivadavia, Viedma, Ushuaia, Río Grande |

**La zona no sigue geografía.** Hay cruces que rompen cualquier regla por
prefijo o por distancia:

- Posadas (3300) es la zona más cara del país, pero Obera, a 300 km (6000), es
  la general.
- Bariloche (8400) es "norte", pero Neuquén (8000) es "general".
- Catamarca (4700) es "general", pero Salta (4400) es "norte".

Por eso `ZONA_POR_PREFIJO` es una **aproximación**: reproduce los 35 códigos que
se verificaron uno por uno, pero ante un CP no verificado no hay garantía. La
tabla exacta vive en el tarifario de Andreani, no en este repo.

## Lo que falta: el peso volumétrico

La tarifa real depende del **tamaño del paquete**, no solo de la zona. Al mismo
código postal y con la misma cantidad de 1:

| Producto | Precio | A sucursal | A domicilio |
|---|---|---|---|
| Adaptador USB Tenda | $47.999 | $5.524 | $8.181 |
| GoPro Battery | $129.999 | $5.524 | $8.181 |
| Pava eléctrica Liliana | $62.999 | $5.556 | $8.331 |
| Kit teclado Logitech | $31.999 | $5.556 | $8.331 |
| Soporte de pared | $59.999 | $15.937 | $18.146 |
| Valija de viaje | $99.999 | $18.086 | $19.304 |

Una valija paga **3,3 veces** lo que paga un adaptador USB. Cualquier tariff
plano por zona sube o baja mucho, y en el caso de los productos grandes lo
subestima (la valija queda 73% por debajo de lo que cuesta de verdad).

**Por qué no se puede calcular todavía:** nuestra tabla `products` tiene las
columnas `weight` y `dimensions`, pero están llenas al 39% y **todos los pesos
valen `1`** (datos de relleno). La WooCommerce Store API que usamos para
migrar no expone peso ni dimensiones.

Para cerrarlo hay dos caminos:

1. **Pedirle al local su base de WooCommerce** (o los pesos y dimensiones). Es
   lo limpio y además sirve para otros cálculos.
2. **Consultar su calculador una vez por producto** (2.589 peticiones de solo
   lectura, con pausas). Funciona: el nonce es global, no por producto, así que
   una consulta a cp 5000 devuelve la tarifa exacta de ese producto. Con eso se
   arma una tabla de envío real por producto, sin depender de los pesos.

La opción 2 tiene el detalle de que la fuente es el sitio del cliente y no un
contrato: si Andreani les cambia la tarifa, hay que repetirla.

## Cómo se revalida

```bash
npx tsx --env-file=.env scripts/check-tarifas-envio.ts
```

Comprueba que los precios estén ordenados por zona, que el escalón más bajo
coincida con `PRECIO_POR_ZONA`, y que los 35 códigos verificados devuelvan la
zona que devolvió el calculador original.
