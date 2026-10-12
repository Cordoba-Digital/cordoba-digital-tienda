# SEO y GEO de Mercado Libre y Frávega (octubre 2026)

Ingeniería inversa del HTML que reciben los buscadores y los bots de IA, hecha el
2026-10-12 con REA (`inspect_web_page` sobre Chrome real por CDP) y pedidos HTTP con
distintos user-agents (navegador, Googlebot, OAI-SearchBot). Es una foto de ese día:
estos sitios cambian seguido.

## Mercado Libre

| Qué | Observado |
| --- | --- |
| Navegador headless o cliente sin JS | Redirige a `/gz/account-verification` (muro anti-bot). REA vio una página de 47 nodos sin contenido (evidencia `ev_2f09b065…`). |
| User-agent de Googlebot | HTML completo renderizado en el servidor (*dynamic serving*): 470 KB en la ficha, 735 KB en el listado. |
| User-agent de OAI-SearchBot | Muro anti-bot, igual que un navegador headless. |
| `robots.txt` | `Disallow: /` explícito para GPTBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Perplexity-User y Amazonbot. Sin `llms.txt` (404). |
| Ficha (`/p/MLA…`) | JSON-LD `Product` con `offers` (precio, `InStock`, `priceValidUntil`, `hasMerchantReturnPolicy` de 30 días con devolución gratis), `aggregateRating` (4,8 · 4.220 calificaciones), 5 `review` con texto, `itemCondition`, `color`, `brand`, `sku`. Además `BreadcrumbList` y un `Table` ("Características principales"). |
| Canonical | El ID (`MLA46477687`) manda: con un slug equivocado, el canonical corrige al slug real. |
| Listado (`listado.mercadolibre.com.ar/<búsqueda>`) | Un `@graph` con ~50 `Product` completos (precio, stock, marca, imagen, rating) más un `SearchResultsPage`. Cada búsqueda es una página indexable con su canonical. |
| Título y descripción | Plantilla fija: `<producto> \| MercadoLibre` y "✓ Comprá online de manera segura con Compra Protegida © <producto> ❤". |

**Conclusión**: SEO de Google al máximo, pero cierra la puerta a los asistentes de IA.
ChatGPT, Claude y Perplexity no pueden leer sus fichas.

## Frávega

| Qué | Observado |
| --- | --- |
| Stack | Next.js con Pages Router (ruta `l/[[...categorySlug]]`, `__NEXT_DATA__` con Apollo) sobre VTEX (el 404 de `/llms.txt` cae en el buscador de VTEX). |
| Listado (`/l/celulares/celulares-liberados/`) | Renderizado en el servidor: título, descripción, canonical, `index,follow`, un H1 y 37 `<article>` (REA, evidencia `ev_ab603534…`). JSON-LD: solo un `FAQPage` con 5 preguntas editoriales genéricas ("¿Qué es un celular liberado?", "¿Cuánta RAM necesita?"). Sin `ItemList` ni `Product`. |
| Ficha (`/p/…`) | El HTML inicial es un shell: título genérico de la home, sin canonical, sin JSON-LD y Apollo vacío. Pasó lo mismo en 5 fichas distintas y también con user-agent de Googlebot. Después de ejecutar JS el título pasa a ser el del producto (REA, evidencia `ev_204f8c1a…`). |
| `robots.txt` | Solo `User-agent: *`. Sitemap index con `productos-01..03.xml`. |

**Conclusión**: Google ve las fichas porque ejecuta JavaScript. Los bots de IA, que
en su mayoría no lo ejecutan, ven una página vacía: para GEO las fichas de Frávega
no existen.

## Dónde estamos nosotros

Ya teníamos más que los dos en GEO: todo se renderiza en el servidor, `robots.ts`
nombra a los bots de IA uno por uno, hay `llms.txt`, `products.xml` y en la ficha un
`Product` con `Offer`, política de devolución y rating de compras verificadas.

Las brechas estaban en la página de categoría y se cerraron en `src/lib/category-seo.ts`:

1. **`ItemList` con `Product` completos** (como el listado de ML): precio en pesos
   enteros, stock, marca e imagen por posición, con el mismo `@id` que la ficha.
2. **`FAQPage` por categoría** (como Frávega), pero con respuestas que salen del
   catálogo: rango de precios real, cantidad con stock y marcas principales, más
   envío, garantía y local. Las preguntas se ven en la página, no solo en el JSON-LD.

No se copió el rating por producto en el listado: el `rating` de las tarjetas viene
de WooCommerce y la ficha solo publica el de compras verificadas.

## Pendientes posibles

- Reseñas individuales (`review`) en la ficha, como ML, solo con las de compra verificada.
- Páginas de búsqueda indexables por modelo (lo que hace ML con `listado.…/<búsqueda>`).
  Con cuidado: con un catálogo chico generan contenido duplicado o casi vacío.
