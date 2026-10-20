---
name: informe-html
description: Armar un informe o revisión para Ronan (arquitectura, rendimiento, seguridad, auditoría) como página HTML con la plantilla de la tienda.
---

# Informe en HTML

Partir de `plantilla.html` (en esta carpeta) y reemplazar el contenido; no cambiar los estilos salvo que haga falta.

- **Colores:** son variables en `:root`, con su versión de modo oscuro. Cada etiqueta tiene un solo significado en todo el informe:
  `b-strong` hecho o fuerte, `b-explore` pendiente o vale explorar, `b-spec` no vale o especulativo, `b-own` necesita aprobación de Ronan.
  Si hace falta otro significado, se agrega un color nuevo en vez de reusar uno.
- **Tipografías:** Archivo para títulos y etiquetas, Source Serif 4 para el texto, JetBrains Mono para rutas, código y la línea de `.meta`.
- **Orden:** `header` (meta, título, la respuesta en `.lede`, leyenda), `.top` con la tabla resumen y cómo se verificó, una `section.block` por área con `.finding` de mayor a menor impacto, y al final "Ya estaba bien".
- **Cada hallazgo:** qué pasa hoy, qué cambia para el cliente y dónde (`archivo:línea` en `.where`). Lo que no se verificó se dice.
- Textos en español de Argentina, con voseo y tildes. Sin el nombre completo de Ronan.
- Se publica como artifact (página privada) y el archivo no se commitea: el repo es público.
