# Fotos de producto en Cloudflare R2

Las fotos del catálogo hoy salen del WordPress viejo (`wp-content`). Para poder
apagarlo se copian a un bucket de Cloudflare R2: ~5.700 fotos, unos 550 MB en
origen y menos después de pasarlas a WebP. Entra en los 10 GB gratis de R2, y R2
no cobra la descarga.

Con R2 configurado, las fotos que se suben desde el panel también van a R2. Sin
las variables, siguen yendo a Postgres como hasta ahora.

## 1. Crear el bucket (una vez, en Cloudflare)

1. Cloudflare → R2 → **Create bucket**. Nombre sugerido: `cordoba-digital-fotos`.
2. En el bucket → **Settings → Public access**: conectar un dominio propio
   (recomendado, p. ej. `fotos.cordobadigital.net`) o activar el subdominio
   `r2.dev` (sirve para probar; Cloudflare lo limita para producción).
3. R2 → **Manage API tokens → Create API token**, permiso **Object Read &
   Write**, solo para ese bucket. Guardar el Access Key ID y el Secret.
4. El **Account ID** está en la página principal de R2.

## 2. Cargar las variables en Vercel

Settings → Environment Variables (Production y Preview):

| Variable | Valor |
| --- | --- |
| `R2_ACCOUNT_ID` | Account ID |
| `R2_ACCESS_KEY_ID` | del token |
| `R2_SECRET_ACCESS_KEY` | del token |
| `R2_BUCKET` | `cordoba-digital-fotos` |
| `R2_PUBLIC_URL` | `https://fotos.cordobadigital.net` (o la URL `r2.dev`), sin barra final |

Después, un redeploy para que las tome.

## 3. Copiar las fotos del WordPress

Con las mismas variables y la `DATABASE_URL` de producción en un `.env` local:

```bash
npm run images:migrate                         # cuenta lo pendiente, no escribe
npm run images:migrate -- --yes --limit=20     # prueba con 20 productos y revisarlos en la tienda
npm run images:migrate -- --yes                # el resto
```

Antes de la corrida real, hacer un branch de la base en Neon como backup: el
script reescribe `products.images`. Se puede cortar y volver a correr: retoma
donde quedó y reintenta las fotos que fallaron.
