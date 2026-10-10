# Guía para escribir fichas

Estilo aprobado por Ronan con `lote-1.json` (10/10/2026). Cada lote es un JSON
con la forma de `lote-1.json` y se carga con `npm run fichas -- <lote>`.

## Reglas de contenido

- **No inventar datos.** Todo dato técnico sale de la descripción actual, del
  nombre o del SKU. Si sabés un dato por conocimiento general del modelo y es
  importante, podés usarlo, pero anotalo en `revisar`. Si la descripción actual
  contradice el nombre (otro modelo, otra memoria, "titanio" en un modelo que no
  lo tiene), gana el nombre y lo anotás en `revisar`.
- **Sin promesas que la tienda no confirmó**: nada de cuotas, precios, stock,
  "envío gratis" ni plazos de entrega. Sí se puede decir "garantía oficial",
  "envíos a todo el país" y "retiro en Córdoba".
- Español rioplatense con voseo ("podés", "tenés"), frases cortas y concretas.
  Sin emojis, sin mayúsculas sostenidas, sin "¡increíble!" ni superlativos vacíos.
- Sin restos de copia: "[cite: N]", notas al pie de fabricantes, avisos legales,
  links a sitios de marcas, `&nbsp;`.

## Campos

| Campo | Regla |
|---|---|
| `slug` | Exacto, como viene. No se cambia (es la URL). |
| `name` | Nombre limpio: Marca + modelo + variante. Memorias como "256 GB" y "8 GB RAM". Sin mayúsculas sostenidas. Si el nombre ya está bien, no lo incluyas. |
| `brand` | Solo si hoy es "General" o está mal. |
| `model`, `storage`, `ram` | Columnas propias (se muestran como Modelo, Memoria y RAM). En celulares, siempre que se sepa. No repetirlas en `specs`. |
| `seoTitle` | Máx. 45 caracteres (el sitio agrega " · Córdoba Digital"). Producto + variante clave. |
| `seoDescription` | 120 a 160 caracteres. Qué es + 2 o 3 datos clave + "garantía" + "envíos a todo el país". |
| `shortDescription` | 1 o 2 frases, máx. 250 caracteres. Se ve arriba y en Google si falta la SEO. |
| `highlights` | 4 a 6 viñetas cortas (máx. ~70 caracteres), cada una un beneficio concreto con su dato. |
| `specs` | Tabla `{label, value}` de 6 a 12 filas con datos reales: Pantalla, Procesador, Cámara trasera, Cámara frontal, Batería, Carga, Red, Conectividad, Sistema operativo, En la caja, etc. Sin Marca/Estado/Garantía/SKU (la ficha los agrega sola). |
| `descriptionHtml` | Solo `<p>`, `<h3>`, `<ul>`, `<li>`, `<strong>`, `<a href="/producto/...">`. Intro de 1 o 2 frases, 3 o 4 secciones `<h3>` cortas, y si aplica una sección "Antes de comprar" con limitaciones reales (sin 5G, sin cargador en la caja, etc.). 120 a 250 palabras. |
| `revisar` | Lista de dudas para quien aprueba. No se publica. Vacía si no hay dudas. |
