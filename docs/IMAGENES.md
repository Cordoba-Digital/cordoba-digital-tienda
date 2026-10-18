# Fotos de producto

Las fotos del catálogo salían del WordPress viejo (`wp-content`). Para poder
apagarlo se copian a nuestro almacenamiento: ~5.700 fotos, unos 550 MB en
origen y menos después de pasarlas a WebP.

## Dónde se guardan

`src/lib/image-storage.ts` elige, en este orden:

1. **Cloudflare R2**, si están las variables `R2_*` (ver `.env.example`).
2. **Vercel Blob**, si está `BLOB_READ_WRITE_TOKEN`. El proyecto ya tiene un
   store conectado, así que esta es la opción activa.
3. Si no hay ninguno, Postgres (tabla `product_images`, servida en `/imagenes/...`).

Las fotos que se suben desde el panel van al mismo lugar. Pasar de Blob a R2
más adelante es cargar las `R2_*` y volver a correr la copia sobre las URLs
de Blob (habría que ampliar `isStoredImageUrl` para que las tome como pendientes).

## Copiar las fotos del WordPress

Desde el panel: **Catálogo → Fotos → Copiar fotos del WordPress** (la sección aparece mientras quede alguna foto por copiar).
Trabaja por tandas de ~40 segundos con la pestaña abierta, se puede pausar y
retomar, y lo ya copiado no se repite. Las fotos que fallan quedan con su URL
vieja y se pueden reintentar.

Desde la terminal hace lo mismo `npm run images:migrate` (sin `--yes` solo
cuenta; `--limit=20` para probar con pocos productos).

Antes de la copia completa conviene hacer un branch de la base en Neon como
backup: la copia reescribe `products.images`.

## Revisar fotos chicas, faltantes o equivocadas

**Catálogo → Fotos** muestra cuántos productos no tienen foto, cuántos tienen la
foto principal chica (lado más largo por debajo de 800 px, que en la ficha se ve
borrosa) y cuántos se marcaron para cambiar. Cada número abre la lista de
productos ya filtrada; el mismo filtro está en **Productos → Todas las fotos**.

- **Medir fotos** lee la cabecera de la foto principal de cada producto (los
  primeros 64 KB, no la foto entera) y guarda ancho y alto en
  `product_photo_checks`. Trabaja por tandas como la copia del WordPress. Si la
  foto principal cambia, la medición vieja deja de contar y vuelve a "Sin medir".
- **Marcar foto**, en cada fila de la lista, es para las que no corresponden al
  producto o se ven mal aunque tengan buen tamaño: eso no se puede detectar solo.
  Cambiar la foto principal desde Editar saca la marca.

Lo que no mide: la compresión. Una foto de 1200 px muy comprimida se ve mal y no
aparece como chica; para esas está la marca.

## Fotos sugeridas

En **Catálogo → Fotos**, debajo de los contadores, aparecen las fotos oficiales sugeridas para productos con
foto chica o sin foto. Cada tarjeta muestra la foto actual al lado de la sugerida (con su tamaño real) y el
link de dónde sale.

- **Usar**: el servidor la descarga, la pasa a WebP como las que se suben desde el panel y la pone
  como principal. Si la sugerencia trae otras vistas del producto (atrás, costado, detalle), se suman las que
  queden tildadas, en ese orden. Las fotos anteriores quedan después; se pueden borrar desde Editar. Si una
  vista extra no se puede bajar, se sigue con el resto.
- **Descartar**: la sugerencia desaparece y el producto queda igual.

La lista vive en `src/data/fotos-sugeridas.json` (`slug`, `image`, `source`, `confidence` `alta`/`media`,
`note` y `extras`, hasta 4 URLs). La ruta `/api/admin/fotos-sugeridas` solo acepta pares producto/foto de esa
lista y, de las vistas extra, solo las que trae esa sugerencia; lo usado o
descartado queda en `photo_suggestion_decisions` (migración `0010`, la tabla también se crea sola).
Las fotos se buscaron en sitios de fabricantes o distribuidores oficiales, nunca en MercadoLibre ni en otras
tiendas.
