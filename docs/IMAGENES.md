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

Desde el panel: **Catálogo → Fotos del WordPress → Copiar fotos del WordPress**.
Trabaja por tandas de ~40 segundos con la pestaña abierta, se puede pausar y
retomar, y lo ya copiado no se repite. Las fotos que fallan quedan con su URL
vieja y se pueden reintentar.

Desde la terminal hace lo mismo `npm run images:migrate` (sin `--yes` solo
cuenta; `--limit=20` para probar con pocos productos).

Antes de la copia completa conviene hacer un branch de la base en Neon como
backup: la copia reescribe `products.images`.
