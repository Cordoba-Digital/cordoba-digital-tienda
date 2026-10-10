Vas a reescribir fichas de producto de la tienda online Córdoba Digital (Córdoba, Argentina). Tecnología, electro, hogar y herramientas.

Archivos en DIR:
- GUIA.md: reglas de estilo y de cada campo. Seguilas. (Los ejemplos de campos mencionan celulares, pero aplican a cualquier producto: adaptá las filas de `specs` al tipo de producto.)
- lote-1.json: ejemplos aprobados por el dueño (impresora HP, lente Canon, TV Samsung, aire LG). Imitá tono, largo y estructura.
- La tanda que te toca (archivo de entrada): productos con name, brand, sku, categorySlug, shortDescription y description (texto plano ya recortado).
- validar.py: corré `python3 -I DIR/validar.py <salida>` y corregí hasta 0 problemas.

Tarea: por cada producto de la entrada escribí una ficha (slug, name si hace falta limpiarlo, brand si es "General" o está mal y el nombre la dice, model si se sabe, seoTitle, seoDescription, shortDescription, highlights, specs, descriptionHtml, revisar). No incluyas storage ni ram salvo en notebooks, PCs y tablets. Guardá `{"lote": "<nombre de la tanda>", "productos": [...]}` en el archivo de salida, mismo orden que la entrada, una ficha por producto sin saltear ninguno.

Reglas clave:
- NO inventes datos técnicos. Solo lo que dice la descripción, el nombre o el SKU. Si un dato no está, no lo pongas. No uses conocimiento propio del modelo para completar specs.
- Si casi no hay información (solo un código de parte, o texto de relleno), escribí una ficha corta y honesta: nombre limpio y entendible (ej. "ASUS 90MB1J80-M0EAY0" → si no sabés qué es, dejá el nombre y anotalo en `revisar`), 2 o 3 highlights con lo que sí se sabe, specs solo con lo seguro (puede ser lista vacía), descripción de 40 a 80 palabras. Anotá en `revisar` qué falta.
- Nombres: sin mayúsculas sostenidas; respetá siglas y códigos (SSD, DDR5, RTX 4060, AM5, TP-Link). Expandí abreviaturas obvias (GAB → Gabinete, MF → Multifunción).
- Nada de precios, cuotas, descuentos, stock ni plazos. Sí "garantía oficial", "envíos a todo el país", "retiro en Córdoba".
- La garantía de la tienda es de 6 meses. No escribas ningún plazo de garantía ("12 meses", "1 año"); alcanza con "garantía oficial".
- Si la ficha corta y la descripción dan cifras distintas para un mismo dato (potencia, velocidad, medidas), no publiques ninguna: dejalo fuera y anotalo en `revisar`.
- Español rioplatense con voseo, sin emojis, frases cortas y concretas. Sin superlativos vacíos.
- Escribí el archivo con Python (json.dump, ensure_ascii=False). Podés trabajar en partes dentro de DIR/_tmp-<tanda>/ para no perder trabajo.
- No uses herramientas cuyo nombre empiece con mcp__hearthbot__. No toques nada fuera de DIR.

Al terminar respondé solo: cuántas fichas escribiste, el resultado del validador y hasta 8 líneas con los productos de dudas más importantes.
