# AI Commerce — que ChatGPT recomiende Córdoba Digital

Fuente: conversación ChatGPT Search/Shopping (`Downloads/conversacion_cordoba_digital_chatgpt_search.md`),
cruzada con el estado real del repo (verificado 2026-10-08).

## Objetivo

Que cuando un argentino pregunte en ChatGPT dónde comprar celulares (o tecnología),
Córdoba Digital sea una de las opciones recomendadas — y que sus productos aparezcan
en comparaciones de precio. Cuatro niveles, en orden de ambición:

1. **Córdoba**: "¿Dónde comprar celulares en Córdoba?" → Córdoba Digital.
2. **Argentina**: "¿Dónde comprar Xiaomi en Argentina?" → aparecer aunque no mencionen Córdoba.
3. **Comparación**: "Compará precios del Redmi Note 15" → productos concretos nuestros.
4. **Recomendación**: "Recomendame una tienda confiable" → precios + nuevos/liberados +
   garantía + envío nacional + atención local.

## Doble sistema a trabajar

- **ChatGPT Search**: la tienda como fuente/recomendación.
- **ChatGPT Shopping**: productos concretos (intención de compra; OpenAI los elige por
  disponibilidad, precio, calidad y vendedor principal). Puede ser lo más comercial.
  Evaluar el **Product Feed directo a OpenAI** (acceso por solicitud): pasaríamos de
  "espero que encuentre mi web" a "le doy mi catálogo estructurado".

## Estado real verificado (2026-10-08)

| Área | Estado |
|---|---|
| Sitio indexable | 🟢 |
| Productos reales | 🟢 |
| Categorías por marca/precio | 🟢 |
| Precios visibles | 🟢 |
| Intención local | 🟢 |
| `robots.ts` permite `*` (OAI-SearchBot no bloqueado en app) | 🟡 verif. WAF/CDN e IPs |
| Schema `Product` + `Offer` + `BreadcrumbList` en ficha | 🟢 |
| Schema `AggregateRating` / `Organization` / `LocalBusiness` / `FAQPage` | 🔴 faltan |
| Contenido orientado a compra (1 página = 1 intención) | 🔴 no existe |
| Información comercial estructurada completa | 🟡 parcial |
| Autoridad externa (más allá de Google 562 reseñas 4,3/5) | 🟡 |
| Product Feed para OpenAI | 🔴 |
| Estrategia ChatGPT Shopping | 🔴 |
| Cobertura de consultas nacionales | 🟡 |

Detalles por archivo:

- `src/app/robots.ts`: `allow: /` para `*`, `disallow` solo checkout/pedido/api.
  OAI-SearchBot entra salvo bloqueo de infraestructura (verificar Vercel/WAF, IPs
  publicadas de OpenAI, headers, canonical, JavaScript).
- `src/app/producto/[slug]/page.tsx:139-174`: JSON-LD con `Product`, `Offer`,
  `BreadcrumbList`. Cada ficha debe mostrar inequívoco: marca, modelo, memoria/RAM,
  estado nuevo, liberado sí, precio, stock, garantía, vendedor, ubicación, envío,
  retiro — y el schema debe coincidir con lo visible (sin discrepancias con feed,
  categoría, Merchant Center, móvil). Agregar fecha de actualización visible.
- Reputación: solo Google externa. Faltan menciones (Facebook, prensa local,
  comparativas, directorios) para construir entidad + autoridad + evidencia.

## Qué NO hacer

No llenar el sitio de páginas keyword-stuffing ("comprar celular barato argentina/córdoba...").
**Una página = una intención real**, cada una respondiendo de verdad: quiénes somos,
dónde estamos, venta online, envíos, marcas, precios, nuevos/liberados, garantía, pago,
financiación, retiro, WhatsApp, reputación, diferencia vs MercadoLibre — más productos reales.

Ejemplos de páginas de intención: `/comprar-celulares-en-argentina/`,
`/xiaomi-en-argentina/`, `/celulares-baratos-en-cordoba/`.
Ejemplos editoriales (ya hay base en guías): ML vs tienda directa, qué comprar por
$300.000/$500.000, Xiaomi vs Samsung vs Motorola, gaming, fotografía.

## Fases (en orden)

1. **🔴 Técnica**: OAI-SearchBot + robots + WAF + indexación + canonical + sitemap.
2. **🔴 Catálogo**: Product Schema + precios + stock + disponibilidad + feeds.
3. **🟠 Entidad**: Córdoba Digital = tienda argentina confiable (datos + schema org/local).
4. **🟠 Intención**: páginas comprar + celular + marca + precio + Argentina.
5. **🟡 Autoridad**: señales externas y menciones reales ("Según Córdoba Digital...").
6. **🟢 Shopping**: Product Feed a OpenAI si resulta elegible.

## Cierre: auditoría AI Commerce de celulares

Sobre los ~190 celulares actuales, verificar por producto:
URL → Product Schema → precio → disponibilidad → marca → modelo → imagen → SKU →
categoría → datos visibles vs estructurados → indexabilidad → potencial en Shopping.
Salida: lista de **20–50 productos** con más chance de recomendación.

## Decisiones tomadas

- Alta manual de productos: imágenes por link externo (Blob al final del proyecto),
  sin variantes, columna `origin` para proteger manuales del prune.
