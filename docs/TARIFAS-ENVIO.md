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

## Lo que falta: el peso volumétrico (VERIFICADO, y ya se puede calcular)

La tarifa real depende del **volumen del paquete**, no solo de la zona. Quedó
probado el 2026-09-29 cruzando la tarifa real con las medidas reales de cada
producto:

| Producto | Peso | Medidas | Volumen | A sucursal | A domicilio |
|---|---|---|---|---|---|
| Adaptador USB Tenda | 1 kg | 4×10×10 | 400 cm³ | $5.524 | $8.181 |
| GoPro batería | 0,3 kg | 10×4×15 | 600 cm³ | $5.524 | $8.181 |
| Teclado Logitech MK235 | 1 kg | 30×10×10 | 3.000 cm³ | $5.556 | $8.331 |
| Pava eléctrica Liliana | 2 kg | 25×20×10 | 5.000 cm³ | $5.556 | $8.331 |
| **Valija ELF** | **2,4 kg** | 21×38×56 | **44.688 cm³** | **$18.086** | **$19.304** |
| **Valija Everlast** | **5 kg** | 22×38×56 | **46.816 cm³** | **$18.086** | **$19.304** |

**Correlación volumen → precio: r = 0,9969.**

Lo que prueba esto:

- **El precio sube con el volumen.** r casi 1.
- **Lo que manda es el volumen, no la masa.** Las dos valijas pesan 2,4 kg y
  5 kg y cobran **exactamente lo mismo**. Si fuera por peso, la de 5 kg
  costaría más.
- **Es por escalones discretos.** Entre 5.000 y 44.688 cm³ el precio se
  multiplica por 3,3: hay un corte de volumen en el tarifario.
- **No depende del precio del producto.** Dos valijas de $99.999 y $89.999
  pagan lo mismo.

**Y el dato clave: el peso y las medidas reales SÍ están en las fichas del
sitio viejo**, en el JSON-LD de `Product` (`weight`, `depth`, `width`,
`height`), o en la tabla de atributos. Se leen sin credenciales. Por eso lo que
decía esta misma doc antes ("la Store API no expone peso ni dimensiones, no se
puede calcular") era una conclusión equivocada a medias: la Store API
efectivamente no las expone, pero el HTML del sitio sí.

Lo que sigue pendiente es bajarlas para los 2.589 productos y escribir el
escalonado. Mientras tanto, `PRECIO_POR_ZONA` es el precio del **paquete más
chico**, así que los productos grandes quedan subestimados: una valija figura
$5.556 cuando de verdad cuesta $18.086 (73% por debajo).

Nota operativa: el nonce del plugin es global, no por producto, pero WordPress
lo renueva cada 12 horas y el caché de página del sitio viejo sirve nonces viejos
(el plugin responde `403 -1`). Para un barrido largo hay que refrescar el nonce
contra una ficha que esté cacheada recientemente.

## Envío gratis: no existe, y se Sacó

No hay umbral de envío gratis en el sitio original. Se comprobó en el home, en
la ficha de producto y en el resto del contenido: cero menciones de "gratis" o
"$250.000". Los 2.589 productos migrados tienen `free_shipping = false`.

Se eliminó todo: la constante `FREE_SHIPPING_THRESHOLD`, la barra de progreso
"Te faltan $X para el envío gratis" del carrito y del cajón, el aviso de la
ficha, el cintillo del header, la pregunta de la página de ayuda, la meta
description, los dos textos del home y el filtro "Envío gratis" del catálogo
(que además estaba muerto: filtraba por un campo siempre falso).

La única entrega sin cargo que queda es el retiro en el local, que sí es gratis.
`scripts/check-tarifas-envio.ts` ahora falla si algún servicio de Andreani
devuelve precio 0 o si aparece la palabra "gratis" en una etiqueta.

## Cómo se revalida

```bash
npx tsx --env-file=.env scripts/check-tarifas-envio.ts
```

Comprueba que los precios estén ordenados por zona, que el escalón más bajo
coincida con `PRECIO_POR_ZONA`, y que los 35 códigos verificados devuelvan la
zona que devolvió el calculador original.
